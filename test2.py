import sys
import os
import json
print("Testing waste detector...")
try:
    from ml_models.wastevision.waste_detector import WasteDetector
    detector = WasteDetector()
    res = detector.detect_from_filepath(r"D:\ATMOSCHAIN\my_garbage_photo.jpg")
    print(json.dumps(res, indent=2))
except Exception as e:
    print("ERROR:", e)
