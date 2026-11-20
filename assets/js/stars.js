const starfield = document.getElementById('starfield');

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
