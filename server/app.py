import time

import cv2
import numpy as np
from pathlib import Path
from fastapi import FastAPI
from fastapi.responses import HTMLResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles
from ultralytics import YOLO

app = FastAPI()

MODEL_PATH = "models/yolov8n.pt"

model = YOLO(str(MODEL_PATH))

capture = None

FRUIT_IDS = [46, 47, 49]

latest_stats = {
    "banana": 0,
    "apple": 0,
    "orange": 0
}

def get_capture():
    global capture
    if capture is None or not capture.isOpened():
        capture = cv2.VideoCapture(0)
    return capture

def encode_frame(frame):
    ret, buffer = cv2.imencode('.jpg', frame)
    if not ret:
        return None
    return (b'--frame\r\n'
            b'Content-Type: image/jpeg\r\n\r\n' + buffer.tobytes() + b'\r\n')

def camera_wait_frame():
    frame = np.zeros((450, 800, 3), dtype=np.uint8)
    cv2.putText(frame, "Waiting for camera / backend stream", (155, 215),
                cv2.FONT_HERSHEY_SIMPLEX, 0.8, (255, 255, 255), 2, cv2.LINE_AA)
    cv2.putText(frame, "Check camera permission or device index 0", (175, 255),
                cv2.FONT_HERSHEY_SIMPLEX, 0.55, (120, 170, 255), 1, cv2.LINE_AA)
    return frame

def generate_frames():
    global latest_stats, capture
    while True:
        cam = get_capture()
        success, frame = cam.read()
        if not success:
            cam.release()
            capture = None
            latest_stats = {"banana": 0, "apple": 0, "orange": 0}
            fallback = encode_frame(camera_wait_frame())
            if fallback:
                yield fallback
            time.sleep(0.5)
            continue

        results = model(frame, conf=0.5, classes=FRUIT_IDS)
        stats = {"banana": 0, "apple": 0, "orange": 0}

        if results:
            boxes = results[0].boxes
            for box in boxes:
                cls_id = int(box.cls[0].item())
                if cls_id == 46:
                    stats["banana"] += 1
                elif cls_id == 47:
                    stats["apple"] += 1
                elif cls_id == 49:
                    stats["orange"] += 1

        latest_stats = stats
        annotated_frame = results[0].plot() if results else frame
        frame_bytes = encode_frame(annotated_frame)
        if frame_bytes:
            yield frame_bytes

@app.on_event("shutdown")
def shutdown_event():
    if capture is not None:
        capture.release()

@app.get("/video_feed")
def video_feed():
    return StreamingResponse(generate_frames(), media_type="multipart/x-mixed-replace; boundary=frame")

@app.get("/api/stats")
def get_stats():
    return latest_stats

app.mount("/", StaticFiles(directory=FRONTEND_DIR), name="frontend")
