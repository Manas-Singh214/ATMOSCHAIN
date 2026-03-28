"""
ATMOSCHAIN — WasteVision AI (OpenCV Camera)
============================================
Standalone Python script that opens the webcam using OpenCV,
captures frames, sends them to the Gemini 2.0 Flash Vision API for
multi-object waste detection, draws bounding boxes with labels,
and POSTs the detection results to the ATMOSCHAIN backend.

Run:
    python wastevision_cam.py

Requirements:
    pip install opencv-python requests python-dotenv

Controls:
    Q / ESC  — Quit
    SPACE    — Force analyze current frame immediately
    S        — Save current annotated frame as PNG
"""

import os
import cv2
import base64
import json
import time
import threading
import requests
from datetime import datetime

# ── Config ────────────────────────────────────────────────────────────────────

try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

GEMINI_API_KEY   = os.environ.get("GEMINI_API_KEY", "")
GEMINI_URL       = (
    "https://generativelanguage.googleapis.com/v1beta/"
    "models/gemini-2.0-flash:generateContent"
)
BACKEND_URL      = "http://localhost:8000"
ANALYZE_INTERVAL = 2.5        # seconds between Gemini calls
CAMERA_INDEX     = 0          # change to 1 if your webcam is index 1
FRAME_WIDTH      = 1280
FRAME_HEIGHT     = 720

# ── Waste class colors (BGR for OpenCV) ───────────────────────────────────────

CLASS_COLORS = {
    "Food Organics":       (0,  112, 255),   # orange-ish
    "Cardboard":           (100, 110, 141),  # brownish
    "Paper":               (164, 164, 145),  # grey-blue
    "Plastic":             (255, 165, 66),   # blue
    "Glass":               (218, 198, 38),   # cyan
    "Metal":               (189, 189, 189),  # silver
    "Textile Trash":       (188,  71, 171),  # purple
    "Vegetation":          (106, 187, 102),  # green
    "Miscellaneous Trash": (38,  167, 255),  # amber
}

# Methane factors (IPCC FOD) per kg of waste
METHANE_FACTORS = {
    "Food Organics":       0.138,
    "Cardboard":           0.080,
    "Paper":               0.075,
    "Plastic":             0.000,
    "Glass":               0.000,
    "Metal":               0.000,
    "Textile Trash":       0.060,
    "Vegetation":          0.040,
    "Miscellaneous Trash": 0.030,
}
GWP_CH4 = 28


def calc_methane(waste_class, mass_kg):
    factor  = METHANE_FACTORS.get(waste_class, 0.030)
    ch4_kg  = round(mass_kg * factor, 4)
    co2e_kg = round(ch4_kg * GWP_CH4, 4)
    credits  = round(co2e_kg / 1000, 6)
    energy   = round(ch4_kg * 13.9, 4)
    return dict(ch4_kg=ch4_kg, co2e_kg=co2e_kg, carbon_credits=credits, energy_kwh=energy)


# ── Gemini Vision call (runs in background thread) ────────────────────────────

def call_gemini(b64_jpeg: str) -> list:
    """Send frame to Gemini Vision and return list of detected objects."""
    if not GEMINI_API_KEY:
        print("[WARN] GEMINI_API_KEY not set — using random simulation")
        return simulate_objects()

    valid_classes = list(METHANE_FACTORS.keys())
    prompt = (
        f"You are an expert waste classification AI (RealWaste dataset).\n"
        f"Detect ALL waste objects visible in this image.\n"
        f"For each object return a JSON object:\n"
        f"  'label': one of {valid_classes}\n"
        f"  'confidence': float 0-1\n"
        f"  'bbox': [x_center, y_center, width, height] normalised 0-1\n"
        f"  'estimated_mass_kg': float\n"
        f"  'description': one short sentence\n"
        f"Return ONLY a valid JSON array. No markdown. No explanation.\n"
        f"If nothing detected, return []."
    )

    payload = {
        "contents": [{
            "parts": [
                {"text": prompt},
                {"inline_data": {"mime_type": "image/jpeg", "data": b64_jpeg}},
            ]
        }],
        "generationConfig": {"temperature": 0.1, "maxOutputTokens": 1024},
    }

    try:
        r = requests.post(
            f"{GEMINI_URL}?key={GEMINI_API_KEY}",
            json=payload, timeout=20
        )
        r.raise_for_status()
        raw = r.json()["candidates"][0]["content"]["parts"][0]["text"].strip()
        # Strip markdown code fences
        if raw.startswith("```"):
            parts = raw.split("```")
            raw = parts[1] if len(parts) > 1 else parts[0]
            if raw.startswith("json"):
                raw = raw[4:]
        return json.loads(raw.strip())
    except Exception as e:
        print(f"[Gemini] Error: {e}")
        return []


