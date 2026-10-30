(function(){
'use strict';

var $ = function(id){ return document.getElementById(id); };
var TAU = Math.PI * 2, RAD = Math.PI / 180;
var clamp = function(v, a, b){ return Math.max(a, Math.min(b, v)); };
var lerp = function(a, b, t){ return a + (b - a) * t; };

var J2000 = 946728000000, DAY = 86400000;
var AU_LIGHT_S = 499.004784, AU_MKM = 149.598;
var U_AU = 30.07;                 /* one world unit = Neptune's orbit radius = 30.07 AU */
var LY_AU = 63241.077;
var LY_U = LY_AU / U_AU;
var EPS = 23.4393 * RAD;
var MINZ = 4e-5, MAXZ = 2500, ZC = 10.9;      /* ZC: zoom above which a body grows with the zoom instead of staying at its exaggerated size */
var KM_U = AU_MKM * 1e6 * U_AU;    /* kilometres in one world unit */
var SPIN_CAP = 40;                 /* fastest spin shown on screen, degrees per real second, so fast sim speeds do not strobe */
var SPAN_K = 2.222 * U_AU;        /* view span in AU = SPAN_K / zoom (shorter side of the canvas) */
var SPEEDS = [1 / 86400, 1 / 1440, 1 / 24, 0.25, 1, 5, 14, 61, 365.25, 1826];
var SPEED_LABELS = ['Real time', '1 min/s', '1 hour/s', '6 hours/s', '1 day/s', '5 days/s', '2 weeks/s', '2 months/s', '1 year/s', '5 years/s'];
var MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ---------- Coordinates ---------- */
function toEcl(raDeg, decDeg, d){
  var a = raDeg * RAD, b = decDeg * RAD;
  var xe = d * Math.cos(b) * Math.cos(a), ye = d * Math.cos(b) * Math.sin(a), ze = d * Math.sin(b);
  return [xe, ye * Math.cos(EPS) + ze * Math.sin(EPS), -ye * Math.sin(EPS) + ze * Math.cos(EPS)];
}
function rotEcl(v){
  return [v[0], v[1] * Math.cos(EPS) + v[2] * Math.sin(EPS), -v[1] * Math.sin(EPS) + v[2] * Math.cos(EPS)];
}
function hexRgb(h){
  var n = parseInt(h.slice(1), 16);
  return ((n >> 16) & 255) + ',' + ((n >> 8) & 255) + ',' + (n & 255);
}

/* ---------- Data: Solar System ---------- */
function stats(diam, mass, grav, dist, year, day, tilt, temp, moons){
  return [['Diameter', diam], ['Mass', mass], ['Gravity', grav], ['Distance from Sun', dist],
          ['Year', year], ['Day', day], ['Axial tilt', tilt], ['Temperature', temp], ['Known moons', moons]];
}

var SUN = {
  id: 'sun', name: 'Sun', type: 'sun', group: 'system', color: '#ffcf6a', prio: 1,
  kind: 'Star · centre of the Solar System',
  blurb: 'A G-type star that holds 99.86% of the mass in the Solar System. Everything else orbits it.',
  fact: 'Energy made in the core takes thousands of years to work its way to the surface, then about 8 minutes to reach Earth.',
  stats: [['Diameter', '1,392,700 km'], ['Mass', '333,000 Earths'], ['Gravity', '274 m/s²'],
          ['Rotation', '25 days at the equator'], ['Surface temperature', '5,500 °C'],
          ['Core temperature', '15 million °C'], ['Age', '4.6 billion years'], ['Type', 'G2V yellow dwarf']],
  live: { wx: 0, wy: 0, wz: 0, r: 0, x: 0, y: 0 }
};

var PLANETS = [
  { id:'mercury', name:'Mercury', kind:'Terrestrial planet · 1st from the Sun',
    a:0.387, e:0.20563, peri:77.456, L0:252.251, period:87.969, g:3.70, color:'#c4bab0', dark:'#5a544d', px:3.2,
    blurb:'The smallest planet and the closest to the Sun. Its year is shorter than three Earth months.',
    fact:'A day on Mercury, sunrise to sunrise, lasts about 176 Earth days. That is twice as long as its year.',
    stats: stats('4,879 km','0.055 Earths','3.70 m/s²','0.387 AU · 57.9 M km','88 days','176 Earth days','0.03°','−180 to 430 °C','None') },
  { id:'venus', name:'Venus', kind:'Terrestrial planet · 2nd from the Sun',
    a:0.723, e:0.00677, peri:131.564, L0:181.980, period:224.701, g:8.87, color:'#f0d49a', dark:'#8a6a35', px:5.2,
    blurb:'The hottest planet, wrapped in thick clouds of carbon dioxide and sulphuric acid.',
    fact:'Venus spins backwards, so the Sun rises in the west. It turns so slowly that its day is longer than its year.',
    stats: stats('12,104 km','0.815 Earths','8.87 m/s²','0.723 AU · 108.2 M km','224.7 days','117 Earth days','177.4°','464 °C average','None') },
  { id:'earth', name:'Earth', kind:'Terrestrial planet · 3rd from the Sun',
    a:1.0, e:0.01671, peri:102.937, L0:100.465, period:365.256, g:9.81, color:'#6aa6ec', dark:'#1c3a75', px:5.6,
    blurb:'The only world known to host life, with liquid water across most of its surface.',
    fact:'Earth is the densest planet in the Solar System, at about 5.5 times the density of water.',
    stats: stats('12,742 km','1 Earth','9.81 m/s²','1.000 AU · 149.6 M km','365.25 days','24 hours','23.44°','15 °C average','1') },
  { id:'mars', name:'Mars', kind:'Terrestrial planet · 4th from the Sun',
    a:1.524, e:0.09339, peri:336.056, L0:355.447, period:686.980, g:3.71, color:'#e07a4c', dark:'#6a2a16', px:4.2,
    blurb:'A cold desert world with the tallest volcano in the Solar System, Olympus Mons.',
    fact:'Olympus Mons rises about 22 km, roughly two and a half times the height of Everest.',
    stats: stats('6,779 km','0.107 Earths','3.71 m/s²','1.524 AU · 227.9 M km','687 days','24 h 37 min','25.19°','−65 °C average','2') },
  { id:'jupiter', name:'Jupiter', kind:'Gas giant · 5th from the Sun', bands:true,
    a:5.203, e:0.04839, peri:14.728, L0:34.396, period:4332.59, g:24.79, color:'#e2c29a', dark:'#7d5b3a', px:11.5,
    blurb:'A gas giant with more than twice the mass of all the other planets combined.',
    fact:'The Great Red Spot is a storm about as wide as Earth, and people have watched it for well over a century.',
    stats: stats('139,820 km','317.8 Earths','24.79 m/s²','5.203 AU · 778.5 M km','11.86 years','9 h 56 min','3.13°','−110 °C cloud tops','95+') },
  { id:'saturn', name:'Saturn', kind:'Gas giant · 6th from the Sun', rings:true,
    a:9.582, e:0.05415, peri:92.599, L0:49.954, period:10759.22, g:10.44, color:'#ecdba8', dark:'#8a7541', px:9.5,
    blurb:'Famous for its rings, made mostly of water ice in pieces from dust grains to house-sized chunks.',
    fact:'Saturn is less dense than water. In a bathtub big enough to hold it, it would float.',
    stats: stats('116,460 km','95.2 Earths','10.44 m/s²','9.582 AU · 1,432 M km','29.5 years','10 h 34 min','26.73°','−140 °C cloud tops','270+') },
  { id:'uranus', name:'Uranus', kind:'Ice giant · 7th from the Sun',
    a:19.19, e:0.04717, peri:170.954, L0:313.238, period:30688.5, g:8.87, color:'#a8e6ec', dark:'#3f8a94', px:7.4,
    blurb:'An ice giant that rolls around the Sun on its side, tilted about 98 degrees.',
    fact:'Uranus was the first planet found with a telescope, spotted by William Herschel in 1781.',
    stats: stats('50,724 km','14.5 Earths','8.87 m/s²','19.19 AU · 2,867 M km','84 years','17 h 14 min','97.77°','−195 °C','29') },
  { id:'neptune', name:'Neptune', kind:'Ice giant · 8th from the Sun',
    a:30.07, e:0.00859, peri:44.965, L0:304.880, period:60182, g:11.15, color:'#6b8cf0', dark:'#243a8a', px:7.2,
    blurb:'The farthest planet, a deep blue ice giant with the fastest winds measured in the Solar System.',
    fact:'Neptune has made just one trip around the Sun since it was discovered in 1846. It finished that lap in 2011.',
    stats: stats('49,244 km','17.1 Earths','11.15 m/s²','30.07 AU · 4,515 M km','164.8 years','16 h 6 min','28.32°','−200 °C','16') }
];
PLANETS.forEach(function(p, i){
  p.type = 'planet'; p.group = 'system'; p.you = true; p.prio = 4 + i * 0.05;
  p.live = { wx: 0, wy: 0, wz: 0, r: p.a, x: p.a, y: 0, lam: 0 };
});

var MOON = { id:'moon', name:'Moon', type:'moon', group:'system', parent: PLANETS[2], color:'#c9c9cf', dark:'#5b5b62', px:1.9, prio:4.1,
  kind:'Moon · orbits Earth', period:27.3217, g:1.62, you:true, unit:'lunar months',
  blurb:'Earth’s only natural satellite. It always shows us the same face, and its pull raises the ocean tides.',
  fact:'The Moon drifts away from Earth by about 3.8 cm every year, roughly as fast as a fingernail grows.',
  stats:[['Diameter','3,474 km'],['Mass','0.0123 Earths'],['Gravity','1.62 m/s²'],['Distance from Earth','384,400 km on average'],
         ['Orbit','27.3 days'],['Day','27.3 Earth days'],['Axial tilt','1.54°'],['Temperature','−170 to 120 °C'],['Origin','A giant impact, about 4.5 billion years ago']],
  live: { wx: 0, wy: 0, wz: 0, r: 1, x: 1, y: 0, lam: 0 } };

/* Compressed distance map: AU to a fraction of Neptune's orbit, with room for the belt. */
var MAP = [[0,0],[0.387,0.10],[0.723,0.19],[1,0.28],[1.524,0.37],[5.203,0.60],[9.582,0.72],[19.19,0.86],[30.07,1]];
function mapAU(r){
  for(var i = 1; i < MAP.length; i++){
    if(r <= MAP[i][0]){
      var a0 = MAP[i-1][0], f0 = MAP[i-1][1], a1 = MAP[i][0], f1 = MAP[i][1];
      return f0 + (f1 - f0) * (r - a0) / (a1 - a0);
    }
  }
  return 1 + (r - U_AU) * 0.0129;
}

/* ---------- Data: nearby stars ---------- */
function sstats(type, ly, mass, bright, temp, planets){
  return [['Spectral type', type], ['Distance from Sun', ly.toFixed(2) + ' ly'], ['Mass', mass],
          ['Brightness', bright], ['Surface temperature', temp], ['Known planets', planets]];
}
function star(o){
  o.type = 'star'; o.group = 'stars';
  var p = toEcl(o.ra, o.dec, o.ly * LY_U);
  o.live = { wx: p[0], wy: p[1], wz: p[2] };
  o.rgb = hexRgb(o.color);
  o.stats = sstats(o.spec, o.ly, o.mass, o.bright, o.temp, o.planets);
  return o;
}

var ALPHA_A = star({ id:'alphacena', name:'Alpha Centauri A', kind:'Star · Alpha Centauri system', prio:2,
  ra:219.9021, dec:-60.834, ly:4.366, color:'#fff0c8', size:4.8, glow:1.2,
  spec:'G2V', mass:'1.1 Suns', bright:'1.5 Suns', temp:'5,790 K', planets:'None confirmed',
  blurb:'A Sun-like star in the closest star system to ours. It circles its partner, Alpha Centauri B, every 80 years.',
  fact:'Alpha Centauri A is a near twin of the Sun, a little larger and about 50% brighter.' });
var ALPHA_B = star({ id:'alphacenb', name:'Alpha Centauri B', kind:'Star · Alpha Centauri system', prio:2.1,
  ra:219.9021, dec:-60.834, ly:4.366, color:'#ffc888', size:4.0, glow:1.0,
  spec:'K1V', mass:'0.91 Suns', bright:'0.5 Suns', temp:'5,260 K', planets:'None confirmed',
  blurb:'An orange star that swings between about 11 and 36 AU from Alpha Centauri A as the pair orbit each other.',
  fact:'Seen from Earth, Alpha Centauri A and B shine together as the third-brightest star in the night sky.' });
var PROXIMA = star({ id:'proxima', name:'Proxima Centauri', kind:'Star · Alpha Centauri system', prio:2.2,
  ra:217.4290, dec:-62.6795, ly:4.2465, color:'#ff8f6a', size:2.9, glow:0.9,
  spec:'M5.5 red dwarf', mass:'0.12 Suns', bright:'0.17% of the Sun', temp:'3,040 K', planets:'1 confirmed, 2 candidates',
  blurb:'The closest star to the Sun, a small red dwarf that orbits the Alpha Centauri pair about 0.2 light-years away.',
  fact:'Proxima is too faint to see without a telescope, even though it is the nearest star. At the speed of Voyager 1 the trip would take about 75,000 years.' });

var OTHERS = [
  star({ id:'barnard', name:"Barnard's Star", kind:'Star · red dwarf', prio:3.0, ra:269.452, dec:4.693, ly:5.96, color:'#ff9470', size:2.6,
    spec:'M4 red dwarf', mass:'0.16 Suns', bright:'0.35% of the Sun', temp:'3,270 K', planets:'Up to 4 small planets reported',
    blurb:'A faint red dwarf with the fastest apparent motion of any star across our sky.',
    fact:'Astronomers reported several planets around Barnard’s Star in 2024 and 2025, each lighter than Earth.' }),
  star({ id:'wolf359', name:'Wolf 359', kind:'Star · red dwarf', prio:3.1, ra:164.121, dec:7.015, ly:7.86, color:'#ff8a66', size:2.4,
    spec:'M6.5 red dwarf', mass:'0.11 Suns', bright:'0.1% of the Sun', temp:'2,800 K', planets:'None confirmed',
    blurb:'One of the faintest stars near the Sun, a red dwarf that flares unpredictably.',
    fact:'Wolf 359 shines at barely 0.1% of the Sun’s brightness, so it cannot be seen without a telescope.' }),
  star({ id:'lalande', name:'Lalande 21185', kind:'Star · red dwarf', prio:3.2, ra:165.834, dec:35.970, ly:8.31, color:'#ff9a72', size:2.8,
    spec:'M2 red dwarf', mass:'0.39 Suns', bright:'2% of the Sun', temp:'3,600 K', planets:'At least 1 confirmed',
    blurb:'A red dwarf in Ursa Major, the brightest red dwarf in the northern sky.',
    fact:'At magnitude 7.5 it is one of the few nearby stars you can pick out with binoculars.' }),
  star({ id:'sirius', name:'Sirius', kind:'Star · blue-white, with a white dwarf', prio:2.9, ra:101.287, dec:-16.716, ly:8.60, color:'#d2e2ff', size:5.8, glow:1.5,
    spec:'A1V + white dwarf', mass:'2.06 Suns', bright:'25 Suns', temp:'9,900 K', planets:'None known',
    blurb:'The brightest star in the night sky, a blue-white star with a faint white dwarf companion.',
    fact:'Sirius B is a white dwarf with about the mass of the Sun squeezed into a body the size of Earth.' }),
  star({ id:'luyten', name:'Luyten 726-8', kind:'Star · pair of red dwarfs', prio:3.3, ra:24.756, dec:-17.950, ly:8.73, color:'#ff8a66', size:2.5,
    spec:'M5.5 + M6 red dwarfs', mass:'About 0.1 Suns each', bright:'Under 0.1% of the Sun each', temp:'About 2,800 K', planets:'None known',
    blurb:'Two faint red dwarfs in orbit around each other. The second, UV Ceti, gave its name to a whole class of flaring stars.',
    fact:'UV Ceti is the prototype of the flare stars, red dwarfs that brighten without warning for a few minutes.' }),
  star({ id:'ross154', name:'Ross 154', kind:'Star · red dwarf', prio:3.4, ra:282.456, dec:-23.836, ly:9.70, color:'#ff9470', size:2.6,
    spec:'M3.5 red dwarf', mass:'0.17 Suns', bright:'0.4% of the Sun', temp:'3,300 K', planets:'None confirmed',
    blurb:'A flare star in Sagittarius that can brighten suddenly for a few minutes.',
    fact:'Ross 154 is one of many nearby red dwarfs too faint for the naked eye, though it is close by cosmic standards.' }),
  star({ id:'ross248', name:'Ross 248', kind:'Star · red dwarf', prio:3.5, ra:355.479, dec:44.175, ly:10.30, color:'#ff8a66', size:2.4,
    spec:'M5.5 red dwarf', mass:'0.14 Suns', bright:'0.2% of the Sun', temp:'2,800 K', planets:'None confirmed',
    blurb:'A dim red dwarf in Andromeda that is heading toward the Sun.',
    fact:'Ross 248 is approaching and will become the nearest star to the Sun in about 36,000 years.' }),
  star({ id:'epseri', name:'Epsilon Eridani', kind:'Star · young orange dwarf', prio:3.0, ra:53.233, dec:-9.458, ly:10.47, color:'#ffc27a', size:3.8,
    spec:'K2V', mass:'0.82 Suns', bright:'34% of the Sun', temp:'5,080 K', planets:'1 confirmed giant',
    blurb:'A young orange star with a dusty debris disk and at least one giant planet.',
    fact:'It is less than a billion years old, so it looks something like the Sun did long ago.' }),
  star({ id:'lacaille', name:'Lacaille 9352', kind:'Star · red dwarf', prio:3.6, ra:346.467, dec:-35.853, ly:10.72, color:'#ffa070', size:3.2,
    spec:'M0.5 red dwarf', mass:'0.5 Suns', bright:'4% of the Sun', temp:'3,700 K', planets:'2 confirmed',
    blurb:'A red dwarf in Piscis Austrinus with at least two planets larger than Earth.',
    fact:'Its two confirmed planets both circle the star in under 25 days.' }),
  star({ id:'ross128', name:'Ross 128', kind:'Star · red dwarf', prio:3.7, ra:176.935, dec:0.804, ly:11.01, color:'#ff9470', size:2.7,
    spec:'M4 red dwarf', mass:'0.17 Suns', bright:'0.4% of the Sun', temp:'3,200 K', planets:'1 confirmed',
    blurb:'A quiet red dwarf in Virgo with a temperate planet of roughly Earth mass.',
    fact:'Ross 128 is moving toward us and will become the nearest star in about 79,000 years.' }),
  star({ id:'procyon', name:'Procyon', kind:'Star · yellow-white, with a white dwarf', prio:2.95, ra:114.826, dec:5.225, ly:11.46, color:'#fff3d6', size:4.8, glow:1.3,
    spec:'F5 + white dwarf', mass:'1.5 Suns', bright:'7 Suns', temp:'6,530 K', planets:'None known',
    blurb:'A bright yellow-white star in Canis Minor with a faint white dwarf companion.',
    fact:'Its name means “before the dog”, because it rises just before Sirius.' }),
  star({ id:'cyg61', name:'61 Cygni', kind:'Star · pair of orange dwarfs', prio:3.05, ra:316.725, dec:38.749, ly:11.40, color:'#ffb878', size:3.5,
    spec:'K5 + K7 orange dwarfs', mass:'About 0.7 Suns each', bright:'15% and 9% of the Sun', temp:'About 4,300 K', planets:'None confirmed',
    blurb:'A pair of orange stars in Cygnus that take more than 600 years to circle each other.',
    fact:'In 1838 Friedrich Bessel measured its parallax, the first reliable distance to any star other than the Sun.' }),
  star({ id:'epsindi', name:'Epsilon Indi', kind:'Star · orange dwarf', prio:3.1, ra:330.840, dec:-56.786, ly:11.87, color:'#ffbe80', size:3.5,
    spec:'K5V', mass:'0.76 Suns', bright:'22% of the Sun', temp:'4,640 K', planets:'1 giant, imaged',
    blurb:'An orange star in Indus with a giant planet and a pair of brown dwarfs.',
    fact:'The James Webb telescope photographed its giant planet directly in 2024.' }),
  star({ id:'tauceti', name:'Tau Ceti', kind:'Star · Sun-like', prio:3.0, ra:26.017, dec:-15.938, ly:11.91, color:'#fff0c4', size:3.8,
    spec:'G8.5V', mass:'0.78 Suns', bright:'52% of the Sun', temp:'5,340 K', planets:'Candidates only',
    blurb:'A quiet, Sun-like star in Cetus that has long been a target in the search for life.',
    fact:'Tau Ceti and Epsilon Eridani were the two stars Frank Drake listened to in 1960 in the first search for alien radio signals.' })
];

/* Planets of Proxima Centauri. Orientations are unknown, so the orbits are drawn flat. */
var EXO = [
  { id:'proximab', name:'Proxima b', type:'exo', group:'stars', parent:PROXIMA, prio:3.5,
    kind:'Rocky exoplanet · orbits Proxima Centauri', a:0.0485, e:0, peri:0, L0:40, period:11.1868, color:'#d6a779', dark:'#6b4a2e', px:4.4,
    blurb:'A planet of about Earth mass in the habitable zone of the nearest star, found in 2016 from the wobble it causes in its star.',
    fact:'Proxima b is 20 times closer to its star than Earth is to the Sun, so its year lasts only 11 days.',
    stats:[['Orbits','Proxima Centauri'],['Distance from star','0.0485 AU · 7.3 M km'],['Year','11.19 days'],['Minimum mass','1.07 Earths'],
           ['Found','2016, radial velocity'],['Temperature','About −40 °C (estimate)'],['Orbit orientation','Unknown, drawn flat']] },
  { id:'proximad', name:'Proxima d', type:'exo', group:'stars', parent:PROXIMA, prio:3.55,
    kind:'Candidate planet · orbits Proxima Centauri', a:0.0289, e:0, peri:0, L0:200, period:5.123, color:'#b9a28f', dark:'#5a4638', px:3.4,
    blurb:'A candidate planet with about a quarter of Earth’s mass, reported in 2022. It would be among the lightest planets found around any star.',
    fact:'Proxima d would circle its star in just five days.',
    stats:[['Orbits','Proxima Centauri'],['Distance from star','0.029 AU · 4.3 M km'],['Year','5.12 days'],['Minimum mass','0.26 Earths'],
           ['Found','2022, radial velocity'],['Status','Candidate, not yet confirmed'],['Orbit orientation','Unknown, drawn flat']] }
];

/* ---------- Data: dwarf planets, moons of Mars, Jupiter and Saturn, and the Oort cloud ---------- */
/* Dwarf planets use JPL osculating elements on J2000 ecliptic axes (jd = epoch, a in AU, angles in degrees, P in days). */
function mkDwarf(o){
  o.type = 'dwarf'; o.group = 'dwarf'; o.you = true; o.period = o.el.P;
  o.el.d0 = o.el.jd - 2451545.0;
  o.live = { wx: 0, wy: 0, wz: 0, r: o.el.a, x: o.el.a, y: 0, z: 0, lam: 0 };
  return o;
}
var CERES = mkDwarf({ id:'ceres', name:'Ceres', kind:'Dwarf planet · asteroid belt', color:'#a9a59f', dark:'#4a4743', px:2.4, prio:4.32, g:0.28,
  el:{ jd:2461200.5, a:2.765552595034094, e:0.07969229514816586, i:10.58802780183462, node:80.24862682043221, w:73.29421453021587, M0:274.4193463761342, P:1679.853119758983 },
  blurb:'The largest object in the asteroid belt, and the only dwarf planet inside Neptune’s orbit. It holds about a third of the whole belt’s mass.',
  fact:'NASA’s Dawn spacecraft found bright patches inside Occator crater. They are salts left behind by briny water that rose from below. Dawn orbited Ceres from 2015 to 2018.',
  stats:[['Diameter','940 km'],['Mass','0.00016 Earths'],['Gravity','0.28 m/s²'],['Distance from Sun','2.77 AU · 414 M km'],['Year','4.6 years'],
         ['Day','9 h 4 min'],['Axial tilt','4°'],['Temperature','About −105 °C on average'],['Discovered','1801, Giuseppe Piazzi']] });
var PLUTO = mkDwarf({ id:'pluto', name:'Pluto', kind:'Dwarf planet · Kuiper belt', color:'#c9a58a', dark:'#5a3a2a', px:2.8, prio:4.34, g:0.62,
  el:{ jd:2457588.5, a:39.58862938517124, e:0.2518378778576892, i:17.14771140999114, node:110.2923840543057, w:113.7090015158565, M0:38.68366347318184, P:90981.71647718345 },
  blurb:'The best known dwarf planet. A frozen world with a heart-shaped glacier of nitrogen ice, mountains of water ice and a thin blue haze.',
  fact:'New Horizons flew past on 14 July 2015 and found a world that is still geologically alive. Its heart, Sputnik Planitia, is a nitrogen-ice glacier about 1,000 km across.',
  stats:[['Diameter','2,377 km'],['Mass','0.0022 Earths'],['Gravity','0.62 m/s²'],['Distance from Sun','29.7 to 49.3 AU'],['Year','248 years'],
         ['Day','6.4 Earth days'],['Axial tilt','122.5°, so it spins on its side'],['Temperature','About −229 °C'],['Known moons','5'],['Discovered','1930, Clyde Tombaugh']] });
var HAUMEA = mkDwarf({ id:'haumea', name:'Haumea', kind:'Dwarf planet · Kuiper belt', color:'#d9dde4', dark:'#6a6f78', px:2.6, prio:4.36, g:0.4,
  el:{ jd:2461200.5, a:43.06029023650952, e:0.1944430148898797, i:28.20847393040364, node:121.7860561329425, w:240.6905472508661, M0:223.2104118812299, P:103208.1173403618 },
  blurb:'A dwarf planet stretched into the shape of a rugby ball. It spins once every four hours, faster than any other large body we know.',
  fact:'Haumea is pulled into an oval by its spin. It also has a thin ring, two moons and a skin of almost pure water ice. The ring was found in 2017, when Haumea passed in front of a star.',
  stats:[['Size','2,320 × 1,700 × 1,000 km'],['Mass','0.00067 Earths'],['Gravity','About 0.4 m/s²'],['Distance from Sun','34.7 to 51.5 AU'],['Year','283 years'],
         ['Day','3.9 hours'],['Temperature','Colder than −220 °C'],['Known moons','2'],['Spin axis','Not known, drawn upright'],['Discovered','2004']] });
var MAKEMAKE = mkDwarf({ id:'makemake', name:'Makemake', kind:'Dwarf planet · Kuiper belt', color:'#c98d6e', dark:'#5e3524', px:2.5, prio:4.38, g:0.4,
  el:{ jd:2461200.5, a:45.57093317300052, e:0.1588889953992523, i:29.02785603743067, node:79.2948338209406, w:297.0922733397207, M0:169.9379962048232, P:112364.8068762869 },
  blurb:'A bright, reddish dwarf planet in the Kuiper belt, found just after Easter 2005. Its surface is coated in frozen methane.',
  fact:'Makemake is named for the creator god of the Rapa Nui people of Easter Island. A small moon was found around it in 2015.',
  stats:[['Diameter','1,430 km'],['Mass','About 0.0005 Earths'],['Gravity','About 0.4 m/s²'],['Distance from Sun','38.1 to 52.8 AU'],['Year','306 years'],
         ['Day','22.8 hours'],['Temperature','About −240 °C'],['Known moons','1'],['Spin axis','Not known, drawn upright'],['Discovered','2005, Mike Brown and colleagues']] });
var ERIS = mkDwarf({ id:'eris', name:'Eris', kind:'Dwarf planet · scattered disc', color:'#e6e4e0', dark:'#7c7a76', px:2.7, prio:4.4, g:0.82,
  el:{ jd:2461200.5, a:67.93394688, e:0.4382385348, i:43.92582795, node:36.00477044, w:150.79492358, M0:211.77443428, P:204516.663 },
  blurb:'The most massive dwarf planet we know, and the most distant body in this explorer that you can fly to. Its discovery in 2005 led to Pluto being reclassified.',
  fact:'Eris is about 27% more massive than Pluto, though slightly smaller across. It is named for the Greek goddess of discord, and its moon is called Dysnomia.',
  stats:[['Diameter','2,326 km'],['Mass','0.0028 Earths'],['Gravity','0.82 m/s²'],['Distance from Sun','38 to 98 AU'],['Year','559 years'],
         ['Day','15.8 Earth days'],['Temperature','About −231 °C'],['Known moons','1, Dysnomia'],['Spin axis','Not known, drawn upright'],['Discovered','2005, Mike Brown and colleagues']] });
var DWARF_LIST = [CERES, PLUTO, null, HAUMEA, MAKEMAKE, ERIS];   /* Charon takes the empty slot below */

/* Moons. Mean elements from the JPL satellite tables (J2000): aKm semi-major axis, P sidereal period in days, e eccentricity,
   L0 mean longitude at J2000 measured from the ascending node of the planet's equator, varpi longitude of periapsis.
   Every orbit is placed in its planet's equatorial plane, so positions are approximate. */
var SATS = [];
function mkSat(o){
  var par = o.parent;
  o.type = 'moon'; o.group = o.group || 'system'; o.you = true; o.period = par.period;
  o.live = { wx: 0, wy: 0, wz: 0, r: 0, x: 0, y: 0, lam: 0, km: o.aKm, u: [1, 0, 0] };
  (par.sats = par.sats || []).push(o); SATS.push(o);
  par.sats.sort(function(a, b){ return a.aKm - b.aKm; });
  return o;
}
var G_STAT = function(diam, mass, grav, dist, orbit, day, extra){
  return [['Diameter', diam], ['Mass', mass], ['Gravity', grav], ['Distance from ' + dist[0], dist[1]], ['Orbit', orbit], ['Day', day]].concat(extra);
};
var MARS_P = PLANETS[3], JUP_P = PLANETS[4], SAT_P = PLANETS[5];
var PHOBOS = mkSat({ id:'phobos', name:'Phobos', parent:MARS_P, color:'#8d827b', dark:'#3b3531', px:1.3, g:0.0057,
  aKm:9376, P:0.31891023, e:0, L0:219.33, varpi:0, kind:'Moon · orbits Mars',
  blurb:'A lumpy little moon that circles Mars faster than Mars turns. Seen from the surface of Mars it rises in the west and sets in the east, twice a day.',
  fact:'Phobos is slowly spiralling towards Mars, about 2 metres closer every hundred years. In tens of millions of years it will crash into Mars or break up into a ring.',
  stats:G_STAT('27 × 22 × 18 km', 'About 10.7 trillion tonnes', '0.0057 m/s²', ['Mars', '9,376 km from its centre'], '7 h 39 min', '7 h 39 min, locked to Mars',
    [['Biggest crater', 'Stickney, 9 km wide'], ['Discovered', '1877, Asaph Hall']]) });
var DEIMOS = mkSat({ id:'deimos', name:'Deimos', parent:MARS_P, color:'#9a8e82', dark:'#443c34', px:1.1, g:0.003,
  aKm:23463, P:1.26244, e:0, L0:256.87, varpi:0, kind:'Moon · orbits Mars',
  blurb:'The smaller, outer moon of Mars. Dust has filled in many of its craters, so it looks smoother than Phobos.',
  fact:'From the surface of Mars, Deimos would look like a bright star, not a disc. It stays above the horizon for more than two days at a time.',
  stats:G_STAT('15 × 12 × 10 km', 'About 1.5 trillion tonnes', '0.003 m/s²', ['Mars', '23,463 km from its centre'], '30 h 18 min', '30 h 18 min, locked to Mars',
    [['Surface', 'A blanket of dust, tens of metres deep'], ['Discovered', '1877, Asaph Hall']]) });
var IO = mkSat({ id:'io', name:'Io', parent:JUP_P, color:'#e6cf6a', dark:'#7a5a1c', px:2.4, g:1.796,
  aKm:421800, P:1.769137786, e:0, L0:20.451, varpi:0, kind:'Moon · orbits Jupiter',
  blurb:'The most volcanically active world in the Solar System, painted yellow, orange and red by sulfur. Hundreds of volcanoes erupt on its surface.',
  fact:'Jupiter and its neighbouring moons squeeze and stretch Io on every orbit. That tidal flexing makes the heat that drives its volcanoes, whose plumes rise hundreds of kilometres.',
  stats:G_STAT('3,643 km', '0.015 Earths', '1.80 m/s²', ['Jupiter', '421,800 km from its centre'], '1.77 days', '1.77 Earth days, locked to Jupiter',
    [['Temperature', '−143 °C on average'], ['Lava', 'Hotter than 1,200 °C'], ['Discovered', '1610, Galileo']]) });
var EUROPA = mkSat({ id:'europa', name:'Europa', parent:JUP_P, color:'#d8d0bc', dark:'#7a6a55', px:2.1, g:1.314,
  aKm:671100, P:3.551181041, e:0, L0:213.741, varpi:0, kind:'Moon · orbits Jupiter',
  blurb:'An ice-covered world with a salty ocean hidden underneath. It holds about twice as much water as all of Earth’s oceans.',
  fact:'The cracks across Europa’s ice are stained brown, probably by salts from the ocean below. NASA’s Europa Clipper, launched in 2024, is due to reach Jupiter in 2030.',
  stats:G_STAT('3,122 km', '0.008 Earths', '1.31 m/s²', ['Jupiter', '671,100 km from its centre'], '3.55 days', '3.55 Earth days, locked to Jupiter',
    [['Ice shell', 'Roughly 15 to 25 km thick'], ['Temperature', 'About −170 °C at the equator'], ['Discovered', '1610, Galileo']]) });
var GANYMEDE = mkSat({ id:'ganymede', name:'Ganymede', parent:JUP_P, color:'#b4a794', dark:'#5a4e40', px:2.9, g:1.428,
  aKm:1070400, P:7.15455296, e:0, L0:221.966, varpi:0, kind:'Moon · orbits Jupiter',
  blurb:'The largest moon in the Solar System, wider than Mercury. A patchwork of dark, ancient craters and bright, grooved ice.',
  fact:'Ganymede is the only moon known to make its own magnetic field, and it probably hides a deep ocean too. ESA’s Juice spacecraft is on its way and due to orbit Ganymede in 2034.',
  stats:G_STAT('5,268 km', '0.025 Earths', '1.43 m/s²', ['Jupiter', '1,070,400 km from its centre'], '7.15 days', '7.15 Earth days, locked to Jupiter',
    [['Temperature', '−203 to −121 °C'], ['Discovered', '1610, Galileo']]) });
var CALLISTO = mkSat({ id:'callisto', name:'Callisto', parent:JUP_P, color:'#7d7064', dark:'#3a3128', px:2.7, g:1.235,
  aKm:1882700, P:16.6890184, e:0, L0:80.783, varpi:0, kind:'Moon · orbits Jupiter',
  blurb:'The most heavily cratered body known. Its dark, ancient surface has barely changed in about 4 billion years.',
  fact:'Callisto lies outside the worst of Jupiter’s radiation, so it is often named as the best place for a future crewed base in the Jupiter system.',
  stats:G_STAT('4,821 km', '0.018 Earths', '1.24 m/s²', ['Jupiter', '1,882,700 km from its centre'], '16.7 days', '16.7 Earth days, locked to Jupiter',
    [['Biggest feature', 'Valhalla, rings 3,800 km across'], ['Temperature', '−193 to −108 °C'], ['Discovered', '1610, Galileo']]) });
var MIMAS = mkSat({ id:'mimas', name:'Mimas', parent:SAT_P, color:'#b9b9bd', dark:'#585860', px:1.4, g:0.064,
  aKm:185540, P:0.942421813, e:0, L0:118.467, varpi:0, kind:'Moon · orbits Saturn',
  blurb:'A small icy moon with one enormous crater, Herschel, that makes it look like the Death Star from Star Wars.',
  fact:'Herschel is about 130 km wide, a third of the whole moon’s diameter. The impact that carved it came close to shattering Mimas.',
  stats:G_STAT('396 km', '1/160,000 of Earth', '0.064 m/s²', ['Saturn', '185,540 km from its centre'], '22 h 37 min', '22 h 37 min, locked to Saturn',
    [['Temperature', 'About −209 °C'], ['Inside', 'Possibly a young ocean'], ['Discovered', '1789, William Herschel']]) });
var ENCELADUS = mkSat({ id:'enceladus', name:'Enceladus', parent:SAT_P, color:'#f2f4f6', dark:'#8a9098', px:1.5, g:0.113,
  aKm:238020, P:1.370217855, e:0, L0:181.732, varpi:0, kind:'Moon · orbits Saturn',
  blurb:'A small, brilliant white moon that sprays water into space through cracks near its south pole. A global ocean lies beneath its ice.',
  fact:'Enceladus reflects almost all the sunlight that hits it. Its geysers feed Saturn’s E ring, and Cassini flew through the spray and found water, salts and organic molecules.',
  stats:G_STAT('504 km', '1/55,000 of Earth', '0.113 m/s²', ['Saturn', '238,020 km from its centre'], '1.37 days', '1.37 Earth days, locked to Saturn',
    [['Temperature', '−198 °C on average'], ['Geysers', 'Near the south pole'], ['Discovered', '1789, William Herschel']]) });
var TITAN = mkSat({ id:'titan', name:'Titan', parent:SAT_P, color:'#e0a24a', dark:'#6a4012', px:2.9, g:1.352,
  aKm:1221870, P:15.945421, e:0, L0:9.206, varpi:0, kind:'Moon · orbits Saturn',
  blurb:'Saturn’s biggest moon, wrapped in a thick orange haze. It is the only moon with a dense atmosphere, and the only other world known with lakes on its surface.',
  fact:'Titan’s lakes are liquid methane and ethane. The Huygens probe landed there in 2005, and NASA’s Dragonfly drone is planned to launch in 2028.',
  stats:G_STAT('5,149 km', '0.0225 Earths', '1.35 m/s²', ['Saturn', '1,221,870 km from its centre'], '15.9 days', '15.9 Earth days, locked to Saturn',
    [['Air pressure', '1.5 times Earth’s'], ['Atmosphere', '95% nitrogen, 5% methane'], ['Temperature', '−179 °C'], ['Discovered', '1655, Christiaan Huygens']]) });
var CHARON = mkSat({ id:'charon', name:'Charon', parent:PLUTO, group:'dwarf', binary:0.1086, color:'#a8a29e', dark:'#4c4642', px:2.0, g:0.288,
  aKm:19591, P:6.3872304, e:0, L0:304.809, varpi:0, kind:'Moon · orbits Pluto',
  blurb:'Pluto’s largest moon, more than half as wide as Pluto itself. The two circle a point in space above Pluto’s surface and always show each other the same face.',
  fact:'Charon’s red north pole, Mordor Macula, is probably stained by gas that escapes from Pluto’s atmosphere and freezes on Charon.',
  stats:G_STAT('1,212 km', '0.00027 Earths', '0.29 m/s²', ['Pluto', '19,591 km from its centre'], '6.39 days', '6.39 Earth days, locked to Pluto',
    [['Canyons', 'A belt more than 1,600 km long'], ['Temperature', 'About −220 °C'], ['Discovered', '1978, James Christy']]) });
DWARF_LIST[2] = CHARON;
PLANETS[2].sats = [MOON]; MOON.aKm = 384400;
SATS.forEach(function(m){ m.prio = m.parent.prio + 0.012 + 0.004 * m.parent.sats.indexOf(m); });

/* The Oort cloud is a region, not a body. It is drawn as a shell of points at the light-year zoom levels. */
var OORT_IN = 2000, OORT_MID = 20000, OORT_OUT = 100000;   /* AU */
var OORT = { id:'oort', name:'Oort cloud', type:'oort', group:'system', color:'#9fb4f0', prio:5, kind:'Region · the Solar System’s outer shell',
  blurb:'A vast shell of icy bodies thought to surround the whole Solar System, reaching about a light-year and a half from the Sun. Many long-period comets fall in from here.',
  fact:'No spacecraft has reached the Oort cloud. Voyager 1, about 170 AU out, would need roughly 300 years to reach its inner edge and some 30,000 years to cross it.',
  stats:[['Inner edge', 'About 2,000 AU'], ['Outer edge', 'Up to 100,000 AU · 1.6 light-years'], ['Shape', 'Flat inner cloud, round outer cloud'],
         ['Objects', 'Trillions of icy bodies over 1 km'], ['Total mass', 'A few to a few dozen Earths'], ['A body at 50,000 AU', 'Circles the Sun in 11 million years'],
         ['Seen directly?', 'No, only inferred from comet orbits'], ['Named for', 'Jan Oort, who proposed it in 1950']],
  live: { wx: 0, wy: 0, wz: 0, r: 0, x: 0, y: 0 } };
var OORT_A = [], OORT_B = [];
(function(){
  var rnd = rng(77177), i, r, sl, lon, cl, pt;
  function add(rAU, s, big){
    cl = Math.sqrt(Math.max(0, 1 - s * s)); lon = rnd() * TAU;
    pt = { x: rAU * cl * Math.cos(lon) / U_AU, y: rAU * cl * Math.sin(lon) / U_AU, z: rAU * s / U_AU, s: big ? 1.8 : 1.1 };
    (big ? OORT_B : OORT_A).push(pt);
  }
  for(i = 0; i < 1100; i++){ r = OORT_IN * Math.pow(OORT_MID / OORT_IN, rnd()); sl = (rnd() + rnd() + rnd() - 1.5) * 0.5; add(r, sl, rnd() < 0.14); }
  for(i = 0; i < 2600; i++){ r = OORT_MID * Math.pow(OORT_OUT / OORT_MID, Math.pow(rnd(), 0.6)); sl = rnd() * 2 - 1; add(r, sl, rnd() < 0.14); }
})();

PLUTO.lockTo = CHARON;   /* Pluto always shows its prime meridian to Charon */
var SYSTEM_LIST = [SUN, PLANETS[0], PLANETS[1], PLANETS[2], MOON, MARS_P, PHOBOS, DEIMOS, JUP_P, IO, EUROPA, GANYMEDE, CALLISTO,
                   SAT_P, MIMAS, ENCELADUS, TITAN, PLANETS[6], PLANETS[7], OORT];
var STAR_LIST = [ALPHA_A, ALPHA_B, PROXIMA, EXO[0], EXO[1]].concat(OTHERS);
var ALL = SYSTEM_LIST.concat(DWARF_LIST, STAR_LIST);
var SPIN_LIST = SYSTEM_LIST.concat(DWARF_LIST);
function listFor(g){ return g === 'stars' ? STAR_LIST : g === 'dwarf' ? DWARF_LIST : SYSTEM_LIST; }
function isWorld(b){ return b.type === 'sun' || b.type === 'planet' || b.type === 'moon' || b.type === 'dwarf'; }
var BY_ID = {};
ALL.forEach(function(b){
  BY_ID[b.id] = b;
  if(!b.live) b.live = { wx: 0, wy: 0, wz: 0, r: 0, x: 0, y: 0 };
  if(!b.rgb && b.color) b.rgb = hexRgb(b.color);
});
var EARTH = BY_ID.earth;

/* ---------- Physical data: true radii and IAU rotation models ---------- */
/* equatorial radius km, polar radius km, pole RA, pole Dec (degrees), prime meridian at J2000, spin rate deg/day, fraction of the short canvas side the body fills when you fly to it */
var PHYS = {
  sun:     [695700, 695700, 286.13, 63.87, 84.176, 14.1844, 0.34],
  mercury: [2439.7, 2439.7, 281.0103, 61.4155, 329.5988, 6.1385108, 0.34],
  venus:   [6051.8, 6051.8, 272.76, 67.16, 160.20, -1.4813688, 0.34],
  earth:   [6378.137, 6356.752, 0.0, 90.0, 190.147, 360.9856235, 0.34],
  moon:    [1737.4, 1737.4, 269.9949, 66.5392, 38.3213, 13.17635815, 0.34],
  mars:    [3396.2, 3376.2, 317.68143, 52.8865, 176.630, 350.89198226, 0.34],
  jupiter: [71492, 66854, 268.056595, 64.495303, 284.95, 870.5366420, 0.34],
  saturn:  [60268, 54364, 40.589, 83.537, 38.90, 810.7939024, 0.17],
  uranus:  [25559, 24973, 257.311, -15.175, 203.81, -501.1600928, 0.2],
  neptune: [24764, 24341, 299.36, 43.46, 249.978, 541.1397757, 0.34],
  /* moons: a null pole means the planet's own equator. Last value: y semi-axis over x semi-axis for lumpy bodies. */
  phobos:    [13.03, 9.14, null, null, 0, 0, 0.30, 0.875],
  deimos:    [7.8, 5.1, null, null, 0, 0, 0.30, 0.769],
  io:        [1821.5, 1821.5, null, null, 0, 0, 0.34],
  europa:    [1560.8, 1560.8, null, null, 0, 0, 0.34],
  ganymede:  [2631.2, 2631.2, null, null, 0, 0, 0.34],
  callisto:  [2410.3, 2410.3, null, null, 0, 0, 0.34],
  mimas:     [207.8, 190.6, null, null, 0, 0, 0.32, 0.947],
  enceladus: [256.6, 248.3, null, null, 0, 0, 0.32, 0.980],
  titan:     [2574.7, 2574.7, null, null, 0, 0, 0.34],
  charon:    [606, 606, null, null, 0, 0, 0.34],
  ceres:     [482.1, 445.9, 291.418, 66.764, 170.65, 952.1532, 0.34],
  pluto:     [1188.3, 1188.3, 132.993, -6.163, 302.695, 56.3625225, 0.34],
  /* Haumea, Makemake and Eris: spin axes are not known, so they stand upright on the ecliptic */
  haumea:    [1161, 513, 270.0, 66.56, 0, 2206.6, 0.30, 0.734],
  makemake:  [715, 715, 270.0, 66.56, 0, 378.5, 0.34],
  eris:      [1163, 1163, 270.0, 66.56, 0, 22.8, 0.34]
};
Object.keys(PHYS).forEach(function(id){
  var b = BY_ID[id], q = PHYS[id];
  b.R = q[0]; b.flat = q[1] / q[0]; b.by = q[7] || 1; b.fit = q[6]; b.spinOff = 0;
  b.ringOut = id === 'saturn' ? 2.33 : id === 'uranus' ? 2.05 : 0;
  if(q[2] !== null){
    var a0 = q[2] * RAD, d0 = q[3] * RAD;
    b.poleW = rotEcl([Math.cos(d0) * Math.cos(a0), Math.cos(d0) * Math.sin(a0), Math.sin(d0)]);
    b.nodeW = rotEcl([-Math.sin(a0), Math.cos(a0), 0]);
  }
  b.w0 = q[4]; b.wdot = q[5];
});
/* moons orbit, and are tipped, in their planet's equatorial plane */
SATS.forEach(function(m){ if(!m.poleW){ m.poleW = m.parent.poleW; m.nodeW = m.parent.nodeW; } });
/* Star radii in km, and best-estimate radii for Proxima's planets */
var STAR_R = { alphacena: 851000, alphacenb: 600000, proxima: 107300, barnard: 136000, wolf359: 100000, lalande: 273000, sirius: 1190000,
  luyten: 97000, ross154: 167000, ross248: 111000, epseri: 511000, lacaille: 327000, ross128: 146000, procyon: 1425000, cyg61: 463000,
  epsindi: 509000, tauceti: 552000, proximab: 6900, proximad: 5200 };
Object.keys(STAR_R).forEach(function(id){ BY_ID[id].R = STAR_R[id]; BY_ID[id].flat = 1; });

/* ---------- Alpha Centauri A and B: visual orbit (Pourbaix et al. 2002 elements) ---------- */
var AC = { a: 23.4, e: 0.5179, P: 79.91 * 365.25, T0: (1955.56 - 2000.0) * 365.25, fA: 0.907 / 2.007, fB: 1.1 / 2.007 };
var AC_BARY = toEcl(219.9021, -60.834, 4.366 * LY_U);
(function(){
  var al = 219.9021 * RAD, de = -60.834 * RAD;
  var eE = [-Math.sin(al), Math.cos(al), 0];
  var eN = [-Math.cos(al) * Math.sin(de), -Math.sin(al) * Math.sin(de), Math.cos(de)];
  var rr = [Math.cos(de) * Math.cos(al), Math.cos(de) * Math.sin(al), Math.sin(de)];
  AC.eE = rotEcl(eE); AC.eN = rotEcl(eN); AC.rr = rotEcl(rr);
  var Om = 204.85 * RAD, om = 231.65 * RAD, inc = 79.205 * RAD;
  AC.A = Math.cos(Om) * Math.cos(om) - Math.sin(Om) * Math.sin(om) * Math.cos(inc);
  AC.B = Math.sin(Om) * Math.cos(om) + Math.cos(Om) * Math.sin(om) * Math.cos(inc);
  AC.F = -Math.cos(Om) * Math.sin(om) - Math.sin(Om) * Math.cos(om) * Math.cos(inc);
  AC.G = -Math.sin(Om) * Math.sin(om) + Math.cos(Om) * Math.cos(om) * Math.cos(inc);
  AC.C = Math.sin(om) * Math.sin(inc); AC.H = Math.cos(om) * Math.sin(inc);
})();
function acRel(X, Y){
  var n = AC.a * (AC.A * X + AC.F * Y), e = AC.a * (AC.B * X + AC.G * Y), z = AC.a * (AC.C * X + AC.H * Y);
  return [n * AC.eN[0] + e * AC.eE[0] + z * AC.rr[0],
          n * AC.eN[1] + e * AC.eE[1] + z * AC.rr[1],
          n * AC.eN[2] + e * AC.eE[2] + z * AC.rr[2]];
}
var AC_PTS = [];
(function(){
  var n = 120;
  for(var j = 0; j < n; j++){
    var E = j / n * TAU;
    AC_PTS.push(acRel(Math.cos(E) - AC.e, Math.sqrt(1 - AC.e * AC.e) * Math.sin(E)));
  }
})();

/* ---------- Orbit math ---------- */
function solveKepler(M, e){
  var E = M + e * Math.sin(M);
  for(var i = 0; i < 6; i++){ E -= (E - e * Math.sin(E) - M) / (1 - e * Math.cos(E)); }
  return E;
}
function normAngle(M){ return ((M + Math.PI) % TAU + TAU) % TAU - Math.PI; }
function orbitState(p, d){
  var L = (p.L0 + 360 * d / p.period) * RAD;
  var M = normAngle(L - p.peri * RAD);
  var E = solveKepler(M, p.e);
  var nu = 2 * Math.atan2(Math.sqrt(1 + p.e) * Math.sin(E / 2), Math.sqrt(1 - p.e) * Math.cos(E / 2));
  var r = p.a * (1 - p.e * Math.cos(E));
  var lam = nu + p.peri * RAD;
  return { r: r, lam: lam, x: r * Math.cos(lam), y: r * Math.sin(lam) };
}

/* Dwarf planets: 3D Kepler orbits from JPL osculating elements. Returns AU on J2000 ecliptic axes. */
function dwarfXYZ(el, nu, r){
  var w = el.w * RAD + nu, O = el.node * RAD, ci = Math.cos(el.i * RAD), si = Math.sin(el.i * RAD);
  var cw = Math.cos(w), sw = Math.sin(w), cO = Math.cos(O), sO = Math.sin(O);
  return [r * (cO * cw - sO * sw * ci), r * (sO * cw + cO * sw * ci), r * sw * si];
}
function dwarfState(p, d){
  var el = p.el, M = normAngle((el.M0 + 360 * (d - el.d0) / el.P) * RAD);
  var E = solveKepler(M, el.e);
  var nu = 2 * Math.atan2(Math.sqrt(1 + el.e) * Math.sin(E / 2), Math.sqrt(1 - el.e) * Math.cos(E / 2));
  var r = el.a * (1 - el.e * Math.cos(E)), v = dwarfXYZ(el, nu, r);
  return { r: r, x: v[0], y: v[1], z: v[2], lam: Math.atan2(v[1], v[0]) };
}
/* A moon: unit vector from its planet (world axes) and distance in km. Orbit lies in the planet's equatorial plane. */
function satState(m, d){
  var par = m.parent, Q = par.nodeW, B = cross3(par.poleW, Q);
  var L = (m.L0 + 360 * d / m.P) * RAD, vp = m.varpi * RAD;
  var E = solveKepler(normAngle(L - vp), m.e);
  var nu = 2 * Math.atan2(Math.sqrt(1 + m.e) * Math.sin(E / 2), Math.sqrt(1 - m.e) * Math.cos(E / 2));
  var th = nu + vp, c = Math.cos(th), s = Math.sin(th);
  return { r: m.aKm * (1 - m.e * Math.cos(E)), u: [Q[0] * c + B[0] * s, Q[1] * c + B[1] * s, Q[2] * c + B[2] * s] };
}

/* ---------- The Moon: low-precision ephemeris (Astronomical Almanac), geocentric vector in km on J2000 ecliptic axes ---------- */
function sdeg(x){ return Math.sin(x * RAD); }
function cdeg(x){ return Math.cos(x * RAD); }
function moonKm(d){
  var T = d / 36525;
  var lon = 218.32 + 481267.881 * T + 6.29 * sdeg(135.0 + 477198.87 * T) - 1.27 * sdeg(259.3 - 413335.36 * T) + 0.66 * sdeg(235.7 + 890534.22 * T)
          + 0.21 * sdeg(269.9 + 954397.74 * T) - 0.19 * sdeg(357.5 + 35999.05 * T) - 0.11 * sdeg(186.5 + 966404.03 * T);
  var lat = 5.13 * sdeg(93.3 + 483202.02 * T) + 0.28 * sdeg(228.2 + 960400.89 * T) - 0.28 * sdeg(318.3 + 6003.15 * T) - 0.17 * sdeg(217.6 - 407332.21 * T);
  var par = 0.9508 + 0.0518 * cdeg(135.0 + 477198.87 * T) + 0.0095 * cdeg(259.3 - 413335.36 * T) + 0.0078 * cdeg(235.7 + 890534.22 * T) + 0.0028 * cdeg(269.9 + 954397.74 * T);
  var dist = 6378.14 / sdeg(par);
  lon = (lon - 1.397 * T) * RAD; lat *= RAD;      /* precess back to J2000 axes */
  return [dist * Math.cos(lat) * Math.cos(lon), dist * Math.cos(lat) * Math.sin(lon), dist * Math.sin(lat)];
}

/* ---------- Body orientation ---------- */
function cross3(a, b){ return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; }
function norm3(a){ var l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; }
/* Spin axes in ecliptic world coordinates: X = prime meridian, Z = north pole, Y = Z x X (east). */
function projAxis(X, P){
  var k = X[0] * P[0] + X[1] * P[1] + X[2] * P[2];
  return norm3([X[0] - k * P[0], X[1] - k * P[1], X[2] - k * P[2]]);
}
function bodyFrame(b, d){
  var P = b.poleW, X;
  if(b.id === 'moon'){
    var m = moonKm(d);
    X = projAxis([-m[0], -m[1], -m[2]], P);        /* tidally locked: the prime meridian faces Earth */
  } else if(b.type === 'moon'){
    var u = b.live.u;
    X = projAxis([-u[0], -u[1], -u[2]], P);        /* every moon here keeps one face towards its planet */
  } else if(b.lockTo){
    X = projAxis(b.lockTo.live.u, P);              /* Pluto faces Charon */
  } else if(b.type === 'exo'){
    P = [0, 0, 1]; X = [-Math.cos(b.live.lam), -Math.sin(b.live.lam), 0];   /* assumed tidally locked to its star */
  } else {
    var W = (b.w0 + b.wdot * d + b.spinOff) * RAD, c = Math.cos(W), sw = Math.sin(W), Q = b.nodeW, PQ = cross3(P, Q);
    X = [Q[0] * c + PQ[0] * sw, Q[1] * c + PQ[1] * sw, Q[2] * c + PQ[2] * sw];
  }
  return { X: X, Y: cross3(P, X), Z: P };
}
function lightWorld(b){
  var src = b.type === 'moon' ? b.parent : b;
  if(src.live.ldir) return src.live.ldir;
  var lam = src.live.lam;
  return [-Math.cos(lam), -Math.sin(lam), 0];
}
function toView(v, sT, cT){ return [v[0], v[1] * sT + v[2] * cT, -v[1] * cT + v[2] * sT]; }

var N = 360;
PLANETS.forEach(function(p){
  p.oc = new Float64Array(N); p.os = new Float64Array(N);
  p.orc = new Float64Array(N); p.ort = new Float64Array(N);
  p.rMaxC = 0; p.rMinC = 9; p.rMaxT = p.a * (1 + p.e) / U_AU; p.rMinT = p.a * (1 - p.e) / U_AU;
  for(var j = 0; j < N; j++){
    var nu = j / N * TAU;
    var r = p.a * (1 - p.e * p.e) / (1 + p.e * Math.cos(nu));
    var lam = nu + p.peri * RAD;
    p.oc[j] = Math.cos(lam); p.os[j] = Math.sin(lam);
    p.orc[j] = mapAU(r); p.ort[j] = r / U_AU;
    if(p.orc[j] > p.rMaxC) p.rMaxC = p.orc[j];
    if(p.orc[j] < p.rMinC) p.rMinC = p.orc[j];
  }
});

DWARF_LIST.forEach(function(p){
  if(p.type !== 'dwarf') return;
  var el = p.el;
  p.ox = new Float64Array(N); p.oy = new Float64Array(N); p.oz = new Float64Array(N); p.osc = new Float64Array(N);
  p.rMaxC = 0; p.rMinC = 99; p.rMaxT = el.a * (1 + el.e) / U_AU; p.rMinT = el.a * (1 - el.e) / U_AU;
  for(var j = 0; j < N; j++){
    var nu = j / N * TAU, r = el.a * (1 - el.e * el.e) / (1 + el.e * Math.cos(nu)), v = dwarfXYZ(el, nu, r);
    var rho = Math.hypot(v[0], v[1]), sc = rho > 1e-9 ? mapAU(rho) / (rho / U_AU) : 1, rc = r / U_AU * sc;
    p.ox[j] = v[0]; p.oy[j] = v[1]; p.oz[j] = v[2]; p.osc[j] = sc;
    if(rc > p.rMaxC) p.rMaxC = rc;
    if(rc < p.rMinC) p.rMinC = rc;
  }
});

function rng(seed){
  return function(){
    seed |= 0; seed = seed + 0x6D2B79F5 | 0;
    var t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
var belt = [];
(function(){
  var rnd = rng(20261010);
  for(var i = 0; i < 900; i++){
    var a = 2.1 + (rnd() + rnd()) / 2 * 1.2;
    belt.push({ t0: rnd() * TAU, w: TAU / (365.256 * Math.pow(a, 1.5)), s: rnd() < 0.2 ? 1.7 : 1.1, rc: mapAU(a), rt: a / U_AU });
  }
})();

/* ---------- State ---------- */
var state = {
  playing: !reduceMotion, speed: 2, orbits: true, labels: true, belt: true,
  scale: 'compressed', tilt: 58, selected: 'earth', night: true, oort: true
};
var group = 'system';
var simDays = (Date.now() - J2000) / DAY, visTime = simDays;
var blend = 0, blendE = 0, lowZoom = false, highZoom = false, trueCtx = false;
var cam = { x: 0, y: 0, z: 0, zoom: 1 };
var following = false, flight = null, tiltGoal = null;   /* tiltGoal: camera tilt (degrees) that flights ease toward */

var stage = $('stage'), scene = $('scene'), starsCv = $('stars');
var ctx = scene.getContext('2d');
var W = 1, H = 1, dpr = 1, base = 300;
var CX = 0.5, CY = 0.5, FM = 300, insR = 0, insB = 0, insT = 0;   /* view centre and the free area left clear of the floating panels */
var FONT_UI = '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", Roboto, Inter, system-ui, sans-serif';
var FONT_MONO = 'ui-monospace, "SF Mono", SFMono-Regular, Menlo, Consolas, monospace';
var GLOK = false, glQ = 1, glBig = false;        /* WebGL planet renderer available, and its resolution scale */
function glRatio(){ return Math.max(0.5, dpr * glQ); }
var hits = [];

var cs = getComputedStyle(document.documentElement);
var C = {
  ink: cs.getPropertyValue('--ink').trim() || '#090c15',
  text: cs.getPropertyValue('--text').trim() || '#e8ebf5',
  muted: cs.getPropertyValue('--muted').trim() || '#8c97b3',
  accent: cs.getPropertyValue('--accent').trim() || '#f0b04a',
  orbit: cs.getPropertyValue('--orbit').trim() || 'rgba(148,164,212,.22)',
  belt: cs.getPropertyValue('--belt').trim() || 'rgba(176,186,210,.55)'
};

function sinT(){ return Math.sin(state.tilt * RAD); }
function cosT(){ return Math.cos(state.tilt * RAD); }

/* ---------- Canvas sizing and background stars ---------- */
var starLayers = [];
var par = { x: 0, y: 0, z: 0, dirty: true };
function makeStars(){
  var rnd = rng(11), n = Math.round(W * H / 2100);
  starLayers = [[], [], []];
  for(var i = 0; i < n; i++){
    var k = rnd(), L = k > 0.93 ? 2 : k > 0.62 ? 1 : 0;
    starLayers[L].push({ x: rnd() * W, y: rnd() * H, r: 0.35 + Math.pow(rnd(), 3) * (0.7 + L * 0.5), a: 0.25 + rnd() * 0.65, w: rnd() < 0.14 });
  }
  par.dirty = true;
}
var STAR_DEPTH = [0.05, 0.14, 0.32];
function drawStars(){
  var c = starsCv.getContext('2d');
  c.setTransform(dpr, 0, 0, dpr, 0, 0);
  c.clearRect(0, 0, W, H);
  var zs = par.z;
  for(var L = 0; L < 3; L++){
    var d = STAR_DEPTH[L], arr = starLayers[L], sc = 1 + zs * d * 0.09;
    for(var i = 0; i < arr.length; i++){
      var st = arr[i];
      var x = ((st.x + par.x * d) % W + W) % W, y = ((st.y + par.y * d) % H + H) % H;
      x = CX + (x - CX) * sc; y = CY + (y - CY) * sc;
      c.globalAlpha = st.a;
      c.fillStyle = st.w ? '#ffe3b8' : '#d6e0ff';
      if(st.r < 0.9){ c.fillRect(x - st.r, y - st.r, st.r * 2, st.r * 2); }
      else { c.beginPath(); c.arc(x, y, st.r, 0, TAU); c.fill(); }
    }
  }
  c.globalAlpha = 1;
  par.dirty = false;
}
function layout(){
  var r = stage.getBoundingClientRect();
  W = Math.max(1, Math.round(r.width)); H = Math.max(1, Math.round(r.height));
  dpr = Math.min(window.devicePixelRatio || 1, 2.5);
  scene.width = Math.round(W * dpr); scene.height = Math.round(H * dpr);
  starsCv.width = scene.width; starsCv.height = scene.height;
  var si = window.UI && UI.staticInset ? UI.staticInset() : { r: 0, t: 0, b: 0 };
  FM = Math.max(160, Math.min(W - si.r, H - si.t - si.b));
  base = 0.45 * FM;
  if(!insR && !insB && !insT){ insR = si.r; insT = si.t; insB = si.b; }
  CX = (W - insR) / 2; CY = (insT + H - insB) / 2;
  try { GLOK = !!(window.PlanetGL && PlanetGL.init(W, H, glRatio())); } catch(err){ GLOK = false; }
  makeStars(); drawStars();
}
if(window.ResizeObserver){ new ResizeObserver(layout).observe(stage); }
window.addEventListener('resize', layout);
layout();

/* ---------- Camera ---------- */
function maxZoom(){
  if(state.scale !== 'real') return MAXZ;
  var b = BY_ID[state.selected], cap = 1e11;
  if(b && b.R) cap = Math.min(cap, 1.2e5 / (b.R / KM_U * base));   /* keep the biggest disc under ~1e5 px so float maths stays clean */
  return cap;
}
/* zoom at which body b's radius is `frac` of the short canvas side */
function zoomForFill(b, frac){
  var target = frac * FM;
  if(state.scale === 'real') return target / (b.R / KM_U * base);
  var k = b.type === 'sun' ? 5.5 : b.px * 0.7;
  return ZC * target / (k * 2.6);
}
function focusZoom(id){
  var b = BY_ID[id];
  if(b.type === 'oort') return clamp(SPAN_K / 2.35e5, MINZ, 1);
  if(isWorld(b)) return clamp(zoomForFill(b, b.fit), 2, maxZoom());
  if(state.scale === 'real') return clamp(zoomForFill(b, 0.3), MINZ, maxZoom());
  if(id === 'alphacena' || id === 'alphacenb') return 0.9;
  if(b.type === 'exo' || id === 'proxima') return 560;
  return 4e-4;
}
function bodyDest(b){ return function(){ return { x: b.live.wx, y: b.live.wy, z: b.live.wz || 0 }; }; }
function startFlight(destFn, z1, follow){
  z1 = clamp(z1, MINZ, maxZoom());
  var d = destFn();
  var dist = Math.hypot(d.x - cam.x, d.y - cam.y, d.z - cam.z);
  var dur = reduceMotion ? 0.01 : clamp(0.9 + 0.32 * Math.abs(Math.log10(z1 / cam.zoom)) + 0.22 * Math.log10(1 + dist * 10), 0.9, 4.4);
  flight = { fx: cam.x, fy: cam.y, fz: cam.z, fzoom: cam.zoom, dest: destFn, z1: z1, t: 0, dur: dur, follow: follow };
  following = false; pend.ln = 0; coast.vx = coast.vy = 0;
}
/* Camera tilt for a close-up: low, so the bands run across the disc. Ringed planets get enough tilt for the rings to open out. */
function closeTilt(b){
  if(b.id !== 'saturn') return 24;
  var best = 24, bd = 1e9;
  for(var t = 24; t <= 90; t++){
    var v = Math.abs(-b.poleW[1] * Math.cos(t * RAD) + b.poleW[2] * Math.sin(t * RAD));
    var d = Math.abs(Math.asin(clamp(v, 0, 1)) / RAD - 24);
    if(d < bd){ bd = d; best = t; }
  }
  return best;
}
function flyToBody(id){
  var b = BY_ID[id];
  startFlight(bodyDest(b), focusZoom(id), true);
  tiltGoal = isWorld(b) ? closeTilt(b) : (b.type === 'oort' ? 50 : null);   /* look near the equator, as in a close-up photograph */
}
function overview(){ startFlight(function(){ return { x: 0, y: 0, z: 0 }; }, 1, false); tiltGoal = 58; }
function neighbourhood(){ startFlight(function(){ return { x: 0, y: 0, z: 0 }; }, 6e-5, false); }
function stopMotion(){ flight = null; }

function syncTabs(){
  $('tabSys').setAttribute('aria-pressed', group === 'system' ? 'true' : 'false');
  $('tabDwarf').setAttribute('aria-pressed', group === 'dwarf' ? 'true' : 'false');
  $('tabStars').setAttribute('aria-pressed', group === 'stars' ? 'true' : 'false');
}
function setGroup(g){
  if(group === g) return;
  group = g;
  buildChips();
  syncTabs();
}
function select(id, fly){
  state.selected = id;
  setGroup(BY_ID[id].group);
  renderPanel();
  if(fly) flyToBody(id);
}
function zoomAt(f, sx, sy){
  var nz = clamp(cam.zoom * f, MINZ, maxZoom());
  if(nz === cam.zoom) return;
  var sT = sinT();
  if(!following){
    var zp = base * cam.zoom;
    var wx = cam.x + (sx - CX) / zp;
    var wy = cam.y - (sy - CY) / (zp * sT);
    var zp2 = base * nz;
    cam.zoom = nz;
    cam.x = wx - (sx - CX) / zp2;
    cam.y = wy + (sy - CY) / (zp2 * sT);
  } else {
    cam.zoom = nz;
  }
}
/* Zoom requests from the wheel, buttons and keys are eased in over a few frames; pinch and the scale slider apply at once so they stay under the finger. */
var pend = { ln: 0, x: 0, y: 0 };
function userZoom(f, sx, sy, now){
  stopMotion();
  if(now || reduceMotion){ zoomAt(f, sx, sy); return; }
  pend.ln += Math.log(f); pend.x = sx; pend.y = sy;
}
function stepZoom(dt){
  if(pend.ln === 0) return;
  if(Math.abs(pend.ln) < 5e-4){ zoomAt(Math.exp(pend.ln), pend.x, pend.y); pend.ln = 0; return; }
  var st = pend.ln * (1 - Math.exp(-dt * 13));
  pend.ln -= st;
  zoomAt(Math.exp(st), pend.x, pend.y);
}
var coast = { vx: 0, vy: 0 };
function pan(dx, dy){
  var zp = base * cam.zoom;
  cam.x -= dx / zp; cam.y += dy / (zp * sinT());
  following = false; stopMotion();
}

/* ---------- Drawing ---------- */
function drawSun2D(x, y, r){
  var glowR = r * 4.5;
  var g = ctx.createRadialGradient(x, y, r * 0.6, x, y, glowR);
  g.addColorStop(0, 'rgba(255,196,96,.55)');
  g.addColorStop(0.35, 'rgba(255,170,70,.16)');
  g.addColorStop(1, 'rgba(255,160,60,0)');
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, glowR, 0, TAU); ctx.fill();
  g = ctx.createRadialGradient(x - r * 0.25, y - r * 0.25, r * 0.1, x, y, r);
  g.addColorStop(0, '#fff6d8'); g.addColorStop(0.6, '#ffd272'); g.addColorStop(1, '#f4a53a');
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
}
function drawStar2D(o, x, y, r){
  var glowR = r * 5 * (o.glow || 1);
  var g = ctx.createRadialGradient(x, y, r * 0.4, x, y, glowR);
  g.addColorStop(0, 'rgba(' + o.rgb + ',.5)');
  g.addColorStop(0.4, 'rgba(' + o.rgb + ',.12)');
  g.addColorStop(1, 'rgba(' + o.rgb + ',0)');
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, glowR, 0, TAU); ctx.fill();
  g = ctx.createRadialGradient(x - r * 0.2, y - r * 0.2, r * 0.1, x, y, r);
  g.addColorStop(0, '#ffffff'); g.addColorStop(1, 'rgb(' + o.rgb + ')');
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
}
/* A body too small to shade: a flat dot in its own colour. */
function drawDot(o, x, y, r){
  ctx.fillStyle = o.color; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
}

/* On-screen equatorial radius, in px, of a body of the Solar System. Exaggerated unless real size is on. */
function bodyPx(b, zp){
  if(state.scale === 'real') return b.R / KM_U * zp;
  var ss = clamp(Math.pow(cam.zoom, 0.4), 0.85, 2.6), grow = Math.max(1, cam.zoom / ZC);
  if(b.type === 'sun') return (11 - 5.5 * blendE) * ss * grow;
  return b.px * ss * (1 - 0.3 * blendE) * grow;
}
/* Radius of a moon's path round its planet, in px. True size in real mode; otherwise the moons are stacked outwards in order,
   each clear of the one inside it, so they stay readable. */
function satR(m, zp){
  if(state.scale === 'real') return m.aKm / KM_U * zp;
  var ss = clamp(Math.pow(cam.zoom, 0.4), 0.85, 2.6), list = m.parent.sats;
  var rp = bodyPx(m.parent, zp) * (m.parent.ringOut || 1), R = 0, rprev = rp;
  for(var i = 0; i < list.length; i++){
    var rs = bodyPx(list[i], zp);
    R = i === 0 ? (rp + rs) * 1.4 + 9 * ss : R + (rprev + rs) * 1.25 + 8 * ss;
    if(list[i] === m) return R;
    rprev = rs;
  }
  return R;
}
function moonOrbitPx(zp){ return satR(MOON, zp); }
/* The Moon always shows. Other moons appear once you are zoomed in on their planet, or have picked one of them. */
function satShown(m, zp){
  if(m.id !== 'moon' && state.scale !== 'real' && cam.zoom < 3){
    var sel = BY_ID[state.selected];
    if(!(sel === m || sel === m.parent || sel.parent === m.parent)) return false;
  }
  return satR(m, zp) >= 6;
}

/* Shaded 3D body through WebGL. Returns false when the renderer is unavailable so the caller can fall back to the flat drawing. */
function drawBodyGL(o, x, y, r, sT, cT, kind, extra){
  if(!GLOK) return false;
  if(r > 60) glBig = true;
  var fr = bodyFrame(o, simDays);
  var Lv = o.type === 'sun' ? [0, 0, 1] : toView(lightWorld(o), sT, cT);
  var q = { kind: kind || o.id, x: x, y: y, r: r, flat: o.flat || 1, by: o.by || 1,
            X: toView(fr.X, sT, cT), Y: toView(fr.Y, sT, cT), Z: toView(fr.Z, sT, cT), L: Lv,
            night: state.night, time: visTime, seed: 0 };
  if(extra){ for(var k in extra) q[k] = extra[k]; }
  return PlanetGL.draw(ctx, q);
}
function starTint(o){
  var c = o.rgb.split(',');
  return [Math.min(2.2, c[0] / 255), Math.min(2.2, c[1] / 255 / 0.8), Math.min(2.2, c[2] / 255 / 0.5)];
}
function drawRing(x, y, r, sT, front){
  var rx = r * 2.0, ry = rx * sT;
  ctx.lineWidth = Math.max(1.2, r * 0.55);
  ctx.strokeStyle = 'rgba(228,208,160,.55)';
  ctx.beginPath();
  if(front){ ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI); } else { ctx.ellipse(x, y, rx, ry, 0, Math.PI, TAU); }
  ctx.stroke();
}
function drawPlanet(p, x, y, r, lightX, lightY, sT){
  if(p.rings) drawRing(x, y, r, sT, false);
  var dx = lightX - x, dy = lightY - y, len = Math.hypot(dx, dy) || 1;
  var ux = dx / len, uy = dy / len;
  var g = ctx.createRadialGradient(x + ux * r * 0.45, y + uy * r * 0.45, r * 0.1, x, y, r * 1.05);
  g.addColorStop(0, p.color); g.addColorStop(1, p.dark);
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
  if(p.bands && r > 6){
    ctx.save(); ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.clip();
    ctx.strokeStyle = 'rgba(110,72,44,.35)'; ctx.lineWidth = Math.max(1, r * 0.16);
    var offs = [-0.45, -0.05, 0.38];
    for(var i = 0; i < offs.length; i++){
      ctx.beginPath(); ctx.moveTo(x - r, y + offs[i] * r); ctx.lineTo(x + r, y + offs[i] * r); ctx.stroke();
    }
    ctx.restore();
  }
  if(p.rings) drawRing(x, y, r, sT, true);
}
/* Is a ring of radius R (screen px, centred x0,y0, vertically squashed by k) able to touch the canvas? */
function ringVisible(x0, y0, R, Rmin, k){
  var x1 = -x0, x2 = W - x0, y1 = -y0 / k, y2 = (H - y0) / k;
  var dx = x1 > 0 ? x1 : (x2 < 0 ? -x2 : 0), dy = y1 > 0 ? y1 : (y2 < 0 ? -y2 : 0);
  var dmin = Math.hypot(dx, dy);
  var dmax = Math.hypot(Math.max(Math.abs(x1), Math.abs(x2)), Math.max(Math.abs(y1), Math.abs(y2)));
  return R >= dmin - 3 && Rmin <= dmax + 3;
}
function niceStep(v){
  var steps = [0.01, 0.02, 0.05, 0.1, 0.2, 0.5, 1, 2, 5, 10, 20];
  for(var i = 0; i < steps.length; i++){ if(steps[i] >= v) return steps[i]; }
  return 20;
}

function draw(){
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, W, H);
  var sT = sinT(), cT = cosT(), zp = base * cam.zoom, cx = CX, cy = CY;
  var ss = clamp(Math.pow(cam.zoom, 0.4), 0.85, 2.6);
  var i, j, p, o;
  function PX(wx){ return cx + (wx - cam.x) * zp; }
  function PY(wy, wz){ return cy - ((wy - cam.y) * sT + (wz - cam.z) * cT) * zp; }
  var sunX = PX(0), sunY = PY(0, 0);
  hits.length = 0;

  /* light-year rings around the Sun, for the interstellar scales */
  if(cam.zoom < 0.01){
    var pxLy = zp * LY_U;
    var step = niceStep(110 / pxLy), stepPx = step * pxLy;
    var fx = Math.max(Math.abs(sunX), Math.abs(W - sunX)), fy = Math.max(Math.abs(sunY), Math.abs(H - sunY)) / sT;
    var ddx = sunX < 0 ? -sunX : (sunX > W ? sunX - W : 0), ddy = sunY < 0 ? -sunY / sT : (sunY > H ? (sunY - H) / sT : 0);
    var k0 = Math.max(1, Math.ceil(Math.hypot(ddx, ddy) / stepPx)), k1 = Math.min(k0 + 16, Math.floor(Math.hypot(fx, fy) / stepPx));
    ctx.lineWidth = 1; ctx.strokeStyle = 'rgba(148,164,212,.14)'; ctx.fillStyle = C.muted;
    ctx.font = '500 10px ' + FONT_MONO; ctx.textBaseline = 'alphabetic';
    for(var kk = k0; kk <= k1; kk++){
      var R = kk * stepPx;
      ctx.beginPath(); ctx.ellipse(sunX, sunY, R, R * sT, 0, 0, TAU); ctx.stroke();
      var lx = sunX + R * Math.cos(0.7), ly = sunY - R * sT * Math.sin(0.7);
      if(lx > 4 && lx < W - 60 && ly > 12 && ly < H - 4){
        var lab = (step < 1 ? (kk * step).toFixed(2).replace(/0+$/, '').replace(/\.$/, '') : String(kk * step)) + ' ly';
        ctx.fillText(lab, lx + 4, ly - 3);
      }
    }
  }

  /* Oort cloud: a shell of points round the Sun, shown at the interstellar zoom levels */
  var oortLbl = null;
  if((state.oort || state.selected === 'oort') && cam.zoom < 0.02){
    var Ro = OORT_OUT / U_AU * zp, Rm = OORT_MID / U_AU * zp;
    if(Ro > 14){
      if(Ro < 3000){
        var og = ctx.createRadialGradient(sunX, sunY, Ro * 0.5, sunX, sunY, Ro);
        og.addColorStop(0, 'rgba(150,175,235,0)'); og.addColorStop(1, 'rgba(150,175,235,.1)');
        ctx.fillStyle = og; ctx.beginPath(); ctx.arc(sunX, sunY, Ro, 0, TAU); ctx.fill();
      }
      ctx.save(); ctx.setLineDash([3, 5]); ctx.lineWidth = 1; ctx.strokeStyle = 'rgba(160,184,240,.34)';
      if(Ro < 4e5 && ringVisible(sunX, sunY, Ro * 1.05, Ro * 0.95, 1)){ ctx.beginPath(); ctx.arc(sunX, sunY, Ro, 0, TAU); ctx.stroke(); }
      if(Rm > 8 && Rm < 4e5 && ringVisible(sunX, sunY, Rm * 1.05, Rm * 0.95, sT)){ ctx.beginPath(); ctx.ellipse(sunX, sunY, Rm, Rm * sT, 0, 0, TAU); ctx.stroke(); }
      ctx.restore();
      var pass, arr, opx, opy;
      for(pass = 0; pass < 2; pass++){
        arr = pass ? OORT_B : OORT_A;
        ctx.fillStyle = pass ? 'rgba(206,218,255,.8)' : 'rgba(176,196,246,.5)';
        for(j = 0; j < arr.length; j++){
          opx = cx + (arr[j].x - cam.x) * zp; opy = cy - ((arr[j].y - cam.y) * sT + (arr[j].z - cam.z) * cT) * zp;
          if(opx < -2 || opx > W + 2 || opy < -2 || opy > H + 2) continue;
          ctx.fillRect(opx, opy, arr[j].s, arr[j].s);
        }
      }
      ctx.font = '500 10px ' + FONT_MONO; ctx.textBaseline = 'alphabetic'; ctx.fillStyle = 'rgba(168,190,240,.85)';
      var icx = sunX + Rm + 6, icy = sunY - 4;
      if(Rm > 30 && icx > 4 && icx < W - 130 && icy > 14 && icy < H - 4) ctx.fillText('inner cloud · 20,000 AU', icx, icy);
      var oAng = 2.25, olx = sunX + Ro * Math.cos(oAng), oly = sunY - Ro * Math.sin(oAng);
      oortLbl = { x: olx, y: oly };
      if(olx > 4 && olx < W - 150 && oly > 24 && oly < H - 4) ctx.fillText('outer edge · 100,000 AU', olx + 6, oly + 15);
    }
  }

  /* asteroid belt */
  if(state.belt && zp * 0.11 > 4){
    ctx.fillStyle = C.belt;
    for(i = 0; i < belt.length; i++){
      var b = belt[i];
      var lam = b.t0 + simDays * b.w;
      var rd = lerp(b.rc, b.rt, blendE);
      var bx = cx + (rd * Math.cos(lam) - cam.x) * zp;
      var by = cy - ((rd * Math.sin(lam) - cam.y) * sT - cam.z * cT) * zp;
      if(bx < -2 || bx > W + 2 || by < -2 || by > H + 2) continue;
      ctx.fillRect(bx, by, b.s, b.s);
    }
  }

  /* orbits */
  function traceSolar(pl){
    ctx.beginPath();
    for(var k = 0; k <= N; k++){
      var m = k % N;
      var f = lerp(pl.orc[m], pl.ort[m], blendE);
      var ox = cx + (f * pl.oc[m] - cam.x) * zp;
      var oy = cy - ((f * pl.os[m] - cam.y) * sT - cam.z * cT) * zp;
      if(k) ctx.lineTo(ox, oy); else ctx.moveTo(ox, oy);
    }
    ctx.closePath(); ctx.stroke();
  }
  function solarOrbit(pl, sel){
    var Rmax = lerp(pl.rMaxC, pl.rMaxT, blendE) * zp, Rmin = lerp(pl.rMinC, pl.rMinT, blendE) * zp;
    if(Rmax < 3 || Rmax > 4e5 || !ringVisible(sunX, sunY, Rmax * 1.2, Rmin * 0.8, sT)) return;
    ctx.lineWidth = sel ? 1.6 : 1; ctx.strokeStyle = sel ? C.accent : C.orbit; ctx.globalAlpha = sel ? 0.85 : 1;
    traceSolar(pl); ctx.globalAlpha = 1;
  }
  function circleAround(par, rU, sel){
    var cxp = PX(par.live.wx), cyp = PY(par.live.wy, par.live.wz);
    var R = rU * zp;
    if(R < 3 || R > 4e5 || !ringVisible(cxp, cyp, R * 1.1, R * 0.9, 1)) return;
    ctx.lineWidth = sel ? 1.6 : 1; ctx.strokeStyle = sel ? C.accent : C.orbit; ctx.globalAlpha = sel ? 0.85 : 1;
    ctx.beginPath();
    for(var k = 0; k <= 96; k++){
      var t = k / 96 * TAU;
      var ox = PX(par.live.wx + rU * Math.cos(t)), oy = PY(par.live.wy + rU * Math.sin(t), par.live.wz);
      if(k) ctx.lineTo(ox, oy); else ctx.moveTo(ox, oy);
    }
    ctx.stroke(); ctx.globalAlpha = 1;
  }
  function binaryOrbit(f, sign, sel){
    var cxp = PX(AC_BARY[0]), cyp = PY(AC_BARY[1], AC_BARY[2]);
    var R = AC.a * (1 + AC.e) / U_AU * f * zp;
    if(R < 3 || R > 4e5 || !ringVisible(cxp, cyp, R * 1.2, 0, 1)) return;
    ctx.lineWidth = sel ? 1.6 : 1; ctx.strokeStyle = sel ? C.accent : C.orbit; ctx.globalAlpha = sel ? 0.85 : 1;
    ctx.beginPath();
    for(var k = 0; k <= AC_PTS.length; k++){
      var v = AC_PTS[k % AC_PTS.length];
      var ox = PX(AC_BARY[0] + sign * f * v[0] / U_AU), oy = PY(AC_BARY[1] + sign * f * v[1] / U_AU, AC_BARY[2] + sign * f * v[2] / U_AU);
      if(k) ctx.lineTo(ox, oy); else ctx.moveTo(ox, oy);
    }
    ctx.stroke(); ctx.globalAlpha = 1;
  }
  /* a moon's path round its planet. The Moon uses the lunar ephemeris, the rest use their mean elements. */
  function satOrbit(m, sel){
    if(!satShown(m, zp)) return;
    var pl = m.parent.live, bx = pl.bx !== undefined ? pl.bx : pl.wx, by = pl.by !== undefined ? pl.by : pl.wy, bz = pl.bz !== undefined ? pl.bz : (pl.wz || 0);
    var R = satR(m, zp), real = state.scale === 'real', cxp = PX(bx), cyp = PY(by, bz);
    if(R > 4e5 || !ringVisible(cxp, cyp, R * 1.1, 0, 1)) return;
    var fb = m.binary ? 1 - m.binary : 1, vp = (m.varpi || 0) * RAD, Q = m.parent.nodeW, B = cross3(m.parent.poleW, Q);
    ctx.lineWidth = sel ? 1.6 : 1; ctx.strokeStyle = sel ? C.accent : C.orbit; ctx.globalAlpha = sel ? 0.85 : 1;
    ctx.beginPath();
    for(var k = 0; k <= 96; k++){
      var v, f;
      if(m.id === 'moon'){
        v = moonKm(simDays + k / 96 * 27.3217); f = real ? 1 / KM_U : R / zp / Math.hypot(v[0], v[1], v[2]);
      } else {
        var nu = k / 96 * TAU, rr = m.aKm * (1 - m.e * m.e) / (1 + m.e * Math.cos(nu)), th = nu + vp, c = Math.cos(th), sn = Math.sin(th);
        v = [(Q[0] * c + B[0] * sn) * rr, (Q[1] * c + B[1] * sn) * rr, (Q[2] * c + B[2] * sn) * rr];
        f = real ? 1 / KM_U : R / zp / m.aKm;
      }
      var ox = PX(bx + v[0] * f * fb), oy = PY(by + v[1] * f * fb, bz + v[2] * f * fb);
      if(k) ctx.lineTo(ox, oy); else ctx.moveTo(ox, oy);
    }
    ctx.stroke(); ctx.globalAlpha = 1;
  }
  /* a dwarf planet's tilted orbit */
  function dwarfOrbit(p, sel){
    var Rmax = lerp(p.rMaxC, p.rMaxT, blendE) * zp, Rmin = lerp(p.rMinC, p.rMinT, blendE) * zp;
    if(Rmax < 3 || Rmax > 4e5 || !ringVisible(sunX, sunY, Rmax * 1.2, Rmin * 0.8, 1)) return;
    ctx.lineWidth = sel ? 1.6 : 1; ctx.strokeStyle = sel ? C.accent : C.orbit; ctx.globalAlpha = sel ? 0.85 : 0.75;
    ctx.beginPath();
    for(var k = 0; k <= N; k++){
      var m = k % N, f = lerp(p.osc[m], 1, blendE) / U_AU;
      var ox = cx + (p.ox[m] * f - cam.x) * zp, oy = cy - ((p.oy[m] * f - cam.y) * sT + (p.oz[m] * f - cam.z) * cT) * zp;
      if(k) ctx.lineTo(ox, oy); else ctx.moveTo(ox, oy);
    }
    ctx.closePath(); ctx.stroke(); ctx.globalAlpha = 1;
  }
  if(state.orbits){
    for(i = 0; i < PLANETS.length; i++){ if(PLANETS[i].id !== state.selected) solarOrbit(PLANETS[i], false); }
    if(BY_ID[state.selected].type === 'planet' && bodyPx(BY_ID[state.selected], zp) < 0.12 * FM) solarOrbit(BY_ID[state.selected], true);
    for(i = 0; i < DWARF_LIST.length; i++){ if(DWARF_LIST[i].type === 'dwarf' && DWARF_LIST[i].id !== state.selected) dwarfOrbit(DWARF_LIST[i], false); }
    if(BY_ID[state.selected].type === 'dwarf' && bodyPx(BY_ID[state.selected], zp) < 0.12 * FM) dwarfOrbit(BY_ID[state.selected], true);
    for(i = 0; i < EXO.length; i++){ if(EXO[i].id !== state.selected) circleAround(EXO[i].parent, EXO[i].a / U_AU, false); }
    for(i = 0; i < EXO.length; i++){ if(EXO[i].id === state.selected) circleAround(EXO[i].parent, EXO[i].a / U_AU, true); }
    satOrbit(MOON, state.selected === 'moon');
    for(i = 0; i < SATS.length; i++) satOrbit(SATS[i], SATS[i].id === state.selected);
    binaryOrbit(AC.fA, -1, state.selected === 'alphacena');
    binaryOrbit(AC.fB, 1, state.selected === 'alphacenb');
  }

  /* depth order: far objects first */
  var order = ALL.slice().sort(function(a, b){
    return (b.live.wy * cT - (b.live.wz || 0) * sT) - (a.live.wy * cT - (a.live.wz || 0) * sT);
  });
  /* a moon you have picked is never left hidden behind its own planet: draw it just after the planet */
  var selB = BY_ID[state.selected];
  if(selB && selB.type === 'moon'){
    var iM = order.indexOf(selB), iP = order.indexOf(selB.parent);
    if(iM >= 0 && iP >= 0 && iM < iP){ order.splice(iM, 1); order.splice(iP, 0, selB); }
  }
  var labels = [];
  var real = state.scale === 'real', minSide = FM;
  for(i = 0; i < order.length; i++){
    o = order[i];
    if(o.type === 'oort') continue;
    var x = PX(o.live.wx), y = PY(o.live.wy, o.live.wz || 0);
    var r, hitR, selR, reach, big = false;
    if(o.type === 'sun'){
      r = bodyPx(o, zp); reach = r * 2 + 140;
    } else if(o.type === 'star'){
      var rr = real ? o.R / KM_U * zp : 0;
      r = real ? Math.max(rr, 1.5) : o.size * ss * 0.9; reach = r * 5 + 140;
    } else if(o.type === 'planet'){
      if(lerp(o.rMaxC, o.rMaxT, blendE) * zp < 5) continue;
      r = bodyPx(o, zp); reach = r * (o.ringOut || 1) + 140;
    } else if(o.type === 'moon'){
      if(!satShown(o, zp)) continue;
      r = bodyPx(o, zp); reach = r + 140;
    } else if(o.type === 'dwarf'){
      if(lerp(o.rMaxC, o.rMaxT, blendE) * zp < 5) continue;
      r = bodyPx(o, zp); reach = r + 140;
    } else {
      if(o.a / U_AU * zp < 5) continue;
      r = real ? o.R / KM_U * zp : o.px * ss * 0.8; reach = r + 140;
    }
    if(x + reach < 0 || x - reach > W || y + reach < 0 || y - reach > H) continue;

    if(o.type === 'sun'){
      if(r > 4e5){ if(Math.hypot(x - CX, y - CY) < r){ ctx.fillStyle = '#ffd98a'; ctx.fillRect(0, 0, W, H); } }
      else if(r < 7 || !drawBodyGL(o, x, y, r, sT, cT)) drawSun2D(x, y, Math.max(r, real ? 2.5 : 3));
      hitR = Math.max(r, 5) + 6; selR = hitR + 3;
    } else if(o.type === 'star'){
      if(cam.zoom < 0.01){
        var yf = PY(o.live.wy, 0);
        if(Math.abs(yf - y) > 4 && sT < 0.995){
          ctx.save(); ctx.setLineDash([2, 3]); ctx.lineWidth = 1; ctx.strokeStyle = 'rgba(148,164,212,.28)';
          ctx.beginPath(); ctx.moveTo(x, yf); ctx.lineTo(x, y); ctx.stroke(); ctx.restore();
          ctx.fillStyle = 'rgba(148,164,212,.4)'; ctx.beginPath(); ctx.arc(x, yf, 1.5, 0, TAU); ctx.fill();
        }
      }
      if(real && rr >= 6 && rr < 4e5 && drawBodyGL(o, x, y, rr, sT, cT, 'sun', { tint: starTint(o), halo: [+o.rgb.split(',')[0] / 255, +o.rgb.split(',')[1] / 255, +o.rgb.split(',')[2] / 255, 0.9], flat: 1 })){ /* shaded star */ }
      else drawStar2D(o, x, y, r);
      hitR = Math.max(r, 5) + 4; selR = hitR + 4;
    } else {
      var ring = o.ringOut || 0;
      if(r > 4e5){
        if(Math.hypot(x - CX, y - CY) < r){ ctx.fillStyle = o.color; ctx.fillRect(0, 0, W, H); }
      } else if(r < 2.4){
        drawDot(o, x, y, 2.4);
      } else {
        var ok = false;
        if(o.type === 'exo') ok = drawBodyGL(o, x, y, r, sT, cT, 'mercury', { tint: o.id === 'proximab' ? [1.0, 0.8, 0.62] : [0.92, 0.78, 0.68], halo: [1, 0.55, 0.4, 0.03] });
        else ok = drawBodyGL(o, x, y, r, sT, cT);
        if(!ok){
          if(o.type === 'moon' || o.type === 'exo' || r > 3){ drawPlanet(o, x, y, r, o.type === 'exo' ? PX(o.parent.live.wx) : sunX, o.type === 'exo' ? PY(o.parent.live.wy, o.parent.live.wz) : sunY, sT); }
          else drawDot(o, x, y, r);
        }
      }
      hitR = Math.max(ring ? r * ring : r, 5); selR = hitR + 6;
    }
    big = r > 0.22 * minSide;
    if(o.id === state.selected && r < 0.12 * minSide){
      ctx.save(); ctx.setLineDash([2.5, 3.5]); ctx.lineDashOffset = reduceMotion ? 0 : -performance.now() / 90; ctx.lineWidth = 1.4; ctx.strokeStyle = C.accent;
      ctx.beginPath(); ctx.arc(x, y, selR, 0, TAU); ctx.stroke();
      if(!reduceMotion){
        var pu = (performance.now() % 2200) / 2200;
        ctx.setLineDash([]); ctx.globalAlpha = 0.5 * (1 - pu); ctx.lineWidth = 1;
        ctx.beginPath(); ctx.arc(x, y, selR + pu * 16, 0, TAU); ctx.stroke();
      }
      ctx.restore();
    }
    hits.push({ id: o.id, x: x, y: y, r: hitR });
    labels.push({ o: o, text: o.name, x: x, y: y, r: hitR, sel: o.id === state.selected, prio: o.id === state.selected ? 0 : (o.prio || 5), skip: big });
  }

  /* merge the Alpha Centauri pair into one label while they overlap */
  var la = null, lb = null;
  for(i = 0; i < labels.length; i++){
    if(labels[i].o.id === 'alphacena') la = labels[i];
    if(labels[i].o.id === 'alphacenb') lb = labels[i];
  }
  if(la && lb && Math.hypot(la.x - lb.x, la.y - lb.y) < 18){
    la.text = 'Alpha Centauri';
    if(!lb.sel) lb.skip = true; else { lb.text = 'Alpha Centauri'; la.skip = true; }
  }

  if(oortLbl){
    labels.push({ o: OORT, text: 'Oort cloud', x: oortLbl.x, y: oortLbl.y, r: 4, sel: state.selected === 'oort', prio: state.selected === 'oort' ? 0 : 3.2, skip: false });
    hits.push({ id: 'oort', x: oortLbl.x, y: oortLbl.y, r: 12 });
  }
  labels.sort(function(a, b){ return a.prio - b.prio; });
  ctx.font = '600 11.5px ' + FONT_UI;
  ctx.lineJoin = 'round'; ctx.textBaseline = 'alphabetic';
  var placed = [];
  for(i = 0; i < labels.length; i++){
    var lbl = labels[i];
    if(lbl.skip) continue;
    if(!state.labels && !lbl.sel) continue;
    var tw = ctx.measureText(lbl.text).width;
    var lx = lbl.x + lbl.r + 6;
    if(lx + tw > W - 6) lx = lbl.x - lbl.r - 6 - tw;
    var ly = lbl.y + 4;
    var rect = [lx - 3, ly - 12, lx + tw + 3, ly + 4], clash = false;
    if(!lbl.sel){
      for(j = 0; j < placed.length; j++){
        var q = placed[j];
        if(rect[0] < q[2] && rect[2] > q[0] && rect[1] < q[3] && rect[3] > q[1]){ clash = true; break; }
      }
    }
    if(clash) continue;
    placed.push(rect);
    ctx.lineWidth = 3.5; ctx.strokeStyle = C.ink; ctx.strokeText(lbl.text, lx, ly);
    ctx.fillStyle = lbl.sel ? C.accent : C.text; ctx.fillText(lbl.text, lx, ly);
  }
}

