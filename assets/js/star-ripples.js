(() => {
  const sky = document.querySelector('#starfield');
  const intro = document.querySelector('.header');
  const stars = [...sky.querySelectorAll('.star')].map(element => ({
    element,
    x: parseFloat(element.style.left) / 100,
    y: parseFloat(element.style.top) / 100,
  }));
  const shifted = new Set();

  function clear() {
    for (const star of shifted) {
      star.style.removeProperty('--ripple-x');
      star.style.removeProperty('--ripple-y');
    }
    shifted.clear();
  }

  function update(width, height, sample, bottomUp) {
    const field = sky.getBoundingClientRect();
    const bounds = intro.getBoundingClientRect();
    const fade = Math.max(0, Math.min(1, bounds.bottom / window.innerHeight));
    for (const star of stars) {
      const x = Math.floor((field.left + star.x * field.width - bounds.left) / bounds.width * width);
      const topY = Math.floor((field.top + star.y * field.height - bounds.top) / bounds.height * height);
      const y = bottomUp ? height - 1 - topY : topY;
      if (x < 1 || x >= width - 1 || y < 1 || y >= height - 1 || fade === 0) {
        if (shifted.delete(star.element)) {
          star.element.style.removeProperty('--ripple-x');
          star.element.style.removeProperty('--ripple-y');
        }
        continue;
      }
      const slopeX = sample(x - 1, y) - sample(x + 1, y);
      const slopeY = bottomUp
        ? sample(x, y + 1) - sample(x, y - 1)
        : sample(x, y - 1) - sample(x, y + 1);
      if (Math.abs(slopeX) + Math.abs(slopeY) < 0.001) {
        if (shifted.delete(star.element)) {
          star.element.style.removeProperty('--ripple-x');
          star.element.style.removeProperty('--ripple-y');
        }
        continue;
      }
      star.element.style.setProperty('--ripple-x', `${(-12 * slopeX * fade).toFixed(2)}px`);
      star.element.style.setProperty('--ripple-y', `${(-12 * slopeY * fade).toFixed(2)}px`);
      shifted.add(star.element);
    }
  }

  window.starRipples = { update, clear };
})();
