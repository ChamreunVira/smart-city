const PAGE_FILES = {
  guide: "pages/guide.html",
  detect: "pages/detect.html",
  collect: "pages/collect.html",
  augment: "pages/augment.html",
  confusion: "pages/confusion.html",
  models: "pages/models.html",
  training: "pages/training.html",
  gradcam: "pages/gradcam.html",
  robot: "pages/robot.html",
  smartcity: "pages/smartcity.html",
  parking: "pages/parking.html",
  edge: "pages/edge.html",
  iot: "pages/iot.html",
  drone: "pages/drone.html",
  rccar: "pages/rccar.html",
  chatbot: "pages/chatbot.html",
};

const loadedPages = new Set();

/**
 * Fetches a page fragment once and injects it into #content,
 * appending it as a <div class="page" id="page-{id}"> if it
 * isn't already present.
 */
async function ensurePageLoaded(pageId) {
  if (loadedPages.has(pageId)) return;
  const path = PAGE_FILES[pageId];
  if (!path) {
    console.warn(`No page file registered for "${pageId}"`);
    return;
  }

  try {
    const res = await fetch(path);
    if (!res.ok) throw new Error(`Failed to fetch ${path}: ${res.status}`);
    const html = await res.text();

    const wrapper = document.createElement("div");
    wrapper.innerHTML = html.trim();

    const content = document.getElementById("content");
    // Each page-*.html file's root element should already carry
    // class="page" id="page-{pageId}" — just append it as-is.
    content.appendChild(wrapper.firstElementChild);
    loadedPages.add(pageId);
  } catch (err) {
    console.error(err);
    const content = document.getElementById("content");
    const fallback = document.createElement("div");
    fallback.className = "page";
    fallback.id = `page-${pageId}`;
    fallback.innerHTML = `<div class="card"><div class="card-title">Error</div><p style="color:var(--apple);margin-top:8px;">Could not load "${path}". Make sure you're running this from a local web server, not opening the file directly.</p></div>`;
    content.appendChild(fallback);
  }
}

/**
 * Wraps the original nav() behaviour: load the page fragment on
 * first visit, then defer to the existing nav() logic (defined in
 * script.js) which toggles .active classes on sidebar + page divs.
 */
async function navAsync(pageId) {
  await ensurePageLoaded(pageId);
  if (typeof nav === "function") {
    nav(pageId);
  }
}

// Pre-load the default landing page (guide) on startup so it's
// visible immediately without waiting on a click.
document.addEventListener("DOMContentLoaded", () => {
  ensurePageLoaded("guide");
});