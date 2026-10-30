/* Interface behaviour: glass light, sliding segmented controls, slider fills, the View popover,
   the phone bottom sheet (peek / half / full), and the entrance animation of the inspector.
   The renderer in app.js reads UI.sample() each frame so the view stays centred in the space the panels leave free. */
(function(){
'use strict';
var $ = function(id){ return document.getElementById(id); };
function clamp(v, a, b){ return Math.max(a, Math.min(b, v)); }
var mq = window.matchMedia('(max-width: 760px)');
var app = $('app'), panel = $('panel'), scroll = $('panelScroll'), bar = $('bar'), chips = $('chips'), grab = $('grab');
var pop = $('viewPop'), viewBtn = $('viewBtn'), sheetCtl = $('sheetControls');
var UI = window.UI = { detent: 'peek', mobile: mq.matches };

/* ---------- Light that follows the pointer across glass ---------- */
var lit = null;
document.addEventListener('pointermove', function(e){
  if(e.pointerType !== 'mouse') return;
  var g = e.target.closest ? e.target.closest('.glass') : null;
  if(lit && lit !== g) lit.style.setProperty('--lit', '0');
  if(g){
    var r = g.getBoundingClientRect();
    g.style.setProperty('--mx', (e.clientX - r.left) + 'px');
    g.style.setProperty('--my', (e.clientY - r.top) + 'px');
    g.style.setProperty('--lit', '1');
  }
  lit = g;
}, { passive: true });
document.addEventListener('pointerleave', function(){ if(lit){ lit.style.setProperty('--lit', '0'); lit = null; } });

/* ---------- Segmented controls: the thumb slides to the pressed button ---------- */
function syncSeg(s){
  var on = s.querySelector('[aria-pressed="true"]');
  if(!on || !on.offsetWidth) return;
  s.style.setProperty('--x', on.offsetLeft + 'px');
  s.style.setProperty('--w', on.offsetWidth + 'px');
}
[].slice.call(document.querySelectorAll('.seg')).forEach(function(s){
  syncSeg(s);
  new MutationObserver(function(){ syncSeg(s); }).observe(s, { subtree: true, attributes: true, attributeFilter: ['aria-pressed'] });
  if(window.ResizeObserver) new ResizeObserver(function(){ syncSeg(s); }).observe(s);
  requestAnimationFrame(function(){ requestAnimationFrame(function(){ syncSeg(s); s.classList.add('ready'); }); });
});

/* ---------- Slider fill (the track behind the thumb is painted with the accent) ---------- */
var ranges = [$('speed'), $('tilt')], lastVal = [null, null];
function fillRange(r){
  var min = +r.min || 0, max = +r.max || 100;
  r.style.setProperty('--p', ((+r.value - min) / (max - min) * 100) + '%');
}
(function loop(){
  for(var i = 0; i < ranges.length; i++){
    if(ranges[i].value !== lastVal[i]){ lastVal[i] = ranges[i].value; fillRange(ranges[i]); }
  }
  requestAnimationFrame(loop);
})();

/* ---------- View popover (desktop) ---------- */
var popOpen = false;
function setPop(open){
  popOpen = !!open && !mq.matches;
  pop.classList.toggle('open', popOpen);
  viewBtn.setAttribute('aria-expanded', popOpen ? 'true' : 'false');
  if(mq.matches || popOpen) pop.removeAttribute('inert'); else pop.setAttribute('inert', '');
}
viewBtn.addEventListener('click', function(){ setPop(!popOpen); });
document.addEventListener('pointerdown', function(e){
  if(popOpen && !pop.contains(e.target) && !viewBtn.contains(e.target)) setPop(false);
});
document.addEventListener('keydown', function(e){
  if(e.key === 'Escape' && popOpen){ setPop(false); viewBtn.focus(); }
});

/* ---------- Phone bottom sheet ---------- */
var sh = UI._sheet = { y: 0, ys: { peek: 0, half: 0, full: 0 }, peekVis: 250, detent: 'peek', drag: null };
function safeBottom(){ return parseFloat(getComputedStyle(scroll).paddingBottom) || 0; }
function setY(y){ sh.y = y; panel.style.setProperty('--sy', Math.round(y * 10) / 10 + 'px'); }
function setDetent(name){
  if(name !== sh.detent && window.nativeTick) window.nativeTick('LIGHT');
  sh.detent = name; UI.detent = name;
  app.setAttribute('data-detent', name);
  panel.classList.remove('d-peek', 'd-half', 'd-full');
  panel.classList.add('d-' + name);
  grab.setAttribute('aria-label', 'Panel is ' + (name === 'peek' ? 'minimised' : name === 'half' ? 'half open' : 'fully open') + '. Activate to change.');
  if(mq.matches) setY(sh.ys[name]);
  if(name === 'peek') setTimeout(function(){ if(sh.detent === 'peek') scroll.scrollTo({ top: 0 }); }, 350);
}
function measure(){
  if(!mq.matches) return;
  var h = panel.offsetHeight;
  var peekVis = Math.round(grab.offsetHeight + chips.offsetTop + chips.offsetHeight + 16 + safeBottom());
  var halfVis = Math.max(Math.round(app.clientHeight * 0.56), peekVis + 150);
  sh.peekVis = peekVis;
  sh.ys.full = 0;
  sh.ys.half = Math.max(0, h - halfVis);
  sh.ys.peek = Math.max(sh.ys.half, h - peekVis);
  if(!sh.drag) setY(sh.ys[sh.detent]);
}
function cycle(){ setDetent(sh.detent === 'peek' ? 'half' : sh.detent === 'half' ? 'full' : 'peek'); }
function rubber(y){
  var lo = sh.ys.full, hi = sh.ys.peek;
  if(y < lo) return lo + (y - lo) * 0.28;
  if(y > hi) return hi + (y - hi) * 0.3;
  return y;
}
function moveTo(d, clientY){
  setY(rubber(d.s0 + (clientY - d.y0)));
  var now = performance.now(), dt = now - d.lastT;
  if(dt > 0) d.v = d.v * 0.5 + ((clientY - d.lastY) / dt * 1000) * 0.5;
  d.lastY = clientY; d.lastT = now;
}
function endDrag(e){
  var d = sh.drag;
  if(!d || (e && d.id !== e.pointerId)) return;
  sh.drag = null;
  panel.classList.remove('dragging');
  if(!d.captured) return;
  if(performance.now() - d.lastT > 90) d.v = 0;
  var proj = sh.y + clamp(d.v, -2600, 2600) * 0.2, best = 'peek', bd = 1e9;
  ['peek', 'half', 'full'].forEach(function(n){ var dd = Math.abs(sh.ys[n] - proj); if(dd < bd){ bd = dd; best = n; } });
  setDetent(best);
}
function dragZone(t){
  if(!mq.matches) return false;
  if(t.closest('input,textarea,.num,#chips')) return false;
  if(t.closest('#grab,.head,.tabs')) return true;
  return sh.detent === 'peek';
}
panel.addEventListener('pointerdown', function(e){
  if(!dragZone(e.target) || (e.pointerType === 'mouse' && e.button)) return;
  sh.drag = { id: e.pointerId, y0: e.clientY, s0: sh.y, lastY: e.clientY, lastT: performance.now(), v: 0, moved: 0, captured: false };
});
window.addEventListener('pointermove', function(e){
  var d = sh.drag;
  if(!d || d.id !== e.pointerId) return;
  d.moved = Math.max(d.moved, Math.abs(e.clientY - d.y0));
  if(!d.captured && d.moved > 6){
    d.captured = true; panel.classList.add('dragging');
    try { panel.setPointerCapture(e.pointerId); } catch(err){}
  }
  if(d.captured) moveTo(d, e.clientY);
});
window.addEventListener('pointerup', endDrag);
window.addEventListener('pointercancel', endDrag);
grab.addEventListener('click', cycle);
grab.addEventListener('keydown', function(e){
  if(e.key === 'Escape'){ setDetent('peek'); }
  else if(e.key === 'ArrowUp'){ setDetent(sh.detent === 'peek' ? 'half' : 'full'); e.preventDefault(); }
  else if(e.key === 'ArrowDown'){ setDetent(sh.detent === 'full' ? 'half' : 'peek'); e.preventDefault(); }
});
/* Pulling the content down while it is scrolled to the top hands the gesture to the sheet. */
var tp = null;
scroll.addEventListener('touchstart', function(e){ tp = (mq.matches && e.touches.length === 1) ? { y: e.touches[0].clientY, drag: false } : null; }, { passive: true });
scroll.addEventListener('touchmove', function(e){
  if(!tp) return;
  var y = e.touches[0].clientY;
  if(!tp.drag && scroll.scrollTop <= 0 && y - tp.y > 8 && sh.detent !== 'peek'){
    tp.drag = true;
    sh.drag = { id: -1, y0: y, s0: sh.y, lastY: y, lastT: performance.now(), v: 0, moved: 99, captured: true };
    panel.classList.add('dragging');
  }
  if(tp.drag){ e.preventDefault(); moveTo(sh.drag, y); }
}, { passive: false });
function touchDone(){ if(tp && tp.drag) endDrag(null); tp = null; }
scroll.addEventListener('touchend', touchDone);
scroll.addEventListener('touchcancel', touchDone);

/* ---------- Where the controls live ---------- */
function place(){
  var m = mq.matches;
  UI.mobile = m;
  document.documentElement.classList.toggle('is-mobile', m);
  (m ? sheetCtl : app).appendChild(bar);
  setPop(false);
  measure();
  if(!m){ panel.style.removeProperty('--sy'); panel.classList.remove('dragging'); }
  else setY(sh.ys[sh.detent]);
  window.dispatchEvent(new Event('resize'));
}
if(mq.addEventListener) mq.addEventListener('change', place); else mq.addListener(place);
window.addEventListener('resize', measure);
if(window.ResizeObserver){ new ResizeObserver(measure).observe(panel); new ResizeObserver(measure).observe(chips); }

/* ---------- Inspector entrance when another body is chosen ---------- */
var panelIn = $('panelIn'), nameEl = $('pName'), lastName = nameEl.textContent;
function enter(){
  panelIn.classList.remove('enter');
  void panelIn.offsetWidth;
  panelIn.classList.add('enter');
}
new MutationObserver(function(){
  var t = nameEl.textContent;
  if(t === lastName) return;
  lastName = t;
  enter();
  scroll.scrollTo({ top: 0 });
  if(mq.matches && sh.detent === 'full') setDetent('half');
}).observe(nameEl, { childList: true, characterData: true, subtree: true });

/* ---------- API used by the renderer and the native shell ---------- */
UI.staticInset = function(){
  if(mq.matches) return { r: 0, t: 72, b: sh.peekVis };
  return { r: Math.max(0, app.clientWidth - panel.offsetLeft + 8), t: 0, b: 110 };
};
UI.sample = function(){
  if(mq.matches){
    var a = app.getBoundingClientRect(), p = panel.getBoundingClientRect();
    return { r: 0, t: 72, b: clamp(a.bottom - p.top, 0, a.height * 0.56) };
  }
  return { r: Math.max(0, app.clientWidth - panel.offsetLeft + 8), t: 0, b: 110 };
};
var lastInset = -1;
UI.setInset = function(b){
  if(Math.abs(b - lastInset) < 0.5) return;
  lastInset = b;
  app.style.setProperty('--inset-b', Math.round(b) + 'px');
};
/* Back gesture or button: close what is open before leaving the current view. */
UI.back = function(){
  if(popOpen){ setPop(false); return true; }
  if(mq.matches && sh.detent !== 'peek'){ setDetent('peek'); return true; }
  return false;
};

setPop(false);
setDetent('peek');
place();
})();
