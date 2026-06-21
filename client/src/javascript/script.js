let activePage = "guide";
let isInference = false;
let confThreshold = 0.5;
let counts = { banana: 0, apple: 0 };
let frames = 0;
let collectGallery = [];
let apiStatusTimer = null;

// Navigation Logic
function toggleTheme() {
  const nextTheme = document.body.classList.contains("light-theme")
    ? "dark"
    : "light";
  applyTheme(nextTheme);
}

function applyTheme(theme) {
  const isLight = theme === "light";
  document.body.classList.toggle("light-theme", isLight);
  localStorage.setItem("smartCityTheme", isLight ? "light" : "dark");
  const icon = document.getElementById("themeIcon");
  const label = document.getElementById("themeLabel");
  if (icon) icon.innerText = isLight ? "☀" : "☾";
  if (label) label.innerText = isLight ? "Light" : "Dark";
}

async function loadPageFragments() {
  const mounts = document.querySelectorAll("[data-component]");
  await Promise.all(
    Array.from(mounts).map(async (mount) => {
      try {
        const response = await fetch(mount.dataset.component);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        mount.innerHTML = await response.text();
      } catch (error) {
        mount.innerHTML =
          '<div class="card"><div class="card-title">Backend API</div><p class="text-sm text-red-400 mt-3">Could not load API panel.</p></div>';
        console.error("Component load failed:", error);
      }
    }),
  );
}

function nav(id) {
  document
    .querySelectorAll(".page")
    .forEach((p) => p.classList.remove("active"));
  document
    .querySelectorAll(".nav-item")
    .forEach((n) => n.classList.remove("active"));
  document.getElementById("page-" + id).classList.add("active");

  const navItems = Array.from(document.querySelectorAll(".nav-item"));
  const targetItem = navItems.find((item) =>
    item.getAttribute("onclick").includes(`'${id}'`),
  );
  if (targetItem) {
    targetItem.classList.add("active");
  }

  activePage = id;

  if (id === "augment") initAug();
  if (id === "gradcam") showGradCam("banana");
  if (id === "models") drawTradeoff();
  if (id === "smartcity") initCityDashboard();
  if (id === "edge") initEdgeDashboard();
}

// ── SLIDE LOGIC ──────────────────────────────────────
let currentSlide = 0;
const TOTAL_SLIDES = 2;

function goSlide(n) {
  currentSlide = ((n % TOTAL_SLIDES) + TOTAL_SLIDES) % TOTAL_SLIDES;
  document.querySelectorAll(".slide-panel").forEach((el, i) => {
    el.style.display = i === currentSlide ? "grid" : "none";
  });
  document.querySelectorAll('[id^="slideDot"]').forEach((dot, i) => {
    dot.style.background = i === currentSlide ? "var(--blue)" : "var(--s4)";
  });
}

// Auto-advance slides every 6s when on guide page
setInterval(() => {
  if (activePage === "guide") goSlide(currentSlide + 1);
}, 6000);

// ── CHATBOT LOGIC ─────────────────────────────────────
const chatKnowledge = {
  yolov8: `YOLOv8 (You Only Look Once v8) គឺជា Model ចាប់ Object ក្នុងរូបភាពក្នុង Real-time ។ វារកើតដោយ Ultralytics ។ Version Nano (~3MB) ល្អសម្រាប់ Raspberry Pi ដោយសារតែ:\n• ល្បឿន: 45 FPS\n• Accuracy (mAP@50): 88.5%\n• RAM ប្រើ: ~2GB\nការប្រើ: ultralytics train data=data.yaml model=yolov8n.pt epochs=100`,
  mqtt: `MQTT vs HTTP:\n• MQTT: Protocol ស្រាលសម្រាប់ IoT Sensor និង Edge Device\n• HTTP: Request/Response សម្រាប់ Dashboard និង API\nក្នុង Smart City: ESP32 ឬ Raspberry Pi ផ្ញើទិន្នន័យទៅ Backend ហើយ Dashboard ទាញមកបង្ហាញជា live stats។`,
  esp32: `ESP32 គឺជា Microcontroller រួម Wi-Fi + Bluetooth ។ ក្នុង Smart City វាអាចអាន Sensor ខ្យល់ សំឡេង សីតុណ្ហភាព ឬ traffic counter ហើយផ្ញើទិន្នន័យទៅ API/MQTT Broker។`,
  raspberrypi: `Raspberry Pi 4/5 ជា Mini Computer សម្រាប់ Edge Server ។ ក្នុង Smart City វាអាច Run camera stream, FastAPI backend, lightweight vision model និង local dashboard។`,
  smartcity: `Smart City Project ប្រើ:\n1. Camera និង IoT Sensor nodes\n2. FastAPI backend សម្រាប់ stream/stats\n3. Frontend dashboard សម្រាប់ operator\n4. Alert/log system សម្រាប់សម្រេចចិត្តលឿន`,
  ai: `ការវិភាគឆ្លាតវៃក្នុង Smart City អាចប្រើ Computer Vision សម្រាប់ចរាចរណ៍ សុវត្ថិភាព និងការវាស់បរិស្ថាន។ Platform សាកសមគឺ Raspberry Pi + Python + FastAPI + Dashboard UI។`,
  default: `ខ្ញុំអាចជួយអ្នកអំពី:\n🏙️ Smart City System Design\n🧠 YOLOv8 & Computer Vision\n📡 MQTT & IoT Protocol\n⚙️ ESP32 Sensor Nodes\n🖥️ Raspberry Pi Edge Server\n📊 Dashboard Architecture\n\nសួរបន្ថែមមកតាមខ្ញុំ!`,
};

function getChatReply(msg) {
  const m = msg.toLowerCase();
  if (m.includes("yolo") || m.includes("detect") || m.includes("vision"))
    return chatKnowledge.yolov8;
  if (m.includes("mqtt") || m.includes("http") || m.includes("protocol"))
    return chatKnowledge.mqtt;
  if (m.includes("esp32") || m.includes("arduino") || m.includes("sensor"))
    return chatKnowledge.esp32;
  if (m.includes("raspberry") || m.includes("rpi") || m.includes("edge"))
    return chatKnowledge.raspberrypi;
  if (m.includes("smart city") || m.includes("city") || m.includes("ទីក្រុង"))
    return chatKnowledge.smartcity;
  if (
    m.includes("ai") ||
    m.includes("ml") ||
    m.includes("machine") ||
    m.includes("ការ") ||
    m.includes("vision")
  )
    return chatKnowledge.ai;
  return chatKnowledge.default;
}

function appendBubble(who, text) {
  const box = document.getElementById("chatMessages");
  const isBot = who === "bot";
  const wrap = document.createElement("div");
  wrap.style.cssText = `display:flex;gap:10px;align-items:flex-start;${isBot ? "" : "flex-direction:row-reverse;"}`;
  const avatar = document.createElement("div");
  avatar.style.cssText = `width:28px;height:28px;border-radius:50%;background:${isBot ? "linear-gradient(135deg,var(--blue),var(--purple))" : "linear-gradient(135deg,var(--green),var(--banana))"};display:flex;align-items:center;justify-content:center;font-size:14px;flex-shrink:0;`;
  avatar.textContent = isBot ? "🤖" : "👤";
  const bubble = document.createElement("div");
  bubble.style.cssText = `background:${isBot ? "var(--s3)" : "rgba(47,129,247,0.15)"};border:1px solid ${isBot ? "var(--border)" : "rgba(47,129,247,0.3)"};border-radius:${isBot ? "10px 10px 10px 2px" : "10px 10px 2px 10px"};padding:10px 14px;color:var(--text);max-width:78%;line-height:1.7;font-size:12px;white-space:pre-wrap;`;
  bubble.textContent = text;
  wrap.appendChild(avatar);
  wrap.appendChild(bubble);
  box.appendChild(wrap);
  box.scrollTop = box.scrollHeight;
  return bubble;
}

