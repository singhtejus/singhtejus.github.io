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
const constellationLayer = document.getElementById('about-me')
  ? document.createElementNS('http://www.w3.org/2000/svg', 'svg') : null;
let fieldWidth = starfield.clientWidth, fieldHeight = starfield.clientHeight;
const constellations = [];
const starIds = new Map(stars.map((star, index) => [star, index]));
const constellationCooldown = new Map();
const constellationPanels = [...document.querySelectorAll('.bio .silver-region')];

if (constellationLayer) {
  constellationLayer.classList.add('constellations');
  constellationLayer.setAttribute('aria-hidden', 'true');
  starfield.prepend(constellationLayer);
}

function starCenter(star) {
  const point = starPositions.get(star);
  return { x: point.x * fieldWidth + point.size / 2, y: point.y * fieldHeight + point.size / 2 };
}

function starPhase(star) {
  let animation = twinkleAnimations.get(star);
  if (!animation) {
    animation = star.getAnimations().find(item => item.animationName === 'twinkle');
    if (animation) twinkleAnimations.set(star, animation);
  }
  return animation?.effect?.getComputedTiming().progress;
}

function nearestStars(point, candidates, count) {
  const nearest = [];
  for (const star of candidates) {
    const position = starCenter(star);
    const entry = { star, distance: (position.x - point.x) ** 2 + (position.y - point.y) ** 2 };
    const index = nearest.findIndex(other => entry.distance < other.distance);
    if (index >= 0) nearest.splice(index, 0, entry);
    else if (nearest.length < count) nearest.push(entry);
    if (nearest.length > count) nearest.pop();
  }
  return nearest.map(entry => entry.star);
}

function constellationEdges(stars, endpoints) {
  const edges = [];
  for (let i = 1; i < stars.length; i++) edges.push([stars[i - 1], stars[i]]);
  if (endpoints === 1) edges.push([stars[0], stars[stars.length - 2]]);
  return edges;
}

function edgesCross([a, b], [c, d]) {
  if (a === c || a === d || b === c || b === d) return false;
  const p = starCenter(a), q = starCenter(b), r = starCenter(c), s = starCenter(d);
  const side = (x, y, z) => (y.x - x.x) * (z.y - x.y) - (y.y - x.y) * (z.x - x.x);
  const onSegment = (x, y, z) => z.x >= Math.min(x.x, y.x) && z.x <= Math.max(x.x, y.x) &&
    z.y >= Math.min(x.y, y.y) && z.y <= Math.max(x.y, y.y);
  const a1 = side(p, q, r), a2 = side(p, q, s), b1 = side(r, s, p), b2 = side(r, s, q);
  return (a1 * a2 < 0 && b1 * b2 < 0) ||
    (a1 === 0 && onSegment(p, q, r)) || (a2 === 0 && onSegment(p, q, s)) ||
    (b1 === 0 && onSegment(r, s, p)) || (b2 === 0 && onSegment(r, s, q));
}

function uncrossedOrder(stars, endpoints, ownCluster) {
  const otherEdges = constellations.filter(cluster => cluster !== ownCluster)
    .flatMap(cluster => constellationEdges(cluster.stars, cluster.endpoints));
  const first = endpoints === 2 ? stars[0] : null;
  const last = stars[stars.length - 1];
  const remaining = endpoints === 2 ? stars.slice(1, -1) : stars.slice(0, -1);
  const path = first ? [first] : [];
  const edges = [];
  function search() {
    if (!remaining.length) {
      const result = [...path, last];
      const all = constellationEdges(result, endpoints);
      for (let i = 0; i < all.length; i++) {
        if (otherEdges.some(edge => edgesCross(all[i], edge))) return null;
        for (let j = 0; j < i; j++) if (edgesCross(all[i], all[j])) return null;
      }
      return result;
    }
    for (let i = 0; i < remaining.length; i++) {
      const star = remaining[i];
      const edge = path.length ? [path[path.length - 1], star] : null;
      if (edge && (otherEdges.some(other => edgesCross(edge, other)) || edges.some(other => edgesCross(edge, other)))) continue;
      remaining.splice(i, 1);
      path.push(star);
      if (edge) edges.push(edge);
      const result = search();
      if (result) return result;
      if (edge) edges.pop();
      path.pop();
      remaining.splice(i, 0, star);
    }
    return null;
  }
  return search();
}

