/* Procedural surfaces for moons and dwarf planets:
   Io, Europa, Ganymede, Callisto, Titan, Enceladus, Mimas, Phobos, Deimos, Charon, Ceres, Pluto, Haumea, Makemake, Eris.
   Real features are placed where the spacecraft maps show them. Haumea, Makemake and Eris have never been resolved,
   so their surfaces are imagined from their colour and brightness. */
(function () {
  var K = window.PGL_SRC.kinds;
  var craterLib = window.PGL_SRC.craterLib;

  /* Shared helpers: airless (Lommel-Seeliger) and Lambert-style lighting, and one big crater with a rim and a central peak. */
  var moonLib = [
    'vec3 airless(vec3 alb, vec3 n, vec3 nn, vec3 L, vec3 V, float gain){',
    '  float mu0 = max(dot(nn,L), 0.), mu = max(dot(nn,V), .05);',
    '  float ls = mu0/(mu0 + mu);',
    '  float term = smoothstep(0., .05, dot(n,L));',
    '  float op = 1. + .7*pow(max(dot(L,V),0.), 10.);',
    '  vec3 a = L2(alb);',
    '  return a*ls*gain*term*op + a*(u_night > .5 ? .004 : .06);',
    '}',
    'vec3 lamb(vec3 alb, vec3 n, vec3 nn, vec3 L, vec3 V, float gain, float wrap){',
    '  float dl = dot(n,L);',
    '  float dif = wrapd(dot(nn,L), wrap)*smoothstep(-.06 - wrap*.2, .1, dl);',
    '  vec3 a = L2(alb);',
    '  return a*dif*gain + a*(u_night > .5 ? .004 : .05);',
    '}',
    'void bigCrater(vec3 p, vec3 c, float rDeg, float depth, float peak, inout vec3 slope){',
    '  float rad = 2.*sin(radians(rDeg)*.5);',
    '  vec3 dv = p - c; float dd = length(dv); float d = dd/rad;',
    '  if(d > 2.4 || dd < 1e-5) return;',
    '  float dep = rad*depth;',
    '  float dh;',
    '  if(d < 1.) dh = 2.*dep*d;',
    '  else { float t = (d-1.)/.14; dh = dep*.45*exp(-t*t)*(-2.*t/.14) - dep*.12*2.4*exp(-(d-1.)*2.4); }',
    '  slope += dh*dv/(dd*rad);',
    '  if(d < .22) slope -= peak*depth/.22*dv/dd;',
    '}',
    ''
  ].join('\n');
  var lib = craterLib + moonLib;

  /* -------------------------------------------------------------------- Io */
  K.io = { src: lib + [
    'const vec3 PAT[9] = vec3[9](vec3(-18.,-105.,3.2), vec3(13.,-52.,2.6), vec3(-2.,153.,1.7), vec3(24.,-114.,1.6), vec3(63.,-122.,1.5), vec3(-12.,-116.,1.5), vec3(-49.,-56.,1.7), vec3(-28.,-150.,1.5), vec3(19.,-160.,1.4));',
    'vec3 surf(vec3 p, vec3 n, vec3 L, vec3 V, float sh){',
    '  float lat = degrees(asin(clamp(p.z,-1.,1.)));',
    '  float lon = degrees(atan(p.y, p.x));',
    '  float w = fbm(p*3. + 1.3, OC(3.)) - .5;',
    '  vec3 pw = normalize(p + w*.22);',
    '  float f1 = fbm(pw*2.4 + 4., OC(2.4)), f2 = fbm(pw*6.5 + 9., OC(6.5));',
    '  float f3 = fbm(pw*24. + 2., OC(24.)), f4 = fbm(pw*70. + 5., OC(70.));',
    '  vec3 pale = vec3(.94,.91,.72), yel = vec3(.90,.78,.30), org = vec3(.82,.47,.17);',
    '  vec3 alb = mix(pale, yel, smoothstep(.38,.62,f1));',
    '  alb = mix(alb, org, smoothstep(.56,.74,f2)*.75);',
    '  alb = mix(alb, vec3(.97,.97,.93), smoothstep(.62,.78,fbm(pw*5. + 17., OC(5.)))*.55);',      // sulfur dioxide frost
    '  alb = mix(alb, vec3(.46,.30,.17), smoothstep(52.,80.,abs(lat))*.65);',                     // darker, redder poles
    '  alb = mix(alb, org*vec3(.95,.8,.7), (.5 + .5*cos(radians(lon - 270.)))*.18);',             // trailing side is redder
    '  alb *= .9 + .2*f3 + .08*(f4 - .5);',
    '  for(int i=0;i<9;i++){',
    '    vec3 pt = PAT[i];',
    '    float d = degrees(acos(clamp(dot(p, ll(pt.x, pt.y)), -1., 1.)));',
    '    float rr = pt.z;',
    '    alb = mix(alb, vec3(.75,.30,.12), (1. - smoothstep(rr*1.6, rr*4.5, d))*.45);',           // warm halo of fresh sulfur
    '    if(i == 0) alb = mix(alb, vec3(.78,.22,.10), smoothstep(9.,12.,d)*(1. - smoothstep(14.,18.,d))*.85);', // Pele\'s red ring
    '    alb = mix(alb, vec3(.05,.045,.04), 1. - smoothstep(rr*.7, rr, d));',                    // lava lake
    '    if(i == 1) alb = mix(alb, vec3(.96,.95,.88), smoothstep(rr*.95, rr*1.2, d)*(1. - smoothstep(rr*1.2, rr*2.2, d))*.55);', // Loki\'s bright margin
    '  }',
    '  return lamb(alb, n, n, L, V, 1.5, .12);',
    '}',
    ''
  ].join('\n') };

  /* ---------------------------------------------------------------- Europa */
  K.europa = { src: lib + [
    'vec3 surf(vec3 p, vec3 n, vec3 L, vec3 V, float sh){',
    '  float w = fbm(p*3. + 7., OC(3.)) - .5;',
    '  vec3 pw = normalize(p + w*.14);',
    '  float tn = fbm(pw*1.8 + 3., OC(1.8));',
    '  vec3 alb = mix(vec3(.84,.83,.78), vec3(.76,.70,.62), smoothstep(.42,.66,tn)*.8);',
    '  float tr = .5 + .5*cos(atan(p.y, p.x) - radians(270.));',                                   // trailing side
    '  alb = mix(alb, vec3(.70,.55,.45), tr*.28*smoothstep(.4,.6,tn + .1));',
    '  float chm = smoothstep(.56,.70, fbm(pw*3.2 + 11., OC(3.2)));',
    '  float chd = fbm(pw*14. + 3., OC(14.));',
    '  alb = mix(alb, vec3(.58,.40,.29)*(.8 + .4*chd), chm*smoothstep(.35,.6,chd)*.85);',          // chaos terrain
    '  float lin = 0.;',
    '  float wob = (fbm(pw*2.1 + 9., OC(2.1)) - .5)*.2;',
    '  for(int i=0;i<20;i++){',
    '    float fi = float(i);',
    '    vec3 nr = normalize(hash33(vec3(fi*1.713 + .3, fi*.917 + 2.1, fi*2.311 + 5.)) - .5 + vec3(.0001));',
    '    float d = dot(pw, nr) + wob*(.6 + .8*hash11(fi*7.7));',
    '    float aa = fwidth(d)*1.3 + .002;',
    '    float wd = mix(.006, .02, hash11(fi*3.3 + 1.));',
    '    float seg = smoothstep(-.12, .22, gn(pw*2.4 + fi*1.9 + 3.));',
    '    lin = max(lin, (1. - smoothstep(wd, wd + aa, abs(d)))*seg*mix(.55, 1., hash11(fi*5.1)));',
    '  }',
    '  float g3 = gn(pw*13. + vec3(2.,9.,4.));',                                                    // fine cracks
    '  float l3 = (1. - smoothstep(0., .07, abs(g3)))*smoothstep(1., 3., OC(13.))*smoothstep(.1,.45, fbm(pw*3. + 21., OC(3.)));',
    '  lin = clamp(lin + l3*.08, 0., 1.);',
    '  alb = mix(alb, vec3(.52,.33,.23), lin*.85);',
    '  alb *= .94 + .1*fbm(p*30., OC(30.));',
    '  vec3 sl = vec3(0.); float fr = 0.;',
    '  craters(p, 14., .05, 31., sl, fr); craters(p, 34., .05, 32., sl, fr);',
    '  vec3 pwy = ll(-25.,-89.);',
    '  alb = mix(alb, vec3(.95,.95,.93), clamp(blob(p, pwy, 1.8)*.9 + rays(p, pwy, 22., 6.)*.5 + fr*.5, 0., 1.));',  // Pwyll and its rays
    '  vec3 nn = bumpN(n, sl, .8);',
    '  return lamb(alb, n, nn, L, V, 1.5, .1);',
    '}',
    ''
  ].join('\n') };

  /* -------------------------------------------------------------- Ganymede */
  K.ganymede = { src: lib + [
    'vec3 surf(vec3 p, vec3 n, vec3 L, vec3 V, float sh){',
    '  float lat = degrees(asin(clamp(p.z,-1.,1.)));',
    '  float w = fbm(p*2.5 + 5., OC(2.5)) - .5, w2 = fbm(p*8., OC(8.)) - .5;',
    '  vec3 pw = normalize(p + w*.30 + w2*.06);',
    '  float tm = fbm(pw*2. + 5., OC(2.));',
    '  float br = smoothstep(.42,.54,tm);',                                                         // bright grooved terrain
    '  vec3 dk = vec3(.31,.27,.235)*(.82 + .36*fbm(p*9., OC(9.)));',
    '  vec3 bt = vec3(.60,.55,.48)*(.88 + .24*fbm(p*14., OC(14.)));',
    '  vec3 dir = normalize(vec3(fbm(pw*1.5 + 2., OC(1.5)) - .5, fbm(pw*1.5 + 8., OC(1.5)) - .5, fbm(pw*1.5 + 14., OC(1.5)) - .5) + vec3(.001));',
    '  float gr = .5 + .5*sin(dot(pw, dir)*85. + 7.*(fbm(pw*6., OC(6.)) - .5));',
    '  bt *= 1. - .16*(1. - gr)*smoothstep(0., 2., OC(30.));',                                      // grooves
    '  vec3 sl = vec3(0.); float fr = 0.;',
    '  craters(p, 5., .7, 41., sl, fr);  craters(p, 11., .7, 42., sl, fr);  craters(p, 24., .75, 43., sl, fr);',
    '  craters(p, 52., .75, 44., sl, fr);  craters(p, 110., .75, 45., sl, fr);  craters(p, 230., .75, 46., sl, fr);',
    '  sl *= mix(1., .45, br);',
    '  vec3 alb = mix(dk, bt, br);',
    '  alb = mix(alb, vec3(.84,.84,.82), clamp(fr*.38 + rays(p, ll(11.,26.), 24., 3.)*.45, 0., .85));', // bright ray craters
    '  float pf = smoothstep(52. + 10.*w, 70. + 6.*w, abs(lat));',                                  // polar frost
    '  alb = mix(alb, vec3(.80,.82,.85)*(.95 + .1*fbm(p*20., OC(20.))), pf*.85);',
    '  vec3 nn = bumpN(n, sl, 1.1);',
    '  return airless(alb, n, nn, L, V, 2.7);',
    '}',
    ''
  ].join('\n') };

  /* -------------------------------------------------------------- Callisto */
  K.callisto = { src: lib + [
    'vec3 surf(vec3 p, vec3 n, vec3 L, vec3 V, float sh){',
    '  vec3 sl = vec3(0.); float fr = 0.;',
    '  craters(p, 4., .85, 51., sl, fr);  craters(p, 8., .85, 52., sl, fr);  craters(p, 15., .85, 53., sl, fr);',
    '  craters(p, 28., .85, 54., sl, fr);  craters(p, 52., .85, 55., sl, fr);  craters(p, 96., .85, 56., sl, fr);',
    '  craters(p, 180., .85, 57., sl, fr);  craters(p, 340., .85, 58., sl, fr);  craters(p, 640., .85, 59., sl, fr);',
    '  float tx = fbm(p*7., OC(7.)), t2 = fbm(p*30., OC(30.));',
    '  vec3 alb = vec3(.27,.235,.20)*(.78 + .44*tx)*(.92 + .16*t2);',
    '  alb = mix(alb, vec3(.80,.81,.82), clamp(fr*.3, 0., .75));',                                  // bright frost on fresh craters
    '  vec3 c = ll(14.,-56.);',                                                                     // Valhalla
    '  float ang = acos(clamp(dot(p, c), -1., 1.));',
    '  float core = 1. - smoothstep(.04,.16,ang);',
    '  float rg = (1. - smoothstep(0., .35, abs(sin(ang*22.))))*smoothstep(.16,.24,ang)*(1. - smoothstep(.55,.78,ang));',
    '  alb = mix(alb, vec3(.72,.70,.66), core*.9);',
    '  alb = mix(alb, vec3(.55,.52,.48), rg*.35);',
    '  vec3 nn = bumpN(n, sl, 1.5);',
    '  return airless(alb, n, nn, L, V, 2.7);',
    '}',
    ''
  ].join('\n') };

  /* ----------------------------------------------------------------- Titan */
  K.titan = { src: [
    'vec3 surf(vec3 p, vec3 n, vec3 L, vec3 V, float sh){',
    '  float lat = degrees(asin(clamp(p.z,-1.,1.)));',
    '  vec3 w = vec3(fbm(p*2. + 3., OC(2.)), fbm(p*2. + 7., OC(2.)), fbm(p*2. + 11., OC(2.))) - .5;',
    '  float c1 = fbm(p*vec3(3.,3.,5.) + w*1.4, OC(3.));',
    '  float c2 = fbm(p*vec3(9.,9.,16.) + w*2. + c1, OC(9.));',
    '  vec3 alb = vec3(.80,.54,.21)*(.88 + .26*c1)*(.94 + .1*c2);',
    '  alb = mix(alb, vec3(.60,.35,.12), smoothstep(52.,80.,lat)*.55);',                            // darker northern haze hood
    '  alb = mix(alb, vec3(.95,.68,.28), smoothstep(-30.,-70.,lat)*.25);',
    '  float dl = dot(n,L);',
    '  float dif = pow(smoothstep(-.28, 1., dl), 1.1);',
    '  vec3 a = L2(alb);',
    '  vec3 col = a*dif*1.35;',
    '  float mu = max(dot(n,V), 0.);',
    '  col += L2(vec3(1.,.55,.15))*pow(1. - mu, 2.5)*.5*smoothstep(-.3,.5,dl);',                    // haze glowing at the limb
    '  col += L2(vec3(1.,.5,.12))*exp(-pow(dl/.25, 2.))*.06;',
    '  col += a*(u_night > .5 ? .003 : .05);',
    '  return col;',
    '}',
    ''
  ].join('\n') };

  /* ------------------------------------------------------------- Enceladus */
  K.enceladus = { src: lib + [
    'vec3 surf(vec3 p, vec3 n, vec3 L, vec3 V, float sh){',
    '  float lat = degrees(asin(clamp(p.z,-1.,1.)));',
    '  float w = fbm(p*3. + 2., OC(3.)) - .5;',
    '  vec3 sl = vec3(0.); float fr = 0.;',
    '  craters(p, 5., .55, 61., sl, fr);  craters(p, 11., .6, 62., sl, fr);  craters(p, 24., .6, 63., sl, fr);',
    '  craters(p, 52., .6, 64., sl, fr);  craters(p, 110., .6, 65., sl, fr);',
    '  float old = smoothstep(-10., 40., lat);',
    '  vec3 alb = mix(vec3(.96,.97,.97), vec3(.84,.86,.88), old*.7*fbm(p*5., OC(5.)));',
    '  alb *= .92 + .12*fbm(p*20., OC(20.));',
    '  sl *= 1. - smoothstep(-20.,-55., lat)*.85;',                                                 // smooth southern plains
    '  float aS = smoothstep(-62., -72., lat);',
    '  float t = p.x*.6 - p.y*.8 + .02*(fbm(p*30., OC(30.)) - .5);',
    '  float st = max(1. - smoothstep(0., .018, abs(abs(t) - .07)), 1. - smoothstep(0., .018, abs(abs(t) - .21)));',
    '  alb = mix(alb, vec3(.99), aS*.4*(1. - smoothstep(.1,.32,abs(t))));',
    '  alb = mix(alb, vec3(.58,.80,.90), st*aS*.85);',                                              // the tiger stripes
    '  vec3 nn = bumpN(n, sl, 1.);',
    '  return lamb(alb, n, nn, L, V, 1.12, .06);',
    '}',
    ''
  ].join('\n') };

  /* ----------------------------------------------------------------- Mimas */
  K.mimas = { src: lib + [
    'vec3 surf(vec3 p, vec3 n, vec3 L, vec3 V, float sh){',
    '  vec3 sl = vec3(0.); float fr = 0.;',
    '  craters(p, 3., .85, 71., sl, fr);  craters(p, 6.5, .85, 72., sl, fr);  craters(p, 14., .85, 73., sl, fr);',
    '  craters(p, 26., .85, 74., sl, fr);  craters(p, 50., .85, 75., sl, fr);  craters(p, 95., .85, 76., sl, fr);',
    '  craters(p, 180., .85, 77., sl, fr);  craters(p, 340., .85, 78., sl, fr);',
    '  bigCrater(p, ll(0.,-112.), 19., .34, 1.1, sl);',                                               // Herschel
    '  vec3 alb = vec3(.68,.68,.70)*(.85 + .3*fbm(p*8., OC(8.)))*(.92 + .16*fbm(p*30., OC(30.)));',
    '  alb = mix(alb, vec3(.86,.87,.89), clamp(fr*.5, 0., 1.));',
    '  vec3 nn = bumpN(n, sl, 1.4);',
    '  return airless(alb, n, nn, L, V, 2.6);',
    '}',
    ''
  ].join('\n') };

  /* ---------------------------------------------------------------- Phobos */
  K.phobos = { src: lib + [
    'vec3 surf(vec3 p, vec3 n, vec3 L, vec3 V, float sh){',
    '  vec3 sl = vec3(0.); float fr = 0.;',
    '  craters(p, 3., .85, 81., sl, fr);  craters(p, 6., .85, 82., sl, fr);  craters(p, 12., .85, 83., sl, fr);',
    '  craters(p, 25., .85, 84., sl, fr);  craters(p, 50., .85, 85., sl, fr);  craters(p, 100., .85, 86., sl, fr);',
    '  craters(p, 200., .85, 87., sl, fr);  craters(p, 400., .85, 88., sl, fr);',
    '  bigCrater(p, ll(1.,-49.), 25., .22, 0., sl);',                                                // Stickney
    '  float rb = smoothstep(.45,.6, fbm(p*3. + 8., OC(3.)));',
    '  vec3 alb = mix(vec3(.26,.225,.195), vec3(.21,.215,.225), rb)*(.8 + .4*fbm(p*7., OC(7.)));',   // red and blue-grey terrain
    '  float gr = abs(sin(dot(p, vec3(.3,.9,.3))*60. + 8.*(fbm(p*5., OC(5.)) - .5)));',
    '  alb *= 1. - .14*smoothstep(.88, 1., gr)*smoothstep(1., 3., OC(30.));',                        // grooves
    '  alb = mix(alb, vec3(.34,.32,.30), clamp(fr*.45, 0., 1.));',
    '  vec3 nn = bumpN(n, sl, 1.3);',
    '  return airless(alb, n, nn, L, V, 2.7);',
    '}',
    ''
  ].join('\n') };

  /* ---------------------------------------------------------------- Deimos */
  K.deimos = { src: lib + [
    'vec3 surf(vec3 p, vec3 n, vec3 L, vec3 V, float sh){',
    '  vec3 sl = vec3(0.); float fr = 0.;',
    '  craters(p, 3., .6, 91., sl, fr);  craters(p, 7., .6, 92., sl, fr);  craters(p, 15., .6, 93., sl, fr);  craters(p, 34., .55, 94., sl, fr);',
    '  float dust = fbm(p*5., OC(5.));',
    '  vec3 alb = vec3(.33,.295,.26)*(.85 + .3*dust)*(.94 + .12*fbm(p*20., OC(20.)));',             // smooth dusty regolith
    '  alb = mix(alb, vec3(.42,.39,.36), clamp(fr*.3, 0., 1.));',
    '  vec3 nn = bumpN(n, sl, .6);',
    '  return airless(alb, n, nn, L, V, 2.7);',
    '}',
    ''
  ].join('\n') };

  /* ---------------------------------------------------------------- Charon */
  K.charon = { src: lib + [
    'vec3 surf(vec3 p, vec3 n, vec3 L, vec3 V, float sh){',
    '  float lat = degrees(asin(clamp(p.z,-1.,1.)));',
    '  float w = fbm(p*3. + 5., OC(3.)) - .5;',
    '  vec3 sl = vec3(0.); float fr = 0.;',
    '  craters(p, 4., .6, 101., sl, fr);  craters(p, 9., .6, 102., sl, fr);  craters(p, 20., .6, 103., sl, fr);',
    '  craters(p, 45., .6, 104., sl, fr);  craters(p, 100., .6, 105., sl, fr);  craters(p, 220., .6, 106., sl, fr);',
    '  sl *= 1. - smoothstep(-5.,-40., lat)*.8;',                                                    // smooth southern plains
    '  vec3 alb = vec3(.60,.59,.58)*(.86 + .28*fbm(p*6., OC(6.)))*(.92 + .16*fbm(p*25., OC(25.)));',
    '  float mm = smoothstep(52. + 8.*w, 72. + 6.*w, lat);',
    '  alb = mix(alb, vec3(.42,.22,.15)*(.9 + .2*fbm(p*10., OC(10.))), mm*.9);',                   // Mordor Macula
    '  float bl = exp(-pow((lat + 4.*w)/5., 2.));',
    '  alb = mix(alb, vec3(.48,.47,.46), bl*.4);',                                                   // canyon belt
    '  alb = mix(alb, vec3(.86,.86,.86), blob(p, ll(18.,15.), 1.4)*.8 + blob(p, ll(-26.,-137.), 1.2)*.7);', // bright young craters
    '  alb = mix(alb, vec3(.8,.8,.8), clamp(fr*.35, 0., 1.));',
    '  vec3 nn = bumpN(n, sl, .9);',
    '  return lamb(alb, n, nn, L, V, 1.55, .05);',
    '}',
    ''
  ].join('\n') };

  /* ----------------------------------------------------------------- Ceres */
  K.ceres = { src: lib + [
    'vec3 surf(vec3 p, vec3 n, vec3 L, vec3 V, float sh){',
    '  vec3 sl = vec3(0.); float fr = 0.;',
    '  craters(p, 3., .7, 111., sl, fr);  craters(p, 5.5, .7, 112., sl, fr);  craters(p, 10., .7, 113., sl, fr);',
    '  craters(p, 18., .7, 114., sl, fr);  craters(p, 32., .7, 115., sl, fr);  craters(p, 58., .7, 116., sl, fr);',
    '  craters(p, 105., .7, 117., sl, fr);  craters(p, 190., .7, 118., sl, fr);  craters(p, 350., .7, 119., sl, fr);',
    '  vec3 oc = ll(19.8,-120.7);',                                                                  // Occator
    '  bigCrater(p, oc, 5.6, .2, .4, sl);',
    '  vec3 alb = vec3(.30,.295,.285)*(.82 + .36*fbm(p*6., OC(6.)))*(.9 + .2*fbm(p*24., OC(24.)));',
    '  alb = mix(alb, vec3(.46,.48,.50), clamp(fr*.28, 0., 1.));',                                   // bluish fresh ejecta
    '  alb = mix(alb, vec3(.78,.78,.76), blob(p, oc, 1.7)*.95);',                                    // Cerealia Facula, the bright salts
    '  alb = mix(alb, vec3(.44,.44,.43), blob(p, oc, 5.)*.35);',
    '  alb = mix(alb, vec3(.46,.46,.45), blob(p, ll(-10.5,-44.), 1.3)*.45);',                        // Ahuna Mons
    '  vec3 nn = bumpN(n, sl, 1.4);',
    '  return airless(alb, n, nn, L, V, 2.8);',
    '}',
    ''
  ].join('\n') };

  /* ----------------------------------------------------------------- Pluto */
  K.pluto = { src: lib + [
    'vec3 surf(vec3 p, vec3 n, vec3 L, vec3 V, float sh){',
    '  float lat = degrees(asin(clamp(p.z,-1.,1.)));',
    '  float w = fbm(p*3. + 3., OC(3.)) - .5, w2 = fbm(p*9., OC(9.)) - .5;',
    '  vec3 pw = normalize(p + w*.30 + w2*.08);',
    '  float lon = degrees(atan(pw.y, pw.x));',
    '  float tx = fbm(pw*5., OC(5.)), t2 = fbm(pw*18., OC(18.));',
    '  vec3 alb = mix(vec3(.63,.50,.40), vec3(.76,.64,.52), smoothstep(.35,.7,tx));',
    '  alb *= .9 + .2*t2;',
    '  float cth = exp(-pow((lat + 3.)/13., 2.))*smoothstep(25.,50.,lon)*(1. - smoothstep(140.,168.,lon));',
    '  alb = mix(alb, vec3(.30,.15,.12)*(.85 + .3*t2), cth*.9);',                                     // Cthulhu Macula
    '  float dots = exp(-pow((lat + 2.)/10., 2.))*smoothstep(.5,.66, fbm(pw*vec3(9.,9.,6.) + 4., OC(9.)))*(1. - cth);',
    '  alb = mix(alb, vec3(.34,.17,.13), dots*.55);',
    '  alb = mix(alb, vec3(.46,.28,.22), smoothstep(55.,80.,lat)*.6);',                               // reddish north pole
    '  float sp = max(max(blob(pw, ll(33.,174.), 15.), blob(pw, ll(10.,181.), 14.)), blob(pw, ll(22.,171.), 17.));',
    '  float lobe = max(blob(pw, ll(25.,208.), 14.), blob(pw, ll(8.,215.), 10.));',
    '  vec2 v = vor(pw*18. + 3.);',
    '  float cells = mix(.93, 1., smoothstep(0., .12, v.y - v.x));',
    '  alb = mix(alb, vec3(.92,.80,.70)*(.97 + .06*t2), smoothstep(.45,.75,lobe)*.85);',               // eastern lobe of the heart
    '  alb = mix(alb, vec3(.96,.93,.88)*(.97 + .06*t2)*cells, smoothstep(.45,.75,sp));',              // Sputnik Planitia
    '  vec3 sl = vec3(0.); float fr = 0.;',
    '  craters(p, 14., .12, 121., sl, fr);  craters(p, 40., .1, 122., sl, fr);',
    '  sl *= 1. - smoothstep(.3,.6,sp)*.9;',
    '  vec3 nn = bumpN(n, sl, .5);',
    '  vec3 col = lamb(alb, n, nn, L, V, 1.5, .08);',
    '  float mu = max(dot(n,V), 0.);',
    '  col += L2(vec3(.55,.70,1.))*pow(1. - mu, 3.)*.12*smoothstep(-.1,.5,dot(n,L));',               // thin blue haze
    '  return col;',
    '}',
    ''
  ].join('\n') };

  /* ---------------------------------------------------------------- Haumea */
  K.haumea = { src: lib + [
    'vec3 surf(vec3 p, vec3 n, vec3 L, vec3 V, float sh){',
    '  vec3 alb = vec3(.84,.88,.93)*(.92 + .16*fbm(p*8., OC(8.)));',
    '  alb *= .95 + .1*fbm(p*28., OC(28.));',
    '  float dr = blob(p, ll(2.,40.), 26.);',
    '  alb = mix(alb, vec3(.52,.27,.20)*(.9 + .2*fbm(p*12., OC(12.))), smoothstep(.3,.7,dr)*.85);',   // the dark red spot
    '  vec3 sl = vec3(0.); float fr = 0.;',
    '  craters(p, 7., .07, 131., sl, fr);  craters(p, 18., .06, 132., sl, fr);',
    '  vec3 nn = bumpN(n, sl, .7);',
    '  return lamb(alb, n, nn, L, V, 1.45, .06);',
    '}',
    ''
  ].join('\n') };

  /* -------------------------------------------------------------- Makemake */
  K.makemake = { src: [
    'vec3 surf(vec3 p, vec3 n, vec3 L, vec3 V, float sh){',
    '  float w = fbm(p*3. + 5., OC(3.)) - .5;',
    '  vec3 pw = normalize(p + w*.2);',
    '  vec3 alb = mix(vec3(.62,.44,.35), vec3(.82,.66,.55), smoothstep(.35,.7, fbm(pw*3. + 2., OC(3.))));',
    '  alb = mix(alb, vec3(.38,.24,.19), smoothstep(.64,.78, fbm(pw*6. + 7., OC(6.)))*.55);',          // dark patches
    '  alb = mix(alb, vec3(.95,.91,.86), smoothstep(.55,.72, fbm(pw*4. + 13., OC(4.)))*.7);',         // methane frost
    '  alb *= .9 + .2*fbm(p*22., OC(22.));',
    '  return lamb(alb, n, n, L, V, 1.5, .06);',
    '}',
    ''
  ].join('\n').replace('vec3 surf', 'vec3 lamb(vec3 alb, vec3 n, vec3 nn, vec3 L, vec3 V, float gain, float wrap){\n  float dl = dot(n,L);\n  float dif = wrapd(dot(nn,L), wrap)*smoothstep(-.06 - wrap*.2, .1, dl);\n  vec3 a = L2(alb);\n  return a*dif*gain + a*(u_night > .5 ? .004 : .05);\n}\nvec3 surf') };

  /* ------------------------------------------------------------------ Eris */
  K.eris = { src: [
    'vec3 lamb(vec3 alb, vec3 n, vec3 nn, vec3 L, vec3 V, float gain, float wrap){',
    '  float dl = dot(n,L);',
    '  float dif = wrapd(dot(nn,L), wrap)*smoothstep(-.06 - wrap*.2, .1, dl);',
    '  vec3 a = L2(alb);',
    '  return a*dif*gain + a*(u_night > .5 ? .004 : .05);',
    '}',
    'vec3 surf(vec3 p, vec3 n, vec3 L, vec3 V, float sh){',
    '  vec3 alb = vec3(.92,.91,.89)*(.96 + .07*fbm(p*7., OC(7.)));',
    '  alb = mix(alb, vec3(.80,.75,.70), smoothstep(.55,.75, fbm(p*3. + 4., OC(3.)))*.75);',
    '  alb *= .97 + .06*fbm(p*25., OC(25.));',
    '  return lamb(alb, n, n, L, V, 1.12, .05);',
    '}',
    ''
  ].join('\n') };
})();
