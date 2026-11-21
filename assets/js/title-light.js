const title = document.querySelector('.header-text h1');
const pointerStars = [...document.querySelectorAll('.star')].map((element) => ({
  element,
  x: parseFloat(element.style.left) / 100,
  y: parseFloat(element.style.top) / 100,
  radius: parseFloat(element.style.width) / 2,
  trailSample: Math.random(),
}));
const starGrid = Array.from({ length: 100 }, () => []);
for (const star of pointerStars) {
  starGrid[Math.floor(star.y * 10) * 10 + Math.floor(star.x * 10)].push(star);
}
const highlightedStars = new Set();
let lightFrame = 0;
let cursorX = 0;
let cursorY = 0;

function clearTitleLight() {
  cancelAnimationFrame(lightFrame);
  lightFrame = 0;
  title.style.removeProperty('--light-x');
  title.style.removeProperty('--light-y');
  for (const { element } of highlightedStars) {
    element.style.removeProperty('--star-fill');
    element.style.removeProperty('--star-glow');
    element.style.removeProperty('--trail-opacity');
    element.classList.remove('has-light');
  }
  highlightedStars.clear();
}

function highlightStars(x, y, fieldBounds) {
  // Include the previous selection so stars that just left the glow are cleared.
  const nearby = new Set(highlightedStars);
  const minX = Math.max(0, Math.floor((x - fieldBounds.left - 326) / fieldBounds.width * 10));
  const maxX = Math.min(9, Math.floor((x - fieldBounds.left + 320) / fieldBounds.width * 10));
  const minY = Math.max(0, Math.floor((y - fieldBounds.top - 246) / fieldBounds.height * 10));
  const maxY = Math.min(9, Math.floor((y - fieldBounds.top + 240) / fieldBounds.height * 10));
  for (let row = minY; row <= maxY; row++) {
    for (let column = minX; column <= maxX; column++) {
      for (const star of starGrid[row * 10 + column]) nearby.add(star);
    }
  }
  for (const star of nearby) {
    const dx = (x - fieldBounds.left - star.x * fieldBounds.width - star.radius) / 320;
    const dy = (y - fieldBounds.top - star.y * fieldBounds.height - star.radius) / 240;
    const strength = Math.abs(dx) >= 1 || Math.abs(dy) >= 1 ? 0 : Math.max(0, 1 - Math.hypot(dx, dy));
    if (strength > 0) {
      star.element.style.setProperty('--star-fill',
        `radial-gradient(circle, rgba(${255 - strength * 45}, ${255 - strength * 15}, 255, ${0.8 + strength * 0.2}), rgba(${255 - strength * 185}, ${255 - strength * 90}, 255, ${0.8 + strength * 0.15}))`);
      star.element.style.setProperty('--star-glow',
        `brightness(${1 + strength * 0.35}) drop-shadow(0 0 4px rgba(100, 195, 255, ${strength})) drop-shadow(0 0 9px rgba(110, 200, 255, ${strength * 0.9}))`);
      if (star.trailSample < 0.23) {
        star.element.style.setProperty('--trail-opacity', strength * 0.6);
        star.element.classList.add('has-light');
      } else {
        star.element.style.removeProperty('--trail-opacity');
        star.element.classList.remove('has-light');
      }
      highlightedStars.add(star);
    } else if (highlightedStars.delete(star)) {
      star.element.style.removeProperty('--star-fill');
      star.element.style.removeProperty('--star-glow');
      star.element.style.removeProperty('--trail-opacity');
      star.element.classList.remove('has-light');
    }
  }
}

window.addEventListener('pointermove', (event) => {
  if (event.pointerType === 'touch' && !event.target.closest('.header-text h1')) return;
  const isTouch = event.pointerType === 'touch';
  cursorX = event.clientX;
  cursorY = event.clientY;
  if (lightFrame) return;

  lightFrame = requestAnimationFrame(() => {
    lightFrame = 0;
    const bounds = title.getBoundingClientRect();
    const fieldBounds = isTouch ? null : starfield.getBoundingClientRect();
    title.style.setProperty('--light-x', `${cursorX - bounds.left}px`);
    title.style.setProperty('--light-y', `${cursorY - bounds.top}px`);

    if (isTouch) return;

    highlightStars(cursorX, cursorY, fieldBounds);
  });
});

title.addEventListener('pointerdown', (event) => {
  if (event.pointerType !== 'touch') return;
  const bounds = title.getBoundingClientRect();
  title.style.setProperty('--light-x', `${event.clientX - bounds.left}px`);
  title.style.setProperty('--light-y', `${event.clientY - bounds.top}px`);
});
window.addEventListener('pointerup', (event) => {
  if (event.pointerType === 'touch') clearTitleLight();
});
window.addEventListener('pointercancel', (event) => {
  if (event.pointerType === 'touch') clearTitleLight();
});

window.addEventListener('pointerout', (event) => {
  if (!event.relatedTarget) clearTitleLight();
});
window.addEventListener('scroll', clearTitleLight, { passive: true });
window.addEventListener('blur', clearTitleLight);
