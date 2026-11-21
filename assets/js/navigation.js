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
const aboutSection = document.querySelector('.home #about-me');

function updateNavigation() {
  navigationFrame = 0;
  let shade = 0;
  if (intro) {
    const bottom = intro.getBoundingClientRect().bottom;
    navigation.hidden = bottom > window.innerHeight * 0.5;
    document.querySelector('.wave').style.opacity = Math.max(0, Math.min(1, bottom / window.innerHeight));
  }
  if (aboutSection) {
    const bounds = aboutSection.getBoundingClientRect();
    const progress = Math.min(1 - bounds.top / window.innerHeight, bounds.bottom / window.innerHeight);
    const visible = Math.max(0, Math.min(1, progress));
    if (constellationLayer) constellationLayer.style.opacity = visible;
    shootingStar.style.setProperty('--shooting-visibility', 1 - visible);
    shade = visible * 0.3;
  }
  if (previousSection) {
    const bounds = previousSection.getBoundingClientRect();
    const progress = Math.min(1 - bounds.top / window.innerHeight, bounds.bottom / window.innerHeight);
    const visible = Math.max(0, Math.min(1, progress));
    shade += visible * (1 - shade);
    document.querySelector('#starfield').style.setProperty('--star-color-opacity', visible);
  }
  if (previousShade) previousShade.style.opacity = shade;
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
