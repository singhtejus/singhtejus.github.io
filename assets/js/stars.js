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

function launchShootingStar() {
  shootingStar.classList.remove('active');

  const startTop = Math.random() * 55;
  const startLeft = -200 - Math.random() * 200;

  shootingStar.style.top = `${startTop}%`;
  shootingStar.style.left = `${startLeft}px`;

  void shootingStar.offsetWidth;

  shootingStar.classList.add('active');

  const nextDelay = 4000 + Math.random() * 10000;
  setTimeout(launchShootingStar, nextDelay);
}

setTimeout(launchShootingStar, 3000);

const mobileGlow = matchMedia('(hover: none) and (pointer: coarse) and (prefers-reduced-motion: no-preference)');
const stars = [...starfield.querySelectorAll('.star')];
const panels = document.querySelectorAll('.floating-nav, .picture-frame, .silver-region, .previous-experiences > li, .resume');

function lightVisibleStars() {
  if (!mobileGlow.matches || document.hidden) return;
  const viewport = window.visualViewport;
  const left = viewport?.offsetLeft ?? 0;
  const top = viewport?.offsetTop ?? 0;
  const right = left + (viewport?.width ?? window.innerWidth);
  const bottom = top + (viewport?.height ?? window.innerHeight);
  const covers = Array.from(panels, panel => panel.getBoundingClientRect());
  const visible = stars.filter(star => {
    const rect = star.getBoundingClientRect();
    const x = rect.left + rect.width / 2;
    const y = rect.top + rect.height / 2;
    return x >= left && x < right && y >= top && y < bottom &&
      !covers.some(box => x >= box.left && x < box.right && y >= box.top && y < box.bottom);
  });

  const count = Math.round(visible.length * 0.2);
  const lit = [];
  for (let i = 0; i < count; i++) {
    const index = Math.floor(Math.random() * visible.length);
    const [star] = visible.splice(index, 1);
    star.classList.add('is-lit');
    lit.push(star);
  }
  setTimeout(() => lit.forEach(star => star.classList.remove('is-lit')), 4000);
}

window.addEventListener('pageshow', () => {
  requestAnimationFrame(lightVisibleStars);
  setInterval(lightVisibleStars, 9000);
}, { once: true });
