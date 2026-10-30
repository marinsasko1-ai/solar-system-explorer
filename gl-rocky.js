/* Procedural surfaces for airless / rocky bodies: Moon, Mercury, Mars, Venus. */
(function () {
  var K = window.PGL_SRC.kinds;

  // crater fields with analytic slopes (bump mapping) + bright fresh ejecta
  var craterLib = [
    'float cfade(float f){ return smoothstep(1.3, 4.5, .3/f*u_radius); }',
    'void craters(vec3 p, float f, float dens, float seed, inout vec3 slope, inout float fresh){',
    '  float fade = cfade(f);',
    '  if(fade <= 0.) return;',
    '  vec3 q = p*f + seed*13.7;',
    '  vec3 ip = floor(q);',
    '  for(int x=-1;x<=1;x++) for(int y=-1;y<=1;y++) for(int z=-1;z<=1;z++){',
    '    vec3 c = ip + vec3(float(x),float(y),float(z));',
    '    vec3 h = hash33(c + seed*1.37);',
    '    if(h.x > dens) continue;',
    '    vec3 ctr = c + .2 + .6*hash33(c*1.31 + seed + 3.7);',
    '    float rad = mix(.16, .5, h.y*h.y);',
    '    vec3 dv = q - ctr; float dd = length(dv); float d = dd/rad;',
    '    if(d > 2.4) continue;',
    '    float age = h.z;',
    '    float dep = rad*mix(.26, .08, age);',
    '    float dh;',
    '    if(d < 1.) dh = 2.*dep*d;',
    '    else { float t = (d-1.)/.14; dh = dep*.45*exp(-t*t)*(-2.*t/.14) - dep*.12*2.4*exp(-(d-1.)*2.4); }',
    '    slope += fade*dh*dv/max(dd*rad, 1e-4);',
    '    fresh += fade*(1.-age)*(1.-age)*exp(-max(d-1.,0.)*1.1)*(1.-smoothstep(1.4,2.4,d))*step(.6,d);',
    '  }',
    '}',
    'vec3 bumpN(vec3 n, vec3 sl, float k){ return normalize(n - k*(sl - dot(sl,n)*n)); }',
    // bright ray system radiating from centre c
    'float rays(vec3 p, vec3 c, float reachDeg, float seed){',
    '  float cd = dot(p,c); float ang = acos(clamp(cd,-1.,1.));',
    '  float reach = radians(reachDeg);',
    '  if(ang > reach) return 0.;',
    '  vec3 tp = p - c*cd; vec3 dir = tp/max(length(tp),1e-4);',
    '  float r = smoothstep(.2,.7, gn(dir*4.5 + seed*3.1)*.6 + gn(dir*11. + seed)*.35 + .42);',
    '  return r*(1.-ang/reach)*smoothstep(0.,.03,ang);',
    '}',
    ''
  ].join('\n');

  window.PGL_SRC.craterLib = craterLib;   // reused by gl-moons.js

  /* ------------------------------------------------------------------ Moon */
  K.moon = { src: craterLib + [
    'vec3 surf(vec3 p, vec3 n, vec3 L, vec3 V, float sh){',
    '  vec3 sl = vec3(0.); float fr = 0.;',
    '  craters(p, 2.4, .8, 1., sl, fr);  craters(p, 4., .85, 2., sl, fr);  craters(p, 7., .85, 3., sl, fr);',
    '  craters(p, 12., .85, 4., sl, fr);  craters(p, 20., .85, 5., sl, fr);  craters(p, 34., .85, 6., sl, fr);',
    '  craters(p, 58., .85, 7., sl, fr);  craters(p, 98., .85, 8., sl, fr);  craters(p, 165., .85, 9., sl, fr);',
    '  craters(p, 280., .85, 10., sl, fr);  craters(p, 470., .85, 11., sl, fr);',
    '  float w = fbm(p*4., OC(4.)) - .5, w2 = fbm(p*13., OC(13.)) - .5;',
    '  vec3 pw = normalize(p + w*.42 + w2*.10);',
    '  float m = 0.;',
    '  m = max(m, blob(pw, ll(33.,-16.), 19.));',    // Imbrium
    '  m = max(m, blob(pw, ll(28.,18.), 9.));',      // Serenitatis
    '  m = max(m, blob(pw, ll(8.,31.), 11.));',      // Tranquillitatis
    '  m = max(m, blob(pw, ll(17.,59.), 7.));',      // Crisium
    '  m = max(m, blob(pw, ll(-4.,52.), 8.));',      // Fecunditatis
    '  m = max(m, blob(pw, ll(-15.,34.), 6.));',     // Nectaris
    '  m = max(m, blob(pw, ll(-21.,-15.), 10.));',   // Nubium
    '  m = max(m, blob(pw, ll(-24.,-39.), 6.));',    // Humorum
    '  m = max(m, blob(pw, ll(18.,-52.), 24.)*.95);',// Procellarum
    '  m = max(m, blob(pw, ll(56.,0.), 9.)*.8);',    // Frigoris
    '  m = max(m, blob(pw, ll(2.,-2.), 6.)*.7);',    // Vaporum / Medii
    '  m = max(m, blob(pw, ll(-45.,-170.), 9.)*.85);', // Orientale-ish far side basin (South Pole-Aitken hint)
    '  m = max(m, blob(pw, ll(-55.,180.), 24.)*.55);',
    '  m = smoothstep(.4, .62, m*(.85 + .35*fbm(p*9., OC(9.))));',
    '  float tx = fbm(p*11., OC(11.));',
    '  vec3 hi = vec3(.62,.61,.585)*(.82 + .36*tx);',
    '  vec3 ma = vec3(.255,.255,.27)*(.78 + .44*fbm(p*17., OC(17.)));',
    '  vec3 alb = mix(hi, ma, m);',
    '  float ry = rays(p, ll(-43.3,-11.4), 55., 1.) + rays(p, ll(9.6,-20.1), 18., 2.) + .8*rays(p, ll(8.1,-38.), 14., 3.);',
    '  alb = mix(alb, vec3(.9,.89,.86), clamp(fr*.55 + ry*.65, 0., 1.)*(1. - .35*m));',
    '  vec3 nn = bumpN(n, sl, 1.5);',
    '  float mu0 = max(dot(nn,L), 0.), mu = max(dot(nn,V), .05);',
    '  float ls = mu0/(mu0 + mu);',
    '  float term = smoothstep(0., .05, dot(n,L));',
    '  float op = 1. + .7*pow(max(dot(L,V),0.), 10.);',
    '  vec3 a = L2(alb);',
    '  return a*ls*2.7*term*op + a*(u_night > .5 ? .004 : .06);',
    '}',
    ''
  ].join('\n') };

  /* --------------------------------------------------------------- Mercury */
  K.mercury = { src: craterLib + [
    'vec3 surf(vec3 p, vec3 n, vec3 L, vec3 V, float sh){',
    '  vec3 sl = vec3(0.); float fr = 0.;',
    '  craters(p, 2.6, .85, 11., sl, fr);  craters(p, 4.5, .85, 12., sl, fr);  craters(p, 8., .85, 13., sl, fr);',
    '  craters(p, 14., .85, 14., sl, fr);  craters(p, 24., .85, 15., sl, fr);  craters(p, 41., .85, 16., sl, fr);',
    '  craters(p, 70., .85, 17., sl, fr);  craters(p, 120., .85, 18., sl, fr);  craters(p, 205., .85, 19., sl, fr);',
    '  craters(p, 350., .85, 20., sl, fr);  craters(p, 600., .85, 21., sl, fr);',
    '  float w = fbm(p*4., OC(4.)) - .5;',
    '  vec3 pw = normalize(p + w*.2);',
    '  float pl = blob(pw, ll(30.,160.), 20.)*.8 + blob(pw, ll(-5.,-60.), 28.)*.5 + blob(pw, ll(55.,-100.), 22.)*.45;',
    '  pl = smoothstep(.25,.7,pl);',
    '  float tx = fbm(p*8., OC(8.)), t2 = fbm(p*21., OC(21.));',
    '  vec3 base = mix(vec3(.40,.375,.35), vec3(.50,.47,.43), tx);',
    '  vec3 plain = vec3(.45,.43,.41)*(.9 + .2*t2);',
    '  vec3 alb = mix(base*(.8 + .4*t2), plain, pl);',
    '  alb = mix(alb, vec3(.72,.70,.66), clamp(fr*.6, 0., 1.));',
    '  alb = mix(alb, vec3(.62,.60,.57), .35*rays(p, ll(-48.,-57.), 40., 4.));',
    '  vec3 nn = bumpN(n, sl, 1.7);',
    '  float mu0 = max(dot(nn,L), 0.), mu = max(dot(nn,V), .05);',
    '  float ls = mu0/(mu0 + mu);',
    '  float term = smoothstep(0., .05, dot(n,L));',
    '  float op = 1. + .6*pow(max(dot(L,V),0.), 10.);',
    '  vec3 a = L2(alb);',
    '  return a*ls*2.9*term*op + a*(u_night > .5 ? .002 : .06);',
    '}',
    ''
  ].join('\n') };

  /* ------------------------------------------------------------------ Venus */
  K.venus = { src: [
    'vec3 surf(vec3 p, vec3 n, vec3 L, vec3 V, float sh){',
    '  float lat = asin(clamp(p.z,-1.,1.));',
    '  vec3 w = vec3(fbm(p*2.+3., OC(2.)), fbm(p*2.+7., OC(2.)), fbm(p*2.+11., OC(2.))) - .5;',
    '  float c1 = fbm(p*vec3(3.,3.,6.) + w*2.2, OC(3.));',
    '  float c2 = fbm(p*vec3(7.,7.,15.) + w*3. + c1*1.5, OC(7.));',
    '  float c3 = fbm(p*vec3(15.,15.,34.) + w*3.5 + c2*2., OC(15.));',
    '  float chev = smoothstep(.42,.72, fbm(vec3(p.x*1.2,p.y*1.2,p.z*3.2) + w*1.8 + 5., OC(1.2)));',
    '  vec3 cream = vec3(.92,.82,.58), white = vec3(.98,.94,.82), tn = vec3(.78,.60,.36);',
    '  vec3 alb = mix(cream, white, smoothstep(.35,.7,c1));',
    '  alb = mix(alb, tn*vec3(.92,.82,.66), chev*.75*(1. - .5*smoothstep(.5,1.3,abs(lat))));',
    '  alb *= .78 + .38*c2 + .14*(c3 - .5);',
    '  alb = mix(alb, white*.97, smoothstep(1.,1.45,abs(lat))*.5);',
    '  float dl = dot(n,L);',
    '  float dif = pow(smoothstep(-.3, 1., dl), 1.15);',
    '  vec3 a = L2(alb);',
    '  vec3 col = a*dif*1.18*sh;',
    '  float mu = max(dot(n,V), 0.);',
    '  float tw = exp(-pow(dl/.28, 2.));',
    '  col += L2(vec3(1.,.62,.28))*tw*.05*(1. - mu*.5);',
    '  col += L2(vec3(1.,.92,.65))*pow(1. - mu, 3.)*.22*smoothstep(-.3,.5,dl);',
    '  col += a*(u_night > .5 ? .003 : .05);',
    '  return col;',
    '}',
    ''
  ].join('\n') };

  /* ------------------------------------------------------------------- Mars */
  K.mars = { src: craterLib + [
    'vec3 surf(vec3 p, vec3 n, vec3 L, vec3 V, float sh){',
    '  float lat = degrees(asin(clamp(p.z,-1.,1.)));',
    '  float lon = degrees(atan(p.y, p.x));',
    '  vec3 sl = vec3(0.); float fr = 0.;',
    '  craters(p, 8., .5, 21., sl, fr);  craters(p, 22., .55, 22., sl, fr);  craters(p, 60., .55, 23., sl, fr);',
    '  craters(p, 160., .55, 24., sl, fr);  craters(p, 400., .55, 25., sl, fr);',
    '  float w = fbm(p*3.5 + 2., OC(3.5)) - .5;',
    '  float w2 = fbm(p*11., OC(11.)) - .5;',
    '  vec3 pw = normalize(p + w*.42 + w2*.12);',
    '  float dk = 0.;',
    '  dk = max(dk, blob(pw, ll(8.,69.), 14.));',        // Syrtis Major
    '  dk = max(dk, blob(pw, ll(-32.,100.), 22.)*.8);',
    '  dk = max(dk, blob(pw, ll(-38.,-12.), 22.)*.9);',  // Erythraeum / Sirenum
    '  dk = max(dk, blob(pw, ll(45.,-30.), 22.)*.8);',   // Acidalia
    '  dk = max(dk, blob(pw, ll(-5.,-5.), 13.)*.6);',    // Meridiani
    '  dk = max(dk, blob(pw, ll(-30.,-150.), 24.)*.75);',
    '  dk = max(dk, blob(pw, ll(50.,70.), 18.)*.6);',    // Utopia
    '  float tex = fbm(p*5., OC(5.));',
    '  dk = clamp(dk*(.45 + 1.0*tex) + (tex - .5)*.25*smoothstep(0.,.3,dk), 0., 1.);',
    '  vec3 bright = mix(vec3(.74,.43,.27), vec3(.80,.56,.36), smoothstep(.4,.7,fbm(p*3.+9., OC(3.))))*(.88 + .24*fbm(p*9., OC(9.)));',
    '  vec3 dark = vec3(.42,.26,.19)*(.82 + .36*fbm(p*14., OC(14.)));',
    '  vec3 alb = mix(bright, dark, smoothstep(.2,.8,dk));',
    '  alb = mix(alb, vec3(.86,.66,.50), blob(p, ll(-42.,70.), 9.)*.9);',    // Hellas
    '  alb = mix(alb, vec3(.86,.68,.54), blob(p, ll(-50.,-43.), 5.)*.8);',   // Argyre
    '  alb = mix(alb, vec3(.62,.38,.28), blob(p, ll(15.,-110.), 24.)*.55);', // Tharsis
    '  alb = mix(alb, vec3(.80,.60,.46), blob(p, ll(18.,-134.), 3.5));',      // Olympus Mons
    '  float vm = exp(-pow((lat + 11. + 2.*sin(lon*.12))/2.2, 2.))*smoothstep(-100.,-92.,lon)*(1. - smoothstep(-58.,-50.,lon));',
    '  alb = mix(alb, vec3(.34,.20,.15), vm*(.35 + .35*fbm(p*30., OC(30.))));',
    '  float capN = smoothstep(80. + 5.*(w+.1), 84. + 4.*w, lat);',
    '  float capS = smoothstep(-76. - 8.*(w+.1), -83. - 6.*w, lat);',
    '  alb = mix(alb, vec3(.95,.94,.95), clamp(capN + capS, 0., 1.));',
    '  alb = mix(alb, vec3(.95,.80,.62), clamp(fr*.25, 0., 1.));',
    '  vec3 nn = bumpN(n, sl, .5);',
    '  float dl = dot(n,L);',
    '  float dif = wrapd(dot(nn,L), .06)*smoothstep(-.08,.12,dl);',
    '  vec3 a = L2(alb);',
    '  vec3 col = a*dif*1.45*sh;',
    '  float mu = max(dot(n,V), 0.);',
    '  col += L2(vec3(.95,.65,.42))*pow(1. - mu, 4.)*.28*smoothstep(-.2,.6,dl);',
    '  col += L2(vec3(.7,.45,.5))*exp(-pow(dl/.1, 2.))*.03;',
    '  col += a*(u_night > .5 ? .003 : .05);',
    '  return col;',
    '}',
    ''
  ].join('\n') };
})();
