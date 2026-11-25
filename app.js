(() => {
  'use strict';

  const state = {
    pins: [],
    layers: [],
    activeLayerId: null,
    selectedPinId: null,
    drawMode: false,
    tool: 'pen',
    color: '#1a1a1a',
    strokeWidth: 3,
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
    // gesture
    ptr: null, // { id, x, y, t, moved, ox, oy }
  };

  const STORAGE = 'world-notes-v3';
  const TAP_DIST = 12;
  const TAP_MS = 320;

  const svg = d3.select('#map-svg');
  const canvas = document.getElementById('draw-canvas');
  const ctx = canvas.getContext('2d');
  const container = document.getElementById('map-container');
  const toastEl = document.getElementById('toast');

  // ---------- storage ----------
  function load() {
    try {
      const d = JSON.parse(localStorage.getItem(STORAGE) || '{}');
      state.pins = d.pins || [];
      state.layers = d.layers || [];
      if (!state.layers.length) {
        const id = 'L' + Date.now();
        state.layers = [{ id, name: 'メモ', visible: true, strokes: [] }];
        state.activeLayerId = id;
      } else {
        state.activeLayerId = state.layers[0].id;
      }
    } catch {
      const id = 'L' + Date.now();
      state.layers = [{ id, name: 'メモ', visible: true, strokes: [] }];
      state.activeLayerId = id;
    }
  }

  function save() {
    try {
      localStorage.setItem(STORAGE, JSON.stringify({
        pins: state.pins,
        layers: state.layers
      }));
    } catch {
      showToast('保存失敗（容量オーバーの可能性）');
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

    // countries (no pointer events)
    g.append('g').attr('class', 'countries')
      .selectAll('path')
      .data(state.countryFeatures.features)
      .join('path')
      .attr('class', 'country')
      .attr('d', state.pathGen);

    // rivers
    g.append('g').attr('class', 'rivers')
      .selectAll('path')
      .data(state.riverFeatures.features)
      .join('path')
      .attr('class', 'river')
      .attr('d', state.pathGen);

    // pins
    const pg = g.append('g').attr('class', 'pins');
    state.pins.forEach(p => {
      const node = pg.append('g')
        .attr('class', 'pin')
        .attr('data-id', p.id)
        .attr('transform', `translate(${p.x},${p.y})`);
      node.append('circle').attr('r', 8).attr('fill', '#1a1a1a').attr('stroke', '#fff').attr('stroke-width', 1.8);
      node.append('circle').attr('r', 2.8).attr('fill', '#fff');
    });

    applyTf();
  }

  function applyTf() {
    const { x, y, k } = state.transform;
    svg.select('.world').attr('transform', `translate(${x},${y}) scale(${k})`);
    svg.selectAll('.country').attr('stroke-width', 0.55 / k);
    svg.selectAll('.river').attr('stroke-width', 1.05 / k);
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
        ctx.beginPath();
        ctx.lineWidth = s.width;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        if (s.type === 'eraser') {
          ctx.globalCompositeOperation = 'destination-out';
          ctx.strokeStyle = '#000';
        } else {
          ctx.globalCompositeOperation = 'source-over';
          ctx.strokeStyle = s.color || '#1a1a1a';
        }
        ctx.moveTo(s.points[0][0], s.points[0][1]);
        for (let i = 1; i < s.points.length; i++) ctx.lineTo(s.points[i][0], s.points[i][1]);
        ctx.stroke();
      });
    });

    // current
    const cur = state.currentStroke;
    if (cur && cur.points.length > 1) {
      ctx.beginPath();
      ctx.lineWidth = cur.width;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      if (cur.type === 'eraser') {
        ctx.globalCompositeOperation = 'destination-out';
        ctx.strokeStyle = '#000';
      } else {
        ctx.globalCompositeOperation = 'source-over';
        ctx.strokeStyle = cur.color;
      }
      ctx.moveTo(cur.points[0][0], cur.points[0][1]);
      for (let i = 1; i < cur.points.length; i++) ctx.lineTo(cur.points[i][0], cur.points[i][1]);
      ctx.stroke();
    }
    ctx.restore();
  }

  function strokeStart(sx, sy) {
    const layer = activeLayer();
    if (!layer) return;
    state.isDrawing = true;
    state.currentStroke = {
      points: [toMap(sx, sy)],
      color: state.color,
      width: state.strokeWidth,
      type: state.tool
    };
  }

  function strokeMove(sx, sy) {
    if (!state.isDrawing || !state.currentStroke) return;
    state.currentStroke.points.push(toMap(sx, sy));
    redraw();
  }

  function strokeEnd() {
    if (!state.isDrawing || !state.currentStroke) return;
    state.isDrawing = false;
    const layer = activeLayer();
    if (layer && state.currentStroke.points.length > 1) {
      state.undoStack.push({ layerId: layer.id, stroke: JSON.parse(JSON.stringify(state.currentStroke)) });
      state.redoStack = [];
      layer.strokes.push(state.currentStroke);
      save();
    }
    state.currentStroke = null;
    redraw();
  }

  function undo() {
    const u = state.undoStack.pop();
    if (!u) return;
    const layer = state.layers.find(l => l.id === u.layerId);
    if (layer && layer.strokes.length) {
      state.redoStack.push({ layerId: layer.id, stroke: layer.strokes.pop() });
      save();
      redraw();
    }
  }

  function redo() {
    const r = state.redoStack.pop();
    if (!r) return;
    const layer = state.layers.find(l => l.id === r.layerId);
    if (layer) {
      layer.strokes.push(r.stroke);
      state.undoStack.push(r);
      save();
      redraw();
    }
  }

  // ---------- gestures (pan first) ----------
  function onDown(e) {
    const t = e.touches ? e.touches[0] : e;
    if (!t) return;
    if (e.touches && e.touches.length > 1) return;

    if (state.drawMode) {
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

    if (state.drawMode && state.isDrawing) {
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
    if (state.drawMode) {
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
    const [mx, my] = toMap(sx, sy);
    const hit = state.pins.find(p => Math.hypot(p.x - mx, p.y - my) < 18 / state.transform.k);
    if (hit) openPin(hit);
  }

  // ---------- pins ----------
  function addPin(sx, sy) {
    const [x, y] = toMap(sx, sy);
    const pin = { id: 'P' + Date.now(), x, y, title: '', memo: '' };
    state.pins.push(pin);
    save();
    renderMap();
    openPin(pin);
    showToast('ピンを追加しました');
  }

  function openPin(pin) {
    state.selectedPinId = pin.id;
    document.getElementById('memo-title').textContent = pin.title || 'ピンメモ';
    document.getElementById('pin-title').value = pin.title || '';
    document.getElementById('pin-memo').value = pin.memo || '';
    document.getElementById('memo-panel').classList.remove('hidden');
  }

  function closePin() {
    state.selectedPinId = null;
    document.getElementById('memo-panel').classList.add('hidden');
  }

  // ---------- zoom ----------
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
  function onTouchStart(e) {
    if (e.touches.length === 2) {
      pinchDist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      state.ptr = null;
    } else if (e.touches.length === 1) {
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
      if (pinchDist > 0) {
        const f = d / pinchDist;
        const mx = (e.touches[0].clientX + e.touches[1].clientX) / 2;
        const my = (e.touches[0].clientY + e.touches[1].clientY) / 2;
        const nk = Math.max(0.3, Math.min(20, state.transform.k * f));
        state.transform.x = mx - (mx - state.transform.x) * (nk / state.transform.k);
        state.transform.y = my - (my - state.transform.y) * (nk / state.transform.k);
        state.transform.k = nk;
        applyTf();
      }
      pinchDist = d;
    } else if (e.touches.length === 1) {
      onMove(e);
    }
  }

  function onTouchEnd(e) {
    if (e.touches.length < 2) pinchDist = 0;
    if (e.touches.length === 0) onUp(e);
  }

  // ---------- UI ----------
  function showToast(msg) {
    toastEl.textContent = msg;
    toastEl.classList.remove('hidden');
    clearTimeout(showToast._t);
    showToast._t = setTimeout(() => toastEl.classList.add('hidden'), 2000);
  }

  function renderLayers() {
    const list = document.getElementById('layer-list');
    list.innerHTML = '';
    state.layers.forEach(layer => {
      const div = document.createElement('div');
      div.className = 'layer-item' + (layer.id === state.activeLayerId ? ' active' : '');
      div.innerHTML = `
        <button class="eye ${layer.visible ? 'visible' : ''}" data-id="${layer.id}">${layer.visible ? '👁' : '👁‍🗨'}</button>
        <input type="text" value="${esc(layer.name)}" data-id="${layer.id}" class="lname" />
        <button class="delete-layer" data-id="${layer.id}">×</button>`;
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
    return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  function bind() {
    document.getElementById('btn-draw-mode').onclick = () => {
      state.drawMode = !state.drawMode;
      document.getElementById('btn-draw-mode').classList.toggle('active', state.drawMode);
      document.getElementById('draw-tools').classList.toggle('hidden', !state.drawMode);
      container.classList.toggle('drawing', state.drawMode);
      container.style.cursor = state.drawMode ? 'crosshair' : 'grab';
      showToast(state.drawMode ? '描画モード ON' : '描画モード OFF');
    };

    document.getElementById('btn-pen').onclick = () => {
      state.tool = 'pen';
      document.getElementById('btn-pen').classList.add('active');
      document.getElementById('btn-eraser').classList.remove('active');
    };
    document.getElementById('btn-eraser').onclick = () => {
      state.tool = 'eraser';
      document.getElementById('btn-eraser').classList.add('active');
      document.getElementById('btn-pen').classList.remove('active');
    };
    document.getElementById('color-picker').oninput = e => state.color = e.target.value;
    document.getElementById('stroke-width').oninput = e => state.strokeWidth = +e.target.value;
    document.getElementById('btn-undo').onclick = undo;
    document.getElementById('btn-redo').onclick = redo;

    document.getElementById('btn-add-pin').onclick = () => {
      addPin(state.width / 2, state.height / 2);
    };

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

    document.getElementById('btn-close-memo').onclick = closePin;

    document.getElementById('btn-save-pin').onclick = () => {
      const pin = state.pins.find(p => p.id === state.selectedPinId);
      if (!pin) return;
      pin.title = document.getElementById('pin-title').value.trim();
      pin.memo = document.getElementById('pin-memo').value;
      save();
      showToast('保存しました');
      closePin();
      renderMap();
    };

    document.getElementById('btn-delete-pin').onclick = () => {
      state.pins = state.pins.filter(p => p.id !== state.selectedPinId);
      save();
      closePin();
      renderMap();
      showToast('ピンを削除しました');
    };

    // events
    container.addEventListener('mousedown', onDown);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    container.addEventListener('wheel', onWheel, { passive: false });
    container.addEventListener('touchstart', onTouchStart, { passive: false });
    container.addEventListener('touchmove', onTouchMove, { passive: false });
    container.addEventListener('touchend', onTouchEnd);

    window.addEventListener('resize', () => {
      size();
      proj();
      renderMap();
    });
  }

  // ---------- boot ----------
  async function boot() {
    load();
    size();
    proj();

    try {
      const [countries, rivers] = await Promise.all([
        d3.json('https://raw.githubusercontent.com/datasets/geo-boundaries-world-110m/master/countries.geojson'),
        d3.json('https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_50m_rivers_lake_centerlines.geojson')
      ]);
      state.countryFeatures = countries;
      state.riverFeatures = rivers;
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
