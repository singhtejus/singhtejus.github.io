importScripts('wave-engine.js');
const stencil = fetch('wave-stencil.wasm')
  .then(response => response.arrayBuffer())
  .then(bytes => WebAssembly.instantiate(bytes))
  .then(result => result.instance.exports)
  .catch(() => undefined);
let engine, setRunning, generation;
onmessage = async ({ data }) => {
  if (data.canvas) {
    if (typeof requestAnimationFrame !== 'function') {
      postMessage({ fallback: true });
      return;
    }
    engine = stencil.then(kernel => {
      const ready = createWaveEngine(data.canvas, kernel);
      setRunning = createWaveLoop(ready, () => postMessage({ generation }));
      return ready;
    });
    return;
  }
  if (!engine) return;
  const ready = await engine;
  if ('w' in data) ready.resizeWave(data.w, data.h);
  else if ('x' in data) {
    generation = data.generation;
    ready.disturbWave(data.x, data.y, data.lift);
  } else setRunning(data.running);
};
