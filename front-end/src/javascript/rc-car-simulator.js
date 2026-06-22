// ============================================================
// RC CAR SIMULATOR — Enhanced with AI Training (Q-Learning)
// ============================================================

let rcRunning = false;
let rcAutoMode = false;
let rcDeliveryActive = false;
let rcMaxThrottle = 60;
let rcAnimId = null;
let rcEpochCount = 0;
let rcTrainingActive = false;
let rcTotalReward = 0;

const rcCar = {
    x: 400, y: 225,
    heading: 0,
    speed: 0,
    steer: 0,
    totalDist: 0,
    obstacles: []
};

const rcControls = { forward: false, reverse: false, left: false, right: false, brake: false };

// --- Q-Learning State ---
const rcActions = ['forward', 'left', 'right', 'brake'];
let rcQTable = {};
let rcEpsilon = 0.3;
const rcLearningRate = 0.1;
const rcDiscountFactor = 0.9;
let rcEpisode = 0;

// --- Delivery State ---
let rcDeliveryState = 'IDLE';
let rcOrder = null;
let rcDeliveries = 0;
let rcEarnings = 0;
let rcRestaurantPoint = null;
let rcCustomerPoint = null;
let rcDeliveryTimer = 0;

const rcRestaurants = ['Golden Wok', 'Angkor Grill', 'Pizza Corner', 'Noodle House', 'Burger Lab'];
const rcCustomers = ['Sokha (BKK1)', 'Vibol (Toul Kork)', 'Dara (Riverside)', 'Sreypich (Chamkar Mon)', 'Rotana (Sen Sok)'];
const rcFoodItems = ['គុយទាវសាច់គោ', 'បាយឆាខ្ញី', 'Pizza Pepperoni', 'Burger Combo', 'កាហ្វេទឹកដោះគោ', 'Mango Sticky Rice'];

// --- DOM Refs ---
let rcCanvas, rcCtx;

// --- Initialization ---
function initRCCar() {
    rcCanvas = document.getElementById('rcCarCanvas');
    if (!rcCanvas) return;
    rcCtx = rcCanvas.getContext('2d');
    
    // Reset state
    rcCar.x = 400;
    rcCar.y = 225;
    rcCar.heading = 0;
    rcCar.speed = 0;
    rcCar.steer = 0;
    rcCar.totalDist = 0;
    rcCar.obstacles = [];
    
    rcLog('RC Car Lab initialized', 'text-blue-400');
    rcLog('ESP32-CAM & Motor Driver Link ready', 'text-green-400');
    
    // Draw initial state
    drawRCCar();
}

// --- Logging ---
function rcLog(msg, cls = 'text-gray-400') {
    const box = document.getElementById('rcLogBox');
    if (!box) return;
    const line = document.createElement('div');
    line.className = cls;
    line.textContent = '[ESP32-CAM] ' + msg;
    box.appendChild(line);
    box.scrollTop = box.scrollHeight;
    if (box.children.length > 30) box.removeChild(box.firstChild);
}

function rcAiSay(msg) {
    const box = document.getElementById('rcAiChatLog');
    if (!box) return;
    if (box.querySelector('.italic')) box.innerHTML = '';
    const line = document.createElement('div');
    line.className = 'text-emerald-300';
    line.textContent = '🤖 ' + msg;
    box.appendChild(line);
    box.scrollTop = box.scrollHeight;
    if (box.children.length > 15) box.removeChild(box.firstChild);
}

// --- Controls ---
function rcStartControl(action) {
    if (rcAutoMode || rcDeliveryActive) return;
    rcControls[action] = true;
}

function rcStopControl(action) {
    rcControls[action] = false;
}

// --- Keyboard (defined in global) ---
// The key listeners are in the main index.html scope

// --- Toggle Functions ---
function toggleRcCarSimulation() {
    rcRunning = !rcRunning;
    const icon = document.getElementById('rcBtnIcon');
    const text = document.getElementById('rcBtnText');
    if (rcRunning) {
        icon.textContent = '⏸';
        text.textContent = 'ផ្អាក Lab';
        rcLog('Simulation started', 'text-green-400');
        rcAnimLoop();
    } else {
        icon.textContent = '▶';
        text.textContent = 'ចាប់ផ្ដើម Lab';
        rcLog('Simulation paused', 'text-gray-400');
        if (rcAnimId) cancelAnimationFrame(rcAnimId);
    }
}

