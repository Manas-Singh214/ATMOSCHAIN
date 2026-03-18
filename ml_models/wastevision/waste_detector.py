"""
ATMOSCHAIN — WasteVision AI
waste_detector.py

Uses Google Gemini 2.0 Flash (Vision) to classify waste objects from
a webcam frame. Returns waste class, confidence, and estimated mass.

Author: ATMOSCHAIN Dev Team
"""

import os
import base64
import json
import re
import logging
from pathlib import Path

import google.generativeai as genai
from dotenv import load_dotenv

load_dotenv(Path(__file__).parent.parent.parent / ".env")

logger = logging.getLogger(__name__)

# ─── Configuration ────────────────────────────────────────────────────────────
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
GEMINI_MODEL   = "gemini-2.0-flash"

# Waste classes supported by ATMOSCHAIN
WASTE_CLASSES = [
    "plastic",
    "organic",
    "paper",
    "metal",
    "glass",
    "inert",
    "mixed",
    "textile",
    "unknown"
]

# DOC (Degradable Organic Carbon) values — IPCC 2006 Table 3.4
DOC_VALUES = {
    "plastic" : 0.00,
    "organic" : 0.15,
    "paper"   : 0.40,
    "metal"   : 0.00,
    "glass"   : 0.00,
    "inert"   : 0.00,
    "mixed"   : 0.12,   # weighted average for mixed MSW
    "textile" : 0.24,
    "unknown" : 0.10,
}

# Average density estimates for mass estimation from visual area (kg/dm³)
DENSITY_ESTIMATES = {
    "plastic" : 0.05,   # hollow containers, bags
    "organic" : 0.40,   # food waste, wet biomass
    "paper"   : 0.08,   # newspapers, cardboard
    "metal"   : 0.50,   # cans, scrap
    "glass"   : 0.60,   # bottles
    "inert"   : 0.80,   # concrete, rubble
    "mixed"   : 0.25,
    "textile" : 0.10,
    "unknown" : 0.20,
}

DETECTION_PROMPT = """
You are an expert waste classification AI for the ATMOSCHAIN environmental 
intelligence platform.

Carefully analyze the image provided. Do NOT fallback to default answers. Look exactly 
at what object is in front of the camera and identify the PRIMARY type of waste or material present.

Respond ONLY with a valid JSON object — no markdown, no explanation, just JSON.

Use this exact format:
{
  "waste_class": "<one of: plastic, organic, paper, metal, glass, inert, mixed, textile, unknown>",
  "confidence": <float 0.0-1.0>,
  "item_description": "<very specific description of the object, e.g. 'crushed aluminum soda can' or 'half-eaten apple'>",
  "estimated_volume_liters": <float, your best estimate of the object's volume>,
  "material_notes": "<key material properties relevant to waste treatment>",
  "biodegradable": <true or false>,
  "recyclable": <true or false>,
  "hazardous": <true or false>,
  "gas_release_composition": ["<Gas 1>", "<Gas 2>", "..."] 
}

Classification guide:
- plastic   : all polymers, PET bottles, bags, packaging, polystyrene
- organic   : food waste, vegetable peels, biomass, garden waste, food scraps
- paper     : newspapers, cardboard, books, paper packaging
- metal     : steel cans, aluminium, copper wire, scrap metal
- glass     : bottles, jars, broken glass
- inert     : concrete, bricks, rubble, soil, sand
- mixed     : clearly mixed waste that cannot be separated visually
- textile   : fabric, clothing, ropes, carpets
- unknown   : when you genuinely cannot identify the material

Important for 'gas_release_composition': Predict what gases this specific item would release 
if placed in an anaerobic landfill (e.g., ["Methane (CH4)", "Carbon Dioxide (CO2)", "Hydrogen Sulfide (H2S)"]) 
or if it is inert/plastic (e.g., ["VOCs", "Microplastics (No direct gas)"]).

Be realistic and highly accurate based on the actual visual evidence.
"""

