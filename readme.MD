# Smart City AI Project

## របៀបប្រើប្រាស់ (Usage Guide)

### 1. Start Backend Server

**Install dependencies**

```bash
python3 -m pip install -r requirements.txt
```

> ដំឡើង library និង dependency ទាំងអស់ដែល project ត្រូវការ

**Activate Virtual Environment**

```bash
source .venv/bin/activate
```

> បើក Python virtual environment

**Run FastAPI Server**

```bash
uvicorn app:app --reload
```

> ដំណើរការ backend server ដោយប្រើ FastAPI + Uvicorn

---

### 2. Start Frontend

បើក folder `front-end/src/html/`

ប្រើ **Live Server** (VS Code Extension) ដើម្បី run file:

```bash
index.html
```

> Frontend ត្រូវបានសរសេរដោយ HTML, CSS, JavaScript

---

# Project Structure

```bash
fruit-detection-ai/
├── back-end
│   ├── app.py                # Main FastAPI application
│   └── models
│       └── yolov8n.pt        # YOLO AI model
│
├── front-end
│   └── src
│       ├── css
│       │   └── style.css
│       │
│       ├── html
│       │   ├── index.html
│       │   ├── smartcity.html
│       │   ├── detect.html
│       │   ├── parking.html
│       │   ├── drone.html
│       │   └── ...
│       │
│       └── javascript
│           ├── script.js
│           ├── drone-simulator.js
│           ├── mqtt-simulator.js
│           └── smart-parking-simulator.js
│
├── requirements.txt
└── README.md
```

---

# Features

- AI Object Detection (YOLOv8)
- Smart Parking Simulator
- IoT Monitoring Dashboard
- Drone Simulation
- Traffic Monitoring
- Chatbot Assistant
- Smart City Visualization

---

# Technologies Used

* Python
* FastAPI
* YOLOv8
* HTML / CSS / JavaScript
* MQTT
* Computer Vision
* IoT Simulation

---

# Author

Developed for Smart City Research & AI Simulation Project.