function rcToggleAutoMode() {
    if (rcDeliveryActive) {
        rcLog('Cannot enable Auto-Avoid during Delivery AI', 'text-orange-400');
        return;
    }
    rcAutoMode = !rcAutoMode;
    const btn = document.getElementById('rcAutoBtn');
    const label = document.getElementById('rcModeLabel');
    if (rcAutoMode) {
        btn.className = 'px-4 py-2 bg-purple-600/40 hover:bg-purple-600/50 text-purple-200 font-mono text-xs rounded-lg border border-purple-400/40 transition-all';
        label.textContent = 'AUTO-AVOID';
        rcLog('Auto-Avoid mode enabled', 'text-purple-400');
        rcAiSay('បើករបៀប Auto-Avoid — រថយន្តនឹងជៀសវាងឧបសគ្គដោយស្វ័យប្រវត្តិ');
        Object.keys(rcControls).forEach(k => rcControls[k] = false);
    } else {
        btn.className = 'px-4 py-2 bg-purple-600/20 hover:bg-purple-600/30 text-purple-300 font-mono text-xs rounded-lg border border-purple-500/20 transition-all';
        label.textContent = 'MANUAL';
        rcLog('Manual mode enabled', 'text-blue-400');
        rcAiSay('ប្ដូរទៅជា Manual Mode');
    }
}

function rcToggleDeliveryMode() {
    rcDeliveryActive = !rcDeliveryActive;
    const btn = document.getElementById('rcDeliveryBtn');
    const label = document.getElementById('rcModeLabel');
    const status = document.getElementById('rcDeliveryStatus');

    if (rcDeliveryActive) {
        rcAutoMode = false;
        Object.keys(rcControls).forEach(k => rcControls[k] = false);
        document.getElementById('rcAutoBtn').className = 'px-4 py-2 bg-purple-600/20 hover:bg-purple-600/30 text-purple-300 font-mono text-xs rounded-lg border border-purple-500/20 transition-all opacity-40 pointer-events-none';
        btn.className = 'px-4 py-2 bg-emerald-600/40 hover:bg-emerald-600/50 text-emerald-200 font-mono text-xs rounded-lg border border-emerald-400/40 transition-all';
        label.textContent = 'DELIVERY-AI';
        if (status) {
            status.textContent = 'ACTIVE';
            status.className = 'text-[10px] text-emerald-400';
        }
        if (!rcRunning) toggleRcCarSimulation();
        rcLog('Delivery AI activated', 'text-emerald-400');
        rcAiSay('ប្រព័ន្ធ Delivery AI ត្រូវបានបើកដំណើរការ!');
        rcGenerateOrder();
    } else {
        document.getElementById('rcAutoBtn').className = 'px-4 py-2 bg-purple-600/20 hover:bg-purple-600/30 text-purple-300 font-mono text-xs rounded-lg border border-purple-500/20 transition-all';
        btn.className = 'px-4 py-2 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 font-mono text-xs rounded-lg border border-emerald-500/20 transition-all';
        label.textContent = 'MANUAL';
        if (status) {
            status.textContent = 'IDLE';
            status.className = 'text-[10px] text-gray-500';
        }
        rcDeliveryState = 'IDLE';
        rcLog('Delivery AI deactivated', 'text-orange-400');
        rcAiSay('បេសកកម្មត្រូវបានបញ្ឈប់');
    }
}

// --- Obstacles ---
function spawnRcObstacle() {
    if (!rcCanvas) return;
    const x = 60 + Math.random() * (rcCanvas.width - 120);
    const y = 60 + Math.random() * (rcCanvas.height - 120);
    const r = 14 + Math.random() * 14;
    rcCar.obstacles.push({ x, y, r });
    rcLog(`🧱 Spawned obstacle at (${x.toFixed(0)}, ${y.toFixed(0)})`, 'text-orange-400');
}

