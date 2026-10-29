const subjectData = [
  { name: "Discrete Mathematics", qa: 68706, books: 312, chapters: 10879 },
  { name: "Mathematical Analysis", qa: 66569, books: 308, chapters: 11777 },
  { name: "Advanced Algebra", qa: 33936, books: 178, chapters: 5647 },
  { name: "Abstract Algebra", qa: 32181, books: 167, chapters: 5544 },
  { name: "Olympiad Textbooks", qa: 26899, books: 37, chapters: 862 },
  { name: "Differential Geometry", qa: 23411, books: 154, chapters: 5420 },
  { name: "Probability Theory", qa: 21896, books: 190, chapters: 5414 },
  { name: "Topology", qa: 18083, books: 111, chapters: 3335 },
  { name: "Functional Analysis", qa: 14022, books: 50, chapters: 1839 },
  { name: "Partial Differential Eq.", qa: 13802, books: 107, chapters: 3622 },
  { name: "Complex Analysis", qa: 9930, books: 42, chapters: 1668 },
  { name: "Operations Research", qa: 8558, books: 67, chapters: 1795 }
];

const chart = document.querySelector("#subject-chart");
const metricButtons = document.querySelectorAll(".metric-switch button");

function renderChart(metric = "qa") {
  const rows = [...subjectData].sort((a, b) => b[metric] - a[metric]).slice(0, 10);
  const max = rows[0][metric];
  chart.innerHTML = rows.map((row) => `
    <div class="bar-row" title="${row.name}: ${row[metric].toLocaleString()}">
      <span class="bar-name">${row.name}</span>
      <span class="bar-track"><i class="bar-fill" style="--bar-width:${(row[metric] / max * 100).toFixed(1)}%"></i></span>
      <span class="bar-value">${row[metric].toLocaleString("en-US")}</span>
    </div>
  `).join("");
}

metricButtons.forEach((button) => {
  button.addEventListener("click", () => {
    metricButtons.forEach((item) => {
      const selected = item === button;
      item.classList.toggle("active", selected);
      item.setAttribute("aria-pressed", String(selected));
    });
    renderChart(button.dataset.metric);
  });
});

const sampleTabs = [...document.querySelectorAll(".subject-tabs [role='tab']")];
const samplePanels = [...document.querySelectorAll(".sample-panel")];

function selectSample(tab, moveFocus = false) {
  const target = tab.dataset.sample;
  sampleTabs.forEach((item) => {
    const selected = item === tab;
    item.classList.toggle("active", selected);
    item.setAttribute("aria-selected", String(selected));
    item.tabIndex = selected ? 0 : -1;
  });
  samplePanels.forEach((panel) => {
    const selected = panel.dataset.panel === target;
    panel.hidden = !selected;
    panel.classList.toggle("active", selected);
    if (selected && window.MathJax?.typesetPromise) {
      window.MathJax.typesetClear?.([panel]);
      window.MathJax.typesetPromise([panel]).catch(() => {});
    }
  });
  if (moveFocus) tab.focus();
}

sampleTabs.forEach((tab, index) => {
  tab.addEventListener("click", () => selectSample(tab));
  tab.addEventListener("keydown", (event) => {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    let nextIndex = index;
    if (event.key === "ArrowRight") nextIndex = (index + 1) % sampleTabs.length;
    if (event.key === "ArrowLeft") nextIndex = (index - 1 + sampleTabs.length) % sampleTabs.length;
    if (event.key === "Home") nextIndex = 0;
    if (event.key === "End") nextIndex = sampleTabs.length - 1;
    selectSample(sampleTabs[nextIndex], true);
  });
});

const observer = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    if (entry.isIntersecting) {
      entry.target.classList.add("visible");
      observer.unobserve(entry.target);
    }
  });
}, { threshold: 0.1 });

document.querySelectorAll(".reveal").forEach((element) => observer.observe(element));
renderChart();

// The final value stays in the text node throughout the animation. Only a
// non-selectable CSS overlay changes, so copying always returns the real data.
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
const activeCounters = new Map();

function finishCounter(element) {
  const frame = activeCounters.get(element);
  if (frame !== undefined) cancelAnimationFrame(frame);
  activeCounters.delete(element);
  element.classList.remove("is-counting");
  delete element.dataset.frame;
}