function sendChat() {
  const input = document.getElementById("chatInput");
  const msg = input.value.trim();
  if (!msg) return;
  input.value = "";
  appendBubble("user", msg);

  // Typing indicator
  const box = document.getElementById("chatMessages");
  const typingWrap = document.createElement("div");
  typingWrap.style.cssText = "display:flex;gap:10px;align-items:flex-start;";
  typingWrap.innerHTML = `<div style="width:28px;height:28px;border-radius:50%;background:linear-gradient(135deg,var(--blue),var(--purple));display:flex;align-items:center;justify-content:center;font-size:14px;flex-shrink:0;">🤖</div><div style="background:var(--s3);border:1px solid var(--border);border-radius:10px 10px 10px 2px;padding:10px 18px;"><span class="typing-dot"></span><span class="typing-dot"></span><span class="typing-dot"></span></div>`;
  box.appendChild(typingWrap);
  box.scrollTop = box.scrollHeight;

  setTimeout(
    () => {
      box.removeChild(typingWrap);
      appendBubble("bot", getChatReply(msg));
    },
    900 + Math.random() * 600,
  );
}

function quickChat(msg) {
  document.getElementById("chatInput").value = msg;
  sendChat();
}

// Global Logger
function addLog(msg, colorClass) {
  const box = document.getElementById("logBox");
  if (!box) return;
  const div = document.createElement("div");
  div.className = colorClass;
  div.innerText = `[${new Date().toLocaleTimeString()}] ${msg}`;
  box.prepend(div);
  if (box.children.length > 25) box.lastChild.remove();
}

function drawBanana(ctx, x, y, scale, angle, detected = false) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.scale(scale, scale);

  // --- 1. MAIN BANANA BODY BASE ---
  ctx.beginPath();
  ctx.moveTo(-65, 23);
  // Lower outer belly curve (deep sagging swoop)
  ctx.bezierCurveTo(-20, 52, 28, 32, 45, -28);
  // Shortened stem outer curve leading up to the crown
  ctx.bezierCurveTo(48, -40, 51, -50, 51, -56); // Pulled down from -75
  // Flat-ish jagged stalk top cut line
  ctx.lineTo(43, -59); // Pulled down from -78
  // Inner stem line moving down
  ctx.bezierCurveTo(41, -50, 38, -40, 35, -30);
  // Upper inner crescent curve
  ctx.bezierCurveTo(10, -5, -25, 10, -62, 13);
  ctx.closePath();

  // Multi-stop directional gradient capturing the multi-toned real peel skin
  let bodyGrad = ctx.createLinearGradient(-40, 35, 30, -30);
  bodyGrad.addColorStop(0.0, "#dca11d"); // Warm ochre yellow shadow
  bodyGrad.addColorStop(0.2, "#f5cb3c"); // Classic rich banana yellow
  bodyGrad.addColorStop(0.5, "#fde982"); // Soft bright highlight running down the middle ridge
  bodyGrad.addColorStop(0.8, "#eed149"); // Golden mid-tone yellow
  bodyGrad.addColorStop(1.0, "#b8b243"); // Greenish-yellow transition zone near the neck

  ctx.fillStyle = bodyGrad;
  ctx.fill();

  // --- 2. 3D STRUCTURAL FACETS (Peel Planes) ---
  ctx.beginPath();
  ctx.moveTo(-62, 13);
  ctx.bezierCurveTo(-25, 10, 10, -5, 35, -30);
  ctx.bezierCurveTo(20, -15, -15, 0, -63, 18);
  ctx.closePath();
  ctx.fillStyle = "rgba(255, 255, 255, 0.28)";
  ctx.fill();

  // Sharp main central longitudinal ridge shadow line
  ctx.beginPath();
  ctx.moveTo(-64, 18);
  ctx.quadraticCurveTo(-10, 29, 41, -28);
  ctx.strokeStyle = "rgba(150, 105, 12, 0.35)";
  ctx.lineWidth = 2.2;
  ctx.stroke();

  // --- 3. ORGANIC SHORT GREEN STEM NECK ---
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(25, -15);
  ctx.bezierCurveTo(31, -25, 38, -40, 35, -30);
  ctx.bezierCurveTo(38, -40, 41, -50, 43, -59);
  ctx.lineTo(51, -56);
  ctx.bezierCurveTo(51, -50, 48, -40, 45, -28);
  ctx.bezierCurveTo(40, -10, 30, 5, 15, 12);
  ctx.closePath();

  let stemGrad = ctx.createLinearGradient(20, -10, 46, -52);
  stemGrad.addColorStop(0.0, "rgba(245, 203, 60, 0)");
  stemGrad.addColorStop(0.25, "#b4be3b"); // Ripe yellow-green neck
  stemGrad.addColorStop(0.65, "#87a233"); // Strong organic plant green
  stemGrad.addColorStop(1.0, "#58751b"); // Deep green right before the wood cut
  ctx.fillStyle = stemGrad;
  ctx.fill();
  ctx.restore();

  // Dark brown ring mark where the stem meets the fruit body
  ctx.beginPath();
  ctx.moveTo(36, -28);
  ctx.quadraticCurveTo(40, -25, 43, -27);
  ctx.strokeStyle = "rgba(74, 53, 36, 0.45)";
  ctx.lineWidth = 1.8;
  ctx.stroke();

  // --- 4. TEXTURED STUBBY WOODY STALK (Top Right Crown) ---
  ctx.beginPath();
  ctx.moveTo(43, -59);
  ctx.lineTo(45, -64);
  ctx.lineTo(48, -65);
  ctx.lineTo(49, -61);
  ctx.lineTo(53, -63);
  ctx.lineTo(51, -56);
  ctx.bezierCurveTo(49, -58, 45, -57, 43, -59);
  ctx.closePath();

  let woodGrad = ctx.createLinearGradient(43, -65, 51, -56);
  woodGrad.addColorStop(0.0, "#c2a378"); // Light tan fiber highlight
  woodGrad.addColorStop(0.5, "#826245"); // Mid wood brown
  woodGrad.addColorStop(1.0, "#3d2d21"); // Deep fibrous dark charcoal core
  ctx.fillStyle = woodGrad;
  ctx.fill();

  // Fine vertical texture lines for the broken wood grain fibers
  ctx.beginPath();
  ctx.moveTo(45, -64);
  ctx.lineTo(44, -58);
  ctx.moveTo(48, -65);
  ctx.lineTo(47, -57);
  ctx.moveTo(50, -61);
  ctx.lineTo(50, -56);
  ctx.strokeStyle = "#261b12";
  ctx.lineWidth = 0.8;
  ctx.stroke();

  // --- 5. ROUGH BLOSSOM END CAP (Left Tip) ---
  ctx.beginPath();
  ctx.moveTo(-65, 23);
  ctx.bezierCurveTo(-69, 21, -70, 14, -62, 13);
  ctx.lineTo(-59, 16);
  ctx.bezierCurveTo(-63, 18, -62, 22, -65, 23);
  ctx.closePath();
  ctx.fillStyle = "#2b1f17";
  ctx.fill();

  ctx.beginPath();
  ctx.arc(-64, 17.5, 3.8, 0, Math.PI * 2);
  ctx.fillStyle = "#1c130d";
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(-62, 13);
  ctx.quadraticCurveTo(-54, 21, -65, 23);
  ctx.strokeStyle = "rgba(88, 102, 36, 0.35)";
  ctx.lineWidth = 3.5;
  ctx.stroke();

  // --- 6. NATURAL SKIN IMPERFECTIONS (Freckles & Blemishes) ---
  // Dark scratch mark near the bottom left
  ctx.beginPath();
  ctx.moveTo(-44, 28);
  ctx.quadraticCurveTo(-34, 26, -22, 28.5);
  ctx.strokeStyle = "rgba(69, 46, 23, 0.75)";
  ctx.lineWidth = 1.4;
  ctx.stroke();

  // Sugar spots/specks
  let freckles = [
    { x: 32, y: -20, r: 0.9 },
    { x: 34, y: -17, r: 1.3 },
    { x: 35, y: -22, r: 0.6 },
    { x: 37, y: -12, r: 1.6 },
    { x: 31, y: -8, r: 0.9 },
    { x: 27, y: -6, r: 0.8 },
    { x: 34, y: -4, r: 1.2 },
    { x: 21, y: -1, r: 0.5 },
    { x: 24, y: -4, r: 0.8 },
    { x: -12, y: 15, r: 0.7 },
    { x: -32, y: 22, r: 0.6 },
    { x: 6, y: 11, r: 0.8 },
  ];
  ctx.fillStyle = "rgba(77, 51, 28, 0.65)";
  freckles.forEach((spot) => {
    ctx.beginPath();
    ctx.arc(spot.x, spot.y, spot.r, 0, Math.PI * 2);
    ctx.fill();
  });

  // Soft brown bruise patch on the shoulder
  ctx.save();
  let patchGrad = ctx.createRadialGradient(31, -10, 1, 31, -10, 13);
  patchGrad.addColorStop(0, "rgba(97, 70, 38, 0.28)");
  patchGrad.addColorStop(1, "rgba(97, 70, 38, 0)");
  ctx.fillStyle = patchGrad;
  ctx.beginPath();
  ctx.arc(31, -10, 13, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  ctx.restore();
}
function drawApple(ctx, x, y, scale, detected = false) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);

  // Heart-shaped base
  ctx.beginPath();
  ctx.moveTo(0, 24);
  ctx.bezierCurveTo(-40, 26, -45, -32, 0, -20); // Left lobe
  ctx.bezierCurveTo(45, -32, 40, 26, 0, 24); // Right lobe

  let grad = ctx.createRadialGradient(-10, -12, 4, 0, 0, 40);
  grad.addColorStop(0, "#ff4d4d"); // Bright red center
  grad.addColorStop(0.7, "#b51919"); // Dark delicious red
  grad.addColorStop(1, "#610505"); // Outer shadow edge

  ctx.fillStyle = grad;
  ctx.fill();

  // Stem (ទងផ្លែប៉ោម)
  ctx.beginPath();
  ctx.moveTo(0, -18);
  ctx.quadraticCurveTo(4, -36, 15, -38);
  ctx.strokeStyle = "#5c330e";
  ctx.lineWidth = 3.5;
  ctx.lineCap = "round";
  ctx.stroke();

  // Green Leaf (ស្លឹកឈើ)
  ctx.beginPath();
  ctx.ellipse(8, -32, 10, 5, -0.5, 0, Math.PI * 2);
  ctx.fillStyle = "#3a8031";
  ctx.fill();
  ctx.strokeStyle = "#1e4d18";
  ctx.lineWidth = 0.8;
  ctx.stroke();

  // Specular Highlight
  ctx.beginPath();
  ctx.ellipse(-14, -10, 8, 4, -0.6, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(255, 255, 255, 0.35)";
  ctx.fill();

  ctx.restore();
}