/* ---------- Panel ---------- */
var chipsEl = $('chips');
function buildChips(){
  chipsEl.innerHTML = '';
  var list = listFor(group);
  chipsEl.className = list.length > 12 ? 'chips many' : 'chips';
  list.forEach(function(b){
    var btn = document.createElement('button');
    btn.type = 'button'; btn.className = 'chip' + (b.type === 'moon' ? ' sub' : ''); btn.dataset.id = b.id;
    btn.setAttribute('aria-pressed', b.id === state.selected ? 'true' : 'false');
    btn.innerHTML = '<i style="--c:' + (b.color || '#c4bab0') + '"></i>' + b.name;
    chipsEl.appendChild(btn);
  });
}
chipsEl.addEventListener('click', function(e){
  var btn = e.target.closest('.chip');
  if(btn) select(btn.dataset.id, true);
});
$('tabSys').addEventListener('click', function(){ setGroup('system'); });
$('tabDwarf').addEventListener('click', function(){ setGroup('dwarf'); });
$('tabStars').addEventListener('click', function(){ setGroup('stars'); });

function fmtLight(au){
  var s = au * AU_LIGHT_S;
  if(s < 3600) return Math.floor(s / 60) + ' min ' + String(Math.round(s % 60)).padStart(2, '0') + ' s';
  if(s < 172800) return Math.floor(s / 3600) + ' h ' + Math.round((s % 3600) / 60) + ' min';
  if(s < 86400 * 365.25) return Math.round(s / 86400) + ' days';
  return (au / LY_AU).toFixed(2) + ' years';
}
function fmtDist(au){
  if(au >= 15000) return (au / LY_AU).toFixed(2) + ' <small>ly</small>';
  if(au < 0.1) return au.toFixed(4) + ' <small>AU</small>';
  return (au < 10 ? au.toFixed(2) : au < 1000 ? au.toFixed(1) : Math.round(au).toLocaleString('en-US')) + ' <small>AU</small>';
}
function fmtSub(au){
  if(au >= 15000) return Math.round(au).toLocaleString('en-US') + ' AU';
  return Math.round(au * AU_MKM * 10) / 10 > 1000 ? Math.round(au * AU_MKM).toLocaleString('en-US') + ' million km' : (au * AU_MKM).toFixed(au < 0.1 ? 1 : 0) + ' million km';
}
function fmtNum(n){
  if(!isFinite(n)) return '—';
  if(n >= 100) return Math.round(n).toLocaleString('en-US');
  if(n >= 10) return n.toFixed(1);
  return n.toFixed(2);
}
function worldDist(a, b){
  return Math.hypot(a.live.wx - b.live.wx, a.live.wy - b.live.wy, (a.live.wz || 0) - (b.live.wz || 0)) * U_AU;
}
function setNow(n, key, au, light){
  $('n' + n + 'k').textContent = key;
  $('n' + n + 'v').innerHTML = fmtDist(au);
  $('n' + n + 's').textContent = fmtSub(au);
  $('n' + n + 'l').textContent = light || ('Light takes ' + fmtLight(au));
}
function updateNow(){
  var b = BY_ID[state.selected], now = $('now'), two = false;
  if(b.type === 'moon'){
    var kmNow = b.live.km, lo = b.aKm * (1 - b.e), hi = b.aKm * (1 + b.e);
    $('n1k').textContent = 'From ' + b.parent.name + ' now';
    $('n1v').innerHTML = Math.round(kmNow).toLocaleString('en-US') + ' <small>km</small>';
    $('n1s').textContent = b.id === 'moon' ? 'Ranges from 363,000 to 406,000 km'
      : b.e < 0.005 ? 'Nearly circular orbit' : 'Ranges from ' + (Math.round(lo / 100) * 100).toLocaleString('en-US') + ' to ' + (Math.round(hi / 100) * 100).toLocaleString('en-US') + ' km';
    $('n1l').textContent = 'Light takes ' + (kmNow / 299792.458).toFixed(2) + ' seconds';
    setNow(2, 'From the Sun now', b.parent.live.r); two = true;
  } else if(b.type === 'dwarf'){
    setNow(1, 'From the Sun now', b.live.r);
    setNow(2, 'From Earth now', Math.hypot(b.live.x - EARTH.live.x, b.live.y - EARTH.live.y, b.live.z)); two = true;
  } else if(b.type === 'oort'){
    setNow(1, 'Inner edge from the Sun', OORT_IN);
    setNow(2, 'Outer edge from the Sun', OORT_OUT); two = true;
  } else if(b.type === 'sun' || b.id === 'earth'){
    setNow(1, b.type === 'sun' ? "Earth's distance now" : 'From the Sun now', EARTH.live.r);
  } else if(b.type === 'planet'){
    setNow(1, 'From the Sun now', b.live.r);
    setNow(2, 'From Earth now', Math.hypot(b.live.x - EARTH.live.x, b.live.y - EARTH.live.y)); two = true;
  } else if(b.type === 'exo'){
    setNow(1, 'From Proxima now', b.live.r);
    setNow(2, 'From the Sun now', worldDist(b, SUN)); two = true;
  } else {
    setNow(1, 'From the Sun now', worldDist(b, SUN));
    if(b.id === 'alphacena' || b.id === 'alphacenb'){
      setNow(2, 'A to B separation', worldDist(ALPHA_A, ALPHA_B), 'Orbit repeats every 80 years'); two = true;
    } else if(b.id === 'proxima'){
      setNow(2, 'From Alpha Centauri A+B', Math.hypot(PROXIMA.live.wx - AC_BARY[0], PROXIMA.live.wy - AC_BARY[1], PROXIMA.live.wz - AC_BARY[2]) * U_AU); two = true;
    }
  }
  now.className = two ? 'now' : 'now one';
  $('n2').hidden = !two;
}
function updateYou(){
  var b = BY_ID[state.selected];
  if(!b.you) return;
  var age = parseFloat($('age').value), mass = parseFloat($('mass').value);
  $('ageRes').textContent = isFinite(age) ? fmtNum(age * 365.256 / b.period) : '—';
  $('massRes').textContent = isFinite(mass) ? fmtNum(mass * b.g / 9.81) : '—';
}
function renderPanel(){
  var b = BY_ID[state.selected];
  var chips = chipsEl.children;
  for(var i = 0; i < chips.length; i++){
    var on = chips[i].dataset.id === b.id;
    chips[i].setAttribute('aria-pressed', on ? 'true' : 'false');
    if(on && chipsEl.scrollWidth > chipsEl.clientWidth){
      chipsEl.scrollTo({ left: Math.max(0, chips[i].offsetLeft - 24), behavior: reduceMotion ? 'auto' : 'smooth' });
    } else if(on && chipsEl.scrollHeight > chipsEl.clientHeight + 2){
      var cr = chipsEl.getBoundingClientRect(), br = chips[i].getBoundingClientRect();
      if(br.top < cr.top) chipsEl.scrollTop -= cr.top - br.top + 4;
      else if(br.bottom > cr.bottom) chipsEl.scrollTop += br.bottom - cr.bottom + 4;
    }
  }
  $('pKind').textContent = b.kind;
  $('pName').textContent = b.name;
  $('pBlurb').textContent = b.blurb;
  $('pFact').textContent = b.fact;
  $('pStats').innerHTML = b.stats.map(function(s, k){ return '<div style="--j:' + k + '"><dt>' + s[0] + '</dt><dd>' + s[1] + '</dd></div>'; }).join('');
  $('you').hidden = !b.you;
  $('foot').textContent = b.group === 'stars'
    ? 'Star positions come from catalogue coordinates, and the Alpha Centauri orbit uses published elements. Star and planet sizes are exaggerated, and the orientations of Proxima’s planet orbits are not known.'
    : b.type === 'moon'
    ? 'Moon positions use mean orbital elements placed in the equatorial plane of the world they circle, so they are approximate. Orbits are stretched apart to stay readable until you turn on Real size 1:1. Surfaces are painted procedurally from the real features of each moon, not photographs.'
    : b.type === 'dwarf'
    ? 'Dwarf-planet positions use JPL orbital elements, so they are close to real around the present day and drift the further you jump in time. Ceres, Pluto and Charon are painted from what the Dawn and New Horizons maps show. Haumea, Makemake and Eris have never been seen in detail, so their surfaces are imagined from their colour and brightness.'
    : b.type === 'oort'
    ? 'Nobody has seen the Oort cloud. Its size and shape are worked out from the orbits of long-period comets, and the points drawn here are a random sample, not real objects. Distances are to scale.'
    : 'Orbits use simplified orbital elements, so positions land within a few degrees of the real planets. Spin axes and day lengths follow IAU values. Surfaces are painted procedurally from what each world looks like, not photographs, and Earth’s continents come from a hand-drawn map. Turn on Real size 1:1 for true radii.';
  if(b.you){
    $('youTitle').textContent = 'You on ' + b.name;
    $('ageUnit').textContent = b.unit ? b.unit + ' old' : b.name + ' years old';
    updateYou();
  }
  updateNow();
}
$('age').addEventListener('input', updateYou);
$('mass').addEventListener('input', updateYou);

