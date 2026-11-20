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

function resizeWave() {
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
}

function disturbWave(x, y) {
  waveActivity += 1;
  for (let dy = -2; dy <= 2; dy++) {
    for (let dx = -2; dx <= 2; dx++) {
      const px = x + dx;
      const py = y + dy;
      if (px > 0 && px < width - 1 && py > 0 && py < height - 1) {
        current[py * width + px] += 1.5 * Math.exp(-(dx * dx + dy * dy) / 4);
      }
    }
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
      previous[i] = (2 * current[i] - previous[i] + 0.1 * laplacian) * damping;
      const slope = current[i - 1] - current[i + 1] + current[i - width] - current[i + width];
      strongestSlope = Math.max(strongestSlope, Math.abs(slope));
      const alpha = Math.min(95, Math.abs(slope) * 180);
      const p = i * 4;
      pixels.data[p] = slope > 0 ? 185 : 25;
      pixels.data[p + 1] = slope > 0 ? 225 : 25;
      pixels.data[p + 2] = slope > 0 ? 255 : 25;
      pixels.data[p + 3] = alpha;
    }
  }
  [current, previous] = [previous, current];
  waveContext.putImageData(pixels, 0, 0);
  waveFrame = 0;
  if (strongestSlope > 0.006) {
    waveFrame = requestAnimationFrame(drawWave);
  } else {
    waveContext.clearRect(0, 0, width, height);
    current.fill(0);
    previous.fill(0);
    waveActivity = 0;
  }
}

function updateWave() {
  cancelAnimationFrame(waveFrame);
  waveFrame = 0;
  if (visible && !reducedMotion.matches) waveFrame = requestAnimationFrame(drawWave);
}

waveSection.addEventListener('click', (event) => {
  if (reducedMotion.matches) return;
  const bounds = waveSection.getBoundingClientRect();
  disturbWave(Math.floor((event.clientX - bounds.left) / bounds.width * width),
    Math.floor((event.clientY - bounds.top) / bounds.height * height));
  if (!waveFrame) updateWave();
});
setInterval(() => {
  if (!introPresent || waveFrame || reducedMotion.matches || document.hidden) return;
  disturbWave(Math.floor(width * (0.2 + Math.random() * 0.6)),
    Math.floor(height * (0.2 + Math.random() * 0.6)));
  if (!waveFrame) updateWave();
}, 30000);
window.addEventListener('resize', resizeWave);
reducedMotion.addEventListener('change', updateWave);
new IntersectionObserver(([entry]) => {
  visible = entry.isIntersecting && entry.intersectionRatio > 0;
  introPresent = entry.intersectionRatio >= 0.5;
  updateWave();
}, { threshold: [0, 0.5] }).observe(waveSection);
resizeWave();
disturbWave(Math.floor(width * (0.2 + Math.random() * 0.6)), Math.floor(height * (0.2 + Math.random() * 0.6)));
updateWave();
}