// ── 1. DETECTION INFERENCE LOGIC ──
const detCanvas = document.getElementById("detectCanvas");
const detCtx = detCanvas.getContext("2d");

let detectionFruits = [
  { type: "banana", x: 220, y: 150, s: 1.15, a: 0.15, vx: 1.2, vy: 0.8 },
  { type: "apple", x: 580, y: 260, s: 1.05, a: 0, vx: -0.9, vy: 1.1 },
  { type: "banana", x: 380, y: 320, s: 0.95, a: -0.4, vx: 1.4, vy: -1.0 },
];

function toggleInference() {
  isInference = !isInference;
  const btn = document.getElementById("btnToggle");
  const btnText = document.getElementById("btnText");
  const btnIcon = document.getElementById("btnIcon");
  const scan = document.getElementById("scanLine");
  const videoStream = document.getElementById("videoStream");

  if (isInference) {
    btnText.innerText = "បញ្ឈប់ការ Detect";
    btnIcon.innerText = "⏹";
    btn.classList.replace("bg-blue-600", "bg-red-600");
    scan.style.display = "block";
    videoStream.src = `${API_BASE_URL}/video_feed?ts=${Date.now()}`;
    addLog(
      "[SYSTEM] Inference Live Engine Started (YOLOv8 Endpoint).",
      "text-blue-400",
    );
  } else {
    btnText.innerText = "ចាប់ផ្ដើម Detect";
    btnIcon.innerText = "▶";
    btn.classList.replace("bg-red-600", "bg-blue-600");
    scan.style.display = "none";
    videoStream.src = "";
    addLog("[SYSTEM] Inference Live Engine Paused.", "text-gray-500");
  }
}

// Stats polling logic API
setInterval(() => {
  if (!isInference) return;
  fetch("/api/stats")
    .then((res) => res.json())
    .then((data) => {
      document.getElementById("countBanana").innerText = data.banana || 0;
      document.getElementById("countApple").innerText = data.apple || 0;

      if (document.getElementById("apiStatsBanana"))
        document.getElementById("apiStatsBanana").innerText = data.banana || 0;
      if (document.getElementById("apiStatsApple"))
        document.getElementById("apiStatsApple").innerText = data.apple || 0;
      if (document.getElementById("apiStatsOrange"))
        document.getElementById("apiStatsOrange").innerText = data.orange || 0;

      if (document.getElementById("apiStatus"))
        document.getElementById("apiStatus").style.background = "#3fb950"; // Green
    })
    .catch((err) => {
      if (document.getElementById("apiStatus"))
        document.getElementById("apiStatus").style.background = "#e84c4c"; // Red
    });
}, 1000);

function resetDetectionStats() {
  counts = { banana: 0, apple: 0 };
  document.getElementById("countBanana").innerText = "0";
  document.getElementById("countApple").innerText = "0";
  addLog("[SYSTEM] Reset statistics counters.", "text-orange-400");
}

function renderDetection() {
  const W = detCanvas.width;
  const H = detCanvas.height;

  detCtx.fillStyle = "#080c10";
  detCtx.fillRect(0, 0, W, H);

  // Tech Grid Background
  detCtx.strokeStyle = "rgba(255,255,255,0.02)";
  detCtx.lineWidth = 1;
  for (let i = 0; i < W; i += 40) {
    detCtx.beginPath();
    detCtx.moveTo(i, 0);
    detCtx.lineTo(i, H);
    detCtx.stroke();
  }
  for (let j = 0; j < H; j += 40) {
    detCtx.beginPath();
    detCtx.moveTo(0, j);
    detCtx.lineTo(W, j);
    detCtx.stroke();
  }

  detectionFruits.forEach((obj) => {
    if (isInference) {
      obj.x += obj.vx;
      obj.y += obj.vy;
      if (obj.x < 80 || obj.x > W - 80) obj.vx *= -1;
      if (obj.y < 80 || obj.y > H - 80) obj.vy *= -1;
    }

    // Render beautiful fruit models
    if (obj.type === "banana") drawBanana(detCtx, obj.x, obj.y, obj.s, obj.a);
    else drawApple(detCtx, obj.x, obj.y, obj.s);

    // AI Bounding Boxes overlay
    if (isInference) {
      const conf = 0.81 + Math.sin(Date.now() * 0.003 + obj.x) * 0.12;
      if (conf >= confThreshold) {
        const color = obj.type === "banana" ? "#f5c842" : "#e84c4c";
        const label =
          obj.type === "banana" ? "🍌 ចេក (Banana)" : "🍎 ប៉ោម (Apple)";

        detCtx.strokeStyle = color;
        detCtx.lineWidth = 2.5;
        // Draw elegant bounding corners
        detCtx.strokeRect(obj.x - 55, obj.y - 55, 110, 110);

        // Label Box
        detCtx.fillStyle = color;
        detCtx.fillRect(obj.x - 55, obj.y - 82, 110, 25);

        // Text label
        detCtx.fillStyle = "#000000";
        detCtx.font = "bold 11px Kantumruy Pro, sans-serif";
        detCtx.fillText(
          `${label} ${Math.floor(conf * 100)}%`,
          obj.x - 50,
          obj.y - 65,
        );

        // Randomly simulate statistical detections
        if (Math.random() > 0.993) {
          counts[obj.type]++;
          document.getElementById("countBanana").innerText = counts.banana;
          document.getElementById("countApple").innerText = counts.apple;
          addLog(
            `Detected Fruit Class: ${obj.type.toUpperCase()} · Score: ${Math.floor(conf * 100)}%`,
            obj.type === "banana" ? "text-[#f5c842]" : "text-[#e84c4c]",
          );
        }
      }
    }
  });

  requestAnimationFrame(renderDetection);
}

// ── 2. DATA COLLECTION ENGINE ──
const colCanvas = document.getElementById("collectCanvas");
const colCtx = colCanvas.getContext("2d");
let colFruitX = 400,
  colFruitY = 225,
  colFruitDir = 1;