/* ---------- Controls ---------- */
var playBtn = $('play');
function syncPlay(){
  var label = state.playing ? 'Pause' : 'Play';
  playBtn.setAttribute('aria-label', label);
  var icon = state.playing
    ? '<svg viewBox="0 0 14 14" aria-hidden="true"><path d="M3 1.5h2.6v11H3zM8.4 1.5H11v11H8.4z"/></svg>'
    : '<svg viewBox="0 0 14 14" aria-hidden="true"><path d="M3.4 1.2v11.6l9.2-5.8z"/></svg>';
  playBtn.innerHTML = icon + '<span class="sr">' + label + '</span>';
  var mini = $('playMini');
  mini.setAttribute('aria-label', label); mini.innerHTML = icon;
  playBtn.classList.toggle('paused', !state.playing); mini.classList.toggle('paused', !state.playing);
}
playBtn.addEventListener('click', function(){ state.playing = !state.playing; syncPlay(); });
$('playMini').addEventListener('click', function(){ state.playing = !state.playing; syncPlay(); });

$('speed').addEventListener('input', function(e){
  state.speed = +e.target.value;
  $('speedOut').textContent = SPEED_LABELS[state.speed];
});
$('tilt').addEventListener('input', function(e){
  tiltGoal = null;
  state.tilt = +e.target.value;
  $('tiltOut').textContent = state.tilt + '°';
});
$('today').addEventListener('click', function(){ simDays = (Date.now() - J2000) / DAY; });
$('jump').addEventListener('change', function(e){
  var t = Date.parse(e.target.value + 'T12:00:00Z');
  if(!isNaN(t)) simDays = (t - J2000) / DAY;
});

