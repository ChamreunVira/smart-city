// ── DRONE LEARNING LAB — Three.js Flight Simulator ──────────────
// Mirrors the structure of rc-car-simulator.js / smart-parking-simulator.js:
// an init function called by loader.js's initializePage('drone'), plus
// toggle/reset/control functions wired to onclick handlers in drone.html.

let droneInitialized = false;
let droneSimActive = false;
let droneHoverLock = false;
let droneMaxSpeedSetting = 60;

let droneRenderer = null;
let droneScene = null;
let droneCamera = null;
let droneMesh = null;
let droneRotor1, droneRotor2, droneRotor3, droneRotor4;
let droneAnimHandle = null;
let droneResizeObserver = null;

const droneState = {
  x: 0,
  y: 8,
  z: 0,
  heading: 0, // radians
  vx: 0,
  vy: 0,
  vz: 0,
  speed: 0,
  battery: 100,
  distanceTotal: 0,
};

const droneControls = {
  forward: false,
  back: false,
  left: false,
  right: false,
  up: false,
  down: false,
};

let droneLastFrameTime = null;
let droneFpsSmoothed = 60;

// ── LOGGER (scoped so it never collides with the main addLog) ──
function droneLog(msg, colorClass) {
  const box = document.getElementById("droneLogBox");
  if (!box) return;
  const div = document.createElement("div");
  div.className = colorClass || "text-gray-400";
  div.innerText = `[${new Date().toLocaleTimeString()}] ${msg}`;
  box.prepend(div);
  if (box.children.length > 25) box.lastChild.remove();
}

// ── ENTRY POINT (called by loader.js -> initializePage('drone')) ──
function initDroneLab() {
  const mount = document.getElementById("droneSceneMount");
  if (!mount) return;

  // If the page was revisited, the old renderer DOM node is gone (innerHTML
  // was replaced), so rebuild the scene fresh every time this page mounts.
  teardownDroneScene();
  buildDroneScene(mount);
  attachDroneKeyboardControls();
  droneLog("Drone Lab 3D engine initialized (Three.js).", "text-blue-400");
}