function renderCollectStudio() {
  const W = colCanvas.width;
  const H = colCanvas.height;

  colCtx.fillStyle = "#0a0d12";
  colCtx.fillRect(0, 0, W, H);

  // Alignment grid crosshair
  colCtx.strokeStyle = "rgba(255,255,255,0.05)";
  colCtx.lineWidth = 1;
  colCtx.beginPath();
  colCtx.moveTo(W / 2, 0);
  colCtx.lineTo(W / 2, H);
  colCtx.stroke();
  colCtx.beginPath();
  colCtx.moveTo(0, H / 2);
  colCtx.lineTo(W, H / 2);
  colCtx.stroke();

  // Bounding box frame target
  colCtx.strokeStyle = "#f0883e";
  colCtx.lineWidth = 2;
  colCtx.setLineDash([8, 4]);
  colCtx.strokeRect(W / 2 - 100, H / 2 - 100, 200, 200);
  colCtx.setLineDash([]);

  // Slowly animate the fruit in the studio viewport
  colFruitX += 0.4 * colFruitDir;
  if (Math.abs(colFruitX - 400) > 30) colFruitDir *= -1;

  const currentSelection = document.getElementById("collectLabel").value;
  if (currentSelection === "banana") {
    drawBanana(colCtx, colFruitX, colFruitY, 1.6, 0.2);
  } else {
    drawApple(colCtx, colFruitX, colFruitY, 1.4);
  }

  requestAnimationFrame(renderCollectStudio);
}

function captureDataImage() {
  const currentSelection = document.getElementById("collectLabel").value;
  const tempCanvas = document.createElement("canvas");
  tempCanvas.width = 100;
  tempCanvas.height = 100;
  const tempCtx = tempCanvas.getContext("2d");

  // Capture centered crop from collectCanvas
  tempCtx.drawImage(
    colCanvas,
    colCanvas.width / 2 - 100,
    colCanvas.height / 2 - 100,
    200,
    200,
    0,
    0,
    100,
    100,
  );

  const dataUrl = tempCanvas.toDataURL();
  collectGallery.push({ type: currentSelection, img: dataUrl });

  updateCollectGalleryUI();
  addLog(
    `Captured data specimen for class: ${currentSelection.toUpperCase()}`,
    "text-orange-400",
  );
}

function clearDataset() {
  collectGallery = [];
  updateCollectGalleryUI();
  addLog("Succeeded in clearing all dataset samples.", "text-red-400");
}

function updateCollectGalleryUI() {
  const gal = document.getElementById("captureGallery");
  const banCountEl = document.getElementById("dsBanCount");
  const appCountEl = document.getElementById("dsAppCount");

  let banCount = 0;
  let appCount = 0;

  if (collectGallery.length === 0) {
    gal.innerHTML =
      '<div class="text-[10px] text-gray-500 text-center col-span-3 py-6">គ្មានរូបភាពនៅឡើយទេ</div>';
  } else {
    gal.innerHTML = collectGallery
      .map((item, index) => {
        if (item.type === "banana") banCount++;
        else appCount++;

        const badgeColor =
          item.type === "banana"
            ? "bg-[#f5c842]/20 text-[#f5c842]"
            : "bg-[#e84c4c]/20 text-[#e84c4c]";
        return `
        <div class="relative bg-white/5 border border-white/10 rounded-md overflow-hidden aspect-square group">
          <img src="${item.img}" class="w-full h-full object-cover">
          <span class="absolute bottom-1 left-1 text-[8px] px-1 rounded ${badgeColor} font-mono">${item.type}</span>
          <button onclick="deleteSample(${index})" class="absolute top-1 right-1 opacity-0 group-hover:opacity-100 bg-red-600 text-white text-[8px] w-4 h-4 rounded-full flex items-center justify-center transition-all">✕</button>
        </div>
      `;
      })
      .join("");
  }

  banCountEl.innerText = banCount;
  appCountEl.innerText = appCount;
}

function deleteSample(index) {
  collectGallery.splice(index, 1);
  updateCollectGalleryUI();
}

let activeAugments = new Set();

function initAug() {
  const grid = document.getElementById("augGrid");
  const type = document.getElementById("augFruitSelect").value;

  const augEffects = [
    { id: "original", name: "Original (ប្រភពដើម)" },
    { id: "rotate", name: "Rotate ±15° (បង្វិល)" },
    { id: "flip", name: "Horizontal Flip (ត្រឡប់)" },
    { id: "bright", name: "Brightness +30% (ពន្លឺ)" },
    { id: "dark", name: "Darkness -30% (ងងឹត)" },
    { id: "noise", name: "Gaussian Noise (គ្រាប់លម្អិត)" },
    { id: "blur", name: "Gaussian Blur (ព្រាល)" },
    { id: "crop", name: "Random Crop (កាត់ចំណែក)" },
  ];

  grid.innerHTML = augEffects
    .map((eff, index) => {
      const isActive = activeAugments.has(eff.id) || eff.id === "original";
      return `
      <div class="aug-cell p-2 flex flex-col justify-between ${isActive ? "active" : ""}" id="aug-${eff.id}" onclick="toggleAugment('${eff.id}')">
         <canvas id="augCanvas-${eff.id}" width="150" height="110" class="rounded overflow-hidden bg-black/40"></canvas>
         <div class="text-[10px] text-center font-mono mt-2 text-gray-400 group-hover:text-white">${eff.name}</div>
      </div>
    `;
    })
    .join("");

  setTimeout(() => {
    augEffects.forEach((eff) => {
      drawAugmentedFruit(eff.id, type);
    });
  }, 50);
}

function drawAugmentedFruit(effectId, type) {
  const canvas = document.getElementById(`augCanvas-${effectId}`);
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  const W = canvas.width;
  const H = canvas.height;

  ctx.fillStyle = "#0a0d12";
  ctx.fillRect(0, 0, W, H);

  ctx.save();

  // Transformations based on effect
  if (effectId === "rotate") {
    ctx.translate(W / 2, H / 2);
    ctx.rotate(0.26); // ~15 degrees
    ctx.translate(-W / 2, -H / 2);
  } else if (effectId === "flip") {
    ctx.translate(W, 0);
    ctx.scale(-1, 1);
  } else if (effectId === "crop") {
    ctx.translate(-15, -10);
    ctx.scale(1.2, 1.2);
  }

  // Draw the original beautifully
  if (type === "banana") {
    drawBanana(ctx, W / 2, H / 2 + 5, 1.25, 0.1);
  } else {
    drawApple(ctx, W / 2, H / 2 + 5, 1.1);
  }

  ctx.restore();

  // Pixel level transformations
  if (
    effectId === "bright" ||
    effectId === "dark" ||
    effectId === "noise" ||
    effectId === "blur"
  ) {
    const imgData = ctx.getImageData(0, 0, W, H);
    const data = imgData.data;

    if (effectId === "bright") {
      for (let i = 0; i < data.length; i += 4) {
        data[i] = Math.min(255, data[i] * 1.3); // Red
        data[i + 1] = Math.min(255, data[i + 1] * 1.3); // Green
        data[i + 2] = Math.min(255, data[i + 2] * 1.3); // Blue
      }
    } else if (effectId === "dark") {
      for (let i = 0; i < data.length; i += 4) {
        data[i] = data[i] * 0.7;
        data[i + 1] = data[i + 1] * 0.7;
        data[i + 2] = data[i + 2] * 0.7;
      }
    } else if (effectId === "noise") {
      for (let i = 0; i < data.length; i += 4) {
        let noise = (Math.random() - 0.5) * 35;
        data[i] = Math.min(255, Math.max(0, data[i] + noise));
        data[i + 1] = Math.min(255, Math.max(0, data[i + 1] + noise));
        data[i + 2] = Math.min(255, Math.max(0, data[i + 2] + noise));
      }
    } else if (effectId === "blur") {
      ctx.filter = "blur(2px)";
      ctx.drawImage(canvas, 0, 0);
      return;
    }

    ctx.putImageData(imgData, 0, 0);
  }
}

