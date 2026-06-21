let rcRunning = false;
let rcAutoMode = false;
let rcMaxThrottle = 60;
let rcAnimId = null;

const rcCarState = {
    x: 400, y: 225,        // canvas position
    heading: 0,             // radians
    speed: 0,               // px/frame
    steer: 0,                // -1..1
    distanceTotalPx: 0,
    obstacles: []
};

const rcControls = { forward: false, reverse: false, left: false, right: false, brake: false };

function rcLog(msg, cls) {
    const box = document.getElementById('rcLogBox');
    if (!box) return;
    const line = document.createElement('div');
    line.className = cls || 'text-gray-400';
    line.textContent = '[ESP32-CAM] ' + msg;
    box.appendChild(line);
    box.scrollTop = box.scrollHeight;
}

function rcStartControl(action) {
    if (rcAutoMode || rcDeliveryActive) return;
    rcControls[action] = true;
}
function rcStopControl(action) {
    rcControls[action] = false;
}

// ------------------------------------------------------------
// KEYBOARD CONTROLS — W A S D / Arrow keys, Space = brake
// ------------------------------------------------------------
const rcKeyMap = {
    'w': 'forward', 'W': 'forward', 'ArrowUp': 'forward',
    's': 'reverse', 'S': 'reverse', 'ArrowDown': 'reverse',
    'a': 'left', 'A': 'left', 'ArrowLeft': 'left',
    'd': 'right', 'D': 'right', 'ArrowRight': 'right',
    ' ': 'brake'
};

window.addEventListener('keydown', (e) => {
    const tag = document.activeElement && document.activeElement.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA') return;
    const action = rcKeyMap[e.key];
    if (!action) return;
    if (rcAutoMode || rcDeliveryActive) {
        if (e.key === ' ' || e.key.startsWith('Arrow')) e.preventDefault();
        return; // locked out while AI is driving
    }
    e.preventDefault();
    rcControls[action] = true;
});

window.addEventListener('keyup', (e) => {
    const action = rcKeyMap[e.key];
    if (!action) return;
    rcControls[action] = false;
});

function rcToggleAutoMode() {
    if (rcDeliveryActive) {
        rcLog('មិនអាចបើក Auto-Avoid ខណៈពេល Delivery AI កំពុងបញ្ជា', 'text-orange-400');
        return;
    }
    rcAutoMode = !rcAutoMode;
    const btn = document.getElementById('rcAutoBtn');
    const modeLabel = document.getElementById('rcModeLabel');
    if (rcAutoMode) {
        btn.textContent = '🧭 បិទ Auto-Avoid Mode';
        btn.className = "px-4 py-2 bg-purple-600/40 hover:bg-purple-600/50 text-purple-200 font-mono text-xs rounded-lg border border-purple-400/40 transition-all";
        modeLabel.textContent = 'AUTO-AVOID';
        rcLog('បានបើក Auto-Avoid Mode — រថយន្តនឹងជៀសវាងឧបសគ្គដោយខ្លួនឯង', 'text-purple-400');
        for (const k in rcControls) rcControls[k] = false;
    } else {
        btn.textContent = '🧭 បើក Auto-Avoid Mode';
        btn.className = "px-4 py-2 bg-purple-600/20 hover:bg-purple-600/30 text-purple-300 font-mono text-xs rounded-lg border border-purple-500/20 transition-all";
        modeLabel.textContent = 'MANUAL';
        rcLog('បានប្ដូរត្រឡប់មកជា Manual Drive Mode វិញ', 'text-blue-400');
    }
}

function spawnRcObstacle() {
    const canvas = document.getElementById('rcCarCanvas');
    const ox = 80 + Math.random() * (canvas.width - 160);
    const oy = 80 + Math.random() * (canvas.height - 160);
    rcCarState.obstacles.push({ x: ox, y: oy, r: 18 });
    rcLog(`ដាក់ឧបសគ្គថ្មីត្រង់ (${ox.toFixed(0)}, ${oy.toFixed(0)})`, 'text-orange-400');
}

