let csMqttAnimId = null;
let isCSMqttSimRunning = false;
let csPackets = []; // [ {x, y, targetX, targetY, speed, color, label, step} ]

// កំណត់ទីតាំង Node ទាំង ៣ លើ Canvas (Dashboard -> Broker -> Backend)
const csNodes = {
  client: { x: 150, y: 175, label: "Your Dashboard (Client)", desc: "Frontend (HTML/JS)" },
  broker: { x: 450, y: 175, label: "MQTT Broker Cloud", desc: "HiveMQ / Mosquitto" },
  server: { x: 750, y: 175, label: "Spring Boot Server", desc: "Fast API (Python)" }
};

let lastSystemLog = "ប្រព័ន្ធទំនេរ (System Idle)";

function toggleCSMqttSimulation() {
  const btn = document.getElementById('btnToggleClientServerSim');
  if (!isCSMqttSimRunning) {
    isCSMqttSimRunning = true;
    btn.innerText = "⏸ ផ្អាកប្រព័ន្ធ";
    btn.classList.replace('bg-emerald-600', 'bg-yellow-600');
    
    csMqttLoop();
    
    // បង្កើតចរាចរណ៍ទិន្នន័យស្វ័យប្រវត្តរៀងរាល់ ៤ វិនាទីម្តង
    window.csMqttInterval = setInterval(() => {
      triggerClientRequest();
    }, 4000);
  } else {
    isCSMqttSimRunning = false;
    btn.innerText = "▶ ចាប់ផ្ដើមប្រព័ន្ធ (Start Network)";
    btn.classList.replace('bg-yellow-600', 'bg-emerald-600');
    
    if (csMqttAnimId) cancelAnimationFrame(csMqttAnimId);
    if (window.csMqttInterval) clearInterval(window.csMqttInterval);
  }
}

// ១. កាលៈទេសៈទី ១: Client (Dashboard) បាញ់បញ្ជាទៅ Broker
function triggerClientRequest() {
  lastSystemLog = "Dashboard: កំពុង Publish បញ្ជា {action: 'OPEN_GATE'}";
  
  csPackets.push({
    x: csNodes.client.x,
    y: csNodes.client.y,
    targetX: csNodes.broker.x,
    targetY: csNodes.broker.y,
    speed: 5,
    color: "#3b82f6", // ពណ៌ខៀវ = Outgoing Req
    label: "Publish CMD",
    step: "CLIENT_TO_BROKER"
  });
}

function csMqttLoop() {
  if (!isCSMqttSimRunning) return;
  
  updateCSMqttPhysics();
  drawCSMqttSimulation();
  
  csMqttAnimId = requestAnimationFrame(csMqttLoop);
}

