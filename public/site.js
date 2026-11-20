/* =========================================================
   onanchi.com 共通の動き
   - すべての動きは「ばね」で動かす（途中でマウスの向きが変わっても滑らかにつながる）
   - 「動きを減らす」設定の人には、動きを止めて静かな表示にする
   ========================================================= */
(function () {
  'use strict';
  var root = document.documentElement;
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var finePointer = window.matchMedia('(pointer: fine)').matches;

  /* ---------- ばね（damping 1 = 行き過ぎない / 1未満 = 少し弾む、response = 追いつく速さ[秒]） ---------- */
  function Spring(v, response, damping) {
    this.x = v; this.v = 0; this.t = v;
    this.k = Math.pow(2 * Math.PI / response, 2);
    this.c = 2 * (damping || 1) * Math.sqrt(this.k);
  }
  Spring.prototype.step = function (dt) {
    this.v += (-this.k * (this.x - this.t) - this.c * this.v) * dt;
    this.x += this.v * dt;
    return Math.abs(this.v) > 0.001 || Math.abs(this.x - this.t) > 0.001;
  };

  /* ---------- 共通のアニメーションループ ---------- */
  var ticks = [];
  var last = performance.now();
  function loop(now) {
    var dt = Math.min((now - last) / 1000, 1 / 30); last = now;
    for (var i = 0; i < ticks.length; i++) ticks[i](dt, now / 1000);
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);

  /* ---------- スクロール量と速さ ---------- */
  var scrollY = window.scrollY, scrollVel = 0, lastScrollY = scrollY;
  window.addEventListener('scroll', function () { scrollY = window.scrollY; }, { passive: true });
  ticks.push(function (dt) {
    var raw = (scrollY - lastScrollY) / Math.max(dt, 0.001);
    lastScrollY = scrollY;
    scrollVel += (raw - scrollVel) * 0.2; // なめらかにする
  });

  /* ---------- 読み込み完了で表示開始 ---------- */
  requestAnimationFrame(function () { requestAnimationFrame(function () { root.classList.add('is-ready'); }); });

  /* ---------- ヘッダー・メニュー ---------- */
  var header = document.querySelector('.site-header');
  var menuBtn = document.querySelector('.menu-btn');
  function onScroll() { header.classList.toggle('scrolled', window.scrollY > 8); }
  onScroll();
  window.addEventListener('scroll', onScroll, { passive: true });
  if (menuBtn) {
    menuBtn.addEventListener('click', function () {
      var open = header.classList.toggle('open');
      menuBtn.setAttribute('aria-expanded', open);
      menuBtn.setAttribute('aria-label', open ? 'メニューを閉じる' : 'メニューを開く');
    });
    header.querySelectorAll('.gnav a').forEach(function (a) {
      a.addEventListener('click', function () { header.classList.remove('open'); menuBtn.setAttribute('aria-expanded', 'false'); });
    });
  }

  /* ---------- 上の進み具合バー ---------- */
  var bar = document.createElement('div');
  bar.className = 'progress';
  document.body.appendChild(bar);
  ticks.push(function () {
    var max = document.documentElement.scrollHeight - innerHeight;
    bar.style.transform = 'scaleX(' + (max > 0 ? scrollY / max : 0).toFixed(4) + ')';
  });

  /* ---------- 文字のデコード演出 ---------- */
  var GLYPHS = 'アイウエオカキクケコサシスセソナニヌネノ01<>/\\=+*#%&ABCDEFXYZ';
  function scramble(el, duration) {
    if (reduce || el.dataset.done) return;
    el.dataset.done = '1';
    var walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    var nodes = [], n;
    while ((n = walker.nextNode())) if (n.nodeValue.trim()) nodes.push({ node: n, text: n.nodeValue });
    var total = nodes.reduce(function (s, o) { return s + o.text.length; }, 0);
    var start = performance.now();
    var offs = 0;
    nodes.forEach(function (o) {
      o.at = [];
      for (var i = 0; i < o.text.length; i++, offs++) o.at.push((offs / total) * duration * 0.7 + Math.random() * duration * 0.3);
    });
    (function run(now) {
      var t = now - start, busy = false;
      nodes.forEach(function (o) {
        var s = '';
        for (var i = 0; i < o.text.length; i++) {
          var ch = o.text[i];
          if (t >= o.at[i] || /\s/.test(ch)) s += ch;
          else { busy = true; s += GLYPHS[(Math.random() * GLYPHS.length) | 0]; }
        }
        o.node.nodeValue = s;
      });
      if (busy) requestAnimationFrame(run);
    })(start);
  }
  var heroTitle = document.querySelector('.hero h1[data-scramble], .page-head [data-scramble]');
  if (heroTitle) setTimeout(function () { scramble(heroTitle, 1400); }, 150);

  /* ---------- スクロールで現れる ---------- */
  var rvItems = document.querySelectorAll('.rv');
  function reveal(el) {
    el.classList.add('in');
    el.querySelectorAll('[data-scramble]').forEach(function (s) { scramble(s, 900); });
    // 現れ終わったら、傾きなどの動きに切り替えるため演出用のクラスを外す
    setTimeout(function () { el.classList.remove('rv', 'in'); el.style.transitionDelay = ''; }, 1000 + (+el.dataset.delay || 0));
  }
  if ('IntersectionObserver' in window && !reduce) {
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (e) { if (e.isIntersecting) { reveal(e.target); io.unobserve(e.target); } });
    }, { rootMargin: '0px 0px -10% 0px' });
    rvItems.forEach(function (el) { el.style.transitionDelay = (el.dataset.delay || 0) + 'ms'; io.observe(el); });
  } else { rvItems.forEach(function (el) { el.classList.remove('rv'); }); }

  if (reduce) return; // ここから下は「動き」なので、動きを減らす設定の人には実行しない

  /* ---------- マウスに付いてくるカーソル ---------- */
  if (finePointer) {
    var ring = document.createElement('div'); ring.className = 'cursor';
    var dot = document.createElement('div'); dot.className = 'cursor-dot';
    document.body.appendChild(ring); document.body.appendChild(dot);
    var cx = new Spring(innerWidth / 2, 0.35), cy = new Spring(innerHeight / 2, 0.35), cs = new Spring(1, 0.3, 0.6);
    var mx = cx.x, my = cy.x;
    window.addEventListener('pointermove', function (e) {
      if (e.pointerType !== 'mouse') return;
      mx = e.clientX; my = e.clientY; cx.t = mx; cy.t = my;
      root.classList.add('has-cursor');
      var hot = e.target.closest && e.target.closest('a,button,.svc');
      cs.t = hot ? 1.9 : 1;
    });
    document.addEventListener('pointerleave', function () { root.classList.remove('has-cursor'); });
    window.addEventListener('pointerdown', function () { cs.t = 0.7; });
    window.addEventListener('pointerup', function () { cs.t = 1; });
    ticks.push(function (dt) {
      cx.step(dt); cy.step(dt); cs.step(dt);
      dot.style.transform = 'translate(' + mx + 'px,' + my + 'px)';
      ring.style.transform = 'translate(' + cx.x.toFixed(1) + 'px,' + cy.x.toFixed(1) + 'px) scale(' + cs.x.toFixed(3) + ')';
    });
  }

  /* ---------- マウスに吸い付くボタン ---------- */
  document.querySelectorAll('.btn').forEach(function (b) {
    var x = new Spring(0, 0.4, 0.6), y = new Spring(0, 0.4, 0.6), s = new Spring(1, 0.25, 0.7), active = false;
    b.addEventListener('pointermove', function (e) {
      var r = b.getBoundingClientRect();
      x.t = (e.clientX - r.left - r.width / 2) * 0.35;
      y.t = (e.clientY - r.top - r.height / 2) * 0.45;
      active = true;
    });
    b.addEventListener('pointerleave', function () { x.t = 0; y.t = 0; s.t = 1; });
    b.addEventListener('pointerdown', function () { s.t = 0.93; active = true; });   // 押した瞬間に反応
    b.addEventListener('pointerup', function () { s.t = 1; });
    ticks.push(function (dt) {
      if (!active) return;
      var m = x.step(dt) | y.step(dt) | s.step(dt);
      b.style.transform = 'translate(' + x.x.toFixed(2) + 'px,' + y.x.toFixed(2) + 'px) scale(' + s.x.toFixed(4) + ')';
      if (!m) { active = false; b.style.transform = ''; }
    });
  });

  /* ---------- 3Dに傾くサービスカード ---------- */
  document.querySelectorAll('.svc').forEach(function (card) {
    var rx = new Spring(0, 0.5), ry = new Spring(0, 0.5), s = new Spring(1, 0.35, 0.75), active = false;
    var glare = document.createElement('span'); glare.className = 'svc-glare'; card.appendChild(glare);
    card.addEventListener('pointermove', function (e) {
      var r = card.getBoundingClientRect();
      var px = (e.clientX - r.left) / r.width, py = (e.clientY - r.top) / r.height;
      card.style.setProperty('--mx', (px * 100) + '%');
      card.style.setProperty('--my', (py * 100) + '%');
      card.style.setProperty('--gx', (px * 100) + '%');
      if (e.pointerType !== 'mouse' || card.classList.contains('rv')) return;
      ry.t = (px - 0.5) * 18; rx.t = -(py - 0.5) * 18; s.t = 1.03; active = true;
    });
    card.addEventListener('pointerleave', function () { rx.t = 0; ry.t = 0; s.t = 1; });
    card.addEventListener('pointerdown', function () { if (!card.classList.contains('rv')) { s.t = 0.97; active = true; } });
    card.addEventListener('pointerup', function () { s.t = 1.03; });
    ticks.push(function (dt) {
      if (!active) return;
      var m = rx.step(dt) | ry.step(dt) | s.step(dt);
      card.style.transform = 'rotateX(' + rx.x.toFixed(2) + 'deg) rotateY(' + ry.x.toFixed(2) + 'deg) scale(' + s.x.toFixed(4) + ')';
      if (!m) { active = false; card.style.transform = ''; }
    });
  });

  /* ---------- 流れる帯（スクロールの速さで加速、向きも変わる、傾く） ---------- */
  var track = document.querySelector('.marquee-track');
  if (track) {
    var pos = 0, dir = -1, skew = new Spring(0, 0.4);
    ticks.push(function (dt) {
      if (Math.abs(scrollVel) > 30) dir = scrollVel > 0 ? -1 : 1;
      var speed = 70 + Math.min(Math.abs(scrollVel) * 0.6, 2200);
      pos += dir * speed * dt;
      var half = track.scrollWidth / 2;
      if (half > 0) { pos %= half; if (pos > 0) pos -= half; }
      skew.t = Math.max(-14, Math.min(14, -scrollVel * 0.01));
      skew.step(dt);
      track.style.transform = 'translate3d(' + pos.toFixed(1) + 'px,0,0) skewX(' + skew.x.toFixed(2) + 'deg)';
    });
  }

  /* ---------- フッターの大きな文字が下からせり上がる ---------- */
  var big = document.querySelector('.f-big');
  if (big) ticks.push(function () {
    var r = big.getBoundingClientRect();
    if (r.top > innerHeight + 200) return;
    var p = Math.max(0, Math.min(1, (innerHeight - r.top) / (innerHeight * 0.6)));
    big.style.transform = 'translateY(' + ((1 - p) * 80).toFixed(1) + 'px) scaleY(' + (0.6 + p * 0.4).toFixed(3) + ')';
    big.style.opacity = (0.3 + p * 0.7).toFixed(3);
  });

  /* ---------- ヒーロー：3Dの粒子の球体 ---------- */
  var hero = document.querySelector('.hero');
  var canvas = document.querySelector('.hero-canvas');
  var glow = document.querySelector('.hero-glow');
  if (!hero || !canvas) return;

  var ctx = canvas.getContext('2d');
  var W = 0, H = 0, DPR = 1, mobile = false;
  var pts = [];
  function build() {
    mobile = innerWidth < 900;
    var N = mobile ? 650 : 1300;
    pts = [];
    var golden = Math.PI * (3 - Math.sqrt(5));
    for (var i = 0; i < N; i++) {           // 球の表面に均等に並べる
      var y = 1 - (i / (N - 1)) * 2, r = Math.sqrt(1 - y * y), th = golden * i;
      pts.push({ x: Math.cos(th) * r, y: y, z: Math.sin(th) * r, rnd: Math.random(), ring: 0 });
    }
    for (var k = 0; k < 2; k++) {           // まわりを回る2本の輪
      var M = mobile ? 90 : 180, tilt = k ? 1.1 : -0.5, rad = k ? 1.55 : 1.35;
      for (var j = 0; j < M; j++) {
        var a = (j / M) * Math.PI * 2;
        var px = Math.cos(a) * rad, pz = Math.sin(a) * rad;
        pts.push({ x: px, y: Math.sin(tilt) * pz, z: Math.cos(tilt) * pz, rnd: Math.random(), ring: k + 1 });
      }
    }
  }
  function resize() {
    DPR = Math.min(window.devicePixelRatio || 1, 2);
    W = hero.clientWidth; H = hero.clientHeight;
    canvas.width = W * DPR; canvas.height = H * DPR;
    build();
  }
  resize();
  window.addEventListener('resize', resize);

  var tiltX = new Spring(0, 0.8), tiltY = new Spring(0, 0.8);   // マウスで球が傾く
  var gx = new Spring(W * 0.68, 0.9), gy = new Spring(H * 0.5, 0.9); // 光
  var spinBoost = new Spring(0, 0.6);
  var mouse = { x: -9999, y: -9999, on: false };
  var waves = [];                                                    // クリックで広がる衝撃波
  var rotY = 0;

  hero.addEventListener('pointermove', function (e) {
    var r = hero.getBoundingClientRect();
    mouse.x = e.clientX - r.left; mouse.y = e.clientY - r.top; mouse.on = true;
    if (e.pointerType === 'mouse') {
      tiltY.t = (mouse.x / W - 0.5) * 1.2;
      tiltX.t = (mouse.y / H - 0.5) * 1.0;
      gx.t = mouse.x; gy.t = mouse.y;
    }
  });
  hero.addEventListener('pointerleave', function () { mouse.on = false; tiltX.t = 0; tiltY.t = 0; gx.t = W * 0.68; gy.t = H * 0.5; });
  hero.addEventListener('pointerdown', function (e) {
    if (e.target.closest('a')) return;
    var r = hero.getBoundingClientRect();
    waves.push({ x: e.clientX - r.left, y: e.clientY - r.top, t: 0 });
    spinBoost.v += 6;   // はじくと勢いよく回る
  });

  var visible = true;
  if ('IntersectionObserver' in window) new IntersectionObserver(function (es) { visible = es[0].isIntersecting; }).observe(hero);

  var hudN = document.querySelector('.hud-n'), hudR = document.querySelector('.hud-r'), frame = 0;
  var C1 = [94, 240, 200], C2 = [122, 168, 255], C3 = [181, 140, 255];

  ticks.push(function (dt, time) {
    if (!visible) return;
    tiltX.step(dt); tiltY.step(dt); gx.step(dt); gy.step(dt); spinBoost.step(dt);
    if (glow) glow.style.transform = 'translate(' + gx.x.toFixed(1) + 'px,' + gy.x.toFixed(1) + 'px)';

    rotY += dt * (0.22 + spinBoost.x + Math.abs(scrollVel) * 0.0015);
    var scatter = Math.pow(Math.max(0, Math.min(1, scrollY / (H * 0.7))), 1.4); // スクロールで飛び散る

    var R = mobile ? Math.min(W * 0.46, 230) : Math.min(W, H) * 0.3;
    var CX = mobile ? W * 0.5 : W * 0.7, CY = mobile ? H * 0.3 : H * 0.5;
    var fov = 3.2;
    var ay = rotY + tiltY.x, ax = 0.35 + tiltX.x;
    var cyA = Math.cos(ay), syA = Math.sin(ay), cxA = Math.cos(ax), sxA = Math.sin(ax);

    for (var w = waves.length - 1; w >= 0; w--) { waves[w].t += dt; if (waves[w].t > 1.6) waves.splice(w, 1); }

    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    ctx.clearRect(0, 0, W, H);
    ctx.globalCompositeOperation = 'lighter';

    var near = [];
    for (var i = 0; i < pts.length; i++) {
      var p = pts[i];
      // 波打つように呼吸する
      var breathe = p.ring ? 1 : 1 + 0.07 * Math.sin(time * 1.8 + p.y * 7 + p.x * 3);
      var s = breathe * (1 + scatter * (0.8 + p.rnd * 4));
      var x = p.x * s, y = p.y * s, z = p.z * s;
      // 回転
      var x1 = x * cyA - z * syA, z1 = x * syA + z * cyA;
      var y1 = y * cxA - z1 * sxA, z2 = y * sxA + z1 * cxA;
      var k = fov / (fov + z2);
      var sx = CX + x1 * R * k, sy = CY + y1 * R * k;

      // マウスの近くの粒は押しのけられる
      var dx = sx - mouse.x, dy = sy - mouse.y, d2 = dx * dx + dy * dy;
      if (mouse.on && d2 < 16000) {
        var d = Math.sqrt(d2) || 1, push = (1 - d / 126) * 46;
        sx += dx / d * push; sy += dy / d * push;
        if (near.length < 40 && z2 < 0.3) near.push(sx, sy);
      }
      // 衝撃波
      for (var q = 0; q < waves.length; q++) {
        var wv = waves[q], wx = sx - wv.x, wy = sy - wv.y, wd = Math.sqrt(wx * wx + wy * wy) || 1;
        var front = wv.t * 700, band = Math.abs(wd - front);
        if (band < 60) { var f = (1 - band / 60) * 30 * (1 - wv.t / 1.6); sx += wx / wd * f; sy += wy / wd * f; }
      }

      var depth = (1 - z2) / 2; // 手前ほど1に近い
      var tcol = (p.y + 1) / 2, c0 = p.ring === 2 ? C3 : C1, c1 = p.ring === 1 ? C2 : (tcol > 0.5 ? C3 : C2);
      var mixT = p.ring ? 0.3 : Math.abs(tcol - 0.5) * 2;
      var r = c0[0] + (c1[0] - c0[0]) * mixT, g = c0[1] + (c1[1] - c0[1]) * mixT, b = c0[2] + (c1[2] - c0[2]) * mixT;
      var a = (0.15 + depth * 0.85) * (1 - scatter * 0.6) * (mobile ? 0.7 : 1);
      var size = (p.ring ? 1.3 : 1.6) * k + (p.rnd > 0.985 ? 1.5 : 0);
      ctx.fillStyle = 'rgba(' + (r | 0) + ',' + (g | 0) + ',' + (b | 0) + ',' + a.toFixed(3) + ')';
      ctx.fillRect(sx - size / 2, sy - size / 2, size, size);
    }

    // マウスの近くの粒をつなぐ線
    if (near.length) {
      ctx.lineWidth = 0.6;
      for (var u = 0; u < near.length; u += 2) {
        var ddx = near[u] - mouse.x, ddy = near[u + 1] - mouse.y;
        var al = Math.max(0, 1 - Math.sqrt(ddx * ddx + ddy * ddy) / 160) * 0.55;
        ctx.strokeStyle = 'rgba(94,240,200,' + al.toFixed(3) + ')';
        ctx.beginPath(); ctx.moveTo(mouse.x, mouse.y); ctx.lineTo(near[u], near[u + 1]); ctx.stroke();
      }
    }
    // 衝撃波の輪
    for (var v = 0; v < waves.length; v++) {
      var W0 = waves[v];
      ctx.strokeStyle = 'rgba(122,168,255,' + (0.5 * (1 - W0.t / 1.6)).toFixed(3) + ')';
      ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.arc(W0.x, W0.y, W0.t * 700, 0, Math.PI * 2); ctx.stroke();
    }
    ctx.globalCompositeOperation = 'source-over';

    if (++frame % 6 === 0) {
      if (hudN) hudN.textContent = String(pts.length).padStart(4, '0');
      if (hudR) hudR.textContent = (((ay * 180 / Math.PI) % 360 + 360) % 360).toFixed(1).padStart(5, '0');
    }
  });
})();