def simulate_objects():
    """Fallback simulation when no API key is present."""
    import random
    classes = random.sample(list(METHANE_FACTORS.keys()), k=random.randint(1, 3))
    objects = []
    for wc in classes:
        mass = round(random.uniform(0.05, 0.6), 3)
        objects.append({
            "label":             wc,
            "confidence":        round(random.uniform(0.7, 0.96), 2),
            "bbox":              [
                round(random.uniform(0.15, 0.75), 2),
                round(random.uniform(0.15, 0.75), 2),
                round(random.uniform(0.10, 0.30), 2),
                round(random.uniform(0.10, 0.28), 2),
            ],
            "estimated_mass_kg": mass,
            "description":       f"Simulated {wc} object",
        })
    return objects


def post_to_backend(result_payload: dict):
    """POST detection result to ATMOSCHAIN backend."""
    try:
        requests.post(
            f"{BACKEND_URL}/detection/update",
            json=result_payload,
            timeout=5
        )
    except Exception as e:
        print(f"[Backend] Could not POST: {e}")


# ── Drawing helpers ───────────────────────────────────────────────────────────

def draw_objects(frame, objects, frame_w, frame_h, totals):
    """Draw bounding boxes, labels, and methane badges on the frame."""
    for obj in objects:
        label       = obj.get("label", "Unknown")
        conf        = obj.get("confidence", 0)
        bbox        = obj.get("bbox", [0.5, 0.5, 0.2, 0.2])
        mass        = obj.get("estimated_mass_kg", 0.1)
        methane_d   = obj.get("methane_data", calc_methane(label, mass))
        color_bgr   = CLASS_COLORS.get(label, (0, 229, 255))

        cx, cy, bw, bh = bbox
        x1 = int((cx - bw / 2) * frame_w)
        y1 = int((cy - bh / 2) * frame_h)
        x2 = int((cx + bw / 2) * frame_w)
        y2 = int((cy + bh / 2) * frame_h)
        x1, y1 = max(0, x1), max(0, y1)
        x2, y2 = min(frame_w - 1, x2), min(frame_h - 1, y2)

        # Main bounding box
        cv2.rectangle(frame, (x1, y1), (x2, y2), color_bgr, 2)

        # Corner accents
        corner_len = 16
        thickness  = 3
        for (sx, ex, sy, ey) in [
            (x1, x1 + corner_len, y1, y1),
            (x2 - corner_len, x2, y1, y1),
            (x1, x1 + corner_len, y2, y2),
            (x2 - corner_len, x2, y2, y2),
        ]:
            cv2.line(frame, (sx, sy), (ex, ey), color_bgr, thickness)
        for (sx, sy, ey) in [
            (x1, y1, y1 + corner_len),
            (x2, y1, y1 + corner_len),
            (x1, y2, y2 - corner_len),
            (x2, y2, y2 - corner_len),
        ]:
            cv2.line(frame, (sx, sy), (sx, ey), color_bgr, thickness)

        # Top label chip
        label_text  = f"{label}  {int(conf * 100)}%"
        font_scale  = 0.52
        font        = cv2.FONT_HERSHEY_DUPLEX
        (tw, th), _ = cv2.getTextSize(label_text, font, font_scale, 1)
        chip_y1     = max(0, y1 - th - 10)
        chip_y2     = y1
        chip_x2     = min(frame_w, x1 + tw + 12)
        cv2.rectangle(frame, (x1, chip_y1), (chip_x2, chip_y2), color_bgr, -1)
        cv2.putText(frame, label_text, (x1 + 6, chip_y2 - 3),
                    font, font_scale, (0, 0, 0), 1, cv2.LINE_AA)

        # Bottom CH4 badge (if non-zero)
        ch4 = methane_d.get("ch4_kg", 0)
        if ch4 > 0:
            badge_text  = f"CH4: {ch4} kg"
            (bw2, bh2), _ = cv2.getTextSize(badge_text, font, 0.44, 1)
            bx2 = min(frame_w, x2)
            bx1 = max(0, bx2 - bw2 - 12)
            by1 = y2
            by2 = min(frame_h, y2 + bh2 + 8)
            cv2.rectangle(frame, (bx1, by1), (bx2, by2), (20, 20, 20), -1)
            cv2.rectangle(frame, (bx1, by1), (bx2, by2), color_bgr, 1)
            cv2.putText(frame, badge_text, (bx1 + 6, by2 - 4),
                        font, 0.44, color_bgr, 1, cv2.LINE_AA)

    # ── Bottom HUD bar ─────────────────────────────────────────────────────
    bar_h = 52
    overlay = frame.copy()
    cv2.rectangle(overlay, (0, frame_h - bar_h), (frame_w, frame_h),
                  (5, 8, 14), -1)
    cv2.addWeighted(overlay, 0.82, frame, 0.18, 0, frame)
    cv2.line(frame, (0, frame_h - bar_h), (frame_w, frame_h - bar_h),
             (0, 120, 140), 1)

    hud_items = [
        f"OBJECTS: {totals['count']}",
        f"CH4: {totals['ch4_kg']:.4f} kg",
        f"CO2e: {totals['co2e_kg']:.4f} kg",
        f"ENERGY: {totals['energy_kwh']:.4f} kWh",
        f"CREDITS: {totals['credits']:.6f} CCT",
    ]
    x_pos = 14
    for item in hud_items:
        # key in dim color, value in bright
        parts = item.split(": ", 1)
        key   = parts[0] + ": " if len(parts) == 2 else item
        val   = parts[1]        if len(parts) == 2 else ""
        cv2.putText(frame, key, (x_pos, frame_h - bar_h + 22),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.40, (0, 140, 160), 1, cv2.LINE_AA)
        kw, _ = cv2.getTextSize(key, cv2.FONT_HERSHEY_SIMPLEX, 0.40, 1)
        cv2.putText(frame, val, (x_pos + kw, frame_h - bar_h + 22),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.42, (0, 229, 255), 1, cv2.LINE_AA)
        fw, _ = cv2.getTextSize(item, cv2.FONT_HERSHEY_SIMPLEX, 0.42, 1)
        x_pos += fw + 28

    # Mode label bottom-right
    mode_label = "GEMINI AI" if GEMINI_API_KEY else "SIMULATION"
    cv2.putText(frame, mode_label, (frame_w - 120, frame_h - bar_h + 22),
                cv2.FONT_HERSHEY_SIMPLEX, 0.38, (0, 100, 130), 1, cv2.LINE_AA)

    # ── Top HUD bar ────────────────────────────────────────────────────────
    top_overlay = frame.copy()
    cv2.rectangle(top_overlay, (0, 0), (frame_w, 32), (5, 8, 14), -1)
    cv2.addWeighted(top_overlay, 0.8, frame, 0.2, 0, frame)
    cv2.line(frame, (0, 32), (frame_w, 32), (0, 80, 100), 1)

    ts = datetime.now().strftime("%H:%M:%S")
    cv2.putText(frame, f"  ATMOSCHAIN  WASTEVISION AI  |  {ts}",
                (10, 22), cv2.FONT_HERSHEY_SIMPLEX, 0.44, (0, 180, 200), 1, cv2.LINE_AA)
    cv2.putText(frame, "Q=Quit  SPACE=Force  S=Save",
                (frame_w - 270, 22), cv2.FONT_HERSHEY_SIMPLEX, 0.38, (0, 100, 120), 1, cv2.LINE_AA)

    return frame


