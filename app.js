(() => {
  'use strict';

  /* =========================================================
   * 定数
   * ======================================================= */
  const W = 1000;                       // 投影の基準サイズ（画面サイズに依存しない固定投影）
  const KEY = 'world-notes-v4';
  const OLD_KEYS = ['world-notes-v3', 'world-notes-v2', 'world-notes-v1'];
  const TAP_DIST = 8;
  const TAP_MS = 600;
  const PIN_HIT = 20;                   // ピンのタップ判定（画面px）

  // 6種の模様：tile は画面px基準。ズームしても見た目の密度が変わらないよう patternTransform で補正する
  const PATTERNS = [
    { id: 'diag',  name: '斜線', w: 7,  h: 7,
      body: '<path d="M-1,8 L8,-1 M-1,1 L1,-1 M6,8 L8,6" stroke="#111" stroke-width="1" fill="none"/>' },
    { id: 'grid',  name: '格子', w: 9,  h: 9,
      body: '<path d="M0,0.5 H9 M0.5,0 V9" stroke="#111" stroke-width="0.9" fill="none"/>' },
    { id: 'dots',  name: '小粒', w: 5,  h: 5,
      body: '<circle cx="2.5" cy="2.5" r="0.9" fill="#111"/>' },
    { id: 'hline', name: '横線', w: 5,  h: 5,
      body: '<path d="M0,2.5 H5" stroke="#111" stroke-width="1" fill="none"/>' },
    { id: 'vline', name: '縦線', w: 5,  h: 5,
      body: '<path d="M2.5,0 V5" stroke="#111" stroke-width="1" fill="none"/>' },
    { id: 'cross', name: '十字', w: 11, h: 11,
      body: '<path d="M3.5,5.5 H7.5 M5.5,3.5 V7.5" stroke="#111" stroke-width="1" fill="none"/>' }
  ];
  const patName = id => (PATTERNS.find(p => p.id === id) || {}).name || '';

  const KINDS = [
    { id: 'normal',  name: '通常' },
    { id: 'capital', name: '首都' }
  ];

  const HINTS = {
    'draw:pen':          () => `落書き（国境の${state.side === 'above' ? '上' : '下'}）— 1本指で描く／2本指で移動・拡大`,
    'draw:eraser':       () => '消しゴム — なぞって消す（このレイヤーの線のみ）',
    'draw:stroke-eraser':() => '線消し — 消したい線をなぞる',
    'draw:lasso':        () => '投げ縄 — 国の内側を囲む（国境の外には塗れません）',
    'draw:country-fill': () => '国塗り — 国をタップして模様で塗る',
    'draw:fill-eraser':  () => '塗り消し — 塗りをタップして消す',
    'pin':               () => '地図をタップしてピンを追加／ピンをタップして編集',
    'country':           () => '国をタップして国メモを編集'
  };

  /* =========================================================
   * 状態
   * ======================================================= */
  const state = {
    edit: false,
    tool: 'draw',            // draw | pin | country
    sub: 'pen',              // pen | eraser | stroke-eraser | lasso | country-fill | fill-eraser
    side: 'above',           // 落書きを国境の above / below に描く
    viewTarget: 'pin',       // 通常時に見る対象 pin | country
    color: '#1a1a1a',
    width: 3,                // 画面px
    pattern: 'diag',
    pins: [],
    layers: [],              // layers[0] が最上位
    countries: {},           // key -> { memo }
    activeLayerId: null,
    selectedPinId: null,
    selectedCountryKey: null,
    panel: null,             // null | layer | pin | country
    transform: { x: 0, y: 0, k: 1 },
    k0: 1,
    undo: [],
    redo: [],
    showRivers: true
  };

  const $ = id => document.getElementById(id);
  const container = $('map-container');
  const svgBase = d3.select('#svg-base');
  const svgLines = d3.select('#svg-lines');
  const svgPins = d3.select('#svg-pins');
  const cBelow = $('canvas-below');
  const cAbove = $('canvas-above');
  const xBelow = cBelow.getContext('2d');
  const xAbove = cAbove.getContext('2d');
  const offA = document.createElement('canvas');
  const offB = document.createElement('canvas');
  const offA2 = offA.getContext('2d');
  const offB2 = offB.getContext('2d');

  const projection = d3.geoMercator().scale(W / (2 * Math.PI)).translate([W / 2, W / 2]);
  const pathGen = d3.geoPath(projection);

  let sw = 0, sh = 0, dpr = 1;
  let feats = [];
  const byKey = new Map();
  let riverFeats = [];
  let dataReady = false;
  let cur = null;          // 描画中のストローク
  let lasso = null;        // 投げ縄中 {m:[], s:[]}
  const mcache = new WeakMap();

  /* =========================================================
   * ユーティリティ
   * ======================================================= */
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  const round4 = v => Math.round(v * 1e4) / 1e4;
  const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
  const mid = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  function showToast(msg) {
    const t = $('toast');
    t.textContent = msg;
    t.classList.remove('hidden');
    clearTimeout(showToast._t);
    showToast._t = setTimeout(() => t.classList.add('hidden'), 2200);
  }

  let saveTimer = null;
  function saveSoon() { clearTimeout(saveTimer); saveTimer = setTimeout(save, 300); }

  /* =========================================================
   * 保存／読み込み（緯度経度で保存 → 画面サイズが変わってもズレない）
   * ======================================================= */
  function blankLayer(name) {
    return { id: 'L' + uid(), name, visible: true, strokes: [], fills: [] };
  }

  function save() {
    clearTimeout(saveTimer);
    try {
      localStorage.setItem(KEY, JSON.stringify({
        v: 4, pins: state.pins, layers: state.layers, countries: state.countries
      }));
    } catch {
      showToast('保存に失敗しました（容量不足の可能性）');
    }
  }

  // 旧版(v3)は「その時の画面ピクセル座標」で保存されていた。現在の画面サイズで旧投影を再現して緯度経度に変換（ベストエフォート）
  function migrateOld(d) {
    const w = container.clientWidth || window.innerWidth;
    const h = container.clientHeight || window.innerHeight;
    const oldP = d3.geoMercator().scale(w / (2 * Math.PI) * 0.95).translate([w / 2, h * 0.62]);
    const ws = W / (0.95 * w);
    const conv = pt => {
      const ll = oldP.invert(pt);
      return ll && isFinite(ll[0]) && isFinite(ll[1]) && Math.abs(ll[1]) < 85 ? [round4(ll[0]), round4(ll[1])] : null;
    };
    const pins = (d.pins || []).map(p => {
      const ll = conv([p.x, p.y]);
      return ll && { id: p.id, lon: ll[0], lat: ll[1], title: p.title || '', memo: p.memo || '', kind: 'normal' };
    }).filter(Boolean);
    const layers = (d.layers || []).map(l => ({
      id: l.id, name: l.name, visible: l.visible !== false, fills: [],
      strokes: (l.strokes || []).map(s => {
        const pts = (s.points || []).map(conv).filter(Boolean);
        return pts.length > 1 && {
          type: s.type === 'pen' ? 'pen' : 'eraser',
          color: s.color || '#1a1a1a',
          width: +((s.width || 2) * ws).toFixed(3),
          above: true,
          pts
        };
      }).filter(Boolean)
    })).reverse();          // 旧版は配列の先頭が最下位だった
    return { pins, layers, countries: {} };
  }

  function load() {
    let d = null, migrated = false;
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) d = JSON.parse(raw);
      else {
        const k = OLD_KEYS.find(k => localStorage.getItem(k));
        if (k) { d = migrateOld(JSON.parse(localStorage.getItem(k))); migrated = true; }
      }
    } catch { d = null; }
    d = d || {};
    state.pins = (Array.isArray(d.pins) ? d.pins : [])
      .filter(p => p && isFinite(p.lon) && isFinite(p.lat))
      .map(p => ({
        id: p.id || 'P' + uid(), lon: p.lon, lat: p.lat,
        title: p.title || '', memo: p.memo || '',
        kind: KINDS.some(k => k.id === p.kind) ? p.kind : 'normal'
      }));
    state.layers = (Array.isArray(d.layers) && d.layers.length ? d.layers : [blankLayer('メモ')]).map(l => ({
      id: l.id || 'L' + uid(),
      name: l.name || '無題',
      visible: l.visible !== false,
      strokes: (Array.isArray(l.strokes) ? l.strokes : []).filter(s => Array.isArray(s.pts) && s.pts.length > 1)
        .map(s => ({ ...s, above: s.above !== false, px: s.px > 0 ? s.px : clamp((s.width || 0.01) * (window.innerWidth / W), 1.5, 24) })),
      fills: Array.isArray(l.fills) ? l.fills.filter(f => f && (f.kind === 'country' || (f.kind === 'lasso' && Array.isArray(f.pts)))) : []
    }));
    state.countries = d.countries && typeof d.countries === 'object' ? d.countries : {};
    state.activeLayerId = state.layers[0].id;
    if (migrated) save();
  }

  /* =========================================================
   * サイズ／変換
   * ======================================================= */
  function size() {
    const r = container.getBoundingClientRect();
    sw = r.width; sh = r.height;
    dpr = Math.min(window.devicePixelRatio || 1, 3);
    [cBelow, cAbove, offA, offB].forEach(c => {
      c.width = Math.round(sw * dpr);
      c.height = Math.round(sh * dpr);
    });
    d3.selectAll('#svg-base, #svg-lines, #svg-pins').attr('width', sw).attr('height', sh);
  }

  function dockSpace() { return (parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--dock-h')) || 90); }

  function fitView() {
    // 地図が使える緯度帯（北緯78°〜南緯56°）を基準に収める
    const yN = projection([0, 78])[1], yS = projection([0, -56])[1];
    const k = Math.min(sw / W, (sh - 80) / (yS - yN));
    state.k0 = k;
    state.transform = {
      k,
      x: (sw - W * k) / 2,
      y: (sh - dockSpace()) / 2 - k * (yN + yS) / 2 + 10
    };
  }

  function clampTf() {
    const t = state.transform;
    const kMin = state.k0 * 0.8, kMax = Math.max(state.k0 * 60, 12);
    t.k = clamp(t.k, kMin, kMax);
    const m = 70;
    t.x = clamp(t.x, m - W * t.k, sw - m);
    t.y = clamp(t.y, m - W * t.k, sh - m);
  }

  function toMap(sx, sy) {
    const { x, y, k } = state.transform;
    return [(sx - x) / k, (sy - y) / k];
  }

  function zoomBy(sx, sy, f) {
    const t = state.transform;
    const nk = clamp(t.k * f, state.k0 * 0.8, Math.max(state.k0 * 60, 12));
    t.x = sx - (sx - t.x) * (nk / t.k);
    t.y = sy - (sy - t.y) * (nk / t.k);
    t.k = nk;
  }

  let rafId = 0;
  function requestRender() {
    if (rafId) return;
    rafId = requestAnimationFrame(() => { rafId = 0; applyTf(); });
  }

  function applyTf() {
    clampTf();
    const { x, y, k } = state.transform;
    const t = `translate(${x},${y}) scale(${k})`;
    svgBase.select('.world').attr('transform', t);
    svgLines.select('.world').attr('transform', t);
    // 模様は画面上の大きさを一定に保つ（ズームしても密度が変わらない）
    svgBase.selectAll('pattern').attr('patternTransform', `scale(${1 / k})`);
    positionPins();
    redraw();
  }

  /* =========================================================
   * 地図の構築
   * ======================================================= */
  function keyOf(p) { return String(p.ADM0_A3 || p.ISO_A3 || p.ADMIN || p.NAME || ''); }
  function nameOf(p) { return p.NAME_JA || p.NAME_EN || p.NAME || p.ADMIN || '(不明)'; }

  function prepareData(countries, rivers) {
    feats = (countries.features || []).map(f => {
      const p = f.properties || {};
      f._key = keyOf(p);
      f._name = nameOf(p);
      f._d = pathGen(f) || '';
      f._b = pathGen.bounds(f);
      return f;
    }).filter(f => f._d && f._key);
    byKey.clear();
    feats.forEach(f => byKey.set(f._key, f));
    riverFeats = (rivers.features || []).map(f => { f._d = pathGen(f) || ''; return f; }).filter(f => f._d);
  }

  function buildMap() {
    // ---- 下層SVG：陸地＋塗り ----
    svgBase.selectAll('*').remove();
    const defs = svgBase.append('defs');
    PATTERNS.forEach(p => {
      defs.append('pattern')
        .attr('id', 'pat-' + p.id)
        .attr('patternUnits', 'userSpaceOnUse')
        .attr('width', p.w).attr('height', p.h)
        .html(p.body);
    });
    defs.append('g').attr('id', 'clips');
    const bw = svgBase.append('g').attr('class', 'world');
    bw.append('g').attr('class', 'land')
      .selectAll('path').data(feats).join('path')
      .attr('class', 'country').attr('d', d => d._d);
    bw.append('g').attr('class', 'fills');

    // ---- 国境・河川SVG ----
    svgLines.selectAll('*').remove();
    const lw = svgLines.append('g').attr('class', 'world');
    lw.append('g').attr('class', 'borders')
      .selectAll('path').data(feats).join('path')
      .attr('class', 'border').attr('d', d => d._d);
    lw.append('g').attr('class', 'rivers' + (state.showRivers ? '' : ' off'))
      .selectAll('path').data(riverFeats).join('path')
      .attr('class', 'river').attr('d', d => d._d);
    lw.append('path').attr('class', 'hl hidden');

    // ---- ピンSVG（画面座標）----
    svgPins.selectAll('*').remove();
    svgPins.append('g').attr('class', 'pins');
  }

  /* ---------- 塗り（国境でクリップ） ---------- */
  function polyD(m) {
    return 'M' + m.map(p => p[0].toFixed(2) + ',' + p[1].toFixed(2)).join('L') + 'Z';
  }
  const clipId = key => 'clip-' + key.replace(/[^A-Za-z0-9_-]/g, '_');

  function renderFills() {
    if (!dataReady) return;
    const g = svgBase.select('.fills');
    g.selectAll('*').remove();
    const clips = svgBase.select('#clips');
    clips.selectAll('*').remove();
    const used = new Set();

    // 下位レイヤーから順に積む（layers[0]が最上位）
    for (let i = state.layers.length - 1; i >= 0; i--) {
      const layer = state.layers[i];
      if (!layer.visible) continue;
      layer.fills.forEach(f => {
        const feat = byKey.get(f.country);
        if (!feat) return;
        if (f.kind === 'country') {
          g.append('path').attr('d', feat._d).attr('fill', `url(#pat-${f.pattern})`);
        } else {
          const m = mpts(f);
          if (m.length < 3) return;
          used.add(f.country);
          g.append('path').attr('d', polyD(m))
            .attr('fill', `url(#pat-${f.pattern})`)
            .attr('clip-path', `url(#${clipId(f.country)})`);
        }
      });
    }
    used.forEach(key => {
      clips.append('clipPath').attr('id', clipId(key))
        .append('path').attr('d', byKey.get(key)._d);
    });
    svgBase.selectAll('pattern').attr('patternTransform', `scale(${1 / state.transform.k})`);
  }

  function renderHighlight() {
    const hl = svgLines.select('.hl');
    if (hl.empty()) return;
    const f = state.selectedCountryKey && byKey.get(state.selectedCountryKey);
    if (f) hl.attr('d', f._d).classed('hidden', false);
    else hl.classed('hidden', true);
  }

  /* ---------- ピン ---------- */
  function pinShape(kind) {
    return kind === 'capital'
      ? '<circle class="halo" r="6.8"/><circle class="cap" r="4"/>'
      : '<circle class="halo" r="6.8"/><circle class="dot" r="4"/>';
  }
  const pinR = () => 7;

  function renderPins() {
    const root = svgPins.select('g.pins');
    if (root.empty()) return;
    const sel = root.selectAll('g.pin').data(state.pins, d => d.id);
    sel.exit().remove();
    const all = sel.enter().append('g').merge(sel);
    all.attr('class', d => `pin kind-${d.kind}`);
    all.each(function (d) {
      const g = d3.select(this);
      g.html(pinShape(d.kind));
      if (d.id === state.selectedPinId) g.append('circle').attr('class', 'sel').attr('r', pinR(d.kind) + 4);
      if (d.title) g.append('text').attr('class', 'lbl').attr('x', pinR(d.kind) + 4).attr('y', 4).text(d.title);
    });
    positionPins();
  }

  function positionPins() {
    const root = svgPins.select('g.pins');
    if (root.empty()) return;
    const { x, y, k } = state.transform;
    root.selectAll('g.pin').attr('transform', d => {
      const m = projection([d.lon, d.lat]);
      return `translate(${(x + m[0] * k).toFixed(1)},${(y + m[1] * k).toFixed(1)})`;
    });
    root.classed('zoomed', k / state.k0 >= 2.2);
  }

  function pinAt(sx, sy) {
    const { x, y, k } = state.transform;
    let best = null, bd = PIN_HIT;
    state.pins.forEach(p => {
      const m = projection([p.lon, p.lat]);
      const d = Math.hypot(x + m[0] * k - sx, y + m[1] * k - sy);
      if (d < bd) { bd = d; best = p; }
    });
    return best;
  }

  /* ---------- 国の判定 ---------- */
  function featureAtMap(mx, my) {
    const ll = projection.invert([mx, my]);
    if (!ll || !isFinite(ll[0]) || !isFinite(ll[1]) || Math.abs(ll[0]) > 180 || Math.abs(ll[1]) > 85) return null;
    for (const f of feats) {
      const b = f._b;
      if (mx < b[0][0] - 1 || mx > b[1][0] + 1 || my < b[0][1] - 1 || my > b[1][1] + 1) continue;
      if (d3.geoContains(f, ll)) return f;
    }
    return null;
  }

  /* =========================================================
   * 落書きの描画（canvas 2枚：国境の下／上）
   * ======================================================= */
  function activeLayer() { return state.layers.find(l => l.id === state.activeLayerId); }

  function mpts(o) {
    if (o.m) return o.m;
    let m = mcache.get(o);
    if (!m) { m = o.pts.map(p => projection(p)); mcache.set(o, m); }
    return m;
  }

  function setTf(c) {
    const { x, y, k } = state.transform;
    c.setTransform(dpr * k, 0, 0, dpr * k, dpr * x, dpr * y);
  }

  function drawStroke(c, s) {
    const m = mpts(s);
    if (m.length < 2) return;
    c.lineWidth = s.px / state.transform.k;      // 画面上の太さを一定に保つ（拡大縮小しても同じ見た目）
    c.lineCap = 'round';
    c.lineJoin = 'round';
    if (s.type === 'eraser') { c.globalCompositeOperation = 'destination-out'; c.strokeStyle = '#000'; }
    else { c.globalCompositeOperation = 'source-over'; c.strokeStyle = s.color || '#1a1a1a'; }
    c.beginPath();
    c.moveTo(m[0][0], m[0][1]);
    for (let i = 1; i < m.length; i++) c.lineTo(m[i][0], m[i][1]);
    c.stroke();
    c.globalCompositeOperation = 'source-over';
  }

  function drawLayerStrokes(layer) {
    const list = (cur && layer.id === state.activeLayerId) ? layer.strokes.concat([cur]) : layer.strokes;
    if (!list.length) return;
    const hasEraser = list.some(s => s.type === 'eraser');
    if (!hasEraser) {
      list.forEach(s => drawStroke(s.above ? xAbove : xBelow, s));
      return;
    }
    // 消しゴムは「そのレイヤーの線だけ」に効かせる → 一旦オフスクリーンに描いて合成
    [[true, xAbove, offA, offA2], [false, xBelow, offB, offB2]].forEach(([above, target, off, offc]) => {
      const sideList = list.filter(s => s.type === 'eraser' || !!s.above === above);
      if (!sideList.some(s => s.type === 'pen')) return;
      offc.setTransform(1, 0, 0, 1, 0, 0);
      offc.clearRect(0, 0, off.width, off.height);
      setTf(offc);
      sideList.forEach(s => drawStroke(offc, s));
      target.save();
      target.setTransform(1, 0, 0, 1, 0, 0);
      target.drawImage(off, 0, 0);
      target.restore();
    });
  }

  function redraw() {
    [xBelow, xAbove].forEach(c => {
      c.setTransform(1, 0, 0, 1, 0, 0);
      c.clearRect(0, 0, cBelow.width, cBelow.height);
      setTf(c);
    });
    for (let i = state.layers.length - 1; i >= 0; i--) {
      if (state.layers[i].visible) drawLayerStrokes(state.layers[i]);
    }
    // 投げ縄プレビュー（画面座標）
    if (lasso && lasso.s.length > 1) {
      xAbove.setTransform(dpr, 0, 0, dpr, 0, 0);
      xAbove.beginPath();
      lasso.s.forEach((p, i) => (i ? xAbove.lineTo(p[0], p[1]) : xAbove.moveTo(p[0], p[1])));
      xAbove.closePath();
      xAbove.fillStyle = 'rgba(0,0,0,0.08)';
      xAbove.fill();
      xAbove.setLineDash([5, 4]);
      xAbove.lineWidth = 1.6;
      xAbove.strokeStyle = '#111';
      xAbove.stroke();
      xAbove.setLineDash([]);
    }
  }

  /* =========================================================
   * Undo / Redo（操作ごとに undo/redo 関数を持つ）
   * ======================================================= */
  const A = {
    addStroke: (l, s) => ({
      redo() { l.strokes.push(s); },
      undo() { const i = l.strokes.indexOf(s); if (i >= 0) l.strokes.splice(i, 1); }
    }),
    removeStroke: (l, s) => {
      let idx = -1;
      return {
        redo() { idx = l.strokes.indexOf(s); if (idx >= 0) l.strokes.splice(idx, 1); },
        undo() { l.strokes.splice(clamp(idx, 0, l.strokes.length), 0, s); }
      };
    },
    addFill: (l, f) => {
      let rep = [];
      return {
        redo() {
          rep = f.kind === 'country' ? l.fills.filter(x => x.kind === 'country' && x.country === f.country) : [];
          if (rep.length) l.fills = l.fills.filter(x => !rep.includes(x));
          l.fills.push(f);
        },
        undo() { l.fills = l.fills.filter(x => x !== f); l.fills.push(...rep); }
      };
    },
    removeFills: (l, arr) => {
      let idxs = [];
      return {
        redo() {
          idxs = arr.map(f => l.fills.indexOf(f));
          l.fills = l.fills.filter(x => !arr.includes(x));
        },
        undo() {
          arr.forEach((f, i) => l.fills.splice(clamp(idxs[i], 0, l.fills.length), 0, f));
        }
      };
    },
    clear: l => {
      let ss, ff;
      return {
        redo() { ss = l.strokes; ff = l.fills; l.strokes = []; l.fills = []; },
        undo() { l.strokes = ss; l.fills = ff; }
      };
    }
  };

  function afterChange() {
    save();
    renderFills();
    redraw();
    if (state.panel === 'layer') renderLayers();
    if (state.panel === 'country') renderCountryChips();
    updateUndoButtons();
  }
  function perform(a) {
    a.redo();
    state.undo.push(a);
    state.redo.length = 0;
    if (state.undo.length > 300) state.undo.shift();
    afterChange();
  }
  function undo() { const a = state.undo.pop(); if (!a) return; a.undo(); state.redo.push(a); afterChange(); }
  function redo() { const a = state.redo.pop(); if (!a) return; a.redo(); state.undo.push(a); afterChange(); }
  function updateUndoButtons() {
    $('btn-undo').disabled = !state.undo.length;
    $('btn-redo').disabled = !state.redo.length;
  }

  /* =========================================================
   * 落書き操作
   * ======================================================= */
  function drawable() {
    const l = activeLayer();
    if (!l) return null;
    if (!l.visible) { showToast('非表示のレイヤーには描けません'); return null; }
    return l;
  }

  function startStroke(sx, sy) {
    if (!drawable()) return false;
    const eraser = state.sub === 'eraser';
    const px = eraser ? Math.max(14, state.width * 3) : state.width;
    cur = {
      type: eraser ? 'eraser' : 'pen',
      color: state.color,
      px,
      above: state.side === 'above',
      m: [toMap(sx, sy)]
    };
    redraw();
    return true;
  }

  function moveStroke(sx, sy) {
    if (!cur) return;
    const p = toMap(sx, sy), l = cur.m[cur.m.length - 1];
    if (Math.hypot(p[0] - l[0], p[1] - l[1]) * state.transform.k < 1.2) return;
    cur.m.push(p);
    redraw();
  }

  function finishStroke() {
    const s = cur; cur = null;
    const layer = activeLayer();
    if (!s || !layer) { redraw(); return; }
    let m = s.m;
    if (m.length === 1) m = [m[0], [m[0][0] + 0.0005, m[0][1]]];
    const stroke = {
      type: s.type, color: s.color, px: s.px, above: s.above,
      pts: m.map(p => { const ll = projection.invert(p); return [round4(ll[0]), round4(ll[1])]; })
    };
    mcache.set(stroke, m);
    perform(A.addStroke(layer, stroke));
  }

  function distPointToSeg(px, py, ax, ay, bx, by) {
    const dx = bx - ax, dy = by - ay, len2 = dx * dx + dy * dy;
    if (!len2) return Math.hypot(px - ax, py - ay);
    const t = clamp(((px - ax) * dx + (py - ay) * dy) / len2, 0, 1);
    return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
  }

  function eraseStrokeAt(sx, sy) {
    const layer = drawable();
    if (!layer) return;
    const [mx, my] = toMap(sx, sy);
    const thr = 14 / state.transform.k;
    let best = null, bd = Infinity;
    layer.strokes.forEach(s => {
      if (s.type !== 'pen') return;
      const m = mpts(s);
      for (let i = 1; i < m.length; i++) {
        const d = distPointToSeg(mx, my, m[i - 1][0], m[i - 1][1], m[i][0], m[i][1]) - s.px / 2 / state.transform.k;
        if (d < bd) { bd = d; best = s; }
      }
    });
    if (best && bd <= thr) perform(A.removeStroke(layer, best));
  }

  /* ---------- 投げ縄塗り ---------- */
  function startLasso(sx, sy) {
    if (!drawable()) return false;
    lasso = { m: [toMap(sx, sy)], s: [[sx, sy]] };
    return true;
  }
  function moveLasso(sx, sy) {
    if (!lasso) return;
    const l = lasso.s[lasso.s.length - 1];
    if (Math.hypot(sx - l[0], sy - l[1]) < 2.5) return;
    lasso.s.push([sx, sy]);
    lasso.m.push(toMap(sx, sy));
    redraw();
  }
  function finishLasso() {
    const L = lasso; lasso = null;
    redraw();
    const layer = activeLayer();
    if (!L || !layer) return;
    const xs = L.s.map(p => p[0]), ys = L.s.map(p => p[1]);
    if (L.m.length < 6 || Math.max(...xs) - Math.min(...xs) < 8 || Math.max(...ys) - Math.min(...ys) < 8) {
      showToast('もう少し大きく囲んでください');
      return;
    }
    // 囲んだ線の上にある国を数え、最も多い国を対象にする（ひとつの国にしか塗れない）
    const step = Math.max(1, Math.floor(L.m.length / 60));
    const count = new Map();
    for (let i = 0; i < L.m.length; i += step) {
      const f = featureAtMap(L.m[i][0], L.m[i][1]);
      if (f) count.set(f._key, (count.get(f._key) || 0) + 1);
    }
    if (!count.size) { showToast('国の内側を囲んでください'); return; }
    const key = [...count.entries()].sort((a, b) => b[1] - a[1])[0][0];
    const fill = {
      id: 'F' + uid(), kind: 'lasso', country: key, pattern: state.pattern,
      pts: L.m.map(p => { const ll = projection.invert(p); return [round4(ll[0]), round4(ll[1])]; })
    };
    mcache.set(fill, L.m);
    perform(A.addFill(layer, fill));
  }

  /* ---------- 国塗り・塗り消し ---------- */
  function fillCountryAt(sx, sy) {
    const layer = drawable();
    if (!layer) return;
    const f = featureAtMap(...toMap(sx, sy));
    if (!f) { showToast('国をタップしてください'); return; }
    perform(A.addFill(layer, { id: 'F' + uid(), kind: 'country', country: f._key, pattern: state.pattern }));
  }

  function eraseFillAt(sx, sy) {
    const layer = drawable();
    if (!layer) return;
    const [mx, my] = toMap(sx, sy);
    const ll = projection.invert([mx, my]);
    for (let i = layer.fills.length - 1; i >= 0; i--) {
      const f = layer.fills[i];
      const feat = byKey.get(f.country);
      if (!feat) continue;
      let hit = false;
      if (f.kind === 'country') hit = !!ll && d3.geoContains(feat, ll);
      else hit = d3.polygonContains(mpts(f), [mx, my]) && !!ll && d3.geoContains(feat, ll);
      if (hit) { perform(A.removeFills(layer, [f])); return; }
    }
    showToast('消せる塗りがありません');
  }

  function setCountryPattern(key, pid) {
    const layer = drawable();
    if (!layer) return;
    const existing = layer.fills.filter(f => f.kind === 'country' && f.country === key);
    if (!pid) {
      if (existing.length) perform(A.removeFills(layer, existing));
      return;
    }
    if (existing.length === 1 && existing[0].pattern === pid) return;
    perform(A.addFill(layer, { id: 'F' + uid(), kind: 'country', country: key, pattern: pid }));
  }

  function clearActiveLayer() {
    const layer = activeLayer();
    if (!layer) return;
    if (!layer.strokes.length && !layer.fills.length) { showToast('消すものがありません'); return; }
    if (!confirm(`「${layer.name}」の落書きと塗りをすべて消しますか？`)) return;
    perform(A.clear(layer));
    showToast('全消ししました（元に戻せます）');
  }

  /* =========================================================
   * ポインタ操作（マウス・タッチ・ペン共通）
   * ======================================================= */
  const ptrs = new Map();
  let g = null;          // 現在のジェスチャ
  let pinch = null;

  function pos(e) {
    const r = container.getBoundingClientRect();
    return [e.clientX - r.left, e.clientY - r.top];
  }

  function abortGesture() {
    if (cur || lasso) { cur = null; lasso = null; redraw(); }
    g = null; pinch = null;
    container.classList.remove('panning');
  }

  function startPan(sx, sy, tap) {
    g = { type: 'pan', sx, sy, ox: state.transform.x, oy: state.transform.y, moved: false, tap, t: Date.now() };
  }

  container.addEventListener('contextmenu', e => e.preventDefault());

  container.addEventListener('pointerdown', e => {
    if (!dataReady) return;
    try { container.setPointerCapture(e.pointerId); } catch { /* noop */ }
    ptrs.set(e.pointerId, pos(e));
    if (ptrs.size === 2) {              // 2本指：常に移動・ズーム
      abortGesture();
      const [a, b] = [...ptrs.values()];
      pinch = { d: Math.max(dist(a, b), 1), m: mid(a, b) };
      g = { type: 'pinch' };
      return;
    }
    if (ptrs.size > 2) return;
    e.preventDefault();
    const [sx, sy] = pos(e);

    if (e.pointerType === 'mouse' && e.button !== 0) {   // 右/中ボタン：どのモードでも移動
      startPan(sx, sy, false);
      g.moved = true;
      container.classList.add('panning');
      return;
    }

    if (state.edit && state.tool === 'draw') {
      if (state.sub === 'pen' || state.sub === 'eraser') {
        if (startStroke(sx, sy)) { g = { type: 'stroke' }; return; }
        g = { type: 'none' }; return;
      }
      if (state.sub === 'stroke-eraser') { g = { type: 'serase' }; eraseStrokeAt(sx, sy); return; }
      if (state.sub === 'lasso') {
        if (startLasso(sx, sy)) { g = { type: 'lasso' }; return; }
        g = { type: 'none' }; return;
      }
    }
    startPan(sx, sy, true);
  });

  container.addEventListener('pointermove', e => {
    if (!ptrs.has(e.pointerId)) return;
    const p = pos(e);
    ptrs.set(e.pointerId, p);
    if (!g) return;

    if (g.type === 'pinch') {
      if (ptrs.size !== 2) return;
      const [a, b] = [...ptrs.values()];
      const d = Math.max(dist(a, b), 1), m = mid(a, b);
      zoomBy(pinch.m[0], pinch.m[1], d / pinch.d);
      state.transform.x += m[0] - pinch.m[0];
      state.transform.y += m[1] - pinch.m[1];
      pinch = { d, m };
      requestRender();
    } else if (g.type === 'stroke') {
      const evs = e.getCoalescedEvents ? e.getCoalescedEvents() : [e];
      (evs.length ? evs : [e]).forEach(ev => { const q = pos(ev); moveStroke(q[0], q[1]); });
    } else if (g.type === 'lasso') {
      moveLasso(p[0], p[1]);
    } else if (g.type === 'serase') {
      eraseStrokeAt(p[0], p[1]);
    } else if (g.type === 'pan') {
      const dx = p[0] - g.sx, dy = p[1] - g.sy;
      if (!g.moved && Math.hypot(dx, dy) > TAP_DIST) { g.moved = true; container.classList.add('panning'); }
      if (g.moved) {
        state.transform.x = g.ox + dx;
        state.transform.y = g.oy + dy;
        requestRender();
      }
    }
  });

  function endPointer(e, cancelled) {
    if (!ptrs.delete(e.pointerId)) return;
    if (g && g.type === 'pinch') {
      if (ptrs.size === 0) { g = null; pinch = null; } else g = { type: 'none' };
      return;
    }
    if (g && g.type === 'none') { if (!ptrs.size) g = null; return; }
    const cg = g;
    g = null;
    container.classList.remove('panning');
    if (!cg) return;
    if (cg.type === 'stroke') { if (cancelled) { cur = null; redraw(); } else finishStroke(); }
    else if (cg.type === 'lasso') { if (cancelled) { lasso = null; redraw(); } else finishLasso(); }
    else if (cg.type === 'pan' && !cancelled && cg.tap && !cg.moved && Date.now() - cg.t < TAP_MS) {
      handleTap(cg.sx, cg.sy);
    }
  }
  container.addEventListener('pointerup', e => endPointer(e, false));
  container.addEventListener('pointercancel', e => endPointer(e, true));

  container.addEventListener('wheel', e => {
    e.preventDefault();
    const [sx, sy] = pos(e);
    const dy = e.deltaY * (e.deltaMode === 1 ? 16 : 1);
    zoomBy(sx, sy, Math.exp(-dy * (e.ctrlKey ? 0.01 : 0.0018)));
    requestRender();
  }, { passive: false });

  /* ---------- タップ ---------- */
  function handleTap(sx, sy) {
    // 通常時：閲覧のみ
    if (!state.edit) {
      if (state.viewTarget === 'pin') {
        const p = pinAt(sx, sy);
        if (p) openPin(p); else if (state.panel === 'pin') closeMemo();
      } else {
        const f = featureAtMap(...toMap(sx, sy));
        if (f) openCountry(f); else if (state.panel === 'country') closeMemo();
      }
      return;
    }
    // 編集時
    if (state.tool === 'pin') {
      const p = pinAt(sx, sy);
      if (p) { openPin(p); return; }
      if (state.panel === 'pin') { closeMemo(); return; }   // 誤配置防止：先にパネルを閉じる
      placePin(sx, sy);
    } else if (state.tool === 'country') {
      const f = featureAtMap(...toMap(sx, sy));
      if (f) openCountry(f); else if (state.panel === 'country') closeMemo();
    } else if (state.tool === 'draw') {
      if (state.sub === 'country-fill') fillCountryAt(sx, sy);
      else if (state.sub === 'fill-eraser') eraseFillAt(sx, sy);
    }
  }

  /* =========================================================
   * ピン
   * ======================================================= */
  function placePin(sx, sy) {
    const ll = projection.invert(toMap(sx, sy));
    if (!ll || Math.abs(ll[1]) > 85) return;
    const pin = { id: 'P' + uid(), lon: round4(ll[0]), lat: round4(ll[1]), title: '', memo: '', kind: 'normal' };
    state.pins.push(pin);
    save();
    openPin(pin);
  }

  function curPin() { return state.pins.find(p => p.id === state.selectedPinId); }

  function openPin(pin) {
    closeMemo(true);
    state.selectedPinId = pin.id;
    // 編集用
    $('pin-title').value = pin.title;
    $('pin-memo').value = pin.memo;
    // 閲覧用：タイトルとメモだけ（メモが空なら出さない／通常属性は出さない）
    $('pin-v-title').textContent = pin.title || '（無題）';
    const memo = (pin.memo || '').trim();
    $('pin-v-memo').textContent = pin.memo;
    $('pin-v-memo').classList.toggle('hidden', !memo);
    $('pin-v-badge').classList.toggle('hidden', pin.kind !== 'capital');
    markKinds();
    setPanel('pin');
    renderPins();
  }

  function markKinds() {
    const p = curPin();
    $('kind-chips').querySelectorAll('button').forEach(b => b.classList.toggle('active', !!p && b.dataset.kind === p.kind));
  }

  /* =========================================================
   * 国メモ
   * ======================================================= */
  function openCountry(f) {
    closeMemo(true);
    state.selectedCountryKey = f._key;
    $('country-head').textContent = f._name;
    $('country-v-title').textContent = f._name;
    const memo = (state.countries[f._key] || {}).memo || '';
    $('country-memo').value = memo;
    $('country-v-memo').textContent = memo;
    $('country-v-memo').classList.toggle('hidden', !memo.trim());
    renderCountryChips();
    setPanel('country');
    renderHighlight();
  }

  function renderCountryChips() {
    const key = state.selectedCountryKey;
    if (!key) return;
    const layer = activeLayer();
    const f = layer && layer.fills.filter(x => x.kind === 'country' && x.country === key).pop();
    markChips($('country-chips'), f ? f.pattern : 'none');
    $('country-layer-note').textContent = layer
      ? `塗りはレイヤー「${layer.name}」に追加されます。${layer.visible ? '' : '（このレイヤーは非表示です）'}`
      : '';
  }

  /* =========================================================
   * パネル管理
   * ======================================================= */
  function setPanel(name) {
    state.panel = name;
    ['layer', 'pin', 'country'].forEach(n => $(n + '-panel').classList.toggle('hidden', n !== name));
    $('app').classList.toggle('panel-open', !!name);
    $('btn-layers').classList.toggle('active', name === 'layer');
    if (name === 'layer') renderLayers();
  }

  // ピン・国パネルを閉じる（編集中の内容は保存）
  function closeMemo(keepPanelState) {
    if (state.edit) save();
    const hadPin = state.selectedPinId, hadCountry = state.selectedCountryKey;
    state.selectedPinId = null;
    state.selectedCountryKey = null;
    if (!keepPanelState && (state.panel === 'pin' || state.panel === 'country')) setPanel(null);
    if (hadPin) renderPins();
    if (hadCountry || true) renderHighlight();
  }

  function toggleLayerPanel() {
    if (state.panel === 'layer') setPanel(null);
    else { closeMemo(true); setPanel('layer'); }
  }

  /* =========================================================
   * レイヤーUI
   * ======================================================= */
  const ICON = {
    eye: '<svg viewBox="0 0 24 24" class="icon"><path d="M2 12s4-6 10-6 10 6 10 6-4 6-10 6S2 12 2 12z" fill="none" stroke="currentColor" stroke-width="1.7"/><circle cx="12" cy="12" r="2.5" fill="none" stroke="currentColor" stroke-width="1.7"/></svg>',
    eyeOff: '<svg viewBox="0 0 24 24" class="icon"><path d="M3 3l18 18M10.5 10.6A2.5 2.5 0 0013.4 13.5M6.7 6.8C4.3 8.3 2 12 2 12s4 6 10 6c1.6 0 3.1-.4 4.4-1M14 6.2c2.2.7 4.3 2.3 6 5.8 0 0-1.2 1.8-3 3.2" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>',
    up: '<svg viewBox="0 0 24 24" class="icon"><path d="M6 14l6-6 6 6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    down: '<svg viewBox="0 0 24 24" class="icon"><path d="M6 10l6 6 6-6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    del: '<svg viewBox="0 0 24 24" class="icon"><path d="M5 7h14M9 7V5h6v2M8 7l1 12h6l1-12" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>'
  };

  function renderLayers() {
    const list = $('layer-list');
    list.innerHTML = '';
    state.layers.forEach((layer, i) => {
      const div = document.createElement('div');
      div.className = 'layer-item' + (layer.id === state.activeLayerId ? ' active' : '') + (layer.visible ? '' : ' off');
      div.dataset.id = layer.id;
      const nLines = layer.strokes.filter(s => s.type === 'pen').length;
      div.innerHTML = `
        <button class="eye ${layer.visible ? '' : 'off'}" data-act="eye" title="${layer.visible ? '非表示にする' : '表示する'}" aria-label="表示切替">${layer.visible ? ICON.eye : ICON.eyeOff}</button>
        <div class="lbody">
          <input type="text" class="lname" value="${esc(layer.name)}" maxlength="40" ${state.edit ? '' : 'readonly'} />
          <div class="lmeta">線 <b>${nLines}</b> ・ 塗り <b>${layer.fills.length}</b>${i === 0 ? ' ・ 最上位' : ''}${layer.id === state.activeLayerId ? ' ・ 描画先' : ''}</div>
        </div>
        <div class="lactions edit-only">
          <button data-act="up" title="上へ" ${i === 0 ? 'disabled' : ''}>${ICON.up}</button>
          <button data-act="down" title="下へ" ${i === state.layers.length - 1 ? 'disabled' : ''}>${ICON.down}</button>
          <button data-act="del" title="削除">${ICON.del}</button>
        </div>`;
      list.appendChild(div);
    });
  }

  $('layer-list').addEventListener('click', e => {
    const item = e.target.closest('.layer-item');
    if (!item) return;
    const layer = state.layers.find(l => l.id === item.dataset.id);
    if (!layer) return;
    const btn = e.target.closest('button');
    const act = btn && btn.dataset.act;
    if (act === 'eye') {
      layer.visible = !layer.visible;
      save(); renderLayers(); renderFills(); redraw();
      if (state.panel === 'country') renderCountryChips();
      return;
    }
    if (act && state.edit) {
      const i = state.layers.indexOf(layer);
      if (act === 'up' && i > 0) [state.layers[i - 1], state.layers[i]] = [state.layers[i], state.layers[i - 1]];
      else if (act === 'down' && i < state.layers.length - 1) [state.layers[i + 1], state.layers[i]] = [state.layers[i], state.layers[i + 1]];
      else if (act === 'del') {
        if (state.layers.length <= 1) { showToast('レイヤーは最低1つ必要です'); return; }
        if (!confirm(`レイヤー「${layer.name}」を削除しますか？（元に戻せません）`)) return;
        state.layers = state.layers.filter(l => l !== layer);
        if (state.activeLayerId === layer.id) state.activeLayerId = state.layers[0].id;
        state.undo.length = 0; state.redo.length = 0; updateUndoButtons();
      }
      save(); renderLayers(); renderFills(); redraw();
      return;
    }
    // カードをタップ → 描画先に設定
    if (state.activeLayerId !== layer.id) {
      state.activeLayerId = layer.id;
      $('layer-list').querySelectorAll('.layer-item').forEach(el => el.classList.toggle('active', el.dataset.id === layer.id));
      renderLayers();
      if (state.panel === 'country') renderCountryChips();
    }
  });

  $('layer-list').addEventListener('change', e => {
    if (!e.target.classList.contains('lname') || !state.edit) return;
    const item = e.target.closest('.layer-item');
    const layer = state.layers.find(l => l.id === item.dataset.id);
    if (layer) { layer.name = e.target.value.trim() || '無題'; e.target.value = layer.name; save(); }
  });

  /* =========================================================
   * UI（模様チップ・状態反映）
   * ======================================================= */
  let swId = 0;
  function swatch(p) {
    const id = 'sw' + (swId++);
    const body = p
      ? `<defs><pattern id="${id}" patternUnits="userSpaceOnUse" width="${p.w}" height="${p.h}">${p.body}</pattern></defs>
         <rect x=".5" y=".5" width="29" height="29" rx="6" fill="#fff"/>
         <rect x=".5" y=".5" width="29" height="29" rx="6" fill="url(#${id})"/>`
      : `<rect x=".5" y=".5" width="29" height="29" rx="6" fill="#fff"/><path d="M7 7l16 16" stroke="#999" stroke-width="1.4" stroke-linecap="round"/>`;
    return `<svg viewBox="0 0 30 30" width="30" height="30">${body}<rect x=".5" y=".5" width="29" height="29" rx="6" fill="none" stroke="#bbb"/></svg>`;
  }

  function buildChips(el, withNone, onPick) {
    el.innerHTML = '';
    const items = (withNone ? [null] : []).concat(PATTERNS);
    items.forEach(p => {
      const b = document.createElement('button');
      b.className = 'pchip';
      b.dataset.pid = p ? p.id : 'none';
      b.title = p ? p.name : 'なし';
      b.innerHTML = swatch(p) + `<span>${p ? p.name : 'なし'}</span>`;
      b.onclick = () => onPick(p ? p.id : null);
      el.appendChild(b);
    });
  }
  function markChips(el, pid) {
    el.querySelectorAll('.pchip').forEach(b => b.classList.toggle('active', b.dataset.pid === pid));
  }

  function updateUI() {
    const app = $('app');
    app.classList.toggle('edit', state.edit);
    $('lbl-edit').textContent = state.edit ? '完了' : '編集';
    $('bar-edit').classList.toggle('hidden', !state.edit);
    $('bar-draw').classList.toggle('hidden', !(state.edit && state.tool === 'draw'));

    $('seg-tool').querySelectorAll('button').forEach(b => b.classList.toggle('active', b.dataset.tool === state.tool));
    $('seg-sub').querySelectorAll('button[data-sub]').forEach(b => b.classList.toggle('active', b.dataset.sub === state.sub));
    $('seg-side').querySelectorAll('button').forEach(b => b.classList.toggle('active', b.dataset.side === state.side));
    $('view-pin').classList.toggle('active', state.viewTarget === 'pin');
    $('view-country').classList.toggle('active', state.viewTarget === 'country');
    $('btn-rivers').classList.toggle('active', state.showRivers);

    const s = state.sub;
    $('opt-pen').classList.toggle('hidden', s !== 'pen');
    $('opt-width').classList.toggle('hidden', !(s === 'pen' || s === 'eraser'));
    $('width-label').textContent = s === 'eraser' ? '消しゴム' : '太さ';
    $('opt-pattern').classList.toggle('hidden', !(s === 'lasso' || s === 'country-fill'));
    markChips($('pattern-chips'), state.pattern);

    container.classList.toggle('editing', state.edit);
    updateUndoButtons();

    const hint = $('mode-hint');
    if (state.edit) {
      const h = HINTS[state.tool === 'draw' ? 'draw:' + state.sub : state.tool];
      hint.textContent = h ? h() : '';
      hint.classList.toggle('hidden', !h);
    } else hint.classList.add('hidden');
    syncDock();
  }

  function syncDock() {
    const h = $('dock').getBoundingClientRect().height;
    document.documentElement.style.setProperty('--dock-h', Math.ceil(h) + 'px');
  }

  function setEdit(on) {
    if (state.edit === on) return;
    abortGesture();
    if (state.edit) save();
    closeMemo();                        // 閉じてから編集可否を切り替える
    state.edit = on;
    if (on) state.tool = 'pin';          // 編集を開くたびに「ピン」から始める
    updateUI();
    if (state.panel === 'layer') renderLayers();
  }

  /* =========================================================
   * イベント束ね
   * ======================================================= */
  function bind() {
    $('btn-edit').onclick = () => setEdit(!state.edit);
    $('view-pin').onclick = () => { if (state.viewTarget !== 'pin') { closeMemo(); state.viewTarget = 'pin'; updateUI(); } };
    $('view-country').onclick = () => { if (state.viewTarget !== 'country') { closeMemo(); state.viewTarget = 'country'; updateUI(); } };

    $('seg-tool').addEventListener('click', e => {
      const b = e.target.closest('button'); if (!b) return;
      abortGesture(); closeMemo();
      state.tool = b.dataset.tool;
      updateUI();
    });
    $('seg-sub').addEventListener('click', e => {
      const b = e.target.closest('button[data-sub]'); if (!b) return;
      abortGesture();
      state.sub = b.dataset.sub;
      updateUI();
    });
    $('seg-side').addEventListener('click', e => {
      const b = e.target.closest('button'); if (!b) return;
      state.side = b.dataset.side;
      updateUI();
    });
    $('btn-clear-layer').onclick = clearActiveLayer;
    $('color-picker').oninput = e => { state.color = e.target.value; };
    $('stroke-width').oninput = e => { state.width = parseFloat(e.target.value) || 3; };
    $('btn-undo').onclick = undo;
    $('btn-redo').onclick = redo;

    $('btn-layers').onclick = toggleLayerPanel;
    $('btn-close-layers').onclick = () => setPanel(null);
    $('btn-add-layer').onclick = () => {
      if (!state.edit) return;
      const l = blankLayer('新しいレイヤー');
      state.layers.unshift(l);
      state.activeLayerId = l.id;
      save(); renderLayers();
    };

    $('btn-rivers').onclick = () => {
      state.showRivers = !state.showRivers;
      svgLines.select('.rivers').classed('off', !state.showRivers);
      updateUI();
    };
    $('btn-reset-view').onclick = () => { fitView(); applyTf(); };

    // ピン
    $('btn-close-pin').onclick = () => closeMemo();
    $('pin-title').addEventListener('input', () => {
      const p = curPin(); if (!p || !state.edit) return;
      p.title = $('pin-title').value;
      renderPins(); saveSoon();
    });
    $('pin-memo').addEventListener('input', () => {
      const p = curPin(); if (!p || !state.edit) return;
      p.memo = $('pin-memo').value; saveSoon();
    });
    $('btn-save-pin').onclick = () => { if (!state.edit) return; save(); showToast('保存しました'); closeMemo(); };
    $('btn-delete-pin').onclick = () => {
      if (!state.edit) return;
      const p = curPin(); if (!p) return;
      if (!confirm(`ピン「${p.title || '(無題)'}」を削除しますか？`)) return;
      state.pins = state.pins.filter(x => x !== p);
      state.selectedPinId = null;
      save(); closeMemo(); renderPins();
      showToast('ピンを削除しました');
    };
    const kc = $('kind-chips');
    KINDS.forEach(k => {
      const b = document.createElement('button');
      b.dataset.kind = k.id; b.textContent = k.name;
      b.onclick = () => {
        const p = curPin(); if (!p || !state.edit) return;
        p.kind = k.id; save(); markKinds(); renderPins();
      };
      kc.appendChild(b);
    });

    // 国メモ
    $('btn-close-country').onclick = () => closeMemo();
    $('country-memo').addEventListener('input', () => {
      const key = state.selectedCountryKey; if (!key || !state.edit) return;
      const v = $('country-memo').value;
      if (v.trim()) state.countries[key] = { memo: v }; else delete state.countries[key];
      saveSoon();
    });
    $('btn-save-country').onclick = () => { if (!state.edit) return; save(); showToast('保存しました'); closeMemo(); };

    buildChips($('pattern-chips'), false, pid => { state.pattern = pid; markChips($('pattern-chips'), pid); });
    buildChips($('country-chips'), true, pid => {
      if (!state.edit || !state.selectedCountryKey) return;
      setCountryPattern(state.selectedCountryKey, pid);
      renderCountryChips();
    });

    window.addEventListener('keydown', e => {
      if (e.target.matches('input, textarea')) return;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && state.edit) { e.preventDefault(); e.shiftKey ? redo() : undo(); }
      else if (e.key === 'Escape') { abortGesture(); closeMemo(); if (state.panel === 'layer') setPanel(null); }
    });

    window.addEventListener('resize', () => { size(); syncDock(); applyTf(); });
    if (window.ResizeObserver) new ResizeObserver(syncDock).observe($('dock'));
  }

  /* =========================================================
   * 起動
   * ======================================================= */
  async function boot() {
    load();
    size();
    bind();
    updateUI();
    try {
      const base = 'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/';
      const [countries, rivers] = await Promise.all([
        d3.json(base + 'ne_50m_admin_0_countries.geojson'),
        d3.json(base + 'ne_50m_rivers_lake_centerlines.geojson')
      ]);
      prepareData(countries, rivers);
    } catch (err) {
      console.error(err);
      $('loading').textContent = '地図データの読み込みに失敗しました。通信状況を確認して再読み込みしてください。';
      return;
    }
    buildMap();
    dataReady = true;
    fitView();
    renderFills();
    renderPins();
    applyTf();
    $('loading').classList.add('hidden');
    
  }

  boot();
})();