function rcClearAllObstacles() {
    rcCar.obstacles = [];
    rcLog('All obstacles cleared', 'text-yellow-400');
}

function resetRcCarData() {
    rcCar.x = 400;
    rcCar.y = 225;
    rcCar.heading = 0;
    rcCar.speed = 0;
    rcCar.steer = 0;
    rcCar.totalDist = 0;
    rcCar.obstacles = [];
    document.getElementById('rcTotalDist').textContent = '0.0 m';
    document.getElementById('rcSpeed').textContent = '0 cm/s';
    document.getElementById('rcSpeedBar').style.width = '0%';
    rcLog('Data reset', 'text-green-400');
    rcAiSay('កំណត់រថយន្តឡើងវិញ');
}

// --- Sensor ---
function rcGetFrontDist() {
    let nearest = 9999;
    const lookX = rcCar.x + Math.cos(rcCar.heading) * 30;
    const lookY = rcCar.y + Math.sin(rcCar.heading) * 30;
    for (const o of rcCar.obstacles) {
        const d = Math.hypot(o.x - lookX, o.y - lookY) - o.r;
        if (d < nearest) nearest = d;
    }
    return Math.max(0, nearest);
}

// --- Q-Learning AI ---
function rcGetState() {
    const dist = rcGetFrontDist();
    const speed = Math.abs(rcCar.speed);
    const steer = rcCar.steer;
    const distBin = dist < 30 ? 0 : dist < 60 ? 1 : dist < 100 ? 2 : 3;
    const speedBin = speed < 1 ? 0 : speed < 3 ? 1 : 2;
    const steerBin = steer < -0.3 ? 0 : steer < 0.3 ? 1 : 2;
    return `${distBin}-${speedBin}-${steerBin}`;
}

function rcGetQValue(state, action) {
    return rcQTable[`${state}-${action}`] || 0;
}

function rcSetQValue(state, action, value) {
    rcQTable[`${state}-${action}`] = value;
}

function rcChooseAction(state) {
    if (Math.random() < rcEpsilon) {
        return rcActions[Math.floor(Math.random() * rcActions.length)];
    }
    let bestAction = rcActions[0];
    let bestValue = -Infinity;
    for (const a of rcActions) {
        const val = rcGetQValue(state, a);
        if (val > bestValue) { bestValue = val; bestAction = a; }
    }
    return bestAction;
}

function rcGetReward() {
    const dist = rcGetFrontDist();
    const speed = Math.abs(rcCar.speed);
    let reward = 0;
    if (dist > 80 && speed > 1) reward += 1.0;
    if (dist < 40) reward -= 0.5;
    if (dist < 20) reward -= 2.0;
    if (speed < 0.5 && dist > 50) reward -= 0.2;
    if (dist > 100 && speed > 2) reward += 0.3;
    return reward;
}

function rcTrainAI() {
    if (!rcRunning) {
        rcLog('Please start the simulation first!', 'text-orange-400');
        return;
    }
    
    rcTrainingActive = true;
    const overlay = document.getElementById('rcAiTrainOverlay');
    if (overlay) overlay.classList.remove('hidden');
    
    const state = rcGetState();
    const action = rcChooseAction(state);
    
    // Apply action
    rcControls[action] = true;
    
    // Simulate one step
    const reward = rcGetReward();
    rcTotalReward += reward;
    
    // Get next state
    const nextState = rcGetState();
    
    // Q-Learning update
    const currentQ = rcGetQValue(state, action);
    let maxNextQ = 0;
    for (const a of rcActions) {
        maxNextQ = Math.max(maxNextQ, rcGetQValue(nextState, a));
    }
    const newQ = currentQ + rcLearningRate * (reward + rcDiscountFactor * maxNextQ - currentQ);
    rcSetQValue(state, action, newQ);
    
    // Reset controls
    Object.keys(rcControls).forEach(k => { if (k !== action) rcControls[k] = false; });
    
    // Epsilon decay
    rcEpsilon = Math.max(0.05, rcEpsilon * 0.9995);
    rcEpisode++;
    rcEpochCount++;
    
    const epochDisplay = document.getElementById('rcEpochDisplay');
    if (epochDisplay) epochDisplay.textContent = rcEpochCount;
    
    if (rcEpisode % 10 === 0) {
        rcLog(`🧠 Q-Learning: ε=${rcEpsilon.toFixed(3)}, reward=${reward.toFixed(2)}, total=${rcTotalReward.toFixed(2)}`, 'text-purple-400');
        rcAiSay(`វគ្គបណ្តុះបណ្តាល #${rcEpisode} — រង្វាន់សរុប: ${rcTotalReward.toFixed(2)}`);
    }
    
    setTimeout(() => {
        rcTrainingActive = false;
        if (overlay) overlay.classList.add('hidden');
        Object.keys(rcControls).forEach(k => rcControls[k] = false);
    }, 100);
}