function bindToggle(id, key){
  var el = $(id);
  el.addEventListener('click', function(){
    state[key] = !state[key];
    el.setAttribute('aria-pressed', state[key] ? 'true' : 'false');
  });
}
bindToggle('tOrbits', 'orbits'); bindToggle('tLabels', 'labels'); bindToggle('tBelt', 'belt'); bindToggle('tDay', 'night'); bindToggle('tOort', 'oort');

function setScale(mode){
  if(state.scale === mode) return;
  state.scale = mode;
  $('scComp').setAttribute('aria-pressed', mode === 'compressed' ? 'true' : 'false');
  $('scTrue').setAttribute('aria-pressed', mode === 'true' ? 'true' : 'false');
  $('scReal').setAttribute('aria-pressed', mode === 'real' ? 'true' : 'false');
  if(following) flyToBody(state.selected);
  else if(!following && !flight && cam.zoom > 0.4 && Math.abs(cam.x) + Math.abs(cam.y) < 2) overview();
  else cam.zoom = clamp(cam.zoom, MINZ, maxZoom());
}
$('scComp').addEventListener('click', function(){ setScale('compressed'); });
$('scTrue').addEventListener('click', function(){ setScale('true'); });
$('scReal').addEventListener('click', function(){ setScale('real'); });

