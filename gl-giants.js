/* Gas / ice giants (Jupiter, Saturn + rings, Uranus + rings, Neptune) and the Sun. */
(function () {
  var K = window.PGL_SRC.kinds;

  var gasLight = [
    'vec3 gasLight(vec3 alb, vec3 n, vec3 L, vec3 V, float sh, float wrap, vec3 haze, float hazeAmt){',
    '  float dl = dot(n,L);',
    '  float dif = wrapd(dl, wrap)*smoothstep(-.05 - wrap*.3, .1, dl);',
    '  float mu = max(dot(n,V), 0.);',
    '  float limb = mix(.4, 1., pow(mu, .4));',
    '  vec3 a = L2(alb);',
    '  vec3 col = a*dif*1.5*sh*limb;',
    '  col += L2(haze)*pow(1. - mu, 3.)*hazeAmt*smoothstep(-.1,.5,dl);',
    '  col += a*(u_night > .5 ? .0025 : .05);',
    '  return col;',
    '}',
    ''
  ].join('\n');

  // generic latitude-band palette lookup (smooth plateaus between control points)
  function palFn(name, lats, cols) {
    var n = lats.length;
    return [
      'const float ' + name + 'L[' + n + '] = float[' + n + '](' + lats.map(function (v) { return v.toFixed(1); }).join(',') + ');',
      'const vec3 ' + name + 'C[' + n + '] = vec3[' + n + '](' + cols.map(function (c) { return 'vec3(' + c.join(',') + ')'; }).join(',') + ');',
      'vec3 ' + name + '(float lat){',
      '  for(int i=0;i<' + (n - 1) + ';i++){',
      '    if(lat < ' + name + 'L[i+1]){ float t = clamp((lat - ' + name + 'L[i])/(' + name + 'L[i+1] - ' + name + 'L[i]), 0., 1.); return mix(' + name + 'C[i], ' + name + 'C[i+1], t*t*(3.-2.*t)); }',
      '  }',
      '  return ' + name + 'C[' + (n - 1) + '];',
      '}',
      ''
    ].join('\n');
  }

  /* ---------------------------------------------------------------- Jupiter */
  var jpal = palFn('jpal',
    [-90, -70, -60, -52, -46, -40, -34, -28, -24, -19, -14, -9, -4, 3, 7, 11, 16, 19, 22, 27, 32, 38, 45, 55, 70, 90],
    [[.50, .47, .45], [.56, .52, .48], [.72, .65, .56], [.60, .50, .42], [.82, .75, .65], [.68, .50, .38], [.88, .82, .72], [.80, .72, .62], [.74, .45, .30], [.62, .37, .26], [.70, .45, .32], [.86, .72, .56], [.95, .90, .78], [.95, .90, .78], [.82, .62, .46], [.65, .38, .27], [.62, .37, .26], [.78, .55, .40], [.92, .86, .74], [.78, .60, .45], [.92, .86, .75], [.74, .56, .43], [.88, .82, .72], [.70, .60, .52], [.56, .52, .48], [.50, .47, .45]]);

  K.jupiter = { src: gasLight + jpal + [
    'vec3 surf(vec3 p, vec3 n, vec3 L, vec3 V, float sh){',
    '  float lat = degrees(asin(clamp(p.z,-1.,1.)));',
    '  float lon = atan(p.y, p.x);',
    '  float w1 = fbm(vec3(p.x*4., p.y*4., p.z*14.) + 3.1, OC(4.)) - .5;',
    '  float w2 = fbm(vec3(p.x*10., p.y*10., p.z*38.) + 8.3, OC(10.)) - .5;',
    '  float lw = lat + 6.*w1 + 2.2*w2;',
    '  lw += 1.8*sin(lon*13. + 7.*w1)*exp(-pow((lat - 7.5)/3., 2.));',
    '  lw += 1.2*sin(lon*9. + 5.*w2)*exp(-pow((lat + 9.)/4., 2.));',
    '  vec3 col = jpal(lw);',
    '  float f1 = fbm(vec3(p.x*14., p.y*14., p.z*70.) + 1.7, OC(14.));',
    '  float f2 = fbm(vec3(p.x*40., p.y*40., p.z*160.) + 5.1, OC(40.));',
    '  col *= .9 + .2*f1 + .05*(f2 - .5);',
    // turbulent storm cells along the belt edges
    '  float tb = fbm(vec3(p.x*22., p.y*22., p.z*40.) + 2.2, OC(22.));',
    '  float belt = exp(-pow((abs(lat) - 20.)/9., 2.)) + .6*exp(-pow((abs(lat) - 40.)/6., 2.));',
    '  col = mix(col, col*vec3(1.12,1.08,1.02) + .05, smoothstep(.6,.8,tb)*belt*.35);',
    '  col = mix(col, col*vec3(.8,.7,.62), smoothstep(.62,.8,1. - tb)*belt*.14);',
    // Great Red Spot
    '  float dlon = wrapPi(lon - .7);',
    '  vec2 e = vec2(dlon*cos(radians(-22.))/.15, radians(lat + 22.)/.088);',
    '  float r = length(e);',
    '  if(r < 1.8){',
    '    float sw = fbm(vec3((rot2((1. - min(r,1.))*3.6)*e)*3.2, 2.), OC(22.));',
    '    vec3 spotC = mix(vec3(.80,.40,.27), vec3(.60,.26,.19), sw);',
    '    spotC = mix(spotC, vec3(.88,.58,.44), smoothstep(.55,.0,r)*.35);',
    '    col = mix(col, spotC, (1. - smoothstep(.8,1.,r))*.95);',
    '    float collar = smoothstep(.95,1.18,r)*(1. - smoothstep(1.25,1.8,r));',
    '    col = mix(col, vec3(.93,.88,.78), collar*.5);',
    '  }',
    // white ovals and a brown barge
    '  vec2 e2 = vec2(wrapPi(lon - 1.9)*cos(radians(-33.))/.07, radians(lat + 33.)/.045);',
    '  col = mix(col, vec3(.96,.93,.87), (1. - smoothstep(.6,1.,length(e2)))*.9);',
    '  vec2 e3 = vec2(wrapPi(lon - 3.7)*cos(radians(-41.))/.06, radians(lat + 41.)/.04);',
    '  col = mix(col, vec3(.95,.92,.86), (1. - smoothstep(.6,1.,length(e3)))*.85);',
    '  vec2 e4 = vec2(wrapPi(lon + 1.8)*cos(radians(14.))/.10, radians(lat - 14.)/.04);',
    '  col = mix(col, vec3(.45,.24,.18), (1. - smoothstep(.55,1.,length(e4)))*.7);',
    '  return gasLight(col, n, L, V, sh, .1, vec3(.85,.75,.6), .08);',
    '}',
    ''
  ].join('\n') };

  /* ----------------------------------------------------------------- Saturn */
  var spal = palFn('spal',
    [-90, -75, -62, -52, -44, -36, -28, -20, -10, -3, 4, 10, 18, 26, 35, 45, 55, 66, 78, 90],
    [[.58, .58, .56], [.66, .62, .56], [.80, .72, .55], [.86, .77, .58], [.78, .68, .50], [.90, .82, .62], [.84, .74, .54], [.92, .84, .64], [.88, .78, .56], [.94, .86, .66], [.95, .87, .67], [.88, .77, .55], [.93, .84, .63], [.84, .74, .54], [.91, .82, .61], [.82, .72, .54], [.86, .77, .58], [.70, .64, .54], [.58, .58, .56], [.52, .55, .57]]);

  var saturnRing = [
    'float bx(float x, float a, float b, float w){ return smoothstep(a-w, a+w, x)*(1. - smoothstep(b-w, b+w, x)); }',
    'float ringTau(float rho, float fw){',
    '  float amp = 1. - smoothstep(.25, 1., fw*150.);',
    '  float rn = n1(rho*170.)*.5 + n1(rho*520.)*.3 + n1(rho*1500.)*.2;',
    '  float det = mix(.8, .5 + 1.0*rn, amp);',
    '  float t = 0.;',
    '  t += bx(rho, 1.239, 1.527, .004)*(.09 + .08*n1(rho*40.));',
    '  float bb = mix(.55, 1.9, smoothstep(1.527, 1.72, rho))*(1. - .35*smoothstep(1.82, 1.95, rho));',
    '  t += bx(rho, 1.527, 1.951, .005)*bb*(.55 + .6*n1(rho*22.));',
    '  t += bx(rho, 1.951, 2.026, .004)*(.05 + .09*n1(rho*60.));',
    '  float aa = .6 + .15*smoothstep(2.1,2.25,rho);',
    '  t += bx(rho, 2.026, 2.27, .004)*aa*(1. - .95*bx(rho, 2.212, 2.224, .002))*(1. - .8*bx(rho, 2.262, 2.268, .002));',
    '  t += bx(rho, 2.318, 2.326, .003)*.12;',
    '  return t*det;',
    '}',
    'vec3 ringAlb(float rho){',
    '  vec3 c = vec3(.50,.46,.40);',
    '  c = mix(c, vec3(.88,.78,.62), smoothstep(1.52,1.62,rho));',
    '  c = mix(c, vec3(.55,.5,.44), smoothstep(1.90,1.97,rho));',
    '  c = mix(c, vec3(.78,.70,.58), smoothstep(2.02,2.06,rho));',
    '  return c*(.92 + .16*n1(rho*90.));',
    '}',
    ''
  ].join('\n');

  K.saturn = { ring: true, src: gasLight + spal + saturnRing + [
    'vec3 surf(vec3 p, vec3 n, vec3 L, vec3 V, float sh){',
    '  float lat = degrees(asin(clamp(p.z,-1.,1.)));',
    '  float lon = atan(p.y, p.x);',
    '  float w1 = fbm(vec3(p.x*4., p.y*4., p.z*12.) + 3.1, OC(4.)) - .5;',
    '  float w2 = fbm(vec3(p.x*10., p.y*10., p.z*34.) + 8.3, OC(10.)) - .5;',
    '  float lw = lat + 3.2*w1 + 1.2*w2 + 1.6*cos(lon*6.)*smoothstep(70.,77.,lat)*(1. - smoothstep(80.,86.,lat));',
    '  vec3 col = spal(lw);',
    '  float f1 = fbm(vec3(p.x*12., p.y*12., p.z*60.) + 1.7, OC(12.));',
    '  float f2 = fbm(vec3(p.x*36., p.y*36., p.z*140.) + 5.1, OC(36.));',
    '  col *= .92 + .16*f1 + .06*(f2 - .5);',
    '  float tb = fbm(vec3(p.x*16., p.y*16., p.z*30.) + 4.4, OC(16.));',
    '  col = mix(col, col*vec3(1.08,1.05,1.0) + .03, smoothstep(.62,.8,tb)*.35*exp(-pow((lat - 35.)/14., 2.)));',
    '  return gasLight(col, n, L, V, sh, .1, vec3(.92,.82,.6), .07);',
    '}',
    ''
  ].join('\n') };

  /* ----------------------------------------------------------------- Uranus */
  var uranusRing = [
    'float ln(float rho, float c, float w, float t, float fw){ float ww = max(w, fw); return t*exp(-pow((rho - c)/ww, 2.))*min(1., w/max(fw,1e-5)); }',
    'float ringTau(float rho, float fw){',
    '  float t = 0.;',
    '  t += ln(rho, 1.637, .0008, .25, fw) + ln(rho, 1.652, .0008, .25, fw) + ln(rho, 1.666, .0008, .25, fw);',
    '  t += ln(rho, 1.750, .0010, .3, fw) + ln(rho, 1.787, .0010, .3, fw);',
    '  t += ln(rho, 1.846, .0007, .25, fw) + ln(rho, 1.864, .0010, .3, fw) + ln(rho, 1.890, .0012, .3, fw);',
    '  t += ln(rho, 1.957, .0025, .02, fw) + ln(rho, 2.001, .0030, .9, fw);',
    '  return t;',
    '}',
    'vec3 ringAlb(float rho){ return vec3(.30,.29,.28); }',
    ''
  ].join('\n');

  K.uranus = { ring: true, src: gasLight + uranusRing + [
    'vec3 surf(vec3 p, vec3 n, vec3 L, vec3 V, float sh){',
    '  float lat = degrees(asin(clamp(p.z,-1.,1.)));',
    '  float w1 = fbm(vec3(p.x*3., p.y*3., p.z*9.) + 1.3, OC(3.)) - .5;',
    '  float f1 = fbm(vec3(p.x*9., p.y*9., p.z*30.) + 6.1, OC(9.));',
    '  float sl = lat*sign(L.z*0. + 1.);',
    '  vec3 base = vec3(.56,.80,.84);',
    '  float bands = .5 + .5*sin(radians(lat)*7. + 2.*w1);',
    '  base *= .96 + .06*bands + .06*(f1 - .5);',
    '  float capAmt = smoothstep(35.,80., abs(lat))*.5;',
    '  base = mix(base, vec3(.72,.92,.93), capAmt);',
    '  float cl = smoothstep(.66,.82, fbm(vec3(p.x*7., p.y*7., p.z*26.) + 3.3, OC(7.)))*exp(-pow((abs(lat) - 40.)/10., 2.));',
    '  base = mix(base, vec3(.85,.95,.95), cl*.45);',
    '  return gasLight(base, n, L, V, sh, .12, vec3(.6,.9,.95), .14);',
    '}',
    ''
  ].join('\n') };

  /* ---------------------------------------------------------------- Neptune */
  K.neptune = { src: gasLight + [
    'vec3 surf(vec3 p, vec3 n, vec3 L, vec3 V, float sh){',
    '  float lat = degrees(asin(clamp(p.z,-1.,1.)));',
    '  float lon = atan(p.y, p.x);',
    '  float w1 = fbm(vec3(p.x*3.5, p.y*3.5, p.z*11.) + 1.1, OC(3.5)) - .5;',
    '  float f1 = fbm(vec3(p.x*10., p.y*10., p.z*34.) + 2.1, OC(10.));',
    '  float bands = .5 + .5*sin(radians(lat)*5.5 + 3.*w1);',
    '  vec3 base = mix(vec3(.15,.30,.78), vec3(.24,.42,.88), bands);',
    '  base *= .94 + .1*(f1 - .5)*2.;',
    '  base = mix(base, vec3(.12,.22,.62), smoothstep(40.,80.,-lat)*.5);',
    // bright high-altitude streaks
    '  float st = fbm(vec3(p.x*5., p.y*5., p.z*20.) + 9.1, OC(5.));',
    '  float zone = exp(-pow((lat + 42.)/6., 2.)) + .8*exp(-pow((lat - 28.)/6., 2.)) + .7*exp(-pow((lat + 20.)/4.5, 2.));',
    '  base = mix(base, vec3(.88,.94,1.), smoothstep(.6,.76,st)*zone*.6);',
    // Great Dark Spot with its companion
    '  vec2 e = vec2(wrapPi(lon - 1.) *cos(radians(-22.))/.2, radians(lat + 22.)/.1);',
    '  float r = length(e);',
    '  base = mix(base, vec3(.05,.10,.34), (1. - smoothstep(.6,1.,r))*.85);',
    '  vec2 e2 = vec2(wrapPi(lon - .55)*cos(radians(-30.))/.12, radians(lat + 36.)/.04);',
    '  base = mix(base, vec3(.92,.96,1.), (1. - smoothstep(.5,1.,length(e2)))*.75);',
    '  return gasLight(base, n, L, V, sh, .12, vec3(.35,.55,1.), .16);',
    '}',
    ''
  ].join('\n') };

  /* -------------------------------------------------------------------- Sun */
  K.sun = { src: [
    'vec3 surf(vec3 p, vec3 n, vec3 L, vec3 V, float sh){',
    '  float mu = max(dot(n,V), 0.);',
    '  float lat = degrees(asin(clamp(p.z,-1.,1.)));',
    '  float ld = 1. - .6*(1. - mu) - .18*(1. - mu)*(1. - mu);',
    '  vec3 base = mix(vec3(1.,.42,.10), vec3(1.,.84,.50), pow(mu, .55));',
    '  float gfade = smoothstep(1.2, 4., u_radius/80.);',
    '  vec2 v = vor(p*80. + vec3(0.,0.,u_time*.04));',
    '  float gran = smoothstep(0., .32, v.y - v.x);',
    '  float g2 = fbm(p*190. + u_time*.05, OC(190.));',
    '  float sg = fbm(p*7. + u_time*.01, OC(7.));',
    '  float bright = mix(1., .66 + .46*gran + .07*(g2 - .5), gfade)*(.93 + .14*sg);',
    '  float sp = fbm(p*2.4 + vec3(7.,u_seed,2.), OC(2.4));',
    '  float latw = exp(-pow((abs(lat) - 16.)/12., 2.));',
    '  float sv = sp + .14*latw - .06;',
    '  float pen = smoothstep(.64,.7, sv), umb = smoothstep(.71,.76, sv);',
    '  bright *= 1. - .45*pen - .45*umb;',
    '  bright *= 1. + .25*(1. - mu)*smoothstep(.55,.8,fbm(p*14., OC(14.)));',
    '  vec3 col = L2(base)*ld*bright*1.35;',
    '  return col;',
    '}',
    ''
  ].join('\n') };
})();