// --- Delivery ---
function rcGenerateOrder() {
    if (!rcCanvas) return;
    const rx = 60 + Math.random() * (rcCanvas.width - 120);
    const ry = 60 + Math.random() * (rcCanvas.height - 120);
    const cx = 60 + Math.random() * (rcCanvas.width - 120);
    const cy = 60 + Math.random() * (rcCanvas.height - 120);
    
    rcRestaurantPoint = { x: rx, y: ry };
    rcCustomerPoint = { x: cx, y: cy };
    
    rcOrder = {
        id: '#PP-' + Math.floor(1000 + Math.random() * 9000),
        restaurant: rcRestaurants[Math.floor(Math.random() * rcRestaurants.length)],
        customer: rcCustomers[Math.floor(Math.random() * rcCustomers.length)],
        item: rcFoodItems[Math.floor(Math.random() * rcFoodItems.length)],
        price: (2.5 + Math.random() * 5).toFixed(2)
    };
    
    document.getElementById('rcOrderId').textContent = rcOrder.id;
    document.getElementById('rcOrderRestaurant').textContent = rcOrder.restaurant;
    document.getElementById('rcOrderCustomer').textContent = rcOrder.customer;
    document.getElementById('rcOrderStatus').textContent = 'កំពុងទៅយកម្ហូប...';
    document.getElementById('rcOrderStatus').className = 'text-orange-400';
    
    rcDeliveryState = 'TO_RESTAURANT';
    rcAiSay(`ទទួលបានការកម្មង់ ${rcOrder.id} ពី ${rcOrder.restaurant}!`);
    rcLog(`📦 New order: ${rcOrder.id}`, 'text-emerald-400');
}