function animateCounter(element) {
  if (reducedMotion.matches || document.hidden) return;
  const value = Number(element.dataset.count);
  const decimals = Number(element.dataset.decimals || 0);
  const prefix = element.dataset.prefix || "";
  const format = new Intl.NumberFormat("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  });
  const started = performance.now();
  const tick = (now) => {
    // Let the existing reveal begin before the numbers start moving.
    const progress = Math.min(Math.max((now - started - 180) / 1150, 0), 1);
    if (progress >= 1 || reducedMotion.matches) {
      finishCounter(element);
      return;
    }
    element.dataset.frame = prefix + format.format(value * (1 - (1 - progress) ** 3));
    element.classList.add("is-counting");
    activeCounters.set(element, requestAnimationFrame(tick));
  };
  activeCounters.set(element, requestAnimationFrame(tick));
}

const counterObserver = new IntersectionObserver((entries) => {
  entries.forEach(({ target, isIntersecting }) => {
    if (!isIntersecting) return;
    counterObserver.unobserve(target);
    animateCounter(target);
  });
}, { threshold: 0.5 });
document.querySelectorAll(".count-up").forEach((element) => counterObserver.observe(element));

document.addEventListener("pointerdown", (event) => {
  const counter = event.target.closest?.(".count-up");
  if (counter) finishCounter(counter);
});
const finishAllCounters = () => [...activeCounters.keys()].forEach(finishCounter);
document.addEventListener("copy", finishAllCounters);
document.addEventListener("visibilitychange", () => {
  if (document.hidden) finishAllCounters();
});

// Embed SVG documents so their real <text>/<tspan> labels can be selected.
// Draw curves and reveal bars once when their figure enters the viewport.
const svgNamespace = "http://www.w3.org/2000/svg";
const svgObjects = [...document.querySelectorAll("[data-svg-figure]")];
const animatedDocuments = new WeakSet();
const wiredSvgDocuments = new WeakSet();
const activeSvgAnimations = new Set();

function animateSvg(object) {
  const doc = object.contentDocument;
  if (!doc || doc.documentElement.localName !== "svg" || !object.dataset.entered || animatedDocuments.has(doc)) return;
  animatedDocuments.add(doc);
  object.dataset.svgState = reducedMotion.matches ? "static" : "animated";
  if (reducedMotion.matches) return;
  const root = doc.documentElement;
  const lines = [...doc.querySelectorAll("[data-animate-line]")];
  lines.forEach((path, index) => {
    // Preserve the original dash pattern used to distinguish schedules.
    // A clipping rectangle reveals the complete original stroke and markers.
    revealSvgPath(path, root, 1000, index % 4 * 65);
  });
  [...doc.querySelectorAll("[data-animate-bar]")].forEach((path, index) => {
    revealSvgPath(path, root, 950, index * 35);
  });
}

function revealSvgPath(path, root, duration, delay) {
  const box = path.getBBox();
  if (!box.width) return;
  const clip = path.ownerDocument.createElementNS(svgNamespace, "clipPath");
  clip.id = `sweep-${Math.random().toString(36).slice(2)}`;
  clip.setAttribute("clipPathUnits", "userSpaceOnUse");
  const rect = path.ownerDocument.createElementNS(svgNamespace, "rect");
  // Include stroke edges. All coordinates share the path's local transform.
  rect.setAttribute("x", box.x - 2);
  rect.setAttribute("y", box.y - 2);
  rect.setAttribute("height", box.height + 4);
  rect.setAttribute("width", 0);
  clip.append(rect);
  root.append(clip);
  const originalClip = path.getAttribute("clip-path");
  path.setAttribute("clip-path", `url(#${clip.id})`);
  const started = performance.now();
  const state = { frame: null, finish: null };
  state.finish = () => {
    cancelAnimationFrame(state.frame);
    if (originalClip === null) path.removeAttribute("clip-path");
    else path.setAttribute("clip-path", originalClip);
    clip.remove();
    activeSvgAnimations.delete(state);
  };
  const tick = (now) => {
    const progress = Math.min(Math.max((now - started - delay) / duration, 0), 1);
    if (progress >= 1 || reducedMotion.matches || !path.isConnected) {
      state.finish();
      return;
    }
    rect.setAttribute("width", (box.width + 4) * (1 - (1 - progress) ** 3));
    state.frame = requestAnimationFrame(tick);
  };
  activeSvgAnimations.add(state);
  state.frame = requestAnimationFrame(tick);
}

const svgObserver = new IntersectionObserver((entries) => {
  entries.forEach(({ target, isIntersecting }) => {
    if (!isIntersecting) return;
    target.dataset.entered = "true";
    svgObserver.unobserve(target);
    animateSvg(target);
  });
}, { threshold: 0.12 });

const mobileFigures = window.matchMedia("(max-width: 580px)");
function updateFigureSources() {
  svgObjects.forEach((object) => {
    object.dataset.desktop ||= object.getAttribute("data");
    const source = mobileFigures.matches && object.dataset.mobile ? object.dataset.mobile : object.dataset.desktop;
    if (object.getAttribute("data") !== source) object.setAttribute("data", source);
  });
}
function prepareSvg(object) {
  const doc = object.contentDocument;
  if (!doc || doc.documentElement.localName !== "svg") return;
  if (!wiredSvgDocuments.has(doc)) {
    wiredSvgDocuments.add(doc);
    object.dataset.svgState = "ready";
    // Finish drawing as soon as a reader starts selecting figure text.
    doc.addEventListener("pointerdown", () => {
      [...activeSvgAnimations].forEach((state) => state.finish());
    });
    doc.addEventListener("copy", (event) => {
      const text = doc.getSelection()?.toString();
      if (!text || !event.clipboardData) return;
      event.clipboardData.setData("text/plain", text);
      event.preventDefault();
    });
  }
  animateSvg(object);
}
svgObjects.forEach((object) => {
  object.addEventListener("load", () => prepareSvg(object));
  prepareSvg(object);
  svgObserver.observe(object);
});
updateFigureSources();
mobileFigures.addEventListener("change", updateFigureSources);
reducedMotion.addEventListener("change", () => {
  if (!reducedMotion.matches) return;
  finishAllCounters();
  [...activeSvgAnimations].forEach((state) => state.finish());
});
