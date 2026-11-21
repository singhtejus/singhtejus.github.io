// Each fragment updates one cell of the same five-point wave grid as the fallback.
(() => {
  const canvas = document.querySelector('.wave');
  const section = document.querySelector('.header');
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  const gl = canvas.getContext('webgl2', { alpha: true, premultipliedAlpha: true });
  if (!gl || !gl.getExtension('EXT_color_buffer_float') || !gl.getExtension('OES_texture_float_linear')) return;

  const vertex = `#version 300 es
    void main() {
      vec2 p = vec2((gl_VertexID << 1) & 2, gl_VertexID & 2);
      gl_Position = vec4(p * 2.0 - 1.0, 0, 1);
    }`;
  const common = `#version 300 es
    precision highp float;
    precision highp int;
    uniform highp sampler2D state;
    uniform ivec2 size, drop;
    uniform float dropStrength;
    const float limit = ${maxWaveHeight.toFixed(1)};
    float heightAt(ivec2 p) {
      if (p.x <= 0 || p.y <= 0 || p.x >= size.x - 1 || p.y >= size.y - 1) return 0.0;
      float h = texelFetch(state, p, 0).r;
      ivec2 d = p - drop;
      if (dropStrength > 0.0 && abs(d.x) <= 2 && abs(d.y) <= 2)
        h += dropStrength * exp(-float(d.x*d.x + d.y*d.y) / 4.0);
      return clamp(h, -limit, limit);
    }`;
  const simulate = common + `
    uniform float damping;
    const float waveSpeed = 0.8;
    out vec4 result;
    void main() {
      ivec2 p = ivec2(gl_FragCoord.xy);
      if (p.x == 0 || p.y == 0 || p.x == size.x - 1 || p.y == size.y - 1) { result = vec4(0); return; }
      float h = heightAt(p);
      float lap = heightAt(p+ivec2(1,0)) + heightAt(p-ivec2(1,0)) + heightAt(p+ivec2(0,1)) + heightAt(p-ivec2(0,1)) - 4.0*h;
      float next = (2.0*h - texelFetch(state,p,0).g + 0.1*waveSpeed*waveSpeed*lap) * damping;
      result = vec4(clamp(next, -limit, limit), h, 0, 1);
    }`;
  const tilt = Math.PI / 4;
  const surfaceVertex = `#version 300 es
    precision highp float;
    precision highp int;
    uniform highp sampler2D state;
    uniform ivec2 size;
    uniform float phase;
    out vec2 uv;
    void main() {
      // Draw strips from the back toward the viewer.
      ivec2 cell = ivec2(gl_VertexID / 2, size.y - 1 - gl_InstanceID - (gl_VertexID % 2));
      vec2 heights = texelFetch(state, cell, 0).rg;
      float elevation = mix(heights.g, heights.r, phase);
      uv = (vec2(cell) + 0.5) / vec2(size);
      vec2 plane = 2.0 * vec2(cell) / vec2(size - 1) - 1.0;
      plane.y += elevation * 2.0 * ${Math.tan(tilt)} / float(size.y);
      gl_Position = vec4(plane, 0, 1);
    }`;
  const shade = common + `
    in vec2 uv;
    uniform float phase;
    out vec4 color;
    float smoothHeight(vec2 uv) {
      vec2 heights = texture(state, uv).rg;
      return mix(heights.g, heights.r, phase);
    }
    void main() {
      vec2 texel = 1.0 / vec2(size);
      float slopeX = smoothHeight(uv - vec2(texel.x, 0)) - smoothHeight(uv + vec2(texel.x, 0));
      float slopeY = smoothHeight(uv + vec2(0, texel.y)) - smoothHeight(uv - vec2(0, texel.y));
      float slope = slopeX + slopeY;
      float magnitude = length(vec2(slopeX, slopeY));
      float direction = slope / max(1.414214 * magnitude, 0.0001);
      float light = smoothstep(-0.65, 0.65, direction);
      vec3 tint = mix(vec3(25.0), vec3(185,225,255), light) / 255.0;
      float strength = max(abs(slope), magnitude * 0.35);
      float alpha = min(95.0, strength * 180.0) / 255.0;
      color = vec4(tint * alpha, alpha);
    }`;
  const detect = common + `
    out vec4 color;
    void main() {
      ivec2 p = ivec2(gl_FragCoord.xy);
      float slope = heightAt(p-ivec2(1,0)) - heightAt(p+ivec2(1,0)) + heightAt(p+ivec2(0,1)) - heightAt(p-ivec2(0,1));
      if (abs(slope) <= 0.006) discard;
      color = vec4(0);
    }`;
  function makeProgram(fragment, vertexSource = vertex) {
    function compile(type, source) {
      const shader = gl.createShader(type);
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw Error(gl.getShaderInfoLog(shader));
      return shader;
    }
    const program = gl.createProgram();
    gl.attachShader(program, compile(gl.VERTEX_SHADER, vertexSource));
    gl.attachShader(program, compile(gl.FRAGMENT_SHADER, fragment));
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw Error(gl.getProgramInfoLog(program));
    const uniforms = {};
    for (const name of ['state', 'size', 'drop', 'dropStrength', 'phase', 'damping']) {
      uniforms[name] = gl.getUniformLocation(program, name);
    }
    gl.useProgram(program);
    gl.uniform1i(uniforms.state, 0);
    return { program, uniforms };
  }
  gl.activeTexture(gl.TEXTURE0);
  let sim, display, detection;
  try { sim = makeProgram(simulate); display = makeProgram(shade, surfaceVertex); detection = makeProgram(detect); }
  catch (error) { console.warn('GPU waves unavailable:', error); return; }
  let width, height, targets = [], frame = 0, visible = false, introPresent = false, activity = 0, active = false;
  let outputWidth, outputHeight;
  let sizeDamping = 1;
  let query = null, framesSinceCheck = 0, generation = 0, queryGeneration = 0;
  let rippleTimer, hasEntered = false;
  const drops = [];
  function resize() {
    sizeDamping = 1 - 0.012 * (1 - Math.min(section.clientWidth / 900, 1));
    const newWidth = Math.max(2, Math.round(section.clientWidth / 8));
    // Extend the plane in depth so its tilted projection fills the viewport.
    const newHeight = Math.max(2, Math.round(section.clientHeight / (8 * Math.cos(tilt))));
    const newOutputWidth = Math.max(2, Math.round(section.clientWidth));
    const newOutputHeight = Math.max(2, Math.round(section.clientHeight));
    if (newWidth === width && newHeight === height && newOutputWidth === outputWidth && newOutputHeight === outputHeight) return;
    targets.forEach(({ texture, framebuffer }) => { gl.deleteTexture(texture); gl.deleteFramebuffer(framebuffer); });
    width = newWidth;
    height = newHeight;
    outputWidth = canvas.width = newOutputWidth;
    outputHeight = canvas.height = newOutputHeight;
    for (const { program, uniforms } of [sim, detection, display]) {
      gl.useProgram(program);
      gl.uniform2i(uniforms.size, width, height);
    }
    targets = Array.from({ length: 2 }, () => {
      const texture = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texStorage2D(gl.TEXTURE_2D, 1, gl.RG32F, width, height);
      const framebuffer = gl.createFramebuffer();
      gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
      if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) throw Error('Wave buffer unavailable');
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      return { texture, framebuffer };
    });
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.clear(gl.COLOR_BUFFER_BIT);
    activity = 0;
    active = false;
    generation++;
    drops.length = 0;
  }
  try { resize(); } catch (error) { console.warn('GPU waves unavailable:', error); return; }
  window.waveGPU = true;
  function start() {
    if (!frame && visible && !motion.matches && !document.hidden && active) frame = requestAnimationFrame(draw);
  }
  function disturb(x, y, lift = 1) {
    drops.push([x, y, 1.5 * lift]);
    activity++;
    active = true;
    generation++;
    scheduleRipple();
    start();
  }
  function randomRipple(lift = 1) {
    disturb(Math.floor(width * (0.2 + Math.random() * 0.6)), Math.floor(height * (0.2 + Math.random() * 0.6)), lift);
  }
  function scheduleRipple() {
    clearTimeout(rippleTimer);
    if (introPresent && !motion.matches && !document.hidden) {
      rippleTimer = setTimeout(randomRipple, 30000);
    }
  }
  function setup({ program, uniforms }, point) {
    gl.useProgram(program);
    gl.bindTexture(gl.TEXTURE_2D, targets[0].texture);
    gl.uniform2i(uniforms.drop, point?.[0] ?? 0, point?.[1] ?? 0);
    gl.uniform1f(uniforms.dropStrength, point?.[2] ?? 0);
  }
  const stepMs = 1000 / 60;
  let nextStep;
  function draw(now) {
    frame = 0;
    if (!visible || motion.matches || document.hidden) {
      nextStep = undefined;
      return;
    }
    nextStep ??= now;
    const due = Math.floor((now - nextStep + 0.1) / stepMs) + 1;
    // Recover ordinary hitches in one draw. Carry any remaining steps forward.
    const steps = Math.min(12, due);
    nextStep += steps * stepMs;
    const point = drops[0];
    gl.viewport(0, 0, width, height);
    if (query && gl.getQueryParameter(query, gl.QUERY_RESULT_AVAILABLE)) {
      const hasWaves = gl.getQueryParameter(query, gl.QUERY_RESULT);
      gl.deleteQuery(query);
      query = null;
      if (!hasWaves && queryGeneration === generation && drops.length === 0) {
        for (const target of targets) {
          gl.bindFramebuffer(gl.FRAMEBUFFER, target.framebuffer);
          gl.clear(gl.COLOR_BUFFER_BIT);
        }
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        gl.clear(gl.COLOR_BUFFER_BIT);
        activity = 0;
        active = false;
        nextStep = undefined;
        if (introPresent && !motion.matches && !document.hidden) randomRipple();
        return;
      }
    }
    if (steps > 0 && !query && !point && ++framesSinceCheck >= 20) {
      framesSinceCheck = 0;
      query = gl.createQuery();
      queryGeneration = generation;
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      setup(detection, null);
      gl.colorMask(false, false, false, false);
      gl.beginQuery(gl.ANY_SAMPLES_PASSED, query);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      gl.endQuery(gl.ANY_SAMPLES_PASSED);
      gl.colorMask(true, true, true, true);
    }
    for (let step = 0; step < steps; step++) {
      const drop = drops.shift();
      gl.bindFramebuffer(gl.FRAMEBUFFER, targets[1].framebuffer);
      gl.viewport(0, 0, width, height);
      setup(sim, drop);
      gl.uniform1f(sim.uniforms.damping, (activity > 3 ? 0.97 : 0.995) * sizeDamping);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      targets.reverse();
      activity *= activity > 3 ? 0.97 : 0.995;
    }
    // The simulation stores both heights, so intermediate refreshes can show motion.
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, outputWidth, outputHeight);
    gl.clear(gl.COLOR_BUFFER_BIT);
    setup(display, null);
    gl.uniform1f(display.uniforms.phase, Math.max(0, Math.min(1, 1 - (nextStep - now) / stepMs)));
    gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, width * 2, height - 1);
    start();
  }
  section.addEventListener('click', event => {
    if (motion.matches) return;
    const rect = canvas.getBoundingClientRect();
    const x = (event.clientX - rect.left) / rect.width;
    const y = 1 - (event.clientY - rect.top) / rect.height;
    if (x >= 0 && x <= 1 && y >= 0 && y <= 1) {
      disturb(Math.round(x * (width - 1)), Math.round(y * (height - 1)));
    }
  });
  window.addEventListener('resize', () => {
    resize();
    if (introPresent && !active && !motion.matches && !document.hidden) randomRipple();
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) nextStep = undefined;
    scheduleRipple();
    start();
  });
  motion.addEventListener('change', () => {
    if (motion.matches) nextStep = undefined;
    if (introPresent && !active && !motion.matches && !document.hidden) randomRipple();
    else { scheduleRipple(); start(); }
  });
  new IntersectionObserver(([entry]) => {
    const wasPresent = introPresent;
    visible = entry.isIntersecting && entry.intersectionRatio > 0;
    if (!visible) nextStep = undefined;
    introPresent = entry.intersectionRatio >= 0.5;
    if (introPresent && !wasPresent) {
      if ((hasEntered || !active) && !motion.matches && !document.hidden) randomRipple();
      else scheduleRipple();
      hasEntered = true;
    } else if (!introPresent) {
      clearTimeout(rippleTimer);
    }
    start();
  }, { threshold: [0, 0.5] }).observe(section);
  if (!motion.matches) randomRipple(1.3);
})();