function drawConstellation(cluster, duration = 0.8) {
  const edges = constellationEdges(cluster.stars, cluster.endpoints);
  const wanted = new Set(edges.map(([a, b]) => [starIds.get(a), starIds.get(b)].sort((x, y) => x - y).join('-')));
  for (const [key, line] of cluster.lines) {
    if (wanted.has(key)) continue;
    cluster.lines.delete(key);
    if (edges.some(edge => edgesCross(line.ends, edge))) {
      line.remove();
      continue;
    }
    line.style.transitionDuration = `${duration}s`;
    line.style.opacity = 0;
    setTimeout(() => line.remove(), duration * 1000 + 50);
  }
  for (const [a, b] of edges) {
    const key = [starIds.get(a), starIds.get(b)].sort((x, y) => x - y).join('-');
    let line = cluster.lines.get(key);
    if (!line) {
      line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      line.style.opacity = 0;
      line.style.transitionDuration = `${duration}s`;
      cluster.group.appendChild(line);
      cluster.lines.set(key, line);
      requestAnimationFrame(() => { if (line.isConnected) line.style.opacity = 1; });
    }
    const start = starCenter(a), end = starCenter(b);
    line.setAttribute('x1', start.x);
    line.setAttribute('y1', start.y);
    line.setAttribute('x2', end.x);
    line.setAttribute('y2', end.y);
    line.ends = [a, b];
    line.classList.toggle('lit-connection', risingRayStars.has(a) || fadingRayStars.has(a) || risingRayStars.has(b) || fadingRayStars.has(b));
  }
}

function updateConstellations() {
  if (!constellationLayer || Number(constellationLayer.style.opacity) <= 0) return;
  const bounds = starfield.getBoundingClientRect();
  const panels = constellationPanels.map(panel => panel.getBoundingClientRect());
  const obscured = star => {
    const point = starCenter(star);
    const x = point.x + bounds.left, y = point.y + bounds.top;
    const radius = starPositions.get(star).size * 0.9;
    return panels.some(panel => x + radius >= panel.left && x - radius <= panel.right &&
      y + radius >= panel.top && y - radius <= panel.bottom);
  };
  let visible;
  const visibleStars = () => {
    if (visible) return visible;
    visible = stars.filter(star => {
      const point = starCenter(star);
      return point.x + bounds.left >= 0 && point.x + bounds.left <= window.innerWidth &&
        point.y + bounds.top >= 0 && point.y + bounds.top <= window.innerHeight && !obscured(star);
    });
    return visible;
  };
  const used = new Set(constellations.flatMap(cluster => cluster.stars));
  let attempts = 0;
  while (constellations.length < 3 && visibleStars().filter(star => !used.has(star)).length >= 6) {
    if (++attempts > 12) break;
    const point = { x: Math.random() * window.innerWidth - bounds.left, y: Math.random() * window.innerHeight - bounds.top };
    const members = nearestStars(point, visible.filter(star => !used.has(star)), Math.random() < 0.5 ? 5 : 6);
    // Order nearby stars into a path, keeping endpoints at the ends.
    const ordered = [members.shift()];
    while (members.length) {
      const next = nearestStars(starCenter(ordered[ordered.length - 1]), members, 1)[0];
      ordered.push(next);
      members.splice(members.indexOf(next), 1);
    }
    const endpoints = Math.random() < 0.5 ? 1 : 2;
    const noncrossing = uncrossedOrder(ordered, endpoints);
    if (!noncrossing) continue;
    noncrossing.forEach(star => used.add(star));
    const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    constellationLayer.appendChild(group);
    const cluster = { stars: noncrossing, endpoints, group, lines: new Map() };
    constellations.push(cluster);
    drawConstellation(cluster);
  }
  for (const [star, until] of constellationCooldown) if (performance.now() >= until) constellationCooldown.delete(star);
  for (const cluster of constellations) {
    for (let i = 0; i < cluster.stars.length; i++) {
      const star = cluster.stars[i], phase = starPhase(star);
      const covered = obscured(star);
      if (!covered && (phase == null || phase < 0.8)) continue;
      const center = cluster.stars.reduce((sum, member) => {
        const point = starCenter(member);
        sum.x += point.x / cluster.stars.length;
        sum.y += point.y / cluster.stars.length;
        return sum;
      }, { x: 0, y: 0 });
      const available = visibleStars().filter(candidate => !used.has(candidate) && !constellationCooldown.has(candidate));
      const rising = available.filter(candidate => (starPhase(candidate) ?? 1) < 0.35);
      const candidates = nearestStars(center, covered && !rising.length ? available : rising, 12);
      let next, order;
      for (const candidate of candidates) {
        const members = [...cluster.stars];
        members[i] = candidate;
        order = uncrossedOrder(members, cluster.endpoints, cluster);
        if (order) { next = candidate; break; }
      }
      if (!next) continue;
      used.delete(star);
      used.add(next);
      constellationCooldown.set(star, performance.now() + parseFloat(star.style.animationDuration) * 1000);
      cluster.stars = order;
      drawConstellation(cluster, covered ? 0.4 : parseFloat(star.style.animationDuration) * (1 - phase));
    }
    for (const line of cluster.lines.values()) {
      line.classList.toggle('lit-connection', line.ends.some(star => risingRayStars.has(star) || fadingRayStars.has(star)));
    }
  }
}

