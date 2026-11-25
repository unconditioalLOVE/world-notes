(() => {
  'use strict';

  const state = {
    countries: {},
    pins: [],
    layers: [],
    activeLayerId: null,
    selectedCountry: null,
    selectedPin: null,
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
    pointerDown: null,
    isPanning: false,
  };

  const JA_NAMES = {
    AF: 'アフガニスタン', AL: 'アルバニア', DZ: 'アルジェリア', AO: 'アンゴラ',
    AR: 'アルゼンチン', AM: 'アルメニア', AU: 'オーストラリア', AT: 'オーストリア',
    AZ: 'アゼルバイジャン', BS: 'バハマ', BD: 'バングラデシュ', BY: 'ベラルーシ',
    BE: 'ベルギー', BZ: 'ベリーズ', BJ: 'ベナン', BT: 'ブータン', BO: 'ボリビア',
    BA: 'ボスニア・ヘルツェゴビナ', BW: 'ボツワナ', BR: 'ブラジル', BN: 'ブルネイ',
    BG: 'ブルガリア', BF: 'ブルキナファソ', BI: 'ブルンジ', KH: 'カンボジア',
    CM: 'カメルーン', CA: 'カナダ', CF: '中央アフリカ', TD: 'チャド', CL: 'チリ',
    CN: '中国', CO: 'コロンビア', CG: 'コンゴ共和国', CD: 'コンゴ民主共和国',
    CR: 'コスタリカ', CI: 'コートジボワール', HR: 'クロアチア', CU: 'キューバ',
    CY: 'キプロス', CZ: 'チェコ', DK: 'デンマーク', DJ: 'ジブチ', DO: 'ドミニカ共和国',
    EC: 'エクアドル', EG: 'エジプト', SV: 'エルサルバドル', GQ: '赤道ギニア',
    ER: 'エリトリア', EE: 'エストニア', ET: 'エチオピア', FJ: 'フィジー',
    FI: 'フィンランド', FR: 'フランス', GA: 'ガボン', GM: 'ガンビア', GE: 'ジョージア',
    DE: 'ドイツ', GH: 'ガーナ', GR: 'ギリシャ', GT: 'グアテマラ', GN: 'ギニア',
    GW: 'ギニアビサウ', GY: 'ガイアナ', HT: 'ハイチ', HN: 'ホンジュラス',
    HU: 'ハンガリー', IS: 'アイスランド', IN: 'インド', ID: 'インドネシア',
    IR: 'イラン', IQ: 'イラク', IE: 'アイルランド', IL: 'イスラエル', IT: 'イタリア',
    JM: 'ジャマイカ', JP: '日本', JO: 'ヨルダン', KZ: 'カザフスタン', KE: 'ケニア',
    KP: '北朝鮮', KR: '韓国', KW: 'クウェート', KG: 'キルギス', LA: 'ラオス',
    LV: 'ラトビア', LB: 'レバノン', LS: 'レソト', LR: 'リベリア', LY: 'リビア',
    LT: 'リトアニア', LU: 'ルクセンブルク', MG: 'マダガスカル', MW: 'マラウイ',
    MY: 'マレーシア', ML: 'マリ', MR: 'モーリタニア', MX: 'メキシコ', MD: 'モルドバ',
    MN: 'モンゴル', ME: 'モンテネグロ', MA: 'モロッコ', MZ: 'モザンビーク',
    MM: 'ミャンマー', NA: 'ナミビア', NP: 'ネパール', NL: 'オランダ', NZ: 'ニュージーランド',
    NI: 'ニカラグア', NE: 'ニジェール', NG: 'ナイジェリア', NO: 'ノルウェー',
    OM: 'オマーン', PK: 'パキスタン', PA: 'パナマ', PG: 'パプアニューギニア',
    PY: 'パラグアイ', PE: 'ペルー', PH: 'フィリピン', PL: 'ポーランド', PT: 'ポルトガル',
    QA: 'カタール', RO: 'ルーマニア', RU: 'ロシア', RW: 'ルワンダ', SA: 'サウジアラビア',
    SN: 'セネガル', RS: 'セルビア', SL: 'シエラレオネ', SG: 'シンガポール',
    SK: 'スロバキア', SI: 'スロベニア', SO: 'ソマリア', ZA: '南アフリカ',
    SS: '南スーダン', ES: 'スペイン', LK: 'スリランカ', SD: 'スーダン', SR: 'スリナム',
    SE: 'スウェーデン', CH: 'スイス', SY: 'シリア', TW: '台湾', TJ: 'タジキスタン',
    TZ: 'タンザニア', TH: 'タイ', TL: '東ティモール', TG: 'トーゴ', TT: 'トリニダード・トバゴ',
    TN: 'チュニジア', TR: 'トルコ', TM: 'トルクメニスタン', UG: 'ウガンダ',
    UA: 'ウクライナ', AE: 'アラブ首長国連邦', GB: 'イギリス', US: 'アメリカ合衆国',
    UY: 'ウルグアイ', UZ: 'ウズベキスタン', VE: 'ベネズエラ', VN: 'ベトナム',
    YE: 'イエメン', ZM: 'ザンビア', ZW: 'ジンバブエ', PS: 'パレスチナ',
    EH: '西サハラ', XK: 'コソボ', GL: 'グリーンランド', PR: 'プエルトリコ'
  };

  const svg = d3.select('#map-svg');
  const canvas = document.getElementById('draw-canvas');
  const ctx = canvas.getContext('2d');
  const mapContainer = document.getElementById('map-container');
  const toastEl = document.getElementById('toast');
  const STORAGE_KEY = 'world-notes-v2';

  function loadData() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const data = JSON.parse(raw);
        state.countries = data.countries || {};
        state.pins = data.pins || [];
        state.layers = data.layers || [];
        if (state.layers.length === 0) createDefaultLayer();
        else state.activeLayerId = state.layers[0].id;
      } else createDefaultLayer();
    } catch (e) { createDefaultLayer(); }
  }

  function saveData() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        countries: state.countries, pins: state.pins, layers: state.layers
      }));
    } catch (e) { showToast('保存に失敗しました'); }
  }

  function createDefaultLayer() {
    const id = 'layer_' + Date.now();
    state.layers = [{ id, name: 'メモ', visible: true, strokes: [] }];
    state.activeLayerId = id;
  }

  function initSize() {
    state.width = mapContainer.clientWidth || window.innerWidth;
    state.height = mapContainer.clientHeight || window.innerHeight;
    svg.attr('width', state.width).attr('height', state.height);
    canvas.width = state.width;
    canvas.height = state.height;
  }

  function createProjection() {
    state.projection = d3.geoMercator()
      .scale(state.width / (2 * Math.PI) * 0.92)
      .translate([state.width / 2, state.height / 1.55]);
    state.pathGen = d3.geoPath().projection(state.projection);
  }

  function renderMap() {
    svg.selectAll('*').remove();
    const g = svg.append('g').attr('class', 'map-group');

    g.append('g').attr('class', 'countries')
      .selectAll('path')
      .data(state.countryFeatures.features)
      .join('path')
      .attr('class', d => {
        const iso = (d.properties.iso_a2 || '').toUpperCase();
        let cls = 'country';
        if (iso && state.countries[iso] && (state.countries[iso].memo || (state.countries[iso].cities && state.countries[iso].cities.length))) cls += ' has-memo';
        if (state.selectedCountry === iso) cls += ' selected';
        return cls;
      })
      .attr('d', state.pathGen)
      .attr('data-iso', d => (d.properties.iso_a2 || '').toUpperCase());

    g.append('g').attr('class', 'rivers')
      .selectAll('path')
      .data(state.riverFeatures.features)
      .join('path')
      .attr('class', 'river')
      .attr('d', state.pathGen);

    const pinsG = g.append('g').attr('class', 'pins');
    state.pins.forEach(pin => {
      const pg = pinsG.append('g')
        .attr('class', 'pin')
        .attr('data-id', pin.id)
        .attr('transform', 'translate(' + pin.x + ',' + pin.y + ')')
        .style('cursor', 'pointer');
      pg.append('circle').attr('r', 7).attr('fill', '#1a1a1a').attr('stroke', '#fff').attr('stroke-width', 1.5);
      pg.append('circle').attr('r', 2.5).attr('fill', '#fff');
    });

    applyTransform();
  }

  function applyTransform() {
    const { x, y, k } = state.transform;
    svg.select('.map-group').attr('transform', 'translate(' + x + ',' + y + ') scale(' + k + ')');
    svg.selectAll('.country').attr('stroke-width', 0.6 / k);
    svg.selectAll('.river').attr('stroke-width', 1.1 / k);
    redrawCanvas();
  }

  function getActiveLayer() { return state.layers.find(l => l.id === state.activeLayerId); }
  function screenToMap(sx, sy) {
    const { x, y, k } = state.transform;
    return [(sx - x) / k, (sy - y) / k];
  }

  function redrawCanvas() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const { x, y, k } = state.transform;
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(k, k);
    state.layers.forEach(layer => {
      if (!layer.visible) return;
      layer.strokes.forEach(stroke => {
        if (!stroke.points || stroke.points.length < 2) return;
        ctx.beginPath();
        ctx.lineWidth = stroke.width;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        if (stroke.type === 'eraser') {
          ctx.globalCompositeOperation = 'destination-out';
          ctx.strokeStyle = 'rgba(0,0,0,1)';
        } else {
          ctx.globalCompositeOperation = 'source-over';
          ctx.strokeStyle = stroke.color;
        }
        ctx.moveTo(stroke.points[0][0], stroke.points[0][1]);
        for (let i = 1; i < stroke.points.length; i++) ctx.lineTo(stroke.points[i][0], stroke.points[i][1]);
        ctx.stroke();
      });
    });
    if (state.currentStroke && state.currentStroke.points.length > 1) {
      const s = state.currentStroke;
      ctx.beginPath();
      ctx.lineWidth = s.width;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      if (s.type === 'eraser') {
        ctx.globalCompositeOperation = 'destination-out';
        ctx.strokeStyle = 'rgba(0,0,0,1)';
      } else {
        ctx.globalCompositeOperation = 'source-over';
        ctx.strokeStyle = s.color;
      }
      ctx.moveTo(s.points[0][0], s.points[0][1]);
      for (let i = 1; i < s.points.length; i++) ctx.lineTo(s.points[i][0], s.points[i][1]);
      ctx.stroke();
    }
    ctx.restore();
  }

  function startStroke(sx, sy) {
    if (!state.drawMode) return;
    const layer = getActiveLayer();
    if (!layer) return;
    state.isDrawing = true;
    state.currentStroke = { points: [screenToMap(sx, sy)], color: state.color, width: state.strokeWidth, type: state.tool };
  }
  function continueStroke(sx, sy) {
    if (!state.isDrawing || !state.currentStroke) return;
    state.currentStroke.points.push(screenToMap(sx, sy));
    redrawCanvas();
  }
  function endStroke() {
    if (!state.isDrawing || !state.currentStroke) return;
    state.isDrawing = false;
    const layer = getActiveLayer();
    if (layer && state.currentStroke.points.length > 1) {
      state.undoStack.push({ layerId: layer.id, stroke: JSON.parse(JSON.stringify(state.currentStroke)) });
      state.redoStack = [];
      layer.strokes.push(state.currentStroke);
      saveData();
    }
    state.currentStroke = null;
    redrawCanvas();
  }
  function undo() {
    const last = state.undoStack.pop();
    if (!last) return;
    const layer = state.layers.find(l => l.id === last.layerId);
    if (layer && layer.strokes.length) {
      const removed = layer.strokes.pop();
      state.redoStack.push({ layerId: layer.id, stroke: removed });
      saveData(); redrawCanvas();
    }
  }
  function redo() {
    const last = state.redoStack.pop();
    if (!last) return;
    const layer = state.layers.find(l => l.id === last.layerId);
    if (layer) {
      layer.strokes.push(last.stroke);
      state.undoStack.push(last);
      saveData(); redrawCanvas();
    }
  }

  const TAP_THRESHOLD = 10;
  const TAP_TIME = 300;

  function onPointerDown(e) {
    if (e.touches && e.touches.length > 1) return;
    const sx = e.clientX ?? e.touches[0].clientX;
    const sy = e.clientY ?? e.touches[0].clientY;
    if (state.drawMode) { startStroke(sx, sy); return; }
    state.pointerDown = { x: sx, y: sy, time: Date.now(), moved: false, tx: state.transform.x, ty: state.transform.y };
    state.isPanning = false;
  }

  function onPointerMove(e) {
    if (e.touches && e.touches.length > 1) return;
    const sx = e.clientX ?? (e.touches && e.touches[0].clientX);
    const sy = e.clientY ?? (e.touches && e.touches[0].clientY);
    if (sx == null) return;
    if (state.drawMode && state.isDrawing) { continueStroke(sx, sy); return; }
    if (!state.pointerDown) return;
    const dx = sx - state.pointerDown.x;
    const dy = sy - state.pointerDown.y;
    if (Math.hypot(dx, dy) > TAP_THRESHOLD) {
      state.pointerDown.moved = true;
      state.isPanning = true;
      state.transform.x = state.pointerDown.tx + dx;
      state.transform.y = state.pointerDown.ty + dy;
      applyTransform();
      mapContainer.style.cursor = 'grabbing';
    }
  }

  function onPointerUp(e) {
    if (state.drawMode) { endStroke(); return; }
    if (!state.pointerDown) return;
    const elapsed = Date.now() - state.pointerDown.time;
    const wasTap = !state.pointerDown.moved && elapsed < TAP_TIME;
    if (wasTap) handleTap(state.pointerDown.x, state.pointerDown.y);
    state.pointerDown = null;
    state.isPanning = false;
    mapContainer.style.cursor = state.drawMode ? 'crosshair' : 'grab';
  }

  function handleTap(sx, sy) {
    const [mx, my] = screenToMap(sx, sy);
    const hitPin = state.pins.find(p => Math.hypot(p.x - mx, p.y - my) < 16 / state.transform.k);
    if (hitPin) { openPinMemo(hitPin); return; }
  }

  function addPinAt(sx, sy) {
    const [x, y] = screenToMap(sx, sy);
    const pin = { id: 'pin_' + Date.now(), x, y, title: '', memo: '' };
    state.pins.push(pin);
    saveData();
    renderMap();
    openPinMemo(pin);
  }

  function openPinMemo(pin) {
    state.selectedPin = pin;
    state.selectedCountry = null;
    document.getElementById('memo-country-name').textContent = pin.title || 'ピンメモ';
    document.getElementById('country-memo').value = pin.memo || '';
    document.getElementById('city-list').innerHTML = '';
    const addCityBtn = document.getElementById('btn-add-city');
    if (addCityBtn) addCityBtn.style.display = 'none';
    document.getElementById('memo-panel').classList.remove('hidden');
  }

  function closeMemo() {
    state.selectedCountry = null;
    state.selectedPin = null;
    document.getElementById('memo-panel').classList.add('hidden');
    const addCityBtn = document.getElementById('btn-add-city');
    if (addCityBtn) addCityBtn.style.display = '';
    renderMap();
  }

  function onWheel(e) {
    e.preventDefault();
    const sx = e.clientX, sy = e.clientY;
    const factor = e.deltaY < 0 ? 1.12 : 0.89;
    const newK = Math.max(0.35, Math.min(18, state.transform.k * factor));
    state.transform.x = sx - (sx - state.transform.x) * (newK / state.transform.k);
    state.transform.y = sy - (sy - state.transform.y) * (newK / state.transform.k);
    state.transform.k = newK;
    applyTransform();
  }

  let lastTouchDist = 0;
  function onTouchStart(e) {
    if (e.touches.length === 2) {
      lastTouchDist = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
    } else if (e.touches.length === 1) onPointerDown(e.touches[0]);
  }
  function onTouchMove(e) {
    e.preventDefault();
    if (e.touches.length === 2) {
      const dist = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
      if (lastTouchDist > 0) {
        const factor = dist / lastTouchDist;
        const midX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
        const midY = (e.touches[0].clientY + e.touches[1].clientY) / 2;
        const newK = Math.max(0.35, Math.min(18, state.transform.k * factor));
        state.transform.x = midX - (midX - state.transform.x) * (newK / state.transform.k);
        state.transform.y = midY - (midY - state.transform.y) * (newK / state.transform.k);
        state.transform.k = newK;
        applyTransform();
      }
      lastTouchDist = dist;
    } else if (e.touches.length === 1) {
      if (state.drawMode) continueStroke(e.touches[0].clientX, e.touches[0].clientY);
      else onPointerMove(e.touches[0]);
    }
  }
  function onTouchEnd(e) {
    if (e.touches.length < 2) lastTouchDist = 0;
    if (e.touches.length === 0) onPointerUp(e);
  }

  function showToast(msg) {
    toastEl.textContent = msg;
    toastEl.classList.remove('hidden');
    setTimeout(() => toastEl.classList.add('hidden'), 2000);
  }

  function renderLayers() {
    const list = document.getElementById('layer-list');
    list.innerHTML = '';
    state.layers.forEach(layer => {
      const div = document.createElement('div');
      div.className = 'layer-item' + (layer.id === state.activeLayerId ? ' active' : '');
      div.innerHTML = '<button class="eye ' + (layer.visible ? 'visible' : '') + '" data-id="' + layer.id + '">' + (layer.visible ? '👁' : '👁‍🗨') + '</button><input type="text" value="' + escapeHtml(layer.name) + '" data-id="' + layer.id + '" class="layer-name" /><button class="delete-layer" data-id="' + layer.id + '">×</button>';
      div.addEventListener('click', (e) => {
        if (e.target.closest('button') || e.target.closest('input')) return;
        state.activeLayerId = layer.id;
        renderLayers();
      });
      list.appendChild(div);
    });
    list.querySelectorAll('.eye').forEach(btn => {
      btn.onclick = (e) => {
        e.stopPropagation();
        const layer = state.layers.find(l => l.id === btn.dataset.id);
        if (layer) { layer.visible = !layer.visible; saveData(); renderLayers(); redrawCanvas(); }
      };
    });
    list.querySelectorAll('.layer-name').forEach(input => {
      input.onchange = () => {
        const layer = state.layers.find(l => l.id === input.dataset.id);
        if (layer) { layer.name = input.value.trim() || '無題'; saveData(); }
      };
    });
    list.querySelectorAll('.delete-layer').forEach(btn => {
      btn.onclick = (e) => {
        e.stopPropagation();
        if (state.layers.length <= 1) return showToast('最低1つ必要です');
        state.layers = state.layers.filter(l => l.id !== btn.dataset.id);
        if (state.activeLayerId === btn.dataset.id) state.activeLayerId = state.layers[0].id;
        saveData(); renderLayers(); redrawCanvas();
      };
    });
  }

  function escapeHtml(s) {
    return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  function bindUI() {
    document.getElementById('btn-draw-mode').onclick = () => {
      state.drawMode = !state.drawMode;
      document.getElementById('btn-draw-mode').classList.toggle('active', state.drawMode);
      document.getElementById('draw-tools').classList.toggle('hidden', !state.drawMode);
      mapContainer.classList.toggle('drawing', state.drawMode);
      mapContainer.style.cursor = state.drawMode ? 'crosshair' : 'grab';
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
    document.getElementById('btn-layers').onclick = () => {
      document.getElementById('layer-panel').classList.toggle('hidden');
      renderLayers();
    };
    document.getElementById('btn-close-layers').onclick = () => document.getElementById('layer-panel').classList.add('hidden');
    document.getElementById('btn-add-layer').onclick = () => {
      const id = 'layer_' + Date.now();
      state.layers.push({ id, name: '新しいレイヤー', visible: true, strokes: [] });
      state.activeLayerId = id;
      saveData(); renderLayers();
    };
    document.getElementById('btn-reset-view').onclick = () => {
      state.transform = { x: 0, y: 0, k: 1 };
      applyTransform();
    };
    document.getElementById('btn-close-memo').onclick = closeMemo;

    document.getElementById('btn-save-country').onclick = () => {
      if (state.selectedPin) {
        state.selectedPin.memo = document.getElementById('country-memo').value;
        if (!state.selectedPin.title) state.selectedPin.title = 'ピンメモ';
        saveData();
        showToast('ピンを保存しました');
        closeMemo();
        renderMap();
        return;
      }
    };

    document.getElementById('btn-delete-country').onclick = () => {
      if (state.selectedPin) {
        state.pins = state.pins.filter(p => p.id !== state.selectedPin.id);
        saveData();
        closeMemo();
        renderMap();
        showToast('ピンを削除しました');
      }
    };

    let pinBtn = document.getElementById('btn-add-pin');
    if (!pinBtn) {
      pinBtn = document.createElement('button');
      pinBtn.id = 'btn-add-pin';
      pinBtn.className = 'tool-btn';
      pinBtn.title = 'ピンを追加';
      pinBtn.textContent = '📍';
      const toolbar = document.getElementById('toolbar');
      const layersBtn = document.getElementById('btn-layers');
      toolbar.insertBefore(pinBtn, layersBtn);
    }
    pinBtn.onclick = () => {
      addPinAt(state.width / 2, state.height / 2);
      showToast('画面中央にピンを置きました');
    };

    mapContainer.addEventListener('mousedown', onPointerDown);
    window.addEventListener('mousemove', onPointerMove);
    window.addEventListener('mouseup', onPointerUp);
    mapContainer.addEventListener('wheel', onWheel, { passive: false });
    mapContainer.addEventListener('touchstart', onTouchStart, { passive: false });
    mapContainer.addEventListener('touchmove', onTouchMove, { passive: false });
    mapContainer.addEventListener('touchend', onTouchEnd);
    window.addEventListener('resize', () => { initSize(); createProjection(); renderMap(); });
  }

  async function boot() {
    loadData();
    initSize();
    createProjection();
    try {
      const [countries, rivers] = await Promise.all([
        d3.json('https://raw.githubusercontent.com/datasets/geo-boundaries-world-110m/master/countries.geojson'),
        d3.json('https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_50m_rivers_lake_centerlines.geojson')
      ]);
      state.countryFeatures = countries;
      state.riverFeatures = rivers;
    } catch (e) {
      console.error(e);
      showToast('地図データの読み込みに失敗しました');
      return;
    }
    renderMap();
    redrawCanvas();
    bindUI();
    renderLayers();
  }

  boot();
})();
