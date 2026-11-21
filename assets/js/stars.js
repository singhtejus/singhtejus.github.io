const starfield = document.getElementById('starfield');
const starColors = ['#72aaff', '#b8334c', '#ffd77a', '#a9caff', '#edb69b'];

function sizeSkyToScreen() {
  starfield.style.setProperty('--screen-height', `${window.screen.height}px`);
}

sizeSkyToScreen();
window.addEventListener('resize', sizeSkyToScreen);

// At the very top of the document Safari can only extend its fallback color.
// Start inside the painted area, respecting deep links and restored positions.
const skyMargin = parseFloat(getComputedStyle(document.body).getPropertyValue('--sky-margin'));
if (skyMargin && !location.hash && window.scrollY === 0) {
  window.scrollTo({ top: skyMargin, behavior: 'instant' });
}

for (let i = 0; i < 190; i++) {
  const star = document.createElement('div');
  star.className = 'star';

  const size = Math.random() * 3.5 + 2.2;

  star.style.width = `${size}px`;
  star.style.height = `${size}px`;
  star.style.left = `${Math.random() * 100}%`;
  star.style.top = `${Math.random() * 100}%`;
  star.style.animationDuration = `${4 + Math.random() * 8}s`;
  star.style.animationDelay = `${Math.random() * 6}s`;

  const color = document.createElement('span');
  color.className = 'star-color';
  color.style.backgroundColor = starColors[Math.floor(Math.random() * starColors.length)];
  star.appendChild(color);

  starfield.appendChild(star);
}

const shootingStar = document.createElement('div');
shootingStar.className = 'shooting-star';
starfield.appendChild(shootingStar);

shootingStar.addEventListener('animationend', () => {
  shootingStar.classList.remove('active');
});

function launchShootingStar() {
  const startTop = Math.random() * 55;
  const startLeft = -200 - Math.random() * 200;

  shootingStar.style.top = `${startTop}%`;
  shootingStar.style.left = `${startLeft}px`;

  shootingStar.classList.add('active');

  const nextDelay = 4000 + Math.random() * 10000;
  setTimeout(launchShootingStar, nextDelay);
}

setTimeout(launchShootingStar, 3000);

const mobileGlow = matchMedia('(hover: none) and (pointer: coarse) and (prefers-reduced-motion: no-preference)');
const stars = [...starfield.querySelectorAll('.star')];
const starPositions = new Map(stars.map(star => [star, {
  x: parseFloat(star.style.left) / 100,
  y: parseFloat(star.style.top) / 100,
  size: parseFloat(star.style.width),
}]));
const desktopGlow = matchMedia('(hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)');
const risingRayStars = new Set();
const fadingRayStars = new Set();
const coolingRayStars = new Map();
const twinkleAnimations = new WeakMap();

function updateRays() {
  if ((!desktopGlow.matches && !mobileGlow.matches) || document.hidden) {
    for (const star of [...risingRayStars, ...fadingRayStars]) star.classList.remove('ambient-lit', 'is-lit');
    risingRayStars.clear();
    fadingRayStars.clear();
    coolingRayStars.clear();
    return;
  }
  const mobile = mobileGlow.matches;
  const targetCount = mobile ? Math.round(stars.length * 0.18) : 7;
  const glowClass = mobile ? 'is-lit' : 'ambient-lit';
  const extinguished = [];
  const phase = star => {
    let animation = twinkleAnimations.get(star);
    if (!animation) {
      animation = star.getAnimations().find(item => item.animationName === 'twinkle');
      if (animation) twinkleAnimations.set(star, animation);
    }
    return animation?.effect?.getComputedTiming().progress;
  };
  for (const star of risingRayStars) {
    const progress = phase(star);
    if (progress == null || progress >= 0.5) {
      risingRayStars.delete(star);
      fadingRayStars.add(star);
    }
  }
  for (const star of fadingRayStars) {
    const progress = phase(star);
    if (progress == null || progress >= 0.7 || progress < 0.5) {
      extinguished.push(star);
      fadingRayStars.delete(star);
      coolingRayStars.set(star, performance.now() + 1000);
    }
  }
  for (const [star, until] of coolingRayStars) {
    if (performance.now() >= until) coolingRayStars.delete(star);
  }
  const needsCandidates = risingRayStars.size + fadingRayStars.size + coolingRayStars.size < targetCount;
  const fieldBounds = needsCandidates && !mobile ? starfield.getBoundingClientRect() : null;
  const candidates = needsCandidates ? stars.filter(star => {
    if (risingRayStars.has(star) || fadingRayStars.has(star) || coolingRayStars.has(star)) return false;
    const progress = phase(star);
    if (progress == null || progress >= 0.35) return false;
    if (mobile) return true;
    const { x, y, size } = starPositions.get(star);
    const left = fieldBounds.left + x * fieldBounds.width;
    const top = fieldBounds.top + y * fieldBounds.height;
    // Include the maximum twinkle scale when checking the viewport.
    return left + size * 1.8 > 0 && left - size * 0.4 < window.innerWidth &&
      top + size * 1.8 > 0 && top - size * 0.4 < window.innerHeight;
  }) : [];
  for (const star of extinguished) star.classList.remove('ambient-lit', 'is-lit');
  while (risingRayStars.size + fadingRayStars.size + coolingRayStars.size < targetCount && candidates.length) {
    const [star] = candidates.splice(Math.floor(Math.random() * candidates.length), 1);
    star.classList.add(glowClass);
    risingRayStars.add(star);
  }
}

let rayTimer;

function scheduleRays() {
  clearInterval(rayTimer);
  rayTimer = undefined;
  if (document.hidden || (!desktopGlow.matches && !mobileGlow.matches)) {
    updateRays();
    return;
  }
  updateRays();
  rayTimer = setInterval(updateRays, 250);
}

window.addEventListener('pageshow', scheduleRays);
window.addEventListener('pagehide', () => clearInterval(rayTimer));
document.addEventListener('visibilitychange', scheduleRays);
desktopGlow.addEventListener('change', scheduleRays);
mobileGlow.addEventListener('change', scheduleRays);
