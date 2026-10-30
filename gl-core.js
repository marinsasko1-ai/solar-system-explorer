/* PlanetGL: renders lit, rotating, procedurally textured ellipsoids with WebGL2 and composites them into the 2D canvas. */
(function () {
  var S = window.PGL_SRC;
  var gl = null, cv = null, vbo = null, progs = {}, mapTex = null, W = 0, H = 0, dpr = 1, enabled = false;
  var UNI = ['u_res', 'u_center', 'u_radius', 'u_flat', 'u_by', 'u_rot', 'u_L', 'u_night', 'u_time', 'u_ring', 'u_halo', 'u_tint', 'u_seed', 'u_emit', 'u_map'];

  // Per-body defaults: halo = [r,g,b,thickness], ring = [inner, outer, opacity, 1]
  var KIND = {
    sun:      { halo: [1.0, .80, .48, .95], emit: 1 },
    mercury:  {},
    venus:    { halo: [1.0, .92, .66, .05] },
    earth:    { halo: [.33, .58, 1.0, .06] },
    moon:     {},
    mars:     { halo: [.92, .62, .42, .03] },
    jupiter:  { halo: [.85, .76, .62, .02] },
    saturn:   { halo: [.92, .82, .62, .02], ring: [1.24, 2.33, 1, 1] },
    uranus:   { halo: [.60, .90, .96, .035], ring: [1.55, 2.05, 1, 1] },
    neptune:  { halo: [.33, .50, 1.0, .035] },
    io:       {}, europa: {}, ganymede: {}, callisto: {},
    titan:    { halo: [1.0, .62, .22, .06] },
    enceladus: {}, mimas: {}, phobos: {}, deimos: {},
    ceres:    {}, pluto: { halo: [.55, .70, 1.0, .016] }, charon: {}, haumea: {}, makemake: {}, eris: {},
    rocky:    { halo: [.6, .75, 1.0, .03] },
    ocean:    { halo: [.4, .65, 1.0, .05] },
    ice:      {},
    lava:     { halo: [1.0, .35, .1, .03] }
  };

  function init(canvasW, canvasH, ratio) {
    if (gl) { resize(canvasW, canvasH, ratio); return enabled; }
    try {
      cv = document.createElement('canvas');
      gl = cv.getContext('webgl2', { alpha: true, premultipliedAlpha: true, antialias: false, depth: false, stencil: false, preserveDrawingBuffer: false, powerPreference: 'high-performance' });
    } catch (e) { gl = null; }
    if (!gl) { enabled = false; return false; }
    vbo = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    gl.disable(gl.BLEND); gl.disable(gl.DEPTH_TEST);
    makeMap();
    enabled = true;
    resize(canvasW, canvasH, ratio);
    return true;
  }

  function resize(cssW, cssH, ratio) {
    if (!gl) return;
    dpr = ratio || 1;
    var w = Math.max(2, Math.min(4096, Math.round(cssW * dpr))), h = Math.max(2, Math.min(4096, Math.round(cssH * dpr)));
    if (w !== W || h !== H) { W = w; H = h; cv.width = w; cv.height = h; }
  }

  function makeMap() {
    mapTex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, mapTex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([0, 60, 0, 255]));
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    var img = new Image();
    img.onload = function () {
      try {
        gl.bindTexture(gl.TEXTURE_2D, mapTex);
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
        gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
        gl.generateMipmap(gl.TEXTURE_2D);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        var ext = gl.getExtension('EXT_texture_filter_anisotropic');
        if (ext) gl.texParameterf(gl.TEXTURE_2D, ext.TEXTURE_MAX_ANISOTROPY_EXT, Math.min(8, gl.getParameter(ext.MAX_TEXTURE_MAX_ANISOTROPY_EXT)));
        api.mapReady = true;
        if (api.onMap) api.onMap();
      } catch (e) { api.errors.map = String(e); }
    };
    img.onerror = function () { api.errors.map = 'earth-map.png failed to load'; };
    img.src = window.PGL_MAP || 'earth-map.png';
  }

  function compile(type, src) {
    var sh = gl.createShader(type);
    gl.shaderSource(sh, src); gl.compileShader(sh);
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) { var log = gl.getShaderInfoLog(sh); gl.deleteShader(sh); throw new Error(log); }
    return sh;
  }

  function program(kind) {
    var p = progs[kind];
    if (p !== undefined) return p;
    progs[kind] = null;
    var def = S.kinds[kind];
    if (!def) { api.errors[kind] = 'no shader'; return null; }
    try {
      var frag = S.head + S.noise + def.src + (def.ring ? '' : S.noRing) + S.main;
      var pr = gl.createProgram();
      gl.attachShader(pr, compile(gl.VERTEX_SHADER, S.vert));
      gl.attachShader(pr, compile(gl.FRAGMENT_SHADER, frag));
      gl.bindAttribLocation(pr, 0, 'a_pos');
      gl.linkProgram(pr);
      if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(pr));
      var loc = {};
      UNI.forEach(function (u) { loc[u] = gl.getUniformLocation(pr, u); });
      progs[kind] = { pr: pr, loc: loc };
    } catch (e) {
      api.errors[kind] = String(e.message || e);
      if (window.console) console.warn('PlanetGL shader "' + kind + '" failed:', api.errors[kind]);
    }
    return progs[kind];
  }

  /* o: { kind, x, y, r (CSS px, equatorial), flat, X, Y, Z (body axes in view space), L (unit vector to Sun, view space),
          night (bool), time (days), seed, tint } */
  function draw(ctx, o) {
    if (!enabled || !gl) return false;
    var k = KIND[o.kind];
    if (!k) return false;
    var P = program(o.kind);
    if (!P) return false;
    var d = dpr, cx = o.x * d, cy = o.y * d, r = o.r * d;
    var halo = o.halo || k.halo || [0, 0, 0, 0], ring = o.ring || k.ring || [0, 0, 0, 0];
    var ext = r * Math.max(1 + halo[3], ring[3] ? ring[1] : 1) + 3;
    var x0 = Math.max(0, Math.floor(cx - ext)), x1 = Math.min(W, Math.ceil(cx + ext));
    var y0 = Math.max(0, Math.floor(cy - ext)), y1 = Math.min(H, Math.ceil(cy + ext));
    if (x1 <= x0 || y1 <= y0) return true;
    gl.useProgram(P.pr);
    var L = P.loc;
    gl.viewport(0, 0, W, H);
    gl.enable(gl.SCISSOR_TEST);
    gl.scissor(x0, H - y1, x1 - x0, y1 - y0);
    gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
    gl.uniform2f(L.u_res, W, H);
    gl.uniform2f(L.u_center, cx, cy);
    gl.uniform1f(L.u_radius, r);
    gl.uniform1f(L.u_flat, o.flat || 1);
    gl.uniform1f(L.u_by, o.by || 1);
    gl.uniformMatrix3fv(L.u_rot, false, new Float32Array([o.X[0], o.X[1], o.X[2], o.Y[0], o.Y[1], o.Y[2], o.Z[0], o.Z[1], o.Z[2]]));
    gl.uniform3f(L.u_L, o.L[0], o.L[1], o.L[2]);
    gl.uniform1f(L.u_night, o.night === false ? 0 : 1);
    gl.uniform1f(L.u_time, o.time || 0);
    gl.uniform4f(L.u_ring, ring[0], ring[1], ring[2], ring[3]);
    gl.uniform4f(L.u_halo, halo[0], halo[1], halo[2], halo[3]);
    var t = o.tint || [1, 1, 1];
    gl.uniform3f(L.u_tint, t[0], t[1], t[2]);
    gl.uniform1f(L.u_seed, o.seed || 0);
    gl.uniform1f(L.u_emit, k.emit || 0);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, mapTex);
    gl.uniform1i(L.u_map, 0);
    gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    ctx.drawImage(cv, x0, y0, x1 - x0, y1 - y0, x0 / d, y0 / d, (x1 - x0) / d, (y1 - y0) / d);
    return true;
  }

  var api = {
    init: init, resize: resize, draw: draw, KIND: KIND,
    errors: {}, mapReady: false, onMap: null,
    get enabled() { return enabled; },
    // compile everything up front (used by the test page)
    compileAll: function () { Object.keys(KIND).forEach(function (k) { if (S.kinds[k]) program(k); }); return api.errors; }
  };
  window.PlanetGL = api;
})();