$('zIn').addEventListener('click', function(){ userZoom(1.45, CX, CY); });
$('zOut').addEventListener('click', function(){ userZoom(1 / 1.45, CX, CY); });
$('zReset').addEventListener('click', overview);
$('zStars').addEventListener('click', neighbourhood);

/* ---------- Zoom ladder ---------- */
var VMAX = 8.5, VMIN = -4.55;
var lTrack = $('lTrack'), lThumb = $('lThumb'), lRead = $('lRead'), ladderDrag = false;
(function(){
  var ticks = [[1e3 / 149.598e6, '1,000 km'], [1e4 / 149.598e6, '10,000 km'], [1e5 / 149.598e6, '100,000 km'], [1e6 / 149.598e6, '1M km'], [1e7 / 149.598e6, '10M km'],
               [1, '1 AU'], [10, '10 AU'], [100, '100 AU'], [1000, '1,000 AU'], [10000, '10,000 AU'], [LY_AU, '1 ly'], [LY_AU * 10, '10 ly']];
  ticks.forEach(function(t){
    var f = (VMAX - Math.log10(SPAN_K / t[0])) / (VMAX - VMIN);
    var el = document.createElement('span');
    el.className = 'tick'; el.style.top = (f * 100) + '%'; el.textContent = t[1];
    lTrack.appendChild(el);
  });
})();
function fmtSpan(au){
  if(au >= 15000) return (au / LY_AU).toFixed(au / LY_AU < 10 ? 2 : 1) + ' ly';
  if(au >= 10) return Math.round(au).toLocaleString('en-US') + ' AU';
  if(au >= 1) return au.toFixed(1) + ' AU';
  var km = au * 149.598e6;
  if(km >= 1e7) return au.toFixed(2) + ' AU';
  if(km >= 1e6) return (km / 1e6).toFixed(1) + 'M km';
  var sig = km >= 1e5 ? 1e3 : km >= 1e4 ? 100 : km >= 1e3 ? 10 : 1;
  return (Math.round(km / sig) * sig).toLocaleString('en-US') + ' km';
}
function ladderSet(clientY){
  var r = lTrack.getBoundingClientRect();
  var f = clamp((clientY - r.top) / Math.max(1, r.height), 0, 1);
  var z = Math.pow(10, VMAX - f * (VMAX - VMIN));
  userZoom(z / cam.zoom, CX, CY, true);
}
lTrack.addEventListener('pointerdown', function(e){
  ladderDrag = true;
  try { lTrack.setPointerCapture(e.pointerId); } catch(err){}
  ladderSet(e.clientY); e.preventDefault();
});
lTrack.addEventListener('pointermove', function(e){ if(ladderDrag) ladderSet(e.clientY); });
lTrack.addEventListener('pointerup', function(){ ladderDrag = false; });
lTrack.addEventListener('pointercancel', function(){ ladderDrag = false; });
lThumb.addEventListener('keydown', function(e){
  var f = null;
  if(e.key === 'ArrowUp' || e.key === 'ArrowRight') f = 1.25;
  else if(e.key === 'ArrowDown' || e.key === 'ArrowLeft') f = 1 / 1.25;
  else if(e.key === 'PageUp') f = 3;
  else if(e.key === 'PageDown') f = 1 / 3;
  if(f){ userZoom(f, CX, CY); e.preventDefault(); }
});

