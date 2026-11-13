const sectionLinks = [...document.querySelectorAll('.floating-nav a[href^="#"]')].map((link) => ({
  link,
  section: document.querySelector(link.getAttribute('href')),
}));
let navigationFrame = 0;

function updateNavigation() {
  navigationFrame = 0;
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