function buildDroneScene(mount) {
  const width = mount.clientWidth || 800;
  const height = mount.clientHeight || 450;

  droneScene = new THREE.Scene();
  droneScene.background = new THREE.Color(0x070a10);
  droneScene.fog = new THREE.Fog(0x070a10, 60, 220);

  droneCamera = new THREE.PerspectiveCamera(60, width / height, 0.1, 1000);
  droneCamera.position.set(0, 14, 26);
  droneCamera.lookAt(0, 6, 0);

  droneRenderer = new THREE.WebGLRenderer({ antialias: true });
  droneRenderer.setSize(width, height);
  droneRenderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  mount.innerHTML = "";
  mount.appendChild(droneRenderer.domElement);

  // Lighting
  const hemi = new THREE.HemisphereLight(0x3a6ea5, 0x0a0d12, 0.9);
  droneScene.add(hemi);
  const sun = new THREE.DirectionalLight(0xffffff, 0.8);
  sun.position.set(30, 50, 20);
  droneScene.add(sun);

  // Ground grid (training field)
  const grid = new THREE.GridHelper(220, 44, 0x2f81f7, 0x1a2230);
  grid.position.y = 0;
  droneScene.add(grid);

  const groundGeo = new THREE.PlaneGeometry(220, 220);
  const groundMat = new THREE.MeshStandardMaterial({
    color: 0x0b0f16,
    roughness: 1,
    metalness: 0,
  });
  const ground = new THREE.Mesh(groundGeo, groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.05;
  droneScene.add(ground);

  // Waypoint markers (visual training field reference)
  const markerGeo = new THREE.CylinderGeometry(1.4, 1.4, 0.15, 24);
  const markerMat = new THREE.MeshStandardMaterial({
    color: 0xf0883e,
    emissive: 0xf0883e,
    emissiveIntensity: 0.25,
  });
  const markerPositions = [
    [20, 0.1, 20],
    [-20, 0.1, 20],
    [20, 0.1, -20],
    [-20, 0.1, -20],
  ];
  markerPositions.forEach((p) => {
    const m = new THREE.Mesh(markerGeo, markerMat);
    m.position.set(p[0], p[1], p[2]);
    droneScene.add(m);
  });

  // Build the drone mesh
  droneMesh = buildDroneMesh();
  droneMesh.position.set(droneState.x, droneState.y, droneState.z);
  droneScene.add(droneMesh);

  // Keep canvas responsive to container size changes
  if (window.ResizeObserver) {
    droneResizeObserver = new ResizeObserver(() => {
      if (!droneRenderer || !droneCamera || !mount) return;
      const w = mount.clientWidth || width;
      const h = mount.clientHeight || height;
      droneRenderer.setSize(w, h);
      droneCamera.aspect = w / h;
      droneCamera.updateProjectionMatrix();
    });
    droneResizeObserver.observe(mount);
  }

  droneInitialized = true;
  droneLastFrameTime = null;
  droneAnimHandle = requestAnimationFrame(droneRenderLoop);
}

function buildDroneMesh() {
  const group = new THREE.Group();

  // Central body
  const bodyGeo = new THREE.BoxGeometry(1.6, 0.45, 1.6);
  const bodyMat = new THREE.MeshStandardMaterial({
    color: 0x1f2733,
    metalness: 0.4,
    roughness: 0.35,
  });
  const body = new THREE.Mesh(bodyGeo, bodyMat);
  group.add(body);

  // Status LED (front indicator so heading is visible)
  const ledGeo = new THREE.SphereGeometry(0.12, 12, 12);
  const ledMat = new THREE.MeshStandardMaterial({
    color: 0x3fb950,
    emissive: 0x3fb950,
    emissiveIntensity: 1.2,
  });
  const led = new THREE.Mesh(ledGeo, ledMat);
  led.position.set(0, 0.1, 0.95);
  group.add(led);

  // Arms + rotors (4 corners)
  const armGeo = new THREE.BoxGeometry(2.2, 0.12, 0.18);
  const armMat = new THREE.MeshStandardMaterial({
    color: 0x2f3a4a,
    metalness: 0.3,
    roughness: 0.5,
  });

  const arm1 = new THREE.Mesh(armGeo, armMat);
  arm1.rotation.y = Math.PI / 4;
  group.add(arm1);

  const arm2 = new THREE.Mesh(armGeo, armMat);
  arm2.rotation.y = -Math.PI / 4;
  group.add(arm2);

  const rotorGeo = new THREE.CylinderGeometry(0.55, 0.55, 0.04, 16);
  const rotorMat = new THREE.MeshStandardMaterial({
    color: 0x58a6ff,
    transparent: true,
    opacity: 0.55,
  });

  const offsets = [
    [1.1, 1.1],
    [1.1, -1.1],
    [-1.1, 1.1],
    [-1.1, -1.1],
  ];

  const rotors = offsets.map((o) => {
    const r = new THREE.Mesh(rotorGeo, rotorMat);
    r.position.set(o[0], 0.18, o[1]);
    group.add(r);
    return r;
  });
  [droneRotor1, droneRotor2, droneRotor3, droneRotor4] = rotors;

  // Small landing legs
  const legGeo = new THREE.CylinderGeometry(0.04, 0.04, 0.5, 8);
  const legMat = new THREE.MeshStandardMaterial({ color: 0x11161d });
  [
    [0.7, -0.45, 0.7],
    [-0.7, -0.45, 0.7],
    [0.7, -0.45, -0.7],
    [-0.7, -0.45, -0.7],
  ].forEach((p) => {
    const leg = new THREE.Mesh(legGeo, legMat);
    leg.position.set(p[0], p[1], p[2]);
    group.add(leg);
  });

  group.userData.rotors = rotors;
  return group;
}

function teardownDroneScene() {
  if (droneAnimHandle) {
    cancelAnimationFrame(droneAnimHandle);
    droneAnimHandle = null;
  }
  if (droneResizeObserver) {
    droneResizeObserver.disconnect();
    droneResizeObserver = null;
  }
  if (droneRenderer) {
    droneRenderer.dispose();
    droneRenderer = null;
  }
  droneScene = null;
  droneCamera = null;
  droneMesh = null;
  droneInitialized = false;
}

// ── RENDER LOOP ──────────────────────────────────────────────────
function droneRenderLoop(timestamp) {
  if (!droneRenderer || !droneScene || !droneCamera) return; // page navigated away

  if (droneLastFrameTime === null) droneLastFrameTime = timestamp;
  const dt = Math.min((timestamp - droneLastFrameTime) / 1000, 0.1);
  droneLastFrameTime = timestamp;

  const instFps = dt > 0 ? 1 / dt : 60;
  droneFpsSmoothed = droneFpsSmoothed * 0.9 + instFps * 0.1;
  const fpsLabel = document.getElementById("droneFpsDisplay");
  if (fpsLabel) fpsLabel.innerText = `FPS: ${droneFpsSmoothed.toFixed(1)}`;

  updateDronePhysics(dt);
  spinDroneRotors(dt);

  droneMesh.position.set(droneState.x, droneState.y, droneState.z);
  droneMesh.rotation.y = droneState.heading;

  // Chase camera that trails slightly behind heading
  const camDist = 16;
  const camHeight = 9;
  const camX = droneState.x - Math.sin(droneState.heading) * camDist;
  const camZ = droneState.z - Math.cos(droneState.heading) * camDist;
  droneCamera.position.lerp(
    new THREE.Vector3(camX, droneState.y + camHeight, camZ),
    0.06,
  );
  droneCamera.lookAt(droneState.x, droneState.y + 1, droneState.z);

  droneRenderer.render(droneScene, droneCamera);
  updateDroneTelemetryUI();

  droneAnimHandle = requestAnimationFrame(droneRenderLoop);
}

function spinDroneRotors(dt) {
  if (!droneMesh || !droneMesh.userData.rotors) return;
  const spinSpeed = droneSimActive ? 40 : 6; // idle vs active spin rate
  droneMesh.userData.rotors.forEach((r) => {
    r.rotation.y += spinSpeed * dt;
  });
}

// ── PHYSICS / CONTROL INTEGRATION ───────────────────────────────
function updateDronePhysics(dt) {
  if (!droneSimActive) return;

  const accel = 6 * (droneMaxSpeedSetting / 60);
  const maxSpeed = 9 * (droneMaxSpeedSetting / 60);
  const damping = droneHoverLock ? 0.92 : 0.985;
  const turnRate = 1.6;

  if (droneControls.left) droneState.heading += turnRate * dt;
  if (droneControls.right) droneState.heading -= turnRate * dt;

  const forwardX = Math.sin(droneState.heading);
  const forwardZ = Math.cos(droneState.heading);

  if (droneControls.forward) {
    droneState.vx += forwardX * accel * dt;
    droneState.vz += forwardZ * accel * dt;
  }
  if (droneControls.back) {
    droneState.vx -= forwardX * accel * dt;
    droneState.vz -= forwardZ * accel * dt;
  }
  if (droneControls.up) droneState.vy += accel * dt;
  if (droneControls.down) droneState.vy -= accel * dt;

  // Damping / drag
  droneState.vx *= damping;
  droneState.vz *= damping;
  droneState.vy *= damping;

  // Clamp horizontal speed
  const horizSpeed = Math.sqrt(droneState.vx ** 2 + droneState.vz ** 2);
  if (horizSpeed > maxSpeed) {
    const scale = maxSpeed / horizSpeed;
    droneState.vx *= scale;
    droneState.vz *= scale;
  }

  const prevX = droneState.x;
  const prevZ = droneState.z;

  droneState.x += droneState.vx * dt;
  droneState.z += droneState.vz * dt;
  droneState.y += droneState.vy * dt;

  // Altitude floor / soft ceiling
  if (droneState.y < 1.2) {
    droneState.y = 1.2;
    droneState.vy = 0;
  }
  if (droneState.y > 60) {
    droneState.y = 60;
    droneState.vy = 0;
  }

  // Keep within the training field bounds
  const bound = 95;
  droneState.x = Math.max(-bound, Math.min(bound, droneState.x));
  droneState.z = Math.max(-bound, Math.min(bound, droneState.z));

  const stepDist = Math.sqrt(
    (droneState.x - prevX) ** 2 + (droneState.z - prevZ) ** 2,
  );
  droneState.distanceTotal += stepDist;

  droneState.speed = Math.sqrt(
    droneState.vx ** 2 + droneState.vy ** 2 + droneState.vz ** 2,
  );

  // Battery slowly drains while active, faster while moving
  const drain = 0.02 + droneState.speed * 0.01;
  droneState.battery = Math.max(0, droneState.battery - drain * dt);
  if (droneState.battery <= 0 && droneSimActive) {
    droneLog("Battery depleted — landing initiated.", "text-orange-400");
    toggleDroneSimulation();
  }
}

// ── TELEMETRY UI ─────────────────────────────────────────────────
function updateDroneTelemetryUI() {
  const altEl = document.getElementById("drone_altitude");
  const altBar = document.getElementById("drone_altitude_bar");
  const speedEl = document.getElementById("drone_speed");
  const speedBar = document.getElementById("drone_speed_bar");
  const headingEl = document.getElementById("drone_heading");
  const headingBar = document.getElementById("drone_heading_bar");
  const battEl = document.getElementById("drone_battery");
  const signalEl = document.getElementById("drone_signal");
  const gpsEl = document.getElementById("drone_gps");
  const distEl = document.getElementById("drone_distance_total");
  const modeLabel = document.getElementById("droneModeLabel");

  if (altEl) altEl.innerText = `${droneState.y.toFixed(1)} m`;
  if (altBar)
    altBar.style.width = `${Math.min(100, (droneState.y / 60) * 100)}%`;

  if (speedEl) speedEl.innerText = `${droneState.speed.toFixed(1)} m/s`;
  if (speedBar)
    speedBar.style.width = `${Math.min(100, (droneState.speed / 10) * 100)}%`;

  const headingDeg = ((droneState.heading * 180) / Math.PI) % 360;
  const normalizedDeg = headingDeg < 0 ? headingDeg + 360 : headingDeg;
  if (headingEl) headingEl.innerText = `${normalizedDeg.toFixed(0)}°`;
  if (headingBar)
    headingBar.style.width = `${(normalizedDeg / 360) * 100}%`;

  if (battEl) battEl.innerText = `${droneState.battery.toFixed(0)}%`;
  if (signalEl) {
    const dist = Math.sqrt(droneState.x ** 2 + droneState.z ** 2);
    const dbm = Math.round(-38 - dist * 0.3);
    signalEl.innerText = `${dbm} dBm`;
  }
  if (gpsEl)
    gpsEl.innerText = `${droneState.x.toFixed(1)}, ${droneState.z.toFixed(1)}`;
  if (distEl) distEl.innerText = `${droneState.distanceTotal.toFixed(1)} m`;
  if (modeLabel)
    modeLabel.innerText = droneSimActive
      ? droneHoverLock
        ? "HOVER LOCK"
        : "FLIGHT"
      : "STANDBY";
}

// ── BUTTON / TOGGLE HANDLERS (called from drone.html onclick) ───
function toggleDroneSimulation() {
  droneSimActive = !droneSimActive;
  const btn = document.getElementById("btnToggleDrone");
  const btnText = document.getElementById("droneBtnText");
  const btnIcon = document.getElementById("droneBtnIconEl");

  if (droneSimActive) {
    if (btnText) btnText.innerText = "បញ្ឈប់ Lab";
    if (btnIcon) btnIcon.className = "ti ti-player-pause";
    if (btn) btn.classList.add("border-white/30");
    droneLog("Flight simulation started. Rotors spun up.", "text-green-400");
  } else {
    if (btnText) btnText.innerText = "ចាប់ផ្ដើម Lab";
    if (btnIcon) btnIcon.className = "ti ti-player-play";
    if (btn) btn.classList.remove("border-white/30");
    droneState.vx = 0;
    droneState.vy = 0;
    droneState.vz = 0;
    droneLog("Flight simulation stopped.", "text-gray-500");
  }
}

function droneToggleHover() {
  droneHoverLock = !droneHoverLock;
  const btn = document.getElementById("droneHoverBtn");
  if (btn) {
    btn.innerHTML = droneHoverLock
      ? '<i class="ti ti-circle-dot" aria-hidden="true"></i> បិទ Hover Lock'
      : '<i class="ti ti-circle-dot" aria-hidden="true"></i> បើក Hover Lock';
  }
  droneLog(
    droneHoverLock ? "Hover Lock engaged." : "Hover Lock disengaged.",
    "text-blue-400",
  );
}

function resetDroneState() {
  droneState.x = 0;
  droneState.y = 8;
  droneState.z = 0;
  droneState.heading = 0;
  droneState.vx = 0;
  droneState.vy = 0;
  droneState.vz = 0;
  droneState.speed = 0;
  droneState.battery = 100;
  droneState.distanceTotal = 0;
  droneSimActive = false;

  const btnText = document.getElementById("droneBtnText");
  const btnIcon = document.getElementById("droneBtnIconEl");
  if (btnText) btnText.innerText = "ចាប់ផ្ដើម Lab";
  if (btnIcon) btnIcon.className = "ti ti-player-play";

  droneLog("Drone state reset to home position.", "text-orange-400");
}

// ── ON-SCREEN BUTTON CONTROLS (mouse/touch) ─────────────────────
const droneControlKeyMap = {
  forward: "forward",
  back: "back",
  left: "left",
  right: "right",
  up: "up",
  down: "down",
};

function droneStartControl(action) {
  if (droneControlKeyMap[action] !== undefined) {
    droneControls[action] = true;
  }
}

function droneStopControl(action) {
  if (droneControlKeyMap[action] !== undefined) {
    droneControls[action] = false;
  }
}

// ── KEYBOARD CONTROLS (WASD + QE) ───────────────────────────────
let droneKeyboardAttached = false;

function attachDroneKeyboardControls() {
  if (droneKeyboardAttached) return;
  droneKeyboardAttached = true;

  document.addEventListener("keydown", droneHandleKeyDown);
  document.addEventListener("keyup", droneHandleKeyUp);
}

function droneIsTypingTarget(target) {
  if (!target) return false;
  const tag = target.tagName ? target.tagName.toLowerCase() : "";
  return tag === "input" || tag === "textarea" || target.isContentEditable;
}

function droneHandleKeyDown(e) {
  if (window.activePage !== "drone") return;
  if (droneIsTypingTarget(e.target)) return;

  switch (e.key.toLowerCase()) {
    case "w":
      droneControls.forward = true;
      break;
    case "s":
      droneControls.back = true;
      break;
    case "a":
      droneControls.left = true;
      break;
    case "d":
      droneControls.right = true;
      break;
    case "q":
      droneControls.up = true;
      break;
    case "e":
      droneControls.down = true;
      break;
    default:
      return;
  }
  e.preventDefault();
}

function droneHandleKeyUp(e) {
  if (window.activePage !== "drone") return;

  switch (e.key.toLowerCase()) {
    case "w":
      droneControls.forward = false;
      break;
    case "s":
      droneControls.back = false;
      break;
    case "a":
      droneControls.left = false;
      break;
    case "d":
      droneControls.right = false;
      break;
    case "q":
      droneControls.up = false;
      break;
    case "e":
      droneControls.down = false;
      break;
    default:
      return;
  }
}