# ── Main loop ─────────────────────────────────────────────────────────────────

def main():
    print("=" * 60)
    print("  ATMOSCHAIN — WasteVision AI (OpenCV)")
    print("=" * 60)
    print(f"  API KEY  : {'SET ✓' if GEMINI_API_KEY else 'NOT SET — simulation mode'}")
    print(f"  Backend  : {BACKEND_URL}")
    print(f"  Interval : {ANALYZE_INTERVAL}s")
    print(f"  Camera   : index {CAMERA_INDEX}")
    print("  Controls : Q=Quit  SPACE=Force analyze  S=Save frame")
    print("=" * 60)

    cap = cv2.VideoCapture(CAMERA_INDEX)
    if not cap.isOpened():
        print("[ERROR] Cannot open camera. Try changing CAMERA_INDEX.")
        return

    cap.set(cv2.CAP_PROP_FRAME_WIDTH,  FRAME_WIDTH)
    cap.set(cv2.CAP_PROP_FRAME_HEIGHT, FRAME_HEIGHT)
    cap.set(cv2.CAP_PROP_FPS, 30)

    last_analyze    = 0.0
    current_objects = []
    current_totals  = dict(count=0, ch4_kg=0, co2e_kg=0, energy_kwh=0, credits=0)
    analyze_lock    = threading.Lock()
    running         = True

    def analyze_frame(frame_copy):
        nonlocal current_objects, current_totals
        _, buf = cv2.imencode(".jpg", frame_copy, [cv2.IMWRITE_JPEG_QUALITY, 80])
        b64 = base64.b64encode(buf.tobytes()).decode()
        objs = call_gemini(b64)

        # Enrich with methane data
        for obj in objs:
            wc   = obj.get("label", "Miscellaneous Trash")
            mass = float(obj.get("estimated_mass_kg", 0.1))
            obj["methane_data"] = calc_methane(wc, mass)

        total_ch4    = round(sum(o["methane_data"]["ch4_kg"]        for o in objs), 4)
        total_co2e   = round(sum(o["methane_data"]["co2e_kg"]       for o in objs), 4)
        total_energy = round(sum(o["methane_data"]["energy_kwh"]    for o in objs), 4)
        total_cred   = round(sum(o["methane_data"]["carbon_credits"] for o in objs), 6)
        totals = dict(count=len(objs), ch4_kg=total_ch4, co2e_kg=total_co2e,
                      energy_kwh=total_energy, credits=total_cred)

        with analyze_lock:
            current_objects = objs
            current_totals  = totals

        # Push to backend
        payload = dict(
            objects=objs, totals=totals,
            timestamp=datetime.now().isoformat(),
            mode="gemini_vision" if GEMINI_API_KEY else "simulation",
        )
        post_to_backend(payload)
        print(f"[{datetime.now().strftime('%H:%M:%S')}] "
              f"{len(objs)} objects  CH4={total_ch4:.4f}kg  "
              f"Credits={total_cred:.6f}CCT")

    thread = None

    while running:
        ret, frame = cap.read()
        if not ret:
            print("[ERROR] Frame read failed")
            break

        h, w = frame.shape[:2]

        # Trigger analysis
        now = time.time()
        if now - last_analyze >= ANALYZE_INTERVAL:
            if thread is None or not thread.is_alive():
                fc = frame.copy()
                thread = threading.Thread(target=analyze_frame, args=(fc,), daemon=True)
                thread.start()
                last_analyze = now

        # Draw current detections on frame
        with analyze_lock:
            objs   = list(current_objects)
            totals = dict(current_totals)

        annotated = draw_objects(frame, objs, w, h, totals)

        # Countdown ring (top-right)
        elapsed  = now - last_analyze
        progress = min(elapsed / ANALYZE_INTERVAL, 1.0)
        center   = (w - 42, 52)
        cv2.circle(annotated, center, 16, (0, 50, 60), 2)
        angle    = int(360 * progress)
        cv2.ellipse(annotated, center, (16, 16), -90, 0, angle,
                    (0, 200, 220), 2)

        cv2.imshow("ATMOSCHAIN — WasteVision AI", annotated)

        key = cv2.waitKey(1) & 0xFF
        if key in (ord('q'), 27):          # Q or ESC to quit
            running = False
        elif key == ord(' '):              # SPACE force analysis
            last_analyze = 0
        elif key == ord('s'):              # S to save
            fname = f"wastevision_{int(time.time())}.png"
            cv2.imwrite(fname, annotated)
            print(f"[SAVE] Saved {fname}")

    cap.release()
    cv2.destroyAllWindows()
    print("[INFO] WasteVision camera closed.")


if __name__ == "__main__":
    main()
