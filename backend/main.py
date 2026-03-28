"""
ATMOSCHAIN Backend — FastAPI v4.1 (Integrated with WasteVision AI)
Receives live detection frames via WebSockets from React frontend,
runs YOLO + PyTorch classification, updates state.
"""
from fastapi import FastAPI, File, UploadFile, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, List, Any
import random
import json
import os
import cv2
import numpy as np
import base64
import torch
import torch.nn as nn
from torchvision import models, transforms
from PIL import Image
from ultralytics import YOLO

app = FastAPI(title="ATMOSCHAIN API", version="4.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Config ─────────────────────────────────────────────────────────────────────
BACKEND_DIR = os.path.dirname(__file__)
DATASETS_DIR = os.path.join(BACKEND_DIR, '..', 'datasets')

METHANE_FACTORS = {
    "Food Organics":       {"factor": 0.138, "color": "#ff7043"},
    "Cardboard":           {"factor": 0.080, "color": "#8d6e63"},
    "Paper":               {"factor": 0.075, "color": "#90a4ae"},
    "Plastic":             {"factor": 0.000, "color": "#42a5f5"},
    "Glass":               {"factor": 0.000, "color": "#26c6da"},
    "Metal":               {"factor": 0.000, "color": "#bdbdbd"},
    "Textile Trash":       {"factor": 0.060, "color": "#ab47bc"},
    "Vegetation":          {"factor": 0.040, "color": "#66bb6a"},
    "Miscellaneous Trash": {"factor": 0.030, "color": "#ffa726"},
}
GWP_CH4 = 28

def calculate_methane(waste_class: str, mass_kg: float) -> dict:
    info    = METHANE_FACTORS.get(waste_class, METHANE_FACTORS["Miscellaneous Trash"])
    ch4_kg  = round(mass_kg * info["factor"], 4)
    co2e_kg = round(ch4_kg * GWP_CH4, 4)
    credits  = round(co2e_kg / 1000, 6)
    energy   = round(ch4_kg * 13.9, 4)
    return dict(ch4_kg=ch4_kg, co2e_kg=co2e_kg, carbon_credits=credits, energy_kwh=energy)

def load_dataset(filename: str):
    path = os.path.join(DATASETS_DIR, filename)
    with open(path, 'r') as f:
        return json.load(f)

# ── AI Model Setup ─────────────────────────────────────────────────────────────
device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
class_names = []
classifier = None
yolo_detector = None

@app.on_event("startup")
def load_models():
    global class_names, classifier, yolo_detector
    
    print("Loading YOLO generic object detector...")
    yolo_detector = YOLO(os.path.join(BACKEND_DIR, 'yolov8n.pt')) 

    print("Loading custom Waste Classifier...")
    try:
        with open(os.path.join(BACKEND_DIR, 'class_names.json'), 'r') as f:
            class_names = json.load(f)
            
        classifier = models.mobilenet_v2(pretrained=False)
        num_ftrs = classifier.classifier[1].in_features
        classifier.classifier[1] = nn.Linear(num_ftrs, len(class_names))
        classifier.load_state_dict(torch.load(os.path.join(BACKEND_DIR, 'waste_model.pth'), map_location=device))
        classifier = classifier.to(device)
        classifier.eval()
        print(f"Loaded Waste Classifier successfully with classes: {class_names}")
    except Exception as e:
        print(f"WARNING: Could not load custom classifier. Error: {e}")

transform = transforms.Compose([
    transforms.Resize(256),
    transforms.CenterCrop(224),
    transforms.ToTensor(),
    transforms.Normalize([0.485, 0.456, 0.406], [0.229, 0.224, 0.225])
])

def classify_crop(crop_img_rgb):
    if classifier is None:
        return "Unknown"
    pil_img = Image.fromarray(crop_img_rgb)
    input_tensor = transform(pil_img).unsqueeze(0).to(device)
    with torch.no_grad():
        outputs = classifier(input_tensor)
        _, preds = torch.max(outputs, 1)
    label = class_names[preds[0].item()]
    
    # Map wastevision labels to ATMOSCHAIN labels if needed
    # (Since wastevision uses realwaste labels, let's just capitalize and handle)
    mapping = {
        "Cardboard": "Cardboard",
        "Food Organics": "Food Organics",
        "Glass": "Glass",
        "Metal": "Metal",
        "Miscellaneous Trash": "Miscellaneous Trash",
        "Paper": "Paper",
        "Plastic": "Plastic",
        "Textile Trash": "Textile Trash",
        "Vegetation": "Vegetation"
    }
    # find closest match or return exact
    for key in mapping:
        if key.lower() in label.lower():
            return mapping[key]
    return "Miscellaneous Trash"

# ── In-memory latest detection state ──────────────────────────────────────────
latest_detection = {
    "objects":    [],
    "totals":     {"count": 0, "ch4_kg": 0, "co2e_kg": 0, "energy_kwh": 0, "credits": 0},
    "timestamp":  None,
    "mode":       "idle",
    "reactor_ready": False,
}

class ReactorRequest(BaseModel):
    methane_kg: float
    waste_objects: Optional[List[Any]] = None

@app.get("/")
def root():
    return {
        "message": "ATMOSCHAIN API v4.1 with WasteVision WS",
        "detection_status": latest_detection["mode"],
        "objects_in_frame": latest_detection["totals"]["count"],
    }

@app.get("/detection/latest")
def get_latest_detection():
    return latest_detection

@app.get("/detection/status")
def detection_status():
    return {
        "connected":  latest_detection["timestamp"] is not None,
        "mode":       latest_detection["mode"],
        "frame_time": latest_detection["timestamp"],
        "objects":    latest_detection["totals"]["count"],
    }

# ── WasteVision WebSocket ──────────────────────────────────────────────────────
from datetime import datetime

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    print("WebSocket connection established (WasteVision).")
    global latest_detection
    try:
        while True:
            data = await websocket.receive_text()
            if not data.startswith("data:image"):
                continue
                
            header, b64body = data.split(',', 1)
            img_bytes = base64.b64decode(b64body)
            np_arr = np.frombuffer(img_bytes, np.uint8)
            frame = cv2.imdecode(np_arr, cv2.IMREAD_COLOR)

            if frame is None:
                continue
            
            frame_rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            detections_payload = []
            
            total_ch4_kg = 0
            total_co2e_kg = 0
            total_energy_kwh = 0
            total_credits = 0
            atmoschain_objects = []

            if yolo_detector is not None:
                results = yolo_detector(frame_rgb, verbose=False)
                for r in results:
                    boxes = r.boxes
                    for box in boxes:
                        x1, y1, x2, y2 = map(int, box.xyxy[0])
                        conf = box.conf[0].item()
                        
                        if conf > 0.3:
                            crop_h, crop_w = y2 - y1, x2 - x1
                            if crop_h > 20 and crop_w > 20:
                                crop = frame_rgb[y1:y2, x1:x2]
                                custom_label = classify_crop(crop)
                                
                                # Estimate mass
                                crop_area = crop_w * crop_h
                                estimated_mass = round(min(5.0, max(0.05, crop_area / 30000.0)), 2)
                                
                                md = calculate_methane(custom_label, estimated_mass)
                                color = METHANE_FACTORS.get(custom_label, METHANE_FACTORS["Miscellaneous Trash"])["color"]
                                
                                total_ch4_kg += md['ch4_kg']
                                total_co2e_kg += md['co2e_kg']
                                total_energy_kwh += md['energy_kwh']
                                total_credits += md['carbon_credits']

                                # Construct for WasteVision UI overlap
                                methane_est = md["ch4_kg"]
                                detections_payload.append({
                                    "box": [x1, y1, x2, y2],
                                    "label": custom_label,
                                    "confidence": conf,
                                    "methane": methane_est,
                                    "color": color
                                })
                                
                                # Construct for ATMOSCHAIN legacy format
                                atmoschain_objects.append({
                                    "label": custom_label,
                                    "confidence": conf,
                                    "estimated_mass_kg": estimated_mass,
                                    "methane_data": md,
                                    "color": color,
                                    "description": f"AI identified {custom_label} — estimated mass {estimated_mass}kg."
                                })

            # Update legacy ATMOSCHAIN state so other parts of app keep working
            latest_detection["objects"] = atmoschain_objects
            latest_detection["totals"] = {
                "count": len(atmoschain_objects),
                "ch4_kg": round(total_ch4_kg, 4),
                "co2e_kg": round(total_co2e_kg, 4),
                "energy_kwh": round(total_energy_kwh, 4),
                "credits": round(total_credits, 6)
            }
            latest_detection["timestamp"] = datetime.now().isoformat()
            latest_detection["mode"] = "wastevision_integrated"
            latest_detection["reactor_ready"] = total_ch4_kg > 0
            
            # Send detection data to frontend camera view
            await websocket.send_json({"detections": detections_payload})
            
    except WebSocketDisconnect:
        print("WebSocket client disconnected")
        # clear state
        latest_detection["timestamp"] = None
    except Exception as e:
        print(f"Error in websocket loop: {e}")


# ── Reactor simulation using actual detection data ────────────────────────────
@app.post("/reactor/simulate")
def simulate_reactor(payload: ReactorRequest):
    methane    = float(payload.methane_kg)
    energy_kwh = round(methane * 13.9, 4)
    credits    = round((methane * GWP_CH4) / 1000, 6)
    efficiency = round(random.uniform(88, 97), 2)
    co2_avoided = round(methane * 2.75, 4)
    revenue_inr = round(energy_kwh * 8.5, 2)
    syngas_nm3  = round(methane / 0.72, 3)

    breakdown = []
    if payload.waste_objects:
        for obj in payload.waste_objects:
            wc   = obj.get("label", "Miscellaneous Trash")
            mass = float(obj.get("estimated_mass_kg", 0.1))
            md   = obj.get("methane_data") or calculate_methane(wc, mass)
            breakdown.append({
                "waste_class":   wc,
                "mass_kg":       mass,
                "ch4_kg":        md.get("ch4_kg", 0),
                "energy_kwh":    md.get("energy_kwh", 0),
                "credits":       md.get("carbon_credits", 0),
                "color":         obj.get("color", "#00e5ff"),
            })

    stages = [
        {"stage": 1, "name": "Waste Input",         "temp_c": 25,   "status": "COMPLETE"},
        {"stage": 2, "name": "Plasma Arc Ignition",  "temp_c": 5500, "status": "COMPLETE"},
        {"stage": 3, "name": "Thermal Cracking",     "temp_c": 4800, "status": "COMPLETE"},
        {"stage": 4, "name": "Cyclone Separation",   "temp_c": 800,  "status": "COMPLETE"},
        {"stage": 5, "name": "Gas Scrubbing",        "temp_c": 400,  "status": "COMPLETE"},
        {"stage": 6, "name": "Fractionation Tower",  "temp_c": -180, "status": "COMPLETE"},
        {"stage": 7, "name": "Energy Generation",    "temp_c": 550,  "status": "COMPLETE"},
    ]

    return {
        "methane_input_kg": methane,
        "energy_kwh":       energy_kwh,
        "carbon_credits":   credits,
        "co2_avoided_kg":   co2_avoided,
        "efficiency_pct":   efficiency,
        "syngas_nm3":       syngas_nm3,
        "revenue_inr":      revenue_inr,
        "stages":           stages,
        "waste_breakdown":  breakdown,
        "methane":          methane,
        "credits":          credits,
        "energy":           energy_kwh,
    }


# ── Marketplace ────────────────────────────────────────────────────────────────
marketplace_listings = [
    {"id": 1, "seller": "EcoFarm Industries",  "credits": 100, "price": 10.0, "available": True},
    {"id": 2, "seller": "GreenTech Corp",      "credits": 50,  "price": 12.5, "available": True},
    {"id": 3, "seller": "BioWaste Solutions",  "credits": 200, "price": 9.0,  "available": True},
    {"id": 4, "seller": "CleanEnergy Ltd",     "credits": 75,  "price": 11.0, "available": True},
]
listing_counter = 5

@app.get("/marketplace")
def get_marketplace():
    return {"listings": marketplace_listings}

@app.post("/marketplace/buy")
def buy_credits(payload: dict):
    listing_id = payload.get("id")
    quantity   = int(payload.get("quantity", 1))
    for listing in marketplace_listings:
        if listing["id"] == listing_id and listing["available"]:
            if listing["credits"] >= quantity:
                listing["credits"] -= quantity
                if listing["credits"] == 0:
                    listing["available"] = False
                return {"success": True, "credits_bought": quantity,
                        "total_cost": round(quantity * listing["price"], 2), "listing": listing}
            return {"success": False, "error": "Insufficient credits"}
    return {"success": False, "error": "Listing not found"}

@app.post("/marketplace/sell")
def sell_credits(payload: dict):
    global listing_counter
    seller  = payload.get("seller", "Anonymous")
    credits = int(payload.get("credits", 0))
    price   = float(payload.get("price", 10.0))
    if credits <= 0 or price <= 0:
        return {"success": False, "error": "Invalid values"}
    listing = {"id": listing_counter, "seller": seller, "credits": credits,
               "price": price, "available": True}
    marketplace_listings.append(listing)
    listing_counter += 1
    return {"success": True, "listing": listing}


# ── Datasets ───────────────────────────────────────────────────────────────────
@app.get("/datasets/waste-types")
def get_waste_types():
    return {"data": load_dataset("waste_types.json")}

@app.get("/datasets/reactor-history")
def get_reactor_history():
    return {"data": load_dataset("reactor_history.json")}

@app.get("/datasets/cct-transactions")
def get_cct_transactions():
    return {"data": load_dataset("cct_transactions.json")}

@app.get("/datasets/daily-summary")
def get_daily_summary():
    return {"data": load_dataset("daily_summary.json")}
