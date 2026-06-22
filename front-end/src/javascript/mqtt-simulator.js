let faAnimId = null;
let isFaSimRunning = false;
let faPackets = []; // បណ្តុំគ្រាប់ទិន្នន័យ [ {x, y, tx, ty, speed, size, color, alpha, step, meta} ]

const faNodes = {
  devices: [
    { x: 100, y: 100, label: "Camera Edge 01", emoji: "📷", color: "#38bdf8" },
    { x: 100, y: 200, label: "RFID Entrance", emoji: "💳", color: "#fb923c" },
    {
      x: 100,
      y: 300,
      label: "Ultrasonic Slot3",
      emoji: "📡",
      color: "#a78bfa",
    },
  ],
  broker: {
    x: 400,
    y: 200,
    label: "EMQX / HiveMQ Broker",
    desc: "MQTT Cloud Gateway",
    emoji: "☁️",
  },
  fastapi: {
    x: 680,
    y: 200,
    label: "FastAPI Server",
    desc: "Uvicorn Async Worker",
    emoji: "⚡",
  },
  dashboard: {
    x: 880,
    y: 200,
    label: "Your Dashboard",
    desc: "Websocket Client",
    emoji: "💻",
  },
};

let faSystemLogs = [];

function toggleFastApiSimulation() {
  const btn = document.getElementById("btnToggleFastApiSim");
  if (!isFaSimRunning) {
    isFaSimRunning = true;
    btn.innerText = "⏸ ផ្អាក Async Stream";
    btn.classList.replace("from-teal-500", "from-amber-500");
    btn.classList.replace("to-cyan-600", "to-orange-600");

    faLoop();

    window.faStreamInterval = setInterval(() => {
      let randomDeviceIdx = Math.floor(Math.random() * faNodes.devices.length);
      publishFromDevice(randomDeviceIdx);
    }, 1200);
  } else {
    isFaSimRunning = false;
    btn.innerText = "⚡ ចាប់ផ្ដើម Async Stream";
    btn.classList.replace("from-amber-500", "from-teal-500");
    btn.classList.replace("to-orange-600", "to-cyan-600");

    if (faAnimId) cancelAnimationFrame(faAnimId);
    if (window.faStreamInterval) clearInterval(window.faStreamInterval);
  }
}

function publishFromDevice(deviceIdx) {
  let dev = faNodes.devices[deviceIdx];
  pushFaLog(`[${dev.label}] -> MQTT Publish JSON payload`);

  faPackets.push({
    x: dev.x,
    y: dev.y,
    tx: faNodes.broker.x,
    ty: faNodes.broker.y,
    speed: 3.5 + Math.random() * 2,
    size: 5,
    color: dev.color,
    step: "DEV_TO_BROKER",
    meta: { from: dev.label },
  });
}

function burstMultiPublish() {
  for (let i = 0; i < 6; i++) {
    setTimeout(() => {
      let randIdx = Math.floor(Math.random() * faNodes.devices.length);
      publishFromDevice(randIdx);
    }, i * 200);
  }
}

function faLoop() {
  if (!isFaSimRunning) return;
  updateFaPhysics();
  drawFaSimulation();
  faAnimId = requestAnimationFrame(faLoop);
}

function updateFaPhysics() {
  const counter = document.getElementById("active-tasks-counter");
  if (counter) counter.innerText = faPackets.length;

  for (let i = faPackets.length - 1; i >= 0; i--) {
    let p = faPackets[i];
    let dx = p.tx - p.x;
    let dy = p.ty - p.y;
    let dist = Math.sqrt(dx * dx + dy * dy);

    if (dist > p.speed) {
      p.x += (dx / dist) * p.speed;
      p.y += (dy / dist) * p.speed;
    } else {
      if (p.step === "DEV_TO_BROKER") {
        p.x = faNodes.broker.x;
        p.y = faNodes.broker.y;
        p.tx = faNodes.fastapi.x;
        p.ty = faNodes.fastapi.y;
        p.step = "BROKER_TO_FASTAPI";
        p.color = "#22d3ee"; // ប្តូរជាពណ៌ Cyan តំណាងឱ្យ FastAPI Process
        p.speed = 6; // ល្បឿនកាន់តែលឿន
      } else if (p.step === "BROKER_TO_FASTAPI") {
        pushFaLog(`[FastAPI] ⚡ Async @app.on_event -> BroadCast to Dashboard`);
        p.x = faNodes.fastapi.x;
        p.y = faNodes.fastapi.y;
        p.tx = faNodes.dashboard.x;
        p.ty = faNodes.dashboard.y;
        p.step = "FASTAPI_TO_DASH";
        p.color = "#34d399"; // ពណ៌បៃតងតំណាងឱ្យ UI Updated ជោគជ័យ
      } else if (p.step === "FASTAPI_TO_DASH") {
        // ដល់ Dashboard ចុងក្រោយ លុបចេញ
        faPackets.splice(i, 1);
      }
    }
  }
}