function rcUpdateDelivery() {
    if (!rcDeliveryActive || rcDeliveryState === 'IDLE' || !rcCanvas) return;
    
    const frontDist = rcGetFrontDist();
    const dt = 16;
    
    switch (rcDeliveryState) {
        case 'TO_RESTAURANT': {
            const dx = rcRestaurantPoint.x - rcCar.x;
            const dy = rcRestaurantPoint.y - rcCar.y;
            const dist = Math.hypot(dx, dy);
            const targetHeading = Math.atan2(dy, dx);
            let diff = targetHeading - rcCar.heading;
            while (diff > Math.PI) diff -= Math.PI * 2;
            while (diff < -Math.PI) diff += Math.PI * 2;
            
            if (frontDist < 50) {
                rcCar.steer = diff > 0 ? -0.8 : 0.8;
                rcCar.speed *= 0.9;
            } else {
                rcCar.steer = Math.max(-1, Math.min(1, diff * 1.5));
                const targetSpeed = (rcMaxThrottle / 100) * 4.2 * (dist < 80 ? 0.4 : 1);
                rcCar.speed += (targetSpeed - rcCar.speed) * 0.06;
            }
            
            if (dist < 30) {
                rcCar.speed = 0;
                rcDeliveryState = 'PICKING_UP';
                rcDeliveryTimer = 0;
                document.getElementById('rcOrderStatus').textContent = 'កំពុងយកម្ហូប...';
                rcAiSay(`បានមកដល់ ${rcOrder.restaurant}! កំពុងយកម្ហូប...`);
            }
            break;
        }
        case 'PICKING_UP': {
            rcCar.speed = 0;
            rcDeliveryTimer += dt;
            if (rcDeliveryTimer > 1500) {
                rcDeliveryState = 'TO_CUSTOMER';
                document.getElementById('rcOrderStatus').textContent = 'កំពុងដឹកជញ្ជូន...';
                document.getElementById('rcOrderStatus').className = 'text-blue-400';
                rcAiSay(`បានយកម្ហូបជោគជ័យ! កំពុងបញ្ជូនទៅ ${rcOrder.customer}...`);
            }
            break;
        }
        case 'TO_CUSTOMER': {
            const dx = rcCustomerPoint.x - rcCar.x;
            const dy = rcCustomerPoint.y - rcCar.y;
            const dist = Math.hypot(dx, dy);
            const targetHeading = Math.atan2(dy, dx);
            let diff = targetHeading - rcCar.heading;
            while (diff > Math.PI) diff -= Math.PI * 2;
            while (diff < -Math.PI) diff += Math.PI * 2;
            
            if (frontDist < 50) {
                rcCar.steer = diff > 0 ? -0.8 : 0.8;
                rcCar.speed *= 0.9;
            } else {
                rcCar.steer = Math.max(-1, Math.min(1, diff * 1.5));
                const targetSpeed = (rcMaxThrottle / 100) * 4.2 * (dist < 80 ? 0.4 : 1);
                rcCar.speed += (targetSpeed - rcCar.speed) * 0.06;
            }
            
            if (dist < 30) {
                rcCar.speed = 0;
                rcDeliveryState = 'DELIVERING';
                rcDeliveryTimer = 0;
                document.getElementById('rcOrderStatus').textContent = 'កំពុងប្រគល់ម្ហូប...';
            }
            break;
        }
        case 'DELIVERING': {
            rcCar.speed = 0;
            rcDeliveryTimer += dt;
            if (rcDeliveryTimer > 1200) {
                rcDeliveries++;
                rcEarnings += parseFloat(rcOrder.price);
                document.getElementById('rcDeliveriesCount').textContent = rcDeliveries;
                document.getElementById('rcEarnings').textContent = '$' + rcEarnings.toFixed(2);
                document.getElementById('rcOrderStatus').textContent = 'បានដឹកជញ្ជូនជោគជ័យ ✅';
                document.getElementById('rcOrderStatus').className = 'text-green-400';
                rcAiSay(`ដឹកជញ្ជូនជោគជ័យ! ទទួលបាន $${rcOrder.price}`);
                rcDeliveryState = 'IDLE';
                setTimeout(() => {
                    if (rcDeliveryActive) rcGenerateOrder();
                }, 2000);
            }
            break;
        }
    }
}