function toggleAugment(id) {
  if (id === "original") return;
  const cell = document.getElementById(`aug-${id}`);
  if (activeAugments.has(id)) {
    activeAugments.delete(id);
    cell.classList.remove("active");
  } else {
    activeAugments.add(id);
    cell.classList.add("active");
  }
}

function applyAllAugments() {
  const list = ["rotate", "flip", "bright", "dark", "noise", "blur", "crop"];
  list.forEach((id) => {
    activeAugments.add(id);
    const cell = document.getElementById(`aug-${id}`);
    if (cell) cell.classList.add("active");
  });
}

function resetAugments() {
  activeAugments.clear();
  document.querySelectorAll(".aug-cell").forEach((c) => {
    if (c.id !== "aug-original") c.classList.remove("active");
  });
}

function updateConfusionMatrixLogic() {
  const range = document.getElementById("cmThreshold");
  const val = range.value;
  document.getElementById("cmThresholdVal").innerText = val + "%";

  // Real world simulation math formulas based on selected confidence
  const confidenceFactor = parseFloat(val) / 100;

  // Simulated true labels total samples = 180
  // Accuracy will change depending on confidence settings
  const baseAccuracy = 0.94 - Math.abs(confidenceFactor - 0.7) * 0.35;
  const tp = Math.round(90 * baseAccuracy * (1.05 - confidenceFactor * 0.05));
  const tn = Math.round(90 * baseAccuracy * (1.02 - confidenceFactor * 0.02));
  const fp = Math.round(90 - tn);
  const fn = Math.round(90 - tp);

  // Update DOM values
  document.getElementById("cm-tp-val").innerText = tp;
  document.getElementById("cm-tn-val").innerText = tn;
  document.getElementById("cm-fp-val").innerText = fp;
  document.getElementById("cm-fn-val").innerText = fn;

  // Calculate Metrics
  const acc = ((tp + tn) / (tp + tn + fp + fn)) * 100;
  const prec = (tp / (tp + fp)) * 100;
  const rec = (tp / (tp + fn)) * 100;
  const f1 = (2 * prec * rec) / (prec + rec);

  document.getElementById("mAcc").innerText = acc.toFixed(1) + "%";
  document.getElementById("mPrec").innerText = prec.toFixed(1) + "%";
  document.getElementById("mRec").innerText = rec.toFixed(1) + "%";
  document.getElementById("mF1").innerText = f1.toFixed(1) + "%";

  document.getElementById("barAcc").style.width = acc.toFixed(1) + "%";
  document.getElementById("barPrec").style.width = prec.toFixed(1) + "%";
  document.getElementById("barRec").style.width = rec.toFixed(1) + "%";
  document.getElementById("barF1").style.width = f1.toFixed(1) + "%";
}

function drawTradeoff() {
  const canvas = document.getElementById("tradeoffChart");
  if (!canvas) return;
  const parent = canvas.parentElement;
  canvas.width = parent.clientWidth;
  canvas.height = 250;

  const ctx = canvas.getContext("2d");
  const W = canvas.width;
  const H = canvas.height;

  ctx.fillStyle = "#0c1015";
  ctx.fillRect(0, 0, W, H);

  // Render scatter chart axes
  ctx.strokeStyle = "rgba(255,255,255,0.06)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(50, 20);
  ctx.lineTo(50, H - 40);
  ctx.lineTo(W - 20, H - 40);
  ctx.stroke();

  // Axes label tags
  ctx.fillStyle = "rgba(255,255,255,0.4)";
  ctx.font = "10px JetBrains Mono";
  ctx.fillText("Speed (FPS) →", W - 100, H - 25);

  ctx.save();
  ctx.translate(20, H / 2 + 20);
  ctx.rotate(-Math.PI / 2);
  ctx.fillText("mAP @50 (%) →", 0, 0);
  ctx.restore();

  // Draw simulated data points for models
  const models = [
    {
      name: "YOLOv8-Nano",
      fps: 45,
      map: 88,
      color: "#3fb950",
      x: 50 + (W - 100) * 0.85,
      y: H - 40 - (H - 80) * 0.55,
    },
    {
      name: "YOLOv8-Small",
      fps: 32,
      map: 92,
      color: "#2f81f7",
      x: 50 + (W - 100) * 0.6,
      y: H - 40 - (H - 80) * 0.7,
    },
    {
      name: "YOLOv8-Med",
      fps: 20,
      map: 95,
      color: "#f0883e",
      x: 50 + (W - 100) * 0.35,
      y: H - 40 - (H - 80) * 0.85,
    },
    {
      name: "YOLOv11-Nano",
      fps: 25,
      map: 97,
      color: "#a371f7",
      x: 50 + (W - 100) * 0.45,
      y: H - 40 - (H - 80) * 0.94,
    },
  ];

  models.forEach((m) => {
    ctx.beginPath();
    ctx.arc(m.x, m.y, 6, 0, Math.PI * 2);
    ctx.fillStyle = m.color;
    ctx.fill();
    ctx.shadowBlur = 8;
    ctx.shadowColor = m.color;
    ctx.stroke();
    ctx.shadowBlur = 0; // reset

    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 9px Kantumruy Pro";
    ctx.fillText(m.name, m.x - 30, m.y - 12);
    ctx.fillStyle = m.color;
    ctx.font = "8px JetBrains Mono";
    ctx.fillText(`(${m.fps} FPS, ${m.map}%)`, m.x - 30, m.y + 18);
  });
}

let trainingActive = false;
let trainingEpoch = 0;
let trainingInterval = null;
let simulatedMetrics = [];

function toggleTraining() {
  const btn = document.getElementById("btnTrain");
  trainingActive = !trainingActive;

  if (trainingActive) {
    btn.innerText = "⏸ បញ្ឈប់";
    btn.classList.replace("bg-blue-600", "bg-red-600");
    trainingInterval = setInterval(simulateEpoch, 500);
  } else {
    btn.innerText = "▶ ចាប់ផ្ដើម Train";
    btn.classList.replace("bg-red-600", "bg-blue-600");
    clearInterval(trainingInterval);
  }
}

function resetTraining() {
  trainingActive = false;
  trainingEpoch = 0;
  simulatedMetrics = [];
  clearInterval(trainingInterval);
  document.getElementById("btnTrain").innerText = "▶ ចាប់ផ្ដើម Train";
  document.getElementById("btnTrain").className =
    "px-4 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded text-xs font-mono";
  document.getElementById("currentEpoch").innerText = "0";
  document.getElementById("trainingProgress").style.width = "0%";

  const lossCanvas = document.getElementById("lossChart");
  const accCanvas = document.getElementById("accuracyChart");
  lossCanvas
    .getContext("2d")
    .clearRect(0, 0, lossCanvas.width, lossCanvas.height);
  accCanvas.getContext("2d").clearRect(0, 0, accCanvas.width, accCanvas.height);
}

function simulateEpoch() {
  if (trainingEpoch >= 50) {
    clearInterval(trainingInterval);
    trainingActive = false;
    document.getElementById("btnTrain").innerText = "✓ ហ្វឹកហាត់ចប់";
    document.getElementById("btnTrain").className =
      "px-4 py-1.5 bg-green-600 text-white rounded text-xs font-mono pointer-events-none";
    return;
  }
  trainingEpoch++;
  document.getElementById("currentEpoch").innerText = trainingEpoch;
  document.getElementById("trainingProgress").style.width =
    (trainingEpoch / 50) * 100 + "%";

  // Math logic simulating training curve progression
  const loss =
    3.5 * Math.exp(-0.08 * trainingEpoch) + 0.15 + (Math.random() - 0.5) * 0.08;
  const map =
    0.52 +
    0.44 * (1 - Math.exp(-0.1 * trainingEpoch)) +
    (Math.random() - 0.5) * 0.03;

  simulatedMetrics.push({ loss, map });

  drawTrainingCurves();
}