function updateCSMqttPhysics() {
  for (let i = csPackets.length - 1; i >= 0; i--) {
    let p = csPackets[i];
    
    let dx = p.targetX - p.x;
    let dy = p.targetY - p.y;
    let dist = Math.sqrt(dx * dx + dy * dy);
    
    if (dist > p.speed) {
      p.x += (dx / dist) * p.speed;
      p.y += (dy / dist) * p.speed;
    } else {
      // នៅពេលកញ្ចប់ទិន្នន័យទៅដល់គោលដៅនីមួយៗ
      if (p.step === "CLIENT_TO_BROKER") {
        // ២. កាលៈទេសៈទី ២: Broker បញ្ជូនបន្តទៅឱ្យ Spring Boot Server (Subscriber)
        lastSystemLog = "Broker: បញ្ជូន Command បន្តទៅ Spring Boot Server";
        csPackets.push({
          x: csNodes.broker.x, y: csNodes.broker.y,
          targetX: csNodes.server.x, targetY: csNodes.server.y,
          speed: 5, color: "#eab308", label: "Forward CMD", step: "BROKER_TO_SERVER"
        });
        csPackets.splice(i, 1);
      } 
      else if (p.step === "BROKER_TO_SERVER") {
        // ៣. កាលៈទេសៈទី ៣: Spring Boot ទទួលការបញ្ជា រួចដកទិន្នន័យ Response បាញ់ត្រឡប់មកវិញ
        lastSystemLog = "Spring Boot: បានទទួលបញ្ជា -> រក្សាទុកក្នុង DB -> ផ្ញើ Response telemetry";
        
        // បាញ់ទិន្នន័យត្រឡប់មក Broker វិញ
        csPackets.push({
          x: csNodes.server.x, y: csNodes.server.y,
          targetX: csNodes.broker.x, targetY: csNodes.broker.y,
          speed: 5, color: "#10b981", label: "Publish Telemetry", step: "SERVER_TO_BROKER"
        });
        csPackets.splice(i, 1);
      }
      else if (p.step === "SERVER_TO_BROKER") {
        // ៤. កាលៈទេសៈទី ៤: Broker បញ្ជូន Telemetry មកបង្ហាញនៅលើ Dashboard វិញ
        lastSystemLog = "Broker: ផ្សាយទិន្នន័យ Telemetry ថ្មីមកកាន់ Dashboard";
        csPackets.push({
          x: csNodes.broker.x, y: csNodes.broker.y,
          targetX: csNodes.client.x, targetY: csNodes.client.y,
          speed: 5, color: "#a855f7", label: "Update UI", step: "BROKER_TO_CLIENT"
        });
        csPackets.splice(i, 1);
      }
      else if (p.step === "BROKER_TO_CLIENT") {
        // ៥. ដំណើរការបញ្ចប់: Dashboard UI ផ្លាស់ប្តូរទិន្នន័យជោគជ័យ
        lastSystemLog = "Dashboard UI: បានធ្វើបច្ចុប្បន្នភាពទិន្នន័យជោគជ័យ! ✅";
        csPackets.splice(i, 1);
      }
    }
  }
}

function drawCSMqttSimulation() {
  const canvas = document.getElementById('csMqttCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  
  // Clear background
  ctx.fillStyle = "#0b0f19"; 
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  
  // គូរខ្សែតភ្ជាប់ឡូហ្ស៊ិក (Topology)
  ctx.strokeStyle = "rgba(255, 255, 255, 0.05)";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(csNodes.client.x, csNodes.client.y);
  ctx.lineTo(csNodes.server.x, csNodes.server.y);
  ctx.stroke();

  // គូរ Node ទាំង ៣
  drawCSNode(ctx, csNodes.client, "#3b82f6", "💻");
  drawCSNode(ctx, csNodes.broker, "#64748b", "☁️");
  drawCSNode(ctx, csNodes.server, "#10b981", "☕");

  // បង្ហាញ System Status Log នៅខាងក្រោម Canvas
  ctx.fillStyle = "#94a3b8";
  ctx.font = "12px Kantumruy Pro, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("ស្ថានភាពប្រព័ន្ធ៖ " + lastSystemLog, canvas.width / 2, canvas.height - 20);

  // គូរ Data Packets ដែលកំពុងធ្វើចលនា
  csPackets.forEach(p => {
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 8, 0, Math.PI * 2);
    ctx.fill();
    
    // ស្លាកអក្សរលើគ្រាប់ទិន្នន័យ (e.g., CMD, JSON)
    ctx.fillStyle = "#ffffff";
    ctx.font = "9px monospace";
    ctx.textAlign = "center";
    ctx.fillText(p.label, p.x, p.y - 14);
  });
}