function drawFaSimulation() {
  const canvas = document.getElementById("fastApiCanvas");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");

  ctx.fillStyle = "#050b14";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // គូរគំនូសខ្សែតភ្ជាប់សៀគ្វី (Pipeline Grid Lines)
  ctx.strokeStyle = "rgba(34, 211, 238, 0.03)";
  ctx.lineWidth = 1.5;
  for (let i = 0; i < canvas.width; i += 40) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i, canvas.height);
    ctx.stroke();
  }

  // គូរខ្សែតភ្ជាប់ឡូហ្ស៊ិករវាង Node នីមួយៗ
  ctx.strokeStyle = "rgba(255, 255, 255, 0.05)";
  ctx.lineWidth = 2;
  faNodes.devices.forEach((d) => {
    ctx.beginPath();
    ctx.moveTo(d.x, d.y);
    ctx.lineTo(faNodes.broker.x, faNodes.broker.y);
    ctx.stroke();
  });
  ctx.beginPath();
  ctx.moveTo(faNodes.broker.x, faNodes.broker.y);
  ctx.lineTo(faNodes.fastapi.x, faNodes.fastapi.y);
  ctx.lineTo(faNodes.dashboard.x, faNodes.dashboard.y);
  ctx.stroke();

  // គូរដុំឧបករណ៍ផ្សាយ (Edge Devices)
  faNodes.devices.forEach((d) => {
    drawModernNode(ctx, d.x, d.y, d.color, d.emoji, d.label, "Publisher");
  });

  // គូរដុំកណ្តាល និង អ្នកទទួល (Broker, FastAPI, Dashboard)
  drawModernNode(
    ctx,
    faNodes.broker.x,
    faNodes.broker.y,
    "#eab308",
    faNodes.broker.emoji,
    faNodes.broker.label,
    faNodes.broker.desc,
  );
  drawModernNode(
    ctx,
    faNodes.fastapi.x,
    faNodes.fastapi.y,
    "#06b6d4",
    faNodes.fastapi.emoji,
    faNodes.fastapi.label,
    faNodes.fastapi.desc,
  );
  drawModernNode(
    ctx,
    faNodes.dashboard.x,
    faNodes.dashboard.y,
    "#10b981",
    faNodes.dashboard.emoji,
    faNodes.dashboard.label,
    faNodes.dashboard.desc,
  );

  // គូរគ្រាប់កញ្ចប់ទិន្នន័យ (Data Particles)
  faPackets.forEach((p) => {
    ctx.fillStyle = p.color;
    ctx.shadowBlur = 10;
    ctx.shadowColor = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0; // Reset shadow
  });

  // បង្ហាញ Terminal Logs តូចៗនៅបាតក្រោម Canvas
  ctx.fillStyle = "#334155";
  ctx.fillRect(20, 350, canvas.width - 40, 38);
  ctx.fillStyle = "#38bdf8";
  ctx.font = "11px monospace";
  ctx.textAlign = "left";
  let recentLog =
    faSystemLogs[faSystemLogs.length - 1] ||
    "FastAPI Pipeline: Waiting for incoming async payloads...";
  ctx.fillText("📟 Log Stream: " + recentLog, 35, 373);
}

function drawModernNode(ctx, x, y, color, emoji, title, subtitle) {
  // Outer glowing ring
  ctx.strokeStyle = color + "22";
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.arc(x, y, 32, 0, Math.PI * 2);
  ctx.stroke();

  // Core Node Box
  ctx.fillStyle = "#0f172a";
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(x, y, 26, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // Emoji
  ctx.font = "22px Arial";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(emoji, x, y);

  // Labels
  ctx.fillStyle = "#f8fafc";
  ctx.font = "bold 11px Inter, sans-serif";
  ctx.fillText(title, x, y - 42);

  ctx.fillStyle = "#64748b";
  ctx.font = "9px monospace";
  ctx.fillText(subtitle, x, y + 42);
}

function pushFaLog(msg) {
  faSystemLogs.push(msg);
  if (faSystemLogs.length > 5) faSystemLogs.shift();
}

// Initial draw
window.addEventListener("load", () => {
  setTimeout(drawFaSimulation, 600);
});