function drawTrainingCurves() {
  const lossCanvas = document.getElementById("lossChart");
  const accCanvas = document.getElementById("accuracyChart");
  if (!lossCanvas || !accCanvas) return;

  const plot = (canvas, dataList, valueKey, label, color) => {
    canvas.width = canvas.parentElement.clientWidth;
    canvas.height = 180;
    const ctx = canvas.getContext("2d");
    const W = canvas.width;
    const H = canvas.height;

    ctx.fillStyle = "#0a0d12";
    ctx.fillRect(0, 0, W, H);

    ctx.strokeStyle = "rgba(255,255,255,0.05)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(40, 10);
    ctx.lineTo(40, H - 25);
    ctx.lineTo(W - 10, H - 25);
    ctx.stroke();

    if (dataList.length < 2) return;

    ctx.beginPath();
    ctx.lineWidth = 2;
    ctx.strokeStyle = color;

    const maxVal = valueKey === "loss" ? 4.0 : 1.0;

    dataList.forEach((point, index) => {
      const x = 40 + (index / 50) * (W - 60);
      const y = H - 25 - (point[valueKey] / maxVal) * (H - 45);
      if (index === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();

    // Display current status tags
    ctx.fillStyle = color;
    ctx.font = "9px JetBrains Mono";
    ctx.fillText(
      `${label}: ${dataList[dataList.length - 1][valueKey].toFixed(3)}`,
      W - 120,
      20,
    );
  };

  plot(lossCanvas, simulatedMetrics, "loss", "Train Loss", "#e84c4c");
  plot(accCanvas, simulatedMetrics, "map", "mAP @50", "#3fb950");
}

function showGradCam(type) {
  const canvas = document.getElementById("gradCamCanvas");
  const ctx = canvas.getContext("2d");
  const W = canvas.width;
  const H = canvas.height;

  document.getElementById("gcBtnBanana").className =
    type === "banana"
      ? "flex-1 py-2 bg-blue-600 text-white rounded text-xs font-mono"
      : "flex-1 py-2 bg-white/5 text-gray-500 rounded text-xs font-mono";
  document.getElementById("gcBtnApple").className =
    type === "apple"
      ? "flex-1 py-2 bg-blue-600 text-white rounded text-xs font-mono"
      : "flex-1 py-2 bg-white/5 text-gray-500 rounded text-xs font-mono";

  ctx.fillStyle = "#060a0f";
  ctx.fillRect(0, 0, W, H);

  if (type === "banana") {
    drawBanana(ctx, W / 2, H / 2 + 20, 1.8, 0.1);

    let heat = ctx.createRadialGradient(
      W / 2 - 20,
      H / 2,
      10,
      W / 2 - 20,
      H / 2,
      120,
    );
    heat.addColorStop(0, "rgba(235, 71, 71, 0.7)"); // Highly activated zone
    heat.addColorStop(0.4, "rgba(242, 218, 63, 0.4)"); // Mid level
    heat.addColorStop(1, "rgba(47, 129, 247, 0)"); // Cold zone
    ctx.fillStyle = heat;
    ctx.fillRect(0, 0, W, H);
  } else {
    drawApple(ctx, W / 2, H / 2 + 20, 1.5);

    let heat = ctx.createRadialGradient(W / 2, H / 2, 10, W / 2, H / 2, 110);
    heat.addColorStop(0, "rgba(235, 71, 71, 0.75)");
    heat.addColorStop(0.5, "rgba(242, 218, 63, 0.42)");
    heat.addColorStop(1, "rgba(47, 129, 247, 0)");
    ctx.fillStyle = heat;
    ctx.fillRect(0, 0, W, H);
  }

  const reportBox = document.getElementById("gcFeatureResults");
  const details =
    type === "banana"
      ? `<div>
       <div class="flex justify-between"><span>Color Activation (លឿងទុំ)</span><span class="text-green-400">92%</span></div>
       <div class="w-full h-1 bg-white/5 rounded-full mt-1 overflow-hidden"><div class="h-full bg-green-400" style="width: 92%"></div></div>
       <span class="text-[8px] text-gray-500 font-light block mt-0.5">ម៉ូដែលផ្តោតលើជួរពណ៌លឿង-ត្នោត (Hsv 40°-70°)</span>
     </div>
     <div>
       <div class="flex justify-between"><span>Shape Extraction (រាងកោង)</span><span class="text-blue-400">86%</span></div>
       <div class="w-full h-1 bg-white/5 rounded-full mt-1 overflow-hidden"><div class="h-full bg-blue-400" style="width: 86%"></div></div>
       <span class="text-[8px] text-gray-500 font-light block mt-0.5">គែមព័ទ្ធជុំវិញជាលក្ខណៈព្រះច័ន្ទមួយចំហៀង (Crescent)</span>
     </div>`
      : `<div>
       <div class="flex justify-between"><span>Color Activation (ក្រហមចាស់)</span><span class="text-green-400">96%</span></div>
       <div class="w-full h-1 bg-white/5 rounded-full mt-1 overflow-hidden"><div class="h-full bg-green-400" style="width: 96%"></div></div>
       <span class="text-[8px] text-gray-500 font-light block mt-0.5">ពណ៌ក្រហមចាស់ចាំង Specular Highlight ផ្នែកកណ្ដាល</span>
     </div>
     <div>
       <div class="flex justify-between"><span>Stem/Leaf (ទង និងស្លឹក)</span><span class="text-purple-400">74%</span></div>
       <div class="w-full h-1 bg-white/5 rounded-full mt-1 overflow-hidden"><div class="h-full bg-purple-400" style="width: 74%"></div></div>
       <span class="text-[8px] text-gray-500 font-light block mt-0.5">ការរកឃើញទង និងស្លឹកព័ទ្ធជុំវិញ lobes ខាងលើ</span>
     </div>`;

  reportBox.innerHTML = details;
}

const robotCanvas = document.getElementById("robotCanvas");
const rCtx = robotCanvas.getContext("2d");
let robotSortingActive = false;
let conveyorX = 0;
let conveyorWaste = [];
let sortedCounts = { plastic: 0, can: 0 };

function toggleRobotSorting() {
  robotSortingActive = !robotSortingActive;
  const btn = document.getElementById("btnToggleRobot");
  if (robotSortingActive) {
    btn.innerText = "⏹ បញ្ឈប់ Lab";
    btn.classList.replace("bg-blue-600", "bg-red-600");
    addLog("[TRASH LAB] Sorting simulator started.", "text-green-400");
  } else {
    btn.innerText = "▶ ចាប់ផ្ដើម Lab";
    btn.classList.replace("bg-red-600", "bg-blue-600");
    addLog("[TRASH LAB] Sorting simulator stopped.", "text-gray-500");
  }
}

function drawPlasticBottle(ctx, x, y, scale = 1) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);

  ctx.fillStyle = "rgba(47, 129, 247, 0.28)";
  ctx.strokeStyle = "#58a6ff";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(-18, -36, 36, 66, 8);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = "#2f81f7";
  ctx.fillRect(-10, -48, 20, 12);
  ctx.fillStyle = "#8b949e";
  ctx.fillRect(-12, -55, 24, 8);

  ctx.fillStyle = "rgba(255,255,255,0.28)";
  ctx.fillRect(-10, -24, 6, 42);

  ctx.fillStyle = "#c9d1d9";
  ctx.font = "bold 12px JetBrains Mono";
  ctx.fillText("PET", -12, 4);
  ctx.restore();
}

function drawCan(ctx, x, y, scale = 1) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);

  const body = ctx.createLinearGradient(-22, 0, 22, 0);
  body.addColorStop(0, "#8b949e");
  body.addColorStop(0.45, "#f0883e");
  body.addColorStop(1, "#6e7681");

  ctx.fillStyle = body;
  ctx.strokeStyle = "#f0b36d";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(-24, -34, 48, 68, 10);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = "rgba(255,255,255,0.32)";
  ctx.beginPath();
  ctx.ellipse(0, -33, 24, 7, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "rgba(0,0,0,0.25)";
  ctx.beginPath();
  ctx.ellipse(0, 34, 24, 7, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#111827";
  ctx.font = "bold 11px JetBrains Mono";
  ctx.fillText("CAN", -12, 4);
  ctx.restore();
}

function animateRobotSorting() {
  const W = robotCanvas.width;
  const H = robotCanvas.height;

  rCtx.fillStyle = "#06090e";
  rCtx.fillRect(0, 0, W, H);

  rCtx.fillStyle = "#171c24";
  rCtx.fillRect(50, H / 2 - 20, W - 100, 30);

  if (robotSortingActive) conveyorX = (conveyorX + 1.8) % 30;
  rCtx.fillStyle = "rgba(255,255,255,0.05)";
  for (let sx = 50 + conveyorX; sx < W - 50; sx += 30) {
    rCtx.fillRect(sx, H / 2 - 20, 2, 30);
  }

  rCtx.strokeStyle = "rgba(47, 129, 247, 0.4)";
  rCtx.lineWidth = 1.5;
  rCtx.setLineDash([4, 4]);
  rCtx.strokeRect(W / 2 - 80, H / 2 - 120, 160, 200);
  rCtx.setLineDash([]);

  rCtx.fillStyle = "rgba(47, 129, 247, 0.15)";
  rCtx.fillRect(W / 2 - 80, H / 2 - 120, 160, 200);

  rCtx.fillStyle = "#2f81f7";
  rCtx.font = "bold 9px JetBrains Mono";
  rCtx.fillText("VISION SENSOR PORTAL", W / 2 - 58, H / 2 - 130);

  rCtx.fillStyle = "rgba(47, 129, 247, 0.12)";
  rCtx.strokeStyle = "#2f81f7";
  rCtx.fillRect(100, H - 100, 150, 80);
  rCtx.strokeRect(100, H - 100, 150, 80);
  rCtx.fillStyle = "#58a6ff";
  rCtx.font = "bold 11px Kantumruy Pro";
  rCtx.fillText("♻️ Plastic Bin", 128, H - 60);

  rCtx.fillStyle = "rgba(240, 136, 62, 0.12)";
  rCtx.strokeStyle = "#f0883e";
  rCtx.fillRect(W - 250, H - 100, 150, 80);
  rCtx.strokeRect(W - 250, H - 100, 150, 80);
  rCtx.fillStyle = "#f0b36d";
  rCtx.fillText("🥫 Can Bin", W - 218, H - 60);

  if (robotSortingActive && Math.random() > 0.993) {
    conveyorWaste.push({
      type: Math.random() > 0.5 ? "plastic" : "can",
      x: 60,
      y: H / 2 - 5,
      detected: false,
      sorted: false,
    });
  }

  conveyorWaste.forEach((item) => {
    if (robotSortingActive && !item.sorted) item.x += 1.8;

    if (item.type === "plastic") drawPlasticBottle(rCtx, item.x, item.y, 0.7);
    else drawCan(rCtx, item.x, item.y, 0.66);

    if (item.x > W / 2 - 30 && item.x < W / 2 + 30 && !item.detected) {
      item.detected = true;
      actuateMechanicalArm(item.type);
    }

    if (item.detected && !item.sorted) {
      if (item.type === "plastic" && item.x > 175) {
        item.sorted = true;
        animateDrop(item, 175, H - 100 + 40, "plastic");
      } else if (item.type === "can" && item.x > W - 175) {
        item.sorted = true;
        animateDrop(item, W - 175, H - 100 + 40, "can");
      }
    }
  });

  requestAnimationFrame(animateRobotSorting);
}

function actuateMechanicalArm(type) {
  if (type === "plastic") {
    document.getElementById("servoA_angle").innerText = "90° (Active)";
    document.getElementById("servoA_bar").style.width = "100%";
    setTimeout(() => {
      document.getElementById("servoA_angle").innerText = "0° (Standby)";
      document.getElementById("servoA_bar").style.width = "0%";
    }, 1200);
  } else {
    document.getElementById("servoB_angle").innerText = "90° (Active)";
    document.getElementById("servoB_bar").style.width = "100%";
    setTimeout(() => {
      document.getElementById("servoB_angle").innerText = "0° (Standby)";
      document.getElementById("servoB_bar").style.width = "0%";
    }, 1200);
  }
}

function animateDrop(wasteObj, targetX, targetY, type) {
  let step = 0;
  const timer = setInterval(() => {
    step += 0.1;
    wasteObj.x = wasteObj.x + (targetX - wasteObj.x) * 0.3;
    wasteObj.y = wasteObj.y + (targetY - wasteObj.y) * 0.3;

    if (step >= 1.0) {
      clearInterval(timer);
      sortedCounts[type]++;
      document.getElementById("robotPlasticSorted").innerText =
        sortedCounts.plastic;
      document.getElementById("robotCanSorted").innerText = sortedCounts.can;
      document.getElementById("robotAccuracy").innerText = "100%";

      conveyorWaste = conveyorWaste.filter((item) => item !== wasteObj);
    }
  }, 35);
}

const cityCvs = document.getElementById("cityCanvas");
const cityCtx = cityCvs.getContext("2d");
const cityCars = [
  { x: 90, y: 270, w: 54, h: 20, color: "#2f81f7", speed: 1.15 },
  { x: 260, y: 305, w: 48, h: 18, color: "#f0883e", speed: 0.9 },
  { x: 620, y: 285, w: 56, h: 20, color: "#3fb950", speed: 1.3 },
];
const citySignals = [
  { x: 220, y: 230, state: "green" },
  { x: 530, y: 240, state: "amber" },
  { x: 820, y: 225, state: "red" },
];
const cityDots = Array.from({ length: 16 }, (_, i) => ({
  x: 60 + ((i * 61) % 900),
  y: 40 + (i % 5) * 30,
  pulse: 0.4 + (i % 4) * 0.12,
}));

function initCityDashboard() {
  cityCvs.dataset.ready = "true";
}

function renderCity() {
  if (activePage !== "smartcity") {
    requestAnimationFrame(renderCity);
    return;
  }

  const W = cityCvs.width;
  const H = cityCvs.height;

  cityCtx.fillStyle = "#071018";
  cityCtx.fillRect(0, 0, W, H);

  const sky = cityCtx.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0, "#0a1624");
  sky.addColorStop(0.7, "#0c1119");
  sky.addColorStop(1, "#05070b");
  cityCtx.fillStyle = sky;
  cityCtx.fillRect(0, 0, W, H);

  cityCtx.fillStyle = "rgba(47, 129, 247, 0.1)";
  for (let i = 0; i < 7; i++) {
    cityCtx.fillRect(70 + i * 130, 80 + (i % 3) * 20, 2, 280);
  }

  const skyline = [
    { x: 50, y: 150, w: 120, h: 170, color: "#10253a" },
    { x: 170, y: 110, w: 130, h: 210, color: "#13283e" },
    { x: 315, y: 80, w: 160, h: 240, color: "#172f48" },
    { x: 490, y: 130, w: 110, h: 190, color: "#102134" },
    { x: 620, y: 95, w: 140, h: 225, color: "#16304b" },
    { x: 775, y: 120, w: 180, h: 200, color: "#11263a" },
  ];

  skyline.forEach((b, i) => {
    cityCtx.fillStyle = b.color;
    cityCtx.fillRect(b.x, b.y, b.w, b.h);
    cityCtx.fillStyle = "rgba(255,255,255,0.08)";
    for (let y = b.y + 18; y < b.y + b.h - 12; y += 24) {
      for (let x = b.x + 10; x < b.x + b.w - 10; x += 18) {
        cityCtx.fillStyle =
          (x + y + i) % 3 === 0
            ? "rgba(245,200,66,0.7)"
            : "rgba(47,129,247,0.35)";
        cityCtx.fillRect(x, y, 8, 12);
      }
    }
  });

  cityCtx.fillStyle = "rgba(255,255,255,0.05)";
  cityCtx.fillRect(0, H - 95, W, 95);
  cityCtx.fillStyle = "#0d1117";
  cityCtx.fillRect(0, H - 82, W, 82);

  cityCtx.strokeStyle = "rgba(255,255,255,0.08)";
  cityCtx.lineWidth = 2;
  cityCtx.beginPath();
  cityCtx.moveTo(0, H - 55);
  cityCtx.lineTo(W, H - 55);
  cityCtx.stroke();

  cityCtx.strokeStyle = "rgba(47,129,247,0.35)";
  cityCtx.lineWidth = 4;
  cityCtx.beginPath();
  cityCtx.moveTo(0, H - 55);
  cityCtx.lineTo(W, H - 55);
  cityCtx.stroke();

  cityCtx.strokeStyle = "rgba(255,255,255,0.04)";
  cityCtx.lineWidth = 1;
  for (let x = 40; x < W; x += 90) {
    cityCtx.setLineDash([18, 14]);
    cityCtx.beginPath();
    cityCtx.moveTo(x, H - 55);
    cityCtx.lineTo(x + 40, H - 55);
    cityCtx.stroke();
  }
  cityCtx.setLineDash([]);

  cityCars.forEach((car, index) => {
    car.x += car.speed;
    if (car.x > W + 80) car.x = -90;

    cityCtx.save();
    cityCtx.translate(car.x, car.y);
    cityCtx.fillStyle = car.color;
    cityCtx.fillRect(-car.w / 2, -car.h / 2, car.w, car.h);
    cityCtx.fillRect(-car.w / 4, -car.h / 2 - 10, car.w / 2, 10);
    cityCtx.fillStyle = "#c9d1d9";
    cityCtx.fillRect(-car.w / 2 + 8, -car.h / 2 + 3, 12, 6);
    cityCtx.fillRect(car.w / 2 - 20, -car.h / 2 + 3, 12, 6);
    cityCtx.fillStyle = "rgba(0,0,0,0.35)";
    cityCtx.beginPath();
    cityCtx.arc(-car.w / 3, car.h / 2 - 1, 6, 0, Math.PI * 2);
    cityCtx.arc(car.w / 3, car.h / 2 - 1, 6, 0, Math.PI * 2);
    cityCtx.fill();
    cityCtx.restore();

    cityCtx.fillStyle = "rgba(47,129,247,0.22)";
    cityCtx.fillRect(car.x - car.w / 2, car.y + 12, car.w, 6);
  });

  citySignals.forEach((signal) => {
    cityCtx.fillStyle = "#1f2937";
    cityCtx.fillRect(signal.x, signal.y, 10, 42);
    cityCtx.fillRect(signal.x - 8, signal.y - 8, 26, 12);

    cityCtx.fillStyle =
      signal.state === "green"
        ? "#3fb950"
        : signal.state === "amber"
          ? "#f5c842"
          : "#e84c4c";
    cityCtx.beginPath();
    cityCtx.arc(signal.x + 5, signal.y + 10, 4, 0, Math.PI * 2);
    cityCtx.arc(signal.x + 5, signal.y + 21, 4, 0, Math.PI * 2);
    cityCtx.arc(signal.x + 5, signal.y + 32, 4, 0, Math.PI * 2);
    cityCtx.fill();
  });

  cityDots.forEach((dot, i) => {
    const pulse = 0.5 + Math.sin(Date.now() / 500 + i) * 0.15;
    cityCtx.fillStyle = `rgba(63, 185, 80, ${dot.pulse * pulse})`;
    cityCtx.beginPath();
    cityCtx.arc(dot.x, dot.y, 3 + pulse * 2, 0, Math.PI * 2);
    cityCtx.fill();
  });

  cityCtx.fillStyle = "#cbd5e1";
  cityCtx.font = "bold 11px Kantumruy Pro";
  cityCtx.fillText("TRAFFIC FLOW", 26, 24);
  cityCtx.fillText("AQI: 42", 26, 42);
  cityCtx.fillText("STREETLIGHTS: ONLINE", 26, 60);

  cityCtx.fillStyle = "rgba(59, 185, 80, 0.9)";
  cityCtx.fillRect(780, 26, 180, 56);
  cityCtx.fillStyle = "#04120a";
  cityCtx.fillText("CITY HEALTH: STABLE", 798, 58);

  requestAnimationFrame(renderCity);
}

