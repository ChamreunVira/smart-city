const pageCache = {};
const pageFiles = {
    augment: 'augument.html',
};

function setActiveSidebar(pageName) {
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.toggle('active', item.dataset.page === pageName || item.getAttribute('onclick')?.includes(`'${pageName}'`));
    });
}

async function loadPage(pageName) {
    const content = document.getElementById('content');
    if (!content) return;
    setActiveSidebar(pageName);
    if (typeof activePage !== 'undefined') activePage = pageName;
    window.activePage = pageName;

    if (pageCache[pageName]) {
        content.innerHTML = pageCache[pageName];
        initializePage(pageName);
        return;
    }

    try {
        const response = await fetch(pageFiles[pageName] || `${pageName}.html`);
        if (!response.ok) throw new Error(`Page ${pageName} not found`);
        const html = await response.text();
        pageCache[pageName] = html;
        content.innerHTML = html;
        const page = content.querySelector('.page');
        if (page) page.classList.add('active');
        initializePage(pageName);
    } catch (error) {
        console.error('Error loading page:', error);
        content.innerHTML = `
            <div class="card">
                <div class="card-header">
                    <div class="card-title">⚠️ Page Error</div>
                </div>
                <p class="text-red-400">Could not load page: ${pageName}</p>
                <p class="text-gray-400 text-xs mt-2">Error: ${error.message}</p>
            </div>
        `;
    }
}

function initializePage(pageName) {
    switch(pageName) {
        case 'guide':
            if (typeof goSlide === 'function') setTimeout(() => goSlide(0), 0);
            break;
        case 'rccar':
            if (typeof initRCCar === 'function') {
                setTimeout(initRCCar, 100);
            }
            break;
        case 'parking':
            if (typeof initParkingSimulator === 'function') {
                setTimeout(initParkingSimulator, 100);
            }
            break;
        case 'detect':
            if (typeof renderDetection === 'function') setTimeout(renderDetection, 100);
            break;
        case 'collect':
            if (typeof renderCollectStudio === 'function') setTimeout(renderCollectStudio, 100);
            break;
        case 'augment':
            if (typeof initAug === 'function') setTimeout(initAug, 100);
            break;
        case 'confusion':
            if (typeof updateConfusionMatrixLogic === 'function') setTimeout(updateConfusionMatrixLogic, 100);
            break;
        case 'models':
            if (typeof drawTradeoff === 'function') setTimeout(drawTradeoff, 100);
            break;
        case 'gradcam':
            if (typeof showGradCam === 'function') setTimeout(() => showGradCam('banana'), 100);
            break;
        case 'robot':
            if (typeof animateRobotSorting === 'function') setTimeout(animateRobotSorting, 100);
            break;
        case 'smartcity':
            if (typeof initCityDashboard === 'function') setTimeout(initCityDashboard, 100);
            if (typeof renderCity === 'function') setTimeout(renderCity, 100);
            break;
        case 'edge':
            if (typeof initEdgeDashboard === 'function') setTimeout(initEdgeDashboard, 100);
            break;
        case 'iot':
            if (typeof drawCSMqttSimulation === 'function') setTimeout(drawCSMqttSimulation, 100);
            break;
        case 'drone':
            if (typeof initDroneLab === 'function') setTimeout(initDroneLab, 100);
            break;
        default:
            break;
    }
}

// Navigation function
function nav(pageName) {
    loadPage(pageName);
}

// Load initial page
document.addEventListener('DOMContentLoaded', () => {
    loadPage('guide');
});

// Theme toggle
function toggleTheme() {
    if (typeof applyTheme === 'function') {
        applyTheme(document.body.classList.contains('light-theme') ? 'dark' : 'light');
    }
}