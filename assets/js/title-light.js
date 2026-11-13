const title = document.querySelector('.header-text h1');
const silverRegion = document.querySelector('.silver-region');
const pointerStars = [...document.querySelectorAll('.star')].map((element) => ({
  element,
  x: parseFloat(element.style.left) / 100,
  y: parseFloat(element.style.top) / 100,
  radius: parseFloat(element.style.width) / 2,
}));
const highlightedStars = new Set();
let lightFrame = 0;
let cursorX = 0;
let cursorY = 0;

function clearTitleLight() {
  cancelAnimationFrame(lightFrame);
  lightFrame = 0;
  title.style.removeProperty('--light-x');
  title.style.removeProperty('--light-y');
  for (const star of highlightedStars) {
    star.style.removeProperty('--star-fill');
    star.style.removeProperty('--star-glow');
  }
  highlightedStars.clear();
}

window.addEventListener('pointermove', (event) => {
  if (event.pointerType === 'touch') return;
  cursorX = event.clientX;
  cursorY = event.clientY;
  if (lightFrame) return;

  lightFrame = requestAnimationFrame(() => {
    lightFrame = 0;
    const bounds = title.getBoundingClientRect();
    title.style.setProperty('--light-x', `${cursorX - bounds.left}px`);
    title.style.setProperty('--light-y', `${cursorY - bounds.top}px`);

    if (silverRegion?.matches(':hover')) {
      const filmBounds = silverRegion.getBoundingClientRect();
      silverRegion.style.setProperty('--film-x', `${cursorX - filmBounds.left}px`);
      silverRegion.style.setProperty('--film-y', `${cursorY - filmBounds.top}px`);
    }

    for (const star of pointerStars) {
      const dx = (cursorX - star.x * window.innerWidth - star.radius) / 320;
      const dy = (cursorY - star.y * window.innerHeight - star.radius) / 240;
      const strength = Math.max(0, 1 - Math.hypot(dx, dy));
      if (strength > 0) {
        star.element.style.setProperty('--star-fill',
          `radial-gradient(circle, rgba(${255 - strength * 45}, ${255 - strength * 15}, 255, ${0.8 + strength * 0.2}), rgba(${255 - strength * 185}, ${255 - strength * 90}, 255, ${0.8 + strength * 0.15}))`);
        star.element.style.setProperty('--star-glow',
          `brightness(${1 + strength * 0.35}) drop-shadow(0 0 4px rgba(100, 195, 255, ${strength})) drop-shadow(0 0 9px rgba(110, 200, 255, ${strength * 0.9}))`);
        highlightedStars.add(star.element);
      } else if (highlightedStars.delete(star.element)) {
        star.element.style.removeProperty('--star-fill');
        star.element.style.removeProperty('--star-glow');
      }
    }
  });
});

window.addEventListener('pointerout', (event) => {
  if (!event.relatedTarget) clearTitleLight();
});
window.addEventListener('scroll', clearTitleLight, { passive: true });
window.addEventListener('blur', clearTitleLight);