function resetRcCarData() {
    rcCarState.x = 400; rcCarState.y = 225;
    rcCarState.heading = 0; rcCarState.speed = 0; rcCarState.steer = 0;
    rcCarState.distanceTotalPx = 0;
    rcCarState.obstacles = [];
    document.getElementById('rc_distance_total').textContent = '0.0 m';
    document.getElementById('rc_speed').textContent = '0 cm/s';
    document.getElementById('rc_speed_bar').style.width = '0%';
    rcLog('កំណត់ទិន្នន័យសិក្សា Lab ឡើងវិញជោគជ័យ', 'text-green-400');
}

function toggleRcCarSimulation() {
    rcRunning = !rcRunning;
    const icon = document.getElementById('rcBtnIcon');
    const text = document.getElementById('rcBtnText');
    const btn = document.getElementById('btnToggleRcCar');
    if (rcRunning) {
        icon.textContent = '⏸'; text.textContent = 'ផ្អាក Lab';
        btn.classList.add('bg-blue-500');
        rcLog('ចាប់ផ្ដើមការបញ្ជូនវីដេអូផ្សារភ្ជាប់ជោគជ័យ', 'text-green-400');
        rcAnimLoop();
    } else {
        icon.textContent = '▶'; text.textContent = 'ចាប់ផ្ដើម Lab';
        btn.classList.remove('bg-blue-500');
        rcLog('បានបញ្ឈប់ការបញ្ជូនវីដេអូ', 'text-gray-400');
        if (rcAnimId) cancelAnimationFrame(rcAnimId);
    }
}

function rcNearestObstacleDist() {
    let nearest = 9999;
    const lookX = rcCarState.x + Math.cos(rcCarState.heading) * 40;
    const lookY = rcCarState.y + Math.sin(rcCarState.heading) * 40;
    for (const o of rcCarState.obstacles) {
        const d = Math.hypot(o.x - lookX, o.y - lookY) - o.r;
        if (d < nearest) nearest = d;
    }
    return Math.max(0, nearest);
}

// ============================================================
// FAKE AI DELIVERY ASSISTANT
// ============================================================
let rcDeliveryActive = false;
let rcDeliveryState = 'IDLE'; // IDLE -> TO_RESTAURANT -> PICKING_UP -> TO_CUSTOMER -> DELIVERING -> IDLE
let rcDeliveryTimer = 0;
let rcRestaurantPoint = null;
let rcCustomerPoint = null;
let rcCurrentOrder = null;
let rcDeliveriesCount = 0;
let rcEarnings = 0;

const rcFoodNames = [
    'ភោជនីយដ្ឋាន Golden Wok', 'ហាងសាច់អាំង Angkor Grill', 'Pizza Corner PP',
    'Noodle House ខេមរភោជន', 'Burger Lab PP', 'Coffee &amp; Bingsu House', 'ហាងបបរត្រី សុខសាន្ត'
];
const rcCustomerNames = [
    'អតិថិជន សុខា (BKK1)', 'អតិថិជន វិបុល (Toul Kork)', 'អតិថិជន ដារ៉ា (Riverside)',
    'អតិថិជន ស្រីពេជ្រ (Chamkar Mon)', 'អតិថិជន រតនា (Sen Sok)', 'អតិថិជន ពិសិដ្ឋ (Daun Penh)'
];
const rcFoodItems = [
    'គុយទាវសាច់គោ x1', 'បាយឆាខ្ញី x2', 'Pizza Pepperoni Medium', 'Burger Cheese Combo',
    'កាហ្វេទឹកដោះគោ x2', 'Mango Sticky Rice', 'បបរត្រី + ស្ទីមអាំង'
];