function initEdgeDashboard() {
  const edgeCPU = document.getElementById("edgeCPU");
  const edgeTemp = document.getElementById("edgeTemp");
  const edgeRAM = document.getElementById("edgeRAM");
  const edgePower = document.getElementById("edgePower");

  const cpuBar = document.getElementById("edgeCPU_bar");
  const tempBar = document.getElementById("edgeTemp_bar");
  const ramBar = document.getElementById("edgeRAM_bar");
  const powerBar = document.getElementById("edgePower_bar");

  setInterval(() => {
    if (activePage !== "edge") return;

    const cpuVal = Math.round(35 + Math.random() * 25);
    const tempVal = (50.1 + Math.random() * 8).toFixed(1);
    const ramVal = (1.9 + Math.random() * 0.4).toFixed(1);
    const powerVal = (3.2 + Math.random() * 1.1).toFixed(1);

    edgeCPU.innerText = cpuVal + "%";
    edgeTemp.innerText = tempVal + "°C";
    edgeRAM.innerText = ramVal + " GB";
    edgePower.innerText = powerVal + "W";

    cpuBar.style.width = cpuVal + "%";
    tempBar.style.width = (parseFloat(tempVal) / 80) * 100 + "%";
    ramBar.style.width = (parseFloat(ramVal) / 4) * 100 + "%";
    powerBar.style.width = (parseFloat(powerVal) / 6) * 100 + "%";
  }, 1500);

  drawLatencyProfile();
}

