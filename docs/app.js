/* collar-triage page. Reads D from data.js, which study/build_page_data.py writes. */
(function () {
  'use strict';
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var NS = 'http://www.w3.org/2000/svg';
  var V = D.values;
  var C = { ink: '#1a1d21', soft: '#5b6470', faint: '#8b95a1', rule: '#e2e0dc', rule2: '#c9c5be', panel: '#f3f1ed',
            bat: '#2a78d6', tri: '#eb6834', neg: '#b03a3a', paper: '#faf9f7', amber: '#c8860d' };
  var CAUSE = {}; D.causes.forEach(function (c) { CAUSE[c[0]] = c[1]; });
  var RECORD = { alive: 'Bird seen alive after the tag stopped', death: 'Bird recorded dead', vanished: 'Bird vanished',
                 none: 'Nothing recorded' };

  function svg(w, h, cls) {
    var s = document.createElementNS(NS, 'svg');
    s.setAttribute('viewBox', '0 0 ' + w + ' ' + h); s.setAttribute('width', w); s.setAttribute('height', h);
    s.setAttribute('role', 'img'); if (cls) s.setAttribute('class', cls);
    s.style.width = '100%'; s.style.height = 'auto'; s.style.maxWidth = w + 'px';
    return s;
  }
  function el(parent, tag, attrs, text) {
    var e = document.createElementNS(NS, tag);
    for (var k in attrs) e.setAttribute(k, attrs[k]);
    if (text !== undefined) e.textContent = text;
    parent.appendChild(e); return e;
  }
  function txt(p, x, y, s, o) {
    o = o || {};
    var a = { x: x, y: y, 'font-family': o.mono ? 'IBM Plex Mono, monospace' : 'IBM Plex Sans, system-ui, sans-serif',
              'font-size': o.size || 12, fill: o.fill || C.soft, 'text-anchor': o.anchor || 'start' };
    if (o.weight) a['font-weight'] = o.weight;
    if (o.halo) { a.stroke = C.paper; a['stroke-width'] = 4; a['paint-order'] = 'stroke'; a['stroke-linejoin'] = 'round'; }
    if (o.rotate) a.transform = 'rotate(' + o.rotate + ' ' + x + ' ' + y + ')';
    if (o.base) a['dominant-baseline'] = o.base;
    return el(p, 'text', a, s);
  }
  function pct(x) { return Math.round(100 * x) + '%'; }
  var tip = $('#tip');
  function showTip(evt, html) {
    tip.innerHTML = html; tip.style.display = 'block';
    var box = tip.getBoundingClientRect();
    var x = Math.min(evt.pageX + 12, window.scrollX + innerWidth - box.width - 8);
    tip.style.left = x + 'px'; tip.style.top = (evt.pageY - box.height - 10) + 'px';
  }
  function hideTip() { tip.style.display = 'none'; }
  function width(id) { return Math.max(300, Math.floor($(id).clientWidth)); }
  function shortName(animal) { return animal.split(/\s+\+|\s+\/|\s+\(/)[0].trim(); }

  /* ---------- the answer chart ---------- */
  function bestWithin(curve, b) {
    var best = null;
    curve.forEach(function (p) { if (p.x <= b + 1e-9 && (!best || p.y > best.y || (p.y === best.y && p.x < best.x))) best = p; });
    return best;
  }
  // Labels for the crowded low-left corner go up a leader line into the empty space above
  // (ly in chart units); the others sit beside their point, below the curves.
  var POINTS = [
    { id: 'op', label: 'my four rules, as fixed in advance', n: 1, dx: 12, dy: 18, ndx: 9, ndy: 14 },
    { id: 'T2', label: 'reports thinned', n: 2, dx: 10, dy: 16, ndx: 8, ndy: 13 },
    { id: 'T4', label: 'stopped moving', n: 3, ly: 0.47, ndx: -8, ndy: 4, nanchor: 'end' },
    { id: 'T1', label: 'charge deficit', n: 4, ly: 0.41, ndx: -8, ndy: 10, nanchor: 'end' },
    { id: 'ls', label: 'last seen alarm, 24 h', n: 5, ly: 0.35, ndx: 0, ndy: -10, nanchor: 'middle' },
    { id: 'T3', label: 'GPS fix lost', n: 6, dx: 10, dy: 15, ndx: 8, ndy: 13 }
  ];
  function drawBluf(budget) {
    var host = $('#bluf'), W = width('#bluf'), narrow = W < 560;
    var m = { l: narrow ? 46 : 60, r: narrow ? 12 : 24, t: 14, b: narrow ? 46 : 52 };
    var pw = W - m.l - m.r, ph = narrow ? Math.round(pw * 0.95) : Math.round(Math.min(innerHeight < 900 ? 300 : 360, pw * 0.45));
    var H = m.t + ph + m.b, XM = 0.65, YM = 0.70;
    var X = function (v) { return m.l + v / XM * pw; }, Y = function (v) { return m.t + ph - v / YM * ph; };
    var s = svg(W, H);
    s.setAttribute('aria-label', 'Chart: share of quiet tags warned against share of healthy collar months falsely flagged, for each alarm');
    var defs = el(s, 'defs', {}); var cp = el(defs, 'clipPath', { id: 'bclip' });
    el(cp, 'rect', { x: m.l, y: m.t, width: pw, height: ph });
    for (var g = 0; g <= 0.6001; g += 0.1) {
      el(s, 'line', { x1: X(g), x2: X(g), y1: m.t, y2: m.t + ph, stroke: C.rule });
      txt(s, X(g), m.t + ph + 16, Math.round(g * 100) + '%', { anchor: 'middle', size: 11, mono: true, fill: C.faint });
    }
    for (g = 0; g <= 0.7001; g += 0.1) {
      el(s, 'line', { x1: m.l, x2: m.l + pw, y1: Y(g), y2: Y(g), stroke: C.rule });
      txt(s, m.l - 8, Y(g) + 4, Math.round(g * 100) + '%', { anchor: 'end', size: 11, mono: true, fill: C.faint });
    }
    txt(s, m.l + pw / 2, H - 10, narrow ? 'Healthy collar months flagged by mistake' : 'Healthy collar months flagged by mistake (lower is better)',
        { anchor: 'middle', size: 12, fill: C.ink });
    txt(s, 14, m.t + ph / 2, narrow ? 'Quiet tags warned in time' : 'Tags that went quiet, warned 2 or more days ahead',
        { anchor: 'middle', size: 12, fill: C.ink, rotate: -90 });
    // the floor
    el(s, 'line', { x1: X(0), y1: Y(0), x2: X(XM), y2: Y(XM), stroke: C.soft, 'stroke-dasharray': '5 5', 'stroke-width': 1.3 });
    var ang = -Math.atan2(Y(0) - Y(XM), X(XM) - X(0)) * 180 / Math.PI;
    txt(s, X(narrow ? 0.40 : 0.30), Y(narrow ? 0.40 : 0.30) + 16, 'an alarm that fires at random', { anchor: 'middle', size: 11.5, fill: C.soft, rotate: ang, halo: true });
    // the budget
    el(s, 'line', { x1: X(budget), x2: X(budget), y1: m.t, y2: m.t + ph, stroke: C.amber, 'stroke-width': 1.5, 'stroke-dasharray': '2 3' });
    txt(s, X(budget) + 5, m.t + 12, 'budget ' + pct(budget), { size: 11, mono: true, fill: C.amber, halo: true });
    // curves
    var line = function (pts, col, w) {
      var d = pts.map(function (p, i) { return (i ? 'L' : 'M') + X(p.x).toFixed(1) + ' ' + Y(p.y).toFixed(1); }).join(' ');
      el(s, 'path', { d: d, fill: 'none', stroke: col, 'stroke-width': w, 'clip-path': 'url(#bclip)', 'stroke-linejoin': 'round' });
    };
    var bat = D.battery.slice().sort(function (a, b) { return a.v - b.v; });
    var tri = D.triage.slice().sort(function (a, b) { return b.k - a.k; });
    line(bat, C.bat, 2.6); line(tri, C.tri, 2.6);
    var bl = bat.filter(function (p) { return p.v === 3880; })[0] || bat[bat.length - 1];
    if (narrow) txt(s, X(0.63), Y(0.13), 'low battery alarm', { anchor: 'end', size: 12, fill: C.bat, weight: 600, halo: true });
    else txt(s, X(bl.x) - 10, Y(bl.y) - 8, 'low battery alarm, 3.40 to 4.10 V', { anchor: 'end', size: 12.5, fill: C.bat, weight: 600, halo: true });
    var tl = tri.filter(function (p) { return Math.abs(p.k - 0.536) < 0.01; })[0] || tri[tri.length - 1];
    if (narrow) txt(s, X(0.63), Y(0.07), 'my four rules', { anchor: 'end', size: 12, fill: C.tri, weight: 600, halo: true });
    else txt(s, X(tl.x) + 10, Y(tl.y) + 18, 'my four rules, lax to strict', { size: 12.5, fill: C.tri, weight: 600, halo: true });
    // the matched battery point
    var mb = D.points.bat;
    el(s, 'circle', { cx: X(mb.x), cy: Y(mb.y), r: 4, fill: C.bat });
    // single points
    var key = $('#blufkey'); key.innerHTML = '';
    POINTS.forEach(function (pt) {
      var p = D.points[pt.id], cx = X(p.x), cy = Y(p.y);
      if (pt.id === 'op') {
        el(s, 'circle', { cx: cx, cy: cy, r: 7, fill: 'none', stroke: C.tri, 'stroke-width': 2.4 });
      } else if (pt.id === 'ls') {
        el(s, 'path', { d: 'M' + cx + ' ' + (cy - 6) + 'L' + (cx + 6) + ' ' + cy + 'L' + cx + ' ' + (cy + 6) + 'L' + (cx - 6) + ' ' + cy + 'Z', fill: C.soft });
      } else {
        el(s, 'circle', { cx: cx, cy: cy, r: 4.5, fill: C.ink });
      }
      var hit = el(s, 'circle', { cx: cx, cy: cy, r: 12, fill: 'transparent', style: 'cursor:help' });
      hit.addEventListener('mousemove', function (e) {
        showTip(e, pt.label + '<br>warned ' + p.warned + ' of ' + D.n_silent + ', ' + pct(p.x) + ' of healthy collar months flagged');
      });
      hit.addEventListener('mouseleave', hideTip);
      if (narrow) {
        txt(s, cx + pt.ndx, cy + pt.ndy, String(pt.n), { size: 11, mono: true, fill: C.ink, weight: 600, halo: true, anchor: pt.nanchor || 'start' });
        var li = document.createElement('li'); li.innerHTML = '<b>' + pt.n + '</b>' + pt.label + ': warned ' + p.warned + ', ' + pct(p.x) + ' false';
        key.appendChild(li);
      } else if (pt.ly !== undefined) {
        el(s, 'line', { x1: cx, y1: cy - 6, x2: cx, y2: Y(pt.ly) + 4, stroke: C.soft, 'stroke-width': 1 });
        txt(s, cx - 4, Y(pt.ly), pt.label, { size: 12, fill: C.ink, halo: true });
      } else {
        txt(s, cx + pt.dx, cy + pt.dy, pt.label, { size: 12, fill: C.ink, halo: true });
      }
    });
    host.innerHTML = ''; host.appendChild(s);
    // the readout
    var tb = bestWithin(D.triage, budget), bb = bestWithin(D.battery, budget);
    var rand = Math.round(budget * D.n_silent);
    $('#budgetout').textContent = 'at most ' + pct(budget) + ' of healthy collar months flagged';
    $('#blufstat').innerHTML =
      '<div><div class="k">My four rules</div><div class="n" style="color:' + C.tri + '">' + (tb ? Math.round(tb.y * D.n_silent) : 0) + ' of ' + D.n_silent + '</div><div class="s">quiet tags warned in time</div></div>' +
      '<div><div class="k">Low battery alarm</div><div class="n" style="color:' + C.bat + '">' + (bb ? Math.round(bb.y * D.n_silent) : 0) + ' of ' + D.n_silent + '</div><div class="s">' + (bb ? 'set at ' + (bb.v / 1000).toFixed(2) + ' V' : 'no setting fits') + '</div></div>' +
      '<div><div class="k">Random alarm</div><div class="n">' + rand + ' of ' + D.n_silent + '</div><div class="s">the dashed diagonal</div></div>';
  }

  /* ---------- the collar, drawn as blocks ---------- */
  var PARTS = {
    panel: { name: 'Solar panel', field: 'daily high voltage' },
    charger: { name: 'Charger', field: 'daily high voltage' },
    battery: { name: 'Battery', field: 'voltage, idle and loaded' },
    proc: { name: 'Processor, clock, sensors', field: 'temperature, motion' },
    gps: { name: 'GPS receiver and antenna', field: 'time to fix, fixes lost' },
    radio: { name: 'Radio and antenna', field: 'messages per day' },
    strap: { name: 'Strap, buckle or harness', field: 'how far it moved in a day' }
  };
  function drawCollar(hostId, hl) {
    var host = $(hostId), W = width(hostId), wide = hostId === '#domainviz' && W >= 640;
    var lay = wide ? {
      w: 720, h: 250, house: [10, 10, 700, 170], box: {
        panel: [24, 30, 150, 58], charger: [196, 30, 120, 58], battery: [338, 30, 160, 58],
        proc: [338, 108, 160, 58], gps: [520, 30, 176, 58], radio: [520, 108, 176, 58], strap: [10, 196, 700, 46] },
      links: [['panel', 'charger'], ['charger', 'battery'], ['battery', 'proc'], ['proc', 'gps'], ['proc', 'radio']]
    } : {
      w: 340, h: 470, house: [6, 6, 328, 392], box: {
        panel: [18, 18, 304, 50], charger: [18, 76, 304, 50], battery: [18, 134, 304, 50],
        proc: [18, 192, 304, 50], gps: [18, 250, 304, 50], radio: [18, 308, 304, 50], strap: [6, 412, 328, 50] },
      links: []
    };
    var s = svg(lay.w, lay.h);
    s.setAttribute('aria-label', 'Block drawing of a generic solar GPS collar and the housekeeping field that watches each part');
    var h = lay.house;
    el(s, 'rect', { x: h[0], y: h[1], width: h[2], height: h[3], rx: 14, fill: '#fbfaf8', stroke: C.rule2, 'stroke-width': 1.5, 'stroke-dasharray': '6 4' });
    txt(s, h[0] + h[2] - 12, h[1] + h[3] - (wide ? 10 : 12), 'sealed housing', { anchor: 'end', size: 11, mono: true, fill: C.faint });
    var mid = function (b) { return [b[0] + b[2] / 2, b[1] + b[3] / 2]; };
    lay.links.forEach(function (l) {
      var a = mid(lay.box[l[0]]), b = mid(lay.box[l[1]]);
      el(s, 'line', { x1: a[0], y1: a[1], x2: b[0], y2: b[1], stroke: C.rule2, 'stroke-width': 2 });
    });
    Object.keys(lay.box).forEach(function (id) {
      var b = lay.box[id], g = el(s, 'g', { class: 'part' + (hl && hl.indexOf(id) >= 0 ? ' hl' : ''), 'data-part': id });
      el(g, 'rect', { x: b[0], y: b[1], width: b[2], height: b[3], rx: 6, fill: C.paper === '#faf9f7' ? '#ffffff' : '#fff', stroke: C.ink, 'stroke-width': 1.3 });
      txt(g, b[0] + 10, b[1] + (wide ? 22 : 20), PARTS[id].name, { size: 12.5, fill: C.ink, weight: 600 });
      txt(g, b[0] + 10, b[1] + (wide ? 41 : 38), PARTS[id].field, { size: 11, mono: true, fill: C.soft });
    });
    host.innerHTML = ''; host.appendChild(s);
    if (hostId === '#domainviz') s.style.maxWidth = wide ? '820px' : '400px';
  }

  /* ---------- act one: lead times ---------- */
  function drawLead() {
    var host = $('#leadviz'), W = width('#leadviz'), narrow = W < 560;
    var r = narrow ? 3.6 : 4.6, step = r * 2 + 1.6;
    var rows = [
      { key: 'lead', name: 'My four rules', col: C.tri, med: +V.lead_t_med },
      { key: 'leadb', name: 'Low battery alarm, ' + V.bat_level + ' V', col: C.bat, med: +V.lead_b_med }
    ];
    var counts = rows.map(function (row) {
      var c = {}; D.endings.forEach(function (e) { if (e[row.key] !== null) c[e[row.key]] = (c[e[row.key]] || 0) + 1; });
      return Math.max.apply(null, Object.keys(c).map(function (k) { return c[k]; }));
    });
    var m = { l: 12, r: 12, t: 8, b: 40 }, lab = 20;
    var rowH = counts.map(function (c) { return lab + c * step + 12; });
    var H = m.t + rowH[0] + rowH[1] + m.b, pw = W - m.l - m.r;
    var X = function (d) { return m.l + (29.5 - d) / 28 * pw; };
    var s = svg(W, H);
    s.setAttribute('aria-label', 'Dot chart of how many days before the end each alarm first fired');
    el(s, 'rect', { x: X(29.5), y: m.t, width: X(27.5) - X(29.5), height: rowH[0] + rowH[1], fill: C.panel });
    txt(s, X(29.5) + 4, m.t + rowH[0] + rowH[1] + 14, narrow ? 'already on' : 'already on when the final month began', { size: 10.5, fill: C.faint });
    [29, 22, 15, 8, 2].forEach(function (d) {
      txt(s, X(d), H - 8, d + (d === 2 ? ' days' : ''), { anchor: 'middle', size: 11, mono: true, fill: C.faint });
    });
    txt(s, m.l + pw, H - 24, 'days before the last record', { anchor: 'end', size: 11, fill: C.soft });
    var y0 = m.t;
    rows.forEach(function (row, ri) {
      var base = y0 + rowH[ri] - 8;
      txt(s, m.l + pw, y0 + 14, row.name, { anchor: 'end', size: 12.5, fill: row.col, weight: 600, halo: true });
      el(s, 'line', { x1: m.l, x2: m.l + pw, y1: base + r + 3, y2: base + r + 3, stroke: C.rule2 });
      var stack = {}, leads = [];
      D.endings.forEach(function (e, i) {
        var d = e[row.key]; if (d === null) return;
        leads.push(d);
        var k = stack[d] = (stack[d] || 0) + 1;
        var c = el(s, 'circle', { cx: X(d), cy: base - (k - 1) * step, r: r, fill: row.col, style: 'cursor:pointer', tabindex: 0 });
        c.addEventListener('mousemove', function (ev) { showTip(ev, 'tag ' + e.tag + ', ' + shortName(e.animal) + '<br>first fired ' + d + ' days before the end<br>' + CAUSE[e.cause]); });
        c.addEventListener('mouseleave', hideTip);
        var go = function () { hideTip(); selectTag(i); $('#act2').scrollIntoView({ behavior: 'smooth' }); };
        c.addEventListener('click', go);
        c.addEventListener('keydown', function (ev) { if (ev.key === 'Enter') go(); });
      });
      var med = row.med;
      el(s, 'line', { x1: X(med), x2: X(med), y1: y0 + 20, y2: base + r + 3, stroke: C.ink, 'stroke-width': 1.2, 'stroke-dasharray': '3 3' });
      txt(s, X(med) + 5, y0 + 30, 'half within ' + med + ' days', { size: 11, mono: true, fill: C.ink, halo: true });
      y0 += rowH[ri];
    });
    host.innerHTML = ''; host.appendChild(s);
  }
  function drawOverlap() {
    var host = $('#overlapviz'), W = width('#overlapviz');
    var both = 0, tOnly = 0, bOnly = 0, none = 0;
    D.endings.forEach(function (e) {
      var t = e.lead !== null, b = e.leadb !== null;
      if (t && b) both++; else if (t) tOnly++; else if (b) bOnly++; else none++;
    });
    var parts = [[both, 'warned by both', C.ink], [tOnly, 'only my rules', C.tri], [bOnly, 'only the battery alarm', C.bat], [none, 'warned by neither', C.rule2]];
    var narrow = W < 560, H = narrow ? 120 : 64, s = svg(W, H), x = 0, tot = D.n_silent;
    s.setAttribute('aria-label', 'Bar splitting the quiet tags by which alarm warned them');
    parts.forEach(function (p, i) {
      var w = p[0] / tot * W;
      el(s, 'rect', { x: x, y: 0, width: Math.max(0, w - 2), height: 26, fill: p[2] });
      if (w > 26) txt(s, x + 6, 18, String(p[0]), { size: 12, mono: true, fill: i === 3 ? C.ink : '#fff', weight: 600 });
      if (!narrow) txt(s, x + 2, 46, p[1], { size: 11.5, fill: C.soft });
      x += w;
    });
    if (narrow) parts.forEach(function (p, i) {
      el(s, 'rect', { x: 0, y: 38 + i * 20, width: 10, height: 10, fill: p[2] });
      txt(s, 16, 47 + i * 20, p[0] + ' ' + p[1], { size: 11.5, fill: C.soft });
    });
    host.innerHTML = ''; host.appendChild(s);
  }

  /* ---------- act two: every ending ---------- */
  var current = 0;
  var ORDER = { alive: 0, death: 1, vanished: 2, none: 3 };
  function buildPicker() {
    var host = $('#picker'); host.innerHTML = '';
    D.causes.forEach(function (c) {
      var idx = D.endings.map(function (e, i) { return i; }).filter(function (i) { return D.endings[i].cause === c[0]; });
      idx.sort(function (a, b) { return ORDER[D.endings[a].record] - ORDER[D.endings[b].record] || D.endings[a].tag - D.endings[b].tag; });
      var lab = document.createElement('div'); lab.className = 'lab';
      lab.innerHTML = c[1] + '<span>' + idx.length + ' tags</span>';
      var sq = document.createElement('div'); sq.className = 'sq';
      idx.forEach(function (i) {
        var e = D.endings[i], b = document.createElement('button');
        b.className = e.record; b.setAttribute('aria-pressed', 'false'); b.dataset.i = i;
        b.setAttribute('aria-label', 'Tag ' + e.tag + ', ' + RECORD[e.record]);
        b.title = 'Tag ' + e.tag + ': ' + RECORD[e.record].toLowerCase();
        b.addEventListener('click', function () { selectTag(i); });
        sq.appendChild(b);
      });
      host.appendChild(lab); host.appendChild(sq);
    });
  }
  function selectTag(i) {
    current = i;
    document.querySelectorAll('#picker button').forEach(function (b) { b.setAttribute('aria-pressed', String(+b.dataset.i === i)); });
    drawTag(); tagBox();
  }
  function drawTag() {
    var e = D.endings[current], host = $('#tagviz'), W = width('#tagviz'), narrow = W < 560;
    var m = { l: narrow ? 58 : 74, r: 10 }, pw = W - m.l - m.r;
    var X = function (d) { return m.l + (44.5 - d) / 45 * pw; };
    var rows = [['T1', 'charge'], ['T2', 'reports'], ['T3', 'GPS'], ['T4', 'still'], ['low', 'battery']];
    var stripH = rows.length * 13 + 8, vH = 110, nH = 80, sH = 84, gap = 26;
    var top = 4, yS = top, yV = yS + stripH + gap, yN = yV + vH + gap, yM = yN + nH + gap, H = yM + sH + 30;
    var s = svg(W, H);
    s.setAttribute('aria-label', 'Last 45 days of tag ' + e.tag);
    var t = e.tail; // [d, n, vmax, vmin, nofix, spread, fires, low]
    var bw = Math.max(1.5, pw / 45 - 1.5);
    // the strip of rules that fired
    rows.forEach(function (r, ri) {
      var y = yS + ri * 13;
      txt(s, m.l - 6, y + 9, r[1], { anchor: 'end', size: 10, mono: true, fill: r[0] === 'low' ? C.bat : C.tri });
      t.forEach(function (d) {
        var on = r[0] === 'low' ? d[7] === 1 : d[6].indexOf(r[0].slice(1)) >= 0;
        if (on) el(s, 'rect', { x: X(d[0]) - bw / 2, y: y + 1, width: bw, height: 8, fill: r[0] === 'low' ? C.bat : C.tri });
      });
    });
    // battery voltage
    var VY = function (v) { return yV + vH - (v - 3400) / 800 * vH; };
    txt(s, m.l, yV - 8, 'Battery voltage, daily high and low', { size: 11.5, fill: C.ink, weight: 600 });
    [3.4, 3.8, 4.2].forEach(function (v) {
      el(s, 'line', { x1: m.l, x2: m.l + pw, y1: VY(v * 1000), y2: VY(v * 1000), stroke: C.rule });
      txt(s, m.l - 6, VY(v * 1000) + 4, v.toFixed(1) + ' V', { anchor: 'end', size: 10, mono: true, fill: C.faint });
    });
    var hasV = t.some(function (d) { return d[2] !== null; });
    if (hasV) {
      var lvl = +V.bat_level * 1000;
      el(s, 'line', { x1: m.l, x2: m.l + pw, y1: VY(lvl), y2: VY(lvl), stroke: C.bat, 'stroke-dasharray': '4 3' });
      var segs = [], cur = [];
      t.forEach(function (d) { if (d[2] !== null && d[3] !== null) cur.push(d); else if (cur.length) { segs.push(cur); cur = []; } });
      if (cur.length) segs.push(cur);
      segs.forEach(function (sg) {
        var up = sg.map(function (d) { return X(d[0]).toFixed(1) + ' ' + VY(Math.max(3400, Math.min(4200, d[2]))).toFixed(1); });
        var dn = sg.slice().reverse().map(function (d) { return X(d[0]).toFixed(1) + ' ' + VY(Math.max(3400, Math.min(4200, d[3]))).toFixed(1); });
        el(s, 'path', { d: 'M' + up.join('L') + 'L' + dn.join('L') + 'Z', fill: '#d6e5f7', stroke: C.bat, 'stroke-width': 1.3 });
        if (sg.length === 1) el(s, 'circle', { cx: X(sg[0][0]), cy: VY(sg[0][2]), r: 2.5, fill: C.bat });
      });
      txt(s, m.l + pw, VY(lvl) - 5, 'alarm level', { anchor: 'end', size: 10, fill: C.bat, halo: true });
    } else {
      txt(s, m.l + pw / 2, yV + vH / 2, 'This tag reports no battery voltage', { anchor: 'middle', size: 12, fill: C.faint });
    }
    // records per day
    var nMax = Math.max(10, Math.max.apply(null, t.map(function (d) { return d[1]; })));
    var NY = function (n) { return yN + nH - n / nMax * nH; };
    txt(s, m.l, yN - 8, 'Records per day, red part without a fix', { size: 11.5, fill: C.ink, weight: 600 });
    el(s, 'line', { x1: m.l, x2: m.l + pw, y1: NY(0), y2: NY(0), stroke: C.rule2 });
    txt(s, m.l - 6, NY(nMax) + 4, String(nMax), { anchor: 'end', size: 10, mono: true, fill: C.faint });
    txt(s, m.l - 6, NY(0) + 4, '0', { anchor: 'end', size: 10, mono: true, fill: C.faint });
    t.forEach(function (d) {
      if (d[1] > 0) el(s, 'rect', { x: X(d[0]) - bw / 2, y: NY(d[1]), width: bw, height: NY(0) - NY(d[1]), fill: C.rule2 });
      if (d[4] > 0) el(s, 'rect', { x: X(d[0]) - bw / 2, y: NY(d[4]), width: bw, height: NY(0) - NY(d[4]), fill: C.neg });
    });
    // movement, log scale
    var SY = function (v) { var l = Math.log10(Math.max(1, Math.min(100000, v))); return yM + sH - l / 5 * sH; };
    txt(s, m.l, yM - 8, 'How far it moved within the day', { size: 11.5, fill: C.ink, weight: 600 });
    [[1, '1 m'], [100, '100 m'], [10000, '10 km']].forEach(function (g) {
      el(s, 'line', { x1: m.l, x2: m.l + pw, y1: SY(g[0]), y2: SY(g[0]), stroke: C.rule });
      txt(s, m.l - 6, SY(g[0]) + 4, g[1], { anchor: 'end', size: 10, mono: true, fill: C.faint });
    });
    el(s, 'line', { x1: m.l, x2: m.l + pw, y1: SY(25), y2: SY(25), stroke: C.tri, 'stroke-dasharray': '4 3' });
    txt(s, m.l + pw, SY(25) - 5, 'still below 25 m', { anchor: 'end', size: 10, fill: C.tri, halo: true });
    var pts = t.filter(function (d) { return d[5] !== null; });
    if (pts.length) {
      el(s, 'path', { d: 'M' + pts.map(function (d) { return X(d[0]).toFixed(1) + ' ' + SY(d[5]).toFixed(1); }).join('L'), fill: 'none', stroke: C.ink, 'stroke-width': 1.2 });
      pts.forEach(function (d) { el(s, 'circle', { cx: X(d[0]), cy: SY(d[5]), r: 2.2, fill: C.ink }); });
    } else {
      txt(s, m.l + pw / 2, yM + sH / 2 - 6, 'No position fixes in these days', { anchor: 'middle', size: 12, fill: C.faint, halo: true });
    }
    (narrow ? [44, 0] : [44, 30, 15, 0]).forEach(function (d) {
      txt(s, X(d), H - 8, d === 0 ? 'last day' : d + ' days before', { anchor: d === 0 ? 'end' : (d === 44 ? 'start' : 'middle'), size: 10.5, mono: true, fill: C.faint });
    });
    host.innerHTML = ''; host.appendChild(s);
  }
  function lead(n, who) {
    if (n === null) return who + ' did not fire in time';
    if (n >= 28) return who + (who === 'My rules' ? ' were' : ' was') + ' already firing when the final month began';
    return who + ' first fired ' + n + ' days before the end';
  }
  function tagBox() {
    var e = D.endings[current];
    var q = [e.endc, e.deathc].filter(function (x) { return x && x.trim(); }).join(' ');
    $('#tagbox').innerHTML = '<div class="t">Tag ' + e.tag + ' &middot; stork "' + shortName(e.animal) + '" &middot; ' + e.first + ' to ' + e.last + '</div>' +
      '<div><b>Signature:</b> ' + CAUSE[e.cause] + '. <b>Field record:</b> ' + RECORD[e.record] + (e.mortality ? ' (' + e.mortality.replace(/-/g, ' ') + ')' : '') +
      (e.rec ? '; the logger was recovered' : '') + '. ' + (e.lead !== null && e.leadb !== null && e.lead >= 28 && e.leadb >= 28 ? 'Both alarms were already firing when the final month began' : lead(e.lead, 'My rules') + '; ' + lead(e.leadb, 'the battery alarm')) + '.</div>' +
      (q ? '<div style="margin-top:6px">The researchers wrote: <q>' + q.replace(/</g, '&lt;') + '</q></div>' : '<div style="margin-top:6px">The researchers wrote nothing about this end.</div>');
  }
  function crossTable() {
    var cols = ['alive', 'death', 'vanished', 'none'];
    var head = '<tr><th>Signature in the last week</th><th>seen alive</th><th>died</th><th>vanished</th><th>nothing</th><th>total</th></tr>';
    var body = D.causes.map(function (c) {
      var row = D.cross[c[0]] || {}, tot = 0;
      var cells = cols.map(function (k) { var v = row[k] || 0; tot += v; return '<td class="num">' + (v || '<span style="color:#c9c5be">0</span>') + '</td>'; }).join('');
      return '<tr' + (c[0] === 'stationary' ? ' style="font-weight:600"' : '') + '><td>' + c[1] + '</td>' + cells + '<td class="num">' + tot + '</td></tr>';
    }).join('');
    $('#crosstab').innerHTML = head + body;
  }
  function shows(e) {
    var t = e.tail, v = t.filter(function (d) { return d[2] !== null; }).map(function (d) { return d[2]; });
    var rec = t.reduce(function (a, d) { return a + d[1]; }, 0), nofix = t.reduce(function (a, d) { return a + d[4]; }, 0);
    var days = t.filter(function (d) { return d[1] > 0; }).length;
    var out = 'last ' + t.length + ' days: records on ' + days + ' days';
    if (rec) out += ', ' + Math.round(100 * nofix / rec) + '% without a fix';
    out += v.length ? ', daily high ' + (Math.min.apply(null, v) / 1000).toFixed(2) + ' to ' + (Math.max.apply(null, v) / 1000).toFixed(2) + ' V' : ', no voltage reported';
    return out;
  }
  function ahead(n) { return n === null ? 'no warning' : n >= 28 ? 'already on before the final month' : n + ' days ahead'; }
  function sixCards() {
    var host = $('#six'); host.innerHTML = '';
    D.endings.forEach(function (e, i) {
      if (e.record !== 'alive') return;
      var q = [e.endc, e.deathc].filter(function (x) { return x && x.trim(); }).join(' ');
      if (q.length > 170) q = q.slice(0, 167).replace(/\s+\S*$/, '') + ' [...]';
      var d = document.createElement('div');
      d.innerHTML = '<b>Tag ' + e.tag + '</b> &middot; ' + CAUSE[e.cause].toLowerCase() + '<br>' +
        shows(e) +
        '<br><q style="font-family:Newsreader,Georgia,serif;color:#1a1d21">' + q.replace(/</g, '&lt;') + '</q><br>';
      var b = document.createElement('button'); b.textContent = 'show its final weeks';
      b.addEventListener('click', function () { selectTag(i); $('#endcard').scrollIntoView({ behavior: 'smooth' }); });
      d.appendChild(b); host.appendChild(d);
    });
  }

  /* ---------- act three: the buffalo herd ---------- */
  var collar = null;
  function collarChips() {
    var host = $('#collarchips'); host.innerHTML = '';
    var list = D.collars.slice().sort(function (a, b) { return (b.early - a.early) || a.c.localeCompare(b.c); });
    list.forEach(function (c) {
      var b = document.createElement('button');
      b.className = 'chip' + (c.early ? ' early' : ''); b.dataset.c = c.c;
      b.innerHTML = c.c + (c.early ? '<small>stopped ' + c.last.slice(5) + '</small>' : '');
      b.setAttribute('aria-pressed', 'false');
      b.addEventListener('click', function () { selectCollar(c.c); });
      host.appendChild(b);
    });
  }
  function selectCollar(id) {
    collar = id;
    document.querySelectorAll('#collarchips .chip').forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.c === id)); });
    drawHerd();
  }
  function drawHerd() {
    var c = D.collars.filter(function (x) { return x.c === collar; })[0];
    var host = $('#herdviz'), W = width('#herdviz'), narrow = W < 560;
    var m = { l: narrow ? 30 : 40, r: 10, t: 34, b: 34 }, pw = W - m.l - m.r, ph = narrow ? 170 : 220, H = m.t + ph + m.b;
    var d0 = Date.parse(D.herd[0][0]), d1 = Date.parse(D.herd[D.herd.length - 1][0]), span = (d1 - d0) / 864e5 + 1;
    var X = function (day) { return m.l + ((Date.parse(day) - d0) / 864e5 + 0.5) / span * pw; };
    var yMax = 90, Y = function (n) { return m.t + ph - Math.min(n, yMax) / yMax * ph; };
    var s = svg(W, H);
    s.setAttribute('aria-label', 'Messages per day from collar ' + collar + ' against the herd median');
    [0, 30, 60, 90].forEach(function (g) {
      el(s, 'line', { x1: m.l, x2: m.l + pw, y1: Y(g), y2: Y(g), stroke: C.rule });
      txt(s, m.l - 6, Y(g) + 4, String(g), { anchor: 'end', size: 10, mono: true, fill: C.faint });
    });
    ['2025-07-01', '2025-08-01', '2025-09-01', '2025-10-01'].forEach(function (d) {
      txt(s, X(d), H - 12, ['Jul', 'Aug', 'Sep', 'Oct'][+d.slice(5, 7) - 7], { anchor: 'middle', size: 10.5, mono: true, fill: C.faint });
      el(s, 'line', { x1: X(d), x2: X(d), y1: m.t + ph, y2: m.t + ph + 4, stroke: C.faint });
    });
    var bw = Math.max(1, pw / span - 0.6);
    c.days.forEach(function (d) {
      if (d[1] > 0) el(s, 'rect', { x: X(d[0]) - bw / 2, y: Y(d[1]), width: bw, height: Y(0) - Y(d[1]), fill: c.early ? '#e3b3b3' : C.rule2 });
      if (d[2] > 0) el(s, 'rect', { x: X(d[0]) - bw / 2, y: Y(d[2]), width: bw, height: Y(0) - Y(d[2]), fill: C.neg });
      if (d[3]) el(s, 'path', { d: 'M' + (X(d[0]) - 3) + ' ' + (m.t - 14) + 'l3 5l3 -5z', fill: 'none', stroke: C.ink, 'stroke-width': 1 });
      if (d[4]) el(s, 'path', { d: 'M' + (X(d[0]) - 3) + ' ' + (m.t - 6) + 'l3 5l3 -5z', fill: C.ink });
    });
    var hp = D.herd.filter(function (h) { return h[1] !== null; });
    el(s, 'path', { d: 'M' + hp.map(function (h) { return X(h[0]).toFixed(1) + ' ' + Y(h[1]).toFixed(1); }).join('L'), fill: 'none', stroke: C.ink, 'stroke-width': 1.6 });
    txt(s, m.l + 4, m.t - 20, narrow ? 'line: herd median; marks: rule fired' : 'bars: this collar; line: herd median; marks on top: reporting rule fired (hollow: own past, filled: herd)', { size: 10.5, fill: C.soft });
    if (c.early) {
      el(s, 'line', { x1: X(c.last), x2: X(c.last), y1: m.t, y2: m.t + ph, stroke: C.neg, 'stroke-dasharray': '3 3' });
      txt(s, X(c.last) - 4, m.t + 12, 'last message ' + c.last.slice(5), { anchor: 'end', size: 10.5, mono: true, fill: C.neg, halo: true });
    }
    host.innerHTML = ''; host.appendChild(s);
  }

  /* ---------- act four: signatures to the bench ---------- */
  var SIGS = [
    { id: 'stationary', parts: ['strap'], name: 'Stopped moving', n: V.c_stationary,
      seen: 'Positions within 25 m of each other for two days running before the record ends. ' + D.cross.stationary.death + ' of the ' + V.c_stationary + ' stork tags with this signature belonged to a bird recorded dead.',
      bench: 'Recover the unit and photograph it as received. Inspect the strap, stitching and buckle for fatigue cracks, abrasion and sun damage, and pull test them against new parts. Run the electronics on a bench supply. If they work, the fault did not reproduce at rest, which is not the same as no fault, so repeat under thermal cycling, flex and humidity while monitoring before putting the ending down to the animal or the mounting.',
      data: 'Was the unit still on a moving animal? GPS scatter answers that only roughly; a motion count from the accelerometer would answer it directly.' },
    { id: 'energy', parts: ['panel', 'charger', 'battery'], name: 'Battery or charging ran down', n: V.c_energy,
      seen: 'The daily high voltage falls 100 mV below its recent level for two days, or the last day ends below 3.70 V. Cloud, season and shade move the daily high too, and this rule does not separate them.',
      bench: 'Measure the cell\u2019s capacity and internal resistance against a new cell, with the precautions a lithium cell needs. Trace the panel\u2019s current against voltage under a calibrated lamp and look for cracks, delamination and voids under the lamination. Watch the charger input and output on an oscilloscope at low light, and measure the sleep current.',
      data: 'Was the panel delivering current, or had the cell stopped holding it? Voltage alone cannot tell a dirty panel from a tired cell or a charger fault; charging current and cell temperature would.' },
    { id: 'gps', parts: ['gps'], name: 'GPS lost its fix', n: V.c_gps,
      seen: 'Half the day\u2019s records without a fix, or a time to fix at least double its recent level. On the stork tags this rule was no better than chance, partly because time to fix also grows with the gap since the previous fix.',
      bench: 'Compare the antenna\u2019s return loss with a good unit, in free space and on a body loaded fixture, since a wet hide detunes an antenna. Test the receiver\u2019s sensitivity with an attenuated or simulated satellite signal, and check the antenna feed joint by X-ray or cross section.',
      data: 'Was the sky blocked or the receiver weak? A satellite count and signal strength with every fix would answer it.' },
    { id: 'reporting', parts: ['radio'], name: 'Reports thinned out, battery fine', n: V.c_reporting,
      seen: 'Fewer than half the usual records on two days running while the voltage stays normal. On the stork tags this also happens when a tag cuts its own schedule or the researchers change it, so the row mixes radio faults with programming. On the buffalo collars, comparing with the herd separates a collar from a bad day for everyone.',
      bench: 'Measure transmit power and the current during a transmit burst, with an oscilloscope on the supply rail to catch dips that reset the unit. Check the antenna and its seal for water ingress with a pressure decay test, then an immersion repeat.',
      data: 'Did the unit try to send and fail, or not try at all? A count of attempted and failed transmissions would answer it.' },
    { id: 'none', parts: ['proc', 'battery', 'radio', 'gps'], name: 'No warning in any field', n: V.c_none,
      seen: 'A normal last day on every field, then nothing. On the stork tags ' + V.none_d + ' of these ' + V.c_none + ' were birds recorded dead, ' + V.none_elec_d + ' of them electrocuted on power lines, which can end a tag and its bird in the same minute.',
      bench: 'The unit is the only evidence. CT or X-ray it for cracked joints and board flex, cross section suspect joints, analyse residues for corrosion, and look for impact damage and heat marks.',
      data: 'What happened in its last minute? A final message on brownout or shock, and a reset cause stored for the next start, would say.' }
  ];
  var sigOn = 0;
  function sigCards() {
    var host = $('#sigs'); host.innerHTML = '';
    SIGS.forEach(function (sg, i) {
      var d = document.createElement('div'); d.className = 'sig' + (i === sigOn ? ' on' : '');
      var b = document.createElement('button'); b.setAttribute('aria-expanded', String(i === sigOn));
      b.innerHTML = '<b>' + sg.name + '</b><span>' + sg.n + ' of ' + D.n_silent + ' stork tags</span>';
      b.addEventListener('click', function () { sigOn = i; sigCards(); drawCollar('#benchviz', SIGS[i].parts); });
      var body = document.createElement('div'); body.className = 'body';
      body.innerHTML = '<p><b>Seen in the data</b>' + sg.seen + '</p><p><b>Confirm on the bench</b>' + sg.bench + '</p><p><b>What the data would need to carry</b>' + sg.data + '</p>';
      d.appendChild(b); d.appendChild(body); host.appendChild(d);
    });
  }

  /* ---------- the page checks its own headline ---------- */
  function selfCheck() {
    var t = D.endings.filter(function (e) { return e.lead !== null; }).length;
    var b = D.endings.filter(function (e) { return e.leadb !== null; }).length;
    var ok = t === +V.op_warned && b === +V.bat_warned && D.endings.length === +V.silent;
    document.documentElement.setAttribute('data-selfcheck', ok ? 'pass' : 'fail');
    if (!ok) console.error('headline does not match the data', t, b, D.endings.length);
  }

  /* ---------- the walkthrough ---------- */
  function tour() {
    var root = $('#tour'), hl = $('.tour-hl', root), card = $('.tour-card', root), idx = 0;
    var reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    var STEPS = [
      { sel: 'header h1', k: 'Welcome · 1 of 10', html: 'This page asks whether a collar’s own housekeeping data could have warned that it was about to go quiet, and whether it shows why. The data is public: ' + V.tags + ' solar GPS tags on storks and ' + V.b_collars + ' collars on buffalo.' },
      { sel: '#bluf', k: 'The answer · 2 of 10', html: 'Up is quiet tags warned in time, right is healthy collar months flagged by mistake. The orange line is my four rules, the blue line a low battery alarm, and they overlap. Under the chart, <b>a slider</b> sets how many false alarms you accept and the tiles count what each alarm catches.' },
      { sel: '#qgrid', k: 'The short answers · 3 of 10', html: 'Four questions, one answer each. The first is the one that hurts: the rules I fixed in advance tied a plain low battery alarm.' },
      { sel: '#domainviz', k: 'The collar · 4 of 10', html: 'What a collar is, as blocks, and the housekeeping field that watches each block. Every signature later on points at one of these.' },
      { sel: '#leadcard', k: 'How early · 5 of 10', html: 'Each dot is a tag, placed at the day its alarm first fired. <b>Click a dot</b> to open that tag below. The grey band holds alarms that were already on before the final month.' },
      { sel: '#picker', k: 'Every ending · 6 of 10', html: 'All ' + V.silent + ' tags that went quiet, one square each, sorted into the five signatures. Red squares are birds seen alive after the tag stopped. <b>Click any square</b> to see its last 45 days.' },
      { sel: '#sixhead', k: 'The real failures · 7 of 10', html: 'The ' + V.alive_n + ' tags that failed while their bird lived on. These are the ones a failure analyst wants first. Six are too few to compare alarms on, so each card gives what the tag\u2019s own data showed and quotes the researchers.' },
      { sel: '#herdviz', k: 'Livestock · 8 of 10', html: 'The same reporting rule on ' + V.b_collars + ' buffalo collars, which send no voltage. The chips above the chart choose the collar; <b>click a red one</b> to see a collar that stopped early against the herd.' },
      { sel: '#protocol li:nth-child(3)', k: 'A returned unit · 9 of 10', html: 'Step three of five in the order a returned unit goes through. A unit that works at rest has not been shown healthy, so the stress step comes before anything is called no fault found.' },
      { sel: '#sigs .sig', k: 'To the bench · 10 of 10', html: 'Each signature with the bench work that would confirm it and the field a unit would need to report to settle it. <b>Click a signature</b>; the drawing marks the parts.' }
    ];
    function place() {
      var st = STEPS[idx], elm = document.querySelector(st.sel);
      if (!elm) { next(); return; }
      var r = elm.getBoundingClientRect(), sx = window.scrollX, sy = window.scrollY;
      var docTop = r.top + sy, docLeft = r.left + sx;
      root.style.height = document.documentElement.scrollHeight + 'px';
      var maxScroll = Math.max(0, document.documentElement.scrollHeight - innerHeight);
      var target = Math.max(0, Math.min(docTop - 14, maxScroll)), vTop = docTop - target;
      var cw = Math.min(400, innerWidth - 32), ch = 250;
      var fitsRight = r.left + r.width + 18 + cw <= innerWidth - 16;
      var hh = fitsRight ? r.height : Math.max(120, Math.min(r.height, innerHeight - vTop - ch - 24));
      hl.style.left = (docLeft - 8) + 'px'; hl.style.top = (docTop - 8) + 'px';
      hl.style.width = (r.width + 16) + 'px'; hl.style.height = (hh + 16) + 'px';
      var dots = STEPS.map(function (_, i) { return '<i class="' + (i === idx ? 'on' : '') + '"></i>'; }).join('');
      card.innerHTML = '<div class="tk">' + st.k + '</div><p>' + st.html + '</p><div class="tour-nav"><div class="dots">' + dots + '</div>' +
        (idx > 0 ? '<button class="tour-btn" id="tprev">Back</button>' : '') +
        '<button class="tour-btn" id="tskip">Close</button><button class="tour-btn primary" id="tnext">' + (idx < STEPS.length - 1 ? 'Next' : 'Done') + '</button></div>';
      var cx, cy;
      if (fitsRight) { cx = docLeft + r.width + 18; cy = docTop; }
      else { cx = Math.min(docLeft, sx + innerWidth - 16 - cw); cy = docTop + hh + 22; }
      card.style.left = Math.max(sx + 16, cx) + 'px';
      card.style.top = Math.max(target + 16, cy) + 'px';
      $('#tnext').onclick = next; $('#tskip').onclick = stop;
      var pv = $('#tprev'); if (pv) pv.onclick = function () { idx = Math.max(0, idx - 1); place(); };
      window.scrollTo({ top: target, behavior: reduced ? 'auto' : 'smooth' });
    }
    function next() { if (idx >= STEPS.length - 1) { stop(); return; } idx++; place(); }
    function stop() { root.classList.remove('on'); try { localStorage.setItem('ct-tour', 'seen'); } catch (e) { } }
    function start() { idx = 0; root.classList.add('on'); place(); }
    $('#tourbtn').addEventListener('click', start);
    var replace = function () { if (root.classList.contains('on')) place(); };
    window.addEventListener('resize', replace);
    window.addEventListener('load', replace);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(replace);
    var seen = false; try { seen = localStorage.getItem('ct-tour') === 'seen'; } catch (e) { }
    if (!seen && !location.search.includes('tour=off')) setTimeout(start, 700);
    window.__tour = { steps: STEPS.length, go: function (i) { idx = i; root.classList.add('on'); place(); } };
  }

  /* ---------- go ---------- */
  function drawAll() {
    drawBluf(+$('#budget').value / 100);
    drawCollar('#domainviz');
    drawLead(); drawOverlap();
    drawTag();
    drawHerd();
    drawCollar('#benchviz', SIGS[sigOn].parts);
  }
  document.addEventListener('DOMContentLoaded', function () {
    var sl = $('#budget');
    sl.value = (Math.ceil(D.points.op.x * 1000) / 10).toFixed(1);
    sl.addEventListener('input', function () { drawBluf(+sl.value / 100); });
    buildPicker(); crossTable(); sixCards(); collarChips(); sigCards();
    var first = D.endings.findIndex(function (e) { return e.record === 'alive' && e.cause === 'energy'; });
    current = first >= 0 ? first : 0;
    collar = (D.collars.filter(function (c) { return c.early && c.relTalk; })[0] || D.collars[0]).c;
    selectTag(current); selectCollar(collar);
    drawAll(); selfCheck(); tour();
    var lastW = innerWidth, timer = null;
    window.addEventListener('resize', function () {
      if (Math.abs(innerWidth - lastW) < 8) return;
      lastW = innerWidth; clearTimeout(timer); timer = setTimeout(drawAll, 120);
    });
  });
})();
