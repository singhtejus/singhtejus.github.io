if (!window.waveGPU) {
let waveCanvas = document.querySelector('.wave');
const waveSection = document.querySelector('.header');
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
let width, height, outputWidth, outputHeight;
let setLocalRunning;
let visible = false;
let introPresent = false;
let worker, engine, generation = 0;
let transferred = false;
function useLocalEngine() {
  worker?.terminate();
  worker = null;
  if (transferred) {
    const replacement = waveCanvas.cloneNode();
    waveCanvas.replaceWith(replacement);
    waveCanvas = replacement;
  }
  engine = createWaveEngine(waveCanvas);
  setLocalRunning = createWaveLoop(engine, finishWave);
}
try {
  if (!waveCanvas.transferControlToOffscreen) throw Error();
  worker = new Worker(new URL('wave-worker.js', document.currentScript.src));
  const canvas = waveCanvas.transferControlToOffscreen();
  transferred = true;
  worker.postMessage({ canvas }, [canvas]);
  worker.onerror = () => {
    useLocalEngine();
    outputWidth = undefined;
    resizeWave();
    if (introPresent && !reducedMotion.matches && !document.hidden) randomRipple();
  };
  worker.onmessage = ({ data }) => {
    if (data.fallback) worker.onerror();
    else if (data.generation === generation) finishWave();
  };
} catch {
  useLocalEngine();
}
let waveActive = false;
let rippleTimer, hasEntered = false;

function resizeWave() {
  const w = waveSection.clientWidth, h = waveSection.clientHeight;
  if (w === outputWidth && h === outputHeight) return;
  outputWidth = w;
  outputHeight = h;
  width = Math.max(2, Math.round(w / waveCellSize));
  height = Math.max(2, Math.round(h / waveCellSize));
  generation++;
  waveActive = false;
  updateWave();
  if (worker) worker.postMessage({ w, h });
  else engine.resizeWave(w, h);
}

function disturbWave(x, y, lift = 1) {
  generation++;
  waveActive = true;
  if (worker) worker.postMessage({ x, y, generation, lift });
  else engine.disturbWave(x, y, lift);
  scheduleRipple();
}

function randomRipple(lift = 1) {
  disturbWave(Math.floor(width * (0.2 + Math.random() * 0.6)),
    Math.floor(height * (0.2 + Math.random() * 0.6)), lift);
  updateWave();
}

function scheduleRipple() {
  clearTimeout(rippleTimer);
  if (introPresent && !reducedMotion.matches && !document.hidden) {
    rippleTimer = setTimeout(randomRipple, 30000);
  }
}

function finishWave() {
  waveActive = false;
  if (introPresent && !reducedMotion.matches && !document.hidden) randomRipple();
}

function updateWave() {
  const running = visible && waveActive && !reducedMotion.matches && !document.hidden;
  if (worker) worker.postMessage({ running });
  else setLocalRunning(running);
}

waveSection.addEventListener('click', (event) => {
  if (reducedMotion.matches) return;
  const bounds = waveSection.getBoundingClientRect();
  disturbWave(Math.floor((event.clientX - bounds.left) / bounds.width * width),
    Math.floor((event.clientY - bounds.top) / bounds.height * height));
  updateWave();
});
window.addEventListener('resize', () => {
  resizeWave();
  if (introPresent && !waveActive && !reducedMotion.matches && !document.hidden) randomRipple();
});
document.addEventListener('visibilitychange', () => {
  scheduleRipple();
  updateWave();
});
reducedMotion.addEventListener('change', () => {
  if (introPresent && !waveActive && !reducedMotion.matches && !document.hidden) randomRipple();
  else { scheduleRipple(); updateWave(); }
});
new IntersectionObserver(([entry]) => {
  const wasPresent = introPresent;
  visible = entry.isIntersecting && entry.intersectionRatio > 0;
  introPresent = entry.intersectionRatio >= 0.5;
  if (introPresent && !wasPresent) {
    if ((hasEntered || !waveActive) && !reducedMotion.matches && !document.hidden) randomRipple();
    else scheduleRipple();
    hasEntered = true;
  } else if (!introPresent) {
    clearTimeout(rippleTimer);
  }
  updateWave();
}, { threshold: [0, 0.5] }).observe(waveSection);
resizeWave();
if (!reducedMotion.matches) randomRipple(1.3);
}