function rcAiSay(html) {
    const box = document.getElementById('rcAiChatLog');
    if (!box) return;
    if (box.querySelector('.italic')) box.innerHTML = '';
    const line = document.createElement('div');
    line.className = 'text-emerald-300';
    line.innerHTML = '🤖 ' + html;
    box.appendChild(line);
    box.scrollTop = box.scrollHeight;
}

function rcRandomCanvasPoint(canvas) {
    return {
        x: 60 + Math.random() * (canvas.width - 120),
        y: 60 + Math.random() * (canvas.height - 120)
    };
}

function rcGenerateOrder() {
    const canvas = document.getElementById('rcCarCanvas');
    rcRestaurantPoint = rcRandomCanvasPoint(canvas);
    rcCustomerPoint = rcRandomCanvasPoint(canvas);

    const restaurant = rcFoodNames[Math.floor(Math.random() * rcFoodNames.length)];
    const customer = rcCustomerNames[Math.floor(Math.random() * rcCustomerNames.length)];
    const item = rcFoodItems[Math.floor(Math.random() * rcFoodItems.length)];
    const price = (Math.random() * 5 + 2.5).toFixed(2);

    rcCurrentOrder = {
        id: '#PP-' + Math.floor(1000 + Math.random() * 9000),
        restaurant, customer, item, price
    };

    document.getElementById('rcOrderId').textContent = rcCurrentOrder.id;
    document.getElementById('rcOrderRestaurant').textContent = restaurant;
    document.getElementById('rcOrderCustomer').textContent = customer;
    document.getElementById('rcOrderItem').textContent = item + ' ($' + price + ')';
    const statusEl = document.getElementById('rcOrderStatus');
    statusEl.textContent = 'កំពុងទៅយកម្ហូប...';
    statusEl.className = 'text-orange-400';

    rcAiSay(`ទទួលបានការកម្មង់ថ្មី <b>${rcCurrentOrder.id}</b> ពី <b>${restaurant}</b>! កំពុងបញ្ជូនរថយន្តទៅយកម្ហូប...`);
    rcDeliveryState = 'TO_RESTAURANT';
}

function toggleRcDeliveryMode() {
    rcDeliveryActive = !rcDeliveryActive;
    const btn = document.getElementById('rcDeliveryBtn');
    const modeLabel = document.getElementById('rcModeLabel');

    if (rcDeliveryActive) {
        // delivery AI takes exclusive control
        rcAutoMode = false;
        for (const k in rcControls) rcControls[k] = false;
        document.getElementById('rcAutoBtn').className =
            "px-4 py-2 bg-purple-600/20 hover:bg-purple-600/30 text-purple-300 font-mono text-xs rounded-lg border border-purple-500/20 transition-all opacity-40 pointer-events-none";

        btn.textContent = '⏹ បញ្ឈប់ Delivery AI';
        btn.className = "px-3 py-1.5 bg-red-600/20 hover:bg-red-600/30 text-red-300 rounded text-xs font-mono border border-red-500/20 transition-all";
        modeLabel.textContent = 'DELIVERY-AI';
        if (!rcRunning) toggleRcCarSimulation();
        rcAiSay('ប្រព័ន្ធ AI Dispatcher ត្រូវបានបើកដំណើរការ! កំពុងស្វែងរកការកម្មង់នៅជិតបំផុត...');
        rcGenerateOrder();
    } else {
        document.getElementById('rcAutoBtn').className =
            "px-4 py-2 bg-purple-600/20 hover:bg-purple-600/30 text-purple-300 font-mono text-xs rounded-lg border border-purple-500/20 transition-all";
        btn.textContent = '🚀 ចាប់ផ្ដើម Delivery AI';
        btn.className = "px-3 py-1.5 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 rounded text-xs font-mono border border-emerald-500/20 transition-all";
        modeLabel.textContent = 'MANUAL';
        rcDeliveryState = 'IDLE';
        rcRestaurantPoint = null;
        rcCustomerPoint = null;
        document.getElementById('rcOrderStatus').textContent = 'IDLE';
        document.getElementById('rcOrderStatus').className = 'text-gray-400';
        rcAiSay('បេសកកម្មត្រូវបានបញ្ឈប់ដោយដៃ។ AI Dispatcher ឈប់ស្នើសុំការកម្មង់ថ្មីទៀតហើយ។');
    }
}