function drawCSNode(ctx, node, color, emoji) {
  ctx.fillStyle = "#111827";
  ctx.strokeStyle = color;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(node.x, node.y, 28, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  
  ctx.font = "24px Arial";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(emoji, node.x, node.y);
  
  // Text Labels
  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 12px Kantumruy Pro, sans-serif";
  ctx.fillText(node.label, node.x, node.y - 40);
  
  ctx.fillStyle = "#4b5563";
  ctx.font = "10px monospace";
  ctx.fillText(node.desc, node.x, node.y + 42);
}

// គូររូបភាពដំបូងពេលទំព័រដោនឡូដស្លាយរួចរាល់
window.addEventListener('load', () => {
  setTimeout(drawCSMqttSimulation, 600);
});

let parkingRunning = false;
let parkingAnimId = null;
let parkingVehicles = [];
let parkingOccupiedSlots = 0;
let simSpeedSetting = 1;

function initParkingSimulator() {
  const canvas = document.getElementById("parkingCanvas");
  if (!canvas) return;
  if (!parkingVehicles.length) {
    parkingVehicles = [];
    parkingOccupiedSlots = 0;
  }
  drawParkingSimulation();
}

function toggleParkingSimulation() {
  parkingRunning = !parkingRunning;
  const icon = document.getElementById("parkingBtnIcon");
  const text = document.getElementById("parkingBtnText");
  const btn = document.getElementById("btnToggleParking");

  if (parkingRunning) {
    if (icon) icon.textContent = "⏸";
    if (text) text.textContent = "ផ្អាក Lab";
    if (btn) btn.classList.replace("bg-blue-600", "bg-red-600");
    parkingLoop();
  } else {
    if (icon) icon.textContent = "▶";
    if (text) text.textContent = "ចាប់ផ្ដើម Lab";
    if (btn) btn.classList.replace("bg-red-600", "bg-blue-600");
    if (parkingAnimId) cancelAnimationFrame(parkingAnimId);
  }
}

function spawnVehicleManually() {
  parkingVehicles.push({
    x: -90,
    y: 305 + Math.random() * 15,
    speed: 1.4 + Math.random() * 0.8,
    color: Math.random() > 0.5 ? "#2f81f7" : "#f0883e",
    parked: false,
    slot: null,
  });
  if (!parkingRunning) drawParkingSimulation();
}

function resetParkingLotData() {
  parkingVehicles = [];
  parkingOccupiedSlots = 0;
  updateParkingTelemetry(140, false);
  updateParkingStats();
  drawParkingSimulation();
}

function parkingLoop() {
  updateParkingPhysics();
  drawParkingSimulation();
  parkingAnimId = requestAnimationFrame(parkingLoop);
}

function updateParkingPhysics() {
  if (parkingRunning && Math.random() > 0.985 && parkingVehicles.length < 5) {
    spawnVehicleManually();
  }

  const openGate = parkingVehicles.some(vehicle => vehicle.x > 120 && vehicle.x < 250 && !vehicle.parked);
  parkingVehicles.forEach(vehicle => {
    if (!vehicle.parked) vehicle.x += vehicle.speed * simSpeedSetting;
    if (!vehicle.parked && vehicle.x > 520 && parkingOccupiedSlots < 6) {
      vehicle.parked = true;
      vehicle.slot = parkingOccupiedSlots;
      parkingOccupiedSlots += 1;
      updateParkingStats();
    }
  });

  parkingVehicles = parkingVehicles.filter(vehicle => vehicle.x < 900);
  const nearest = parkingVehicles.reduce((best, vehicle) => {
    const dist = Math.max(0, 240 - vehicle.x);
    return Math.min(best, dist);
  }, 140);
  updateParkingTelemetry(nearest, openGate);
}

function updateParkingTelemetry(distance, gateOpen) {
  const distanceText = document.getElementById("parking_distance");
  const distanceBar = document.getElementById("parking_distance_bar");
  const servoText = document.getElementById("parking_servo_angle");
  const servoBar = document.getElementById("parking_servo_bar");

  if (distanceText) distanceText.textContent = `${Math.round(distance)} cm`;
  if (distanceBar) distanceBar.style.width = `${Math.max(8, Math.min(100, distance / 140 * 100))}%`;
  if (servoText) servoText.textContent = gateOpen ? "90° (Open)" : "0° (Closed)";
  if (servoBar) servoBar.style.width = gateOpen ? "100%" : "0%";
}

function updateParkingStats() {
  const available = Math.max(0, 6 - parkingOccupiedSlots);
  const availableEl = document.getElementById("parking_available_slots");
  const occupancyEl = document.getElementById("parking_occupancy_rate");
  if (availableEl) availableEl.textContent = available;
  if (occupancyEl) occupancyEl.textContent = `${Math.round((parkingOccupiedSlots / 6) * 100)}%`;
}

function drawParkingSimulation() {
  const canvas = document.getElementById("parkingCanvas");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  const W = canvas.width;
  const H = canvas.height;

  ctx.fillStyle = "#071018";
  ctx.fillRect(0, 0, W, H);

  ctx.fillStyle = "#111827";
  ctx.fillRect(0, 285, W, 70);
  ctx.strokeStyle = "rgba(255,255,255,0.18)";
  ctx.setLineDash([20, 16]);
  ctx.beginPath();
  ctx.moveTo(0, 320);
  ctx.lineTo(W, 320);
  ctx.stroke();
  ctx.setLineDash([]);

  ctx.fillStyle = "#0f172a";
  ctx.fillRect(520, 70, 245, 180);
  ctx.strokeStyle = "#38bdf8";
  ctx.strokeRect(520, 70, 245, 180);

  for (let i = 0; i < 6; i++) {
    const x = 535 + (i % 3) * 75;
    const y = 88 + Math.floor(i / 3) * 78;
    ctx.strokeStyle = i < parkingOccupiedSlots ? "#22c55e" : "rgba(255,255,255,0.24)";
    ctx.strokeRect(x, y, 58, 52);
    ctx.fillStyle = i < parkingOccupiedSlots ? "rgba(34,197,94,0.22)" : "rgba(255,255,255,0.04)";
    ctx.fillRect(x, y, 58, 52);
    ctx.fillStyle = "#94a3b8";
    ctx.font = "11px JetBrains Mono";
    ctx.fillText(`S${i + 1}`, x + 18, y + 32);
  }

  const gateOpen = document.getElementById("parking_servo_angle")?.textContent.includes("Open");
  ctx.strokeStyle = gateOpen ? "#22c55e" : "#f97316";
  ctx.lineWidth = 7;
  ctx.beginPath();
  ctx.moveTo(300, 278);
  ctx.lineTo(gateOpen ? 360 : 300, gateOpen ? 236 : 342);
  ctx.stroke();
  ctx.lineWidth = 1;

  parkingVehicles.forEach(vehicle => {
    const drawX = vehicle.parked && vehicle.slot !== null ? 545 + (vehicle.slot % 3) * 75 : vehicle.x;
    const drawY = vehicle.parked && vehicle.slot !== null ? 106 + Math.floor(vehicle.slot / 3) * 78 : vehicle.y;
    drawParkingCar(ctx, drawX, drawY, vehicle.color, vehicle.parked);
  });

  ctx.fillStyle = "#e5e7eb";
  ctx.font = "bold 13px JetBrains Mono";
  ctx.fillText("YOLO VEHICLE GATE + ULTRASONIC SENSOR", 24, 34);
  ctx.fillStyle = "#38bdf8";
  ctx.fillText(`AVAILABLE SLOTS: ${Math.max(0, 6 - parkingOccupiedSlots)}`, 24, 58);
}

function drawParkingCar(ctx, x, y, color, small = false) {
  const scale = small ? 0.72 : 1;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, 70, 28);
  ctx.fillStyle = "rgba(255,255,255,0.75)";
  ctx.fillRect(14, -10, 35, 14);
  ctx.fillStyle = "#0f172a";
  ctx.beginPath();
  ctx.arc(16, 30, 7, 0, Math.PI * 2);
  ctx.arc(54, 30, 7, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}
