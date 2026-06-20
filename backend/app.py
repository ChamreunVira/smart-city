import cv2
from pathlib import Path
from fastapi import FastAPI
from fastapi.responses import HTMLResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles
from ultralytics import YOLO

app = FastAPI()

BASE_DIR = Path(__file__).resolve().parent
ROOT_DIR = BASE_DIR.parent
FRONTEND_DIR = ROOT_DIR / "frontend"
MODEL_PATH = BASE_DIR / "models" / "yolov8n.pt"

model = YOLO(str(MODEL_PATH))
capture = cv2.VideoCapture(0)

FRUIT_IDS = [46, 47, 49]

latest_stats = {
    "banana": 0,
    "apple": 0,
    "orange": 0,
    "total": 0
}

def generate_frames():
    global latest_stats
    while True:
        success, frame = capture.read()
        if not success:
            break
        
        results = model(frame, conf=0.5, classes=FRUIT_IDS)
        
        stats = {"banana": 0, "apple": 0, "orange": 0, "total": 0}
        
        if len(results) > 0:
            boxes = results[0].boxes
            for box in boxes:
                cls_id = int(box.cls[0].item())
                if cls_id == 46:
                    stats["banana"] += 1
                elif cls_id == 47:
                    stats["apple"] += 1
                elif cls_id == 49:
                    stats["orange"] += 1
                stats["total"] += 1
        
        latest_stats = stats
        annotated_frame = results[0].plot()

        ret, buffer = cv2.imencode('.jpg', annotated_frame)
        if not ret:
            continue

        frame_bytes = buffer.tobytes()

        yield (b'--frame\r\n'
               b'Content-Type: image/jpeg\r\n\r\n' + frame_bytes + b'\r\n')

@app.on_event("shutdown")
def shutdown_event():
    capture.release()

@app.get("/", response_class=HTMLResponse)
def get_root():
    with open(FRONTEND_DIR / "index.html", "r", encoding="utf-8") as f:
        html_content = f.read()
    return html_content

@app.get("/video_feed")
def video_feed():
    return StreamingResponse(generate_frames(), media_type="multipart/x-mixed-replace; boundary=frame")

@app.get("/api/stats")
def get_stats():
    return latest_stats

app.mount("/", StaticFiles(directory=FRONTEND_DIR), name="frontend")