// Steers the car toward a target point, blended with obstacle avoidance.
// Returns true once the car is within arrival radius of the target.
function rcDriveToward(target, frontDist) {
    const dx = target.x - rcCarState.x;
    const dy = target.y - rcCarState.y;
    const dist = Math.hypot(dx, dy);
    const desiredHeading = Math.atan2(dy, dx);

    let angDiff = desiredHeading - rcCarState.heading;
    while (angDiff > Math.PI) angDiff -= Math.PI * 2;
    while (angDiff < -Math.PI) angDiff += Math.PI * 2;

    if (frontDist < 60) {
        // obstacle takes priority — swerve, slow down
        rcCarState.steer = angDiff > 0 ? -0.8 : 0.8;
        rcCarState.speed *= 0.92;
    } else {
        rcCarState.steer = Math.max(-1, Math.min(1, angDiff * 1.3));
        const targetSpeed = (rcMaxThrottle / 100) * 4.2 * (dist < 80 ? 0.4 : 1);
        rcCarState.speed += (targetSpeed - rcCarState.speed) * 0.06;
    }

    return dist < 26;
}

function rcUpdateDeliveryStateMachine(frontDist, dtMs) {
    if (!rcDeliveryActive) return;

    switch (rcDeliveryState) {
        case 'TO_RESTAURANT': {
            const arrived = rcDriveToward(rcRestaurantPoint, frontDist);
            if (arrived) {
                rcCarState.speed = 0;
                rcDeliveryState = 'PICKING_UP';
                rcDeliveryTimer = 0;
                document.getElementById('rcOrderStatus').textContent = 'កំពុងយកម្ហូប...';
                rcAiSay(`បានមកដល់ <b>${rcCurrentOrder.restaurant}</b>! កំពុងរង់ចាំយកម្ហូប...`);
            }
            break;
        }
        case 'PICKING_UP': {
            rcCarState.speed = 0;
            rcDeliveryTimer += dtMs;
            if (rcDeliveryTimer > 1400) {
                rcDeliveryState = 'TO_CUSTOMER';
                document.getElementById('rcOrderStatus').textContent = 'កំពុងដឹកជញ្ជូន...';
                document.getElementById('rcOrderStatus').className = 'text-blue-400';
                rcAiSay(`បានយកម្ហូបជោគជ័យ! កំពុងបញ្ជូនទៅ <b>${rcCurrentOrder.customer}</b>...`);
            }
            break;
        }
        case 'TO_CUSTOMER': {
            const arrived = rcDriveToward(rcCustomerPoint, frontDist);
            if (arrived) {
                rcCarState.speed = 0;
                rcDeliveryState = 'DELIVERING';
                rcDeliveryTimer = 0;
                document.getElementById('rcOrderStatus').textContent = 'កំពុងប្រគល់ម្ហូប...';
            }
            break;
        }
        case 'DELIVERING': {
            rcCarState.speed = 0;
            rcDeliveryTimer += dtMs;
            if (rcDeliveryTimer > 1200) {
                rcDeliveriesCount++;
                rcEarnings += parseFloat(rcCurrentOrder.price);
                document.getElementById('rc_deliveries_count').textContent = rcDeliveriesCount;
                document.getElementById('rc_earnings').textContent = '$' + rcEarnings.toFixed(2);
                document.getElementById('rcOrderStatus').textContent = 'បានដឹកជញ្ជូនជោគជ័យ ✅';
                document.getElementById('rcOrderStatus').className = 'text-green-400';
                rcAiSay(`ដឹកជញ្ជូនជោគជ័យសម្រាប់ <b>${rcCurrentOrder.customer}</b>! ទទួលបាន <b>$${rcCurrentOrder.price}</b>។ កំពុងស្វែងរកការកម្មង់បន្ទាប់...`);

                rcDeliveryState = 'IDLE';
                rcRestaurantPoint = null;
                rcCustomerPoint = null;
                setTimeout(() => {
                    if (rcDeliveryActive) rcGenerateOrder();
                }, 1800);
            }
            break;
        }
    }
}