function drawLatencyProfile() {
  const canvas = document.getElementById("latencyChart");
  if (!canvas) return;
  canvas.width = canvas.parentElement.clientWidth;
  canvas.height = 150;

  const ctx = canvas.getContext("2d");
  const W = canvas.width;
  const H = canvas.height;

  ctx.fillStyle = "#0a0d12";
  ctx.fillRect(0, 0, W, H);

  ctx.strokeStyle = "#2f81f7";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(10, H - 40);

  for (let x = 10; x < W - 10; x += 15) {
    let randomLatency = H - 40 - (Math.random() * 35 + 15);
    ctx.lineTo(x, randomLatency);
  }
  ctx.stroke();

  ctx.fillStyle = "rgba(255,255,255,0.4)";
  ctx.font = "9px JetBrains Mono";
  ctx.fillText(
    "Model Latency Benchmark: ~22ms/frame on INT8 Quantized model",
    15,
    H - 10,
  );
}

function sendMockIotMessage() {
  const logs = document.getElementById("iotLogs");
  const bCount = counts.banana;
  const aCount = counts.apple;

  document.getElementById("iotJsonBanana").innerText = bCount;
  document.getElementById("iotJsonApple").innerText = aCount;

  const div = document.createElement("div");
  div.className = "text-yellow-400 mt-1";
  div.innerText = `[PUBLISH] Topic: fruitai/detections -> payload: {"banana": ${bCount}, "apple": ${aCount}}`;
  logs.prepend(div);
}

function clearIotLogs() {
  const logs = document.getElementById("iotLogs");
  logs.innerHTML =
    '<div class="text-green-400">[CONNECT] Reconnected to hivemq broker.</div>';
}

window.onload = async () => {
  applyTheme(localStorage.getItem("smartCityTheme") || "dark");
  await loadPageFragments();
  renderDetection();
  renderCollectStudio();
  renderCity();
  updateConfusionMatrixLogic();
  animateRobotSorting();
  nav("guide"); // ចាប់ផ្ដើមដោយ Project Guide
  addLog(
    "ប្រព័ន្ធ Smart City AI ត្រូវបានកំណត់រចនាសម្ព័ន្ធរួចរាល់។",
    "text-green-400",
  );

  initializeAPIConnection();
};

const API_BASE_URL =
  window.location.protocol === "file:" ? "http://localhost:8000" : "";

// Check API connection status
function checkAPIStatus() {
  const statusDot = document.getElementById("apiStatus");
  if (!statusDot) return;

  fetch(`${API_BASE_URL}/api/stats`)
    .then((response) => response.json())
    .then((data) => {
      statusDot.style.background = "var(--green)";
      updateAPIStats(data);
    })
    .catch((error) => {
      console.log("API Connection Error:", error);
      statusDot.style.background = "#f97316";
    });
}

// Update live stats from backend
function updateAPIStats(stats) {
  const banana = document.getElementById("apiStatsBanana");
  const apple = document.getElementById("apiStatsApple");
  const orange = document.getElementById("apiStatsOrange");
  if (banana) banana.innerText = stats.banana || "0";
  if (apple) apple.innerText = stats.apple || "0";
  if (orange) orange.innerText = stats.orange || "0";
}

// Initialize API connection and polling
function initializeAPIConnection() {
  checkAPIStatus();
  if (apiStatusTimer) clearInterval(apiStatusTimer);
  apiStatusTimer = setInterval(checkAPIStatus, 1000); // Poll every 1 second
}