function resizeConstellations() {
  const width = starfield.clientWidth, height = starfield.clientHeight;
  if (width === fieldWidth && height === fieldHeight) return;
  fieldWidth = width;
  fieldHeight = height;
  for (const cluster of constellations) drawConstellation(cluster);
}
if (constellationLayer && typeof ResizeObserver === 'function') new ResizeObserver(resizeConstellations).observe(starfield);
else if (constellationLayer) window.addEventListener('resize', resizeConstellations);

function updateRays() {
  if ((!desktopGlow.matches && !mobileGlow.matches) || document.hidden) {
    for (const star of [...risingRayStars, ...fadingRayStars]) star.classList.remove('ambient-lit', 'is-lit');
    risingRayStars.clear();
    fadingRayStars.clear();
    coolingRayStars.clear();
    return;
  }
  const mobile = mobileGlow.matches;
  const targetCount = mobile ? Math.round(stars.length * 0.15) : 7;
  const glowClass = mobile ? 'is-lit' : 'ambient-lit';
  const extinguished = [];
  for (const star of risingRayStars) {
    const progress = starPhase(star);
    if (progress == null || progress >= 0.5) {
      risingRayStars.delete(star);
      fadingRayStars.add(star);
    }
  }
  for (const star of fadingRayStars) {
    const progress = starPhase(star);
    if (progress == null || progress >= 0.7 || progress < 0.5) {
      extinguished.push(star);
      fadingRayStars.delete(star);
      coolingRayStars.set(star, performance.now() + 1000);
    }
  }
  for (const [star, until] of coolingRayStars) {
    if (performance.now() >= until) coolingRayStars.delete(star);
  }
  const needsCandidates = risingRayStars.size + fadingRayStars.size < targetCount;
  const fieldBounds = needsCandidates && !mobile ? starfield.getBoundingClientRect() : null;
  const candidates = needsCandidates ? stars.filter(star => {
    if (risingRayStars.has(star) || fadingRayStars.has(star) || coolingRayStars.has(star)) return false;
    const progress = starPhase(star);
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
  while (risingRayStars.size + fadingRayStars.size < targetCount && candidates.length) {
    const [star] = candidates.splice(Math.floor(Math.random() * candidates.length), 1);
    star.classList.add(glowClass);
    risingRayStars.add(star);
  }
  updateConstellations();
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
