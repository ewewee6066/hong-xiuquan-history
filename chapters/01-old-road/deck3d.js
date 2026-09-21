/* ==========================================================================
   deck3d.js — 3D 交互引擎（静场版：厚重、内敛、少动）
   · 鼠标视差景深：幅度很小、速度很慢（.d3-scene，无鼠标时几乎静止）
   · 玉玺立方：不再连续自转，而是极慢地来回转一个角度，可拖拽
   · 浮尘：自绘极慢微粒（.d3-dust），像老照片里的尘埃，而不是粒子特效
   · 封王墨字：一排排"王"字慢慢渗出来并留在纸上（.d3-inkledger）
   · 巨字：像写字一样一个字一个字显影（[data-brush]）
   依赖：assets/runtime.js 负责翻页并把 .is-active 加到当前页。
   ========================================================================== */
(function () {
  'use strict';

  const REDUCED = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const CAPTURE = document.documentElement.classList.contains('capture');
  const scenes  = Array.from(document.querySelectorAll('.d3-scene'));
  const cubes   = Array.from(document.querySelectorAll('[data-cube]'));
  const spots   = Array.from(document.querySelectorAll('.d3-spot'));

  /* 静态捕获模式（?static=1）：不启动任何逐帧动画，数字直接给终值，
     让无头截图可复现。 */
  if (CAPTURE) {
    const counters = document.querySelectorAll('.counter');
    for (const c of counters) {
      c.textContent = c.getAttribute('data-to') || c.textContent;
      c.classList.remove('counter');
    }
  }

  /* ---------------------------------------------------------- 指针跟踪 */
  const pointer = { x: 0, y: 0, tx: 0, ty: 0, active: false };
  window.addEventListener('pointermove', function (e) {
    pointer.tx = (e.clientX / window.innerWidth) * 2 - 1;
    pointer.ty = (e.clientY / window.innerHeight) * 2 - 1;
    pointer.active = true;
    const px = (e.clientX / window.innerWidth) * 100;
    const py = (e.clientY / window.innerHeight) * 100;
    for (const s of spots) { s.style.setProperty('--sx', px + '%'); s.style.setProperty('--sy', py + '%'); }
  }, { passive: true });

  function activeSlide() { return document.querySelector('.slide.is-active') || document.querySelector('.slide'); }
  function ease(cur, target, k) { return cur + (target - cur) * k; }
  function rand(a, b) { return a + Math.random() * (b - a); }

  /* ------------------------------------------------------- 场景视差循环 */
  function frame(t) {
    const s = t / 1000;
    pointer.x = ease(pointer.x, pointer.active ? pointer.tx : 0, 0.02);
    pointer.y = ease(pointer.y, pointer.active ? pointer.ty : 0, 0.02);

    const slide = activeSlide();
    for (const scene of scenes) {
      const on = slide && scene.closest('.slide') === slide;
      if (!on) continue;
      const amp = parseFloat(scene.getAttribute('data-tilt') || '3');
      /* 无鼠标时也留一点几乎察觉不到的呼吸感 */
      const idleY = Math.sin(s * 0.055) * amp * 0.35;
      const idleX = Math.cos(s * 0.043) * amp * 0.22;
      const ry = pointer.x * amp + idleY;
      const rx = -pointer.y * amp * 0.55 + idleX;
      scene.style.setProperty('--ry', ry.toFixed(3) + 'deg');
      scene.style.setProperty('--rx', rx.toFixed(3) + 'deg');
    }

    /* 玉玺：极慢地左右转动，像在案上被端详，而不是一个转起来的方块 */
    for (const cube of cubes) {
      const on = slide && cube.closest('.slide') === slide;
      if (CAPTURE) {
        if (!cube.dataset.captured) { cube.dataset.spin = '22'; cube.dataset.captured = '1'; }
      } else if (!REDUCED) {
        const drag = parseFloat(cube.dataset.dragoff || '0');
        const target = (on ? Math.sin(s * 0.11) * 24 : 0) + drag;
        cube.dataset.spin = String(ease(parseFloat(cube.dataset.spin || '0'), target, 0.022));
      }
      const tiltX = ease(parseFloat(cube.dataset.tiltx || '-12'), -12 - pointer.y * 4, 0.03);
      cube.dataset.tiltx = String(tiltX);
      cube.style.transform = 'rotateX(' + tiltX.toFixed(2) + 'deg) rotateY(' +
        (parseFloat(cube.dataset.spin || '0') + pointer.x * 5).toFixed(2) + 'deg)';
    }
    requestAnimationFrame(frame);
  }
  if (!CAPTURE) requestAnimationFrame(frame);

  /* ------------------------------------------------------- 立方拖拽旋转 */
  for (const cube of cubes) {
    const host = cube.closest('.d3-cube-host') || cube.parentElement;
    let dragging = false, lastX = 0;
    host.style.touchAction = 'none';
    host.addEventListener('pointerdown', function (e) {
      dragging = true; lastX = e.clientX;
      host.setPointerCapture && host.setPointerCapture(e.pointerId);
    });
    host.addEventListener('pointermove', function (e) {
      if (!dragging) return;
      const dx = e.clientX - lastX; lastX = e.clientX;
      cube.dataset.dragoff = String(parseFloat(cube.dataset.dragoff || '0') + dx * 0.35);
      cube.dataset.spin = String(parseFloat(cube.dataset.spin || '0') + dx * 0.35);
    });
    const up = function () { dragging = false; };
    host.addEventListener('pointerup', up);
    host.addEventListener('pointercancel', up);
  }

  /* ------------------------------------------------------------- 浮尘 */
  function initDust(host) {
    if (CAPTURE || REDUCED) return;
    const cv = document.createElement('canvas');
    cv.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;pointer-events:none;display:block';
    host.appendChild(cv);
    const ctx = cv.getContext('2d');
    let w = 0, h = 0;
    function fit() {
      w = cv.clientWidth; h = cv.clientHeight;
      cv.width = w; cv.height = h;
    }
    fit();
    const count = parseInt(host.getAttribute('data-dust') || '42', 10);
    const motes = [];
    for (let i = 0; i < count; i++) {
      motes.push({
        x: Math.random() * 1, y: Math.random() * 1,
        r: rand(0.7, 2.2),
        vx: rand(-2.2, 3.4),        /* px / 秒，极慢 */
        vy: rand(-5.5, -1.4),
        a: rand(0.05, 0.16),
        ph: Math.random() * 6.28
      });
    }
    let last = performance.now();
    function tick(now) {
      const dt = Math.min(0.05, (now - last) / 1000); last = now;
      if (cv.clientWidth !== w || cv.clientHeight !== h) fit();
      ctx.clearRect(0, 0, w, h);
      for (const m of motes) {
        m.x += (m.vx * dt) / w;
        m.y += (m.vy * dt) / h;
        if (m.y < -0.02) { m.y = 1.02; m.x = Math.random(); }
        if (m.x < -0.02) m.x = 1.02;
        if (m.x > 1.02) m.x = -0.02;
        const flick = 0.75 + 0.25 * Math.sin(now / 2600 + m.ph);
        const g = ctx.createRadialGradient(m.x * w, m.y * h, 0, m.x * w, m.y * h, m.r * 5);
        g.addColorStop(0, 'rgba(246,232,206,' + (m.a * flick).toFixed(3) + ')');
        g.addColorStop(1, 'rgba(246,232,206,0)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(m.x * w, m.y * h, m.r * 5, 0, Math.PI * 2);
        ctx.fill();
      }
      requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }

  /* --------------------------------------------- 封王墨字：慢慢渗出来，留在纸上 */
  const GLYPHS = ['王', '王', '王', '王', '侯', '爵'];
  function inkLedger(host) {
    host.innerHTML = '';
    const n = parseInt(host.getAttribute('data-ledger') || '96', 10);
    const cols = 16;
    const rows = Math.ceil(n / cols);
    for (let i = 0; i < n; i++) {
      const el = document.createElement('span');
      el.className = 'd3-glyph';
      el.textContent = GLYPHS[(Math.random() * GLYPHS.length) | 0];
      const c = i % cols, r = Math.floor(i / cols);
      el.style.left = (((c + 0.5) / cols) * 100 + rand(-1.1, 1.1)).toFixed(2) + '%';
      el.style.top  = (((r + 0.5) / rows) * 100 + rand(-1.4, 1.4)).toFixed(2) + '%';
      el.style.fontSize = (11 + Math.random() * 9).toFixed(0) + 'px';
      const o = 0.1 + Math.random() * 0.16;
      el.style.setProperty('--o', o.toFixed(2));
      host.appendChild(el);
      if (!CAPTURE && !REDUCED) {
        el.animate(
          [{ opacity: 0, filter: 'blur(6px)' }, { opacity: o, filter: 'blur(0)' }],
          { duration: 1500, delay: i * 34, easing: 'cubic-bezier(.3,.7,.3,1)', fill: 'both' });
      }
    }
  }

  /* ------------------------------------------------ 巨字：像一句一句写上去 */
  function brushReveal(host) {
    const src = host.querySelector('[data-brush-text]');
    if (!src || CAPTURE || REDUCED) return;
    const text = host.getAttribute('data-brush-value') || src.textContent;
    const wrap = document.createElement('div');
    wrap.className = 'd3-brush-wrap';
    const inner = document.createElement('div');
    inner.className = 'd3-brush-inner';
    wrap.appendChild(inner);
    host.appendChild(wrap);
    const spans = [];
    for (const ch of text) {
      const sp = document.createElement('span');
      sp.textContent = ch === ' ' ? '\u00A0' : ch;
      inner.appendChild(sp);
      spans.push(sp);
    }
    spans.forEach(function (sp, i) {
      sp.animate(
        [{ opacity: 0, filter: 'blur(16px)', transform: 'translateY(10px)' },
         { opacity: 1, filter: 'blur(0)', transform: 'none' }],
        { duration: 2200, delay: 420 + i * 190, easing: 'cubic-bezier(.32,.6,.24,1)', fill: 'both' });
    });
  }

  /* ------------------------------------------------------ 页激活时的钩子 */
  function onEnter(slide) {
    const dust = slide.querySelector('[data-dust]');
    if (dust && !dust.dataset.started) { dust.dataset.started = '1'; initDust(dust); }
    const ledger = slide.querySelector('[data-ledger]');
    if (ledger && !CAPTURE) inkLedger(ledger);
    else if (ledger) inkLedger(ledger);
    const brush = slide.querySelector('[data-brush]');
    if (brush && !brush.dataset.done) { brush.dataset.done = '1'; brushReveal(brush); }
  }

  function boot() {
    const slides = document.querySelectorAll('.slide');
    slides.forEach(function (sl) {
      const mo = new MutationObserver(function (muts) {
        for (const m of muts) {
          if (m.attributeName !== 'class') continue;
          if (sl.classList.contains('is-active')) onEnter(sl);
        }
      });
      mo.observe(sl, { attributes: true, attributeFilter: ['class'] });
    });
    const first = activeSlide();
    if (first) onEnter(first);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
