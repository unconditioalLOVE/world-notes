((() => {
  'use strict';

  // ========== State ==========
  const state = {
    countries: {},      // ISO -> { memo, cities: [{id,name,memo}] }
    layers: [],         // [{id, name, visible, strokes: [{points, color, width, type}]}]
    activeLayerId: null,
    selectedCountry: null,
    drawMode: false,
    tool: 'pen',        // pen | eraser
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
  };

  // Japanese country names (subset + fallback)
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

  // ========== DOM ==========
  const svg = d3.select('#map-svg');
  const canvas = document.getElementById('draw-canvas');
  const ctx = canvas.getContext('2d');
  const mapContainer = document.getElementById('map-container');
  const toastEl = document.getElementById('toast');

  // ========== Storage ==========
  const STORAGE_KEY = 'world-notes-v1';

  function loadData() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const data = JSON.parse(raw);
        state.countries = data.countries || {};
        state.layers = data.layers || [];
        if (state.layers.length === 0) {
          createDefaultLayer();
        } else {
          state.activeLayerId = state.layers[0].id;
        }
      } else {
        createDefaultLayer();
      }
    } catch (e) {
      console.warn('Load failed', e);
      createDefaultLayer();
    }
  }

  function saveData() {
    try {
      const data = {
        countries: state.countries,
        layers: state.layers
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (e) {
      console.warn('Save failed', e);
      showToast('保存に失敗しました（容量超過の可能性）');
    }
  }

  function createDefaultLayer() {
    const id = 'layer_' + Date.now();
    state.layers = [{
      id,
      name: 'メモ',
      visible: true,
      strokes: []
    }];
    state.activeLayerId = id;
  }

  // ========== Map Rendering ==========
  function initSize() {
    state.width = mapContainer.clientWidth;
    state.height = mapContainer.clientHeight;
    svg.attr('width', state.width).attr('height', state.height);
    canvas.width = state.width;
    canvas.height = state.height;
  }

  function createProjection() {
    state.projection = d3.geoMercator()
      .scale(state.width / (2 * Math.PI) * 0.9)
      .translate([state.width / 2, state.height / 1.6]);
    state.pathGen = d3.geoPath().projection(state.projection);
  }

  function renderMap() {
    svg.selectAll('*').remove();

    const g = svg.append('g').attr('class', 'map-group');

    // Countries
    const countriesG = g.append('g').attr('class', 'countries');
    countriesG.selectAll('path')
      .data(state.countryFeatures.features)
      .join('path')
      .attr('class', d => {
        const iso = (d.properties.iso_a2 || '').toUpperCase();
        let cls = 'country';
        if (iso && state.countries[iso] && (state.countries[iso].memo || (state.countries[iso].cities && state.countries[iso].cities.length))) {
          cls += ' has-memo';
        }
        if (state.selectedCountry === iso) cls += ' selected';
        return cls;
      })
      .attr('d', state.pathGen)
      .attr('data-iso', d => (d.properties.iso_a2 || '').toUpperCase())
      .on('click', (event, d) => {
        if (state.drawMode) return;
        event.stopPropagation();
        const iso = (d.properties.iso_a2 || '').toUpperCase();
        if (!iso || iso === '-99') return;
        openMemo(iso, d.properties);
      });

    // Rivers
    const riversG = g.append('g').attr('class', 'rivers');
    riversG.selectAll('path')
      .data(state.riverFeatures.features)
      .join('path')
      .attr('class', 'river')
      .attr('d', state.pathGen);

    // Memo markers
    const markersG = g.append('g').attr('class', 'markers');
    Object.keys(state.countries).forEach(iso => {
      const c = state.countries[iso];
      if (!c || (!c.memo && (!c.cities || !c.cities.length))) return;
      const feat = state.countryFeatures.features.find(f => (f.properties.iso_a2 || '').toUpperCase() === iso);
      if (!feat) return;
      const centroid = state.pathGen.centroid(feat);
      if (!centroid || isNaN(centroid[0])) return;
      markersG.append('circle')
        .attr('class', 'memo-marker')
        .attr('cx', centroid[0])
        .attr('cy', centroid[1])
        .attr('r', 3);
    });

    applyTransform();
  }

  function applyTransform() {
    const { x, y, k } = state.transform;
    svg.select('.map-group')
      .attr('transform', `translate(${x},${y}) scale(${k})`);
    // scale stroke widths inversely so borders stay thin
    svg.selectAll('.country').attr('stroke-width', 0.5 / k);
    svg.selectAll('.river').attr('stroke-width', 1.2 / k);
    svg.selectAll('.memo-marker').attr('r', 3 / k);
    redrawCanvas();
  }

  // ========== Drawing ==========
  function getActiveLayer() {
    return state.layers.find(l => l.id === state.activeLayerId);
  }

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
        ctx.strokeStyle = stroke.type === 'eraser' ? 'rgba(0,0,0,0)' : stroke.color;
        ctx.lineWidth = stroke.width;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        if (stroke.type === 'eraser') {
          ctx.globalCompositeOperation = 'destination-out';
        } else {
          ctx.globalCompositeOperation = 'source-over';
        }
        ctx.moveTo(stroke.points[0][0], stroke.points[0][1]);
        for (let i = 1; i < stroke.points.length; i++) {
          ctx.lineTo(stroke.points[i][0], stroke.points[i][1]);
        }
        ctx.stroke();
      });
    });

    // current stroke
    if (state.currentStroke && state.currentStroke.points.length > 1) {
      const s = state.currentStroke;
      ctx.beginPath();
      ctx.strokeStyle = s.type === 'eraser' ? 'rgba(0,0,0,0)' : s.color;
      ctx.lineWidth = s.width;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      if (s.type === 'eraser') {
        ctx.globalCompositeOperation = 'destination-out';
      } else {
        ctx.globalCompositeOperation = 'source-over';
      }
      ctx.moveTo(s.points[0][0], s.points[0][1]);
      for (let i = 1; i < s.points.length; i++) {
        ctx.lineTo(s.points[i][0], s.points[i][1]);
      }
      ctx.stroke();
    }

    ctx.restore();
  }

  function startStroke(sx, sy) {
    if (!state.drawMode) return;
    const layer = getActiveLayer();
    if (!layer) return;
    state.isDrawing = true;
    const pt = screenToMap(sx, sy);
    state.currentStroke = {
      points: [pt],
      color: state.color,
      width: state.strokeWidth / state.transform.k, // keep visual width roughly constant? or absolute in map space
      type: state.tool
    };
    // Actually store width in map space so zoom keeps relative thickness
    state.currentStroke.width = state.strokeWidth;
  }

  function continueStroke(sx, sy) {
    if (!state.isDrawing || !state.currentStroke) return;
    const pt = screenToMap(sx, sy);
    state.currentStroke.points.push(pt);
    redrawCanvas();
  }

  function endStroke() {
    if (!state.isDrawing || !state.currentStroke) return;
    state.isDrawing = false;
    const layer = getActiveLayer();
    if (layer && state.currentStroke.points.length > 1) {
      // push undo
      state.undoStack.push({
        layerId: layer.id,
        stroke: JSON.parse(JSON.stringify(state.currentStroke)),
        action: 'add'
      });
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
    if (!layer) return;
    if (last.action === 'add') {
      const idx = layer.strokes.findIndex(s => s === last.stroke || JSON.stringify(s) === JSON.stringify(last.stroke));
      // better: just pop last stroke if matches
      if (layer.strokes.length) {
        const removed = layer.strokes.pop();
        state.redoStack.push({ layerId: layer.id, stroke: removed, action: 'add' });
      }
    }
    saveData();
    redrawCanvas();
  }

  function redo() {
    const last = state.redoStack.pop();
    if (!last) return;
    const layer = state.layers.find(l => l.id === last.layerId);
    if (!layer) return;
    layer.strokes.push(last.stroke);
    state.undoStack.push(last);
    saveData();
    redrawCanvas();
  }

  // ========== Interaction (pan / zoom / draw) ==========
  let lastTouchDist = 0;
  let isPanning = false;
  let panStart = null;

  function onPointerDown(e) {
    e.preventDefault();
    const sx = e.clientX ?? (e.touches && e.touches[0].clientX);
    const sy = e.clientY ?? (e.touches && e.touches[0].clientY);
    if (state.drawMode) {
      startStroke(sx, sy);
      return;
    }
    isPanning = true;
    panStart = { x: sx, y: sy, tx: state.transform.x, ty: state.transform.y };
    mapContainer.style.cursor = 'grabbing';
  }

  function onPointerMove(e) {
    e.preventDefault();
    const sx = e.clientX ?? (e.touches && e.touches[0].clientX);
    const sy = e.clientY ?? (e.touches && e.touches[0].clientY);
    if (state.drawMode && state.isDrawing) {
      continueStroke(sx, sy);
      return;
    }
    if (isPanning && panStart) {
      state.transform.x = panStart.tx + (sx - panStart.x);
      state.transform.y = panStart.ty + (sy - panStart.y);
      applyTransform();
    }
  }

  function onPointerUp(e) {
    if (state.drawMode) {
      endStroke();
      return;
    }
    isPanning = false;
    panStart = null;
    mapContainer.style.cursor = state.drawMode ? 'crosshair' : 'grab';
  }

  function onWheel(e) {
    e.preventDefault();
    const sx = e.clientX;
    const sy = e.clientY;
    const factor = e.deltaY < 0 ? 1.12 : 0.89;
    const newK = Math.max(0.4, Math.min(20, state.transform.k * factor));
    // zoom toward pointer
    state.transform.x = sx - (sx - state.transform.x) * (newK / state.transform.k);
    state.transform.y = sy - (sy - state.transform.y) * (newK / state.transform.k);
    state.transform.k = newK;
    applyTransform();
  }

  // Touch pinch
  function onTouchStart(e) {
    if (e.touches.length === 2) {
      lastTouchDist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
    } else if (e.touches.length === 1) {
      onPointerDown(e.touches[0]);
    }
  }

  function onTouchMove(e) {
    e.preventDefault();
    if (e.touches.length === 2) {
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      if (lastTouchDist > 0) {
        const factor = dist / lastTouchDist;
        const midX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
        const midY = (e.touches[0].clientY + e.touches[1].clientY) / 2;
        const newK = Math.max(0.4, Math.min(20, state.transform.k * factor));
        state.transform.x = midX - (midX - state.transform.x) * (newK / state.transform.k);
        state.transform.y = midY - (midY - state.transform.y) * (newK / state.transform.k);
        state.transform.k = newK;
        applyTransform();
      }
      lastTouchDist = dist;
    } else if (e.touches.length === 1 && !state.drawMode) {
      onPointerMove(e.touches[0]);
    } else if (state.drawMode && e.touches.length === 1) {
      continueStroke(e.touches[0].clientX, e.touches[0].clientY);
    }
  }

  function onTouchEnd(e) {
    if (e.touches.length < 2) lastTouchDist = 0;
    if (e.touches.length === 0) {
      onPointerUp(e);
    }
  }

  // ========== Memo Panel ==========
  function openMemo(iso, props) {
    state.selectedCountry = iso;
    const nameEn = props.name || props.admin || iso;
    const nameJa = JA_NAMES[iso] || nameEn;
    document.getElementById('memo-country-name').textContent = `${nameJa} / ${nameEn}`;

    if (!state.countries[iso]) {
      state.countries[iso] = { memo: '', cities: [] };
    }
    document.getElementById('country-memo').value = state.countries[iso].memo || '';
    renderCityList(iso);
    document.getElementById('memo-panel').classList.remove('hidden');
    renderMap(); // update selection
  }

  function closeMemo() {
    state.selectedCountry = null;
    document.getElementById('memo-panel').classList.add('hidden');
    renderMap();
  }

  function renderCityList(iso) {
    const list = document.getElementById('city-list');
    list.innerHTML = '';
    const cities = state.countries[iso]?.cities || [];
    cities.forEach((city, idx) => {
      const div = document.createElement('div');
      div.className = 'city-item';
      div.innerHTML = `
        <input type="text" value="${escapeHtml(city.name)}" data-idx="${idx}" class="city-name" placeholder="都市名" />
        <textarea data-idx="${idx}" class="city-memo" placeholder="メモ...">${escapeHtml(city.memo || '')}</textarea>
        <div class="city-actions">
          <button class="small-btn save-city" data-idx="${idx}">保存</button>
          <button class="small-btn danger-btn del-city" data-idx="${idx}">削除</button>
        </div>
      `;
      list.appendChild(div);
    });

    list.querySelectorAll('.save-city').forEach(btn => {
      btn.addEventListener('click', () => {
        const i = +btn.dataset.idx;
        const name = list.querySelector(`.city-name[data-idx="${i}"]`).value.trim();
        const memo = list.querySelector(`.city-memo[data-idx="${i}"]`).value;
        if (!name) return;
        state.countries[iso].cities[i].name = name;
        state.countries[iso].cities[i].memo = memo;
        saveData();
        showToast('都市メモを保存しました');
        renderMap();
      });
    });

    list.querySelectorAll('.del-city').forEach(btn => {
      btn.addEventListener('click', () => {
        const i = +btn.dataset.idx;
        state.countries[iso].cities.splice(i, 1);
        saveData();
        renderCityList(iso);
        renderMap();
      });
    });
  }

  function escapeHtml(s) {
    return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  // ========== Layers UI ==========
  function renderLayers() {
    const list = document.getElementById('layer-list');
    list.innerHTML = '';
    state.layers.forEach(layer => {
      const div = document.createElement('div');
      div.className = 'layer-item' + (layer.id === state.activeLayerId ? ' active' : '');
      div.innerHTML = `
        <button class="eye ${layer.visible ? 'visible' : ''}" data-id="${layer.id}" title="表示切替">${layer.visible ? '👁' : '👁‍🗨'}</button>
        <input type="text" value="${escapeHtml(layer.name)}" data-id="${layer.id}" class="layer-name" />
        <button class="delete-layer" data-id="${layer.id}" title="削除">×</button>
      `;
      div.addEventListener('click', (e) => {
        if (e.target.closest('button') || e.target.closest('input')) return;
        state.activeLayerId = layer.id;
        renderLayers();
      });
      list.appendChild(div);
    });

    list.querySelectorAll('.eye').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = btn.dataset.id;
        const layer = state.layers.find(l => l.id === id);
        if (layer) {
          layer.visible = !layer.visible;
          saveData();
          renderLayers();
          redrawCanvas();
        }
      });
    });

    list.querySelectorAll('.layer-name').forEach(input => {
      input.addEventListener('change', () => {
        const layer = state.layers.find(l => l.id === input.dataset.id);
        if (layer) {
          layer.name = input.value.trim() || '無題';
          saveData();
        }
      });
    });

    list.querySelectorAll('.delete-layer').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (state.layers.length <= 1) {
          showToast('最低1つのレイヤーが必要です');
          return;
        }
        const id = btn.dataset.id;
        state.layers = state.layers.filter(l => l.id !== id);
        if (state.activeLayerId === id) state.activeLayerId = state.layers[0].id;
        saveData();
        renderLayers();
        redrawCanvas();
      });
    });
  }

  function showToast(msg) {
    toastEl.textContent = msg;
    toastEl.classList.remove('hidden');
    setTimeout(() => toastEl.classList.add('hidden'), 2200);
  }

  // ========== Event bindings ==========
  function bindUI() {
    document.getElementById('btn-draw-mode').addEventListener('click', () => {
      state.drawMode = !state.drawMode;
      document.getElementById('btn-draw-mode').classList.toggle('active', state.drawMode);
      document.getElementById('draw-tools').classList.toggle('hidden', !state.drawMode);
      mapContainer.classList.toggle('drawing', state.drawMode);
      mapContainer.style.cursor = state.drawMode ? 'crosshair' : 'grab';
    });

    document.getElementById('btn-pen').addEventListener('click', () => {
      state.tool = 'pen';
      document.getElementById('btn-pen').classList.add('active');
      document.getElementById('btn-eraser').classList.remove('active');
    });

    document.getElementById('btn-eraser').addEventListener('click', () => {
      state.tool = 'eraser';
      document.getElementById('btn-eraser').classList.add('active');
      document.getElementById('btn-pen').classList.remove('active');
    });

    document.getElementById('color-picker').addEventListener('input', (e) => {
      state.color = e.target.value;
    });

    document.getElementById('stroke-width').addEventListener('input', (e) => {
      state.strokeWidth = +e.target.value;
    });

    document.getElementById('btn-undo').addEventListener('click', undo);
    document.getElementById('btn-redo').addEventListener('click', redo);

    document.getElementById('btn-layers').addEventListener('click', () => {
      document.getElementById('layer-panel').classList.toggle('hidden');
      renderLayers();
    });

    document.getElementById('btn-close-layers').addEventListener('click', () => {
      document.getElementById('layer-panel').classList.add('hidden');
    });

    document.getElementById('btn-add-layer').addEventListener('click', () => {
      const id = 'layer_' + Date.now();
      state.layers.push({ id, name: '新しいレイヤー', visible: true, strokes: [] });
      state.activeLayerId = id;
      saveData();
      renderLayers();
    });

    document.getElementById('btn-reset-view').addEventListener('click', () => {
      state.transform = { x: 0, y: 0, k: 1 };
      applyTransform();
    });

    document.getElementById('btn-close-memo').addEventListener('click', closeMemo);

    document.getElementById('btn-save-country').addEventListener('click', () => {
      const iso = state.selectedCountry;
      if (!iso) return;
      if (!state.countries[iso]) state.countries[iso] = { memo: '', cities: [] };
      state.countries[iso].memo = document.getElementById('country-memo').value;
      saveData();
      showToast('国メモを保存しました');
      renderMap();
    });

    document.getElementById('btn-delete-country').addEventListener('click', () => {
      const iso = state.selectedCountry;
      if (!iso) return;
      delete state.countries[iso];
      saveData();
      closeMemo();
      showToast('メモを削除しました');
      renderMap();
    });

    document.getElementById('btn-add-city').addEventListener('click', () => {
      const iso = state.selectedCountry;
      if (!iso) return;
      if (!state.countries[iso]) state.countries[iso] = { memo: '', cities: [] };
      state.countries[iso].cities.push({
        id: 'city_' + Date.now(),
        name: '',
        memo: ''
      });
      renderCityList(iso);
    });

    // Pointer events
    mapContainer.addEventListener('mousedown', onPointerDown);
    window.addEventListener('mousemove', onPointerMove);
    window.addEventListener('mouseup', onPointerUp);
    mapContainer.addEventListener('wheel', onWheel, { passive: false });

    mapContainer.addEventListener('touchstart', onTouchStart, { passive: false });
    mapContainer.addEventListener('touchmove', onTouchMove, { passive: false });
    mapContainer.addEventListener('touchend', onTouchEnd);

    window.addEventListener('resize', () => {
      initSize();
      createProjection();
      renderMap();
    });
  }

  // ========== Boot ==========
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
