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
    uniform sampler2D state;
    uniform ivec2 size, drop;
    uniform bool hasDrop;
    float heightAt(ivec2 p) {
      if (p.x <= 0 || p.y <= 0 || p.x >= size.x - 1 || p.y >= size.y - 1) return 0.0;
      float h = texelFetch(state, p, 0).r;
      ivec2 d = p - drop;
      if (hasDrop && abs(d.x) <= 2 && abs(d.y) <= 2)
        h += 1.5 * exp(-float(d.x*d.x + d.y*d.y) / 4.0);
      return h;
    }`;
  const simulate = common + `
    uniform float damping;
    out vec4 result;
    void main() {
      ivec2 p = ivec2(gl_FragCoord.xy);
      if (p.x == 0 || p.y == 0 || p.x == size.x - 1 || p.y == size.y - 1) { result = vec4(0); return; }
      float h = heightAt(p);
      float lap = heightAt(p+ivec2(1,0)) + heightAt(p-ivec2(1,0)) + heightAt(p+ivec2(0,1)) + heightAt(p-ivec2(0,1)) - 4.0*h;
      float next = (2.0*h - texelFetch(state,p,0).g + 0.1*lap) * damping;
      result = vec4(next, h, 0, 1);
    }`;
  const shade = common + `
    uniform sampler2D grain;
    uniform ivec2 outputSize;
    uniform vec2 grainOffset;
    uniform bool grainReady;
    out vec4 color;
    float smoothHeight(vec2 uv) {
      float h = texture(state, uv).r;
      if (hasDrop) {
        vec2 d = uv * vec2(size) - (vec2(drop) + 0.5);
        if (abs(d.x) <= 2.5 && abs(d.y) <= 2.5) h += 1.5 * exp(-dot(d, d) / 4.0);
      }
      return h;
    }
    void main() {
      vec2 uv = gl_FragCoord.xy / vec2(outputSize);
      ivec2 p = ivec2(uv * vec2(size));
      if (p.x == 0 || p.y == 0 || p.x == size.x - 1 || p.y == size.y - 1) { color = vec4(0); return; }
      vec2 texel = 1.0 / vec2(size);
      float slopeX = smoothHeight(uv - vec2(texel.x, 0)) - smoothHeight(uv + vec2(texel.x, 0));
      float slopeY = smoothHeight(uv + vec2(0, texel.y)) - smoothHeight(uv - vec2(0, texel.y));
      float slope = slopeX + slopeY;
      vec3 tint = slope > 0.0 ? vec3(185,225,255)/255.0 : vec3(25.0/255.0);
      float alpha = min(95.0, abs(slope)*180.0)/255.0;
      if (!grainReady) { color = vec4(tint * alpha, alpha); return; }
      vec2 point = vec2(gl_FragCoord.x, float(outputSize.y) - gl_FragCoord.y) + grainOffset;
      vec4 textureColor = texture(grain, (point + vec2(slopeX, slopeY) * 12.0) / 128.0);
      vec3 base = vec3(21,23,26)/255.0;
      vec3 paper = mix(base, textureColor.rgb, textureColor.a * (1.5 - 0.5 * textureColor.a));
      color = vec4(mix(paper, tint, alpha), 1.0);
    }`;
  const detect = common + `
    out vec4 color;
    void main() {
      ivec2 p = ivec2(gl_FragCoord.xy);
      float slope = heightAt(p-ivec2(1,0)) - heightAt(p+ivec2(1,0)) + heightAt(p+ivec2(0,1)) - heightAt(p-ivec2(0,1));
      if (abs(slope) <= 0.006) discard;
      color = vec4(0);
    }`;
  function makeProgram(fragment) {
    function compile(type, source) {
      const shader = gl.createShader(type);
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw Error(gl.getShaderInfoLog(shader));
      return shader;
    }
    const program = gl.createProgram();
    gl.attachShader(program, compile(gl.VERTEX_SHADER, vertex));
    gl.attachShader(program, compile(gl.FRAGMENT_SHADER, fragment));
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw Error(gl.getProgramInfoLog(program));
    return program;
  }
  let sim, display, detection;
  try { sim = makeProgram(simulate); display = makeProgram(shade); detection = makeProgram(detect); }
  catch (error) { console.warn('GPU waves unavailable:', error); return; }
  const grain = gl.createTexture();
  let grainReady = false;
  gl.activeTexture(gl.TEXTURE1);
  gl.bindTexture(gl.TEXTURE_2D, grain);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(4));
  gl.activeTexture(gl.TEXTURE0);
  const grainImage = new Image();
  grainImage.onload = () => {
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, grain);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, grainImage);
    gl.activeTexture(gl.TEXTURE0);
    grainReady = true;
  };
  grainImage.src = 'assets/images/background-grain.png';
  let width, height, targets = [], frame = 0, visible = false, introPresent = false, activity = 0, active = false;
  let outputWidth, outputHeight;
  let starSamples, lastStarUpdate = 0;
  let query = null, framesSinceCheck = 0, generation = 0, queryGeneration = 0;
  let rippleTimer, hasEntered = false;
  const drops = [];
  function resize() {
    const newWidth = Math.max(2, Math.round(section.clientWidth / 8));
    const newHeight = Math.max(2, Math.round(section.clientHeight / 8));
    const newOutputWidth = Math.max(2, Math.round(section.clientWidth));
    const newOutputHeight = Math.max(2, Math.round(section.clientHeight));
    if (newWidth === width && newHeight === height && newOutputWidth === outputWidth && newOutputHeight === outputHeight) return;
    targets.forEach(({ texture, framebuffer }) => { gl.deleteTexture(texture); gl.deleteFramebuffer(framebuffer); });
    width = newWidth;
    height = newHeight;
    starSamples = new Float32Array(width * height * 4);
    window.starRipples.clear();
    outputWidth = canvas.width = newOutputWidth;
    outputHeight = canvas.height = newOutputHeight;
    targets = Array.from({ length: 2 }, () => {
      const texture = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texStorage2D(gl.TEXTURE_2D, 1, gl.RGBA32F, width, height);
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
  canvas.classList.add('paper-surface');
  function start() {
    if (!frame && visible && !motion.matches && !document.hidden && active) frame = requestAnimationFrame(draw);
  }
  function disturb(x, y) {
    drops.push([x, y]);
    activity++;
    active = true;
    generation++;
    scheduleRipple();
    start();
  }
  function randomRipple() {
    disturb(Math.floor(width * (0.2 + Math.random() * 0.6)), Math.floor(height * (0.2 + Math.random() * 0.6)));
  }
  function scheduleRipple() {
    clearTimeout(rippleTimer);
    if (introPresent && !motion.matches && !document.hidden) {
      rippleTimer = setTimeout(randomRipple, 30000);
    }
  }
  function setup(program, point) {
    gl.useProgram(program);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, targets[0].texture);
    gl.uniform1i(gl.getUniformLocation(program, 'state'), 0);
    gl.uniform2i(gl.getUniformLocation(program, 'size'), width, height);
    gl.uniform2i(gl.getUniformLocation(program, 'drop'), point?.[0] ?? 0, point?.[1] ?? 0);
    gl.uniform1i(gl.getUniformLocation(program, 'hasDrop'), point ? 1 : 0);
  }
  function draw() {
    frame = 0;
    if (!visible || motion.matches || document.hidden) return;
    const point = drops.shift();
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
        window.starRipples.clear();
        if (introPresent && !motion.matches && !document.hidden) randomRipple();
        return;
      }
    }
    if (!query && !point && ++framesSinceCheck >= 20) {
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
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, outputWidth, outputHeight);
    setup(display, point);
    const skyBounds = document.querySelector('#starfield').getBoundingClientRect();
    const sectionBounds = section.getBoundingClientRect();
    gl.uniform2i(gl.getUniformLocation(display, 'outputSize'), outputWidth, outputHeight);
    gl.uniform2f(gl.getUniformLocation(display, 'grainOffset'), sectionBounds.left - skyBounds.left, sectionBounds.top - skyBounds.top);
    gl.uniform1i(gl.getUniformLocation(display, 'grainReady'), grainReady ? 1 : 0);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, grain);
    gl.uniform1i(gl.getUniformLocation(display, 'grain'), 1);
    gl.activeTexture(gl.TEXTURE0);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.bindFramebuffer(gl.FRAMEBUFFER, targets[1].framebuffer);
    gl.viewport(0, 0, width, height);
    setup(sim, point);
    gl.uniform1f(gl.getUniformLocation(sim, 'damping'), activity > 3 ? 0.97 : 0.995);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    if (performance.now() - lastStarUpdate >= 180) {
      lastStarUpdate = performance.now();
      gl.readPixels(0, 0, width, height, gl.RGBA, gl.FLOAT, starSamples);
      window.starRipples.update(width, height, (x, y) => starSamples[(y * width + x) * 4], true);
    }
    targets.reverse();
    activity *= activity > 3 ? 0.97 : 0.995;
    start();
  }
  section.addEventListener('click', event => {
    if (motion.matches) return;
    const rect = section.getBoundingClientRect();
    disturb(Math.floor((event.clientX - rect.left) / rect.width * width), height - 1 - Math.floor((event.clientY - rect.top) / rect.height * height));
  });
  window.addEventListener('resize', () => {
    resize();
    if (introPresent && !active && !motion.matches && !document.hidden) randomRipple();
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) window.starRipples.clear();
    scheduleRipple();
    start();
  });
  motion.addEventListener('change', () => {
    if (motion.matches) window.starRipples.clear();
    if (introPresent && !active && !motion.matches && !document.hidden) randomRipple();
    else { scheduleRipple(); start(); }
  });
  new IntersectionObserver(([entry]) => {
    const wasPresent = introPresent;
    visible = entry.isIntersecting && entry.intersectionRatio > 0;
    if (!visible) window.starRipples.clear();
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
  if (!motion.matches) randomRipple();
})();