class WasteDetector:
    """
    Real-time waste classifier using Gemini 2.0 Flash Vision API.
    
    Usage:
        detector = WasteDetector()
        result = detector.detect_from_base64(image_b64_string)
    """

    def __init__(self):
        if not GEMINI_API_KEY:
            raise EnvironmentError(
                "GEMINI_API_KEY not found. Add it to d:/Projects/ATMOSCHAIN/.env"
            )
        genai.configure(api_key=GEMINI_API_KEY)
        self.model = genai.GenerativeModel(GEMINI_MODEL)
        logger.info(f"WasteDetector initialized with model: {GEMINI_MODEL}")

    def detect_from_base64(self, image_b64: str) -> dict:
        """
        Takes a base64-encoded image, calls Gemini Vision, returns detection result.
        
        Returns:
            dict with fields:
                waste_class, confidence, item_description, 
                estimated_volume_liters, estimated_mass_kg,
                material_notes, recyclable, hazardous,
                doc_value, error (if any)
        """
        try:
            # Strip data URI prefix if present
            if "," in image_b64:
                image_b64 = image_b64.split(",", 1)[1]

            image_bytes = base64.b64decode(image_b64)
            image_part = {
                "mime_type": "image/jpeg",
                "data": image_bytes
            }

            safety_settings = [
                {"category": "HARM_CATEGORY_HARASSMENT", "threshold": "BLOCK_NONE"},
                {"category": "HARM_CATEGORY_HATE_SPEECH", "threshold": "BLOCK_NONE"},
                {"category": "HARM_CATEGORY_SEXUALLY_EXPLICIT", "threshold": "BLOCK_NONE"},
                {"category": "HARM_CATEGORY_DANGEROUS_CONTENT", "threshold": "BLOCK_NONE"}
            ]

            response = self.model.generate_content(
                [DETECTION_PROMPT, image_part],
                generation_config=genai.GenerationConfig(
                    temperature=0.3,
                    max_output_tokens=1024,
                    response_mime_type="application/json",
                ),
                safety_settings=safety_settings
            )

            raw_text = response.text.strip()
            # Extract JSON if wrapped in markdown
            json_match = re.search(r'\{.*\}', raw_text, re.DOTALL)
            if json_match:
                raw_text = json_match.group()

            data = json.loads(raw_text)

            # Normalize waste class
            wc = data.get("waste_class", "unknown").lower()
            if wc not in WASTE_CLASSES:
                wc = "unknown"
            data["waste_class"] = wc

            # Estimate mass from volume + density
            volume = float(data.get("estimated_volume_liters", 0.5))
            density = DENSITY_ESTIMATES.get(wc, 0.20)
            data["estimated_mass_kg"] = round(volume * density, 4)
            data["doc_value"] = DOC_VALUES.get(wc, 0.10)

            return data

        except json.JSONDecodeError as e:
            logger.error(f"JSON parse error from Gemini: {e}\nRaw: {raw_text}")
            return self._fallback_result(f"JSON parse error: {e}")
        except Exception as e:
            logger.error(f"Detection error: {e}")
            return self._fallback_result(str(e))

    def detect_from_filepath(self, image_path: str) -> dict:
        """Detect waste from an image file path."""
        with open(image_path, "rb") as f:
            image_b64 = base64.b64encode(f.read()).decode("utf-8")
        return self.detect_from_base64(image_b64)

    @staticmethod
    def _fallback_result(error_msg: str) -> dict:
        """Returns a safe default when detection fails."""
        return {
            "waste_class": "unknown",
            "confidence": 0.0,
            "item_description": "Detection failed",
            "estimated_volume_liters": 0.5,
            "estimated_mass_kg": 0.1,
            "material_notes": "",
            "recyclable": False,
            "hazardous": False,
            "doc_value": 0.10,
            "error": error_msg
        }


# ─── Standalone test ──────────────────────────────────────────────────────────
if __name__ == "__main__":
    import sys
    logging.basicConfig(level=logging.INFO)

    if len(sys.argv) < 2:
        print("Usage: python waste_detector.py <image_path>")
        sys.exit(1)

    detector = WasteDetector()
    result = detector.detect_from_filepath(sys.argv[1])
    print(json.dumps(result, indent=2))
