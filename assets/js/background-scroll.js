const mobileBackground = window.matchMedia('(max-width: 700px)');
let backgroundFrame = 0;

function updateBackgroundPosition() {
  backgroundFrame = 0;
  document.documentElement.style.setProperty('--background-scroll', `${mobileBackground.matches ? window.scrollY : 0}px`);
}

function scheduleBackgroundPosition() {
  if (!backgroundFrame) backgroundFrame = requestAnimationFrame(updateBackgroundPosition);
}

window.addEventListener('scroll', scheduleBackgroundPosition, { passive: true });
window.addEventListener('resize', scheduleBackgroundPosition);
window.addEventListener('pageshow', scheduleBackgroundPosition);
mobileBackground.addEventListener('change', scheduleBackgroundPosition);
updateBackgroundPosition();
