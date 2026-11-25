(() => {
  'use strict';

  const state = {
    pins: [],
    layers: [],
    activeLayerId: null,
    selectedPinId: null,
    // modes: none | draw | pin
    mode: 'none',
    tool: 'pen', // pen | eraser-normal | eraser-stroke
    color: '#1a1a1a',
    strokeWidth: 2,
    transform: { x: 0, y: 0, k: 1 },
    isDrawing: false,
    currentStroke: null,
    undoStack: [],
    redoStack: [],
    projection: null,
    pathGen: null,
    width: 0,
    height: 0,
    countryFeatures: null,
    riverFeatures: null,
    ptr: null,
    showRivers: true,
  };

  const STORAGE = 'world-notes-v3';
  const TAP_DIST = 12;
  const TAP_MS = 320;
  // visual pin radius in screen px (kept roughly constant across zoom)
  const PIN_SCREEN_R = 3.2;

  const svg = d3.select('#map-svg');
  const canvas = document.getElementById('draw-canvas');
  const ctx = canvas.getContext('2d');
  const container = document.getElementById('map-container');
  const toastEl = document.getElementById('toast');
  const modeHint = document.getElementById('mode-hint');

  // ---------- storage (migrate old keys if present) ----------
  function load() {
    try {
      let raw = localStorage.getItem(STORAGE);
      if (!raw) {
        // try older keys
        raw = localStorage.getItem('world-notes-v2') || localStorage.getItem('world-notes-v1');
      }
      const d = raw ? JSON.parse(raw) : {};
      state.pins = Array.isArray(d.pins) ? d.pins : [];
      state.layers = Array.isArray(d.layers) && d.layers.length
        ? d.layers
        : [{ id: 'L' + Date.now(), name: 'メモ', visible: true, strokes: [] }];
      // ensure strokes array
      state.layers.forEach(l => { if (!Array.isArray(l.strokes)) l.strokes = []; });
      state.activeLayerId = state.layers[0].id;
      // persist under current key
      save();
    } catch {
      state.layers = [{ id: 'L' + Date.now(), name: 'メモ', visible: true, strokes: [] }];
      state.activeLayerId = state.layers[0].id;
      state.pins = [];
    }
  }

  function save() {
    try {
      localStorage.setItem(STORAGE, JSON.stringify({
        pins: state.pins,
        layers: state.layers
      }));
    } catch {
      showToast('保存に失敗しました');
    }
  }

  // ---------- map ----------
  function size() {
    state.width = container.clientWidth || window.innerWidth;
    state.height = container.clientHeight || window.innerHeight;
    svg.attr('width', state.width).attr('height', state.height);
    canvas.width = state.width;
    canvas.height = state.height;
  }

  function proj() {
    state.projection = d3.geoMercator()
      .scale(state.width / (2 * Math.PI) * 0.95)
      .translate([state.width / 2, state.height * 0.62]);
    state.pathGen = d3.geoPath().projection(state.projection);
  }

  function renderMap() {
    svg.selectAll('*').remove();
    const g = svg.append('g').attr('class', 'world');

    // All countries from GeoJSON – no filtering
    const feats = (state.countryFeatures && state.countryFeatures.features) || [];
    g.append('g').attr('class', 'countries')
      .selectAll('path')
      .data(feats)
      .join('path')
      .attr('class', 'country')
      .attr('d', state.pathGen)
      .attr('data-name', d => {
        const p = d.properties || {};
        return p.NAME || p.name || p.ADMIN || p.admin || '';
      })
      .attr('data-iso', d => {
        const p = d.properties || {};
        const iso = p.ISO_A2 || p.iso_a2 || '';
        return String(iso).toUpperCase();
      });

    const rFeats = (state.riverFeatures && state.riverFeatures.features) || [];
    g.append('g').attr('class', 'rivers' + (state.showRivers ? '' : ' hidden'))
      .selectAll('path')
      .data(rFeats)
      .join('path')
      .attr('class', 'river')
      .attr('d', state.pathGen);

    const pg = g.append('g').attr('class', 'pins');
    state.pins.forEach(p => {
      const node = pg.append('g')
        .attr('class', 'pin' + (p.id === state.selectedPinId ? ' selected' : ''))
        .attr('data-id', p.id)
        .attr('transform', `translate(${p.x},${p.y})`);
      // outer white ring + black core (screen-stable size via applyTf)
      node.append('circle').attr('class', 'pin-halo').attr('r', PIN_SCREEN_R + 1.2);
      node.append('circle').attr('class', 'pin-dot').attr('r', PIN_SCREEN_R);
    });

    applyTf();
  }

  function applyTf() {
    const { x, y, k } = state.transform;
    svg.select('.world').attr('transform', `translate(${x},${y}) scale(${k})`);
    svg.selectAll('.country').attr('stroke-width', 0.7 / k);
    svg.selectAll('.river').attr('stroke-width', 1.05 / k);
    // keep pin visual size constant on screen (never crushed)
    const pr = PIN_SCREEN_R / k;
    const hr = (PIN_SCREEN_R + 1.2) / k;
    svg.selectAll('.pin-dot').attr('r', pr).attr('stroke-width', Math.max(0.8 / k, 0.15));
    svg.selectAll('.pin-halo').attr('r', hr).attr('stroke-width', 0);
    redraw();
  }

  // ---------- drawing ----------
  function activeLayer() {
    return state.layers.find(l => l.id === state.activeLayerId);
  }

  function toMap(sx, sy) {
    const { x, y, k } = state.transform;
    return [(sx - x) / k, (sy - y) / k];
  }

  function redraw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const { x, y, k } = state.transform;
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(k, k);

    state.layers.forEach(layer => {
      if (!layer.visible) return;
      (layer.strokes || []).forEach(s => {
        if (!s.points || s.points.length < 2) return;
        drawStroke(ctx, s);
      });
    });

    if (state.currentStroke && state.currentStroke.points.length > 1) {
      drawStroke(ctx, state.currentStroke);
    }
    ctx.restore();
  }

  function drawStroke(c, s) {
    c.beginPath();
    c.lineWidth = s.width;
    c.lineCap = 'round';
    c.lineJoin = 'round';
    if (s.type === 'eraser' || s.type === 'eraser-normal') {
      c.globalCompositeOperation = 'destination-out';
      c.strokeStyle = '#000';
    } else {
      c.globalCompositeOperation = 'source-over';
      c.strokeStyle = s.color || '#1a1a1a';
    }
    c.moveTo(s.points[0][0], s.points[0][1]);
    for (let i = 1; i < s.points.length; i++) c.lineTo(s.points[i][0], s.points[i][1]);
    c.stroke();
  }

  function strokeStart(sx, sy) {
    if (state.mode !== 'draw') return;
    if (state.tool === 'eraser-stroke') {
      // stroke erase: find nearest stroke and remove whole stroke
      eraseWholeStrokeNear(sx, sy);
      return;
    }
    const layer = activeLayer();
    if (!layer) return;
    state.isDrawing = true;
    const type = (state.tool === 'eraser-normal') ? 'eraser-normal' : 'pen';
    state.currentStroke = {
      points: [toMap(sx, sy)],
      color: state.color,
      width: state.strokeWidth,
      type
    };
  }

  function strokeMove(sx, sy) {
    if (!state.isDrawing || !state.currentStroke) return;
    state.currentStroke.points.push(toMap(sx, sy));
    redraw();
  }

  function strokeEnd() {
    if (!state.isDrawing || !state.currentStroke) {
      state.isDrawing = false;
      state.currentStroke = null;
      return;
    }
    state.isDrawing = false;
    const layer = activeLayer();
    if (layer && state.currentStroke.points.length > 1) {
      pushUndo({ type: 'add-stroke', layerId: layer.id, stroke: JSON.parse(JSON.stringify(state.currentStroke)) });
      layer.strokes.push(state.currentStroke);
      save();
    }
    state.currentStroke = null;
    redraw();
  }

  function distPointToSeg(px, py, ax, ay, bx, by) {
    const dx = bx - ax, dy = by - ay;
    const len2 = dx * dx + dy * dy;
    if (len2 === 0) return Math.hypot(px - ax, py - ay);
    let t = ((px - ax) * dx + (py - ay) * dy) / len2;
    t = Math.max(0, Math.min(1, t));
    return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
  }

  function eraseWholeStrokeNear(sx, sy) {
    const layer = activeLayer();
    if (!layer || !layer.strokes.length) return;
    const [mx, my] = toMap(sx, sy);
    // threshold in map units (roughly ~12 screen px)
    const thr = 12 / state.transform.k;
    let bestIdx = -1;
    let bestDist = Infinity;
    layer.strokes.forEach((s, idx) => {
      if (!s.points || s.points.length < 2) return;
      // skip pure eraser strokes for stroke-delete targeting? allow all
      for (let i = 1; i < s.points.length; i++) {
        const d = distPointToSeg(
          mx, my,
          s.points[i - 1][0], s.points[i - 1][1],
          s.points[i][0], s.points[i][1]
        );
        if (d < bestDist) {
          bestDist = d;
          bestIdx = idx;
        }
      }
    });
    if (bestIdx >= 0 && bestDist <= thr) {
      const removed = layer.strokes.splice(bestIdx, 1)[0];
      pushUndo({ type: 'remove-stroke', layerId: layer.id, stroke: removed, index: bestIdx });
      save();
      redraw();
    }
  }

  function clearActiveLayer() {
    const layer = activeLayer();
    if (!layer) return;
    if (!layer.strokes.length) {
      showToast('消す線がありません');
      return;
    }
    if (!confirm('このレイヤーの線をすべて消しますか？')) return;
    const snapshot = JSON.parse(JSON.stringify(layer.strokes));
    pushUndo({ type: 'clear-layer', layerId: layer.id, strokes: snapshot });
    layer.strokes = [];
    save();
    redraw();
    showToast('レイヤーの線をすべて消しました');
  }

  function pushUndo(action) {
    state.undoStack.push(action);
    state.redoStack = [];
  }

  function undo() {
    const a = state.undoStack.pop();
    if (!a) return;
    const layer = state.layers.find(l => l.id === a.layerId);
    if (!layer) return;
    if (a.type === 'add-stroke') {
      // remove last matching or last stroke
      if (layer.strokes.length) {
        const removed = layer.strokes.pop();
        state.redoStack.push({ type: 'add-stroke', layerId: layer.id, stroke: removed });
      }
    } else if (a.type === 'remove-stroke') {
      const idx = Math.min(a.index, layer.strokes.length);
      layer.strokes.splice(idx, 0, a.stroke);
      state.redoStack.push({ type: 'remove-stroke', layerId: layer.id, stroke: a.stroke, index: idx });
    } else if (a.type === 'clear-layer') {
      layer.strokes = a.strokes;
      state.redoStack.push({ type: 'clear-layer', layerId: layer.id, strokes: [] });
    }
    save();
    redraw();
  }

  function redo() {
    const a = state.redoStack.pop();
    if (!a) return;
    const layer = state.layers.find(l => l.id === a.layerId);
    if (!layer) return;
    if (a.type === 'add-stroke') {
      layer.strokes.push(a.stroke);
      state.undoStack.push(a);
    } else if (a.type === 'remove-stroke') {
      // remove again
      const idx = layer.strokes.findIndex(s => s === a.stroke);
      if (idx >= 0) layer.strokes.splice(idx, 1);
      else if (layer.strokes.length) layer.strokes.pop();
      state.undoStack.push(a);
    } else if (a.type === 'clear-layer') {
      // redo clear = clear again (strokes already empty in redo payload)
      const snapshot = JSON.parse(JSON.stringify(layer.strokes));
      state.undoStack.push({ type: 'clear-layer', layerId: layer.id, strokes: snapshot });
      layer.strokes = [];
    }
    save();
    redraw();
  }

  // ---------- gestures ----------
  function onDown(e) {
    const t = e.touches ? e.touches[0] : e;
    if (!t) return;
    if (e.touches && e.touches.length > 1) return;

    if (state.mode === 'draw') {
      strokeStart(t.clientX, t.clientY);
      return;
    }

    state.ptr = {
      x: t.clientX, y: t.clientY,
      t: Date.now(),
      moved: false,
      ox: state.transform.x,
      oy: state.transform.y
    };
  }

  function onMove(e) {
    const t = e.touches ? e.touches[0] : e;
    if (!t) return;

    if (state.mode === 'draw' && state.isDrawing) {
      strokeMove(t.clientX, t.clientY);
      return;
    }

    if (!state.ptr) return;
    const dx = t.clientX - state.ptr.x;
    const dy = t.clientY - state.ptr.y;
    if (Math.hypot(dx, dy) > TAP_DIST) {
      state.ptr.moved = true;
      state.transform.x = state.ptr.ox + dx;
      state.transform.y = state.ptr.oy + dy;
      applyTf();
      container.classList.add('panning');
    }
  }

  function onUp(e) {
    if (state.mode === 'draw') {
      strokeEnd();
      return;
    }
    if (!state.ptr) return;

    const elapsed = Date.now() - state.ptr.t;
    if (!state.ptr.moved && elapsed < TAP_MS) {
      handleTap(state.ptr.x, state.ptr.y);
    }
    state.ptr = null;
    container.classList.remove('panning');
  }

  function handleTap(sx, sy) {
    // pin placement mode
    if (state.mode === 'pin') {
      placePin(sx, sy);
      return;
    }

    // only select pins when not drawing
    if (state.mode === 'draw') return;

    const [mx, my] = toMap(sx, sy);
    const thr = (PIN_SCREEN_R + 10) / state.transform.k;
    const hit = state.pins.find(p => Math.hypot(p.x - mx, p.y - my) < thr);
    if (hit) openPin(hit);
  }

  function placePin(sx, sy) {
    const [x, y] = toMap(sx, sy);
    const pin = { id: 'P' + Date.now(), x, y, title: '', memo: '' };
    state.pins.push(pin);
    save();
    setMode('none');
    renderMap();
    openPin(pin);
  }

  // ---------- modes ----------
  function setMode(m) {
    state.mode = m;
    state.isDrawing = false;
    state.currentStroke = null;

    container.classList.toggle('drawing', m === 'draw');
    container.classList.toggle('pinning', m === 'pin');
    container.style.cursor = (m === 'draw' || m === 'pin') ? 'crosshair' : 'grab';

    document.getElementById('btn-draw-mode').classList.toggle('active', m === 'draw');
    document.getElementById('btn-pin-mode').classList.toggle('active', m === 'pin');
    document.getElementById('draw-tools').classList.toggle('hidden', m !== 'draw');

    if (m === 'pin') {
      modeHint.textContent = '地図をタップしてピンを置く';
      modeHint.classList.remove('hidden');
    } else if (m === 'draw') {
      modeHint.textContent = '描画モード';
      modeHint.classList.remove('hidden');
    } else {
      modeHint.classList.add('hidden');
    }
  }

  // ---------- pins UI ----------
  function openPin(pin) {
    if (state.mode === 'draw') return; // hard separation
    state.selectedPinId = pin.id;
    document.getElementById('memo-title').textContent = pin.title || 'ピンメモ';
    document.getElementById('pin-title').value = pin.title || '';
    document.getElementById('pin-memo').value = pin.memo || '';
    document.getElementById('memo-panel').classList.remove('hidden');
    renderMap();
  }

  function closePin() {
    state.selectedPinId = null;
    document.getElementById('memo-panel').classList.add('hidden');
    renderMap();
  }

  // ---------- zoom / touch ----------
  function onWheel(e) {
    e.preventDefault();
    const sx = e.clientX, sy = e.clientY;
    const f = e.deltaY < 0 ? 1.12 : 0.89;
    const nk = Math.max(0.3, Math.min(20, state.transform.k * f));
    state.transform.x = sx - (sx - state.transform.x) * (nk / state.transform.k);
    state.transform.y = sy - (sy - state.transform.y) * (nk / state.transform.k);
    state.transform.k = nk;
    applyTf();
  }

  let pinchDist = 0;
  let pinchMid = null; // {x,y, ox, oy} for 2-finger pan
  function onTouchStart(e) {
    if (e.touches.length === 2) {
      // always allow 2-finger pan/zoom, even in draw mode
      state.isDrawing = false;
      state.currentStroke = null;
      state.ptr = null;
      pinchDist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      const mx = (e.touches[0].clientX + e.touches[1].clientX) / 2;
      const my = (e.touches[0].clientY + e.touches[1].clientY) / 2;
      pinchMid = { x: mx, y: my, ox: state.transform.x, oy: state.transform.y };
    } else if (e.touches.length === 1) {
      pinchDist = 0;
      pinchMid = null;
      onDown(e);
    }
  }

  function onTouchMove(e) {
    e.preventDefault();
    if (e.touches.length === 2) {
      const d = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      const mx = (e.touches[0].clientX + e.touches[1].clientX) / 2;
      const my = (e.touches[0].clientY + e.touches[1].clientY) / 2;

      // pan with two fingers
      if (pinchMid) {
        state.transform.x = pinchMid.ox + (mx - pinchMid.x);
        state.transform.y = pinchMid.oy + (my - pinchMid.y);
      }

      // pinch zoom toward midpoint
      if (pinchDist > 0) {
        const f = d / pinchDist;
        const nk = Math.max(0.3, Math.min(20, state.transform.k * f));
        state.transform.x = mx - (mx - state.transform.x) * (nk / state.transform.k);
        state.transform.y = my - (my - state.transform.y) * (nk / state.transform.k);
        state.transform.k = nk;
        // update baseline so next move is incremental
        pinchDist = d;
        pinchMid = { x: mx, y: my, ox: state.transform.x, oy: state.transform.y };
      }
      applyTf();
    } else if (e.touches.length === 1) {
      onMove(e);
    }
  }

  function onTouchEnd(e) {
    if (e.touches.length < 2) {
      pinchDist = 0;
      pinchMid = null;
    }
    if (e.touches.length === 0) onUp(e);
    // if one finger remains after pinch, re-init ptr for continued pan
    if (e.touches.length === 1 && state.mode !== 'draw') {
      onDown(e);
    }
  }

  // ---------- UI helpers ----------
  function showToast(msg) {
    toastEl.textContent = msg;
    toastEl.classList.remove('hidden');
    clearTimeout(showToast._t);
    showToast._t = setTimeout(() => toastEl.classList.add('hidden'), 2000);
  }

  function eyeIcon(visible) {
    if (visible) {
      return '<svg viewBox="0 0 24 24" class="icon"><path d="M2 12s4-6 10-6 10 6 10 6-4 6-10 6S2 12 2 12z" fill="none" stroke="currentColor" stroke-width="1.6"/><circle cx="12" cy="12" r="2.5" fill="none" stroke="currentColor" stroke-width="1.6"/></svg>';
    }
    return '<svg viewBox="0 0 24 24" class="icon"><path d="M3 3l18 18M10.5 10.6A2.5 2.5 0 0013.4 13.5M6.7 6.8C4.3 8.3 2 12 2 12s4 6 10 6c1.6 0 3.1-.4 4.4-1M14 6.2c2.2.7 4.3 2.3 6 5.8 0 0-1.2 1.8-3 3.2" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>';
  }

  function xIcon() {
    return '<svg viewBox="0 0 24 24" class="icon"><path d="M6 6l12 12M18 6L6 18" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>';
  }

  function renderLayers() {
    const list = document.getElementById('layer-list');
    list.innerHTML = '';
    state.layers.forEach(layer => {
      const div = document.createElement('div');
      div.className = 'layer-item' + (layer.id === state.activeLayerId ? ' active' : '');
      div.innerHTML = `
        <button class="eye ${layer.visible ? 'visible' : ''}" data-id="${layer.id}" title="表示切替">${eyeIcon(layer.visible)}</button>
        <input type="text" value="${esc(layer.name)}" data-id="${layer.id}" class="lname" />
        <button class="delete-layer" data-id="${layer.id}" title="削除">${xIcon()}</button>`;
      div.onclick = (e) => {
        if (e.target.closest('button') || e.target.closest('input')) return;
        state.activeLayerId = layer.id;
        renderLayers();
      };
      list.appendChild(div);
    });

    list.querySelectorAll('.eye').forEach(b => {
      b.onclick = (e) => {
        e.stopPropagation();
        const L = state.layers.find(l => l.id === b.dataset.id);
        if (L) { L.visible = !L.visible; save(); renderLayers(); redraw(); }
      };
    });
    list.querySelectorAll('.lname').forEach(inp => {
      inp.onchange = () => {
        const L = state.layers.find(l => l.id === inp.dataset.id);
        if (L) { L.name = inp.value.trim() || '無題'; save(); }
      };
    });
    list.querySelectorAll('.delete-layer').forEach(b => {
      b.onclick = (e) => {
        e.stopPropagation();
        if (state.layers.length <= 1) return showToast('最低1つ必要です');
        state.layers = state.layers.filter(l => l.id !== b.dataset.id);
        if (state.activeLayerId === b.dataset.id) state.activeLayerId = state.layers[0].id;
        save(); renderLayers(); redraw();
      };
    });
  }

  function esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function setTool(tool) {
    state.tool = tool;
    document.getElementById('btn-pen').classList.toggle('active', tool === 'pen');
    document.getElementById('btn-eraser-normal').classList.toggle('active', tool === 'eraser-normal');
    document.getElementById('btn-eraser-stroke').classList.toggle('active', tool === 'eraser-stroke');
  }

  function bind() {
    document.getElementById('btn-draw-mode').onclick = () => {
      setMode(state.mode === 'draw' ? 'none' : 'draw');
      if (state.mode === 'draw') setTool('pen');
    };

    document.getElementById('btn-pin-mode').onclick = () => {
      // cannot place pins while drawing
      if (state.mode === 'draw') setMode('none');
      setMode(state.mode === 'pin' ? 'none' : 'pin');
    };

    document.getElementById('btn-pen').onclick = () => setTool('pen');
    document.getElementById('btn-eraser-normal').onclick = () => setTool('eraser-normal');
    document.getElementById('btn-eraser-stroke').onclick = () => setTool('eraser-stroke');
    document.getElementById('btn-eraser-all').onclick = () => {
      if (state.mode !== 'draw') setMode('draw');
      clearActiveLayer();
    };

    document.getElementById('color-picker').oninput = e => { state.color = e.target.value; };
    document.getElementById('stroke-width').oninput = e => { state.strokeWidth = Math.max(0.3, parseFloat(e.target.value) || 0.3); };
    document.getElementById('btn-undo').onclick = undo;
    document.getElementById('btn-redo').onclick = redo;

    document.getElementById('btn-layers').onclick = () => {
      document.getElementById('layer-panel').classList.toggle('hidden');
      renderLayers();
    };
    document.getElementById('btn-close-layers').onclick = () => {
      document.getElementById('layer-panel').classList.add('hidden');
    };
    document.getElementById('btn-add-layer').onclick = () => {
      const id = 'L' + Date.now();
      state.layers.push({ id, name: '新しいレイヤー', visible: true, strokes: [] });
      state.activeLayerId = id;
      save();
      renderLayers();
    };

    document.getElementById('btn-reset-view').onclick = () => {
      state.transform = { x: 0, y: 0, k: 1 };
      applyTf();
    };

    const riversBtn = document.getElementById('btn-rivers');
    if (riversBtn) {
      riversBtn.classList.toggle('active', state.showRivers);
      riversBtn.onclick = () => {
        state.showRivers = !state.showRivers;
        riversBtn.classList.toggle('active', state.showRivers);
        const rg = document.querySelector('.rivers');
        if (rg) rg.classList.toggle('hidden', !state.showRivers);
      };
    }

    document.getElementById('btn-close-memo').onclick = closePin;

    document.getElementById('btn-save-pin').onclick = () => {
      if (state.mode === 'draw') return;
      const pin = state.pins.find(p => p.id === state.selectedPinId);
      if (!pin) return;
      pin.title = document.getElementById('pin-title').value.trim();
      pin.memo = document.getElementById('pin-memo').value;
      save();
      showToast('保存しました');
      closePin();
    };

    document.getElementById('btn-delete-pin').onclick = () => {
      if (state.mode === 'draw') return;
      state.pins = state.pins.filter(p => p.id !== state.selectedPinId);
      save();
      closePin();
      showToast('ピンを削除しました');
    };

    container.addEventListener('mousedown', onDown);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    container.addEventListener('wheel', onWheel, { passive: false });
    container.addEventListener('touchstart', onTouchStart, { passive: false });
    container.addEventListener('touchmove', onTouchMove, { passive: false });
    container.addEventListener('touchend', onTouchEnd);
    window.addEventListener('resize', () => { size(); proj(); renderMap(); });
  }

  // ---------- boot ----------
  async function boot() {
    load();
    size();
    proj();

    try {
      // Full 110m countries – includes Angola, Argentina, Albania etc.
      const [countries, rivers] = await Promise.all([
        d3.json('https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_50m_admin_0_countries.geojson'),
        d3.json('https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_50m_rivers_lake_centerlines.geojson')
      ]);
      state.countryFeatures = countries;
      state.riverFeatures = rivers;

      // sanity log
      const names = (countries.features || []).map(f => {
        const p = f.properties || {};
        return p.NAME || p.name || p.ADMIN || p.admin;
      });
      const needed = ['Angola', 'Argentina', 'Albania'];
      const missing = needed.filter(n => !names.some(x => x && x.toLowerCase() === n.toLowerCase()));
      if (missing.length) console.warn('Missing countries in source:', missing);
      else console.log('Countries OK:', needed.join(', '), 'present. Total:', countries.features.length);
    } catch (err) {
      console.error(err);
      showToast('地図データの読み込みに失敗しました');
      return;
    }

    renderMap();
    redraw();
    bind();
    renderLayers();
  }

  boot();
})();