function rcAnimLoop() {
    if (!rcRunning) return;
    const canvas = document.getElementById('rcCarCanvas');
    const ctx = canvas.getContext('2d');

    // --- Physics / control update ---
    const maxSpeed = (rcMaxThrottle / 100) * 4.2;
    const frontDist = rcNearestObstacleDist();

    if (rcDeliveryActive) {
        rcUpdateDeliveryStateMachine(frontDist, 16);
    } else if (rcAutoMode) {
        if (frontDist < 70) {
            rcCarState.steer = 0.7; // steer away
            rcCarState.speed *= 0.9;
        } else {
            rcCarState.steer *= 0.8;
            rcCarState.speed += (maxSpeed - rcCarState.speed) * 0.05;
        }
    } else {
        if (rcControls.forward) rcCarState.speed += (maxSpeed - rcCarState.speed) * 0.08;
        else if (rcControls.reverse) rcCarState.speed += (-maxSpeed * 0.6 - rcCarState.speed) * 0.08;
        else if (rcControls.brake) rcCarState.speed *= 0.8;
        else rcCarState.speed *= 0.96;

        if (rcControls.left) rcCarState.steer = Math.max(-1, rcCarState.steer - 0.06);
        else if (rcControls.right) rcCarState.steer = Math.min(1, rcCarState.steer + 0.06);
        else rcCarState.steer *= 0.85;

        // Manual collision slow-down
        if (frontDist < 30 && rcCarState.speed > 0) rcCarState.speed *= 0.5;
    }

    rcCarState.heading += rcCarState.steer * 0.04 * (rcCarState.speed !== 0 ? 1 : 0);
    rcCarState.x += Math.cos(rcCarState.heading) * rcCarState.speed;
    rcCarState.y += Math.sin(rcCarState.heading) * rcCarState.speed;
    rcCarState.distanceTotalPx += Math.abs(rcCarState.speed);

    // Bounds wrap
    if (rcCarState.x < 20) rcCarState.x = 20;
    if (rcCarState.x > canvas.width - 20) rcCarState.x = canvas.width - 20;
    if (rcCarState.y < 20) rcCarState.y = 20;
    if (rcCarState.y > canvas.height - 20) rcCarState.y = canvas.height - 20;

    // --- Draw ---
    ctx.fillStyle = '#0a0f1a';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // grid floor
    ctx.strokeStyle = 'rgba(59,130,246,0.08)';
    ctx.lineWidth = 1;
    for (let gx = 0; gx < canvas.width; gx += 40) {
        ctx.beginPath(); ctx.moveTo(gx, 0); ctx.lineTo(gx, canvas.height); ctx.stroke();
    }
    for (let gy = 0; gy < canvas.height; gy += 40) {
        ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(canvas.width, gy); ctx.stroke();
    }

    // obstacles
    ctx.fillStyle = '#f0883e';
    rcCarState.obstacles.forEach(o => {
        ctx.beginPath();
        ctx.arc(o.x, o.y, o.r, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = 'rgba(240,136,62,0.4)';
        ctx.lineWidth = 2;
        ctx.stroke();
    });

    // delivery waypoints (restaurant / customer pins) + path line
    if (rcDeliveryActive) {
        const activeTarget = (rcDeliveryState === 'TO_RESTAURANT' || rcDeliveryState === 'PICKING_UP')
            ? rcRestaurantPoint
            : rcCustomerPoint;

        if (rcRestaurantPoint) {
            ctx.fillStyle = '#fb923c';
            ctx.beginPath();
            ctx.arc(rcRestaurantPoint.x, rcRestaurantPoint.y, 10, 0, Math.PI * 2);
            ctx.fill();
            ctx.font = '14px sans-serif';
            ctx.fillText('🍔', rcRestaurantPoint.x - 8, rcRestaurantPoint.y - 14);
        }
        if (rcCustomerPoint) {
            ctx.fillStyle = '#34d399';
            ctx.beginPath();
            ctx.arc(rcCustomerPoint.x, rcCustomerPoint.y, 10, 0, Math.PI * 2);
            ctx.fill();
            ctx.font = '14px sans-serif';
            ctx.fillText('🏠', rcCustomerPoint.x - 8, rcCustomerPoint.y - 14);
        }
        if (activeTarget) {
            ctx.strokeStyle = 'rgba(52,211,153,0.35)';
            ctx.setLineDash([6, 6]);
            ctx.beginPath();
            ctx.moveTo(rcCarState.x, rcCarState.y);
            ctx.lineTo(activeTarget.x, activeTarget.y);
            ctx.stroke();
            ctx.setLineDash([]);
        }
    }

    // car body
    ctx.save();
    ctx.translate(rcCarState.x, rcCarState.y);
    ctx.rotate(rcCarState.heading);
    ctx.fillStyle = rcDeliveryActive ? '#10b981' : '#2f81f7';
    ctx.fillRect(-16, -10, 32, 20);
    ctx.fillStyle = '#0ea5e9';
    ctx.fillRect(6, -10, 10, 20); // front marker
    ctx.fillStyle = '#111827';
    ctx.fillRect(-14, -13, 8, 4);
    ctx.fillRect(-14, 9, 8, 4);
    ctx.fillRect(6, -13, 8, 4);
    ctx.fillRect(6, 9, 8, 4);
    ctx.restore();

    // front-facing sensor ray
    ctx.strokeStyle = 'rgba(34,197,94,0.5)';
    ctx.beginPath();
    ctx.moveTo(rcCarState.x, rcCarState.y);
    ctx.lineTo(
        rcCarState.x + Math.cos(rcCarState.heading) * 70,
        rcCarState.y + Math.sin(rcCarState.heading) * 70
    );
    ctx.stroke();

    // --- Telemetry UI update ---
    const speedCmS = Math.abs(rcCarState.speed) * 12;
    document.getElementById('rc_speed').textContent = speedCmS.toFixed(0) + ' cm/s';
    document.getElementById('rc_speed_bar').style.width = Math.min(100, (speedCmS / 50) * 100) + '%';

    const steerDeg = (rcCarState.steer * 35).toFixed(0);
    document.getElementById('rc_steer_angle').textContent = steerDeg + '°';
    document.getElementById('rc_steer_bar').style.width = (50 + rcCarState.steer * 50) + '%';

    const distLabel = frontDist > 200 ? '> 200' : frontDist.toFixed(0);
    document.getElementById('rc_distance').textContent = distLabel + ' cm';
    document.getElementById('rc_distance_bar').style.width = Math.max(0, 100 - (frontDist / 2)) + '%';

    document.getElementById('rc_distance_total').textContent =
        (rcCarState.distanceTotalPx / 100).toFixed(1) + ' m';

    // slow battery drain while running
    const battEl = document.getElementById('rc_battery');
    let battV = parseFloat(battEl.textContent);
    if (rcCarState.speed !== 0) battV = Math.max(6.8, battV - 0.0006);
    battEl.textContent = battV.toFixed(1) + 'V';
    battEl.className = battV < 7.2 ? 'text-xl font-bold text-red-400 animate-pulse' : 'text-xl font-bold text-green-400';

    rcAnimId = requestAnimationFrame(rcAnimLoop);
}