const sectionLinks = [...document.querySelectorAll('.floating-nav a[href^="#"]')].map((link) => ({
  link,
  section: document.querySelector(link.getAttribute('href')),
}));
let navigationFrame = 0;
const intro = document.querySelector('.home .header');
const navigation = document.querySelector('.floating-nav');
const previousSection = document.querySelector('.previously');
const previousShade = document.querySelector('#previous-shade');
const resumeSection = document.querySelector('.home #resume');

function updateNavigation() {
  navigationFrame = 0;
  if (intro) {
    const bottom = intro.getBoundingClientRect().bottom;
    navigation.hidden = bottom > window.innerHeight * 0.5;
    document.querySelector('.wave').style.opacity = Math.max(0, Math.min(1, bottom / window.innerHeight));
  }
  if (previousSection) {
    const bounds = previousSection.getBoundingClientRect();
    const progress = Math.min(1 - bounds.top / window.innerHeight, bounds.bottom / window.innerHeight);
    previousShade.style.opacity = Math.max(0, Math.min(1, progress));
    document.querySelector('#starfield').style.setProperty('--star-color-opacity', Math.max(0, Math.min(1, progress)));
  }
  if (resumeSection) {
    const bounds = resumeSection.getBoundingClientRect();
    document.documentElement.classList.toggle('resume-scrolling', bounds.top < window.innerHeight * 0.8 && bounds.bottom > 0);
  }
  let current = sectionLinks[0];
  for (const entry of sectionLinks) {
    if (entry.section.getBoundingClientRect().top <= window.innerHeight * 0.35) {
      current = entry;
    }
  }
  if (window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 2) {
    current = sectionLinks[sectionLinks.length - 1];
  }
  for (const entry of sectionLinks) {
    if (entry === current) entry.link.setAttribute('aria-current', 'location');
    else entry.link.removeAttribute('aria-current');
  }
}

function scheduleNavigation() {
  if (!navigationFrame) navigationFrame = requestAnimationFrame(updateNavigation);
}

window.addEventListener('scroll', scheduleNavigation, { passive: true });
window.addEventListener('resize', scheduleNavigation);
window.addEventListener('pageshow', scheduleNavigation);
updateNavigation();

const explore = document.querySelector('.explore-link');
if (explore) {
  explore.addEventListener('click', (event) => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    event.preventDefault();
    const target = document.querySelector(explore.getAttribute('href'));
    const root = document.documentElement;
    const destination = target.getBoundingClientRect().top + window.scrollY;
    let position = window.scrollY;
    let velocity = 0;
    let lastTime;
    let frame;

    root.style.scrollSnapType = 'none';
    root.style.scrollBehavior = 'auto';
    function finish() {
      cancelAnimationFrame(frame);
      root.style.removeProperty('scroll-snap-type');
      root.style.removeProperty('scroll-behavior');
      window.removeEventListener('wheel', finish);
      window.removeEventListener('touchstart', finish);
    }
    function scroll(time) {
      const step = Math.min((time - (lastTime ?? time)) / 16.67, 2);
      lastTime = time;
      velocity += (destination - position) * 0.025 * step;
      velocity *= Math.pow(0.68, step);
      position += velocity * step;
      window.scrollTo(0, position);
      if (Math.abs(destination - position) < 0.5 && Math.abs(velocity) < 0.5) {
        window.scrollTo(0, destination);
        finish();
      } else {
        frame = requestAnimationFrame(scroll);
      }
    }
    window.addEventListener('wheel', finish, { passive: true });
    window.addEventListener('touchstart', finish, { passive: true });
    frame = requestAnimationFrame(scroll);
  });
}
