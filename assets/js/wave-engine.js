const maxWaveHeight = 8;
const waveCellSize = 4;

function createWaveEngine(waveCanvas, stencil) {
  const waveContext = waveCanvas.getContext('2d');
  let width, height, current, previous, pixels;
  let sizeDamping = 1, waveActivity = 0;

  function resizeWave(w, h) {
    sizeDamping = 1 - 0.012 * (1 - Math.min(w / 900, 1));
    const newWidth = Math.max(2, Math.round(w / waveCellSize));
    const newHeight = Math.max(2, Math.round(h / waveCellSize));
    width = waveCanvas.width = newWidth;
    height = waveCanvas.height = newHeight;
    const cells = width * height;
    if (stencil) {
      const memory = stencil.memory;
      const pages = Math.ceil((cells * 8 - memory.buffer.byteLength) / 65536);
      if (pages > 0) memory.grow(pages);
      current = new Float32Array(memory.buffer, 0, cells);
      previous = new Float32Array(memory.buffer, cells * 4, cells);
      current.fill(0);
      previous.fill(0);
    } else {
      current = new Float32Array(cells);
      previous = new Float32Array(cells);
    }
    pixels = waveContext.createImageData(width, height);
    waveActivity = 0;

  }

  function disturbWave(x, y, lift = 1) {
    waveActivity += 1;

    // Peak one cell from the center, then fade to zero at the original rim.
    const radius = 6;
    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        const px = x + dx, py = y + dy;
        const distance = Math.hypot(dx, dy);
        const offset = distance < 1 ? 1 - distance * distance : (distance - 1) / (radius - 1);
        const taper = distance < 1 ? 1 - 0.04 * offset * offset : 1 - offset * offset;
        if (taper > 0 && px > 0 && px < width - 1 && py > 0 && py < height - 1) {
          const i = py * width + px;
          const displacement = 0.6 * lift * taper ** 3;
          current[i] = Math.min(maxWaveHeight, current[i] + displacement);
          // The difference between the two heights sets the initial velocity.
          previous[i] = Math.max(-maxWaveHeight, previous[i] - 1.5 * displacement);
        }
      }
    }
  }

  function drawWave(steps = 1) {
    let strongestSlope = 0;
    const data = pixels.data;
    for (let step = 0; step < steps; step++) {
      const damping = waveActivity > 3 ? 0.98 : 0.996;
      waveActivity *= damping;
      const decay = damping * sizeDamping;
      const vectorCells = stencil ? 4 * Math.floor((width - 2) / 4) : 0;
      for (let y = 1; y < height - 1; y++) {
        const first = y * width + 1;
        if (vectorCells) {
          const src = current.byteOffset + first * 4;
          stencil.row(src, previous.byteOffset + first * 4, src + vectorCells * 4, width * 4, decay, maxWaveHeight);
        }
        for (let i = first + vectorCells; i < first + width - 2; i++) {
          const laplacian = current[i - 1] + current[i + 1] + current[i - width] + current[i + width] - 4 * current[i];
          const next = (2 * current[i] - previous[i] + 0.1 * laplacian) * decay;
          previous[i] = Math.max(-maxWaveHeight, Math.min(maxWaveHeight, next));
        }
      }
      if (step + 1 < steps) [current, previous] = [previous, current];
    }
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const i = y * width + x;
        const slopeX = current[i - 1] - current[i + 1];
        const slopeY = current[i - width] - current[i + width];
        if (slopeX === 0 && slopeY === 0) {
          data[i * 4 + 3] = 0;
          continue;
        }
        const slope = slopeX + slopeY;
        const absoluteSlope = Math.abs(slope);
        strongestSlope = Math.max(strongestSlope, absoluteSlope);
        const magnitude = Math.sqrt(slopeX * slopeX + slopeY * slopeY);
        const strength = Math.max(absoluteSlope, magnitude * 0.35);
        const alpha = Math.min(95, strength * 180);
        const direction = slope / Math.max(Math.SQRT2 * magnitude, 0.0001);
        const blend = Math.max(0, Math.min(1, (direction + 0.65) / 1.3));
        const light = blend * blend * (3 - 2 * blend);
        const p = i * 4;
        data[p] = 25 + 160 * light;
        data[p + 1] = 25 + 200 * light;
        data[p + 2] = 25 + 230 * light;
        data[p + 3] = alpha;
      }
    }
    [current, previous] = [previous, current];
    // Extend the rendered edge without changing the simulation's fixed boundary.
    for (let y = 1; y < height - 1; y++) {
      const row = y * width * 4;
      pixels.data.copyWithin(row, row + 4, row + 8);
      pixels.data.copyWithin(row + (width - 1) * 4, row + (width - 2) * 4, row + (width - 1) * 4);
    }
    pixels.data.copyWithin(0, width * 4, width * 8);
    pixels.data.copyWithin((height - 1) * width * 4, (height - 2) * width * 4, (height - 1) * width * 4);
    if (strongestSlope > 0.006) {
      waveContext.putImageData(pixels, 0, 0);
      return true;
    }
    waveContext.clearRect(0, 0, waveCanvas.width, waveCanvas.height);
    current.fill(0);
    previous.fill(0);
    waveActivity = 0;
    return false;
  }
  return { resizeWave, disturbWave, drawWave };
}

// Shared by the worker and the main-thread fallback.
function createWaveLoop(engine, settled) {
  const stepMs = 1000 / 60;
  let frame = null, nextStep;
  function tick(now) {
    frame = null;
    nextStep ??= now;
    const due = Math.floor((now - nextStep + 0.1) / stepMs) + 1;
    if (due > 0) {
      nextStep += due * stepMs;
      if (!engine.drawWave(Math.min(due, 4))) {
        nextStep = undefined;
        settled();
        return;
      }
    }
    setRunning(true);
  }
  function setRunning(run) {
    if (run && frame === null) frame = requestAnimationFrame(tick);
    if (!run) {
      if (frame !== null) cancelAnimationFrame(frame);
      frame = null;
      nextStep = undefined;
    }
  }
  return setRunning;
}
