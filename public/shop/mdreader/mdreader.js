/* MDReader 紹介・ダウンロードページの動き
   ・押した瞬間に反応、ばね（spring）で戻る、指に1:1で付いてくるマーカー
   ・「動きを減らす」設定の人には、動きを止めて完成形だけを見せる */
(function () {
  'use strict';
  var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var wait = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };

  /* ---------- スクロールで現れる ---------- */
  var rv = $$('.rv');
  if ('IntersectionObserver' in window && !reduce) {
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (e) {
        if (!e.isIntersecting) return;
        var el = e.target;
        setTimeout(function () { el.classList.add('in'); }, +(el.dataset.delay || 0));
        io.unobserve(el);
      });
    }, { rootMargin: '0px 0px -8% 0px' });
    rv.forEach(function (el) { io.observe(el); });
  } else { rv.forEach(function (el) { el.classList.add('in'); }); }

  /* ---------- 「読む → 線を引く → PDF」を順に光らせる ---------- */
  var flow = $$('.flow b');
  if (flow.length && !reduce) {
    var fi = 0;
    setInterval(function () { flow.forEach(function (b, i) { b.classList.toggle('on', i === fi); }); fi = (fi + 1) % flow.length; }, 1300);
  } else if (flow.length) { flow[0].classList.add('on'); }

  /* ---------- ヒーロー：書く → 表示 → 線を引く → PDF ---------- */
  var src = $('#demo-src'), view = $('#demo-view');
  if (src && view) {
    var lines = [
      ['# 会議メモ', function () { return el('h3', '会議メモ'); }],
      ['今日の決定は **3つ** です。', function () { var p = el('p'); p.innerHTML = '<span class="mk" id="demo-mk">今日の決定は <b>3つ</b> です。</span>'; return p; }],
      ['## やること', function () { return el('h4', 'やること'); }],
      ['- 資料を来週までに作る', function () { return li('資料を来週までに作る'); }],
      ['- 予算はそのまま', function () { return li('予算はそのまま'); }],
      ['| 担当 | 期限 |', null],
      ['|---|---|', null],
      ['| 山田 | 11/29 |', function () { var t = el('table'); t.innerHTML = '<tr><th>担当</th><th>期限</th></tr><tr><td>山田</td><td>11/29</td></tr>'; return t; }]
    ];
    var visible = true;
    if ('IntersectionObserver' in window) new IntersectionObserver(function (es) { visible = es[0].isIntersecting; }).observe(src);
    var ul = null;
    function el(tag, text) { var e = document.createElement(tag); if (text) e.textContent = text; return e; }
    function li(text) { var e = el('li', text); if (!ul) { ul = el('ul'); add(ul); } ul.appendChild(e); e.classList.add('pop'); return null; }
    function add(node) { node.classList.add('pop'); view.appendChild(node); }
    var caret = '<span class="caret"></span>';
    function esc(s) { return s.replace(/&/g, '&amp;').replace(/</g, '&lt;'); }
    function renderAll() { src.innerHTML = esc(lines.map(function (l) { return l[0]; }).join('\n')); view.innerHTML = ''; ul = null; lines.forEach(function (l) { if (l[1]) { var n = l[1](); if (n) add(n); } }); }

    async function run() {
      while (true) {
        src.innerHTML = caret; view.innerHTML = ''; ul = null;
        var done = '';
        for (var i = 0; i < lines.length; i++) {
          var s = lines[i][0];
          for (var c = 1; c <= s.length; c++) {
            while (!visible) await wait(300);
            src.innerHTML = esc(done + s.slice(0, c)) + caret;
            await wait(38 + Math.random() * 40);
          }
          done += s + '\n';
          src.innerHTML = esc(done) + caret;
          if (lines[i][1]) { var n = lines[i][1](); if (n) add(n); }
          await wait(260);
        }
        await wait(500);
        var mk = $('#demo-mk'); if (mk) mk.classList.add('on');
        await wait(1300);
        var pdf = $('#demo-pdf'), paper = $('#demo-paper');
        pdf.classList.add('press'); await wait(180); pdf.classList.remove('press');
        paper.classList.remove('fly'); void paper.offsetWidth; paper.classList.add('fly');
        await wait(3200);
      }
    }
    if (reduce) { renderAll(); var m = $('#demo-mk'); if (m) m.classList.add('on'); } else run();
  }

  /* ---------- 体験：ドラッグで線を引く（指に1:1で追従） ---------- */
  var mt = $('#mtext');
  if (mt) {
    var COLORS = { yellow: '#ffe45c', green: '#a6eb8f', pink: '#ffb3d1', blue: '#a9c4ff' };
    var pen = 'yellow';
    var text = mt.textContent.trim(); mt.textContent = '';
    var chars = Array.from(text).map(function (ch) { var s = document.createElement('span'); s.textContent = ch; mt.appendChild(s); return s; });
    var marks = new Array(chars.length).fill(null);
    var startI = -1, curI = -1;
    function idxAt(x, y) {
      var t = document.elementFromPoint(x, y);
      if (t && t.parentNode === mt) return chars.indexOf(t);
      // 文字の間に指があるときは、いちばん近い文字を選ぶ
      var best = -1, bd = 1e9;
      chars.forEach(function (c, i) { var r = c.getBoundingClientRect(); var dx = Math.max(r.left - x, 0, x - r.right), dy = Math.max(r.top - y, 0, y - r.bottom); var d = dx * dx + dy * dy * 4; if (d < bd) { bd = d; best = i; } });
      return best;
    }
    function paint() {
      var a = Math.min(startI, curI), b = Math.max(startI, curI);
      chars.forEach(function (c, i) {
        var m = (startI >= 0 && i >= a && i <= b) ? pen : marks[i];
        c.style.backgroundColor = m ? COLORS[m] : '';
      });
    }
    mt.addEventListener('pointerdown', function (e) {
      mt.setPointerCapture(e.pointerId);
      startI = curI = idxAt(e.clientX, e.clientY); paint();   // 押した瞬間に色が付く
    });
    mt.addEventListener('pointermove', function (e) { if (startI < 0) return; var i = idxAt(e.clientX, e.clientY); if (i !== curI) { curI = i; paint(); } });
    function end() {
      if (startI < 0) return;
      var a = Math.min(startI, curI), b = Math.max(startI, curI);
      for (var i = a; i <= b; i++) marks[i] = pen;
      startI = curI = -1; paint();
    }
    mt.addEventListener('pointerup', end); mt.addEventListener('pointercancel', end);
    $$('.pen').forEach(function (b) {
      b.addEventListener('click', function () {
        if (b.dataset.pen === 'clear') { marks.fill(null); paint(); return; }
        pen = b.dataset.pen;
        $$('.pen[data-pen]:not(.clear)').forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); });
      });
    });
  }

  /* ---------- 配色テーマの切り替え ---------- */
  var tdoc = $('#tdoc');
  if (tdoc) {
    var TH = {
      standard: ['#fbfaf7', '#23262b', '#e4eefb', '#0b5fc4'],
      white: ['#ffffff', '#000000', '#f2f2f2', '#0b4fa8'],
      sepia: ['#f4ecd8', '#3b2a1a', '#eadfc4', '#8a3b00'],
      charcoal: ['#222120', '#ece6da', '#3a3733', '#e8b04a'],
      bluegray: ['#dfe6ee', '#1c2733', '#cbd5e1', '#1a4f96'],
      green: ['#dcead8', '#1f2d1f', '#c4dcbd', '#1d5a2c'],
      contrast: ['#000000', '#ffff00', '#1a1a1a', '#66e0ff']
    };
    function setTheme(k) {
      var t = TH[k]; if (!t) return;
      tdoc.style.setProperty('--t-bg', t[0]); tdoc.style.setProperty('--t-fg', t[1]);
      tdoc.style.setProperty('--t-soft', t[2]); tdoc.style.setProperty('--t-acc', t[3]);
      $$('.chip').forEach(function (c) { c.setAttribute('aria-pressed', String(c.dataset.theme === k)); });
    }
    $$('.chip').forEach(function (c) {
      var t = TH[c.dataset.theme]; if (t) { c.querySelector('i').style.background = t[0]; c.querySelector('i').style.boxShadow = 'inset 0 0 0 5px ' + t[0] + ', inset 0 0 0 11px ' + t[1]; }
      c.addEventListener('click', function () { setTheme(c.dataset.theme); });
    });
    setTheme('standard');
  }

  /* ---------- カード：ポインターの方へ少し傾く（ばね・臨界減衰） ---------- */
  function Spring(v) { this.v = v; this.t = v; this.vel = 0; }
  Spring.prototype.step = function (dt, response) {
    var k = Math.pow(2 * Math.PI / response, 2), c = 4 * Math.PI / response; // damping 1.0
    this.vel += (-k * (this.v - this.t) - c * this.vel) * dt; this.v += this.vel * dt;
  };
  if (!reduce && matchMedia('(hover: hover)').matches) {
    $$('.feat, .step').forEach(function (card) {
      var rx = new Spring(0), ry = new Spring(0), sc = new Spring(1), raf = 0, last = 0;
      function tick(now) {
        var dt = Math.min((now - (last || now)) / 1000, 1 / 30); last = now;
        rx.step(dt, .35); ry.step(dt, .35); sc.step(dt, .3);
        card.style.transform = 'perspective(700px) rotateX(' + rx.v.toFixed(2) + 'deg) rotateY(' + ry.v.toFixed(2) + 'deg) scale(' + sc.v.toFixed(4) + ')';
        var still = Math.abs(rx.v - rx.t) + Math.abs(ry.v - ry.t) + Math.abs(sc.v - sc.t) < .005 && Math.abs(rx.vel) + Math.abs(ry.vel) < .01;
        if (still && rx.t === 0 && ry.t === 0 && sc.t === 1) { card.style.transform = ''; raf = 0; last = 0; return; }
        raf = requestAnimationFrame(tick);
      }
      function go() { card.style.transition = 'opacity .6s ease'; if (!raf) raf = requestAnimationFrame(tick); }
      card.addEventListener('pointermove', function (e) {
        var r = card.getBoundingClientRect();
        ry.t = ((e.clientX - r.left) / r.width - .5) * 8; rx.t = -((e.clientY - r.top) / r.height - .5) * 8; sc.t = 1.02; go();
      });
      card.addEventListener('pointerleave', function () { rx.t = ry.t = 0; sc.t = 1; go(); });
      card.addEventListener('pointerdown', function () { sc.t = .98; go(); });
      card.addEventListener('pointerup', function () { sc.t = 1.02; go(); });
    });
  }

  /* ---------- 数字のカウントアップ ---------- */
  var nums = $$('[data-count]');
  if (nums.length && 'IntersectionObserver' in window && !reduce) {
    var nio = new IntersectionObserver(function (es) {
      es.forEach(function (e) {
        if (!e.isIntersecting) return; nio.unobserve(e.target);
        var n = e.target, to = +n.dataset.count, t0 = performance.now();
        (function f(now) { var p = Math.min((now - t0) / 1100, 1); n.textContent = Math.round(to * (1 - Math.pow(1 - p, 3))); if (p < 1) requestAnimationFrame(f); })(t0);
      });
    }, { threshold: .6 });
    nums.forEach(function (n) { n.textContent = '0'; nio.observe(n); });
  }

  /* ---------- SHA-256 のコピー ---------- */
  $$('.copy[data-copy]').forEach(function (b) {
    b.addEventListener('click', function () {
      var t = $(b.dataset.copy); if (!t) return;
      var done = function () { b.textContent = 'コピーしました'; b.classList.add('ok'); setTimeout(function () { b.textContent = 'コピー'; b.classList.remove('ok'); }, 1600); };
      if (navigator.clipboard) navigator.clipboard.writeText(t.textContent.trim()).then(done, function () {});
    });
  });
})();