/* ---------- Pointer input ---------- */
var pointers = new Map(), downInfo = null, pinchDist = 0;
function localXY(e){ var r = scene.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; }
function hitTest(x, y, type){
  var best = null, bd = 1e9, pad = type === 'touch' ? 16 : 8;
  for(var i = 0; i < hits.length; i++){
    var h = hits[i], d = Math.hypot(h.x - x, h.y - y);
    if(d <= Math.max(h.r + pad, 14) && d < bd){ best = h; bd = d; }
  }
  return best;
}
scene.addEventListener('pointerdown', function(e){
  try { scene.setPointerCapture(e.pointerId); } catch(err){}
  var xy = localXY(e);
  pointers.set(e.pointerId, { x: xy[0], y: xy[1] });
  if(pointers.size === 1){
    downInfo = { x: xy[0], y: xy[1], moved: 0, type: e.pointerType, vx: 0, vy: 0, t: performance.now() };
    coast.vx = coast.vy = 0;
    scene.style.cursor = 'grabbing';
  } else if(pointers.size === 2){
    downInfo = null;
    var v = Array.from(pointers.values());
    pinchDist = Math.hypot(v[0].x - v[1].x, v[0].y - v[1].y);
  }
});
scene.addEventListener('pointermove', function(e){
  var xy = localXY(e), p = pointers.get(e.pointerId);
  if(!p){
    if(e.pointerType === 'mouse') scene.style.cursor = hitTest(xy[0], xy[1], 'mouse') ? 'pointer' : 'grab';
    return;
  }
  var dx = xy[0] - p.x, dy = xy[1] - p.y;
  p.x = xy[0]; p.y = xy[1];
  if(pointers.size === 1 && downInfo){
    downInfo.moved += Math.abs(dx) + Math.abs(dy);
    if(downInfo.moved > 6){
      pan(dx, dy);
      var tn = performance.now(), dtm = Math.max(4, tn - downInfo.t); downInfo.t = tn;
      downInfo.vx = downInfo.vx * 0.55 + (dx / dtm * 1000) * 0.45; downInfo.vy = downInfo.vy * 0.55 + (dy / dtm * 1000) * 0.45;
    }
  } else if(pointers.size === 2){
    var v = Array.from(pointers.values());
    var d = Math.hypot(v[0].x - v[1].x, v[0].y - v[1].y);
    if(pinchDist > 0) userZoom(d / pinchDist, (v[0].x + v[1].x) / 2, (v[0].y + v[1].y) / 2, true);
    pinchDist = d;
  }
});
function endPointer(e, allowClick){
  var xy = localXY(e);
  var wasOne = pointers.size === 1;
  pointers.delete(e.pointerId);
  scene.style.cursor = 'grab';
  if(allowClick && wasOne && downInfo && downInfo.moved > 6 && !reduceMotion && performance.now() - downInfo.t < 90 && Math.hypot(downInfo.vx, downInfo.vy) > 120){
    coast.vx = clamp(downInfo.vx, -2600, 2600); coast.vy = clamp(downInfo.vy, -2600, 2600);
  }
  if(allowClick && wasOne && downInfo && downInfo.moved <= 6){
    var h = hitTest(xy[0], xy[1], downInfo.type === 'touch' ? 'touch' : 'mouse');
    if(h && (h.id !== state.selected || !following)) select(h.id, true);
  }
  if(pointers.size === 1){
    var rest = Array.from(pointers.values())[0];
    downInfo = { x: rest.x, y: rest.y, moved: 99, type: 'touch' };
  } else if(pointers.size === 0){
    downInfo = null;
  }
  pinchDist = 0;
}
scene.addEventListener('pointerup', function(e){ endPointer(e, true); });
scene.addEventListener('pointercancel', function(e){ endPointer(e, false); });
scene.addEventListener('wheel', function(e){
  e.preventDefault();
  var xy = localXY(e);
  userZoom(Math.exp(-clamp(e.deltaY, -240, 240) * 0.0022), xy[0], xy[1]);
}, { passive: false });
scene.addEventListener('keydown', function(e){
  var list = listFor(group);
  var idx = list.indexOf(BY_ID[state.selected]);
  if(e.key === 'ArrowRight'){ select(list[(idx + 1) % list.length].id, true); e.preventDefault(); }
  else if(e.key === 'ArrowLeft'){ select(list[(idx + list.length - 1) % list.length].id, true); e.preventDefault(); }
  else if(e.key === '+' || e.key === '='){ userZoom(1.3, CX, CY); e.preventDefault(); }
  else if(e.key === '-' || e.key === '_'){ userZoom(1 / 1.3, CX, CY); e.preventDefault(); }
  else if(e.key === ' '){ state.playing = !state.playing; syncPlay(); e.preventDefault(); }
  else if(e.key === 'Escape' || e.key === 'Home'){ overview(); e.preventDefault(); }
});