// --- Drawing ---
function drawRCCar() {
    if (!rcCtx || !rcCanvas) return;
    const ctx = rcCtx;
    const w = rcCanvas.width;
    const h = rcCanvas.height;
    
    // Clear
    ctx.fillStyle = '#0a0f1a';
    ctx.fillRect(0, 0, w, h);
    
    // Grid
    ctx.strokeStyle = 'rgba(59,130,246,0.08)';
    ctx.lineWidth = 1;
    for (let gx = 0; gx < w; gx += 40) {
        ctx.beginPath();
        ctx.moveTo(gx, 0);
        ctx.lineTo(gx, h);
        ctx.stroke();
    }
    for (let gy = 0; gy < h; gy += 40) {
        ctx.beginPath();
        ctx.moveTo(0, gy);
        ctx.lineTo(w, gy);
        ctx.stroke();
    }
    
    // Obstacles
    ctx.fillStyle = '#f0883e';
    for (const o of rcCar.obstacles) {
        ctx.beginPath();
        ctx.arc(o.x, o.y, o.r, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = 'rgba(240,136,62,0.4)';
        ctx.lineWidth = 2;
        ctx.stroke();
        // Icon
        ctx.fillStyle = '#fff';
        ctx.font = '16px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('🧱', o.x, o.y);
    }
    
    // Delivery waypoints
    if (rcDeliveryActive && rcRestaurantPoint) {
        ctx.fillStyle = '#fb923c';
        ctx.beginPath();
        ctx.arc(rcRestaurantPoint.x, rcRestaurantPoint.y, 10, 0, Math.PI * 2);
        ctx.fill();
        ctx.font = '18px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('🍔', rcRestaurantPoint.x, rcRestaurantPoint.y - 18);
    }
    if (rcDeliveryActive && rcCustomerPoint) {
        ctx.fillStyle = '#34d399';
        ctx.beginPath();
        ctx.arc(rcCustomerPoint.x, rcCustomerPoint.y, 10, 0, Math.PI * 2);
        ctx.fill();
        ctx.font = '18px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('🏠', rcCustomerPoint.x, rcCustomerPoint.y - 18);
    }
    
    // Path line to target
    if (rcDeliveryActive) {
        const target = rcDeliveryState === 'TO_RESTAURANT' || rcDeliveryState === 'PICKING_UP' 
            ? rcRestaurantPoint : rcCustomerPoint;
        if (target) {
            ctx.strokeStyle = 'rgba(52,211,153,0.3)';
            ctx.setLineDash([6, 6]);
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.moveTo(rcCar.x, rcCar.y);
            ctx.lineTo(target.x, target.y);
            ctx.stroke();
            ctx.setLineDash([]);
        }
    }
    
    // Car body
    ctx.save();
    ctx.translate(rcCar.x, rcCar.y);
    ctx.rotate(rcCar.heading);
    
    // Shadow glow
    ctx.shadowColor = rcDeliveryActive ? 'rgba(16,185,129,0.3)' : 'rgba(47,129,247,0.3)';
    ctx.shadowBlur = 20;
    
    // Car body
    const gradient = ctx.createLinearGradient(-18, -12, 18, 12);
    if (rcDeliveryActive) {
        gradient.addColorStop(0, '#10b981');
        gradient.addColorStop(1, '#059669');
    } else {
        gradient.addColorStop(0, '#2f81f7');
        gradient.addColorStop(1, '#1d4ed8');
    }
    ctx.fillStyle = gradient;
    ctx.fillRect(-18, -12, 36, 24);
    
    // Windshield
    ctx.shadowBlur = 0;
    ctx.fillStyle = 'rgba(255,255,255,0.15)';
    ctx.fillRect(8, -10, 8, 8);
    ctx.fillRect(8, 2, 8, 8);
    
    // Headlights
    ctx.fillStyle = '#fbbf24';
    ctx.shadowColor = 'rgba(251,191,36,0.5)';
    ctx.shadowBlur = 10;
    ctx.fillRect(14, -9, 4, 4);
    ctx.fillRect(14, 5, 4, 4);
    
    // Wheels
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#111827';
    ctx.fillRect(-18, -14, 6, 4);
    ctx.fillRect(-18, 10, 6, 4);
    ctx.fillRect(12, -14, 6, 4);
    ctx.fillRect(12, 10, 6, 4);
    
    ctx.restore();
    
    // Sensor ray
    ctx.strokeStyle = 'rgba(34,197,94,0.3)';
    ctx.setLineDash([4, 8]);
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(rcCar.x, rcCar.y);
    ctx.lineTo(
        rcCar.x + Math.cos(rcCar.heading) * 60,
        rcCar.y + Math.sin(rcCar.heading) * 60
    );
    ctx.stroke();
    ctx.setLineDash([]);
}

// --- Animation Loop ---
function rcAnimLoop() {
    if (!rcRunning) return;
    if (!rcCanvas || !rcCtx) {
        rcAnimId = requestAnimationFrame(rcAnimLoop);
        return;
    }
    
    const maxSpeed = (rcMaxThrottle / 100) * 4.2;
    const frontDist = rcGetFrontDist();
    
    // --- Physics ---
    if (rcDeliveryActive) {
        rcUpdateDelivery();
    } else if (rcAutoMode) {
        // Auto-avoid with some intelligence
        if (frontDist < 60) {
            rcCar.steer = 0.7;
            rcCar.speed *= 0.9;
        } else {
            rcCar.steer *= 0.8;
            rcCar.speed += (maxSpeed * 0.7 - rcCar.speed) * 0.05;
        }
    } else if (rcTrainingActive) {
        // AI training handles controls
        // Just apply physics
    } else {
        // Manual controls
        if (rcControls.forward) {
            rcCar.speed += (maxSpeed - rcCar.speed) * 0.08;
        } else if (rcControls.reverse) {
            rcCar.speed += (-maxSpeed * 0.6 - rcCar.speed) * 0.08;
        } else if (rcControls.brake) {
            rcCar.speed *= 0.8;
        } else {
            rcCar.speed *= 0.96;
        }
        
        if (rcControls.left) {
            rcCar.steer = Math.max(-1, rcCar.steer - 0.06);
        } else if (rcControls.right) {
            rcCar.steer = Math.min(1, rcCar.steer + 0.06);
        } else {
            rcCar.steer *= 0.85;
        }
        
        // Obstacle slow-down
        if (frontDist < 30 && rcCar.speed > 0) rcCar.speed *= 0.5;
    }
    
    // Update position
    rcCar.heading += rcCar.steer * 0.04 * (rcCar.speed !== 0 ? 1 : 0);
    rcCar.x += Math.cos(rcCar.heading) * rcCar.speed;
    rcCar.y += Math.sin(rcCar.heading) * rcCar.speed;
    rcCar.totalDist += Math.abs(rcCar.speed);
    
    // Bounds
    if (rcCar.x < 20) rcCar.x = 20;
    if (rcCar.x > rcCanvas.width - 20) rcCar.x = rcCanvas.width - 20;
    if (rcCar.y < 20) rcCar.y = 20;
    if (rcCar.y > rcCanvas.height - 20) rcCar.y = rcCanvas.height - 20;
    
    // --- Draw ---
    drawRCCar();
    
    // --- Update UI ---
    const speedCmS = Math.abs(rcCar.speed) * 12;
    document.getElementById('rcSpeed').textContent = speedCmS.toFixed(0) + ' cm/s';
    document.getElementById('rcSpeedBar').style.width = Math.min(100, (speedCmS / 50) * 100) + '%';
    
    const steerDeg = (rcCar.steer * 35).toFixed(0);
    document.getElementById('rcSteerAngle').textContent = steerDeg + '°';
    document.getElementById('rcSteerBar').style.width = (50 + rcCar.steer * 50) + '%';
    
    const distLabel = frontDist > 200 ? '> 200' : frontDist.toFixed(0);
    document.getElementById('rcDistance').textContent = distLabel + ' cm';
    document.getElementById('rcDistanceBar').style.width = Math.max(0, 100 - (frontDist / 2)) + '%';
    
    document.getElementById('rcTotalDist').textContent = (rcCar.totalDist / 100).toFixed(1) + ' m';
    
    // Battery drain
    const battEl = document.getElementById('rcBattery');
    let battV = parseFloat(battEl.textContent);
    if (rcCar.speed !== 0) battV = Math.max(6.8, battV - 0.0004);
    battEl.textContent = battV.toFixed(1) + 'V';
    battEl.className = battV < 7.2 ? 'text-xl font-bold text-red-400 animate-pulse' : 'text-xl font-bold text-green-400';
    
    rcAnimId = requestAnimationFrame(rcAnimLoop);
}

// --- Make functions globally accessible ---
window.initRCCar = initRCCar;
window.toggleRcCarSimulation = toggleRcCarSimulation;
window.rcToggleAutoMode = rcToggleAutoMode;
window.rcToggleDeliveryMode = rcToggleDeliveryMode;
window.spawnRcObstacle = spawnRcObstacle;
window.rcClearAllObstacles = rcClearAllObstacles;
window.resetRcCarData = resetRcCarData;
window.rcTrainAI = rcTrainAI;
window.rcStartControl = rcStartControl;
window.rcStopControl = rcStopControl;
window.rcLog = rcLog;
window.rcAiSay = rcAiSay;
window.rcCar = rcCar;