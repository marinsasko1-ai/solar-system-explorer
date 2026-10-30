/* Shared GLSL for the planet renderer: vertex shader, uniform head, noise library and the ellipsoid/ring/halo main(). */
window.PGL_SRC = (function () {
  var vert = '#version 300 es\nin vec2 a_pos;\nvoid main(){ gl_Position = vec4(a_pos, 0., 1.); }\n';

  var head = [
    '#version 300 es',
    'precision highp float;',
    'precision highp int;',
    'precision highp sampler2D;',
    'uniform vec2 u_res;',      // GL canvas size in px
    'uniform vec2 u_center;',   // body centre in px (top-left origin)
    'uniform float u_radius;',  // equatorial radius in px
    'uniform float u_flat;',    // polar / equatorial radius
    'uniform float u_by;',      // y semi-axis / x semi-axis (1 for round and oblate bodies, less for triaxial ones)
    'uniform mat3 u_rot;',      // columns: body X (prime meridian), Y (east), Z (north) in view space
    'uniform vec3 u_L;',        // unit vector towards the Sun in view space
    'uniform float u_night;',   // 1 = real day/night lighting, 0 = fully lit
    'uniform float u_time;',    // simulated days (cloud drift, granulation)
    'uniform vec4 u_ring;',     // inner, outer (equatorial radii), opacity scale, enabled
    'uniform vec4 u_halo;',     // rgb colour, thickness (fraction of radius)
    'uniform vec3 u_tint;',
    'uniform float u_seed;',
    'uniform float u_emit;',    // 1 for the Sun
    'uniform sampler2D u_map;',
    'out vec4 outColor;',
    ''
  ].join('\n');

  var noise = [
    'const float PI = 3.14159265359;',
    'float hash13(vec3 p){ p = fract(p*.1031); p += dot(p, p.zyx+31.32); return fract((p.x+p.y)*p.z); }',
    'vec3 hash33(vec3 p){ p = fract(p*vec3(.1031,.1030,.0973)); p += dot(p, p.yxz+33.33); return fract((p.xxy+p.yxx)*p.zyx); }',
    'float hash11(float x){ x = fract(x*.1031); x *= x+33.33; x *= x+x; return fract(x); }',
    // gradient noise, range about -0.9..0.9
    'float gn(vec3 p){',
    '  vec3 i = floor(p), f = fract(p);',
    '  vec3 u = f*f*f*(f*(f*6.-15.)+10.);',
    '  float a = dot(hash33(i)*2.-1., f);',
    '  float b = dot(hash33(i+vec3(1.,0.,0.))*2.-1., f-vec3(1.,0.,0.));',
    '  float c = dot(hash33(i+vec3(0.,1.,0.))*2.-1., f-vec3(0.,1.,0.));',
    '  float d = dot(hash33(i+vec3(1.,1.,0.))*2.-1., f-vec3(1.,1.,0.));',
    '  float e = dot(hash33(i+vec3(0.,0.,1.))*2.-1., f-vec3(0.,0.,1.));',
    '  float g = dot(hash33(i+vec3(1.,0.,1.))*2.-1., f-vec3(1.,0.,1.));',
    '  float h = dot(hash33(i+vec3(0.,1.,1.))*2.-1., f-vec3(0.,1.,1.));',
    '  float k = dot(hash33(i+vec3(1.,1.,1.))*2.-1., f-vec3(1.,1.,1.));',
    '  return mix(mix(mix(a,b,u.x),mix(c,d,u.x),u.y), mix(mix(e,g,u.x),mix(h,k,u.x),u.y), u.z);',
    '}',
    // fractal noise with fractional octave count (no popping), range about 0..1
    'float fbm(vec3 p, float oct){',
    '  float s = 0., w = 0., a = .5;',
    '  for(int i=0;i<10;i++){',
    '    float k = clamp(oct-float(i), 0., 1.);',
    '    if(k <= 0.) break;',
    '    s += a*k*gn(p); w += a*k;',
    '    p = p*2.03 + vec3(11.7,3.3,7.1); a *= .5;',
    '  }',
    '  return .5 + .55*s/max(w,1e-4);',
    '}',
    // octaves worth computing for a feature of base frequency f at the current on-screen size
    'float OC(float f){ return clamp(log2(max(u_radius*.6,1.)) - log2(f), 0., 8.); }',
    'vec3 L2(vec3 c){ return pow(c, vec3(2.2)); }',
    'float wrapd(float d, float w){ return clamp((d+w)/(1.+w), 0., 1.); }',
    'vec3 ll(float lat, float lon){ lat = radians(lat); lon = radians(lon); return vec3(cos(lat)*cos(lon), cos(lat)*sin(lon), sin(lat)); }',
    // soft round patch of angular radius rad (degrees) around unit vector c
    'float blob(vec3 p, vec3 c, float rad){ float cr = cos(radians(rad)); return smoothstep(cr, mix(cr,1.,.75), dot(p,c)); }',
    'float wrapPi(float a){ return a - 2.*PI*floor((a+PI)/(2.*PI)); }',
    'mat2 rot2(float a){ float c = cos(a), s = sin(a); return mat2(c,-s,s,c); }',
    // cellular noise: x = distance to nearest feature, y = distance to second nearest
    'vec2 vor(vec3 p){',
    '  vec3 ip = floor(p), fp = fract(p);',
    '  float d1 = 9., d2 = 9.;',
    '  for(int x=-1;x<=1;x++) for(int y=-1;y<=1;y++) for(int z=-1;z<=1;z++){',
    '    vec3 o = vec3(float(x),float(y),float(z));',
    '    vec3 r = o + hash33(ip+o) - fp;',
    '    float d = dot(r,r);',
    '    if(d < d1){ d2 = d1; d1 = d; } else if(d < d2){ d2 = d; }',
    '  }',
    '  return vec2(sqrt(d1), sqrt(d2));',
    '}',
    // 1-D noise for ring structure
    'float n1(float x){ float i = floor(x), f = fract(x); f = f*f*(3.-2.*f); return mix(hash11(i), hash11(i+1.), f); }',
    ''
  ].join('\n');

  // Used by bodies that have no rings.
  var noRing = [
    'float ringTau(float rho, float fw){ return 0.; }',
    'vec3 ringAlb(float rho){ return vec3(0.); }',
    ''
  ].join('\n');

  var main = [
    'void main(){',
    '  vec2 frag = vec2(gl_FragCoord.x, u_res.y - gl_FragCoord.y);',
    '  vec2 q = (frag - u_center)/u_radius; q.y = -q.y;',
    '  mat3 Rt = transpose(u_rot);',
    '  vec3 ob = Rt*vec3(q, 6.), db = Rt*vec3(0.,0.,-1.);',
    '  vec3 s = vec3(1.,1./u_by,1./u_flat);',
    '  vec3 o2 = ob*s, d2 = db*s;',
    '  float A = dot(d2,d2), B = dot(o2,d2), C = dot(o2,o2) - 1.;',
    '  float disc = B*B - A*C;',
    '  float fwd = fwidth(disc);',
    '  float cov = clamp(.5 + disc/max(fwd,1e-6), 0., 1.);',
    '  float t = (-B - sqrt(max(disc,0.)))/A;',
    '  vec3 p2 = o2 + t*d2;',
    '  vec3 pb = ob + t*db;',
    '  vec3 n = normalize(p2*s);',
    '  vec3 Lb = normalize(Rt*u_L), Vb = Rt*vec3(0.,0.,1.);',
    '  bool dn = u_night > .5;',
    // ring plane intersection (computed everywhere so derivatives stay in uniform control flow)
    '  float dz = abs(db.z) > 1e-5 ? db.z : 1e-5;',
    '  float tr = -ob.z/dz;',
    '  vec3 qb = ob + tr*db;',
    '  float rho = length(qb.xy);',
    '  float fwr = fwidth(rho);',
    '  float sh = 1.;',
    '  if(u_ring.w > .5 && dn && abs(Lb.z) > 1e-3){',
    '    float tz = -pb.z/Lb.z;',
    '    if(tz > 0.){ float rr = length((pb + tz*Lb).xy); if(rr > u_ring.x && rr < u_ring.y) sh = exp(-ringTau(rr, .02)*u_ring.z/max(abs(Lb.z),.05)); }',
    '  }',
    '  vec3 pc = surf(p2, n, Lb, Vb, sh)*L2(u_tint);',
    // ring
    '  vec3 qs = qb*s, Ls = Lb*s;',
    '  float a2 = dot(Ls,Ls), b2 = dot(qs,Ls), c2 = dot(qs,qs) - 1.;',
    '  float d3 = b2*b2 - a2*c2;',
    '  float ts = (-b2 - sqrt(max(d3,0.)))/a2;',
    '  float fw3 = fwidth(d3);',
    '  float inS = (dn && ts > 0.) ? clamp(.5 + d3/max(fw3,1e-4), 0., 1.) : 0.;',
    '  float rA = 0.; vec3 rC = vec3(0.);',
    '  if(u_ring.w > .5 && rho > u_ring.x && rho < u_ring.y){',
    '    float tau = ringTau(rho, fwr)*u_ring.z;',
    '    float az = max(abs(db.z), .03);',
    '    rA = 1. - exp(-tau/az);',
    '    vec3 alb = L2(ringAlb(rho));',
    '    float lz = max(abs(Lb.z), .03);',
    '    float direct = 1. - inS;',
    '    bool same = Lb.z*Vb.z > 0.;',
    '    float trans = exp(-tau/lz);',
    '    rC = (same ? alb*direct*1.25 : alb*direct*trans*.7) + alb*.012;',
    '  }',
    '  vec3 oc; float oa;',
    '  if(tr < t){ oc = rC*rA + pc*cov*(1.-rA); oa = rA + cov*(1.-rA); }',
    '  else { oc = pc*cov + rC*rA*(1.-cov); oa = cov + rA*(1.-cov); }',
    // atmospheric / coronal halo outside the limb
    '  if(u_halo.a > 0.){',
    '    vec3 zv = u_rot[2];',
    '    float bz = sqrt(zv.z*zv.z + u_flat*u_flat*(1. - zv.z*zv.z));',
    '    vec2 e1 = length(zv.xy) > 1e-4 ? normalize(zv.xy) : vec2(0., 1.);',
    '    float rr = length(vec2(dot(q, e1)/bz, dot(q, vec2(-e1.y, e1.x))));',
    '    float hh = max(rr - 1., 0.)/u_halo.a;',
    '    vec3 nrm = normalize(vec3(q, 0.));',
    '    float lit = u_emit > .5 ? 1. : (dn ? clamp(dot(nrm, u_L)*.85 + .3, 0., 1.) : .7);',
    '    float g = (u_emit > .5 ? 1.0 : .55)*exp(-hh*(u_emit > .5 ? 3.6 : 4.5))*(1. - smoothstep(u_emit > .5 ? .5 : .9, 1., hh))*lit;',
    '    g *= 1. - cov;',
    '    oc += L2(u_halo.rgb)*g*(1. - oa);',
    '    oa += g*(1. - oa);',
    '  }',
    '  vec3 st = oc/max(oa, 1e-4);',
    '  st = pow(clamp(st, 0., 1.), vec3(1./2.2));',
    '  outColor = vec4(st*oa, oa);',
    '}',
    ''
  ].join('\n');

  return { vert: vert, head: head, noise: noise, noRing: noRing, main: main, kinds: {} };
})();