/* ---------- Loop ---------- */
var last = performance.now(), liveTimer = 0, lastDate = '', lastNote = '', lastSb = '';
var lastSimSeen = simDays, perfAcc = 0, perfN = 0, lastFocus = '';

/* Keep each body's spin readable: above SPIN_CAP degrees per real second the spin is slowed and the lost phase is
   remembered, then eased back to the true orientation once the clock slows down or stops. */
function updateSpin(dt, dSim){
  var cap = SPIN_CAP * dt;
  for(var i = 0; i < SPIN_LIST.length; i++){
    var b = SPIN_LIST[i];
    if(b.wdot === undefined || b.type === 'moon' || b.lockTo) continue;
    var adv = b.wdot * dSim;
    if(Math.abs(adv) > cap){
      b.spinOff += (adv > 0 ? cap : -cap) - adv;
      b.spinOff = ((b.spinOff + 180) % 360 + 360) % 360 - 180;
    } else if(b.spinOff !== 0){
      var e = ((b.spinOff + 180) % 360 + 360) % 360 - 180;
      var st = clamp(-e, -120 * dt, 120 * dt);
      b.spinOff = Math.abs(e + st) < 1e-6 ? 0 : e + st;
    }
  }
}
var capUntil = 0, camPrev = { x: 0, y: 0, lz: 0 };
var SB = [];
[0.1, 0.2, 0.5, 1, 2, 5, 10, 20, 50, 100, 200, 500, 1e3, 2e3, 5e3, 1e4, 2e4, 5e4, 1e5, 2e5, 5e5, 1e6, 2e6, 5e6].forEach(function(k){
  SB.push([k / 149.598e6, k >= 1e6 ? (k / 1e6) + ' million km' : k < 1 ? Math.round(k * 1000) + ' m' : k.toLocaleString('en-US') + ' km']);
});
[[0.05,'0.05 AU'],[0.1,'0.1 AU'],[0.2,'0.2 AU'],[0.5,'0.5 AU'],[1,'1 AU'],[2,'2 AU'],[5,'5 AU'],
  [10,'10 AU'],[20,'20 AU'],[50,'50 AU'],[100,'100 AU'],[200,'200 AU'],[500,'500 AU'],[1000,'1,000 AU'],[2000,'2,000 AU'],[5000,'5,000 AU'],
  [10000,'10,000 AU'],[20000,'20,000 AU'],[LY_AU / 2,'0.5 ly'],[LY_AU,'1 ly'],[LY_AU * 2,'2 ly'],[LY_AU * 5,'5 ly'],[LY_AU * 10,'10 ly']].forEach(function(e){ SB.push(e); });

