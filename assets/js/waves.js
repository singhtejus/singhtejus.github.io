if (!window.waveGPU) {
const waveCanvas = document.querySelector('.wave');
const waveSection = document.querySelector('.header');
const waveContext = waveCanvas.getContext('2d');
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
let width, height, current, previous, pixels;
let waveFrame = 0;
let visible = false;
let introPresent = false;
let waveActivity = 0;
let sizeDamping = 1;
let waveActive = false;
let rippleTimer, hasEntered = false;

function resizeWave() {
  sizeDamping = 1 - 0.012 * (1 - Math.min(waveSection.clientWidth / 900, 1));
  const newWidth = Math.max(2, Math.round(waveSection.clientWidth / 8));
  const newHeight = Math.max(2, Math.round(waveSection.clientHeight / 8));
  if (newWidth === width && newHeight === height) return;
  width = newWidth;
  height = newHeight;
  waveCanvas.width = width;
  waveCanvas.height = height;
  current = new Float32Array(width * height);
  previous = new Float32Array(width * height);
  pixels = waveContext.createImageData(width, height);
  waveActivity = 0;
  waveActive = false;
}

function disturbWave(x, y) {
  waveActivity += 1;
  waveActive = true;
  for (let dy = -2; dy <= 2; dy++) {
    for (let dx = -2; dx <= 2; dx++) {
      const px = x + dx;
      const py = y + dy;
      if (px > 0 && px < width - 1 && py > 0 && py < height - 1) {
        current[py * width + px] += 1.5 * Math.exp(-(dx * dx + dy * dy) / 4);
      }
    }
  }
  scheduleRipple();
}

function randomRipple() {
  disturbWave(Math.floor(width * (0.2 + Math.random() * 0.6)),
    Math.floor(height * (0.2 + Math.random() * 0.6)));
  if (!waveFrame) updateWave();
}

function scheduleRipple() {
  clearTimeout(rippleTimer);
  if (introPresent && !reducedMotion.matches && !document.hidden) {
    rippleTimer = setTimeout(randomRipple, 30000);
  }
}

function drawWave() {
  let strongestSlope = 0;
  const damping = waveActivity > 3 ? 0.97 : 0.995;
  waveActivity *= damping;
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const i = y * width + x;
      // The center and four neighbors form the five-point Laplacian.
      const laplacian = current[i - 1] + current[i + 1] + current[i - width] + current[i + width] - 4 * current[i];
      previous[i] = (2 * current[i] - previous[i] + 0.1 * laplacian) * damping * sizeDamping;
      const slopeX = current[i - 1] - current[i + 1];
      const slopeY = current[i - width] - current[i + width];
      const slope = slopeX + slopeY;
      strongestSlope = Math.max(strongestSlope, Math.abs(slope));
      const magnitude = Math.hypot(slopeX, slopeY);
      const strength = Math.max(Math.abs(slope), magnitude * 0.35);
      const alpha = Math.min(95, strength * 180);
      const direction = slope / Math.max(Math.SQRT2 * magnitude, 0.0001);
      const blend = Math.max(0, Math.min(1, (direction + 0.65) / 1.3));
      const light = blend * blend * (3 - 2 * blend);
      const p = i * 4;
      pixels.data[p] = 25 + 160 * light;
      pixels.data[p + 1] = 25 + 200 * light;
      pixels.data[p + 2] = 25 + 230 * light;
      pixels.data[p + 3] = alpha;
    }
  }
  [current, previous] = [previous, current];
  // Extend the rendered edge without changing the simulation's fixed boundary.
  for (let y = 1; y < height - 1; y++) {
    const row = y * width * 4;
    pixels.data.copyWithin(row, row + 4, row + 8);
    pixels.data.copyWithin(row + (width - 1) * 4, row + (width - 2) * 4, row + (width - 1) * 4);
  }
  pixels.data.copyWithin(0, width * 4, width * 8);
  pixels.data.copyWithin((height - 1) * width * 4, (height - 2) * width * 4, (height - 1) * width * 4);
  waveContext.putImageData(pixels, 0, 0);
  waveFrame = 0;
  if (strongestSlope > 0.006) {
    waveFrame = requestAnimationFrame(drawWave);
  } else {
    waveContext.clearRect(0, 0, width, height);
    current.fill(0);
    previous.fill(0);
    waveActivity = 0;
    waveActive = false;
    if (introPresent && !reducedMotion.matches && !document.hidden) randomRipple();
  }
}

function updateWave() {
  cancelAnimationFrame(waveFrame);
  waveFrame = 0;
  if (visible && waveActive && !reducedMotion.matches && !document.hidden) waveFrame = requestAnimationFrame(drawWave);
}

waveSection.addEventListener('click', (event) => {
  if (reducedMotion.matches) return;
  const bounds = waveSection.getBoundingClientRect();
  disturbWave(Math.floor((event.clientX - bounds.left) / bounds.width * width),
    Math.floor((event.clientY - bounds.top) / bounds.height * height));
  if (!waveFrame) updateWave();
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
if (!reducedMotion.matches) randomRipple();
}
