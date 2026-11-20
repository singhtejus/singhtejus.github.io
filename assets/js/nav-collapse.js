const floatingNav = document.querySelector('.floating-nav');
const navReveal = floatingNav.querySelector('.nav-reveal');
let navTimer;

function scheduleNavCollapse() {
  clearTimeout(navTimer);
  navTimer = setTimeout(() => {
    const hovered = window.matchMedia('(hover: hover)').matches && floatingNav.matches(':hover');
    if (!hovered && !floatingNav.contains(document.activeElement)) {
      floatingNav.classList.add('is-collapsed');
      navReveal.setAttribute('aria-expanded', 'false');
    }
  }, 5000);
}

function expandNav() {
  clearTimeout(navTimer);
  floatingNav.classList.remove('is-collapsed');
  navReveal.setAttribute('aria-expanded', 'true');
}

floatingNav.addEventListener('mouseenter', expandNav);
floatingNav.addEventListener('mouseleave', scheduleNavCollapse);
floatingNav.addEventListener('focusin', (event) => {
  if (event.target !== navReveal) expandNav();
});
floatingNav.addEventListener('focusout', scheduleNavCollapse);
navReveal.addEventListener('click', () => {
  expandNav();
  floatingNav.querySelector('a').focus();
});
scheduleNavCollapse();