function updateLive(){
  var i, p, s, L;
  for(i = 0; i < PLANETS.length; i++){
    p = PLANETS[i]; s = orbitState(p, simDays); L = p.live;
    var rd = lerp(mapAU(s.r), s.r / U_AU, blendE);
    L.r = s.r; L.x = s.x; L.y = s.y; L.wz = 0; L.lam = s.lam;
    L.wx = rd * Math.cos(s.lam); L.wy = rd * Math.sin(s.lam);
  }
  /* The Moon: true offset in real-size mode, otherwise a path just outside the (exaggerated) Earth */
  var mv = moonKm(simDays), mm = Math.hypot(mv[0], mv[1], mv[2]), ed = EARTH.live, ml = MOON.live;
  var mk = state.scale === 'real' ? 1 / KM_U : moonOrbitPx(base * cam.zoom) / (base * cam.zoom) / mm;
  ml.wx = ed.wx + mv[0] * mk; ml.wy = ed.wy + mv[1] * mk; ml.wz = (ed.wz || 0) + mv[2] * mk;
  ml.r = ed.r; ml.x = ed.x; ml.y = ed.y; ml.lam = ed.lam; ml.km = mm;
  /* dwarf planets, on tilted orbits */
  var zpL = base * cam.zoom;
  for(i = 0; i < DWARF_LIST.length; i++){
    p = DWARF_LIST[i];
    if(p.type !== 'dwarf') continue;
    s = dwarfState(p, simDays); L = p.live;
    var rho = Math.hypot(s.x, s.y), sc = rho > 1e-9 ? mapAU(rho) / (rho / U_AU) : 1, fc = lerp(sc, 1, blendE) / U_AU;
    L.r = s.r; L.x = s.x; L.y = s.y; L.z = s.z; L.lam = s.lam;
    L.ldir = [-s.x / s.r, -s.y / s.r, -s.z / s.r];
    L.bx = s.x * fc; L.by = s.y * fc; L.bz = s.z * fc;
    L.wx = L.bx; L.wy = L.by; L.wz = L.bz;
  }
  /* the other moons, and Charon, which swings Pluto round a point outside it */
  for(i = 0; i < SATS.length; i++){
    var sm = SATS[i], st = satState(sm, simDays), pl = sm.parent.live, sl = sm.live;
    var px0 = pl.bx !== undefined ? pl.bx : pl.wx, py0 = pl.by !== undefined ? pl.by : pl.wy, pz0 = pl.bz !== undefined ? pl.bz : (pl.wz || 0);
    var sk = state.scale === 'real' ? 1 / KM_U : satR(sm, zpL) / zpL / sm.aKm;
    var sx = st.u[0] * st.r * sk, sy = st.u[1] * st.r * sk, sz = st.u[2] * st.r * sk;
    sl.u = st.u; sl.km = st.r; sl.r = pl.r; sl.x = pl.x; sl.y = pl.y; sl.lam = pl.lam;
    if(sm.binary){
      sl.wx = px0 + (1 - sm.binary) * sx; sl.wy = py0 + (1 - sm.binary) * sy; sl.wz = pz0 + (1 - sm.binary) * sz;
      pl.wx = px0 - sm.binary * sx; pl.wy = py0 - sm.binary * sy; pl.wz = pz0 - sm.binary * sz;
    } else { sl.wx = px0 + sx; sl.wy = py0 + sy; sl.wz = pz0 + sz; }
  }
  /* Alpha Centauri A and B around their barycentre */
  var M = normAngle(TAU * (simDays - AC.T0) / AC.P);
  var E = solveKepler(M, AC.e);
  var rel = acRel(Math.cos(E) - AC.e, Math.sqrt(1 - AC.e * AC.e) * Math.sin(E));
  ALPHA_A.live.wx = AC_BARY[0] - AC.fA * rel[0] / U_AU; ALPHA_A.live.wy = AC_BARY[1] - AC.fA * rel[1] / U_AU; ALPHA_A.live.wz = AC_BARY[2] - AC.fA * rel[2] / U_AU;
  ALPHA_B.live.wx = AC_BARY[0] + AC.fB * rel[0] / U_AU; ALPHA_B.live.wy = AC_BARY[1] + AC.fB * rel[1] / U_AU; ALPHA_B.live.wz = AC_BARY[2] + AC.fB * rel[2] / U_AU;
  /* Proxima's planets */
  for(i = 0; i < EXO.length; i++){
    p = EXO[i]; s = orbitState(p, simDays); L = p.live;
    L.r = s.r; L.x = s.x; L.y = s.y; L.lam = s.lam;
    L.wx = p.parent.live.wx + s.x / U_AU; L.wy = p.parent.live.wy + s.y / U_AU; L.wz = p.parent.live.wz;
  }
}
function updateDate(){
  var d = new Date(J2000 + simDays * DAY);
  var y = d.getUTCFullYear();
  var showT = SPEEDS[state.speed] <= 1.01;
  var hh = ('0' + d.getUTCHours()).slice(-2), mi = ('0' + d.getUTCMinutes()).slice(-2);
  var key = d.getUTCDate() + ' ' + MONTHS[d.getUTCMonth()] + ' ' + y + (showT ? ' ' + hh + ':' + mi : '');
  if(key === lastDate) return;
  lastDate = key;
  $('dTime').textContent = showT ? hh + ':' + mi + ' UTC' : '';
  $('dDay').textContent = d.getUTCDate() + ' ' + MONTHS[d.getUTCMonth()];
  $('dYear').textContent = y;
  var jump = $('jump');
  if(document.activeElement !== jump){
    jump.value = (y >= 1000 && y <= 9999) ? d.toISOString().slice(0, 10) : '';
  }
}
function updateHud(){
  var zp = base * cam.zoom;
  var f = (VMAX - Math.log10(clamp(cam.zoom, MINZ, Math.pow(10, VMAX)))) / (VMAX - VMIN);
  lThumb.style.top = (clamp(f, 0, 1) * 100) + '%';
  var span = fmtSpan(SPAN_K / cam.zoom);
  if(lRead.textContent !== span){ lRead.textContent = span; lThumb.setAttribute('aria-valuenow', String(Math.round(clamp(1 - f, 0, 1) * 100))); lThumb.setAttribute('aria-valuetext', span + ' across'); }

  var note, far = Math.abs(cam.x) + Math.abs(cam.y) + Math.abs(cam.z) > 2;
  var sel = BY_ID[state.selected];
  if(state.scale === 'real'){
    note = sel.R && sel.R / KM_U * zp < 3 ? 'Real size 1:1 at true distances. Planets are specks at this zoom, so pick one to fly in.' : 'Real size 1:1, at true distances. Every radius is to scale.';
  } else if(far || lowZoom) note = 'Distances to scale. Star and planet sizes are exaggerated.';
  else if(following && sel.R && bodyPx(sel, zp) > 0.12 * FM) note = 'Close-up of ' + sel.name + '. Sizes are exaggerated here, so try Real size 1:1 to compare true proportions.';
  else if(state.scale === 'true' || highZoom) note = 'Distances to scale. Zoom in to find the inner planets. Sizes exaggerated.';
  else note = 'Orbit spacing compressed so every planet fits. Sizes exaggerated.';
  if(note !== lastNote){ lastNote = note; $('scaleNote').textContent = note; }
  var fl = following && !flight ? 'Viewing ' + sel.name + '. ' + (capUntil > performance.now() ? 'Speed held at ' + SPEED_LABELS[state.speed] + ' so its orbit stays easy to follow.' : 'Drag to pan, scroll to zoom.') : '';
  if(fl !== lastFocus){ lastFocus = fl; $('focusLine').textContent = fl; }

  var bar = $('scaleBar');
  if(blendE < 0.5){ bar.hidden = true; }
  else {
    bar.hidden = false;
    var pick = SB[0];
    for(var i = 0; i < SB.length; i++){ if(SB[i][0] / U_AU * zp <= 110) pick = SB[i]; }
    var px = pick[0] / U_AU * zp;
    $('sbLine').style.width = Math.max(2, px) + 'px';
    if(pick[1] !== lastSb){ lastSb = pick[1]; $('sbLabel').textContent = pick[1]; }
  }
}
function frame(now){
  var dtRaw = (now - last) / 1000, dt = Math.min(0.05, dtRaw); last = now;
  /* Following a moon (or Pluto, which turns with Charon) at a fast clock would swing the whole view round several times a second, so hold the clock to a gentle rate. */
  var fsel = (following || (flight && flight.follow)) ? BY_ID[state.selected] : null;
  if(fsel){
    var per = fsel.type === 'moon' ? (fsel.P || fsel.period) : fsel.lockTo ? fsel.lockTo.P : 0;
    if(per){
      var cap = 0;
      for(var ci = 0; ci < SPEEDS.length; ci++){ if(SPEEDS[ci] * 6 <= per) cap = ci; }
      if(state.speed > cap){
        state.speed = cap; $('speed').value = String(cap); $('speedOut').textContent = SPEED_LABELS[cap];
        capUntil = now + 5000;
      }
    }
  }
  /* ease the view centre toward the middle of the area the floating panels leave free */
  if(window.UI && UI.sample){
    var sm = UI.sample(), kk = reduceMotion ? 1 : 1 - Math.exp(-dt * 12);
    insR += (sm.r - insR) * kk; insB += (sm.b - insB) * kk; insT += (sm.t - insT) * kk;
    if(Math.abs(sm.r - insR) < 0.3) insR = sm.r; if(Math.abs(sm.b - insB) < 0.3) insB = sm.b; if(Math.abs(sm.t - insT) < 0.3) insT = sm.t;
    CX = (W - insR) / 2; CY = (insT + H - insB) / 2;
    UI.setInset(insB);
  }
  stepZoom(dt);
  if(coast.vx || coast.vy){
    pan(coast.vx * dt, coast.vy * dt);
    var dec = Math.exp(-dt * 3.4);
    coast.vx *= dec; coast.vy *= dec;
    if(Math.hypot(coast.vx, coast.vy) < 14) coast.vx = coast.vy = 0;
  }
  if(state.playing) simDays += SPEEDS[state.speed] * dt;
  var dSim = simDays - lastSimSeen; lastSimSeen = simDays;
  updateSpin(dt, dSim);
  visTime += clamp(dSim, -3 * dt, 3 * dt);

  if(cam.zoom < 0.45) lowZoom = true; else if(cam.zoom > 0.75) lowZoom = false;
  if(cam.zoom > 16) highZoom = true; else if(cam.zoom < 11) highZoom = false;
  trueCtx = state.scale !== 'compressed' || lowZoom || highZoom || (Math.abs(cam.x) + Math.abs(cam.y) + Math.abs(cam.z) > 2);
  var goal = trueCtx ? 1 : 0;
  blend = reduceMotion ? goal : blend + clamp(goal - blend, -dt * 1.5, dt * 1.5);
  blendE = blend * blend * (3 - 2 * blend);

  updateLive();

  if(tiltGoal !== null){
    var dtl = tiltGoal - state.tilt;
    state.tilt = Math.abs(dtl) < 0.05 ? tiltGoal : state.tilt + dtl * Math.min(1, dt * 2.4);
    if(state.tilt === tiltGoal) tiltGoal = null;
    $('tilt').value = String(Math.round(state.tilt)); $('tiltOut').textContent = Math.round(state.tilt) + '°';
  }

  if(flight){
    flight.t += dt;
    var u = clamp(flight.t / flight.dur, 0, 1);
    var s = u * u * (3 - 2 * u);
    var d = flight.dest();
    cam.x = lerp(flight.fx, d.x, s); cam.y = lerp(flight.fy, d.y, s); cam.z = lerp(flight.fz, d.z, s);
    var lz0 = Math.log(flight.fzoom), lz1 = Math.log(flight.z1);
    var dist = Math.hypot(d.x - flight.fx, d.y - flight.fy, d.z - flight.fz);
    var lzFit = Math.max(Math.log(MINZ * 1.2), Math.log(1.11 / (Math.max(dist, 1e-9) * 0.62)));
    var boost = lzFit < Math.min(lz0, lz1) ? (lz0 + lz1) / 2 - lzFit : 0;
    cam.zoom = Math.exp(lerp(lz0, lz1, s) - boost * Math.sin(Math.PI * s));
    if(u >= 1){ following = flight.follow; flight = null; }
  } else if(following){
    var tb = BY_ID[state.selected];
    cam.x = tb.live.wx; cam.y = tb.live.wy; cam.z = tb.live.wz || 0;
  }

  /* the star field drifts at a fraction of the camera's own motion, so it reads as far away */
  var zpP = base * cam.zoom, lzP = Math.log(cam.zoom);
  var mdx = clamp((camPrev.x - cam.x) * zpP, -70, 70), mdy = clamp(-(camPrev.y - cam.y) * zpP * sinT(), -70, 70);
  if(mdx || mdy || Math.abs(lzP - camPrev.lz) > 1e-4){
    par.x += mdx; par.y += mdy; par.z = clamp(lzP, -14, 14);
    par.dirty = true;
  }
  camPrev.x = cam.x; camPrev.y = cam.y; camPrev.lz = lzP;
  if(par.dirty) drawStars();

  glBig = false;
  draw();
  if(glBig && GLOK && glQ > 0.5){
    perfAcc += dtRaw; perfN++;
    if(perfN >= 45){
      if(perfAcc / perfN > 0.036){ glQ = Math.max(0.5, glQ * 0.8); layout(); }
      perfAcc = 0; perfN = 0;
    }
  } else { perfAcc = 0; perfN = 0; }
  updateDate();
  updateHud();
  liveTimer += dt;
  if(liveTimer > 0.25){ liveTimer = 0; updateNow(); }
  requestAnimationFrame(frame);
}

var hash = location.hash.replace('#', '');
if(BY_ID[hash]){ state.selected = hash; group = BY_ID[hash].group; }
buildChips();
syncTabs();
syncPlay();
updateLive();
if(BY_ID[hash]){
  var hb = BY_ID[hash];
  cam.zoom = clamp(focusZoom(hash), MINZ, maxZoom());
  cam.x = hb.live.wx; cam.y = hb.live.wy; cam.z = hb.live.wz || 0;
  following = true;
  if(isWorld(hb)){ state.tilt = closeTilt(hb); $('tilt').value = String(state.tilt); $('tiltOut').textContent = state.tilt + '°'; }
  else if(hb.type === 'oort'){ state.tilt = 50; $('tilt').value = '50'; $('tiltOut').textContent = '50°'; }
}
renderPanel();
if(!BY_ID[hash] && !reduceMotion){
  /* opening shot: start high and far, then settle onto the overview */
  state.tilt = 86; cam.zoom = 0.2; $('tilt').value = '86'; $('tiltOut').textContent = '86°';
  startFlight(function(){ return { x: 0, y: 0, z: 0 }; }, 1, false);
  flight.dur = 3.2; tiltGoal = 58;
}
requestAnimationFrame(frame);
})();
