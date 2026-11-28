(() => {
  'use strict';

  /* =========================================================
   * 定数
   * ======================================================= */
  const W = 1000;                       // 投影の基準サイズ（画面サイズに依存しない固定投影）
  const BUILD = '2026-11-28-v32-stats';
  const KEY = 'world-notes-v4';
  const OLD_KEYS = ['world-notes-v3', 'world-notes-v2', 'world-notes-v1'];
  const TAP_DIST = 8;
  const TAP_MS = 600;
  const PIN_HIT = 20;
  const FILL_DEFAULT = '#111111';
  const TROPIC = 23.4366;
  const FONT = '600 100px -apple-system, BlinkMacSystemFont, "Hiragino Sans", "Noto Sans JP", sans-serif';

  // 6種の模様（色は currentColor）。tile は「基準ズーム」での大きさ。ズームに応じて2倍刻みで密度を切り替える
  const PATTERNS = [
    { id: 'diag',  name: '斜線', w: 7,  h: 7,
      body: '<path d="M-1,8 L8,-1 M-1,1 L1,-1 M6,8 L8,6" stroke="currentColor" stroke-width="1" fill="none"/>' },
    { id: 'grid',  name: '格子', w: 9,  h: 9,
      body: '<path d="M0,0.5 H9 M0.5,0 V9" stroke="currentColor" stroke-width="0.9" fill="none"/>' },
    { id: 'dots',  name: '小粒', w: 5,  h: 5,
      body: '<circle cx="2.5" cy="2.5" r="0.9" fill="currentColor"/>' },
    { id: 'hline', name: '横線', w: 5,  h: 5,
      body: '<path d="M0,2.5 H5" stroke="currentColor" stroke-width="1" fill="none"/>' },
    { id: 'vline', name: '縦線', w: 5,  h: 5,
      body: '<path d="M2.5,0 V5" stroke="currentColor" stroke-width="1" fill="none"/>' },
    { id: 'cross', name: '十字', w: 11, h: 11,
      body: '<path d="M3.5,5.5 H7.5 M5.5,3.5 V7.5" stroke="currentColor" stroke-width="1" fill="none"/>' }
  ];

  const KINDS = [
    { id: 'normal',  name: '通常' },
    { id: 'capital', name: '首都' }
  ];

  // サイズ（地図基準＝拡大縮小しても地図に対する大きさは変わらない）。スライダーは対数
  const SIZE = {
    pen:   { min: 0.05, max: 8 },
    text:  { min: 0.1,  max: 60 },
    stamp: { min: 0.3,  max: 60 }
  };
  // スタンプの大きさは3段階（地図上の大きさ。最小≒ピンより少し大きい / 最大≒スリランカ大）
  const STAMP_SIZES = { S: 4, M: 7, L: 10 };

  /* =========================================================
   * スタンプ定義（24x24 のシルエット。f=主色 f2=副色 k=黒 w=白 s=線 ws=白線）
   * ======================================================= */
  const fx = n => +n.toFixed(2);
  const C = (cx, cy, r) => `M${fx(cx - r)} ${cy}a${r} ${r} 0 1 0 ${fx(2 * r)} 0a${r} ${r} 0 1 0 ${fx(-2 * r)} 0Z`;
  const E = (cx, cy, rx, ry, rot = 0) => {
    const a = rot * Math.PI / 180, dx = rx * Math.cos(a), dy = rx * Math.sin(a);
    const x1 = fx(cx - dx), y1 = fx(cy - dy), x2 = fx(cx + dx), y2 = fx(cy + dy);
    return `M${x1} ${y1}A${rx} ${ry} ${rot} 1 0 ${x2} ${y2}A${rx} ${ry} ${rot} 1 0 ${x1} ${y1}Z`;
  };
  const wheat = (id, name, c) => ({
    id, cat: 'agri', name, c,
    shapes: [
      ['s', 'M12 22V9', 1.5],
      ['f', E(12, 3.9, 1.5, 2.7, 0)],
      ['f', E(9.6, 7.3, 1.5, 2.7, -25)], ['f', E(14.4, 7.3, 1.5, 2.7, 25)],
      ['f', E(9.6, 10.9, 1.5, 2.7, -25)], ['f', E(14.4, 10.9, 1.5, 2.7, 25)],
      ['f', E(9.8, 14.5, 1.5, 2.7, -25)], ['f', E(14.2, 14.5, 1.5, 2.7, 25)]
    ]
  });
  const cornDots = (() => {
    let d = '';
    [5.4, 8, 10.6, 13.2].forEach((y, i) => [10.3, 12, 13.7].forEach(x => { d += C(x, y + (i % 2 ? 0.6 : 0), 0.7); }));
    return d;
  })();

  // 歯車・星・放射能マーク・宝石（上面）などの生成パス
  const P2 = (cx, cy, r, a) => `${fx(cx + r * Math.cos(a))} ${fx(cy + r * Math.sin(a))}`;
  const gearPath = (() => {
    let d = '';
    for (let i = 0; i < 8; i++) {
      const a = i * Math.PI / 4, ca = Math.cos(a), sa = Math.sin(a);
      const p = (x, y) => `${fx(12 + x * ca - y * sa)} ${fx(12 + x * sa + y * ca)}`;
      d += `M${p(-1.7, -10)}L${p(1.7, -10)}L${p(2.3, -5)}L${p(-2.3, -5)}Z`;
    }
    return d + C(12, 12, 7);
  })();
  const starPath = (() => {
    let d = '';
    for (let i = 0; i < 10; i++) d += (i ? 'L' : 'M') + P2(12, 12, i % 2 ? 2.7 : 6.4, -Math.PI / 2 + i * Math.PI / 5);
    return d + 'Z';
  })();
  const trefoil = (() => {
    let d = '';
    [270, 30, 150].forEach(c0 => {
      const a0 = (c0 - 30) * Math.PI / 180, a1 = (c0 + 30) * Math.PI / 180, R = 8.4, r = 2.8;
      d += `M${P2(12, 12, r, a0)}L${P2(12, 12, R, a0)}A${R} ${R} 0 0 1 ${P2(12, 12, R, a1)}L${P2(12, 12, r, a1)}A${r} ${r} 0 0 0 ${P2(12, 12, r, a0)}Z`;
    });
    return d;
  })();
  const octPts = r => Array.from({ length: 8 }, (_, i) => [12 + r * Math.cos((22.5 + i * 45) * Math.PI / 180), 12 + r * Math.sin((22.5 + i * 45) * Math.PI / 180)]);
  const octD = pts => 'M' + pts.map(q => fx(q[0]) + ' ' + fx(q[1])).join('L') + 'Z';
  const diamondFacets = (() => {
    const o = octPts(9.8), t = octPts(4.8);
    let d = octD(t);
    o.forEach((q, i) => { d += `M${fx(q[0])} ${fx(q[1])}L${fx(t[i][0])} ${fx(t[i][1])}`; });
    return d;
  })();

  const STAMPS = [
    // ---------- 農牧業 ----------
    { id: 'rice', cat: 'agri', name: 'コメ', c: '#7d8f3a', shapes: [
      ['s', 'M6 21C6.5 13 9.5 7 16.5 5', 1.5],
      ['f', E(9.3, 15.2, 1.25, 2.4, 0)], ['f', E(12, 12.4, 1.25, 2.4, 0)], ['f', E(14.8, 10.2, 1.25, 2.4, 0)], ['f', E(17.4, 8.4, 1.25, 2.4, 0)],
      ['f', E(8.2, 11.3, 1.2, 2.2, 25)], ['f', E(10.8, 8.4, 1.2, 2.2, 38)], ['f', E(13.8, 6.3, 1.2, 2.2, 50)]] },
    wheat('wheat-s', '小麦(春)', '#79b05a'),
    wheat('wheat-w', '小麦(冬)', '#c98a2b'),
    { id: 'cane', cat: 'agri', name: 'サトウキビ', c: '#5b8f5a', c2: '#8fbf6a', shapes: [
      ['f2', 'M13 7C17 4 20 5 22 8C19 8 16 8.5 13 10Z'],
      ['f2', 'M9 11C6 9 4 9 2 11C5 12.5 7 12.5 9 13Z'],
      ['f', 'M9 21V5Q9 4 10 4H13Q14 4 14 5V21Q14 22 13 22H10Q9 22 9 21Z'],
      ['ws', 'M9 9H14M9 14H14M9 18.4H14', 1]] },
    { id: 'cacao', cat: 'agri', name: 'カカオ', c: '#8a5a3c', c2: '#5b7a3c', shapes: [
      ['f2', 'M11 1.8H13V4.6H11Z'],
      ['f', E(12, 12.8, 5.2, 8.4, 0)],
      ['ws', 'M12 5V20.6M9 6.6C7.8 10 7.8 15 9 18.6M15 6.6C16.2 10 16.2 15 15 18.6', 1]] },
    { id: 'coffee', cat: 'agri', name: 'コーヒー豆', c: '#5a3a2a', shapes: [
      ['f', E(12, 12, 6, 8.5, 25)],
      ['ws', 'M15 5C10 9 14 14 9 19', 1.3]] },
    { id: 'soy', cat: 'agri', name: '大豆', c: '#9aa23c', shapes: [
      ['f', 'M3.5 16.5C3.5 12 9 8 14 7C17.5 6.5 20.5 8 20.5 11C20.5 15 14 19 9 19.5C5.5 19.8 3.5 18.8 3.5 16.5Z'],
      ['w', C(7.6, 15.2, 2.2) + C(12.2, 12.5, 2.3) + C(16.6, 10.4, 2)]] },
    { id: 'corn', cat: 'agri', name: 'トウモロコシ', c: '#e0b030', c2: '#6c9a4a', shapes: [
      ['f2', 'M12 22C6 21 4 15 5 9C8 12 11 15 12 22Z'],
      ['f2', 'M12 22C18 21 20 15 19 9C16 12 13 15 12 22Z'],
      ['f', E(12, 10.5, 4, 7.5, 0)],
      ['w', cornDots]] },
    { id: 'cotton', cat: 'agri', name: '綿花', c: '#8ea6b9', c2: '#5b7a4a', shapes: [
      ['f', C(8.2, 10, 4) + C(15.8, 10, 4) + C(12, 6.8, 4.2) + C(12, 12, 4.8)],
      ['f2', 'M6 14.5L9 21.5L12 18.5L15 21.5L18 14.5C15 16.8 9 16.8 6 14.5Z']] },
    { id: 'grape', cat: 'agri', name: 'ブドウ', c: '#6b3f8a', c2: '#5b8a3c', shapes: [
      ['f2', 'M11.3 2.5H12.7V7.5H11.3Z'],
      ['f2', 'M12.5 4C14.5 1.8 18 2 20 4.2C17.5 6 14.5 6 12.5 5Z'],
      ['f', C(7.5, 9, 2) + C(10.5, 9, 2) + C(13.5, 9, 2) + C(16.5, 9, 2) + C(9, 12.4, 2) + C(12, 12.4, 2) + C(15, 12.4, 2) + C(10.5, 15.8, 2) + C(13.5, 15.8, 2) + C(12, 19.2, 2)],
      ['w', C(7, 8.4, 0.45) + C(10, 8.4, 0.45) + C(13, 8.4, 0.45) + C(16, 8.4, 0.45) + C(8.5, 11.8, 0.45) + C(11.5, 11.8, 0.45) + C(14.5, 11.8, 0.45)]] },
    { id: 'orange', cat: 'agri', name: 'オレンジ', c: '#e8891c', c2: '#4f8a3c', shapes: [
      ['f2', 'M12 6.5C11.5 3.8 14 2 17.5 2.6C17.2 5.4 15 7 12 6.5Z'],
      ['f', C(12, 14, 8)],
      ['ws', 'M6.6 15C7 18 9 20 11.6 20.4', 1],
      ['w', C(12, 7.6, 0.9)]] },
    { id: 'cork', cat: 'agri', name: 'コルクガシ', c: '#5f8a4a', c2: '#b07a42', shapes: [
      ['f2', 'M10.2 11H13.8L14.6 22H9.4Z'],
      ['ws', 'M10.6 15H13.4M10.3 18.5H13.7', 1],
      ['f', C(7.5, 9, 4) + C(16.5, 9, 4) + C(12, 6, 4.5) + C(12, 10.5, 4.5)]] },
    { id: 'oilpalm', cat: 'agri', name: 'アブラヤシ', c: '#3f7a3a', c2: '#d8641c', shapes: [
      ['f', E(12, 10.5, 8.5, 1.4, 90) + E(9, 11.5, 8, 1.4, 68) + E(15, 11.5, 8, 1.4, -68) + E(8, 13, 7.2, 1.5, 56) + E(16, 13, 7.2, 1.5, -56) + E(7, 15.5, 6, 1.3, 35) + E(17, 15.5, 6, 1.3, -35)],
      ['f2', C(10.4, 16.8, 2) + C(13.6, 16.8, 2) + C(12, 14.4, 2) + C(12, 19.2, 2)],
      ['w', C(11.5, 14, 0.4) + C(10, 16.3, 0.4) + C(13.2, 16.3, 0.4)]] },
    { id: 'datepalm', cat: 'agri', name: 'ナツメヤシ', c: '#4f8a4a', c2: '#a9622f', shapes: [
      ['f2', 'M11 10.5H13L13.7 22H10.3Z'],
      ['ws', 'M10.8 14.5H13.2M10.7 17.5H13.3M10.5 20.5H13.5', 1],
      ['f', 'M12 8.5C14 3.5 19.5 3.5 22.5 9.5C19 6.8 15 6.8 12 9.5Z M12 8.5C10 3.5 4.5 3.5 1.5 9.5C5 6.8 9 6.8 12 9.5Z M12 8.5C10.5 5 11 3 12 1.5C13 3 13.5 5 12 8.5Z M12 9.5C16 8.5 19 10.5 20 14.5C17 12 14.5 11.5 12 11Z M12 9.5C8 8.5 5 10.5 4 14.5C7 12 9.5 11.5 12 11Z'],
      ['k', E(10.4, 12.2, 0.8, 1.3, 0) + E(13.6, 12.2, 0.8, 1.3, 0) + E(12, 13, 0.8, 1.3, 0)]] },
    { id: 'tea', cat: 'agri', name: '茶', c: '#4f8a3a', c2: '#9ccb62', shapes: [
      ['f2', 'M12 21C10 15 11 8 18 3C21 10 19 17 12 21Z'],
      ['f', 'M12 21C6 20 3 14 5 8C11 9 13.5 14 12 21Z'],
      ['ws', 'M12 20.5C12.5 14 14.5 9 17.6 4.6M11.6 20C9.5 16 7.5 12.5 5.6 9', 1]] },
    { id: 'potato', cat: 'agri', name: 'ジャガイモ', c: '#b88a4e', shapes: [
      ['f', 'M3.5 13C2.5 9 7 6 12 6.5C17 6 21.5 8.5 20.5 13C20 18 15 19.5 11 19C7 18.5 4 17 3.5 13Z'],
      ['k', C(8.5, 11, 0.7) + C(14, 10.2, 0.7) + C(11.8, 15.3, 0.7) + C(16.8, 14.2, 0.7)]] },
    { id: 'olive', cat: 'agri', name: 'オリーブ', c: '#5f7a2c', c2: '#93aa5a', shapes: [
      ['s', 'M3 21C8 16 13 11 20 4.5', 1.2],
      ['f2', E(7.2, 11.2, 3.6, 1.3, -50) + E(13.2, 6.4, 3.6, 1.3, -40) + E(16.5, 12.8, 3.6, 1.3, 40) + E(10.5, 17.5, 3.6, 1.3, 35)],
      ['f', E(14.6, 9.6, 2.1, 3, -25) + E(8.8, 14.4, 2.1, 3, -25)],
      ['w', C(13.9, 8.6, 0.45) + C(8.1, 13.4, 0.45)]] },
    { id: 'rubber', cat: 'agri', name: '天然ゴム', c: '#5f8f48', c2: '#8a5a3c', shapes: [
      ['f2', 'M10 7H14V22H10Z'],
      ['f', E(7.6, 5.4, 4.4, 1.9, -25) + E(16.4, 5.4, 4.4, 1.9, 25) + E(12, 3.8, 1.8, 3, 0)],
      ['ws', 'M10 12L12 15.2L14 12', 1.1],
      ['f', 'M14 16H20L19 20.5H15Z'],
      ['w', 'M11.3 15.6H12.7V19H11.3Z']] },
    { id: 'banana', cat: 'agri', name: 'バナナ', c: '#e3b72b', c2: '#7a8a3a', shapes: [
      ['f2', 'M10 2H14V7H10Z'],
      ['f', 'M11 6.5C5.5 7.5 3.5 14 6.8 20.5C7 15.5 9 11.5 12 9.8Z'],
      ['f', 'M12 6.5C9 9.5 8.8 15.5 11.8 22C13.3 16.5 13.8 11.5 13 7Z'],
      ['f', 'M13 6.5C18.5 7.5 20.5 14 17.2 20.5C17 15.5 15 11.5 12 9.8Z'],
      ['ws', 'M11.4 9C10 12.5 10.2 17 11.4 20.5M13.6 9C15 12.5 15 16.5 14.6 19', 0.9]] },
    { id: 'jute', cat: 'agri', name: 'ジュート', c: '#8fa04a', c2: '#b08a4a', shapes: [
      ['f', 'M6.5 3L8.5 3L10 22H8Z M11 2H13V22H11Z M15.5 3L17.5 3L16 22H14Z'],
      ['f', E(7, 7, 2.8, 1, -35) + E(17, 7, 2.8, 1, 35) + E(7.5, 17.5, 2.6, 0.9, 30) + E(16.5, 17.5, 2.6, 0.9, -30)],
      ['f2', 'M6 11.5H18V14.8H6Z'],
      ['ws', 'M8 11.5L10 14.8M12 11.5L14 14.8M16 11.5L18 14.8', 0.9]] },
    { id: 'dairy', cat: 'agri', name: '酪農', c: '#5f8fb5', c2: '#d9534f', shapes: [
      ['f', 'M9.5 2.5H14.5V5C14.5 6 16.5 7.5 16.5 10V20.5Q16.5 22 15 22H9Q7.5 22 7.5 20.5V10C7.5 7.5 9.5 6 9.5 5Z'],
      ['f2', 'M9 1.8H15V3.8H9Z'],
      ['w', 'M9 12H15V17.5H9Z']] },
    { id: 'cow', cat: 'agri', name: '牛', c: '#3a3a3a', c2: '#b9a98a', shapes: [
      ['f2', 'M7.5 7C5.5 6 4 4.5 3.5 2.5C6 3 8.5 4.5 9.5 6.5Z'],
      ['f2', 'M16.5 7C18.5 6 20 4.5 20.5 2.5C18 3 15.5 4.5 14.5 6.5Z'],
      ['f', E(4.2, 10.5, 3, 1.6, -20)], ['f', E(19.8, 10.5, 3, 1.6, 20)],
      ['f', 'M7.5 6.5C9 5 15 5 16.5 6.5C17.5 9 17 13 16 16C15 19 9 19 8 16C7 13 6.5 9 7.5 6.5Z'],
      ['w', E(12, 17, 3.4, 2.6, 0) + C(9.8, 11, 0.9) + C(14.2, 11, 0.9)],
      ['k', C(10.8, 17, 0.6) + C(13.2, 17, 0.6)]] },
    { id: 'sheep', cat: 'agri', name: '羊', c: '#8d9bab', c2: '#3d3d3d', shapes: [
      ['f', C(7, 10, 3.6) + C(12, 7.5, 4) + C(17, 10, 3.6) + C(8.5, 14.5, 3.6) + C(15.5, 14.5, 3.6) + C(12, 12, 4)],
      ['f2', E(7.6, 17, 2.2, 1.1, -20) + E(16.4, 17, 2.2, 1.1, 20) + E(12, 17.5, 3, 4.2, 0)],
      ['w', C(11, 16.6, 0.7) + C(13, 16.6, 0.7)]] },
    { id: 'chicken', cat: 'agri', name: '鶏', c: '#b8763e', c2: '#c94b3b', shapes: [
      ['f', 'M5 11C2.5 8.5 2.5 5.5 3.5 4C6 6 7.5 8 8.5 10Z'],
      ['f', E(11.5, 14, 7, 5.2, -8)],
      ['f', C(17.5, 8.5, 3)],
      ['f2', C(16.2, 5.2, 1.2) + C(18, 4.8, 1.2) + C(19.6, 5.6, 1) + 'M20.2 8L23 9.2L20.2 10.2Z' + E(19.6, 11.4, 0.9, 1.4, 0)],
      ['s', 'M10 18.5V22M13.5 18.5V22', 1.4],
      ['ws', 'M8 14C10 16 13 16 15 13.5', 1],
      ['w', C(18, 8, 0.7)]] },
    { id: 'pig', cat: 'agri', name: '豚', c: '#d99a9a', c2: '#bd6f7a', shapes: [
      ['f2', 'M4.5 5.5L10 6.5L7 11.5Z'], ['f2', 'M19.5 5.5L14 6.5L17 11.5Z'],
      ['f', E(12, 13, 7.5, 6.8, 0)],
      ['f2', E(12, 15.2, 3.8, 2.9, 0)],
      ['w', C(10.6, 15.2, 0.7) + C(13.4, 15.2, 0.7)],
      ['k', C(9, 11.3, 0.9) + C(15, 11.3, 0.9)]] },
    { id: 'goat', cat: 'agri', name: 'ヤギ', c: '#a89f91', c2: '#5a4f45', shapes: [
      ['f2', 'M8 7C5.8 4.5 6.8 2.3 9 1.6C8.5 3.6 9.5 5 10.6 6.2Z M16 7C18.2 4.5 17.2 2.3 15 1.6C15.5 3.6 14.5 5 13.4 6.2Z'],
      ['f', E(5.4, 10, 3.2, 1.3, -18) + E(18.6, 10, 3.2, 1.3, 18)],
      ['f', 'M8 6.8C10 5.6 14 5.6 16 6.8C17 10.5 15.5 15 14 17.5H10C8.5 15 7 10.5 8 6.8Z'],
      ['f2', 'M10.5 17H13.5L12 22.5Z'],
      ['w', E(12, 15, 1.9, 1.2, 0)],
      ['k', C(9.9, 10.8, 0.8) + C(14.1, 10.8, 0.8)]] },
    { id: 'camel', cat: 'agri', name: 'ラクダ', c: '#c49a5a', shapes: [
      ['f', 'M3 14.5C3 11.5 5 10 7 10.5C7.5 7 10 6.5 10.8 10C11.5 7 14 6.8 15 10.5C16 8 16.5 6 18 4.5C19 3.5 21.5 3.5 22 5V7C22 8.2 21 8.7 20 8.7C19.4 9.8 19 11 19 13V21H17V15.5H15V21H13V15.5H8.5V21H6.5V15.5H4.8C3.5 15.5 3 15.2 3 14.5Z'],
      ['k', C(20.4, 5.6, 0.55)]] },
    { id: 'reindeer', cat: 'agri', name: 'トナカイ', c: '#6e5a48', c2: '#b59a6a', shapes: [
      ['f2', 'M9 8C7 6 6 4 6 1.5L7.2 1.5C7.4 3.5 8.3 5 10 6.5Z M7 5L3.5 4.6L3.8 3.4L7.3 3.8Z M7.5 3L5 1L5.8 0.4L8 2.2Z M15 8C17 6 18 4 18 1.5L16.8 1.5C16.6 3.5 15.7 5 14 6.5Z M17 5L20.5 4.6L20.2 3.4L16.7 3.8Z M16.5 3L19 1L18.2 0.4L16 2.2Z'],
      ['f', E(6.8, 9.8, 2.5, 1.1, 20) + E(17.2, 9.8, 2.5, 1.1, -20)],
      ['f', 'M8.5 8C10 7 14 7 15.5 8C16 12 14.5 16 13.5 19.5Q12 21 10.5 19.5C9.5 16 8 12 8.5 8Z'],
      ['w', C(10.2, 11.6, 0.8) + C(13.8, 11.6, 0.8)],
      ['k', C(12, 19, 1.1)]] },

    // ---------- 工業 ----------
    { id: 'plane', cat: 'ind', name: '航空機', c: '#3b5b7a', shapes: [
      ['f', 'M12 2C13 2 13.5 3 13.5 5V9L22 14V16L13.5 13.5V18L16 20V22L12 21L8 22V20L10.5 18V13.5L2 16V14L10.5 9V5C10.5 3 11 2 12 2Z']] },
    { id: 'car', cat: 'ind', name: '自動車', c: '#4a5560', c2: '#222222', shapes: [
      ['f', 'M2.5 16V13C2.5 11.8 3.3 11 4.5 10.6L7.5 9.6L10 6.6C10.3 6.2 10.8 6 11.3 6H15.7C16.4 6 17 6.3 17.4 6.8L19.3 9.6C21 10 22 11.2 22 12.8V16Z'],
      ['w', 'M10.6 7.6L8.9 9.6H12.2V7.6Z M13.4 7.6V9.6H17.4L16 7.6Z'],
      ['f2', C(7, 16.6, 2.6) + C(17.5, 16.6, 2.6)],
      ['w', C(7, 16.6, 1) + C(17.5, 16.6, 1)]] },
    { id: 'rocket', cat: 'ind', name: '宇宙産業', c: '#4b4a8a', c2: '#c0583f', shapes: [
      ['f2', 'M8 13L4 18V20L8 17Z M16 13L20 18V20L16 17Z M10 17L12 22L14 17Z'],
      ['f', 'M12 2C15 5 16 9 16 13V16H8V13C8 9 9 5 12 2Z'],
      ['w', C(12, 9, 1.8)]] },
    { id: 'ict', cat: 'ind', name: 'ICT産業', c: '#2f6f7a', shapes: [
      ['s', 'M3 9H6M3 12H6M3 15H6M18 9H21M18 12H21M18 15H21M9 3V6M12 3V6M15 3V6M9 18V21M12 18V21M15 18V21', 1.6],
      ['f', 'M7 6H17Q18 6 18 7V17Q18 18 17 18H7Q6 18 6 17V7Q6 6 7 6Z'],
      ['w', 'M9.5 9.5H14.5V14.5H9.5Z']] },
    { id: 'cotton-ind', cat: 'ind', name: '綿工業', c: '#7a8fa3', c2: '#4d5b6a', shapes: [
      ['f2', 'M5 3H19V5.2H5Z M5 18.8H19V21H5Z'],
      ['f', 'M7.5 5H16.5V19H7.5Z'],
      ['ws', 'M7.5 8.6L16.5 7M7.5 12L16.5 10.4M7.5 15.4L16.5 13.8', 1]] },
    { id: 'wool-ind', cat: 'ind', name: '羊毛工業', c: '#8a6a45', shapes: [
      ['s', 'M18 18C20 20 22 19.5 22.5 18', 1.3],
      ['f', C(11.5, 12, 8)],
      ['ws', 'M4.8 9C9.5 12 14.5 12 18.6 9M4.2 13C9.5 16 15 16 18.8 13M8 4.6C10 9 10 15 8 19.4', 1]] },
    { id: 'silk-ind', cat: 'ind', name: '絹工業', c: '#b0527a', c2: '#6a3a55', shapes: [
      ['s', 'M12 4C13 2 16 1.5 18.5 3', 1.2],
      ['f', E(12, 13, 6, 8.5, 0)],
      ['ws', 'M7 9.5C10 11.5 14 11.5 17 9.5M6.2 13.5C10 15.5 14 15.5 17.8 13.5M7.6 17.4C10 19 14 19 16.4 17.4', 1]] },
    { id: 'petro', cat: 'ind', name: '石油化学', c: '#7a3b3b', shapes: [
      ['f', 'M9.5 2.5H14.5V4.2H13.5V9.2L19.7 18.6C20.6 20 19.6 21.8 18 21.8H6C4.4 21.8 3.4 20 4.3 18.6L10.5 9.2V4.2H9.5Z'],
      ['ws', 'M6.4 16H17.6', 1.1],
      ['w', C(11, 18.8, 0.9) + C(13.6, 17.6, 0.7)]] },
    { id: 'steel', cat: 'ind', name: '鉄鋼', c: '#5a6068', shapes: [
      ['f', 'M4 4H20V8H14V16H20V20H4V16H10V8H4Z']] },
    { id: 'ship', cat: 'ind', name: '造船', c: '#2f5a7a', c2: '#c0583f', shapes: [
      ['f2', 'M14.5 4.5H16.8V8H14.5Z M4.5 9.5H11V13.5H4.5Z'],
      ['f', 'M12.5 7.5H19V14H12.5Z'],
      ['f', 'M2 14.5H22L19.5 20H5Z'],
      ['ws', 'M6.5 11.5H9M14.5 10H17', 1.2]] },
    { id: 'machine', cat: 'ind', name: '機械', c: '#566471', shapes: [
      ['f', gearPath],
      ['w', C(12, 12, 2.8)]] },
    { id: 'food-ind', cat: 'ind', name: '食品工業', c: '#d98a3a', c2: '#aeb4b9', shapes: [
      ['f2', 'M5 5.5Q5 4 7 4H17Q19 4 19 5.5V7.5H5Z'],
      ['f', 'M5 7.5H19V19.5Q19 21 17 21H7Q5 21 5 19.5Z'],
      ['w', 'M5 10.8H19V16.8H5Z'],
      ['f2', E(12, 13.8, 1.3, 2, 0) + 'M12 11.5C13.2 10.2 14.5 10.2 15.5 11C14.6 12.2 13.4 12.4 12 11.5Z']] },
    { id: 'paper', cat: 'ind', name: '製紙・パルプ', c: '#8a7a5a', c2: '#54442f', shapes: [
      ['f', 'M5.5 2H15L19.5 6.5V22H5.5Z'],
      ['f2', 'M15 2V6.5H19.5Z'],
      ['ws', 'M8.5 11H16.5M8.5 14.5H16.5M8.5 18H13.5', 1.1]] },
    { id: 'semicon', cat: 'ind', name: '半導体', c: '#4a5a8a', c2: '#a9b5dc', shapes: [
      ['f', C(12, 12, 9.8)],
      ['f2', 'M8 8H12V12H8Z M12 12H16V16H12Z M16 8H19.4V12H16Z'],
      ['ws', 'M8 3.4V20.6M12 2.2V21.8M16 3.4V20.6M4.6 8H19.4M3 12H21M4.6 16H19.4', 0.8]] },
    { id: 'chemfiber', cat: 'ind', name: '化学繊維', c: '#2a8a8a', shapes: [
      ['f', 'M12 2.5L20.2 7.2V16.8L12 21.5L3.8 16.8V7.2Z'],
      ['w', 'M12 6.6L16.6 9.3V14.7L12 17.4L7.4 14.7V9.3Z'],
      ['f', 'M12 10L14 11.2V13.4L12 14.6L10 13.4V11.2Z']] },

    // ---------- 鉱産資源 ----------
    { id: 'oil', cat: 'min', name: '油田', c: '#1a1a1a', shapes: [
      ['f', 'M12 2C12 2 5 10 5 15A7 7 0 0 0 19 15C19 10 12 2 12 2Z'],
      ['ws', 'M9 15C9 17 10 18 12 18.5', 1.3]] },
    { id: 'coal', cat: 'min', name: '炭田', c: '#4a3f3a', shapes: [
      ['f', 'M4.5 9.5L9 4L16 5L20 10L18.5 18L11 20L4.5 16Z'],
      ['ws', 'M9 4L12 11L20 10M12 11L11 20M4.5 9.5L12 11', 1]] },
    { id: 'gas', cat: 'min', name: 'ガス田', c: '#2a7f9e', shapes: [
      ['f', 'M12 2C13 7 18 9 18 15A6 6 0 0 1 6 15C6 12 8 10 9 8C10 10 11 10 11.5 9C12 7 12 5 12 2Z'],
      ['w', 'M12 12C13.5 14 15 15 15 17A3 3 0 0 1 9 17C9 15 11 14 12 12Z']] },
    { id: 'gold', cat: 'min', name: '金', c: '#c8a02a', shapes: [
      ['f', 'M2.5 20L4.5 15H11L12.5 20Z M11.5 20L13 15H19.5L21.5 20Z M7 14L8.7 9H15.3L17 14Z'],
      ['ws', 'M5.5 17.5H10M14.5 17.5H18.5M10 11.5H14', 1]] },
    { id: 'copper', cat: 'min', name: '銅', c: '#b8683a', shapes: [
      ['f', C(12, 12, 9.5)],
      ['ws', C(12, 12, 6.4), 1],
      ['w', C(12, 12, 2.6)]] },
    { id: 'iron', cat: 'min', name: '鉄', c: '#9a4a35', c2: '#6c7580', shapes: [
      ['f2', 'M11 20L13.5 12.5L19 11L21.5 20Z'],
      ['f', 'M2.5 20L5.5 11.5L11 9L15.5 12.5L14 20Z'],
      ['ws', 'M5.5 11.5L9 15L8 20M11 9L9 15M13.5 12.5L17 15.5', 1]] },
    { id: 'aluminum', cat: 'min', name: 'アルミ', c: '#8d9fb0', c2: '#5a6a79', shapes: [
      ['f2', 'M8 3H16L17 5.6H7Z'],
      ['f', 'M7 5H17V20Q17 21.8 15.2 21.8H8.8Q7 21.8 7 20Z'],
      ['w', 'M8.6 9.6H15.4V15.4H8.6Z'],
      ['ws', 'M9.6 6.6V19', 1]] },
    { id: 'rare', cat: 'min', name: 'レアメタル', c: '#6a5fb0', shapes: [
      ['f', 'M7 4H17L21.5 10L12 21L2.5 10Z'],
      ['ws', 'M2.5 10H21.5M7 4L9.5 10L12 21L14.5 10L17 4M9.5 10L12 4L14.5 10', 1]] },
    { id: 'uranium', cat: 'min', name: 'ウラン', c: '#d4b422', shapes: [
      ['f', C(12, 12, 10.5)],
      ['k', trefoil + C(12, 12, 1.8)]] },
    { id: 'bauxite', cat: 'min', name: 'ボーキサイト', c: '#a8452c', c2: '#7a2f20', shapes: [
      ['f', C(8.2, 15, 4.8) + C(16.2, 15.6, 4.3) + C(12, 8.6, 4.8)],
      ['f2', C(6.8, 14, 0.9) + C(10, 16.4, 0.7) + C(15.4, 14.6, 0.8) + C(17.6, 17, 0.6) + C(11, 7.6, 0.8) + C(13.2, 9.8, 0.6)]] },
    { id: 'silver', cat: 'min', name: '銀', c: '#9aa4ad', shapes: [
      ['f', C(12, 12, 10.3)],
      ['ws', C(12, 12, 8), 0.9],
      ['w', starPath]] },
    { id: 'tin', cat: 'min', name: 'スズ', c: '#7f8f8a', c2: '#aebdb7', shapes: [
      ['f', 'M3 18L5.8 10H18.2L21 18Z'],
      ['f2', 'M5.8 10L8 6.5H16L18.2 10Z'],
      ['ws', 'M8.5 14H15.5', 1.2]] },
    { id: 'nickel', cat: 'min', name: 'ニッケル', c: '#4f8f87', c2: '#8fc7bf', shapes: [
      ['f2', 'M12 3L20 7.5L12 12L4 7.5Z'],
      ['f', 'M4 7.5L12 12V21L4 16.5Z M20 7.5V16.5L12 21V12Z'],
      ['ws', 'M4 7.5L12 12L20 7.5M12 12V21', 1]] },
    { id: 'zinc', cat: 'min', name: '亜鉛', c: '#7d98ae', c2: '#566f85', shapes: [
      ['s', 'M7 5.5C8 1 16 1 17 5.5', 1.4],
      ['f2', 'M3.8 5H20.2V7.8H3.8Z'],
      ['f', 'M5 7.8H19L17.6 21H6.4Z'],
      ['ws', 'M5.5 12.2H18.5M5.9 16.6H18.1', 1]] },
    { id: 'lead', cat: 'min', name: '鉛', c: '#62687a', shapes: [
      ['s', 'M9.4 9C9.4 3.5 14.6 3.5 14.6 9', 1.8],
      ['f', 'M7 9H17L20.5 21H3.5Z'],
      ['w', C(12, 14.2, 1.6)]] },
    { id: 'diamond', cat: 'min', name: 'ダイヤモンド', c: '#4fb0d8', shapes: [
      ['f', octD(octPts(9.8))],
      ['ws', diamondFacets, 0.9]] },

    // ---------- 林業・水産業 ----------
    { id: 'timber', cat: 'forest', name: '木材', c: '#9c6a3e', c2: '#dcb47e', shapes: [
      ['f', C(7.5, 16.5, 4.6) + C(16.5, 16.5, 4.6) + C(12, 8.8, 4.6)],
      ['f2', C(7.5, 16.5, 3.4) + C(16.5, 16.5, 3.4) + C(12, 8.8, 3.4)],
      ['ws', C(7.5, 16.5, 1.5) + C(16.5, 16.5, 1.5) + C(12, 8.8, 1.5), 0.8]] },
    { id: 'fishing', cat: 'forest', name: '漁業', c: '#3a7aa8', shapes: [
      ['f', E(10.5, 12, 7.5, 4.6, 0) + 'M16.5 12L23 7V17Z'],
      ['ws', 'M10 8.4C11.5 10 11.5 14 10 15.6', 1],
      ['w', C(6.8, 11, 1.1)],
      ['k', C(6.8, 11, 0.5)]] },
    { id: 'aqua', cat: 'forest', name: '養殖', c: '#e0733a', c2: '#5a8fb5', shapes: [
      ['f2', 'M3 4.5H21V6.8H3Z'],
      ['f2', 'M4.6 6.8H19.4L17.4 21H6.6Z'],
      ['ws', 'M8.6 7V21M12 7V21M15.4 7V21M4.9 11.2H19.1M5.6 16H18.4', 0.7],
      ['f', E(11.6, 13.2, 3.9, 2.3, 0) + 'M15.2 13.2L18.2 10.8V15.6Z'],
      ['w', C(9.6, 12.6, 0.6)]] },

    // ---------- エネルギー ----------
    { id: 'hydro', cat: 'energy', name: '水力', c: '#2f7fb0', shapes: [
      ['f', 'M3 5H21V8H19.5L18 21H6L4.5 8H3Z'],
      ['ws', 'M7.2 12.4C9 11.2 10.2 13.4 12 12.2C13.8 11 15 13.2 16.8 12M7.6 16.8C9.4 15.6 10.6 17.8 12.4 16.6C13.8 15.8 15 16.6 16.4 16.4', 1.2]] },
    { id: 'wind', cat: 'energy', name: '風力', c: '#3f8f8f', c2: '#6a7a85', shapes: [
      ['f2', 'M11.2 11H12.8L13.5 22H10.5Z'],
      ['f', E(12, 5.2, 4.8, 1.1, 90) + E(7.84, 12.4, 4.8, 1.1, 150) + E(16.16, 12.4, 4.8, 1.1, 30)],
      ['f2', C(12, 10, 1.4)]] },
    { id: 'solar', cat: 'energy', name: '太陽光', c: '#2f4f8a', c2: '#e8a820', shapes: [
      ['f2', C(6.8, 6.4, 3.4)],
      ['f', 'M5.5 21L9 11H22.5L19 21Z'],
      ['ws', 'M6.8 16H20.7M12.2 11L9 21M17.4 11L14.2 21', 0.8]] },
    { id: 'geo', cat: 'energy', name: '地熱', c: '#8a4a3a', c2: '#e0702a', shapes: [
      ['s', 'M9.8 8.6C7.8 6.6 11.6 4.8 9.6 2.4M14.2 8.6C12.2 6.6 16 4.8 14 2.4', 1.3],
      ['f', 'M2.5 21L8.5 10.5H15.5L21.5 21Z'],
      ['f2', 'M8.5 10.5H15.5L14.6 12.4L13 11.4L12 13.6L11 11.4L9.4 12.4Z']] },
    { id: 'nuclear', cat: 'energy', name: '原子力', c: '#2f7f8f', shapes: [
      ['s', E(12, 12, 9.5, 3.8, 0) + E(12, 12, 9.5, 3.8, 60) + E(12, 12, 9.5, 3.8, 120), 1.2],
      ['f', C(12, 12, 2.3)]] }
  ];
  // 投げ縄で敷き詰められるスタンプのカテゴリ
  const LASSO_CATS = new Set(['agri', 'forest']);
  const stampLasso = st => LASSO_CATS.has(st.cat);
  const STAMP_BY = {};
  STAMPS.forEach(s => { STAMP_BY[s.id] = s; });
  const CATS = [
    { id: 'agri', name: '農牧業' },
    { id: 'ind',  name: '工業' },
    { id: 'min',  name: '鉱産資源' },
    { id: 'forest', name: '林業・水産' },
    { id: 'energy', name: 'エネルギー' }
  ];

  const spriteCache = {};
  const spriteURLs = {};
  function sprite(st) {
    if (spriteCache[st.id]) return spriteCache[st.id];
    const S = 256;
    const cv = document.createElement('canvas');
    cv.width = cv.height = S;
    const x = cv.getContext('2d');
    x.scale(S / 24, S / 24);
    x.lineJoin = 'round';
    x.lineCap = 'round';
    const list = st.shapes.map(sh => ({ t: sh[0], p: new Path2D(sh[1]), w: sh[2] || 1.2 }));
    list.forEach(({ t, p, w }) => {                      // 白い縁取り
      if (t === 'w' || t === 'ws') return;
      x.strokeStyle = '#fff'; x.fillStyle = '#fff';
      if (t === 's') { x.lineWidth = w + 2.6; x.stroke(p); }
      else { x.lineWidth = 2.6; x.fill(p); x.stroke(p); }
    });
    list.forEach(({ t, p, w }) => {
      if (t === 'f') { x.fillStyle = st.c; x.fill(p); }
      else if (t === 'f2') { x.fillStyle = st.c2 || st.c; x.fill(p); }
      else if (t === 'k') { x.fillStyle = '#222'; x.fill(p); }
      else if (t === 'w') { x.fillStyle = '#fff'; x.fill(p); }
      else if (t === 's') { x.strokeStyle = st.c; x.lineWidth = w; x.stroke(p); }
      else if (t === 'ws') { x.strokeStyle = '#fff'; x.lineWidth = w; x.stroke(p); }
    });
    spriteCache[st.id] = cv;
    return cv;
  }
  const spriteURL = st => spriteURLs[st.id] || (spriteURLs[st.id] = sprite(st).toDataURL());

  /* =========================================================
   * 状態
   * ======================================================= */
  const state = {
    edit: false,
    rankings: {},
    // 世界統計（唯一の統計データソース）
    // items: { [id]: { id, name, field } }
    // data:  { [id]: { production|export|import: { unit, year, source, ranks: [{ countryKey, value, rank }] } } }
    stats: { items: {}, data: {} },
    quizReview: [],          // 要復習の問題キー一覧 ["statId|metric", ...]
    tool: 'draw',            // draw | pin | country
    sub: 'pen',              // pen | eraser | country-fill | lasso | text | stamp
    eraser: 'normal',        // normal | stroke | fill | pin | stamp
    side: 'above',
    landOnly: false,
    viewTarget: 'pin',
    color: '#1a1a1a',
    fillColor: FILL_DEFAULT,
    pattern: 'diag',         // null = 模様なし（塗りつぶしだけ）
    sizeT: { pen: 66, text: 68, stamp: 70 },
    stamp: 'rice',
    stampCat: 'agri',
    stampPicked: false,      // スタンプを選ぶまでは未選択（置けない）
    stampMode: 'tap',        // tap | lasso
    lassoKey: null,
    lassoScope: 'country',   // country | all
    fillSide: 'below',       // 塗りの位置（国境の上/下）
    stampSide: 'above',
    stampSize: 'M',
    overPin: true,           // 工業・鉱産スタンプをピンの上に重ねる
    solid: false,
    solidColor: FILL_DEFAULT,
    selectedNoteId: null,
    pins: [],
    layers: [],              // layers[0] が最上位
    folders: [],             // [{id,name,open,visible}]
    order: [],               // top-level [{t:'layer'|'folder', id}]
    selectedFolderId: null,
    countries: {},
    guides: { equator: true, tropics: true, pins: true },
    activeLayerId: null,
    selectedPinId: null,
    selectedCountryKey: null,
    textSel: null,           // { layer, t }
    panel: null,
    transform: { x: 0, y: 0, k: 1 },
    k0: 1,
    undo: [],
    redo: [],
    showRivers: true,
    showClimate: false
  };

  const $ = id => document.getElementById(id);
  const container = $('map-container');
  const svgBase = d3.select('#svg-base');
  const svgLines = d3.select('#svg-lines');
  const svgGuides = d3.select('#svg-guides');
  const svgPins = d3.select('#svg-pins');
  const cBelow = $('canvas-below'), cAbove = $('canvas-above'), cTop = $('canvas-top');
  const xBelow = cBelow.getContext('2d');
  const xAbove = cAbove.getContext('2d');
  const xTop = cTop.getContext('2d');
  const offA = document.createElement('canvas'), offB = document.createElement('canvas');
  const offA2 = offA.getContext('2d'), offB2 = offB.getContext('2d');
  const tctx = document.createElement('canvas').getContext('2d');
  // 確定済み線の画面キャッシュ（描き足し中はこれ＋現在の線だけ描く → iPadの重さ対策）
  const scBelow = document.createElement('canvas'), scAbove = document.createElement('canvas'), scTop = document.createElement('canvas');
  const strokeCache = { valid: false, tf: '', bx: null, ax: null, tx: null };
  function strokeCacheKey() {
    const t = state.transform;
    return t.x.toFixed(2) + '|' + t.y.toFixed(2) + '|' + t.k.toFixed(5) + '|' + sw + '|' + sh + '|' + dpr;
  }
  function invalidateStrokeCache() { strokeCache.valid = false; }
  function ensureStrokeCacheSize() {
    [scBelow, scAbove, scTop].forEach(c => {
      if (c.width !== cBelow.width || c.height !== cBelow.height) {
        c.width = cBelow.width; c.height = cBelow.height;
      }
    });
    if (!strokeCache.bx) {
      strokeCache.bx = scBelow.getContext('2d');
      strokeCache.ax = scAbove.getContext('2d');
      strokeCache.tx = scTop.getContext('2d');
    }
  }
  function saveStrokeCache() {
    ensureStrokeCacheSize();
    strokeCache.bx.setTransform(1, 0, 0, 1, 0, 0);
    strokeCache.ax.setTransform(1, 0, 0, 1, 0, 0);
    strokeCache.tx.setTransform(1, 0, 0, 1, 0, 0);
    strokeCache.bx.clearRect(0, 0, scBelow.width, scBelow.height);
    strokeCache.ax.clearRect(0, 0, scAbove.width, scAbove.height);
    strokeCache.tx.clearRect(0, 0, scTop.width, scTop.height);
    strokeCache.bx.drawImage(cBelow, 0, 0);
    strokeCache.ax.drawImage(cAbove, 0, 0);
    strokeCache.tx.drawImage(cTop, 0, 0);
    strokeCache.tf = strokeCacheKey();
    strokeCache.valid = true;
  }
  function blitStrokeCache() {
    [xBelow, xAbove, xTop].forEach((c, i) => {
      const src = [scBelow, scAbove, scTop][i];
      c.setTransform(1, 0, 0, 1, 0, 0);
      c.clearRect(0, 0, cBelow.width, cBelow.height);
      c.drawImage(src, 0, 0);
    });
  }

  const projection = d3.geoMercator().scale(W / (2 * Math.PI)).translate([W / 2, W / 2]);
  const pathGen = d3.geoPath(projection);

  let sw = 0, sh = 0, dpr = 1;
  let feats = [];
  const byKey = new Map();
  let riverFeats = [];
  let dataReady = false;
  let lakeFeats = [];
  let updateReady = null;
  let cur = null;          // 描画中のストローク
  let lasso = null;        // 投げ縄中 {m:[], s:[]}
  let lastPs = 0;
  let clipCache = null;
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
  const stampDef = () => STAMP_BY[state.stamp] || STAMPS[0];
  const sizeKey = () => (state.sub === 'text' ? 'text' : 'pen');
  const stampSizeVal = () => STAMP_SIZES[state.stampSize] || STAMP_SIZES.M;
  const sizeVal = key => { const r = SIZE[key]; return r.min * Math.pow(r.max / r.min, state.sizeT[key] / 100); };
  const lassoActive = () => state.sub === 'lasso' || (state.sub === 'stamp' && stampLasso(stampDef()) && state.stampMode === 'lasso');
  const needTarget = () => lassoActive() && state.lassoScope === 'country';

  function showToast(msg) {
    const t = $('toast');
    t.textContent = msg;
    t.classList.remove('hidden');
    clearTimeout(showToast._t);
    showToast._t = setTimeout(() => t.classList.add('hidden'), 2400);
  }

  const sync = { on: false, user: null, db: null, auth: null, ref: null, rev: 0, lastN: 0, timer: null, busy: false, pulling: false, ver: 0, status: 'signedout', extra: '' };
  let saveTimer = null;
  function saveSoon() { clearTimeout(saveTimer); saveTimer = setTimeout(save, 300); }

  /* =========================================================
   * 保存／読み込み
   * ======================================================= */
  function blankLayer(name) {
    return { id: 'L' + uid(), name, visible: true, strokes: [], fills: [], stamps: [], texts: [], notes: [], folderId: null };
  }
  function blankFolder(name) {
    return { id: 'FD' + uid(), name: name || 'フォルダ', open: true, visible: true };
  }
  function ensureOrder() {
    if (!Array.isArray(state.folders)) state.folders = [];
    if (!Array.isArray(state.order)) state.order = [];
    const fids = new Set(state.folders.map(f => f.id));
    const lids = new Set(state.layers.map(l => l.id));
    // 無効な参照を除去
    state.order = state.order.filter(o =>
      (o.t === 'folder' && fids.has(o.id)) ||
      (o.t === 'layer' && lids.has(o.id) && !state.layers.find(l => l.id === o.id)?.folderId)
    );
    const inOrder = new Set(state.order.map(o => o.t + ':' + o.id));
    state.folders.forEach(f => {
      if (!inOrder.has('folder:' + f.id)) state.order.push({ t: 'folder', id: f.id });
    });
    state.layers.forEach(l => {
      if (!l.folderId && !inOrder.has('layer:' + l.id)) state.order.push({ t: 'layer', id: l.id });
    });
  }
  const folderColor = v => (/^#[0-9a-fA-F]{6}$/.test(v) ? v : null);      // null＝指定なし（レイヤーと同じ見た目）
  const FOLDER_COLORS = ['#111111', '#d64545', '#e0861e', '#d4ad00', '#3a9a5b', '#2f7fb0', '#7a5bc0'];
  function folderById(id) { return (state.folders || []).find(f => f.id === id); }
  function layersInFolder(fid) { return state.layers.filter(l => l.folderId === fid); }
  function layerEffectivelyVisible(layer) {
    if (!layer || !layer.visible) return false;
    if (layer.folderId) {
      const f = folderById(layer.folderId);
      if (f && f.visible === false) return false;
    }
    return true;
  }


  /* クラウドに保存していない変更の有無（フォルダの開閉は内容の変更に数えない） */
  let saved = null;       // 直近に保存した内容
  const STATS_KEY = 'world-notes-stats-v1';
  const QUIZ_REVIEW_KEY = 'world-notes-quiz-review-v1';
  const signature = () => JSON.stringify([state.pins, state.layers, state.folders.map(({ open, ...f }) => f), state.order,
    state.countries, state.guides, state.showRivers, state.showClimate, state.rankings, state.stats, state.quizReview]);

  function save() {
    clearTimeout(saveTimer);
    try {
      localStorage.setItem(KEY, JSON.stringify({
        v: 5, pins: state.pins, layers: state.layers, folders: state.folders, order: state.order, countries: state.countries, guides: state.guides, showRivers: state.showRivers, showClimate: state.showClimate
      }));
      localStorage.setItem(RANK_KEY, JSON.stringify(state.rankings));
      localStorage.setItem(STATS_KEY, JSON.stringify(state.stats));
      localStorage.setItem(QUIZ_REVIEW_KEY, JSON.stringify(state.quizReview || []));
      const now = signature();
      if (now !== saved) { saved = now; markDirty(); }
    } catch {
      showToast('保存に失敗しました（容量不足の可能性）');
    }
  }

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
          above: true, pts
        };
      }).filter(Boolean)
    })).reverse();
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
    applyData(d);
    // 世界ランキングはノートと別の保存キー
    try { state.rankings = cleanRankings(JSON.parse(localStorage.getItem(RANK_KEY))); } catch { state.rankings = {}; }
    // 世界統計
    try {
      const s = JSON.parse(localStorage.getItem(STATS_KEY));
      state.stats = (s && typeof s === 'object') ? { v: s.v || 0, items: s.items || {}, data: s.data || {} } : { v: 0, items: {}, data: {} };
    } catch { state.stats = { v: 0, items: {}, data: {} }; }
    try {
      const r = JSON.parse(localStorage.getItem(QUIZ_REVIEW_KEY));
      state.quizReview = Array.isArray(r) ? r.filter(x => typeof x === 'string') : [];
    } catch { state.quizReview = []; }
    // 初期データが空、または旧シード（数値ほぼ未入力）なら再シード
    if (!Object.keys(state.stats.items).length || (state.stats.v || 0) < 2) seedInitialStats();
    saved = migrated ? null : signature();
    if (migrated) save();
  }

  function applyData(d) {
    state.pins = (Array.isArray(d.pins) ? d.pins : [])
      .filter(p => p && isFinite(p.lon) && isFinite(p.lat) && ((p.title || '').trim() || (p.memo || '').trim()))
      .map(p => ({
        id: p.id || 'P' + uid(), lon: p.lon, lat: p.lat,
        title: p.title || '', memo: p.memo || '',
        kind: p.kind === 'capital' ? 'capital' : 'normal'
      }));
    const kInit = Math.max(window.innerWidth, 320) / W;
    state.layers = (Array.isArray(d.layers) && d.layers.length ? d.layers : [blankLayer('メモ')]).map(l => ({
      id: l.id || 'L' + uid(),
      name: l.name || '無題',
      visible: l.visible !== false,
      folderId: l.folderId || null,
      strokes: (Array.isArray(l.strokes) ? l.strokes : []).filter(s => s && Array.isArray(s.pts) && s.pts.length > 1)
        .map(s => {
          const w = s.width > 0 ? s.width : (s.px > 0 ? s.px / kInit : 1);   // 旧版(画面px固定)からの換算
          const o = { ...s, width: w, above: s.above !== false, land: !!s.land };
          delete o.px;
          return o;
        }),
      fills: (Array.isArray(l.fills) ? l.fills : []).filter(f => f && (f.kind === 'country' || (f.kind === 'lasso' && Array.isArray(f.pts))))
        .map(f => {
          const keys = Array.isArray(f.keys) && f.keys.length ? f.keys : (f.country ? [f.country] : []);
          return {
            ...f, id: f.id || 'F' + uid(), keys, country: f.country || keys[0],
            pattern: PATTERNS.some(p => p.id === f.pattern) ? f.pattern : null,
            color: f.color || FILL_DEFAULT, solid: !!f.solid, solidColor: f.solidColor || FILL_DEFAULT, above: !!f.above
          };
        }).filter(f => f.keys.length && (f.solid || f.pattern)),
      stamps: (Array.isArray(l.stamps) ? l.stamps : []).filter(s => s && STAMP_BY[s.type] && isFinite(s.lon) && isFinite(s.lat) && s.size > 0),
      texts: (Array.isArray(l.texts) ? l.texts : []).filter(t => t && typeof t.text === 'string' && t.text.trim() && isFinite(t.lon) && isFinite(t.lat)),
      notes: (Array.isArray(l.notes) ? l.notes : []).filter(n => n && typeof n.text === 'string' && n.text.trim() && isFinite(n.lon) && isFinite(n.lat))
        .map(n => ({ id: n.id || 'N' + uid(), lon: n.lon, lat: n.lat, text: n.text }))
    }));
    state.countries = cleanCountries(d.countries);
    // ランキングの情報がない古い保存内容なら、今のランキングを残す
    if (d.rankings !== undefined) state.rankings = cleanRankings(d.rankings);
    if (d.guides && typeof d.guides === 'object') {
      state.guides = { equator: d.guides.equator !== false, tropics: d.guides.tropics !== false, pins: d.guides.pins !== false };
    }
    state.activeLayerId = state.layers.some(l => l.id === state.activeLayerId) ? state.activeLayerId : state.layers[0].id;
    if (typeof d.showRivers === 'boolean') state.showRivers = d.showRivers;
    if (typeof d.showClimate === 'boolean') state.showClimate = d.showClimate;
    state.folders = (Array.isArray(d.folders) ? d.folders : []).map(f => ({
      id: f.id || 'FD' + uid(), name: f.name || 'フォルダ', open: f.open !== false, visible: f.visible !== false,
      color: folderColor(f.color)
    }));
    state.order = Array.isArray(d.order) ? d.order.filter(o => o && o.id && (o.t === 'layer' || o.t === 'folder')) : [];
    // 孤立した folderId を掃除
    const fids = new Set(state.folders.map(f => f.id));
    state.layers.forEach(l => { if (l.folderId && !fids.has(l.folderId)) l.folderId = null; });
    ensureOrder();
  }

  /* =========================================================
   * サイズ／変換
   * ======================================================= */
  function size() {
    const r = container.getBoundingClientRect();
    sw = r.width; sh = r.height;
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    invalidateStrokeCache();
    [cBelow, cAbove, cTop, offA, offB].forEach(c => {
      c.width = Math.round(sw * dpr);
      c.height = Math.round(sh * dpr);
    });
    [xBelow, xAbove, xTop, offA2, offB2].forEach(c => { c.imageSmoothingEnabled = true; c.imageSmoothingQuality = 'medium'; });
    d3.selectAll('#svg-base, #svg-lines, #svg-guides, #svg-pins').attr('width', sw).attr('height', sh);
  }

  function dockSpace() { return parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--dock-h')) || 90; }

  function fitView() {
    const yN = projection([0, 78])[1], yS = projection([0, -56])[1];
    const k = Math.min(sw / W, (sh - 80) / (yS - yN));
    state.k0 = k;
    state.transform = { k, x: (sw - W * k) / 2, y: (sh - dockSpace()) / 2 - k * (yN + yS) / 2 + 10 };
  }

  function clampTf() {
    const t = state.transform;
    t.k = clamp(t.k, state.k0 * 0.8, Math.max(state.k0 * 60, 12));
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

  // 模様の密度は2倍刻みで切り替え（刻みの間は地図に貼り付いて動かない）
  function patScale() { return Math.pow(2, Math.round(Math.log2(1 / state.transform.k))); }
  function applyPatScale(force) {
    const ps = patScale();
    if (!force && ps === lastPs) return;
    lastPs = ps;
    svgBase.selectAll('pattern').attr('patternTransform', `scale(${ps})`);
    svgLines.selectAll('pattern').attr('patternTransform', `scale(${ps})`);
  }

  function applyTf() {
    clampTf();
    clipCache = null;
    invalidateStrokeCache();
    const { x, y, k } = state.transform;
    const t = `translate(${x},${y}) scale(${k})`;
    svgBase.select('.world').attr('transform', t);
    svgLines.select('.world').attr('transform', t);
    svgGuides.select('.world').attr('transform', t);
    applyPatScale(false);
    positionPins();
    positionNotes();
    positionEditor();
    redraw();
    if (state.edit && state.tool === 'draw') updateSizePreview();
  }

  /* =========================================================
   * 地図データ
   * ======================================================= */
  const isTW = p => /^taiwan$/i.test(String(p.ADMIN || p.NAME || p.NAME_EN || '')) || p.ADM0_A3 === 'TWN' || p.ISO_A3 === 'TWN';
  const isCN = p => p.ADM0_A3 === 'CHN' || /^china$/i.test(String(p.ADMIN || p.NAME || ''));
  function keyOf(p) { return isTW(p) ? 'TWN' : String(p.ADM0_A3 || p.ISO_A3 || p.ADMIN || p.NAME || ''); }
  function nameOf(p) { return isTW(p) ? '台湾' : (p.NAME_JA || p.NAME_EN || p.NAME || p.ADMIN || '(不明)'); }

  // 台湾は中華人民共和国と別の地域として扱う（データが一体になっている場合は島を切り出す）
  function splitTaiwan(list) {
    const inBox = ring => ring.every(([x, y]) => x >= 118.9 && x <= 122.4 && y >= 21.7 && y <= 25.6);
    const hasTW = list.some(f => isTW(f.properties || {}));
    const out = [];
    list.forEach(f => {
      const p = f.properties || {};
      if (!hasTW && isCN(p) && f.geometry && f.geometry.type === 'MultiPolygon') {
        const tw = [], rest = [];
        f.geometry.coordinates.forEach(poly => (inBox(poly[0]) ? tw : rest).push(poly));
        if (tw.length && rest.length) {
          out.push({ ...f, geometry: { type: 'MultiPolygon', coordinates: rest } });
          out.push({
            type: 'Feature',
            properties: { ...p, ADMIN: 'Taiwan', NAME: 'Taiwan', NAME_EN: 'Taiwan', NAME_JA: '台湾', ADM0_A3: 'TWN', ISO_A3: 'TWN', ISO_A2: 'TW' },
            geometry: { type: 'MultiPolygon', coordinates: tw }
          });
          return;
        }
      }
      out.push(f);
    });
    return out;
  }


  /* ---------- ケッペン気候区分（固定レイヤー） ---------- */
  // 参照図に近い配色（教科書的な簡略色）
  // 参照図の凡例13色に揃える（細分コードは親区分色へ）
  const CLIMATE_SIMPLE = {
    Af: '#e53935', Am: '#ef9a9a', Aw: '#f5c6c6',
    BW: '#c4a574', BS: '#f0d84a',
    Cs: '#f5a623', Cw: '#7ec8c8', Cfa: '#a8e6a1', Cfb: '#4caf50',
    Df: '#c5a3d9', Dw: '#7b5ea7',
    ET: '#7dd3e8', EF: '#3d8fd1'
  };
  function climateColor(code) {
    const c = String(code || '');
    if (CLIMATE_SIMPLE[c]) return CLIMATE_SIMPLE[c];
    if (c.startsWith('Af')) return CLIMATE_SIMPLE.Af;
    if (c.startsWith('Am')) return CLIMATE_SIMPLE.Am;
    if (c.startsWith('As') || c.startsWith('Aw')) return CLIMATE_SIMPLE.Aw;
    if (c.startsWith('BW') || c === 'BWh' || c === 'BWk') return CLIMATE_SIMPLE.BW;
    if (c.startsWith('BS') || c === 'BSh' || c === 'BSk') return CLIMATE_SIMPLE.BS;
    if (c.startsWith('Cs')) return CLIMATE_SIMPLE.Cs;
    if (c.startsWith('Cw')) return CLIMATE_SIMPLE.Cw;
    if (c === 'Cfa') return CLIMATE_SIMPLE.Cfa;
    if (c.startsWith('Cf')) return CLIMATE_SIMPLE.Cfb;
    if (c.startsWith('Df') || c.startsWith('Ds')) return CLIMATE_SIMPLE.Df; // Ds→亜寒帯系はDf色
    if (c.startsWith('Dw')) return CLIMATE_SIMPLE.Dw;
    if (c === 'ET') return CLIMATE_SIMPLE.ET;
    if (c === 'EF') return CLIMATE_SIMPLE.EF;
    return '#cccccc';
  }
  const CLIMATE_COLORS = CLIMATE_SIMPLE; // 後方互換
  // レイヤー説明用（参照図と同じ区分）
  const CLIMATE_LEGEND = [
    { g: '熱帯', items: [['Af','#e53935'],['Am','#ef9a9a'],['Aw','#f5c6c6']] },
    { g: '乾燥帯', items: [['BW','#c4a574'],['BS','#f0d84a']] },
    { g: '温帯', items: [['Cs','#f5a623'],['Cw','#7ec8c8'],['Cfa','#a8e6a1'],['Cfb','#4caf50']] },
    { g: '亜寒帯', items: [['Df','#c5a3d9'],['Dw','#7b5ea7']] },
    { g: '寒帯', items: [['ET','#7dd3e8'],['EF','#3d8fd1']] }
  ];
  let climateFeats = [];

  function prepareData(countries, rivers, lakes, climate) {
    feats = splitTaiwan(countries.features || []).map(f => {
      const p = f.properties || {};
      f._key = keyOf(p);
      f._name = nameOf(p);
      f._d = pathGen(f) || '';
      f._b = pathGen.bounds(f);
      const p2 = new Path2D();
      d3.geoPath(projection, p2)(f);
      f._p = p2;
      return f;
    }).filter(f => f._d && f._key);
    byKey.clear();
    feats.forEach(f => byKey.set(f._key, f));
    riverFeats = (rivers.features || []).map(f => { f._d = pathGen(f) || ''; return f; }).filter(f => f._d);
    lakeFeats = ((lakes && lakes.features) || []).map(f => { f._d = pathGen(f) || ''; return f; }).filter(f => f._d);
    climateFeats = [];
    if (climate && climate.features) {
      climateFeats = climate.features.map(f => {
        const code = (f.properties && (f.properties.CODE || f.properties.code || f.properties.GRIDCODE)) || '';
        const d = pathGen(f) || '';
        if (!d || !code) return null;
        return { code: String(code), _d: d, color: climateColor(code) };
      }).filter(Boolean);
    }
  }

  function buildMap() {
    svgBase.selectAll('*').remove();
    const defs = svgBase.append('defs');
    defs.append('g').attr('id', 'pats');
    defs.append('g').attr('id', 'clips');
    const bw = svgBase.append('g').attr('class', 'world');
    bw.append('g').attr('class', 'land')
      .selectAll('path').data(feats).join('path')
      .attr('class', 'country').attr('d', d => d._d);
    // 気候区分（固定レイヤー・地図投影は共通のまま）
    bw.append('g').attr('class', 'climate' + (state.showClimate ? '' : ' off'))
      .selectAll('path').data(climateFeats).join('path')
      .attr('class', 'climate-zone')
      .attr('d', d => d._d)
      .attr('fill', d => d.color)
      .attr('stroke', 'none');
    bw.append('g').attr('class', 'lakes')
      .selectAll('path').data(lakeFeats).join('path')
      .attr('class', 'lake').attr('d', d => d._d);

    svgLines.selectAll('*').remove();
    const ldefs = svgLines.append('defs');
    ldefs.append('g').attr('id', 'pats');
    ldefs.append('g').attr('id', 'clips');
    ldefs.append('g').attr('id', 'pats-a');
    ldefs.append('g').attr('id', 'clips-a');
    const mk = ldefs.append('mask').attr('id', 'nolake').attr('maskUnits', 'userSpaceOnUse')
      .attr('x', -50).attr('y', -50).attr('width', W + 100).attr('height', W + 100);
    mk.append('rect').attr('x', -50).attr('y', -50).attr('width', W + 100).attr('height', W + 100).attr('fill', '#fff');
    mk.append('g').attr('fill', '#000').selectAll('path').data(lakeFeats).join('path').attr('d', d => d._d);
    const lw = svgLines.append('g').attr('class', 'world');
    // 川 → 国境下の塗り → 国境 → 国境上の塗り（塗りが川の下にならない）
    lw.append('g').attr('class', 'rivers' + (state.showRivers ? '' : ' off'))
      .selectAll('path').data(riverFeats).join('path')
      .attr('class', 'river').attr('d', d => d._d);
    lw.append('g').attr('class', 'fills');
    lw.append('g').attr('class', 'borders')
      .selectAll('path').data(feats).join('path')
      .attr('class', 'border').attr('d', d => d._d);
    lw.append('g').attr('class', 'fills-above').attr('mask', 'url(#nolake)');
    lw.append('path').attr('class', 'hl hidden');
    const sg = projection([0, -76]);
    lw.append('text').attr('class', 'signature').attr('x', sg[0]).attr('y', sg[1]).text('developed by unconditionalLOVE');

    // ガイド線（赤道・回帰線）：固定レイヤー
    svgGuides.selectAll('*').remove();
    const gw = svgGuides.append('g').attr('class', 'world');
    const yy = lat => projection([0, lat])[1];
    const eq = gw.append('g').attr('class', 'grp-eq');
    eq.append('line').attr('class', 'g-eq').attr('x1', 0).attr('x2', W).attr('y1', yy(0)).attr('y2', yy(0));
    eq.append('text').attr('class', 'g-lbl').attr('x', 6).attr('y', yy(0) - 1.6).text('赤道');
    const tr = gw.append('g').attr('class', 'grp-tr');
    [[TROPIC, '北回帰線'], [-TROPIC, '南回帰線']].forEach(([lat, name]) => {
      tr.append('line').attr('class', 'g-tr').attr('x1', 0).attr('x2', W).attr('y1', yy(lat)).attr('y2', yy(lat));
      tr.append('text').attr('class', 'g-lbl g-tr-lbl').attr('x', 6).attr('y', yy(lat) - 1.6).text(name);
    });
    applyGuides();

    svgPins.selectAll('*').remove();
    svgPins.append('g').attr('class', 'notes');
    svgPins.append('g').attr('class', 'pins');
  }

  function updateClimateLegend() {
    const el = $('climate-legend');
    if (el) el.classList.toggle('hidden', !state.showClimate);
  }

  function applyGuides() {
    svgGuides.select('.grp-eq').classed('guide-off', !state.guides.equator);
    svgGuides.select('.grp-tr').classed('guide-off', !state.guides.tropics);
    svgPins.select('g.pins').classed('guide-off', !state.guides.pins);
  }

  /* ---------- 塗り（国境でクリップ） ---------- */
  const polyD = m => 'M' + m.map(p => p[0].toFixed(2) + ',' + p[1].toFixed(2)).join('L') + 'Z';
  const clipId = key => 'clip-' + key.replace(/[^A-Za-z0-9_-]/g, '_');
  const patId = (pid, color) => `pat-${pid}-${String(color).replace('#', '')}`;

  const fillCtx = () => ({
    below: { g: svgLines.select('.fills'), pats: svgLines.select('#pats'), clips: svgLines.select('#clips'), pre: 'b' },
    above: { g: svgLines.select('.fills-above'), pats: svgLines.select('#pats-a'), clips: svgLines.select('#clips-a'), pre: 'a' }
  });

  function renderFills() {
    if (!dataReady) return;
    const C2 = fillCtx();
    [C2.below, C2.above].forEach(c => {
      c.g.selectAll('*').remove(); c.pats.selectAll('*').remove(); c.clips.selectAll('*').remove();
      c.usedPat = new Map(); c.clipIds = new Map();
    });
    const clipFor = (c, keys) => {
      const k = keys.slice().sort().join('|');
      let id = c.clipIds.get(k);
      if (!id) {
        id = `clip-${c.pre}${c.clipIds.size}`;
        c.clipIds.set(k, id);
        const cp = c.clips.append('clipPath').attr('id', id);
        keys.forEach(key => { const ft = byKey.get(key); if (ft) cp.append('path').attr('d', ft._d); });
      }
      return id;
    };

    for (let i = state.layers.length - 1; i >= 0; i--) {
      const layer = state.layers[i];
      if (!layerEffectivelyVisible(layer)) continue;
      layer.fills.forEach(f => {
        if (!f.keys.some(k => byKey.has(k))) return;
        const c = f.above ? C2.above : C2.below;
        const add = paint => {
          if (f.kind === 'country') {
            const ft = byKey.get(f.keys[0]);
            if (ft) c.g.append('path').attr('d', ft._d).attr('fill', paint);
          } else {
            const m = mpts(f);
            if (m.length < 3) return;
            c.g.append('path').attr('d', polyD(m)).attr('fill', paint).attr('clip-path', `url(#${clipFor(c, f.keys)})`);
          }
        };
        if (f.solid) add(f.solidColor || FILL_DEFAULT);
        if (f.pattern) {
          const id = c.pre + patId(f.pattern, f.color || FILL_DEFAULT);
          c.usedPat.set(id, { pid: f.pattern, color: f.color || FILL_DEFAULT });
          add(`url(#${id})`);
        }
      });
    }
    [C2.below, C2.above].forEach(c => {
      c.usedPat.forEach(({ pid, color }, id) => {
        const p = PATTERNS.find(x => x.id === pid);
        if (!p) return;
        c.pats.append('pattern').attr('id', id).attr('patternUnits', 'userSpaceOnUse')
          .attr('width', p.w).attr('height', p.h).style('color', color).html(p.body);
      });
    });
    applyPatScale(true);
  }

  // メモのある国は枠を少し太くする（塗らないので川が隠れない）
  function renderMemoMarks() {
    svgLines.selectAll('.border').classed('has-memo', d => hasCountryNote(state.countries[d._key]));
  }

  function renderHighlight() {
    const hl = svgLines.select('.hl');
    if (hl.empty()) return;
    const key = state.selectedCountryKey || (state.edit && state.tool === 'draw' && needTarget() ? state.lassoKey : null);
    const f = key && byKey.get(key);
    if (f) hl.attr('d', f._d).classed('hidden', false);
    else hl.classed('hidden', true);
  }

  /* ---------- ピン ---------- */
  const pinShape = kind => (kind === 'capital'
    ? '<circle class="halo" r="6.8"/><circle class="cap" r="4"/>'
    : '<circle class="halo" r="6.8"/><circle class="dot" r="4"/>');

  function renderPins() {
    const root = svgPins.select('g.pins');
    if (root.empty()) return;
    const sel = root.selectAll('g.pin').data(state.pins, d => d.id);
    sel.exit().remove();
    const all = sel.enter().append('g').merge(sel);
    all.attr('class', d => `pin kind-${d.kind || 'normal'}`);
    all.each(function (d) {
      const g = d3.select(this);
      const sig = (d.kind || 'normal') + '|' + (d.title || '') + '|' + (d.id === state.selectedPinId ? '1' : '0');
      if (this._sig === sig) return; // 内容が同じならDOMを作り直さない
      this._sig = sig;
      g.html(pinShape(d.kind));
      if (d.id === state.selectedPinId) g.append('circle').attr('class', 'sel').attr('r', 11);
      if (d.title) g.append('text').attr('class', 'lbl').attr('x', 11).attr('y', 4).text(d.title);
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
    if (!state.guides.pins) return null;
    const { x, y, k } = state.transform;
    let best = null, bd = PIN_HIT;
    state.pins.forEach(p => {
      const m = projection([p.lon, p.lat]);
      const d = Math.hypot(x + m[0] * k - sx, y + m[1] * k - sy);
      if (d < bd) { bd = d; best = p; }
    });
    return best;
  }

  /* ---------- メモ（落書きレイヤーに属する小さなメモボタン） ---------- */
  const NOTE_HIT = 15;
  function visibleNotes() { return state.layers.filter(l => layerEffectivelyVisible(l)).flatMap(l => l.notes.map(n => ({ layer: l, n }))); }
  function renderNotes() {
    const root = svgPins.select('g.notes');
    if (root.empty()) return;
    const sel = root.selectAll('g.note').data(visibleNotes(), d => d.n.id);
    sel.exit().remove();
    const en = sel.enter().append('g').attr('class', 'note')
      .html('<rect class="nb" x="-9" y="-9" width="18" height="18" rx="5"/><path class="nl" d="M-4.5 -3H4.5M-4.5 0.5H4.5M-4.5 4H0.5"/>');
    en.merge(sel).classed('sel', d => d.n.id === state.selectedNoteId);
    positionNotes();
  }
  function positionNotes() {
    const root = svgPins.select('g.notes');
    if (root.empty()) return;
    const { x, y, k } = state.transform;
    root.selectAll('g.note').attr('transform', d => {
      const m = projection([d.n.lon, d.n.lat]);
      return `translate(${(x + m[0] * k).toFixed(1)},${(y + m[1] * k).toFixed(1)})`;
    });
  }
  function noteAt(sx, sy) {
    const { x, y, k } = state.transform;
    let best = null, bd = NOTE_HIT;
    visibleNotes().forEach(o => {
      const m = projection([o.n.lon, o.n.lat]);
      const d = Math.hypot(x + m[0] * k - sx, y + m[1] * k - sy);
      if (d < bd) { bd = d; best = o; }
    });
    return best;
  }
  function curNote() {
    if (!state.selectedNoteId) return null;
    for (const l of state.layers) {
      const n = l.notes.find(x => x.id === state.selectedNoteId);
      if (n) return { layer: l, n };
    }
    return null;
  }

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
   * キャンバス描画：落書き・スタンプ・文字
   * ======================================================= */
  const activeLayer = () => state.layers.find(l => l.id === state.activeLayerId);

  function mpts(o) {
    if (o.m) return o.m;
    let m = mcache.get(o);
    if (!m) { m = o.pts.map(p => projection(p)); mcache.set(o, m); }
    return m;
  }
  function smap(s) {
    let m = mcache.get(s);
    if (!m) { m = projection([s.lon, s.lat]); mcache.set(s, m); }
    return m;
  }

  function setTf(c) {
    const { x, y, k } = state.transform;
    c.setTransform(dpr * k, 0, 0, dpr * k, dpr * x, dpr * y);
  }

  function viewportMap() {
    const { x, y, k } = state.transform;
    return { x0: -x / k, y0: -y / k, x1: (sw - x) / k, y1: (sh - y) / k };
  }

  // 「国上のみ」用：画面に入っている国だけを結合したクリップ（海には描けない）
  function landClip() {
    if (clipCache) return clipCache;
    const v = viewportMap();
    const p = new Path2D();
    feats.forEach(f => {
      const b = f._b;
      if (b[1][0] < v.x0 || b[0][0] > v.x1 || b[1][1] < v.y0 || b[0][1] > v.y1) return;
      p.addPath(f._p);
    });
    clipCache = p;
    return p;
  }

  function strokeBBox(m, pad) {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (let i = 0; i < m.length; i++) {
      const p = m[i];
      if (p[0] < x0) x0 = p[0];
      if (p[1] < y0) y0 = p[1];
      if (p[0] > x1) x1 = p[0];
      if (p[1] > y1) y1 = p[1];
    }
    return [x0 - pad, y0 - pad, x1 + pad, y1 + pad];
  }
  function drawStroke(c, s) {
    const m = mpts(s);
    if (m.length < 2) return;
    // 画面外の線は描かない（見た目は同じ）
    const pad = (s.width || 1) * 0.5 + 2;
    let bb = s._bb;
    if (!bb) { bb = strokeBBox(m, pad); s._bb = bb; }
    const v = viewportMap();
    if (bb[2] < v.x0 || bb[0] > v.x1 || bb[3] < v.y0 || bb[1] > v.y1) return;
    c.lineWidth = s.width;                     // 地図基準の太さ（拡大すると線も一緒に太くなり、隙間が空かない）
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

  function paintList(c, arr) {
    let clipped = false;
    arr.forEach(s => {
      const want = s.type === 'pen' && s.land;
      if (want !== clipped) {
        if (want) { c.save(); c.clip(landClip()); } else c.restore();
        clipped = want;
      }
      drawStroke(c, s);
    });
    if (clipped) c.restore();
  }

  function drawLayerStrokes(layer) {
    const list = (cur && layer.id === state.activeLayerId) ? layer.strokes.concat([cur]) : layer.strokes;
    if (!list.length) return;
    if (!list.some(s => s.type === 'eraser')) {
      paintList(xAbove, list.filter(s => s.above));
      paintList(xBelow, list.filter(s => !s.above));
      return;
    }
    [[true, xAbove, offA, offA2], [false, xBelow, offB, offB2]].forEach(([above, target, off, offc]) => {
      const sideList = list.filter(s => s.type === 'eraser' || !!s.above === above);
      if (!sideList.some(s => s.type === 'pen')) return;
      offc.setTransform(1, 0, 0, 1, 0, 0);
      offc.clearRect(0, 0, off.width, off.height);
      setTf(offc);
      paintList(offc, sideList);
      target.save();
      target.setTransform(1, 0, 0, 1, 0, 0);
      target.drawImage(off, 0, 0);
      target.restore();
    });
  }

  const isTopStamp = s => (s.top !== undefined ? !!s.top : STAMP_BY[s.type].cat === 'ind');

  function drawStamps(layer) {
    if (!layer.stamps.length) return;
    const v = viewportMap(), k = state.transform.k;
    layer.stamps.forEach(s => {
      const st = STAMP_BY[s.type];
      if (!st || s.size * k < 2) return;
      const m = smap(s), h = s.size / 2;
      if (m[0] + h < v.x0 || m[0] - h > v.x1 || m[1] + h < v.y0 || m[1] - h > v.y1) return;
      const top = isTopStamp(s);
      const c = top ? xTop : (s.above === false ? xBelow : xAbove);
      if (top) c.globalAlpha = 0.62;           // ピンの上に重ねるスタンプは半透明
      c.drawImage(sprite(st), m[0] - h, m[1] - h, s.size, s.size);
      c.globalAlpha = 1;
    });
  }

  function textLines(t) { return String(t.text).split('\n'); }
  function measureText(t) {
    tctx.font = FONT;
    const w = Math.max(...textLines(t).map(l => tctx.measureText(l).width)) * t.size / 100;
    return { w, h: textLines(t).length * t.size * 1.25 };
  }

  function drawTexts(c, layer) {
    layer.texts.forEach(t => {
      if (state.textSel && state.textSel.t === t) return;     // 編集中は編集欄が表示する
      const m = projection([t.lon, t.lat]);
      c.save();
      c.translate(m[0], m[1]);
      c.scale(t.size / 100, t.size / 100);
      c.font = FONT;
      c.textBaseline = 'top';
      c.lineJoin = 'round';
      textLines(t).forEach((ln, i) => {
        c.lineWidth = 14;
        c.strokeStyle = 'rgba(255,255,255,0.85)';
        c.strokeText(ln, 0, i * 125);
        c.fillStyle = t.color || '#1a1a1a';
        c.fillText(ln, 0, i * 125);
      });
      c.restore();
    });
  }

  function drawLassoOverlay() {
    if (!lasso || lasso.s.length <= 1) return;
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

  function drawCurStrokeOnly() {
    if (!cur) return;
    const target = cur.above ? xAbove : xBelow;
    setTf(xBelow); setTf(xAbove); setTf(xTop);
    // drawStroke は mpts 経由。一時オブジェクトに m を載せる
    const s = cur;
    const m = s.m;
    if (!m || m.length < 2) {
      if (m && m.length === 1) {
        target.save();
        if (s.land) target.clip(landClip());
        target.fillStyle = s.type === 'eraser' ? '#000' : (s.color || '#1a1a1a');
        if (s.type === 'eraser') target.globalCompositeOperation = 'destination-out';
        target.beginPath();
        target.arc(m[0][0], m[0][1], (s.width || 1) * 0.5, 0, Math.PI * 2);
        target.fill();
        target.restore();
      }
      return;
    }
    // mcache を使わず直接描画
    target.save();
    if (s.type === 'pen' && s.land) target.clip(landClip());
    target.lineWidth = s.width;
    target.lineCap = 'round';
    target.lineJoin = 'round';
    if (s.type === 'eraser') { target.globalCompositeOperation = 'destination-out'; target.strokeStyle = '#000'; }
    else { target.globalCompositeOperation = 'source-over'; target.strokeStyle = s.color || '#1a1a1a'; }
    target.beginPath();
    target.moveTo(m[0][0], m[0][1]);
    for (let i = 1; i < m.length; i++) target.lineTo(m[i][0], m[i][1]);
    target.stroke();
    target.restore();
  }

  function redrawFull() {
    [xBelow, xAbove, xTop].forEach(c => {
      c.setTransform(1, 0, 0, 1, 0, 0);
      c.clearRect(0, 0, cBelow.width, cBelow.height);
      setTf(c);
    });
    for (let i = state.layers.length - 1; i >= 0; i--) {
      const layer = state.layers[i];
      if (!layerEffectivelyVisible(layer)) continue;
      drawLayerStrokes(layer);
      drawStamps(layer);
      drawTexts(xAbove, layer);
    }
    drawLassoOverlay();
  }

  function redraw() {
    // ペン描き中：キャッシュがあれば確定分はコピー、現在の線だけ追加描画
    if (cur && cur.type === 'pen' && strokeCache.valid && strokeCache.tf === strokeCacheKey()) {
      blitStrokeCache();
      drawCurStrokeOnly();
      drawLassoOverlay();
      return;
    }
    // 消しゴム描き中は合成が必要なのでフル再描画
    if (cur && cur.type === 'eraser') {
      redrawFull();
      return;
    }
    // フル再描画（cur なし、またはキャッシュ無効）
    const hadCur = cur;
    if (hadCur && hadCur.type === 'pen') {
      // 一度 cur なしで描いてキャッシュし、その上に現在線
      const saved = cur;
      cur = null;
      redrawFull();
      saveStrokeCache();
      cur = saved;
      blitStrokeCache();
      drawCurStrokeOnly();
      drawLassoOverlay();
      return;
    }
    redrawFull();
    if (!cur) saveStrokeCache();
  }

  /* =========================================================
   * Undo / Redo
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
    addFill: (l, f) => ({
      redo() { l.fills.push(f); },
      undo() { l.fills = l.fills.filter(x => x !== f); }
    }),
    removeFills: (l, arr) => {
      let idxs = [];
      return {
        redo() { idxs = arr.map(f => l.fills.indexOf(f)); l.fills = l.fills.filter(x => !arr.includes(x)); },
        undo() { arr.forEach((f, i) => l.fills.splice(clamp(idxs[i], 0, l.fills.length), 0, f)); }
      };
    },
    addStamps: (l, arr) => ({
      redo() { l.stamps.push(...arr); },
      undo() { l.stamps = l.stamps.filter(s => !arr.includes(s)); }
    }),
    removeStamps: (l, arr) => ({
      redo() { l.stamps = l.stamps.filter(s => !arr.includes(s)); },
      undo() { l.stamps.push(...arr); }
    }),
    removePins: arr => {
      let idx = [];
      return {
        redo() {
          idx = arr.map(p => state.pins.indexOf(p));
          state.pins = state.pins.filter(p => !arr.includes(p));
          if (arr.some(p => p.id === state.selectedPinId)) state.selectedPinId = null;
        },
        undo() { arr.forEach((p, i) => state.pins.splice(clamp(idx[i], 0, state.pins.length), 0, p)); }
      };
    },
    clear: l => {
      let a, b, c, d, e;
      return {
        redo() { a = l.strokes; b = l.fills; c = l.stamps; d = l.texts; e = l.notes; l.strokes = []; l.fills = []; l.stamps = []; l.texts = []; l.notes = []; },
        undo() { l.strokes = a; l.fills = b; l.stamps = c; l.texts = d; l.notes = e; }
      };
    }
  };

  let layerListTimer = 0;
  function afterChange(kind) {
    invalidateStrokeCache();
    if (kind === 'stroke') {
      // 線の追加だけなら重い処理を省略
      saveSoon();
      redraw();
      updateUndoButtons();
      if (state.panel === 'layer') {
        clearTimeout(layerListTimer);
        layerListTimer = setTimeout(() => {
          if (state.panel === 'layer') renderLayers();
        }, 500);
      }
      return;
    }
    saveSoon();
    renderFills();
    renderPins();
    renderNotes();
    redraw();
    if (state.panel === 'layer') renderLayers();
    updateUndoButtons();
  }
  function perform(a, kind) {
    a.redo();
    state.undo.push(a);
    state.redo.length = 0;
    if (state.undo.length > 300) state.undo.shift();
    afterChange(kind);
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
    const w = sizeVal('pen');
    cur = {
      type: eraser ? 'eraser' : 'pen',
      color: state.color,
      width: eraser ? Math.max(w * 3, 10 / state.transform.k) : w,
      above: state.side === 'above',
      land: !eraser && state.landOnly,
      m: [toMap(sx, sy)]
    };
    if (eraser) eraseLassoAt(sx, sy);
    redraw();
    return true;
  }

  let strokeRaf = 0;
  function moveStroke(sx, sy) {
    if (!cur) return;
    const p = toMap(sx, sy), l = cur.m[cur.m.length - 1];
    if (Math.hypot(p[0] - l[0], p[1] - l[1]) * state.transform.k < 1.8) return;
    cur.m.push(p);
    if (strokeRaf) return;
    strokeRaf = requestAnimationFrame(() => { strokeRaf = 0; if (cur) redraw(); });
  }

  // 見た目を変えず点を間引く（幅の一定割合以下の揺れは落とす）
  function simplifyMapPts(pts, width) {
    if (pts.length <= 2) return pts;
    // 少し強めに間引き（見た目はほぼ同じ・点数が減り iPad が軽くなる）
    const eps = Math.max(width * 0.18, 0.22);
    const eps2 = eps * eps;
    const keep = [pts[0]];
    let ax = pts[0][0], ay = pts[0][1];
    for (let i = 1; i < pts.length - 1; i++) {
      const dx = pts[i][0] - ax, dy = pts[i][1] - ay;
      if (dx * dx + dy * dy >= eps2) {
        keep.push(pts[i]);
        ax = pts[i][0]; ay = pts[i][1];
      }
    }
    keep.push(pts[pts.length - 1]);
    return keep;
  }
  function finishStroke() {
    const s = cur; cur = null;
    const layer = activeLayer();
    if (!s || !layer) { redraw(); return; }
    let m = s.m;
    if (m.length === 1) m = [m[0], [m[0][0] + 0.0005, m[0][1]]];
    m = simplifyMapPts(m, s.width || 1);
    const stroke = {
      type: s.type, color: s.color, width: +s.width.toFixed(4), above: s.above, land: s.land,
      pts: m.map(p => { const ll = projection.invert(p); return [round4(ll[0]), round4(ll[1])]; })
    };
    mcache.set(stroke, m);
    perform(A.addStroke(layer, stroke), 'stroke');
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
        const d = distPointToSeg(mx, my, m[i - 1][0], m[i - 1][1], m[i][0], m[i][1]) - s.width / 2;
        if (d < bd) { bd = d; best = s; }
      }
    });
    if (best && bd <= thr) perform(A.removeStroke(layer, best));
  }

  function eraseStampsAt(sx, sy) {
    const layer = drawable();
    if (!layer) return;
    const [mx, my] = toMap(sx, sy), k = state.transform.k;
    const hit = layer.stamps.filter(s => {
      const m = smap(s);
      return Math.hypot(m[0] - mx, m[1] - my) < Math.max(s.size / 2, 12 / k);
    });
    if (hit.length) perform(A.removeStamps(layer, hit));
  }

  /* ---------- 投げ縄（先に国を選ぶ → その国の中だけ） ---------- */
  function pickTarget(sx, sy) {
    const f = featureAtMap(...toMap(sx, sy));
    if (!f) { showToast('国の内側をタップして選んでください'); return; }
    state.lassoKey = f._key;
    renderHighlight();
    updateUI();
  }

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

  // 囲んだ範囲と重なる国（全国モード）／選んだ国（国モード）
  function lassoKeys(poly) {
    if (state.lassoScope === 'country') return state.lassoKey ? [state.lassoKey] : [];
    const xs = poly.map(p => p[0]), ys = poly.map(p => p[1]);
    const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
    return feats.filter(f => f._b[1][0] >= x0 && f._b[0][0] <= x1 && f._b[1][1] >= y0 && f._b[0][1] <= y1).map(f => f._key);
  }
  // 囲んだ内側に陸地が少しでもあるか（サンプル点で確認）
  function anyLand(poly) {
    const xs = poly.map(p => p[0]), ys = poly.map(p => p[1]);
    const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys), N = 16;
    for (let i = 0; i <= N; i++) for (let j = 0; j <= N; j++) {
      const x = x0 + (x1 - x0) * i / N, y = y0 + (y1 - y0) * j / N;
      if (d3.polygonContains(poly, [x, y]) && featureAtMap(x, y)) return true;
    }
    return false;
  }

  function fillSpec() {
    if (!state.solid && !state.pattern) { showToast('模様か塗りつぶしを選んでください'); return null; }
    return { pattern: state.pattern || null, color: state.fillColor, solid: state.solid, solidColor: state.solidColor, above: state.fillSide === 'above' };
  }

  function finishLasso() {
    const L = lasso; lasso = null;
    redraw();
    const layer = activeLayer();
    if (!L || !layer) return;
    const all = state.lassoScope === 'all';
    const xs = L.s.map(p => p[0]), ys = L.s.map(p => p[1]);
    if (L.m.length < 6 || Math.max(...xs) - Math.min(...xs) < 8 || Math.max(...ys) - Math.min(...ys) < 8) {
      if (all) showToast('もう少し大きく囲んでください');
      else { const last = L.s[L.s.length - 1]; pickTarget(last[0], last[1]); }   // ほぼタップ → 対象の国を選び直す
      return;
    }
    let keys;
    if (all) {
      keys = lassoKeys(L.m);
      if (!keys.length || !anyLand(L.m)) { showToast('陸地を含むように囲んでください'); return; }
    } else {
      if (!byKey.get(state.lassoKey)) { showToast('先に国をタップして選んでください'); return; }
      keys = [state.lassoKey];
    }

    if (state.sub === 'lasso') {
      const spec = fillSpec();
      if (!spec) return;
      const fill = {
        id: 'F' + uid(), kind: 'lasso', country: keys[0], keys, ...spec,
        pts: L.m.map(p => { const ll = projection.invert(p); return [round4(ll[0]), round4(ll[1])]; })
      };
      mcache.set(fill, L.m);
      perform(A.addFill(layer, fill));
    } else {
      stampFill(layer, keys, L.m);
    }
  }

  // 農牧業スタンプを等間隔・密集（ずらし配置）で敷き詰める。対象の国の陸地の内側だけ
  function stampFill(layer, keys, poly) {
    if (!state.stampPicked) { showToast('スタンプを選んでください'); return; }
    const st = stampDef(), size = stampSizeVal();
    const fs = keys.map(k => byKey.get(k)).filter(Boolean);
    if (!fs.length) return;
    const stepX = size * 1.1, stepY = stepX * 0.87;
    const xs = poly.map(p => p[0]), ys = poly.map(p => p[1]);
    const minX = Math.max(Math.min(...xs), Math.min(...fs.map(f => f._b[0][0]))), maxX = Math.min(Math.max(...xs), Math.max(...fs.map(f => f._b[1][0])));
    const minY = Math.max(Math.min(...ys), Math.min(...fs.map(f => f._b[0][1]))), maxY = Math.min(Math.max(...ys), Math.max(...fs.map(f => f._b[1][1])));
    if ((maxX - minX) * (maxY - minY) / (stepX * stepY) > 6000) {
      showToast('範囲が広すぎます。拡大して囲むか、スタンプを大きくしてください');
      return;
    }
    const arr = [];
    for (let row = 0, y = minY; y <= maxY; row++, y += stepY) {
      for (let x = minX + (row % 2 ? stepX / 2 : 0); x <= maxX; x += stepX) {
        if (!d3.polygonContains(poly, [x, y])) continue;
        const cand = fs.filter(f => x >= f._b[0][0] && x <= f._b[1][0] && y >= f._b[0][1] && y <= f._b[1][1]);
        if (!cand.length) continue;
        const ll = projection.invert([x, y]);
        if (!ll || !cand.some(f => d3.geoContains(f, ll))) continue;
        arr.push({ id: 'S' + uid() + arr.length, type: st.id, lon: round4(ll[0]), lat: round4(ll[1]), size, above: state.stampSide === 'above', top: false });
      }
    }
    if (!arr.length) { showToast('範囲が小さすぎます（スタンプが入りません）'); return; }
    perform(A.addStamps(layer, arr));
  }

  /* ---------- 国塗り・塗り消し・ピン消し ---------- */
  function fillCountryAt(sx, sy) {
    const layer = drawable();
    if (!layer) return;
    const spec = fillSpec();
    if (!spec) return;
    const f = featureAtMap(...toMap(sx, sy));
    if (!f) { showToast('国をタップしてください'); return; }
    perform(A.addFill(layer, { id: 'F' + uid(), kind: 'country', country: f._key, keys: [f._key], ...spec }));
  }

  // 触れた場所の「国の塗り」を消す（塗り消しツール用）
  function eraseFillAt(sx, sy, quiet) {
    const layer = drawable();
    if (!layer) return false;
    const [mx, my] = toMap(sx, sy);
    const ll = projection.invert([mx, my]);
    if (!ll) return false;
    const hit = layer.fills.filter(f => {
      if (f.kind === 'lasso') return false; // 投げ縄は通常消しゴムで消す
      return f.keys.some(k => {
        const ft = byKey.get(k);
        if (!ft) return false;
        const b = ft._b;
        if (mx < b[0][0] - 1 || mx > b[1][0] + 1 || my < b[0][1] - 1 || my > b[1][1] + 1) return false;
        return d3.geoContains(ft, ll);
      });
    });
    if (hit.length) { perform(A.removeFills(layer, hit)); return true; }
    if (!quiet) showToast('消せる塗りがありません');
    return false;
  }

  // 投げ縄塗りを通常消しゴムでなぞって消す
  function eraseLassoAt(sx, sy) {
    const layer = drawable();
    if (!layer) return false;
    const [mx, my] = toMap(sx, sy);
    const hit = layer.fills.filter(f => f.kind === 'lasso' && Array.isArray(f.pts) && f.pts.length >= 3 && d3.polygonContains(mpts(f), [mx, my]));
    if (hit.length) { perform(A.removeFills(layer, hit)); return true; }
    return false;
  }

  function erasePinsAt(sx, sy) {
    if (!state.guides.pins) return;
    const { x, y, k } = state.transform;
    const hit = state.pins.filter(p => {
      const m = projection([p.lon, p.lat]);
      return Math.hypot(x + m[0] * k - sx, y + m[1] * k - sy) < PIN_HIT;
    });
    if (hit.length) perform(A.removePins(hit));
  }

  function clearActiveLayer() {
    const layer = activeLayer();
    if (!layer) return;
    if (!layer.strokes.length && !layer.fills.length && !layer.stamps.length && !layer.texts.length && !layer.notes.length) { showToast('消すものがありません'); return; }
    if (!confirm(`「${layer.name}」の落書き・塗り・スタンプ・文字・メモをすべて消しますか？`)) return;
    finalizeText();
    perform(A.clear(layer));
    showToast('全消ししました（元に戻せます）');
  }

  /* =========================================================
   * スタンプ（タップ配置）
   * ======================================================= */
  function placeStamp(sx, sy) {
    const layer = drawable();
    if (!layer) return;
    if (!state.stampPicked) { showToast('スタンプを選んでください'); return; }
    const st = stampDef();
    const top = !stampLasso(st) && state.overPin;     // 工業・鉱産：ピン（都市）の上に半透明で重ねる（切替可）
    let m = toMap(sx, sy);
    if (top) {
      const pin = pinAt(sx, sy);
      if (pin) m = projection([pin.lon, pin.lat]);
    }
    const ll = projection.invert(m);
    if (!ll || Math.abs(ll[1]) > 85) return;
    const s = {
      id: 'S' + uid(), type: st.id, lon: round4(ll[0]), lat: round4(ll[1]), size: stampSizeVal(),
      above: state.stampSide === 'above', top
    };
    perform(A.addStamps(layer, [s]));
  }

  /* =========================================================
   * テキスト
   * ======================================================= */
  function textRect(t) {
    const m = projection([t.lon, t.lat]), { x, y, k } = state.transform;
    const q = measureText(t);
    const sx = x + m[0] * k, sy = y + m[1] * k;
    return { x0: sx - 8, y0: sy - 8, x1: sx + Math.max(q.w * k, 24) + 8, y1: sy + Math.max(q.h * k, 18) + 8 };
  }

  function textAt(sx, sy) {
    for (let i = 0; i < state.layers.length; i++) {
      const layer = state.layers[i];
      if (!layer.visible) continue;
      for (let j = layer.texts.length - 1; j >= 0; j--) {
        const t = layer.texts[j], r = textRect(t);
        if (sx >= r.x0 && sx <= r.x1 && sy >= r.y0 && sy <= r.y1) return { layer, t };
      }
    }
    return null;
  }

  function selectText(sel) {
    state.textSel = sel;
    $('te-input').value = sel.t.text;
    // スライダーをこの文字の大きさに合わせる（1〜100表示）
    {
      const r = SIZE.text, s = Math.max(r.min, sel.t.size || r.min);
      const t = 100 * Math.log(s / r.min) / Math.log(r.max / r.min);
      state.sizeT.text = clamp(Math.round(t), 0, 100);
      if ($('size-slider')) $('size-slider').value = state.sizeT.text;
    }
    $('text-editor').classList.remove('hidden');
    positionEditor();
    redraw();
    updateSizePreview();
    try { $('te-input').focus({ preventScroll: true }); } catch { $('te-input').focus(); }
  }

  function createText(sx, sy) {
    const layer = drawable();
    if (!layer) return;
    const ll = projection.invert(toMap(sx, sy));
    if (!ll || Math.abs(ll[1]) > 85) return;
    const t = { id: 'T' + uid(), lon: round4(ll[0]), lat: round4(ll[1]), text: '', size: sizeVal('text'), color: state.color };
    layer.texts.push(t);
    selectText({ layer, t });
  }

  // 選択解除。空のテキストは自動で削除
  function finalizeText() {
    const sel = state.textSel;
    if (!sel) return;
    state.textSel = null;
    $('text-editor').classList.add('hidden');
    if (!sel.t.text.trim()) sel.layer.texts = sel.layer.texts.filter(x => x !== sel.t);
    save();
    redraw();
  }

  function positionEditor() {
    const sel = state.textSel;
    if (!sel) return;
    const t = sel.t, m = projection([t.lon, t.lat]), { x, y, k } = state.transform;
    const px = Math.max(12, t.size * k);
    const ed = $('text-editor'), inp = $('te-input');
    ed.style.left = (x + m[0] * k - 3.5) + 'px';
    ed.style.top = (y + m[1] * k - 3.5) + 'px';
    inp.style.fontSize = px + 'px';
    inp.style.color = t.color || '#1a1a1a';
    const lines = textLines(t);
    tctx.font = `600 ${px}px -apple-system, BlinkMacSystemFont, "Hiragino Sans", "Noto Sans JP", sans-serif`;
    const w = Math.max(...lines.map(l => tctx.measureText(l || ' ').width));
    inp.style.width = Math.max(60, Math.ceil(w) + 18) + 'px';
    inp.style.height = Math.ceil(lines.length * px * 1.25 + 8) + 'px';
  }

  function bindText() {
    const inp = $('te-input');
    inp.addEventListener('input', () => {
      const sel = state.textSel; if (!sel) return;
      sel.t.text = inp.value;
      positionEditor();
      saveSoon();
    });
    inp.addEventListener('keydown', e => { if (e.key === 'Escape') { e.preventDefault(); finalizeText(); } });
    $('te-del').onclick = () => {
      const sel = state.textSel; if (!sel) return;
      sel.layer.texts = sel.layer.texts.filter(x => x !== sel.t);
      state.textSel = null;
      $('text-editor').classList.add('hidden');
      save(); redraw();
      showToast('テキストを削除しました');
    };
    // 移動ハンドル
    const mv = $('te-move');
    let drag = null;
    mv.addEventListener('pointerdown', e => {
      const sel = state.textSel; if (!sel) return;
      e.preventDefault();
      mv.setPointerCapture(e.pointerId);
      const p = pos(e), m0 = toMap(p[0], p[1]), tm = projection([sel.t.lon, sel.t.lat]);
      drag = { dx: tm[0] - m0[0], dy: tm[1] - m0[1] };
    });
    mv.addEventListener('pointermove', e => {
      const sel = state.textSel; if (!drag || !sel) return;
      const p = pos(e), m = toMap(p[0], p[1]);
      const ll = projection.invert([m[0] + drag.dx, m[1] + drag.dy]);
      if (!ll) return;
      sel.t.lon = round4(ll[0]); sel.t.lat = round4(ll[1]);
      positionEditor();
    });
    const end = () => { if (drag) { drag = null; save(); } };
    mv.addEventListener('pointerup', end);
    mv.addEventListener('pointercancel', end);
  }

  function textTap(sx, sy) {
    const hit = textAt(sx, sy);
    if (state.textSel) {
      if (hit && hit.t !== state.textSel.t) { finalizeText(); selectText(hit); }
      else if (!hit) finalizeText();
      else $('te-input').focus();
      return;
    }
    if (hit) selectText(hit); else createText(sx, sy);
  }

  /* =========================================================
   * ポインタ操作
   * ======================================================= */
  const ptrs = new Map();
  let g = null;
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

  // 指の軌跡に沿って間を埋めながら実行（速くなぞっても取りこぼさない）
  function sweep(gg, p, fn) {
    const l = gg.last || p, n = Math.max(1, Math.ceil(dist(l, p) / 6));
    for (let i = 1; i <= n; i++) fn(l[0] + (p[0] - l[0]) * i / n, l[1] + (p[1] - l[1]) * i / n);
    gg.last = p;
  }

  function startPan(sx, sy, tap) {
    g = { type: 'pan', sx, sy, ox: state.transform.x, oy: state.transform.y, moved: false, tap, t: Date.now() };
  }

  container.addEventListener('contextmenu', e => e.preventDefault());

  container.addEventListener('pointerdown', e => {
    if (!dataReady) return;
    try { container.setPointerCapture(e.pointerId); } catch { /* noop */ }
    ptrs.set(e.pointerId, pos(e));
    if (ptrs.size === 2) {
      abortGesture();
      const [a, b] = [...ptrs.values()];
      pinch = { d: Math.max(dist(a, b), 1), m: mid(a, b) };
      g = { type: 'pinch' };
      return;
    }
    if (ptrs.size > 2) return;
    e.preventDefault();
    const [sx, sy] = pos(e);

    if (e.pointerType === 'mouse' && e.button !== 0) {
      startPan(sx, sy, false);
      g.moved = true;
      container.classList.add('panning');
      return;
    }

    if (state.edit && state.tool === 'draw') {
      const sub = state.sub;
      if (sub === 'pen' || (sub === 'eraser' && state.eraser === 'normal')) {
        if (startStroke(sx, sy)) { g = { type: 'stroke' }; return; }
        g = { type: 'none' }; return;
      }
      if (sub === 'eraser' && state.eraser === 'stroke') { g = { type: 'serase' }; eraseStrokeAt(sx, sy); return; }
      if (sub === 'eraser' && state.eraser === 'stamp') { g = { type: 'sterase' }; eraseStampsAt(sx, sy); return; }
      if (sub === 'eraser' && state.eraser === 'fill') { g = { type: 'ferase', last: [sx, sy] }; eraseFillAt(sx, sy, false); return; }
      if (sub === 'eraser' && state.eraser === 'pin') { g = { type: 'perase', last: [sx, sy] }; erasePinsAt(sx, sy); return; }
      if (lassoActive() && (state.lassoScope === 'all' || state.lassoKey)) {
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
      (evs.length ? evs : [e]).forEach(ev => {
        const q = pos(ev);
        moveStroke(q[0], q[1]);
        // 通常消しゴムは投げ縄塗りもなぞって消す
        if (cur && cur.type === 'eraser') eraseLassoAt(q[0], q[1]);
      });
    } else if (g.type === 'lasso') {
      moveLasso(p[0], p[1]);
    } else if (g.type === 'serase') {
      eraseStrokeAt(p[0], p[1]);
    } else if (g.type === 'sterase') {
      eraseStampsAt(p[0], p[1]);
    } else if (g.type === 'ferase') {
      sweep(g, p, (x, y) => eraseFillAt(x, y, true));
    } else if (g.type === 'perase') {
      sweep(g, p, erasePinsAt);
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
    else if (cg.type === 'pan' && !cancelled && cg.tap && !cg.moved && Date.now() - cg.t < TAP_MS) handleTap(cg.sx, cg.sy);
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

  function handleTap(sx, sy) {
    if (!(state.edit && state.tool === 'draw')) {       // 小さなメモのボタンは常にタップで開ける
      const nh = noteAt(sx, sy);
      if (nh) { openNote(nh.layer, nh.n); return; }
    }
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
    if (state.tool === 'pin') {
      const p = pinAt(sx, sy);
      if (p) { openPin(p); return; }
      if (state.panel === 'pin') { closeMemo(); return; }
      placePin(sx, sy);
    } else if (state.tool === 'country') {
      const f = featureAtMap(...toMap(sx, sy));
      if (f) openCountry(f); else if (state.panel === 'country') closeMemo();
    } else if (state.tool === 'draw') {
      const sub = state.sub;
      if (sub === 'country-fill') fillCountryAt(sx, sy);
      else if (sub === 'lasso') { if (needTarget()) pickTarget(sx, sy); }
      else if (sub === 'text') textTap(sx, sy);
      else if (sub === 'note') noteTap(sx, sy);
      else if (sub === 'stamp') { if (lassoActive()) { if (needTarget()) pickTarget(sx, sy); } else placeStamp(sx, sy); }
    }
  }

  /* =========================================================
   * ピン
   * ======================================================= */
  function placePin(sx, sy) {
    if (!state.guides.pins) { showToast('ピンレイヤーが非表示です（レイヤーから表示できます）'); return; }
    const ll = projection.invert(toMap(sx, sy));
    if (!ll || Math.abs(ll[1]) > 85) return;
    const pin = { id: 'P' + uid(), lon: round4(ll[0]), lat: round4(ll[1]), title: '', memo: '', kind: 'normal' };
    state.pins.push(pin);
    save();
    openPin(pin);
  }

  const curPin = () => state.pins.find(p => p.id === state.selectedPinId);

  /* =========================================================
   * メモ（落書き内の小さなメモ）
   * ======================================================= */
  function createNote(sx, sy) {
    const layer = drawable();
    if (!layer) return;
    const ll = projection.invert(toMap(sx, sy));
    if (!ll || Math.abs(ll[1]) > 85) return;
    const n = { id: 'N' + uid(), lon: round4(ll[0]), lat: round4(ll[1]), text: '' };
    layer.notes.push(n);
    openNote(layer, n);
  }

  function noteTap(sx, sy) {
    const hit = noteAt(sx, sy);
    if (hit) { openNote(hit.layer, hit.n); return; }
    if (state.panel === 'note') { closeMemo(); return; }
    createNote(sx, sy);
  }

  function openNote(layer, n) {
    closeMemo(true);
    state.selectedNoteId = n.id;
    $('note-text').value = n.text;
    $('note-v-text').textContent = n.text;
    setPanel('note');
    renderNotes();
  }

  function openPin(pin) {
    closeMemo(true);
    state.selectedPinId = pin.id;
    $('pin-title').value = pin.title;
    $('pin-memo').value = pin.memo;
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
    $('country-memo').value = (state.countries[f._key] || {}).memo || '';
    cvReset();
    setPanel('country');
    $('country-body').scrollTop = 0;
    renderCanvas();
    rkOpen();
    renderHighlight();
  }

  /* =========================================================
   * パネル
   * ======================================================= */
  function setPanel(name) {
    if (state.panel === 'quiz' && name !== 'quiz' && typeof clearQuizMapMode === 'function') {
      try { clearQuizMapMode(); } catch (_) { /* noop */ }
    }
    state.panel = name;
    ['layer', 'pin', 'country', 'note', 'sync', 'stats', 'quiz'].forEach(n => {
      const el = $(n + '-panel');
      if (el) el.classList.toggle('hidden', n !== name);
    });
    $('app').classList.toggle('panel-open', !!name);
    $('app').classList.toggle('country-open', name === 'country');
    $('btn-layers').classList.toggle('active', name === 'layer');
    const bAcc = $('btn-account');
    if (bAcc) bAcc.classList.toggle('active', name === 'sync');
    if (name === 'layer') renderLayers();
    syncDock();
    if (typeof updateUI === 'function') updateUI();
  }
  function closeAllPanels() {
    setPanel(null);
  }

  // ピン・国・メモのパネルを閉じる。編集中に名称のないピン／空のメモは自動で削除
  function closeMemo(keepPanelState) {
    const nt = curNote();
    if (state.edit) {
      const p = curPin();
      if (p && !p.title.trim()) {
        state.pins = state.pins.filter(x => x !== p);
        showToast('名称のないピンを削除しました');
      }
      if (nt && !nt.n.text.trim()) {
        nt.layer.notes = nt.layer.notes.filter(x => x !== nt.n);
        showToast('空のメモを削除しました');
      }
      save();
    }
    const hadPin = state.selectedPinId;
    const hadNote = state.selectedNoteId;
    cvReset();
    rkReset();
    state.selectedPinId = null;
    state.selectedCountryKey = null;
    state.selectedNoteId = null;
    if (!keepPanelState && ['pin', 'country', 'note'].includes(state.panel)) setPanel(null);
    if (hadPin) renderPins();
    if (hadNote) renderNotes();
    renderHighlight();
  }

  function toggleLayerPanel() {
    if (state.panel === 'layer') setPanel(null);
    else { closeMemo(true); setPanel('layer'); }
  }

  /* =========================================================
   * 国メモの自由配置キャンバス（メモ＋円・棒・推移グラフ）
   * 座標は幅 CV_W の固定キャンバス基準。画面幅に合わせて全体を拡大縮小するので配置の比率は崩れない
   * ======================================================= */
  const CV_W = 360;
  const CV_GAP = 12;
  const CV_SNAP = 6;
  const CV_MIN_W = 120;
  const CV_MAX_ITEMS = 20;
  const CV_MAX_ROWS = 60;
  const CV_TYPES = { memo: 'メモ', pie: '円グラフ', bar: '棒グラフ', trend: '推移グラフ' };
  const CV_STYLES = [{ id: 'solid', name: '塗り' }, ...PATTERNS.map(p => ({ id: p.id, name: p.name }))];
  const CV_LOOKS = [
    ['#1a1a1a', 'solid'], ['#8a8a8a', 'solid'], ['#1a1a1a', 'diag'], ['#c2c2c2', 'solid'], ['#1a1a1a', 'dots'],
    ['#555555', 'solid'], ['#1a1a1a', 'hline'], ['#1a1a1a', 'grid'], ['#1a1a1a', 'vline'], ['#1a1a1a', 'cross']
  ];
  const cvs = { sel: null, editing: null, drag: null, scale: 1, snap: lsGetSafe('wn-cv-snap') !== '0', seq: 0 };
  function lsGetSafe(k) { try { return localStorage.getItem(k); } catch { return null; } }

  /* ---------- データ ---------- */
  const cvStr = (v, n = 60) => String(v == null ? '' : v).slice(0, n);
  const cvColor = (v, d) => (/^#[0-9a-fA-F]{6}$/.test(v) ? v : d);
  const cvStyle = v => (CV_STYLES.some(s => s.id === v) ? v : 'solid');
  function cvNum(v) {
    if (typeof v === 'number') return isFinite(v) ? v : null;
    const t = String(v == null ? '' : v).normalize('NFKC').replace(/[,%\s]/g, '').replace(/[−‐ー]/g, '-');
    if (!t) return null;
    const n = Number(t);
    return isFinite(n) ? n : null;
  }
  const cvBox = (b, d) => ({
    x: isFinite(b && b.x) ? clamp(b.x, 0, CV_W - CV_MIN_W) : d.x,
    y: isFinite(b && b.y) ? clamp(b.y, 0, 20000) : d.y,
    w: isFinite(b && b.w) ? clamp(b.w, CV_MIN_W, CV_W) : d.w,
    h: isFinite(b && b.h) ? clamp(b.h, 0, 1200) : d.h
  });
  function cleanBlock(b) {
    if (!b || !['pie', 'bar', 'trend'].includes(b.type)) return null;
    const o = {
      id: typeof b.id === 'string' && /^[\w-]{1,40}$/.test(b.id) ? b.id : 'B' + uid(), type: b.type, title: cvStr(b.title),
      ...cvBox(b, { x: 0, y: 0, w: CV_W, h: 180 })
    };
    o.x = Math.min(o.x, CV_W - o.w);
    if (b.type === 'trend') {
      o.unit = cvStr(b.unit, 16);
      o.zero = b.zero !== false;
      o.color = cvColor(b.color, '#1a1a1a');
      o.rows = (Array.isArray(b.rows) ? b.rows : []).slice(0, CV_MAX_ROWS).map(r => ({ x: cvStr(r && r.x, 20), y: cvNum(r && r.y) }));
    } else {
      o.items = (Array.isArray(b.items) ? b.items : []).slice(0, CV_MAX_ITEMS).map((it, i) => {
        const look = CV_LOOKS[i % CV_LOOKS.length], v = cvNum(it && it.value);
        return { name: cvStr(it && it.name, 40), value: v === null ? null : Math.max(0, v), color: cvColor(it && it.color, look[0]), style: cvStyle(it && it.style) };
      });
      const r = b.rest || {};
      o.rest = { show: r.show !== false, name: cvStr(r.name, 40), color: cvColor(r.color, '#e6e6e6'), style: cvStyle(r.style) };
    }
    return o;
  }
  function cleanCountries(src) {
    const out = {};
    if (!src || typeof src !== 'object') return out;
    Object.keys(src).forEach(k => {
      const e = src[k];
      if (!e || typeof e !== 'object' || k === '__proto__') return;
      const o = { memo: typeof e.memo === 'string' ? e.memo : '' };
      const blocks = (Array.isArray(e.blocks) ? e.blocks : []).map(cleanBlock).filter(Boolean);
      if (blocks.length) o.blocks = blocks;
      if (e.memoBox && typeof e.memoBox === 'object') {
        o.memoBox = { ...cvBox(e.memoBox, { x: 0, y: 0, w: CV_W, h: 0 }), z: isFinite(e.memoBox.z) ? e.memoBox.z : 0 };
        o.memoBox.x = Math.min(o.memoBox.x, CV_W - o.memoBox.w);
      }
      if (o.memo.trim() || blocks.length) out[k] = o;
    });
    return out;
  }
  function hasCountryNote(e) { return !!e && (!!(e.memo || '').trim() || !!(e.blocks && e.blocks.length)); }

  // 編集中の国のデータ。create=true なら（空でも）作る
  function cvEntry(create) {
    const key = state.selectedCountryKey;
    if (!key) return null;
    let e = state.countries[key];
    if (!e && create) e = state.countries[key] = { memo: '' };
    return e || null;
  }
  const cvMemoBox = e => (e && e.memoBox) || { x: 0, y: 0, w: CV_W, h: 0, z: 0 };
  function cvEnsureMemoBox(e) { if (!e.memoBox) e.memoBox = { ...cvMemoBox(e) }; return e.memoBox; }
  const cvFind = id => { const e = cvEntry(); return e && (e.blocks || []).find(b => b.id === id); };
  // 重なり順（下→上）。メモは memoBox.z の位置に入る
  function cvOrder(e) {
    const ids = ((e && e.blocks) || []).map(b => b.id);
    ids.splice(clamp(cvMemoBox(e).z || 0, 0, ids.length), 0, 'memo');
    return ids;
  }
  function cvCommit() { renderMemoMarks(); saveSoon(); }
  // パネルを閉じる時：中身がなくなった国のデータは消す
  function cvPrune() {
    const key = state.selectedCountryKey, e = key && state.countries[key];
    if (e && !hasCountryNote(e)) { delete state.countries[key]; renderMemoMarks(); saveSoon(); }
  }
  function cvReset() {
    cvEndDrag();
    cvPrune();
    cvs.sel = null; cvs.editing = null;
    $('cv-editor').classList.add('hidden');
    $('cv-editor').innerHTML = '';
    $('cv-main').classList.remove('hidden');
  }

  /* ---------- グラフ描画（SVG文字列） ---------- */
  const measureCtx = document.createElement('canvas').getContext('2d');
  const CV_FONT = '-apple-system, BlinkMacSystemFont, "Hiragino Sans", "Noto Sans JP", sans-serif';
  function textW(t, size, weight) { measureCtx.font = `${weight || 400} ${size}px ${CV_FONT}`; return measureCtx.measureText(t).width; }
  function fitText(t, max, size, weight) {
    if (textW(t, size, weight) <= max) return t;
    const a = Array.from(t);
    while (a.length && textW(a.join('') + '…', size, weight) > max) a.pop();
    return a.join('') + '…';
  }
  const svgText = (x, y, t, cls, anchor) => `<text x="${fx(x)}" y="${fx(y)}" class="${cls}"${anchor ? ` text-anchor="${anchor}"` : ''}>${esc(t)}</text>`;
  const fmtNum = v => (Math.round(v * 100) / 100).toLocaleString('ja-JP');

  // 塗り方 → fill 属性（模様は <pattern> を defs に足す）
  function cvFill(look, defs, at) {
    const p = look.style !== 'solid' && PATTERNS.find(q => q.id === look.style);
    if (!p) return look.color;
    const id = 'cvp' + (++cvs.seq);
    defs.push(`<pattern id="${id}" patternUnits="userSpaceOnUse"${at ? ` x="${fx(at[0] - (p.id === 'grid' ? 0.5 : p.w / 2))}" y="${fx(at[1] - (p.id === 'grid' ? 0.5 : p.h / 2))}"` : ''} width="${p.w}" height="${p.h}" style="color:${look.color}"><rect width="${p.w}" height="${p.h}" fill="#fff"/>${p.body}</pattern>`);
    return `url(#${id})`;
  }

  // 模様どうしは白い区切りが見えないので、灰色の線で区切る
  const cvSegClass = it => (it.style === 'solid' ? 'cv-seg' : 'cv-seg pat');

  // 円・棒で共通の「項目＋残り」
  function cvParts(b) {
    const items = b.items.filter(it => it.value !== null || it.name.trim())
      .map((it, i) => ({ name: it.name.trim() || `項目${i + 1}`, value: it.value || 0, color: it.color, style: it.style }));
    const sum = items.reduce((a, it) => a + it.value, 0);
    const rest = Math.max(0, Math.round((100 - sum) * 1000) / 1000);
    if (items.length && rest > 0 && b.rest.show) items.push({ name: b.rest.name.trim() || cvRestName(b.type), value: rest, color: b.rest.color, style: b.rest.style });
    return { items, sum, total: Math.max(100, sum) };
  }
  const cvRestName = type => (type === 'pie' ? 'その他' : '残り');

  const titleH = b => (b.title.trim() ? 22 : 0);
  function cvLegend(items, x, y, w, defs) {
    return items.map((it, i) => {
      const cy = y + i * 18 + 9, val = fmtNum(it.value) + '%', vw = textW(val, 11, 600);
      return `<rect x="${fx(x + 0.5)}" y="${fx(cy - 5)}" width="10" height="10" rx="2" fill="${cvFill(it, defs, [x + 5.5, cy])}" class="cv-key"/>` +
        svgText(x + 16, cy + 4, fitText(it.name, Math.max(10, w - 16 - vw - 6), 11), 'cv-lb') +
        svgText(x + w, cy + 4, val, 'cv-val', 'end');
    }).join('');
  }
  const pieSide = w => w >= 250;
  const barCols = w => (w >= 250 ? 2 : 1);
  // 中身が欠けずに収まる最小の高さ
  function cvMinH(b) {
    const th = titleH(b);
    if (b.type === 'trend') return th + 110;
    const n = cvParts(b).items.length;
    if (!n) return th + 60;
    if (b.type === 'pie') return pieSide(b.w) ? th + Math.max(n * 18, 80) + 12 : th + 70 + n * 18 + 16;
    return th + 24 + 8 + Math.ceil(n / barCols(b.w)) * 18 + 10;
  }

  function drawPie(b, w, h, defs) {
    const { items } = cvParts(b), th = titleH(b), pad = 6;
    if (!items.length) return null;
    const side = pieSide(w), legendH = items.length * 18;
    const d = side ? Math.min(h - th - pad * 2, w * 0.46) : Math.min(w - pad * 2, h - th - legendH - pad * 2 - 4);
    const r = Math.max(10, d / 2);
    const cx = side ? pad + r : w / 2, cy = side ? th + (h - th) / 2 : th + pad + r;
    const total = Math.max(100, items.reduce((a, it) => a + it.value, 0));
    let out = `<circle cx="${fx(cx)}" cy="${fx(cy)}" r="${fx(r)}" class="cv-ring"/>`, a0 = -Math.PI / 2;
    items.forEach(it => {
      if (!(it.value > 0)) return;
      const da = it.value / total * Math.PI * 2, a1 = a0 + da, fill = cvFill(it, defs);
      if (da >= Math.PI * 2 - 1e-6) out += `<circle cx="${fx(cx)}" cy="${fx(cy)}" r="${fx(r)}" fill="${fill}" class="cv-outline"/>`;
      else out += `<path d="M${fx(cx)} ${fx(cy)}L${P2(cx, cy, r, a0)}A${fx(r)} ${fx(r)} 0 ${da > Math.PI ? 1 : 0} 1 ${P2(cx, cy, r, a1)}Z" fill="${fill}" class="${cvSegClass(it)}"/>`;
      a0 = a1;
    });
    out += `<circle cx="${fx(cx)}" cy="${fx(cy)}" r="${fx(r)}" class="cv-ring2"/>`;
    const lx = side ? cx + r + 14 : pad, ly = side ? th + (h - th - legendH) / 2 : cy + r + 10;
    return out + cvLegend(items, lx, ly, w - lx - pad, defs);
  }

  function drawBar(b, w, h, defs) {
    const { items, total } = cvParts(b), th = titleH(b), pad = 6;
    if (!items.length) return null;
    const cols = barCols(w), rows = Math.ceil(items.length / cols);
    const bh = clamp(h - th - rows * 18 - 18, 16, 64), by = th + 4, bw = w - pad * 2;
    const clipId = 'cvc' + (++cvs.seq);
    defs.push(`<clipPath id="${clipId}"><rect x="${pad}" y="${by}" width="${fx(bw)}" height="${fx(bh)}" rx="4"/></clipPath>`);
    let out = `<g clip-path="url(#${clipId})">`, x = pad;
    items.forEach(it => {
      const sw = it.value / total * bw;
      if (sw > 0) {
        out += `<rect x="${fx(x)}" y="${by}" width="${fx(sw)}" height="${fx(bh)}" fill="${cvFill(it, defs)}" class="${cvSegClass(it)}"/>`;
      }
      x += sw;
    });
    out += `</g><rect x="${pad}" y="${by}" width="${fx(bw)}" height="${fx(bh)}" rx="4" class="cv-ring2"/>`;
    const colW = (bw - (cols - 1) * 14) / cols;
    for (let c = 0; c < cols; c++) out += cvLegend(items.slice(c * rows, (c + 1) * rows), pad + c * (colW + 14), by + bh + 8, colW, defs);
    return out;
  }

  function drawTrend(b, w, h) {
    let pts = b.rows.map(r => ({ label: r.x.trim(), v: r.y })).filter(p => p.v !== null);
    if (!pts.length) return null;
    pts.forEach(p => { p.n = cvNum(p.label.replace(/年(度)?$/, '')); });
    const numeric = pts.every(p => p.n !== null);
    if (numeric) pts.sort((a, c) => a.n - c.n);
    const th = titleH(b), unit = b.unit.trim();
    const top = th + (unit ? 18 : 8) + 6, bottom = h - 18, right = w - 14;
    let lo = Math.min(...pts.map(p => p.v)), hi = Math.max(...pts.map(p => p.v));
    if (b.zero) { lo = Math.min(0, lo); hi = Math.max(0, hi); }
    if (lo === hi) { const d = Math.abs(lo) || 1; hi += d / 2; if (!b.zero) lo -= d / 2; }
    const y = d3.scaleLinear().domain([lo, hi]).range([bottom, top]).nice(4);
    const ticks = y.ticks(clamp(Math.floor((bottom - top) / 26), 2, 5));
    const compact = v => (Math.abs(v) >= 1e8 ? fmtNum(v / 1e8) + '億' : Math.abs(v) >= 1e4 ? fmtNum(v / 1e4) + '万' : fmtNum(v));
    const left = Math.max(...ticks.map(t => textW(compact(t), 10))) + 12;
    const span = numeric ? pts[pts.length - 1].n - pts[0].n : 0;
    const x0 = left + 8, x1 = right - 6;
    const X = (p, i) => {
      if (pts.length === 1) return (x0 + x1) / 2;
      return x0 + (x1 - x0) * (numeric && span ? (p.n - pts[0].n) / span : i / (pts.length - 1));
    };
    let out = unit ? svgText(6, th + 12, fitText(unit, w - 12, 10), 'cv-axis') : '';
    ticks.forEach(t => {
      out += `<line x1="${fx(left)}" x2="${fx(right)}" y1="${fx(y(t))}" y2="${fx(y(t))}" class="${t === 0 ? 'cv-base' : 'cv-grid'}"/>` +
        svgText(left - 5, y(t) + 3.5, compact(t), 'cv-axis', 'end');
    });
    const xy = pts.map((p, i) => [X(p, i), y(p.v)]);
    if (xy.length > 1) out += `<path d="M${xy.map(q => fx(q[0]) + ' ' + fx(q[1])).join('L')}" class="cv-line" stroke="${b.color}"/>`;
    xy.forEach((q, i) => {
      out += `<circle cx="${fx(q[0])}" cy="${fx(q[1])}" r="${pts.length > 24 ? 1.6 : 3.5}" fill="${b.color}" class="${pts.length > 24 ? '' : 'cv-dot'}"><title>${esc(pts[i].label + ' : ' + fmtNum(pts[i].v) + (unit ? ' ' + unit : ''))}</title></circle>`;
    });
    // 値と横軸ラベルは、重ならないものだけ表示（最後の点を優先）
    const place = (text, size, weight) => {
      const used = [], res = new Map();
      const order = [xy.length - 1, 0, ...xy.map((_, i) => i).slice(1, -1)];
      [...new Set(order)].forEach(i => {
        const t = text(i); if (!t) return;
        const tw = textW(t, size, weight), cx = clamp(xy[i][0], tw / 2 + 1, w - tw / 2 - 1);
        if (used.some(u => cx - tw / 2 < u[1] + 5 && cx + tw / 2 > u[0] - 5)) return;
        used.push([cx - tw / 2, cx + tw / 2]); res.set(i, [cx, t]);
      });
      return res;
    };
    place(i => fmtNum(pts[i].v), 10, 600).forEach(([cx, t], i) => { out += svgText(cx, Math.max(xy[i][1] - 7, top - 3), t, 'cv-pv', 'middle'); });
    place(i => pts[i].label, 10).forEach(([cx, t]) => { out += svgText(cx, h - 5, t, 'cv-axis', 'middle'); });
    return out;
  }

  function chartSVG(b, w, h) {
    const defs = [];
    const body = b.type === 'pie' ? drawPie(b, w, h, defs) : b.type === 'bar' ? drawBar(b, w, h, defs) : drawTrend(b, w, h);
    const title = b.title.trim() ? svgText(6, 15, fitText(b.title.trim(), w - 12, 13, 700), 'cv-title') : '';
    const empty = body === null ? svgText(w / 2, titleH(b) + (h - titleH(b)) / 2 + 4, `${CV_TYPES[b.type]}（データ未入力）`, 'cv-empty', 'middle') : '';
    const label = (b.title.trim() || CV_TYPES[b.type]);
    return `<svg class="cv-svg" viewBox="0 0 ${fx(w)} ${fx(h)}" width="${fx(w)}" height="${fx(h)}" role="img" aria-label="${esc(label)}">${defs.length ? `<defs>${defs.join('')}</defs>` : ''}${title}${body || ''}${empty}</svg>`;
  }

  /* ---------- キャンバス描画 ---------- */
  function renderCanvas() {
    const stage = $('cv-stage'), wrap = $('cv-wrap');
    if (!state.selectedCountryKey) { stage.innerHTML = ''; return; }
    const e = cvEntry(), memo = (e && e.memo) || '', edit = state.edit;
    const blocks = (e && e.blocks) || [];
    stage.innerHTML = '';
    const outer = wrap.clientWidth;
    if (!outer) return;
    cvs.scale = Math.min(outer / CV_W, 1.5);
    stage.style.setProperty('--cv-inv', 1 / cvs.scale);
    stage.style.transform = `scale(${cvs.scale})`;
    stage.style.left = Math.max(0, (outer - CV_W * cvs.scale) / 2) + 'px';

    const showMemo = !!memo.trim() || (edit && blocks.length > 0);
    const els = new Map();
    cvOrder(e).forEach((id, z) => {
      if (id === 'memo' && !showMemo) return;
      const el = document.createElement('div');
      el.className = 'cv-block' + (id === 'memo' ? ' cv-memo' : '') + (edit && cvs.sel === id ? ' sel' : '');
      el.dataset.id = id;
      el.style.zIndex = z + 1;
      if (id === 'memo') {
        const p = document.createElement('p');
        p.textContent = memo.trim() ? memo : 'メモ（上の欄に入力すると表示されます）';
        if (!memo.trim()) p.className = 'cv-ph';
        el.appendChild(p);
      }
      stage.appendChild(el);
      els.set(id, el);
    });

    // メモは文章量で高さが決まる。伸びてすぐ下の部品にかぶる時は、その部品を下へ送る
    const pos = new Map(blocks.map(b => [b.id, { x: b.x, y: b.y, w: b.w, h: Math.max(b.h, cvMinH(b)) }]));
    const mEl = els.get('memo');
    if (mEl) {
      const m = cvMemoBox(e);
      Object.assign(mEl.style, { left: m.x + 'px', top: m.y + 'px', width: m.w + 'px' });
      const mh = mEl.offsetHeight;
      if (m.h && mh > m.h + 0.5) cvPushDown(pos, { ...m, h: mh }, m.y + m.h);
      if (edit) {
        const mb = cvEnsureMemoBox(e);
        if (Math.abs(mb.h - mh) > 0.5) {
          mb.h = mh;
          blocks.forEach(b => { b.y = pos.get(b.id).y; });
        }
      }
    }
    blocks.forEach(b => {
      const el = els.get(b.id), q = pos.get(b.id);
      cvPlace(el, q);
      el.innerHTML = chartSVG(b, q.w, q.h);
    });
    if (edit && cvs.sel && els.has(cvs.sel)) {
      const h = document.createElement('i');
      h.className = 'cv-handle';
      els.get(cvs.sel).appendChild(h);
    }
    // 閲覧時は上の余白を詰める
    let top = 0;
    if (!edit && els.size) {
      top = Math.min(...[...els.values()].map(el => el.offsetTop));
      els.forEach(el => { el.style.top = (el.offsetTop - top) + 'px'; });
    }
    cvSizeStage();
    cvUpdateTools();
  }
  function cvPlace(el, q) { Object.assign(el.style, { left: q.x + 'px', top: q.y + 'px', width: q.w + 'px', height: q.h + 'px' }); }
  function cvPushDown(pos, anchor, fromY) {
    const queue = [[anchor, fromY]];
    const moved = new Set();
    while (queue.length) {
      const [a, from] = queue.shift();
      pos.forEach((q, id) => {
        if (moved.has(id) || q === a) return;
        const overlapX = q.x < a.x + a.w - 1 && q.x + q.w > a.x + 1;
        if (overlapX && q.y >= from - 1 && q.y < a.y + a.h + CV_GAP - 0.5) {
          const old = q.y + q.h;
          q.y = a.y + a.h + CV_GAP;
          moved.add(id);
          queue.push([q, old]);
        }
      });
    }
  }
  function cvBottom() {
    return Math.max(0, ...[...$('cv-stage').children].map(el => el.offsetTop + el.offsetHeight));
  }
  function cvSizeStage() {
    const bottom = cvBottom();
    // 編集中は下に余白を残して、部品をさらに下へ置けるようにする
    let h = bottom ? bottom + (state.edit ? 80 : 4) : 0;
    // ドラッグ中は縮めない（縮むとスクロール位置がずれて、部品が勝手に流れる）
    if (cvs.drag) h = Math.max(h, cvs.drag.stageH);
    $('cv-stage').style.height = h + 'px';
    $('cv-wrap').style.height = (h * cvs.scale) + 'px';
  }
  function cvUpdateTools() {
    const id = cvs.sel, e = cvEntry(), b = id && id !== 'memo' ? cvFind(id) : null;
    const on = !!id && (id === 'memo' || !!b);
    $('cv-snap').classList.toggle('on', cvs.snap);
    $('cv-selname').textContent = !on
      ? ((e && e.blocks && e.blocks.length) ? '部品をタップして選ぶと、移動・大きさ変更ができます' : (e && e.memo.trim() ? 'グラフを追加すると自由に並べられます' : 'グラフとメモを自由に並べられます'))
      : (b ? b.title.trim() || CV_TYPES[b.type] : 'メモ');
    const many = on && cvOrder(e).length > 1;
    $('cv-edit').classList.toggle('hidden', !on);
    $('cv-front').classList.toggle('hidden', !many);
    $('cv-back').classList.toggle('hidden', !many);
    $('cv-del').classList.toggle('hidden', !b);
  }
  function cvSelect(id) {
    if (cvs.sel === id) return;
    cvs.sel = id;
    renderCanvas();
  }

  /* ---------- 追加・削除・重なり順 ---------- */
  const blankItem = i => ({ name: '', value: null, color: CV_LOOKS[i % CV_LOOKS.length][0], style: CV_LOOKS[i % CV_LOOKS.length][1] });
  function cvAdd(type) {
    if (!state.edit) return;
    const e = cvEntry(true);
    if (!e) return;
    renderCanvas();
    const y = cvBottom();
    const raw = { type, title: '', x: 0, y: y ? Math.ceil(y + CV_GAP) : 0, w: CV_W, h: type === 'bar' ? 100 : type === 'pie' ? 170 : 190 };
    if (type === 'trend') raw.rows = [{ x: '', y: null }, { x: '', y: null }, { x: '', y: null }];
    else raw.items = [blankItem(0), blankItem(1)];
    const b = cleanBlock(raw);
    // まだ中身がない国では、先頭をメモ用に空けておく
    if (!e.blocks && !e.memo.trim()) { cvEnsureMemoBox(e).h = 36; b.y = 36 + CV_GAP; }
    (e.blocks = e.blocks || []).push(b);
    cvs.sel = b.id;
    cvCommit();
    cvOpenEditor(b.id);
  }
  function cvDelete() {
    const e = cvEntry(), b = cvFind(cvs.sel);
    if (!e || !b || !state.edit) return;
    if (!confirm(`「${b.title.trim() || CV_TYPES[b.type]}」を削除しますか？`)) return;
    const order = cvOrder(e);
    if (order.indexOf(b.id) < order.indexOf('memo')) cvEnsureMemoBox(e).z--;
    e.blocks = e.blocks.filter(x => x !== b);
    if (!e.blocks.length) delete e.blocks;
    cvs.sel = null;
    renderCanvas(); cvCommit();
    showToast('グラフを削除しました');
  }
  function cvRestack(front) {
    const e = cvEntry(), id = cvs.sel;
    if (!e || !id || !state.edit) return;
    const order = cvOrder(e).filter(x => x !== id);
    if (front) order.push(id); else order.unshift(id);
    cvEnsureMemoBox(e).z = order.indexOf('memo');
    if (e.blocks) e.blocks.sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id));
    renderCanvas(); cvCommit();
  }

  /* ---------- ドラッグ（移動・大きさ変更） ---------- */
  // 候補の線に近ければ吸い付く
  function cvSnapTo(values, targets) {
    let best = null;
    values.forEach(v => targets.forEach(t => {
      const d = t - v;
      if (Math.abs(d) <= CV_SNAP && (best === null || Math.abs(d) < Math.abs(best))) best = d;
    }));
    return best || 0;
  }
  function cvTargets(id) {
    const xs = [0, CV_W / 2, CV_W], ys = [0];
    [...$('cv-stage').children].forEach(el => {
      if (el.dataset.id === id) return;
      const l = el.offsetLeft, t = el.offsetTop, w = el.offsetWidth, h = el.offsetHeight;
      xs.push(l, l + w / 2, l + w, l + w + CV_GAP / 2, l - CV_GAP / 2);
      ys.push(t, t + h, t + h + CV_GAP);
    });
    return { xs, ys };
  }
  function cvPointerDown(ev) {
    if (!state.edit || cvs.drag || (ev.pointerType === 'mouse' && ev.button !== 0)) return;
    cvs.skipClick = false;
    const el = ev.target.closest('.cv-block');
    if (!el) return;
    const id = el.dataset.id;
    if (cvs.sel !== id) {
      // 指の場合は、未選択の部品の上からでもスクロールできるようにタップ(click)で選ぶ
      if (ev.pointerType === 'mouse') { cvSelect(id); } else return;
    }
    const node = [...$('cv-stage').children].find(c => c.dataset.id === id);
    const e = cvEntry(true), b = id === 'memo' ? cvEnsureMemoBox(e) : cvFind(id);
    if (!node || !b) return;
    ev.preventDefault();
    cvs.skipClick = true;      // ポインタを掴んだ後の click は選択解除扱いにしない
    const resize = ev.target.classList.contains('cv-handle');
    cvs.drag = {
      id, node, b, resize, pid: ev.pointerId, sx: ev.clientX, sy: ev.clientY, cx: ev.clientX, cy: ev.clientY,
      scroll: $('country-body').scrollTop, moved: false, stageH: $('cv-stage').offsetHeight,
      o: { x: node.offsetLeft, y: node.offsetTop, w: node.offsetWidth, h: node.offsetHeight }, t: cvTargets(id)
    };
    try { $('cv-stage').setPointerCapture(ev.pointerId); } catch { /* noop */ }
    cvs.drag.timer = setInterval(cvAutoScroll, 30);
  }
  function cvPointerMove(ev) {
    const d = cvs.drag;
    if (!d || ev.pointerId !== d.pid) return;
    d.cx = ev.clientX; d.cy = ev.clientY;
    cvApplyDrag();
  }
  function cvAutoScroll() {
    const d = cvs.drag;
    if (!d || !d.moved) return;
    const body = $('country-body'), r = body.getBoundingClientRect();
    const topEdge = r.top + (document.querySelector('.cv-tools').offsetHeight || 0) + 20;
    // 端の近くで、その方向へ指を動かしている時だけ送る（端の部品を掴んだだけで流れないように）
    const dir = d.cy > r.bottom - 28 && d.cy - d.sy > 12 ? 1 : d.cy < topEdge && d.sy - d.cy > 12 ? -1 : 0;
    if (!dir) return;
    const before = body.scrollTop;
    body.scrollTop += dir * 9;
    if (body.scrollTop !== before) cvApplyDrag();
  }
  function cvApplyDrag() {
    const d = cvs.drag;
    const rawX = d.cx - d.sx, rawY = d.cy - d.sy + ($('country-body').scrollTop - d.scroll);
    if (!d.moved && Math.hypot(rawX, rawY) < 4) return;
    d.moved = true;
    const dx = rawX / cvs.scale, dy = rawY / cvs.scale, o = d.o;
    const isMemo = d.id === 'memo';
    let { x, y, w, h } = o;
    if (d.resize) {
      w = clamp(o.w + dx, CV_MIN_W, CV_W - o.x);
      if (cvs.snap) w = clamp(w + cvSnapTo([o.x + w], d.t.xs), CV_MIN_W, CV_W - o.x);
      if (!isMemo) {
        const min = cvMinH({ ...d.b, w });
        h = clamp(o.h + dy, min, 1200);
        if (cvs.snap) h = clamp(h + cvSnapTo([o.y + h], d.t.ys), min, 1200);
      }
    } else {
      x = o.x + dx; y = o.y + dy;
      if (cvs.snap) {
        x += cvSnapTo([x, x + w / 2, x + w], d.t.xs);
        y += cvSnapTo([y, y + h], d.t.ys);
      }
      x = clamp(x, 0, CV_W - w); y = clamp(y, 0, 20000);
    }
    const r = v => Math.round(v * 10) / 10;
    d.b.x = r(x); d.b.y = r(y); d.b.w = r(w);
    if (isMemo) {
      Object.assign(d.node.style, { left: d.b.x + 'px', top: d.b.y + 'px', width: d.b.w + 'px' });
      d.b.h = d.node.offsetHeight;
    } else {
      d.b.h = r(h);
      cvPlace(d.node, d.b);
      if (d.resize) {
        d.node.querySelector('svg').remove();
        d.node.insertAdjacentHTML('afterbegin', chartSVG(d.b, d.b.w, d.b.h));
      }
    }
    cvSizeStage();
  }
  function cvEndDrag() {
    const d = cvs.drag;
    if (!d) return;
    clearInterval(d.timer);
    cvs.drag = null;
    if (d.moved) { cvSizeStage(); cvCommit(); }
  }

  /* ---------- グラフの中身を編集 ---------- */
  function cvOpenEditor(id) {
    if (!state.edit) return;
    if (id === 'memo') {
      const t = $('country-memo');
      t.focus({ preventScroll: true });
      $('country-body').scrollTop = 0;
      return;
    }
    if (!cvFind(id)) return;
    cvs.editing = id; cvs.sel = id;
    $('cv-main').classList.add('hidden');
    $('cv-editor').classList.remove('hidden');
    buildEditor();
    $('country-body').scrollTop = 0;
  }
  function cvCloseEditor() {
    cvs.editing = null;
    $('cv-editor').classList.add('hidden');
    $('cv-editor').innerHTML = '';
    $('cv-main').classList.remove('hidden');
    renderCanvas();
    const el = [...$('cv-stage').children].find(c => c.dataset.id === cvs.sel);
    if (el) el.scrollIntoView({ block: 'nearest' });
  }
  function h(tag, attrs, ...kids) {
    const el = document.createElement(tag);
    Object.entries(attrs || {}).forEach(([k, v]) => {
      if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
      else if (k === 'value') el.value = v;
      else if (k === 'checked') el.checked = v;
      else el.setAttribute(k, v);
    });
    el.append(...kids.filter(k => k !== null && k !== undefined));
    return el;
  }
  function buildEditor() {
    const root = $('cv-editor'), b = cvFind(cvs.editing);
    if (!b) return;
    root.innerHTML = '';
    const preview = h('div', { class: 'cv-preview' });
    const total = h('p', { class: 'cv-total' });
    const refresh = () => {
      const need = cvMinH(b), height = Math.max(b.h, need);
      preview.innerHTML = chartSVG({ ...b, x: 0, y: 0 }, b.w, height);
      const svg = preview.firstChild;
      svg.removeAttribute('height');
      svg.setAttribute('width', '100%');
      svg.style.maxWidth = (b.w * 1.3) + 'px';
      if (b.type !== 'trend') {
        const sum = b.items.reduce((a, it) => a + (it.value || 0), 0), left = Math.round((100 - sum) * 100) / 100;
        total.textContent = left >= 0 ? `入力の合計 ${fmtNum(sum)}% ／ 残り ${fmtNum(left)}%`
          : `合計が ${fmtNum(sum)}% で100%を超えています（グラフは合計に対する比率で表示）`;
        total.classList.toggle('over', left < 0);
      }
    };
    // 入力のたびに：必要なら高さを広げ、下の部品を送ってから保存
    const changed = () => {
      const need = cvMinH(b);
      if (need > b.h) {
        const e = cvEntry(), oldBottom = b.y + b.h;
        b.h = need;
        const pos = new Map(e.blocks.filter(x => x !== b).map(x => [x.id, { x: x.x, y: x.y, w: x.w, h: x.h }]));
        cvPushDown(pos, b, oldBottom);
        e.blocks.forEach(x => { if (pos.has(x.id)) x.y = pos.get(x.id).y; });
      }
      refresh(); cvCommit();
    };
    const text = (value, placeholder, max, oninput, extra) => h('input', { type: 'text', value, placeholder, maxlength: max, 'aria-label': placeholder, ...(extra || {}), oninput: ev => { oninput(ev.target.value); changed(); } });
    const color = (value, oninput) => h('input', { type: 'color', value, title: '色', 'aria-label': '色', oninput: ev => { oninput(ev.target.value); changed(); } });
    const styleSel = (value, onchange) => {
      const s = h('select', { title: '模様', 'aria-label': '模様', onchange: ev => { onchange(ev.target.value); changed(); } },
        ...CV_STYLES.map(o => h('option', { value: o.id }, o.name)));
      s.value = value;
      return s;
    };
    const delBtn = onclick => {
      const x = h('button', { class: 'cv-x', type: 'button', title: 'この行を削除', 'aria-label': 'この行を削除', onclick });
      x.textContent = '×';
      return x;
    };
    const section = (label, ...kids) => h('div', { class: 'memo-section' }, label ? h('label', {}, label) : null, ...kids);

    root.append(
      h('div', { class: 'cv-edhead' },
        h('strong', {}, CV_TYPES[b.type]),
        h('button', { class: 'primary-btn', type: 'button', id: 'cv-done', onclick: cvCloseEditor }, '配置に戻る')),
      preview,
      section('タイトル', text(b.title, b.type === 'pie' ? '例：発電方法の割合' : b.type === 'bar' ? '例：輸出品の内訳' : '例：人口の推移', 60, v => { b.title = v; }))
    );

    if (b.type === 'trend') {
      const list = h('div', { class: 'cv-rows' });
      const rows = () => {
        list.innerHTML = '';
        b.rows.forEach((r, i) => {
          list.append(h('div', { class: 'cv-row trend' },
            text(r.x, '年・時期', 20, v => { r.x = v; }),
            text(r.y === null ? '' : String(r.y), '数値', 20, v => { r.y = cvNum(v); }),
            delBtn(() => { b.rows.splice(i, 1); rows(); changed(); })));
        });
      };
      rows();
      const add = h('button', { class: 'chip-btn cv-addrow', type: 'button', onclick: () => {
        if (b.rows.length >= CV_MAX_ROWS) { showToast(`追加できるのは${CV_MAX_ROWS}行までです`); return; }
        // 直前の2行が数字なら、次の年を入れておく
        const [p, q] = b.rows.slice(-2).map(r => cvNum(r.x));
        const next = p !== undefined && p !== null && q !== undefined && q !== null ? String(q + (q - p)) : '';
        b.rows.push({ x: next, y: null }); rows(); changed();
      } }, '＋ 行を追加');
      root.append(
        section('データ', list, add),
        section('単位', text(b.unit, '例：億人', 16, v => { b.unit = v; })),
        section('表示',
          h('div', { class: 'cv-optrow' },
            h('label', { class: 'cv-check' }, h('input', { type: 'checkbox', checked: b.zero, onchange: ev => { b.zero = ev.target.checked; changed(); } }), '縦軸を0から始める'),
            h('span', { class: 'opt-label' }, '線の色'), color(b.color, v => { b.color = v; })))
      );
    } else {
      const list = h('div', { class: 'cv-rows' });
      const rows = () => {
        list.innerHTML = '';
        b.items.forEach((it, i) => {
          list.append(h('div', { class: 'cv-row' },
            color(it.color, v => { it.color = v; }),
            styleSel(it.style, v => { it.style = v; }),
            text(it.name, '項目名', 40, v => { it.name = v; }),
            text(it.value === null ? '' : String(it.value), '0', 10, v => { const n = cvNum(v); it.value = n === null ? null : Math.max(0, n); }, { inputmode: 'decimal', class: 'cv-pct' }),
            h('span', { class: 'cv-unit' }, '%'),
            delBtn(() => { b.items.splice(i, 1); rows(); changed(); })));
        });
      };
      rows();
      const add = h('button', { class: 'chip-btn cv-addrow', type: 'button', onclick: () => {
        if (b.items.length >= CV_MAX_ITEMS) { showToast(`追加できるのは${CV_MAX_ITEMS}項目までです`); return; }
        b.items.push(blankItem(b.items.length)); rows(); changed();
      } }, '＋ 項目を追加');
      const r = b.rest;
      root.append(
        section('項目と割合', list, add, total),
        section('残りの部分',
          h('label', { class: 'cv-check' }, h('input', { type: 'checkbox', checked: r.show, onchange: ev => { r.show = ev.target.checked; changed(); } }), '残りを項目として表示する'),
          h('div', { class: 'cv-row rest' },
            color(r.color, v => { r.color = v; }),
            styleSel(r.style, v => { r.style = v; }),
            text(r.name, cvRestName(b.type), 40, v => { r.name = v; })))
      );
    }
    refresh();
  }

  function bindCanvas() {
    const stage = $('cv-stage');
    stage.addEventListener('pointerdown', cvPointerDown);
    stage.addEventListener('pointermove', cvPointerMove);
    stage.addEventListener('pointerup', cvEndDrag);
    stage.addEventListener('pointercancel', cvEndDrag);
    stage.addEventListener('lostpointercapture', cvEndDrag);
    $('cv-wrap').addEventListener('click', ev => {
      if (!state.edit) return;
      if (cvs.skipClick) { cvs.skipClick = false; return; }
      const el = ev.target.closest('.cv-block');
      cvSelect(el ? el.dataset.id : null);
    });
    stage.addEventListener('dblclick', ev => {
      const t = document.elementFromPoint(ev.clientX, ev.clientY), el = t && t.closest('.cv-block');
      if (el && state.edit) cvOpenEditor(el.dataset.id);
    });
    document.querySelector('.cv-tools').addEventListener('click', ev => {
      const add = ev.target.closest('[data-add]');
      if (add) cvAdd(add.dataset.add);
    });
    $('cv-snap').onclick = () => { cvs.snap = !cvs.snap; try { localStorage.setItem('wn-cv-snap', cvs.snap ? '1' : '0'); } catch { /* noop */ } cvUpdateTools(); };
    $('cv-edit').onclick = () => cvOpenEditor(cvs.sel);
    $('cv-front').onclick = () => cvRestack(true);
    $('cv-back').onclick = () => cvRestack(false);
    $('cv-del').onclick = cvDelete;
    // パネルの幅が変わったら拡大率を合わせ直す
    if (window.ResizeObserver) {
      let last = 0;
      new ResizeObserver(() => {
        const w = $('cv-wrap').clientWidth;
        if (w && w !== last) { last = w; if (!cvs.drag && state.panel === 'country') renderCanvas(); }
      }).observe($('cv-wrap'));
    }
  }

  /* =========================================================
   * 世界ランキング（国メモの2つ目のタブ）
   * ノート(state.countries)とは完全に別のデータ(state.rankings)・別の保存キーで管理する
   * state.rankings[国] = { cats: [カテゴリー名の順], items: [{ id, cat, name, type, rank, value, unit, year, source, note }] }
   * ======================================================= */
  const RANK_KEY = 'world-notes-rankings-v1';
  const RK_PRESETS = [
    ['農業・林業・水産業', 'コメ 小麦 トウモロコシ 大豆 綿花 サトウキビ コーヒー豆 カカオ豆 茶 天然ゴム パーム油 牛肉 豚肉 鶏肉 牛乳 木材 水産物'],
    ['エネルギー・鉱産資源', '原油 天然ガス 石炭 ウラン 鉄鉱石 銅 ボーキサイト 金 銀 リン鉱石 レアアース リチウム ニッケル コバルト'],
    ['工業・製造業', '自動車 鉄鋼 セメント アルミニウム 半導体 電子機器 化学製品 造船 航空機'],
    ['貿易・経済', '輸出総額 輸入総額 貿易収支 GDP 一人当たりGDP 農産物輸出額 工業製品輸出額 燃料輸出額 サービス輸出額 外国直接投資'],
    ['人口・社会', '総人口 人口密度 人口増加率 都市人口率 合計特殊出生率 平均寿命 乳児死亡率 農業就業人口割合 観光客受入数 難民受入数']
  ].map(([name, list]) => ({ name, items: list.split(' ') }));
  const RK_CATS = RK_PRESETS.map(c => c.name);
  const RK_TYPES = ['生産量', '輸出量', '輸入量', 'その他'];
  const RK_GOODS = new Set(RK_CATS.slice(0, 3));      // 品目のカテゴリー（指標の初期値は生産量）
  const RK_NEW = '__new__';
  const rk = { tab: 'note', form: null, drag: null, closed: rkLoadClosed() };

  function rkLoadClosed() { try { return new Set(JSON.parse(localStorage.getItem('wn-rk-closed')) || []); } catch { return new Set(); } }
  function rkSaveClosed() { try { localStorage.setItem('wn-rk-closed', JSON.stringify([...rk.closed])); } catch { /* noop */ } }

  /* ---------- データ ---------- */
  const rkText = (v, n) => String(v == null ? '' : v).slice(0, n);
  function rkRankNum(v) {
    const t = String(v == null ? '' : v).normalize('NFKC').replace(/[,\s位]/g, '');
    return /^\d{1,4}$/.test(t) && +t > 0 ? +t : null;
  }
  function cleanRankings(src) {
    const out = {};
    if (!src || typeof src !== 'object') return out;
    Object.keys(src).forEach(k => {
      const e = src[k];
      if (k === '__proto__' || !e || !Array.isArray(e.items)) return;
      const time = v => (Number.isFinite(v) && v > 0 ? v : 0);
      const del = {};
      Object.keys(e.del && typeof e.del === 'object' ? e.del : {}).forEach(id => { if (/^[\w-]{1,40}$/.test(id) && time(e.del[id])) del[id] = e.del[id]; });
      const ids = new Set();
      const items = e.items.map(it => {
        if (!it || typeof it !== 'object') return null;
        const name = rkText(it.name, 60).trim(), cat = rkText(it.cat, 40).trim();
        if (!name || !cat) return null;
        let id = typeof it.id === 'string' && /^[\w-]{1,40}$/.test(it.id) ? it.id : 'R' + uid();
        if (ids.has(id)) id = 'R' + uid();
        ids.add(id);
        return {
          id, cat, name, type: RK_TYPES.includes(it.type) ? it.type : 'その他', rank: rkRankNum(it.rank),
          value: rkText(it.value, 60), unit: rkText(it.unit, 30), year: rkText(it.year, 20),
          source: rkText(it.source, 300), note: rkText(it.note, 2000), t: time(it.t)
        };
      }).filter(Boolean);
      if (!items.length && !Object.keys(del).length) return;
      out[k] = { cats: Array.isArray(e.cats) ? e.cats.map(c => rkText(c, 40).trim()) : [], items, del, ot: time(e.ot) };
      rkFixCats(out[k]);
    });
    return out;
  }
  // 中身のないカテゴリーを除き、抜けているカテゴリーを補う
  function rkFixCats(e) {
    const used = new Set(e.items.map(i => i.cat));
    e.cats = [...new Set(e.cats)].filter(c => used.has(c));
    used.forEach(c => {
      if (e.cats.includes(c)) return;
      // 初期カテゴリーは基本の順を目安に差し込む。独自カテゴリーは末尾
      const di = RK_CATS.indexOf(c);
      const at = di < 0 ? -1 : e.cats.findIndex(x => RK_CATS.indexOf(x) > di);
      if (at < 0) e.cats.push(c); else e.cats.splice(at, 0, c);
    });
  }
  const rkData = () => state.rankings[state.selectedCountryKey] || null;
  const rkNow = prev => Math.max(Date.now(), (prev || 0) + 1);      // 更新時刻は必ず前より新しくする

  const rkHas = key => !!(state.rankings[key] && state.rankings[key].items.length);
  const rkLabel = it => (it.type === 'その他' || it.name.endsWith(it.type) ? it.name : it.name + it.type);
  function rkNumText(v) {
    const t = v.normalize('NFKC').trim();
    const m = /^(-?)(\d+)(\.\d+)?$/.exec(t);
    // 先頭が0の数字などはそのまま。整数部だけ3桁区切りにする
    return m && !/^0\d/.test(m[2]) ? m[1] + m[2].replace(/\B(?=(\d{3})+(?!\d))/g, ',') + (m[3] || '') : v;
  }

  /* ---------- タブ ---------- */
  // 国を開いた直後
  function rkOpen() { rk.tab = 'note'; rkShowTab(); $('rank-body').scrollTop = 0; }
  // パネルを閉じる／別の国へ移る時。入力中の内容は、登録できる状態なら保存する
  function rkReset() {
    rkEndDrag(false);
    if (rk.form) {
      const f = rk.form;
      if (f.dirty && state.edit) {
        if (!rkValidate(f.draft)) { rkCommitForm(); showToast('入力中のランキングを保存しました'); }
        else showToast('未入力の項目があるため、入力中のランキングは保存していません');
      }
      rk.form = null;
    }
    rk.tab = 'note';
    rkShowTab();
    $('rank-body').innerHTML = '';
  }
  function rkShowTab() {
    const key = state.selectedCountryKey;
    const visible = !!key && (state.edit || rkHas(key));
    if (!visible) rk.tab = 'note';
    const rank = rk.tab === 'rank';
    $('rk-tabs').classList.toggle('hidden', !visible);
    $('rk-tabs').querySelectorAll('button').forEach(b => {
      b.classList.toggle('active', b.dataset.tab === rk.tab);
      b.setAttribute('aria-selected', b.dataset.tab === rk.tab);
    });
    $('country-body').classList.toggle('hidden', rank);
    $('country-foot').classList.toggle('hidden', rank);
    $('rank-body').classList.toggle('hidden', !rank);
  }
  function rkSetTab(tab) {
    if (tab === rk.tab) return;
    rk.tab = tab;
    rkShowTab();
    if (tab === 'rank') renderRank();
    else if (!cvs.editing) renderCanvas();
  }

  /* ---------- 一覧 ---------- */
  const RK_GRIP = '<svg viewBox="0 0 24 24" class="icon" aria-hidden="true"><path d="M5 9h14M5 15h14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>';
  function rkGrip(label, kind) {
    const b = h('button', { class: 'rk-grip', type: 'button', title: 'ドラッグで並び替え', 'aria-label': label + 'を並び替え（ドラッグ、または上下キー）' });
    b.innerHTML = RK_GRIP;
    b.addEventListener('pointerdown', ev => rkStartDrag(ev, b.closest(kind === 'cat' ? '.rk-cat' : '.rk-card'), kind));
    b.addEventListener('keydown', ev => {
      if (ev.key !== 'ArrowUp' && ev.key !== 'ArrowDown') return;
      ev.preventDefault();
      const el = b.closest(kind === 'cat' ? '.rk-cat' : '.rk-card');
      const other = ev.key === 'ArrowUp' ? el.previousElementSibling : el.nextElementSibling;
      if (!other) return;
      el.parentNode.insertBefore(el, ev.key === 'ArrowUp' ? other : other.nextElementSibling);
      rkSaveOrder(); b.focus();
    });
    return b;
  }
  function rkCard(it) {
    const rankEl = h('div', { class: 'rk-rank' + (it.rank && it.rank <= 3 ? ' r' + it.rank : '') + (it.rank ? '' : ' none') });
    if (it.rank) {
      rankEl.append(h('small', {}, '世界'), h('div', { class: 'rk-pos' }, h('b', { class: it.rank > 99 ? 'long' : '' }, String(it.rank)), h('span', {}, '位')));
    } else rankEl.append(h('small', {}, '順位'), h('div', { class: 'rk-pos' }, h('b', {}, '—')));
    const meta = (label, text) => (text.trim() ? h('div', { class: 'rk-meta' }, h('span', {}, label), h('em', {}, text)) : null);
    const body = h('div', { class: 'rk-info' },
      h('h4', {}, rkLabel(it)),
      it.value.trim() || it.unit.trim()
        ? h('div', { class: 'rk-value' }, h('b', {}, it.value.trim() ? rkNumText(it.value) : '—'), it.unit.trim() ? h('span', {}, it.unit) : null) : null,
      meta('統計年', it.year), meta('出典', it.source),
      it.note.trim() ? h('p', { class: 'rk-note' }, it.note) : null);
    const main = h('div', { class: 'rk-main' }, rankEl, body);
    const card = h('article', { class: 'rk-card', 'data-id': it.id }, main);
    if (state.edit) {
      main.append(rkGrip(rkLabel(it), 'item'));
      card.append(h('div', { class: 'rk-actions' },
        h('button', { class: 'chip-btn', type: 'button', 'data-act': 'edit', onclick: () => rkOpenForm(it.id) }, '編集'),
        h('button', { class: 'chip-btn danger', type: 'button', 'data-act': 'del', onclick: () => rkDelete(it.id) }, '削除')));
    }
    return card;
  }
  function renderRank() {
    const root = $('rank-body'), key = state.selectedCountryKey;
    if (!key) { root.innerHTML = ''; return; }
    if (rk.form) { rkRenderForm(); return; }
    const top = root.scrollTop, e = rkData(), f = byKey.get(key);
    root.innerHTML = '';
    if (!state.edit) root.append(h('div', { class: 'view-card' }, h('h2', {}, f ? f._name : $('country-v-title').textContent)));
    else root.append(h('div', { class: 'rk-top' },
      h('button', { class: 'primary-btn', type: 'button', id: 'rk-add', onclick: () => rkOpenForm(null) }, '＋ ランキングを追加')));
    if (!e || !e.items.length) {
      root.append(h('p', { class: 'rk-empty' }, 'この国のランキングはまだありません。'));
      return;
    }
    const list = h('div', { class: 'rk-cats' });
    e.cats.forEach(cat => {
      const items = e.items.filter(i => i.cat === cat), ck = key + '\n' + cat, open = !rk.closed.has(ck);
      const toggle = h('button', { class: 'rk-toggle', type: 'button', 'aria-expanded': String(open) },
        h('i', {}), h('span', {}, cat), h('small', {}, String(items.length)));
      const section = h('section', { class: 'rk-cat' + (open ? '' : ' closed'), 'data-cat': cat },
        h('div', { class: 'rk-cathead' }, toggle, state.edit ? rkGrip(cat, 'cat') : null),
        h('div', { class: 'rk-cards' }, ...items.map(rkCard)));
      toggle.addEventListener('click', () => {
        const closed = section.classList.toggle('closed');
        toggle.setAttribute('aria-expanded', String(!closed));
        if (closed) rk.closed.add(ck); else rk.closed.delete(ck);
        rkSaveClosed();
      });
      list.append(section);
    });
    root.append(list);
    root.scrollTop = top;
  }

  function rkDelete(id) {
    const key = state.selectedCountryKey, e = rkData();
    const it = e && e.items.find(i => i.id === id);
    if (!it || !state.edit) return;
    if (!confirm(`ランキング「${rkLabel(it)}」を削除しますか？`)) return;
    e.items = e.items.filter(i => i !== it);
    rkFixCats(e);
    e.del = { ...e.del, [id]: rkNow(it.t) };
    save();
    renderRank();
    showToast('ランキングを削除しました');
  }

  /* ---------- 並び替え（ドラッグ＆ドロップ） ---------- */
  // 画面に見えている順をデータに反映する
  function rkSaveOrder() {
    const e = rkData();
    if (!e || !state.edit) return;
    const sections = [...$('rank-body').querySelectorAll('.rk-cat')];
    if (!sections.length) return;
    const before = JSON.stringify([e.cats, e.items.map(i => i.id)]);
    e.cats = sections.map(s => s.dataset.cat);
    const byId = new Map(e.items.map(i => [i.id, i]));
    const items = sections.flatMap(s => [...s.querySelectorAll('.rk-card')].map(c => byId.get(c.dataset.id))).filter(Boolean);
    if (items.length === e.items.length) e.items = items;
    rkFixCats(e);
    if (JSON.stringify([e.cats, e.items.map(i => i.id)]) === before) return;
    e.ot = rkNow(e.ot);
    save();
  }
  function rkStartDrag(ev, el, kind) {
    if (!state.edit || rk.drag || !el || (ev.pointerType === 'mouse' && ev.button !== 0)) return;
    ev.preventDefault();
    const root = $('rank-body');
    const before = el.getBoundingClientRect().top;
    // カテゴリーの移動中は中身を畳んで、見出しだけで並べ替える
    if (kind === 'cat') { root.classList.add('rk-catdrag'); root.scrollTop += el.getBoundingClientRect().top - before; }
    el.classList.add('dragging');
    rk.drag = { el, pid: ev.pointerId, y: ev.clientY, sy: ev.clientY, next: el.nextElementSibling };
    try { root.setPointerCapture(ev.pointerId); } catch { /* noop */ }
    window.addEventListener('pointermove', rkMoveDrag);
    window.addEventListener('pointerup', rkUpDrag);
    window.addEventListener('pointercancel', rkCancelDrag);
    rk.drag.timer = setInterval(() => {
      const d = rk.drag, r = root.getBoundingClientRect();
      const dir = d.y > r.bottom - 36 && d.y > d.sy + 8 ? 1 : d.y < r.top + 36 && d.y < d.sy - 8 ? -1 : 0;
      if (dir) { root.scrollTop += dir * 9; rkReorder(); }
    }, 30);
  }
  function rkReorder() {
    const d = rk.drag, parent = d.el.parentNode;
    const next = [...parent.children].find(c => {
      if (c === d.el) return false;
      const r = c.getBoundingClientRect();
      return d.y < r.top + r.height / 2;
    }) || null;
    if (next !== d.el.nextElementSibling) parent.insertBefore(d.el, next);
  }
  function rkMoveDrag(ev) { if (rk.drag && ev.pointerId === rk.drag.pid) { rk.drag.y = ev.clientY; rkReorder(); } }
  function rkUpDrag(ev) { if (rk.drag && ev.pointerId === rk.drag.pid) rkEndDrag(true); }
  function rkCancelDrag(ev) { if (rk.drag && ev.pointerId === rk.drag.pid) rkEndDrag(false); }
  function rkEndDrag(commit) {
    const d = rk.drag;
    if (!d) return;
    rk.drag = null;
    clearInterval(d.timer);
    window.removeEventListener('pointermove', rkMoveDrag);
    window.removeEventListener('pointerup', rkUpDrag);
    window.removeEventListener('pointercancel', rkCancelDrag);
    d.el.classList.remove('dragging');
    $('rank-body').classList.remove('rk-catdrag');
    if (commit) rkSaveOrder(); else renderRank();
  }

  /* ---------- 追加・編集 ---------- */
  function rkOpenForm(id) {
    const key = state.selectedCountryKey;
    if (!key || !state.edit) return;
    const it = id && rkData().items.find(i => i.id === id);
    const draft = it ? { ...it, rank: it.rank ? String(it.rank) : '' }
      : { id: null, cat: RK_CATS[0], name: '', type: '生産量', rank: '', value: '', unit: '', year: '', source: '', note: '' };
    rk.form = { key, draft, dirty: false, typeTouched: !!it, listTop: $('rank-body').scrollTop };
    rkRenderForm();
    $('rank-body').scrollTop = 0;
  }
  function rkValidate(d) {
    if (!d.cat.trim()) return 'カテゴリー名を入力してください';
    if (!d.name.trim()) return '品目・指標名を入力してください';
    if (String(d.rank).trim() && !rkRankNum(d.rank)) return '世界順位は1以上の整数で入力してください';
    if (!String(d.rank).trim() && !d.value.trim()) return '世界順位か統計値のどちらかを入力してください';
    return '';
  }
  function rkCommitForm() {
    const { key, draft } = rk.form;
    const d = {
      id: draft.id || 'R' + uid(), cat: draft.cat.trim(), name: draft.name.trim(), type: draft.type, rank: rkRankNum(draft.rank),
      value: draft.value.trim(), unit: draft.unit.trim(), year: draft.year.trim(), source: draft.source.trim(), note: draft.note.trim()
    };
    const e = state.rankings[key] || (state.rankings[key] = { cats: [], items: [], del: {}, ot: 0 });
    const i = e.items.findIndex(x => x.id === d.id);
    d.t = rkNow(Math.max(i < 0 ? 0 : e.items[i].t, e.del[d.id] || 0));
    if (i < 0) e.items.push(d);
    else if (e.items[i].cat === d.cat) e.items[i] = d;
    else { e.items.splice(i, 1); e.items.push(d); }       // カテゴリーを変えたら移動先の末尾へ
    rkFixCats(e);
    rk.closed.delete(key + '\n' + d.cat); rkSaveClosed();
    save();
    return d.id;
  }
  function rkSubmit() {
    if (!rk.form || !state.edit) return;
    const d = rk.form.draft, err = rkValidate(d);
    if (err) { showToast(err); return; }
    const e = state.rankings[rk.form.key];
    const same = e && e.items.some(x => x.id !== d.id && x.cat === d.cat.trim() && x.name === d.name.trim() && x.type === d.type && x.year === d.year.trim());
    if (same && !confirm('同じ項目・指標・統計年のランキングがあります。別の項目として保存しますか？')) return;
    const isNew = !d.id;
    const id = rkCommitForm();
    rk.form = null;
    renderRank();
    const card = $('rank-body').querySelector(`.rk-card[data-id="${id}"]`);
    if (card) card.scrollIntoView({ block: 'nearest' });
    showToast(isNew ? 'ランキングを追加しました' : 'ランキングを保存しました');
  }
  function rkCancelForm() {
    if (!rk.form) return;
    if (rk.form.dirty && !confirm('入力中の内容を破棄しますか？')) return;
    const top = rk.form.listTop;
    rk.form = null;
    renderRank();
    $('rank-body').scrollTop = top;
  }
  // そのカテゴリーの候補：初期候補＋どこかの国で自分が追加した独自の項目名
  function rkCandidates(cat) {
    const p = RK_PRESETS.find(c => c.name === cat);
    const own = Object.values(state.rankings).flatMap(e => e.items.filter(i => i.cat === cat).map(i => i.name));
    return [...new Set([...(p ? p.items : []), ...own])];
  }
  function rkAllCats() {
    return [...new Set([...RK_CATS, ...Object.values(state.rankings).flatMap(e => e.cats)])];
  }
  function rkRenderForm() {
    const root = $('rank-body'), f = rk.form, d = f.draft;
    root.innerHTML = '';
    const touch = () => { f.dirty = true; };
    const field = (label, ...kids) => h('div', { class: 'memo-section' }, h('label', {}, label), ...kids);
    const input = (prop, placeholder, max, extra) => h('input', {
      type: 'text', id: 'rk-f-' + prop, value: d[prop], placeholder, maxlength: max, autocomplete: 'off', 'aria-label': placeholder, ...(extra || {}),
      oninput: ev => { d[prop] = ev.target.value; touch(); if (prop === 'name') mark(); }
    });

    // カテゴリー
    const cats = rkAllCats();
    let custom = !cats.includes(d.cat);
    const catInput = h('input', { type: 'text', id: 'rk-f-newcat', class: custom ? '' : 'hidden', value: custom ? d.cat : '', placeholder: '新しいカテゴリー名', maxlength: 40, 'aria-label': '新しいカテゴリー名', oninput: ev => { d.cat = ev.target.value; touch(); } });
    const sel = h('select', { id: 'rk-f-cat', 'aria-label': 'カテゴリー' },
      ...cats.map(c => h('option', { value: c }, c)), h('option', { value: RK_NEW }, '＋ 新しいカテゴリー…'));
    sel.value = custom ? RK_NEW : d.cat;
    sel.addEventListener('change', () => {
      custom = sel.value === RK_NEW;
      d.cat = custom ? catInput.value : sel.value;
      catInput.classList.toggle('hidden', !custom);
      if (!f.typeTouched) setType(RK_GOODS.has(d.cat) ? '生産量' : 'その他');
      touch(); chips();
      if (custom) catInput.focus();
    });

    // 品目・指標名
    const chipBox = h('div', { class: 'rk-chips' });
    const mark = () => chipBox.querySelectorAll('button').forEach(b => b.classList.toggle('active', b.textContent === d.name));
    const nameInput = input('name', '候補から選ぶか、自由に入力', 60);
    const chips = () => {
      chipBox.innerHTML = '';
      rkCandidates(d.cat).forEach(n => chipBox.append(h('button', { type: 'button', onclick: () => { d.name = n; nameInput.value = n; touch(); mark(); } }, n)));
      chipBox.classList.toggle('hidden', !chipBox.children.length);
      mark();
    };

    // 指標の種類
    const seg = h('div', { class: 'seg flex1', id: 'rk-f-type' });
    const setType = t => { d.type = t; seg.querySelectorAll('button').forEach(b => { b.classList.toggle('active', b.textContent === t); b.setAttribute('aria-pressed', String(b.textContent === t)); }); };
    RK_TYPES.forEach(t => seg.append(h('button', { type: 'button', onclick: () => { f.typeTouched = true; touch(); setType(t); } }, t)));

    root.append(
      h('div', { class: 'cv-edhead' },
        h('strong', {}, d.id ? 'ランキングを編集' : 'ランキングを追加'),
        h('button', { class: 'chip-btn', type: 'button', id: 'rk-cancel', onclick: rkCancelForm }, 'キャンセル')),
      field('カテゴリー', sel, catInput),
      field('品目・指標名', nameInput, chipBox),
      field('指標の種類', seg),
      h('div', { class: 'rk-pair' },
        field('世界順位', h('div', { class: 'rk-withunit' }, input('rank', '例：1', 6, { inputmode: 'numeric' }), h('span', {}, '位'))),
        field('統計年', input('year', '例：2025', 20))),
      h('div', { class: 'rk-pair' },
        field('統計値', input('value', '例：12500', 60)),
        field('単位', input('unit', '例：万トン', 30))),
      field('出典', input('source', '例：FAOSTAT', 300)),
      field('補足説明（任意）', h('textarea', { id: 'rk-f-note', value: d.note, maxlength: 2000, placeholder: '覚えておきたいことなど', oninput: ev => { d.note = ev.target.value; touch(); } })),
      h('div', { class: 'rk-submit' }, h('button', { class: 'primary-btn', type: 'button', id: 'rk-save', onclick: rkSubmit }, d.id ? '変更を保存' : '登録する')));
    chips();
    setType(d.type);
  }

  function bindRank() {
    $('rk-tabs').addEventListener('click', ev => { const b = ev.target.closest('button'); if (b) rkSetTab(b.dataset.tab); });
  }

  /* =========================================================
   * 世界統計（唯一の統計データソース）＋ クイズ
   * ======================================================= */
  const STAT_FIELDS = [
    { id: 'crop', name: '農作物' },
    { id: 'livestock', name: '畜産物' },
    { id: 'mineral', name: '鉱物資源' },
    { id: 'industry', name: '工業製品' },
    { id: 'other', name: 'その他' }
  ];
  const STAT_METRICS = [
    { id: 'production', name: '生産量' },
    { id: 'export', name: '輸出量' },
    { id: 'import', name: '輸入量' }
  ];
  const METRIC_JA = { production: '生産量', export: '輸出量', import: '輸入量' };
  const FIELD_JA = Object.fromEntries(STAT_FIELDS.map(f => [f.id, f.name]));

  const st = {
    field: 'crop',
    itemId: null,
    metric: 'production',
    qMode: 'table',          // table | map
    qPool: [],
    qIdx: -1,
    qKey: null,
    qRevealed: false,
    quizMapOn: false
  };

  function seedInitialStats() {
    // 1品目=1項目。生産量・輸出量・輸入量は同一項目の中の指標として持つ
    // 数値は概数（学習用）。出典・年度付き。確認しづらいものは入れない
    const items = [
      { id: 'S_rice', name: '米', field: 'crop' },
      { id: 'S_wheat', name: '小麦', field: 'crop' },
      { id: 'S_maize', name: 'トウモロコシ', field: 'crop' },
      { id: 'S_soy', name: '大豆', field: 'crop' },
      { id: 'S_coffee', name: 'コーヒー豆', field: 'crop' },
      { id: 'S_cacao', name: 'カカオ豆', field: 'crop' },
      { id: 'S_tea', name: '茶', field: 'crop' },
      { id: 'S_sugarcane', name: 'サトウキビ', field: 'crop' },
      { id: 'S_cotton', name: '綿花', field: 'crop' },
      { id: 'S_palm', name: 'パーム油', field: 'crop' },
      { id: 'S_cattle', name: '牛（飼育頭数）', field: 'livestock' },
      { id: 'S_pig', name: '豚（飼育頭数）', field: 'livestock' },
      { id: 'S_chicken', name: '鶏（飼育羽数）', field: 'livestock' },
      { id: 'S_beef', name: '牛肉', field: 'livestock' },
      { id: 'S_milk', name: '牛乳', field: 'livestock' },
      { id: 'S_iron', name: '鉄鉱石', field: 'mineral' },
      { id: 'S_copper', name: '銅', field: 'mineral' },
      { id: 'S_bauxite', name: 'ボーキサイト', field: 'mineral' },
      { id: 'S_gold', name: '金', field: 'mineral' },
      { id: 'S_lithium', name: 'リチウム', field: 'mineral' },
      { id: 'S_ree', name: 'レアアース', field: 'mineral' },
      { id: 'S_steel', name: '粗鋼', field: 'industry' },
      { id: 'S_auto', name: '自動車', field: 'industry' },
      { id: 'S_semicon', name: '半導体', field: 'industry' },
      { id: 'S_cement', name: 'セメント', field: 'industry' }
    ];
    const data = {};
    const ranks = (list) => list.map((r, i) => ({ countryKey: r[0], value: String(r[1]), rank: i + 1 }));
    const put = (id, metric, unit, year, source, list) => {
      if (!data[id]) data[id] = {};
      data[id][metric] = { unit, year, source, ranks: ranks(list) };
    };

    // 農作物
    put('S_rice', 'production', '百万トン', '2022', 'FAOSTAT',
      [['CHN', '214'], ['IND', '135'], ['BGD', '57'], ['IDN', '55'], ['VNM', '43']]);
    put('S_wheat', 'production', '百万トン', '2022', 'FAOSTAT',
      [['CHN', '138'], ['IND', '108'], ['RUS', '102'], ['USA', '45'], ['FRA', '34']]);
    put('S_maize', 'production', '百万トン', '2022', 'FAOSTAT',
      [['USA', '349'], ['CHN', '277'], ['BRA', '116'], ['ARG', '60'], ['UKR', '26']]);
    put('S_soy', 'production', '百万トン', '2022', 'FAOSTAT',
      [['BRA', '153'], ['USA', '116'], ['ARG', '44'], ['CHN', '20'], ['IND', '12']]);
    put('S_soy', 'export', '百万トン', '2022', 'UN Comtrade / USDA',
      [['BRA', '79'], ['USA', '54'], ['ARG', '3'], ['PRY', '6'], ['CAN', '4']]);
    put('S_coffee', 'production', '千トン', '2022/23', 'ICO / USDA',
      [['BRA', '3700'], ['VNM', '1800'], ['COL', '1100'], ['IDN', '700'], ['ETH', '500']]);
    put('S_coffee', 'export', '千トン', '2022', 'ICO',
      [['BRA', '2400'], ['VNM', '1600'], ['COL', '700'], ['IDN', '400'], ['HND', '300']]);
    put('S_cacao', 'production', '千トン', '2022', 'FAOSTAT / ICCO',
      [['CIV', '2200'], ['GHA', '800'], ['IDN', '600'], ['ECU', '350'], ['CMR', '300']]);
    put('S_tea', 'production', '千トン', '2022', 'FAOSTAT',
      [['CHN', '3100'], ['IND', '1300'], ['KEN', '500'], ['LKA', '300'], ['TUR', '280']]);
    put('S_sugarcane', 'production', '百万トン', '2022', 'FAOSTAT',
      [['BRA', '724'], ['IND', '439'], ['CHN', '109'], ['THA', '92'], ['PAK', '88']]);
    put('S_cotton', 'production', '百万トン', '2022', 'USDA',
      [['CHN', '6.0'], ['IND', '5.3'], ['USA', '3.2'], ['BRA', '3.0'], ['PAK', '1.3']]);
    put('S_palm', 'production', '百万トン', '2022', 'USDA',
      [['IDN', '46'], ['MYS', '18'], ['THA', '3'], ['COL', '2'], ['NGA', '1']]);
    put('S_palm', 'export', '百万トン', '2022', 'USDA',
      [['IDN', '28'], ['MYS', '15'], ['THA', '1'], ['COL', '1'], ['PNG', '0.7']]);

    // 畜産
    put('S_cattle', 'production', '百万頭', '2022', 'FAOSTAT',
      [['BRA', '230'], ['IND', '190'], ['USA', '92'], ['CHN', '60'], ['ETH', '65']]);
    put('S_pig', 'production', '百万頭', '2022', 'FAOSTAT',
      [['CHN', '450'], ['USA', '75'], ['BRA', '43'], ['ESP', '34'], ['DEU', '22']]);
    put('S_chicken', 'production', '億羽', '2022', 'FAOSTAT',
      [['CHN', '52'], ['IDN', '38'], ['USA', '19'], ['BRA', '15'], ['PAK', '14']]);
    put('S_beef', 'production', '百万トン', '2022', 'FAOSTAT',
      [['USA', '12.7'], ['BRA', '10.4'], ['CHN', '7.2'], ['IND', '4.3'], ['ARG', '3.2']]);
    put('S_milk', 'production', '百万トン', '2022', 'FAOSTAT',
      [['IND', '221'], ['USA', '102'], ['PAK', '62'], ['CHN', '39'], ['BRA', '36']]);

    // 鉱物
    put('S_iron', 'production', '百万トン', '2022', 'USGS',
      [['AUS', '880'], ['BRA', '410'], ['CHN', '280'], ['IND', '250'], ['RUS', '95']]);
    put('S_iron', 'export', '百万トン', '2022', 'USGS / UN Comtrade',
      [['AUS', '870'], ['BRA', '340'], ['ZAF', '60'], ['CAN', '55'], ['UKR', '30']]);
    put('S_copper', 'production', '百万トン（鉱山）', '2022', 'USGS',
      [['CHL', '5.3'], ['PER', '2.4'], ['CHN', '1.9'], ['COD', '1.8'], ['USA', '1.3']]);
    put('S_bauxite', 'production', '百万トン', '2022', 'USGS',
      [['AUS', '100'], ['CHN', '90'], ['GIN', '85'], ['BRA', '32'], ['IND', '22']]);
    put('S_gold', 'production', 'トン', '2022', 'USGS',
      [['CHN', '330'], ['AUS', '320'], ['RUS', '300'], ['CAN', '200'], ['USA', '170']]);
    put('S_lithium', 'production', 'トン（金属換算）', '2023', 'USGS',
      [['AUS', '86000'], ['CHL', '44000'], ['CHN', '33000'], ['ARG', '9600'], ['BRA', '2600']]);
    put('S_ree', 'production', 'トン（REO）', '2023', 'USGS',
      [['CHN', '240000'], ['USA', '43000'], ['MMR', '38000'], ['AUS', '18000'], ['THA', '7100']]);

    // 工業
    put('S_steel', 'production', '百万トン', '2023', 'World Steel Association',
      [['CHN', '1019'], ['IND', '140'], ['JPN', '87'], ['USA', '81'], ['RUS', '76']]);
    put('S_auto', 'production', '万台', '2023', 'OICA',
      [['CHN', '3016'], ['USA', '1061'], ['JPN', '899'], ['IND', '585'], ['KOR', '424']]);
    put('S_semicon', 'production', '億ドル（売上）', '2023', 'SIA / 業界推計',
      [['TWN', ''], ['KOR', ''], ['USA', ''], ['JPN', ''], ['CHN', '']]);
    put('S_cement', 'production', '百万トン', '2022', 'USGS',
      [['CHN', '2100'], ['IND', '370'], ['VNM', '100'], ['USA', '95'], ['TUR', '85']]);

    state.stats = { v: 2, items: Object.fromEntries(items.map(i => [i.id, i])), data };
    syncStatsToCountryRankings();
    save();
  }

  function countryNameByKey(key) {
    if (typeof byKey !== 'undefined' && byKey && byKey.get) {
      const f = byKey.get(key);
      if (f) return f._name || key;
    }
    // フォールバック簡易表
    const map = {
      CHN: '中国', IND: 'インド', USA: 'アメリカ', BRA: 'ブラジル', RUS: 'ロシア',
      JPN: '日本', DEU: 'ドイツ', FRA: 'フランス', GBR: 'イギリス', ITA: 'イタリア',
      KOR: '韓国', IDN: 'インドネシア', VNM: 'ベトナム', COL: 'コロンビア', ETH: 'エチオピア',
      AUS: 'オーストラリア', ARG: 'アルゼンチン', UKR: 'ウクライナ', BGD: 'バングラデシュ',
      CHL: 'チリ', ZAF: '南アフリカ', CAN: 'カナダ', MEX: 'メキシコ', TUR: 'トルコ',
      SAU: 'サウジアラビア', IRN: 'イラン', NGA: 'ナイジェリア', PAK: 'パキスタン',
      THA: 'タイ', MYS: 'マレーシア', PHL: 'フィリピン', EGY: 'エジプト', ESP: 'スペイン',
      POL: 'ポーランド', NLD: 'オランダ', BEL: 'ベルギー', SWE: 'スウェーデン', NOR: 'ノルウェー'
    };
    return map[key] || key;
  }

  function openStatsPanel() {
    st.itemId = null;
    $('stats-list-view').classList.remove('hidden');
    $('stats-detail-view').classList.add('hidden');
    setPanel('stats');
    updateUI();
    renderStatsList();
  }
  function closeStatsPanel() {
    setPanel(null);
    updateUI();
  }

  function renderStatsList() {
    const list = $('stats-item-list');
    if (!list) return;
    list.innerHTML = '';
    const field = st.field;
    // 1品目=1ボタン。生産量・輸出量・輸入量は詳細で選択
    const items = Object.values(state.stats.items || {}).filter(i => i.field === field)
      .sort((a, b) => a.name.localeCompare(b.name, 'ja'));
    if (!items.length) {
      list.append(h('p', { class: 'note' }, 'この分野の統計項目はまだありません。'));
      return;
    }
    items.forEach(it => {
      const metrics = STAT_METRICS.filter(m => state.stats.data[it.id] && state.stats.data[it.id][m.id]);
      const chipRow = h('div', { class: 'stats-metric-chips' });
      if (metrics.length) {
        metrics.forEach(m => {
          chipRow.append(h('span', { class: 'stats-chip' }, m.name));
        });
      } else {
        chipRow.append(h('span', { class: 'stats-chip muted' }, 'データ未登録'));
      }
      const card = h('div', { class: 'rk-card stats-item-card', style: 'cursor:pointer' },
        h('div', { class: 'rk-card-main' },
          h('strong', {}, it.name),
          chipRow),
        state.edit ? h('div', { class: 'rk-card-acts' },
          h('button', { class: 'chip-btn', type: 'button', onclick: (ev) => { ev.stopPropagation(); editStatItem(it.id); } }, '編集'),
          h('button', { class: 'chip-btn danger', type: 'button', onclick: (ev) => { ev.stopPropagation(); deleteStatItem(it.id); } }, '削除')
        ) : null
      );
      card.addEventListener('click', () => openStatDetail(it.id));
      list.append(card);
    });
  }

  function openStatDetail(id) {
    st.itemId = id;
    $('stats-list-view').classList.add('hidden');
    $('stats-detail-view').classList.remove('hidden');
    const it = state.stats.items[id];
    $('stats-detail-title').textContent = it ? it.name : id;
    // 存在する指標だけタブ表示。複数ある場合は選択、1つならその指標のみ
    const available = STAT_METRICS.filter(m => state.stats.data[id] && state.stats.data[id][m.id]);
    if (available.length && !available.some(m => m.id === st.metric)) st.metric = available[0].id;
    const tabs = $('stats-metric-tabs');
    tabs.querySelectorAll('button').forEach(b => {
      const has = available.some(m => m.id === b.dataset.metric);
      b.style.display = has ? '' : 'none';
      b.classList.toggle('active', b.dataset.metric === st.metric);
    });
    renderStatRanks();
  }

  function renderStatRanks() {
    const root = $('stats-rank-list');
    if (!root || !st.itemId) return;
    root.innerHTML = '';
    const block = state.stats.data[st.itemId] && state.stats.data[st.itemId][st.metric];
    if (!block || !block.ranks || !block.ranks.length) {
      root.append(h('p', { class: 'note' }, 'この指標のデータはまだありません。'));
      return;
    }
    const meta = h('p', { class: 'note' },
      [block.unit && `単位: ${block.unit}`, block.year && `年度: ${block.year}`, block.source && `出典: ${block.source}`].filter(Boolean).join(' ／ ')
    );
    root.append(meta);
    const sorted = [...block.ranks].sort((a, b) => (a.rank || 999) - (b.rank || 999));
    sorted.forEach(r => {
      root.append(h('div', { class: 'rk-card' },
        h('div', { class: 'rk-card-main' },
          h('strong', {}, `${r.rank || '—'}位  ${countryNameByKey(r.countryKey)}`),
          h('small', {}, [r.value, block.unit].filter(Boolean).join(' '))),
        state.edit ? h('div', { class: 'rk-card-acts' },
          h('button', { class: 'chip-btn', type: 'button', onclick: () => editStatRank(r.countryKey) }, '編集'),
          h('button', { class: 'chip-btn danger', type: 'button', onclick: () => deleteStatRank(r.countryKey) }, '削除')
        ) : null
      ));
    });
  }

  function editStatItem(id) {
    const it = id ? state.stats.items[id] : null;
    const name = prompt('統計項目名', it ? it.name : '');
    if (name == null) return;
    const n = name.trim();
    if (!n) { showToast('名前を入力してください'); return; }
    const field = it ? it.field : st.field;
    if (!id) {
      id = 'S_' + uid();
      state.stats.items[id] = { id, name: n, field };
    } else {
      state.stats.items[id].name = n;
    }
    save();
    renderStatsList();
    if (st.itemId === id) $('stats-detail-title').textContent = n;
    showToast('保存しました');
  }

  function deleteStatItem(id) {
    const it = state.stats.items[id];
    if (!it || !confirm(`「${it.name}」を削除しますか？関連するランキングも消えます。`)) return;
    delete state.stats.items[id];
    delete state.stats.data[id];
    // 要復習からも除去
    state.quizReview = (state.quizReview || []).filter(k => !k.startsWith(id + '|'));
    if (st.itemId === id) {
      st.itemId = null;
      $('stats-list-view').classList.remove('hidden');
      $('stats-detail-view').classList.add('hidden');
    }
    save();
    renderStatsList();
    showToast('削除しました');
  }

  function editStatRank(countryKey) {
    if (!st.itemId) return;
    if (!state.stats.data[st.itemId]) state.stats.data[st.itemId] = {};
    if (!state.stats.data[st.itemId][st.metric]) {
      state.stats.data[st.itemId][st.metric] = { unit: '', year: '', source: '', ranks: [] };
    }
    const block = state.stats.data[st.itemId][st.metric];
    let r = block.ranks.find(x => x.countryKey === countryKey);
    if (!r) {
      const ck = countryKey || prompt('国コード（例: JPN, USA, CHN）', '');
      if (!ck) return;
      r = { countryKey: ck.trim().toUpperCase(), value: '', rank: block.ranks.length + 1 };
      block.ranks.push(r);
    }
    const rankStr = prompt('順位（数字）', String(r.rank || ''));
    if (rankStr == null) return;
    const val = prompt('数値（任意）', r.value || '');
    if (val == null) return;
    if (!block.unit) block.unit = prompt('単位（例: 百万トン）', block.unit || '') || '';
    if (!block.year) block.year = prompt('年度（例: 2022）', block.year || '') || '';
    if (!block.source) block.source = prompt('出典', block.source || '') || '';
    r.rank = parseInt(rankStr, 10) || r.rank;
    r.value = String(val).trim();
    block.ranks.sort((a, b) => (a.rank || 999) - (b.rank || 999));
    syncOneStatToCountry(st.itemId, st.metric);
    save();
    renderStatRanks();
    showToast('保存しました');
  }

  function deleteStatRank(countryKey) {
    const block = state.stats.data[st.itemId] && state.stats.data[st.itemId][st.metric];
    if (!block) return;
    if (!confirm('この国のデータを削除しますか？')) return;
    block.ranks = block.ranks.filter(r => r.countryKey !== countryKey);
    syncOneStatToCountry(st.itemId, st.metric);
    save();
    renderStatRanks();
  }

  // 世界統計 → 国別ランキングへ同期
  function syncOneStatToCountry(statId, metric) {
    const it = state.stats.items[statId];
    const block = state.stats.data[statId] && state.stats.data[statId][metric];
    if (!it || !block) return;
    const type = METRIC_JA[metric] || metric;
    const catMap = { crop: '農業・林業・水産業', livestock: '農業・林業・水産業', mineral: 'エネルギー・鉱産資源', industry: '工業・製造業', other: '貿易・経済' };
    const cat = catMap[it.field] || 'その他';
    (block.ranks || []).forEach(r => {
      const key = r.countryKey;
      if (!key) return;
      const e = state.rankings[key] || (state.rankings[key] = { cats: [], items: [], del: {}, ot: 0 });
      // 同じ品目・指標の既存を更新 or 追加
      let found = e.items.find(x => x.name === it.name && x.type === type);
      if (found) {
        found.rank = r.rank;
        found.value = r.value || '';
        found.unit = block.unit || '';
        found.year = block.year || '';
        found.source = block.source || '';
        found.cat = cat;
        found.t = rkNow(found.t);
      } else {
        e.items.push({
          id: 'R' + uid(), cat, name: it.name, type,
          rank: r.rank, value: r.value || '', unit: block.unit || '',
          year: block.year || '', source: block.source || '', note: '', t: rkNow(0)
        });
      }
      rkFixCats(e);
    });
  }
  function syncStatsToCountryRankings() {
    Object.keys(state.stats.data || {}).forEach(sid => {
      STAT_METRICS.forEach(m => {
        if (state.stats.data[sid][m.id]) syncOneStatToCountry(sid, m.id);
      });
    });
  }

  function bindStats() {
    $('btn-close-stats')?.addEventListener('click', closeStatsPanel);
    $('view-stats')?.addEventListener('click', openStatsPanel);
    $('stats-field-tabs')?.addEventListener('click', ev => {
      const b = ev.target.closest('button[data-field]');
      if (!b) return;
      st.field = b.dataset.field;
      $('stats-field-tabs').querySelectorAll('button').forEach(x => x.classList.toggle('active', x === b));
      renderStatsList();
    });
    $('stats-metric-tabs')?.addEventListener('click', ev => {
      const b = ev.target.closest('button[data-metric]');
      if (!b) return;
      st.metric = b.dataset.metric;
      $('stats-metric-tabs').querySelectorAll('button').forEach(x => x.classList.toggle('active', x === b));
      renderStatRanks();
    });
    $('btn-stats-back')?.addEventListener('click', () => {
      st.itemId = null;
      $('stats-list-view').classList.remove('hidden');
      $('stats-detail-view').classList.add('hidden');
      renderStatsList();
    });
    $('btn-add-stat-item')?.addEventListener('click', () => editStatItem(null));
    $('btn-add-stat-rank')?.addEventListener('click', () => editStatRank(null));
    $('btn-edit-stat-meta')?.addEventListener('click', () => st.itemId && editStatItem(st.itemId));
  }

  /* ---------- クイズ ---------- */
  function quizCandidates(reviewOnly) {
    const out = [];
    Object.keys(state.stats.items || {}).forEach(sid => {
      const it = state.stats.items[sid];
      STAT_METRICS.forEach(m => {
        const block = state.stats.data[sid] && state.stats.data[sid][m.id];
        if (!block || !block.ranks || block.ranks.length < 3) return; // 最低3か国
        const key = sid + '|' + m.id;
        if (reviewOnly && !(state.quizReview || []).includes(key)) return;
        out.push({ key, statId: sid, metric: m.id, item: it, block });
      });
    });
    return out;
  }

  function openQuizPanel() {
    clearQuizMapMode();
    $('quiz-home').classList.remove('hidden');
    $('quiz-play').classList.add('hidden');
    setPanel('quiz');
    updateUI();
    const n = quizCandidates(false).length;
    const nr = (state.quizReview || []).length;
    $('quiz-stats-count').textContent = `出題可能: ${n} 問 ／ 要復習: ${nr} 問`;
  }
  function closeQuizPanel() {
    clearQuizMapMode();
    setPanel(null);
    updateUI();
  }

  function startQuiz(reviewOnly) {
    st.qPool = quizCandidates(!!reviewOnly);
    if (!st.qPool.length) {
      showToast(reviewOnly ? '要復習の問題がありません' : '出題できる統計データが不足しています（各指標3か国以上必要）');
      return;
    }
    // シャッフル
    for (let i = st.qPool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [st.qPool[i], st.qPool[j]] = [st.qPool[j], st.qPool[i]];
    }
    st.qIdx = -1;
    $('quiz-home').classList.add('hidden');
    $('quiz-play').classList.remove('hidden');
    nextQuiz();
  }

  function nextQuiz() {
    st.qIdx++;
    if (st.qIdx >= st.qPool.length) {
      showToast('一通り出題しました');
      openQuizPanel();
      return;
    }
    // 連続同一を避ける（念のため）
    if (st.qIdx > 0 && st.qPool[st.qIdx].key === st.qPool[st.qIdx - 1].key && st.qIdx + 1 < st.qPool.length) {
      const t = st.qPool[st.qIdx];
      st.qPool[st.qIdx] = st.qPool[st.qIdx + 1];
      st.qPool[st.qIdx + 1] = t;
    }
    st.qKey = st.qPool[st.qIdx].key;
    st.qRevealed = false;
    renderQuizQuestion();
  }

  function renderQuizQuestion() {
    const q = st.qPool[st.qIdx];
    if (!q) return;
    $('quiz-field').textContent = FIELD_JA[q.item.field] || q.item.field;
    $('quiz-metric').textContent = METRIC_JA[q.metric] || q.metric;
    $('quiz-item-name').textContent = '？？？';
    $('quiz-result').classList.add('hidden');
    $('btn-quiz-reveal').classList.remove('hidden');
    $('quiz-answer-text').textContent = '';

    const sorted = [...q.block.ranks].sort((a, b) => (a.rank || 999) - (b.rank || 999)).slice(0, 5);
    const table = $('quiz-table-view');
    const mapV = $('quiz-map-view');
    if (st.qMode === 'map') {
      table.classList.add('hidden');
      if (mapV) mapV.classList.add('hidden'); // 独立地図は使わない
      // ホーム地図を色分け（ピン・落書きは非表示）
      applyQuizMapMode(sorted);
      // パネル内には短いヒント＋順位リストのみ
      table.classList.remove('hidden');
      table.innerHTML = '';
      table.append(h('p', { class: 'note' }, '地図上の色が濃いほど上位です（背景の地図を参照）'));
      const ol = h('ol', { class: 'quiz-rank-ol' });
      sorted.forEach(r => {
        ol.append(h('li', {}, `${countryNameByKey(r.countryKey)}　${[r.value, q.block.unit].filter(Boolean).join(' ')}`));
      });
      table.append(ol);
      if (q.block.year || q.block.source) {
        table.append(h('p', { class: 'note' }, [q.block.year && `${q.block.year}年`, q.block.source && `出典: ${q.block.source}`].filter(Boolean).join(' ／ ')));
      }
    } else {
      clearQuizMapMode();
      if (mapV) mapV.classList.add('hidden');
      table.classList.remove('hidden');
      table.innerHTML = '';
      const tbl = h('table', { class: 'quiz-table' });
      const thead = h('thead', {}, h('tr', {}, h('th', {}, '順位'), h('th', {}, '国'), h('th', {}, '数値')));
      const tbody = h('tbody');
      sorted.forEach(r => {
        tbody.append(h('tr', {},
          h('td', {}, String(r.rank || '—')),
          h('td', {}, countryNameByKey(r.countryKey)),
          h('td', {}, [r.value, q.block.unit].filter(Boolean).join(' '))
        ));
      });
      tbl.append(thead, tbody);
      table.append(tbl);
      if (q.block.year || q.block.source) {
        table.append(h('p', { class: 'note' }, [q.block.year && `${q.block.year}年`, q.block.source && `出典: ${q.block.source}`].filter(Boolean).join(' ／ ')));
      }
    }
  }

  // クイズ地図モード：メイン地図を使用。ピン・落書き・気候区分は非表示
  function applyQuizMapMode(ranks) {
    st.quizMapOn = true;
    document.getElementById('app')?.classList.add('quiz-map-mode');
    svgBase.select('.climate').classed('off', true);
    svgPins.style('display', 'none');
    [cBelow, cAbove, cTop].forEach(c => { if (c) c.style.display = 'none'; });
    const rankMap = Object.fromEntries((ranks || []).map(r => [r.countryKey, r.rank]));
    const colors = ['#1a1a1a', '#3a3a3a', '#5a5a5a', '#7a7a7a', '#9a9a9a'];
    svgBase.selectAll('.country')
      .classed('quiz-rank', d => !!rankMap[d._key])
      .style('fill', d => {
        const rk = rankMap[d._key];
        return rk ? colors[Math.min((rk || 1) - 1, 4)] : '#e8e8e8';
      });
  }
  function clearQuizMapMode() {
    if (!st.quizMapOn) return;
    st.quizMapOn = false;
    document.getElementById('app')?.classList.remove('quiz-map-mode');
    svgPins.style('display', null);
    [cBelow, cAbove, cTop].forEach(c => { if (c) c.style.display = ''; });
    svgBase.select('.climate').classed('off', !state.showClimate);
    svgBase.selectAll('.country')
      .classed('quiz-rank', false)
      .style('fill', null);
    if (typeof renderFills === 'function') renderFills();
    if (typeof renderPins === 'function') renderPins();
    if (typeof renderNotes === 'function') renderNotes();
    if (typeof redraw === 'function') try { redraw(); } catch (_) { /* noop */ }
  }

  function revealQuiz() {
    const q = st.qPool[st.qIdx];
    if (!q) return;
    st.qRevealed = true;
    $('quiz-item-name').textContent = q.item.name;
    $('quiz-answer-text').textContent = `正解: ${q.item.name}の${METRIC_JA[q.metric] || q.metric}`;
    $('quiz-result').classList.remove('hidden');
    $('btn-quiz-reveal').classList.add('hidden');
  }

  function quizMark(ok) {
    const key = st.qKey;
    if (!key) return;
    if (!ok) {
      if (!(state.quizReview || []).includes(key)) {
        state.quizReview = [...(state.quizReview || []), key];
        save();
      }
    } else {
      state.quizReview = (state.quizReview || []).filter(k => k !== key);
      save();
    }
    nextQuiz();
  }

  function bindQuiz() {
    $('btn-close-quiz')?.addEventListener('click', closeQuizPanel);
    $('view-quiz')?.addEventListener('click', openQuizPanel);
    $('quiz-mode-tabs')?.addEventListener('click', ev => {
      const b = ev.target.closest('button[data-qmode]');
      if (!b) return;
      st.qMode = b.dataset.qmode;
      $('quiz-mode-tabs').querySelectorAll('button').forEach(x => x.classList.toggle('active', x === b));
    });
    $('btn-quiz-start')?.addEventListener('click', () => startQuiz(false));
    $('btn-quiz-review')?.addEventListener('click', () => startQuiz(true));
    $('btn-quiz-reveal')?.addEventListener('click', revealQuiz);
    $('btn-quiz-end')?.addEventListener('click', openQuizPanel);
    $('btn-quiz-ok')?.addEventListener('click', () => quizMark(true));
    $('btn-quiz-ng')?.addEventListener('click', () => quizMark(false));
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
  const SYS_LAYERS = [
    { id: 'pins', name: 'ピン' },
    { id: 'equator', name: '赤道' },
    { id: 'tropics', name: '南回帰線と北回帰線' },
    { id: 'rivers', name: '河川' },
    { id: 'climate', name: '気候区分' }
  ];

  function renderLayers() {
    ensureOrder();
    const list = $('layer-list');
    list.innerHTML = '';

    SYS_LAYERS.forEach(sl => {
      const on = sl.id === 'rivers' ? state.showRivers
        : sl.id === 'climate' ? state.showClimate
        : state.guides[sl.id];
      const div = document.createElement('div');
      div.className = 'layer-item sys' + (on ? '' : ' off');
      div.dataset.sys = sl.id;
      let meta = '';
      if (sl.id === 'pins') meta = `ピン <b>${state.pins.length}</b> 件`;
      if (sl.id === 'climate') {
        meta = CLIMATE_LEGEND.map(g =>
          `<span class="clim-g">${g.g}</span> ` + g.items.map(([c, col]) =>
            `<span class="clim-chip"><i style="background:${col}"></i>${c}</span>`
          ).join('')
        ).join(' ');
      }
      div.innerHTML = `
        <button class="eye ${on ? '' : 'off'}" data-act="sys-eye" title="${on ? '非表示' : '表示'}" aria-label="表示切替">${on ? ICON.eye : ICON.eyeOff}</button>
        <div class="lbody"><div class="lname-static" style="font-weight:600">${esc(sl.name)}</div>${meta ? `<div class="lmeta clim-legend">${meta}</div>` : ''}</div>`;
      list.appendChild(div);
    });

    const sep = document.createElement('div');
    sep.className = 'layer-sep';
    sep.textContent = '描画レイヤー';
    list.appendChild(sep);

    // 挿入ライン（ドラッグ用）
    const line = document.createElement('div');
    line.id = 'layer-insert-line';
    line.className = 'layer-insert-line hidden';
    list.appendChild(line);

    const renderLayerRow = (layer, depth) => {
      const div = document.createElement('div');
      const active = layer.id === state.activeLayerId;
      const folderOn = layer.folderId && state.selectedFolderId === layer.folderId;
      div.className = 'layer-item'
        + (active ? ' active' : '')
        + (folderOn ? ' in-selected-folder' : '')
        + (layer.visible ? '' : ' off')
        + (depth ? ' in-folder' : '');
      div.dataset.id = layer.id;
      div.dataset.kind = 'layer';
      if (layer.folderId) div.dataset.folderId = layer.folderId;
      if (depth) div.style.marginLeft = '18px';
      const nLines = layer.strokes.filter(s => s.type === 'pen').length;
      const nFill = layer.fills.filter(f => f.kind === 'country').length;
      div.innerHTML = `
        <button class="eye ${layer.visible ? '' : 'off'}" data-act="eye" title="${layer.visible ? '非表示' : '表示'}" aria-label="表示切替">${layer.visible ? ICON.eye : ICON.eyeOff}</button>
        <div class="lbody">
          <input type="text" class="lname" value="${esc(layer.name)}" maxlength="40" ${state.edit ? '' : 'readonly'} />
          <div class="lmeta">線 <b>${nLines}</b> ・ 塗り <b>${nFill}</b> ・ スタンプ <b>${layer.stamps.length}</b> ・ 文字 <b>${layer.texts.length}</b> ・ メモ <b>${layer.notes.length}</b></div>
        </div>
        <div class="lactions edit-only">
          <button type="button" class="drag-handle" data-act="drag" title="長押し不要：ドラッグで並び替え">⠿</button>
          <button data-act="del" title="削除">${ICON.del}</button>
        </div>`;
      list.appendChild(div);
    };

    const renderFolderRow = (folder) => {
      const kids = layersInFolder(folder.id);
      const div = document.createElement('div');
      const sel = state.selectedFolderId === folder.id;
      div.className = 'layer-item folder'
        + (sel ? ' active' : '')
        + (folder.open ? ' open' : '')
        + (folder.visible === false ? ' off' : '');
      div.dataset.id = folder.id;
      div.dataset.kind = 'folder';
      const color = folderColor(folder.color);
      if (color) { div.classList.add('colored'); div.style.setProperty('--fc', color); }
      const picking = state.edit && state.colorFolderId === folder.id;
      if (picking) div.classList.add('picking');
      div.innerHTML = `
        <button class="eye ${folder.visible === false ? 'off' : ''}" data-act="folder-eye" title="${folder.visible === false ? '表示' : '非表示'}" aria-label="表示切替">${folder.visible === false ? ICON.eyeOff : ICON.eye}</button>
        <button class="fold-toggle" data-act="fold" title="${folder.open ? '閉じる' : '開く'}" aria-label="開閉">${folder.open ? '▼' : '▶'}</button>
        <div class="lbody">
          <input type="text" class="lname" value="${esc(folder.name)}" maxlength="40" ${state.edit ? '' : 'readonly'} data-folder="1" />
          <div class="lmeta">レイヤー <b>${kids.length}</b></div>
        </div>
        <div class="lactions edit-only">
          <button type="button" class="fcolor-btn" data-act="color" title="枠の色" aria-label="枠の色" aria-expanded="${picking}"><i></i></button>
          <button type="button" class="drag-handle" data-act="drag" title="ドラッグで並び替え">⠿</button>
          <button data-act="del" title="フォルダ解除">${ICON.del}</button>
        </div>`;
      if (picking) {
        div.insertAdjacentHTML('beforeend', `<div class="fcolor-row edit-only">
          <button type="button" class="fcolor-none${color ? '' : ' active'}" data-act="color-set" data-color="">指定なし</button>
          ${FOLDER_COLORS.map(c => `<button type="button" class="fcolor-dot${c === color ? ' active' : ''}" data-act="color-set" data-color="${c}" style="--dot:${c}" aria-label="枠の色 ${c}"></button>`).join('')}
          <label class="fcolor-custom">自由な色<input type="color" class="fcolor-input" value="${color || '#111111'}" /></label>
        </div>`);
      }
      list.appendChild(div);
      if (folder.open) kids.forEach(l => renderLayerRow(l, 1));
    };

    state.order.forEach(o => {
      if (o.t === 'folder') {
        const f = folderById(o.id);
        if (f) renderFolderRow(f);
      } else if (o.t === 'layer') {
        const l = state.layers.find(x => x.id === o.id);
        if (l && !l.folderId) renderLayerRow(l, 0);
      }
    });
  }

  function orderIndex(id, t) {
    return state.order.findIndex(o => o.id === id && o.t === t);
  }
  function moveOrder(id, t, dir) {
    const i = orderIndex(id, t);
    if (i < 0) return;
    const j = i + dir;
    if (j < 0 || j >= state.order.length) return;
    const tmp = state.order[i];
    state.order[i] = state.order[j];
    state.order[j] = tmp;
  }
  function putLayerInFolder(layerId, folderId) {
    const layer = state.layers.find(l => l.id === layerId);
    const folder = folderById(folderId);
    if (!layer || !folder) return;
    layer.folderId = folderId;
    state.order = state.order.filter(o => !(o.t === 'layer' && o.id === layerId));
    folder.open = true;
  }
  function takeLayerFromFolder(layerId, orderIdx) {
    const layer = state.layers.find(l => l.id === layerId);
    if (!layer) return;
    layer.folderId = null;
    state.order = state.order.filter(o => !(o.t === 'layer' && o.id === layerId));
    const item = { t: 'layer', id: layerId };
    if (orderIdx == null || orderIdx < 0) state.order.push(item);
    else state.order.splice(orderIdx, 0, item);
  }
  // 描画順を order / folder 内順に合わせて state.layers を並べ替え
  function syncLayersZOrder() {
    const next = [];
    const seen = new Set();
    state.order.forEach(o => {
      if (o.t === 'folder') {
        layersInFolder(o.id).forEach(l => { next.push(l); seen.add(l.id); });
      } else if (o.t === 'layer') {
        const l = state.layers.find(x => x.id === o.id);
        if (l) { next.push(l); seen.add(l.id); }
      }
    });
    state.layers.forEach(l => { if (!seen.has(l.id)) next.push(l); });
    state.layers = next;
  }

  $('layer-list').addEventListener('click', e => {
    const item = e.target.closest('.layer-item');
    if (!item) return;
    if (item.dataset.sys) {
      if (e.target.closest('button')) {
        const sid = item.dataset.sys;
        if (sid === 'rivers') {
          state.showRivers = !state.showRivers;
          svgLines.select('.rivers').classed('off', !state.showRivers);
        } else if (sid === 'climate') {
          state.showClimate = !state.showClimate;
          svgBase.select('.climate').classed('off', !state.showClimate);
          updateClimateLegend();
        } else {
          state.guides[sid] = !state.guides[sid];
          applyGuides();
          if (sid === 'pins' && !state.guides.pins && state.panel === 'pin') closeMemo();
        }
        save(); renderLayers();
      }
      return;
    }

    const kind = item.dataset.kind;
    const id = item.dataset.id;
    const btn = e.target.closest('button');
    const act = btn && btn.dataset.act;

    // 名前の入力欄をタップした時は再描画しない（再描画すると入力欄が作り直されて、キーボードが開かず名前を変更できない）
    if (state.edit && e.target.classList && e.target.classList.contains('lname')) return;
    // 色の欄の中（ボタン以外）は再描画しない（色の選択画面が閉じてしまうため）
    if (e.target.closest('.fcolor-row') && !btn) return;

    if (kind === 'folder') {
      const folder = folderById(id);
      if (!folder) return;
      if (act === 'folder-eye') {
        folder.visible = folder.visible === false ? true : false;
        save(); renderLayers(); renderFills(); redraw(); renderNotes();
        return;
      }
      if (act === 'color' && state.edit) {
        state.colorFolderId = state.colorFolderId === id ? null : id;
        renderLayers();
        return;
      }
      if (act === 'color-set' && state.edit) {
        folder.color = folderColor(btn.dataset.color);
        state.colorFolderId = null;
        save(); renderLayers();
        return;
      }
      if (act === 'fold') {
        folder.open = !folder.open;
        save(); renderLayers();
        return;
      }
      if (act === 'del' && state.edit) {
        const oi = orderIndex(id, 'folder');
        const kids = layersInFolder(id);
        kids.forEach(l => { l.folderId = null; });
        state.folders = state.folders.filter(f => f.id !== id);
        state.order = state.order.filter(o => !(o.t === 'folder' && o.id === id));
        const inserts = kids.map(l => ({ t: 'layer', id: l.id }));
        if (oi >= 0) state.order.splice(oi, 0, ...inserts);
        else state.order.push(...inserts);
        if (state.selectedFolderId === id) state.selectedFolderId = null;
        ensureOrder();
        save(); renderLayers();
        return;
      }
      // フォルダ選択（中のレイヤーは個別に選択可能のまま）
      if (!act) {
        state.selectedFolderId = id;
        renderLayers();
      }
      return;
    }

    const layer = state.layers.find(l => l.id === id);
    if (!layer) return;
    if (act === 'eye') {
      layer.visible = !layer.visible;
      save(); renderLayers(); renderFills(); redraw(); renderNotes();
        return;
    }
    if (act === 'del' && state.edit) {
      if (state.layers.length <= 1) { showToast('描画レイヤーは最低1つ必要です'); return; }
      if (!confirm(`レイヤー「${layer.name}」を削除しますか？`)) return;
      finalizeText();
      state.layers = state.layers.filter(l => l !== layer);
      state.order = state.order.filter(o => !(o.t === 'layer' && o.id === id));
      if (state.activeLayerId === layer.id) state.activeLayerId = state.layers[0].id;
      state.undo.length = 0; state.redo.length = 0; updateUndoButtons();
      save(); renderLayers(); renderFills(); redraw(); renderNotes();
      return;
    }
    if (!act) {
      state.selectedFolderId = layer.folderId || null;
      if (state.activeLayerId !== layer.id) {
        finalizeText();
        state.activeLayerId = layer.id;
      }
      renderLayers();
      }
  });

  // 自由な色：選びながら枠に反映する
  ['input', 'change'].forEach(type => $('layer-list').addEventListener(type, e => {
    if (!e.target.classList.contains('fcolor-input') || !state.edit) return;
    const item = e.target.closest('.layer-item'), folder = item && folderById(item.dataset.id);
    if (!folder) return;
    folder.color = folderColor(e.target.value);
    item.classList.toggle('colored', !!folder.color);
    item.style.setProperty('--fc', folder.color);
    item.querySelectorAll('.fcolor-row button').forEach(b => b.classList.toggle('active', b.dataset.color === folder.color));
    saveSoon();
  }));

  $('layer-list').addEventListener('change', e => {
    if (!e.target.classList.contains('lname') || !state.edit) return;
    const item = e.target.closest('.layer-item');
    if (!item) return;
    if (e.target.dataset.folder) {
      const folder = folderById(item.dataset.id);
      if (folder) { folder.name = e.target.value.trim() || 'フォルダ'; e.target.value = folder.name; save(); }
      return;
    }
    const layer = state.layers.find(l => l.id === item.dataset.id);
    if (layer) { layer.name = e.target.value.trim() || '無題'; e.target.value = layer.name; save(); }
  });

  /* ---- 長押しドラッグ：並び替え / フォルダ格納（iPadはtouch優先） ---- */
  let ld = null;
  const HOLD_MS = 400;
  const MOVE_CANCEL = 40;

  function clearDropUi() {
    document.querySelectorAll('.layer-item.drop-target').forEach(el => el.classList.remove('drop-target'));
    const line = $('layer-insert-line');
    if (line) { line.classList.add('hidden'); line.style.top = ''; }
  }
  function endLayerDrag() {
    if (!ld) return;
    clearTimeout(ld.expandT);
    clearTimeout(ld.holdT);
    clearTimeout(ld.claimT);
    ld._claiming = false;
    clearDropUi();
    if (ld._blockTouch) {
      document.removeEventListener('touchmove', ld._blockTouch, { passive: false });
      ld._blockTouch = null;
    }
    if (ld.rafId) { cancelAnimationFrame(ld.rafId); ld.rafId = 0; }       // 自動スクロール停止
    if (ld.ghost && ld.ghost.parentNode) ld.ghost.parentNode.removeChild(ld.ghost);
    const list = $('layer-list');
    if (list) {
      list.classList.remove('is-dragging');
      list.style.overflowY = '';
    }
    document.body.style.userSelect = '';
    document.body.style.webkitUserSelect = '';
    document.querySelectorAll('.layer-item.dragging').forEach(x => x.classList.remove('dragging'));
    ld = null;
  }
  function showInsertLine(list, y) {
    const line = $('layer-insert-line');
    if (!line || !list) return;
    const lr = list.getBoundingClientRect();
    line.classList.remove('hidden');
    line.style.top = (y - lr.top + list.scrollTop) + 'px';
  }
  function resolveDrop(clientX, clientY, dragId, dragKind) {
    const list = $('layer-list');
    if (!list) return null;
    const ghost = ld && ld.ghost;
    if (ghost) ghost.style.display = 'none';
    const el = document.elementFromPoint(clientX, clientY);
    if (ghost) ghost.style.display = '';
    const hit = el && el.closest && el.closest('.layer-item');
    if (!hit || hit.dataset.sys) return null;
    if (hit.dataset.id === dragId) return null;
    const rect = hit.getBoundingClientRect();
    const mid = rect.top + rect.height / 2;
    const kind = hit.dataset.kind;
    const id = hit.dataset.id;
    if (kind === 'folder') {
      const band = rect.height * 0.28;
      if (clientY > rect.top + band && clientY < rect.bottom - band) {
        return { mode: 'into', targetId: id, targetKind: 'folder' };
      }
      return { mode: clientY < mid ? 'before' : 'after', targetId: id, targetKind: 'folder' };
    }
    if (kind === 'layer') {
      return {
        mode: clientY < mid ? 'before' : 'after',
        targetId: id,
        targetKind: 'layer',
        folderId: hit.dataset.folderId || null
      };
    }
    return null;
  }
  function applyDrop(dragId, dragKind, drop) {
    if (!drop) return false;
    if (dragKind === 'layer') {
      const layer = state.layers.find(l => l.id === dragId);
      if (!layer) return false;
      if (drop.mode === 'into') {
        putLayerInFolder(dragId, drop.targetId);
        syncLayersZOrder();
        return true;
      }
      if (drop.targetKind === 'layer' && drop.folderId) {
        layer.folderId = drop.folderId;
        state.order = state.order.filter(o => !(o.t === 'layer' && o.id === dragId));
        const arr = state.layers.filter(l => l.id !== dragId);
        const targetLayer = state.layers.find(l => l.id === drop.targetId);
        const pos = arr.indexOf(targetLayer);
        if (pos < 0) arr.push(layer);
        else arr.splice(drop.mode === 'before' ? pos : pos + 1, 0, layer);
        state.layers = arr;
        return true;
      }
      layer.folderId = null;
      state.order = state.order.filter(o => !(o.t === 'layer' && o.id === dragId));
      let ti = drop.targetKind === 'folder'
        ? state.order.findIndex(o => o.t === 'folder' && o.id === drop.targetId)
        : state.order.findIndex(o => o.t === 'layer' && o.id === drop.targetId);
      if (ti < 0) state.order.push({ t: 'layer', id: dragId });
      else state.order.splice(drop.mode === 'before' ? ti : ti + 1, 0, { t: 'layer', id: dragId });
      syncLayersZOrder();
      return true;
    }
    if (dragKind === 'folder') {
      if (drop.mode === 'into') return false;
      state.order = state.order.filter(o => !(o.t === 'folder' && o.id === dragId));
      let ti = drop.targetKind === 'folder'
        ? state.order.findIndex(o => o.t === 'folder' && o.id === drop.targetId)
        : state.order.findIndex(o => o.t === 'layer' && o.id === drop.targetId);
      if (ti < 0) state.order.push({ t: 'folder', id: dragId });
      else state.order.splice(drop.mode === 'before' ? ti : ti + 1, 0, { t: 'folder', id: dragId });
      syncLayersZOrder();
      return true;
    }
    return false;
  }

  function xyFromEvent(e) {
    if (e.touches && e.touches[0]) return [e.touches[0].clientX, e.touches[0].clientY];
    if (e.changedTouches && e.changedTouches[0]) return [e.changedTouches[0].clientX, e.changedTouches[0].clientY];
    return [e.clientX, e.clientY];
  }

  function activateDrag(x, y) {
    if (!ld || ld.ready) return;
    ld.ready = true;
    const list = $('layer-list');
    if (list) list.classList.add('is-dragging');
    document.body.style.userSelect = 'none';
    document.body.style.webkitUserSelect = 'none';
    try { if (window.getSelection) window.getSelection().removeAllRanges(); } catch (err) {}
    // iOS: スクロールを止める
    ld._blockTouch = (ev) => { ev.preventDefault(); };
    document.addEventListener('touchmove', ld._blockTouch, { passive: false });
    if (ld.item) ld.item.classList.add('dragging');
    const g = ld.item.cloneNode(true);
    g.classList.add('layer-ghost');
    g.style.width = ld.item.offsetWidth + 'px';
    document.body.appendChild(g);
    ld.ghost = g;
    ld.ghost.style.left = x + 'px';
    ld.ghost.style.top = y + 'px';
    try { if (navigator.vibrate) navigator.vibrate(12); } catch (err) {}
    startAutoScroll();
  }

  /* ドラッグ中の自動スクロール：指が一覧の上端／下端に来たら一定速度でスクロール、離れたら即停止 */
  const AS_EDGE = 48;        // 端と判定する幅(px)
  const AS_SPEED = 420;      // スクロール速度(px/秒)・常に一定
  function startAutoScroll() {
    if (!ld) return;
    let last = performance.now();
    const tick = now => {
      if (!ld || !ld.ready) return;
      const dt = Math.min(now - last, 50) / 1000;
      last = now;
      const list = $('layer-list');
      if (list) {
        const r = list.getBoundingClientRect(), y = ld._ly;
        const dir = y <= r.top + AS_EDGE ? -1 : (y >= r.bottom - AS_EDGE ? 1 : 0);
        if (dir) {
          const before = list.scrollTop;
          list.scrollTop = before + dir * AS_SPEED * dt;
          if (list.scrollTop !== before) moveDrag(ld._lx, ld._ly);        // 動いた分、挿入位置を更新（レイヤーは指に追従）
        }
      }
      ld.rafId = requestAnimationFrame(tick);
    };
    ld.rafId = requestAnimationFrame(tick);
  }

  function moveDrag(x, y) {
    if (!ld || !ld.ready) return;
    ld.moved = true;
    ld._lx = x; ld._ly = y;
    if (ld.ghost) {
      ld.ghost.style.left = x + 'px';
      ld.ghost.style.top = y + 'px';
    }
    clearDropUi();
    const drop = resolveDrop(x, y, ld.id, ld.kind);
    ld.drop = drop;
    if (!drop) return;
    const list = $('layer-list');
    if (drop.mode === 'into') {
      const hit = list && list.querySelector(`.layer-item[data-kind="folder"][data-id="${drop.targetId}"]`);
      if (hit) {
        hit.classList.add('drop-target');
        if (ld._exp !== drop.targetId) {
          ld._exp = drop.targetId;
          clearTimeout(ld.expandT);
          ld.expandT = setTimeout(() => {
            const f = folderById(drop.targetId);
            if (f && !f.open) { f.open = true; renderLayers(); }
          }, 400);
        }
      }
    } else {
      const hit = list && list.querySelector(`.layer-item[data-kind="${drop.targetKind}"][data-id="${drop.targetId}"]`);
      if (hit) {
        const rect = hit.getBoundingClientRect();
        showInsertLine(list, drop.mode === 'before' ? rect.top : rect.bottom);
      }
    }
  }

  function finishDrag(x, y) {
    if (!ld) return;
    clearTimeout(ld.holdT);
    const wasDrag = ld.ready && (ld.moved || ld.immediate);
    const dragId = ld.id, dragKind = ld.kind;
    let drop = ld.drop;
    if (wasDrag && !drop) drop = resolveDrop(x, y, dragId, dragKind);
    endLayerDrag();
    if (!wasDrag) return;
    if (applyDrop(dragId, dragKind, drop)) {
      save(); renderLayers(); renderFills(); redraw(); renderNotes();
    }
  }

  function canDragFromTarget(t) {
    if (!t || !state.edit) return null;
    const item = t.closest('.layer-item');
    if (!item || item.dataset.sys) return null;
    const kind = item.dataset.kind;
    if (kind !== 'layer' && kind !== 'folder') return null;
    const handle = t.closest('[data-act="drag"]');
    if (handle) return { item, immediate: true };
    // 行本体の長押し（ボタン・入力は除外）
    if (t.closest('button') || t.closest('input') || t.closest('.fcolor-row')) return null;
    return { item, immediate: false };
  }

  const listEl = () => $('layer-list');

  // --- Touch（iPad本体） ---
  document.addEventListener('touchstart', e => {
    if (!state.edit || state.panel !== 'layer') return;
    if (e.touches.length !== 1) return;
    const hit = canDragFromTarget(e.target);
    if (!hit) return;
    const item = hit.item;
    const [x, y] = xyFromEvent(e);
    endLayerDrag();
    ld = {
      id: item.dataset.id, kind: item.dataset.kind,
      x0: x, y0: y, _lx: x, _ly: y,
      moved: false, ready: false, _scrolled: false,
      ghost: null, drop: null, item, via: 'touch',
      _touchGuard: Date.now() + 1500,
      immediate: !!hit.immediate
    };
    if (hit.immediate) {
      // ハンドル：すぐにドラッグ開始（iPadで確実）
      activateDrag(x, y);
      return;
    }
    ld.claimT = setTimeout(() => {
      if (!ld || ld._scrolled || ld.ready) return;
      if (!ld._blockTouch) {
        ld._blockTouch = (ev) => { if (ld && (ld.ready || ld._claiming)) ev.preventDefault(); };
        ld._claiming = true;
        document.addEventListener('touchmove', ld._blockTouch, { passive: false });
      }
    }, 180);
    ld.holdT = setTimeout(() => {
      if (!ld || ld._scrolled) { endLayerDrag(); return; }
      activateDrag(ld._lx, ld._ly);
    }, HOLD_MS);
  }, { passive: true, capture: true });

  document.addEventListener('touchmove', e => {
    if (!ld || ld.via !== 'touch') return;
    const [x, y] = xyFromEvent(e);
    ld._lx = x; ld._ly = y;
    const dist = Math.hypot(x - ld.x0, y - ld.y0);
    if (!ld.ready) {
      if (dist > MOVE_CANCEL) {
        ld._scrolled = true;
        clearTimeout(ld.holdT);
        endLayerDrag();
      }
      return;
    }
    // ready 後は preventDefault は _blockTouch が担当
    moveDrag(x, y);
  }, { passive: true, capture: true });

  document.addEventListener('touchend', e => {
    if (!ld || ld.via !== 'touch') return;
    const [x, y] = xyFromEvent(e);
    finishDrag(x, y);
  }, { passive: true, capture: true });

  document.addEventListener('touchcancel', e => {
    if (!ld || ld.via !== 'touch') return;
    // 長押し確定後ならドロップ処理、前なら中止
    if (ld.ready) {
      const [x, y] = [ld._lx, ld._ly];
      finishDrag(x, y);
    } else {
      endLayerDrag();
    }
  }, { passive: true, capture: true });

  // iOS 長押しメニュー抑制
  document.addEventListener('contextmenu', e => {
    if (e.target.closest && e.target.closest('#layer-list')) e.preventDefault();
  });

  // --- Mouse（PC）※iPadのタッチ後の偽マウスイベントは無視 ---
  document.addEventListener('mousedown', e => {
    if (!state.edit || state.panel !== 'layer' || e.button !== 0) return;
    if (ld && ld.via === 'touch') return;
    if (ld && ld._touchGuard && Date.now() < ld._touchGuard) return;
    const hit = canDragFromTarget(e.target);
    if (!hit) return;
    const item = hit.item;
    endLayerDrag();
    ld = {
      id: item.dataset.id, kind: item.dataset.kind,
      x0: e.clientX, y0: e.clientY, _lx: e.clientX, _ly: e.clientY,
      moved: false, ready: false, _scrolled: false,
      ghost: null, drop: null, item, via: 'mouse',
      immediate: !!hit.immediate
    };
    if (hit.immediate) {
      activateDrag(e.clientX, e.clientY);
      return;
    }
    ld.holdT = setTimeout(() => {
      if (!ld || ld._scrolled) { endLayerDrag(); return; }
      activateDrag(ld._lx, ld._ly);
    }, HOLD_MS);
  });
  document.addEventListener('mousemove', e => {
    if (!ld || ld.via !== 'mouse') return;
    ld._lx = e.clientX; ld._ly = e.clientY;
    if (!ld.ready) {
      if (Math.hypot(e.clientX - ld.x0, e.clientY - ld.y0) > MOVE_CANCEL) {
        ld._scrolled = true;
        clearTimeout(ld.holdT);
        endLayerDrag();
      }
      return;
    }
    e.preventDefault();
    moveDrag(e.clientX, e.clientY);
  });
  document.addEventListener('mouseup', e => {
    if (!ld || ld.via !== 'mouse') return;
    finishDrag(e.clientX, e.clientY);
  });

  /* =========================================================
   * UI
   * ======================================================= */
  let swId = 0;
  // p: 模様オブジェクト / 'solid'（塗りつぶし） / null（なし）
  function swatch(p) {
    const id = 'sw' + (swId++);
    let body;
    if (p === 'solid') {
      body = `<rect x=".5" y=".5" width="29" height="29" rx="6" fill="${state.solidColor}"/>`;
    } else if (p) {
      body = `<defs><pattern id="${id}" patternUnits="userSpaceOnUse" width="${p.w}" height="${p.h}" style="color:${state.fillColor}">${p.body}</pattern></defs>
         <rect x=".5" y=".5" width="29" height="29" rx="6" fill="#fff"/>
         <rect x=".5" y=".5" width="29" height="29" rx="6" fill="url(#${id})"/>`;
    } else {
      body = '<rect x=".5" y=".5" width="29" height="29" rx="6" fill="#fff"/><path d="M7 7l16 16" stroke="#999" stroke-width="1.4" stroke-linecap="round"/>';
    }
    return `<svg viewBox="0 0 30 30" width="30" height="30">${body}<rect x=".5" y=".5" width="29" height="29" rx="6" fill="none" stroke="#bbb"/></svg>`;
  }

  function buildChips(el, opt, onPick) {
    el.innerHTML = '';
    const items = [];
    if (opt.none) items.push(null);
    if (opt.solid) items.push('solid');
    PATTERNS.forEach(p => items.push(p));
    items.forEach(p => {
      const b = document.createElement('button');
      const pid = p === null ? 'none' : p === 'solid' ? 'solid' : p.id;
      const name = p === null ? 'なし' : p === 'solid' ? '塗りつぶし' : p.name;
      b.className = 'pchip';
      b.dataset.pid = pid;
      b.title = name;
      b.setAttribute('aria-label', name);
      b.innerHTML = swatch(p) + `<span>${name}</span>`;
      b.onclick = () => onPick(pid);
      el.appendChild(b);
    });
  }
  const markChips = (el, ids) => el.querySelectorAll('.pchip').forEach(b => b.classList.toggle('active', ids.includes(b.dataset.pid)));

  function rebuildPatternChips() {
    // 塗りつぶしは「模様」と同時に選べる。模様は1つだけ（もう一度タップで解除）
    buildChips($('pattern-chips'), {}, pid => {
      state.pattern = state.pattern === pid ? null : pid;
      markChips($('pattern-chips'), state.pattern ? [state.pattern] : []);
    });
    $('btn-solid').innerHTML = swatch('solid');
    markChips($('pattern-chips'), state.pattern ? [state.pattern] : []);
  }

  function buildStampUI() {
    const seg = $('seg-cat');
    seg.innerHTML = '';
    CATS.forEach(c => {
      const b = document.createElement('button');
      b.dataset.cat = c.id; b.textContent = c.name;
      b.onclick = () => {
        state.stampCat = c.id;
        if (stampDef().cat !== c.id) state.stamp = STAMPS.find(s => s.cat === c.id).id;
        if (!LASSO_CATS.has(c.id)) state.stampMode = 'tap';
        state.lassoKey = null;
        renderStampPal(); updateUI(); renderHighlight();
      };
      seg.appendChild(b);
    });
    renderStampPal();
    setupStampMenu();
  }

  // --- スタンプ選択ボタン＋候補メニュー ---
  function renderStampPal() {
    const btn = $('btn-stamp-pick');
    if (!btn) return;
    if (state.stampPicked) {
      const st = stampDef();
      btn.classList.remove('empty');
      btn.innerHTML = `<img src="${spriteURL(st)}" alt="" /><span>${st.name}</span>`;
    } else {
      btn.classList.add('empty');
      btn.innerHTML = `<span class="stpick-none">スタンプ未選択</span>`;
    }
    btn.classList.toggle('open', !$('stamp-menu').classList.contains('hidden'));
  }

  function closeStampMenu() {
    $('stamp-menu').classList.add('hidden');
    $('stamp-backdrop').classList.add('hidden');
    renderStampPal();
  }

  function openStampMenu() {
    const menu = $('stamp-menu'), back = $('stamp-backdrop'), btn = $('btn-stamp-pick');
    menu.innerHTML = '';
    CATS.forEach(c => {
      const h = document.createElement('div');
      h.className = 'stm-head'; h.textContent = c.name;
      menu.appendChild(h);
      STAMPS.filter(st => st.cat === c.id).forEach(st => {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'stm-item' + (state.stampPicked && st.id === state.stamp ? ' active' : '');
        b.innerHTML = `<img src="${spriteURL(st)}" alt="" /><span>${st.name}</span>`;
        b.onclick = () => {
          state.stamp = st.id; state.stampCat = st.cat; state.stampPicked = true;
          if (!LASSO_CATS.has(st.cat)) state.stampMode = 'tap';
          state.lassoKey = null;
          closeStampMenu(); updateUI(); renderHighlight();
        };
        menu.appendChild(b);
      });
    });
    back.classList.remove('hidden');
    menu.classList.remove('hidden');
    // ボタンの下（足りなければ上）に配置。地図の表示位置には触れない
    const r = btn.getBoundingClientRect(), vh = window.innerHeight, gap = 8;
    const below = vh - r.bottom - gap - 12, above = r.top - gap - 12;
    menu.style.top = menu.style.bottom = '';
    if (below >= 260 || below >= above) { menu.style.top = (r.bottom + gap) + 'px'; menu.style.maxHeight = Math.max(160, below) + 'px'; }
    else { menu.style.bottom = (vh - r.top + gap) + 'px'; menu.style.maxHeight = Math.max(160, above) + 'px'; }
    const left = Math.max(12, Math.min(r.left, window.innerWidth - menu.offsetWidth - 12));
    menu.style.left = left + 'px';
    const act = menu.querySelector('.stm-item.active');
    if (act) menu.scrollTop = Math.max(0, act.offsetTop - menu.clientHeight / 2 + 40);
    else menu.scrollTop = 0;
    renderStampPal();
  }

  function setupStampMenu() {
    $('btn-stamp-pick').onclick = () => { $('stamp-menu').classList.contains('hidden') ? openStampMenu() : closeStampMenu(); };
    const back = $('stamp-backdrop');
    // 背景は押下を地図へ渡さず、離した時（click）に閉じる。押下時には閉じない（下の地図に click が抜けるのを防ぐ）
    ['pointerdown', 'pointerup', 'touchstart', 'wheel'].forEach(t => back.addEventListener(t, e => e.stopPropagation(), { passive: true }));
    back.addEventListener('click', e => { e.stopPropagation(); closeStampMenu(); });
    ['pointerdown', 'wheel'].forEach(t => $('stamp-menu').addEventListener(t, e => e.stopPropagation()));
    window.addEventListener('keydown', e => { if (e.key === 'Escape' && !$('stamp-menu').classList.contains('hidden')) closeStampMenu(); });
    window.addEventListener('resize', () => { if (!$('stamp-menu').classList.contains('hidden')) closeStampMenu(); });
  }

  function updateSizePreview() {
    if (!['pen', 'eraser', 'text'].includes(state.sub)) return;
    const key = sizeKey(), v = sizeVal(key), px = v * state.transform.k;
    const box = $('size-prev');
    // 表示は最小1〜最大100（内部サイズとは別の目盛り）
    const n = Math.max(1, Math.min(100, Math.round(+state.sizeT[key] || 1)));
    $('size-px').textContent = String(n);
    if (key === 'pen') {
      const d = clamp(px, 1.5, 42);
      box.innerHTML = `<i style="width:${d}px;height:${d}px;background:${state.sub === 'eraser' ? '#aaa' : state.color}"></i>`;
    } else {
      box.innerHTML = `<b style="font-size:${clamp(px, 7, 38)}px;color:${state.color}">あA</b>`;
    }
  }

  function hintText() {
    if (state.tool === 'pin') return '地図をタップしてピンを追加／ピンをタップして編集';
    if (state.tool === 'country') return '国をタップして国メモを編集';
    const lassoMsg = (what) => state.lassoScope === 'all'
      ? `${what} — 囲んだ範囲の陸地すべて`
      : (state.lassoKey ? `${what} — 選んだ国の中だけ（別の国はタップで選び直し）` : `${what} — まず対象の国をタップして選ぶ`);
    switch (state.sub) {
      case 'pen': return `ペン（国境の${state.side === 'above' ? '上' : '下'}${state.landOnly ? '・国上のみ' : ''}）— 1本指で描く／2本指で移動・拡大`;
      case 'eraser': return {
        normal: '消しゴム — 線と投げ縄塗りをなぞって消す', stroke: '線消し — 消したい線をなぞる',
        fill: '塗り消し — 国の塗りをなぞって消す', pin: 'ピン消し — なぞったピンが消えます', stamp: 'スタンプ消し — なぞって消す'
      }[state.eraser];
      case 'country-fill': return `国塗り — 国をタップして塗る（国境の${state.fillSide === 'above' ? '上' : '下'}・重ね塗りOK）`;
      case 'lasso': return lassoMsg('投げ縄') + `（国境の${state.fillSide === 'above' ? '上' : '下'}）`;
      case 'text': return state.textSel ? 'テキスト編集中 — 「移動」で動かせます。空のままだと削除されます' : 'テキスト — 地図をタップして文字を置く／文字をタップして編集';
      case 'note': return 'メモ — 地図をタップして小さなメモを追加／メモのボタンをタップして読む・編集';
      case 'stamp':
        if (lassoActive()) return lassoMsg('スタンプ') + '・敷き詰め';
        return stampLasso(stampDef()) ? 'スタンプ — 地図をタップして押す'
          : (state.overPin ? 'スタンプ — タップ（ピンの近くならピンの上に半透明で）' : 'スタンプ — 地図をタップして置く');
    }
    return '';
  }

  function updateUI() {
    const app = $('app');
    app.classList.toggle('edit', state.edit);
    $('lbl-edit').textContent = state.edit ? '完了' : '編集';
    $('bar-edit').classList.toggle('hidden', !state.edit);
    const drawBar = state.edit && state.tool === 'draw' && state.sub !== 'note';
    const toolKey = state.tool === 'draw' && state.sub === 'note' ? 'note' : state.tool;
    $('edit-badge').classList.toggle('hidden', !state.edit);
    $('bar-draw').classList.toggle('hidden', !drawBar);

    $('seg-tool').querySelectorAll('button').forEach(b => b.classList.toggle('active', b.dataset.tool === toolKey));
    $('seg-sub').querySelectorAll('button').forEach(b => b.classList.toggle('active', b.dataset.sub === state.sub));
    $('seg-side').querySelectorAll('button').forEach(b => b.classList.toggle('active', b.dataset.side === state.side));
    $('seg-eraser').querySelectorAll('button').forEach(b => b.classList.toggle('active', b.dataset.er === state.eraser));
    $('seg-cat').querySelectorAll('button').forEach(b => b.classList.toggle('active', b.dataset.cat === state.stampCat));
    $('seg-stampmode').querySelectorAll('button').forEach(b => b.classList.toggle('active', b.dataset.sm === state.stampMode));
    $('btn-landonly').classList.toggle('on', state.landOnly);
    $('view-pin').classList.toggle('active', state.viewTarget === 'pin' && state.panel !== 'stats' && state.panel !== 'quiz');
    $('view-country').classList.toggle('active', state.viewTarget === 'country' && state.panel !== 'stats' && state.panel !== 'quiz');
    const vs = $('view-stats'), vq = $('view-quiz');
    if (vs) vs.classList.toggle('active', state.panel === 'stats');
    if (vq) vq.classList.toggle('active', state.panel === 'quiz');

    const s = state.sub, agri = stampLasso(stampDef());
    const show = (id, v) => $(id).classList.toggle('hidden', !v);
    const lassoOn = lassoActive();
    const scopeCountry = state.lassoScope === 'country';
    $('seg-stampsize').querySelectorAll('button').forEach(b => b.classList.toggle('active', b.dataset.sz === state.stampSize));
    $('seg-scope').querySelectorAll('button').forEach(b => b.classList.toggle('active', b.dataset.scope === state.lassoScope));
    $('seg-fillside').querySelectorAll('button').forEach(b => b.classList.toggle('active', b.dataset.fs === (s === 'stamp' ? state.stampSide : state.fillSide)));
    $('btn-overpin').classList.toggle('on', state.overPin);
    show('opt-pen', s === 'pen');
    show('opt-eraser', s === 'eraser');
    show('opt-text', s === 'text');
    show('opt-stamp', s === 'stamp');
    show('seg-stampmode', s === 'stamp' && agri);
    show('btn-overpin', s === 'stamp' && !agri);
    show('opt-target', lassoOn);
    show('target-name', lassoOn && scopeCountry);
    show('opt-fillside', s === 'lasso' || s === 'country-fill' || (s === 'stamp' && (agri || !state.overPin)));
    show('opt-pattern', s === 'country-fill' || s === 'lasso');
    show('opt-width', s === 'pen' || (s === 'eraser' && state.eraser === 'normal') || s === 'text');
    $('width-label').textContent = s === 'eraser' ? '消しゴム' : s === 'text' ? '文字サイズ' : '太さ';
    $('size-slider').value = state.sizeT[sizeKey()];
    $('color-picker').value = state.color;
    $('text-color-picker').value = state.color;
    $('fill-color').value = state.fillColor;
    $('solid-color').value = state.solidColor;
    $('btn-solid').classList.toggle('active', state.solid);

    const tf = byKey.get(state.lassoKey);
    $('target-name').textContent = tf ? tf._name : '未選択（国をタップ）';
    $('target-name').classList.toggle('none', !tf);
    $('btn-target-clear').classList.toggle('hidden', !(lassoOn && scopeCountry && tf));

    markChips($('pattern-chips'), state.pattern ? [state.pattern] : []);
    container.classList.toggle('editing', state.edit);
    updateUndoButtons();
    if (drawBar) updateSizePreview();

    const hint = $('mode-hint');
    if (state.edit) { hint.textContent = hintText(); hint.classList.remove('hidden'); }
    else hint.classList.add('hidden');
    syncDock();
  }

  function syncDock() {
    const dock = $('dock');
    if (!dock) return;
    const barDraw = $('bar-draw');
    const toolbar = $('toolbar');
    const barEdit = $('bar-edit');
    // タブ部分の高さ（落書きバーは別扱い）
    let tabs = 0;
    if (toolbar) tabs += toolbar.getBoundingClientRect().height;
    if (barEdit && !barEdit.classList.contains('hidden')) tabs += barEdit.getBoundingClientRect().height;
    // dock の padding 分
    const cs = getComputedStyle(dock);
    tabs += (parseFloat(cs.paddingTop) || 0) + (parseFloat(cs.paddingBottom) || 0);
    if (tabs < 70) tabs = 70;
    document.documentElement.style.setProperty('--tabs-h', Math.ceil(tabs) + 'px');

    // 地図余白用：全体ドック高さ
    let full = dock.getBoundingClientRect().height;
    document.documentElement.style.setProperty('--dock-h', Math.ceil(full) + 'px');

    const lp = $('layer-panel');
    const open = lp && !lp.classList.contains('hidden') && state.panel === 'layer';
    if (open) {
      requestAnimationFrame(() => {
        const lh = lp.getBoundingClientRect().height || 0;
        document.documentElement.style.setProperty('--layer-h', Math.ceil(lh) + 'px');
        // 落書きバーが fixed のとき、dock 全体高さにバーを含めないよう再計算
        let base = tabs;
        document.documentElement.style.setProperty('--dock-h', Math.ceil(base + lh) + 'px');
      });
    } else {
      document.documentElement.style.setProperty('--layer-h', '0px');
    }
  }

  function setEdit(on) {
    if (state.edit === on) return;
    abortGesture();
    finalizeText();
    if (state.edit) save();
    closeMemo();
    state.edit = on;
    state.lassoKey = null;
    if (on) state.tool = 'pin';          // 編集を開くたびに「ピン」から始める
    updateUI();
    renderHighlight();
    if (state.panel === 'layer') renderLayers();
    if (!on) applyUpdate();
  }

  function setSub(sub) {
    abortGesture();
    finalizeText();
    state.sub = sub;
    state.lassoKey = null;
    updateUI();
    renderHighlight();
  }

  /* =========================================================
   * イベント
   * ======================================================= */
  function bind() {
    $('btn-edit').onclick = () => setEdit(!state.edit);
    $('view-pin').onclick = () => { if (state.viewTarget !== 'pin') { closeMemo(); state.viewTarget = 'pin'; updateUI(); } };
    $('view-country').onclick = () => { if (state.viewTarget !== 'country') { closeMemo(); state.viewTarget = 'country'; updateUI(); } };

    $('seg-tool').addEventListener('click', e => {
      const b = e.target.closest('button'); if (!b) return;
      abortGesture(); finalizeText(); closeMemo();
      const t = b.dataset.tool;
      if (t === 'note') { state.tool = 'draw'; state.sub = 'note'; }       // メモ＝落書き内のメモ機能（レイヤーごとに追加）
      else { state.tool = t; if (t === 'draw' && state.sub === 'note') state.sub = 'pen'; }
      state.lassoKey = null;
      updateUI(); renderHighlight();
    });
    $('seg-sub').addEventListener('click', e => { const b = e.target.closest('button'); if (b) setSub(b.dataset.sub); });
    $('seg-side').addEventListener('click', e => { const b = e.target.closest('button'); if (b) { state.side = b.dataset.side; updateUI(); } });
    $('seg-eraser').addEventListener('click', e => { const b = e.target.closest('button'); if (b) { abortGesture(); state.eraser = b.dataset.er; updateUI(); } });
    $('seg-stampmode').addEventListener('click', e => {
      const b = e.target.closest('button'); if (!b) return;
      state.stampMode = b.dataset.sm; state.lassoKey = null; updateUI(); renderHighlight();
    });
    $('seg-scope').addEventListener('click', e => {
      const b = e.target.closest('button'); if (!b) return;
      abortGesture(); state.lassoScope = b.dataset.scope; updateUI(); renderHighlight();
    });
    $('seg-fillside').addEventListener('click', e => {
      const b = e.target.closest('button'); if (!b) return;
      if (state.sub === 'stamp') state.stampSide = b.dataset.fs; else state.fillSide = b.dataset.fs;
      updateUI();
    });
    $('seg-stampsize').addEventListener('click', e => { const b = e.target.closest('button'); if (b) { state.stampSize = b.dataset.sz; updateUI(); } });
    $('btn-overpin').onclick = () => { state.overPin = !state.overPin; updateUI(); };
    $('btn-solid').onclick = () => { state.solid = !state.solid; updateUI(); };
    $('btn-landonly').onclick = () => { state.landOnly = !state.landOnly; updateUI(); };
    $('btn-clear-layer').onclick = clearActiveLayer;
    $('btn-target-clear').onclick = () => { state.lassoKey = null; updateUI(); renderHighlight(); };

    const setColor = v => { state.color = v; $('color-picker').value = v; $('text-color-picker').value = v; updateSizePreview(); };
    $('color-picker').oninput = e => setColor(e.target.value);
    $('text-color-picker').oninput = e => setColor(e.target.value);
    $('fill-color').oninput = e => { state.fillColor = e.target.value; rebuildPatternChips(); };
    $('solid-color').oninput = e => { state.solidColor = e.target.value; rebuildPatternChips(); };
    $('size-slider').oninput = e => {
      state.sizeT[sizeKey()] = +e.target.value;
      // テキスト入力中・選択中もサイズ変更を即反映
      if (state.textSel && sizeKey() === 'text') {
        state.textSel.t.size = sizeVal('text');
        positionEditor();
        redraw();
        saveSoon();
      }
      updateSizePreview();
    };

    $('btn-undo').onclick = undo;
    $('btn-redo').onclick = redo;

    $('btn-layers').onclick = toggleLayerPanel;
    $('btn-close-layers').onclick = () => setPanel(null);
    const btnAccount = $('btn-account');
    if (btnAccount) btnAccount.onclick = () => {
      if (state.panel === 'sync') setPanel(null);
      else { closeMemo(true); setPanel('sync'); renderSyncPanel(); }
    };
    $('btn-add-layer').onclick = () => {
      if (!state.edit) return;
      const l = blankLayer('新しいレイヤー');
      state.layers.unshift(l);
      state.order.unshift({ t: 'layer', id: l.id });
      state.activeLayerId = l.id;
      save(); renderLayers();
    };
    const addFolderBtn = $('btn-add-folder');
    if (addFolderBtn) addFolderBtn.onclick = () => {
      if (!state.edit) return;
      if (!Array.isArray(state.folders)) state.folders = [];
      if (!Array.isArray(state.order)) state.order = [];
      const f = blankFolder('フォルダ');
      state.folders.unshift(f);
      state.order.unshift({ t: 'folder', id: f.id });
      save(); renderLayers();
      showToast('フォルダを追加しました');
    };

    /* rivers toggle: layer panel fixed layers */
    $('btn-reset-view').onclick = () => { fitView(); applyTf(); };

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
    $('btn-save-pin').onclick = () => { if (!state.edit) return; save(); closeMemo(); };
    $('btn-delete-pin').onclick = () => {
      if (!state.edit) return;
      const p = curPin(); if (!p) return;
      if (p.title.trim() && !confirm(`ピン「${p.title}」を削除しますか？`)) return;
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

    $('btn-close-country').onclick = () => closeMemo();
    $('country-memo').addEventListener('input', () => {
      if (!state.selectedCountryKey || !state.edit) return;
      const en = cvEntry(true);
      en.memo = $('country-memo').value;
      renderCanvas();
      cvCommit();
    });
    $('btn-save-country').onclick = () => { if (!state.edit) return; save(); showToast('保存しました'); closeMemo(); };
    bindCanvas();
    bindRank();
    bindStats();
    bindQuiz();

    $('btn-close-note').onclick = () => closeMemo();
    $('note-text').addEventListener('input', () => {
      const o = curNote(); if (!o || !state.edit) return;
      o.n.text = $('note-text').value; saveSoon();
    });
    $('btn-save-note').onclick = () => { if (!state.edit) return; save(); closeMemo(); };
    $('btn-delete-note').onclick = () => {
      if (!state.edit) return;
      const o = curNote(); if (!o) return;
      o.layer.notes = o.layer.notes.filter(x => x !== o.n);
      state.selectedNoteId = null;
      save(); closeMemo(); renderNotes();
      showToast('メモを削除しました');
    };
    $('btn-export').onclick = () => {
      save();
      const backup = JSON.parse(localStorage.getItem(KEY) || '{}');
      backup.rankings = state.rankings;
      backup.stats = state.stats;
      backup.quizReview = state.quizReview;
      const blob = new Blob([JSON.stringify(backup)], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'world-notes-backup-' + new Date().toISOString().slice(0, 10) + '.json';
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    };
    $('btn-import').onclick = () => $('file-import').click();
    $('file-import').onchange = async e => {
      const f = e.target.files[0]; e.target.value = '';
      if (!f) return;
      try {
        const d = JSON.parse(await f.text());
        if (!d || typeof d !== 'object' || !Array.isArray(d.layers)) throw new Error('bad');
        if (!confirm('現在のデータをバックアップの内容に置き換えますか？')) return;
        const { rankings, stats, quizReview, ...notes } = d;
        localStorage.setItem(KEY, JSON.stringify(notes));
        if (rankings !== undefined) localStorage.setItem(RANK_KEY, JSON.stringify(cleanRankings(rankings)));   // 古いバックアップならランキングは残す
        if (stats !== undefined) localStorage.setItem(STATS_KEY, JSON.stringify(stats));
        if (quizReview !== undefined) localStorage.setItem(QUIZ_REVIEW_KEY, JSON.stringify(quizReview));
        markDirty();                          // 復元した内容は「上書き」でクラウドに保存する
        location.reload();
      } catch { showToast('バックアップファイルを読み込めませんでした'); }
    };
    $('btn-close-sync').onclick = () => setPanel(null);
    $('btn-sync-login').onclick = () => authAct('login');
    $('btn-sync-signup').onclick = () => authAct('signup');
    $('btn-sync-out').onclick = () => { if (sync.auth && confirm('ログアウトしますか？（この端末のデータは残ります）')) sync.auth.signOut(); };
    $('btn-sync-now').onclick = () => syncNow(true);
    $('btn-sync-force').onclick = async () => {
      if (!sync.on) { showToast('同期の準備中です。少し待ってからもう一度お試しください'); return; }
      if (sync.busy || sync.pulling) { showToast('同期処理中です…'); return; }
      if (!confirm('この端末の内容をクラウドに保存します。前に保存した内容は置き換わります。よろしいですか？')) return;
      save();
      markDirty();
      const ok = await push();
      showToast(ok ? '保存しました。他の端末は「今すぐ同期」でこの内容になります' : ('送信失敗：' + (sync.extra || sync.status)));
    };
    $('btn-update').onclick = () => { save(); location.reload(); };

    rebuildPatternChips();
    buildStampUI();
    bindText();

    window.addEventListener('keydown', e => {
      if (e.target.matches('input, textarea')) return;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && state.edit) { e.preventDefault(); e.shiftKey ? redo() : undo(); }
      else if (e.key === 'Escape') { abortGesture(); finalizeText(); closeMemo(); if (state.panel === 'layer' || state.panel === 'stats' || state.panel === 'quiz') setPanel(null); }
    });
    // 選択状態（青い反転）を出さない
    document.addEventListener('selectstart', e => { if (!e.target.closest || !e.target.closest('input, textarea')) e.preventDefault(); });

    window.addEventListener('resize', () => { size(); syncDock(); applyTf(); });
    if (window.ResizeObserver) new ResizeObserver(syncDock).observe($('dock'));
  }

  /* =========================================================
   * 端末間の同期（Firebase：メール+パスワード / Firestore）
   * ======================================================= */
  const SYNC_CH = 300000;
  const DEVICE = (() => {
    try { let d = localStorage.getItem('wn-device'); if (!d) { d = 'D' + uid(); localStorage.setItem('wn-device', d); } return d; } catch { return 'D' + uid(); }
  })();
  const lsGet = (k, def) => { try { const v = localStorage.getItem(k); return v === null ? def : v; } catch { return def; } };
  const lsSet = (k, v) => { try { localStorage.setItem(k, String(v)); } catch { /* noop */ } };
  const hhmm = () => new Date().toTimeString().slice(0, 5);

  function setSyncStatus(st, extra) { sync.status = st; sync.extra = extra || ''; renderSyncPanel(); }
  function renderSyncPanel() {
    const T = {
      unconfigured: '未設定です。firebase-config.js に Firebase の設定値を入れると使えます。',
      signedout: 'ログイン後、上書き（保存）と同期が使えます。どちらもボタンを押した時だけ行います。',
      ready: 'ログイン中。保存は「上書き」、受け取りは「今すぐ同期」を押してください。',
      syncing: '同期中…', ok: '同期済み ' + sync.extra,
      offline: 'オフラインです（オンラインにしてから「同期」を押してください）', error: '同期エラー：' + sync.extra
    };
    $('sync-status').textContent = T[sync.status] || '';
    $('sync-login').classList.toggle('hidden', !!sync.user || sync.status === 'unconfigured');
    $('sync-account').classList.toggle('hidden', !sync.user);
    $('sync-user').textContent = sync.user ? sync.user.email : '';
  }

  async function syncNow(toast) {
    if (!sync.user) {
      if (toast) showToast('先にログインしてください');
      setPanel('sync'); renderSyncPanel();
      return;
    }
    if (!sync.on || !sync.ref) {
      if (toast) showToast('同期の準備中です。少し待ってからもう一度');
      return;
    }
    if (sync.busy || sync.pulling) {
      if (toast) showToast('同期処理中です…');
      return;
    }
    try {
      save(); // 未保存分を確定
      setSyncStatus('syncing');
      const snap = await sync.ref.doc('head').get();
      const remote = snap.exists ? snap.data() : null;
      const say = m => { if (toast) showToast(m); };
      if (!remote) {
        setSyncStatus('ready');
        say('クラウドに保存がありません。先に「上書き」を押してください');
        return;
      }
      const dirty = lsGet('wn-sync-dirty', '0') === '1';
      if (remote.rev === sync.rev && !dirty) {
        setSyncStatus('ok', hhmm());
        say('すでに最新です');
        return;
      }
      // この端末だけの内容が消える場合は、先に確かめる
      if ((dirty || (!sync.rev && hasLocalData())) &&
          !confirm('この端末には、クラウドに保存していない内容があります。\nクラウドに保存された内容に置き換えると、その内容は消えます。置き換えますか？')) {
        setSyncStatus('ready');
        say('同期を中止しました');
        return;
      }
      await pullFrom(remote);
      say(sync.status === 'ok' ? 'クラウドの内容にしました' : '取り込みに失敗しました');
    } catch (e) {
      const msg = (e && e.message) || String(e);
      console.error('[syncNow]', e);
      setSyncStatus('error', msg);
      if (toast) showToast('同期エラー：' + msg);
    }
  }

  // クラウドへの保存は「上書き」だけ。ここでは「未保存」の印を付けるだけ
  function markDirty() { sync.ver++; lsSet('wn-sync-dirty', '1'); }

  const hasLocalData = () => state.pins.length || Object.keys(state.countries).length || state.folders.length || state.layers.length > 1 ||
    Object.values(state.rankings).some(e => e.items.length) ||
    state.layers.some(l => l.strokes.length || l.fills.length || l.stamps.length || l.texts.length || l.notes.length);

  async function push() {
    if (!sync.on || !sync.ref) return false;
    clearTimeout(sync.timer); sync.timer = null;
    sync.busy = true;
    setSyncStatus('syncing');
    const v = sync.ver;
    let ok = false;
    try {
      // 全角などは \uXXXX に（チャンク分割で文字が壊れないよう純ASCIIにする）
      const payload = {
        v: 5, pins: state.pins, layers: state.layers, folders: state.folders, order: state.order,
        countries: state.countries, guides: state.guides, showRivers: state.showRivers, showClimate: state.showClimate,
        rankings: state.rankings
      };
      const str = JSON.stringify(payload)
        .replace(/[\u007f-\uffff]/g, c => '\\u' + ('0000' + c.charCodeAt(0).toString(16)).slice(-4));
      const n = Math.max(1, Math.ceil(str.length / SYNC_CH));
      const rev = Math.max(Date.now(), (sync.rev || 0) + 1);
      // Firestore の batch は最大500操作 → 分割コミット
      const ops = [];
      for (let i = 0; i < n; i++) ops.push({ type: 'set', id: 'c' + i, data: { s: str.slice(i * SYNC_CH, (i + 1) * SYNC_CH) } });
      for (let i = n; i < (sync.lastN || 0); i++) ops.push({ type: 'delete', id: 'c' + i });
      ops.push({ type: 'set', id: 'head', data: { rev, n, by: DEVICE, at: Date.now() } });
      const MAX_BATCH = 400;
      for (let i = 0; i < ops.length; i += MAX_BATCH) {
        const b = sync.db.batch();
        const slice = ops.slice(i, i + MAX_BATCH);
        slice.forEach(op => {
          const ref = sync.ref.doc(op.id);
          if (op.type === 'delete') b.delete(ref);
          else b.set(ref, op.data);
        });
        await b.commit();
      }
      sync.rev = rev; sync.lastN = n; lsSet('wn-sync-rev', rev);
      if (sync.ver === v) lsSet('wn-sync-dirty', '0');
      ok = true;
      setSyncStatus('ok', hhmm());
    } catch (e) {
      const msg = (e && (e.code ? e.code + ': ' + e.message : e.message)) || String(e);
      console.error('[sync push]', e);
      setSyncStatus(navigator.onLine === false ? 'offline' : 'error', msg);
    } finally { sync.busy = false; }
    return ok;
  }

  const remoteBlocked = () => !!cur || !!lasso || !!state.textSel || ptrs.size > 0 || (g && g.type !== 'none') ||
    (state.edit && ['pin', 'country', 'note'].includes(state.panel));

  async function pullFrom(h) {
    if (sync.pulling) return;
    if (!h || !h.n) throw new Error('クラウドにデータがありません');
    sync.pulling = true;
    setSyncStatus('syncing');
    try {
      const docs = await Promise.all(Array.from({ length: h.n }, (_, i) => sync.ref.doc('c' + i).get()));
      if (docs.some(d => !d.exists)) throw new Error('データが揃っていません（再同期してください）');
      let raw = docs.map(x => x.data().s).join('');
      let d;
      try { d = JSON.parse(raw); }
      catch (e) { throw new Error('データの解析に失敗しました'); }
      while (remoteBlocked()) await new Promise(r => setTimeout(r, 800));
      if (!sync.on) return;
      finalizeText();
      state.selectedPinId = null; state.selectedCountryKey = null; state.selectedNoteId = null;
      if (['pin', 'country', 'note'].includes(state.panel)) setPanel(null);
      state.undo.length = 0; state.redo.length = 0;
      try { if (typeof mcache !== 'undefined' && mcache.clear) mcache.clear(); } catch (e) {}
      if (typeof invalidateStrokeCache === 'function') invalidateStrokeCache();
      applyData(d);
      saved = signature();
      lsSet(RANK_KEY, JSON.stringify(state.rankings));
      lsSet(KEY, JSON.stringify({
        v: 5, pins: state.pins, layers: state.layers, folders: state.folders, order: state.order,
        countries: state.countries, guides: state.guides, showRivers: state.showRivers, showClimate: state.showClimate
      }));
      sync.rev = h.rev; sync.lastN = h.n; lsSet('wn-sync-rev', h.rev); lsSet('wn-sync-dirty', '0');
      if (dataReady) {
        applyGuides();
        try {
          const clim = svgBase.select('.climate');
          if (!clim.empty()) clim.classed('off', !state.showClimate);
        } catch (e) {}
        if (typeof updateClimateLegend === 'function') updateClimateLegend();
        renderFills(); renderMemoMarks(); renderPins(); renderNotes(); redraw(); updateUI();
        if (state.panel === 'layer') renderLayers();
      }
      setSyncStatus('ok', hhmm());
    } catch (e) {
      console.error('[sync pull]', e);
      setSyncStatus('error', (e && e.message) || String(e));
      throw e;
    } finally { sync.pulling = false; }
  }

  async function startSync(user) {
    sync.user = user;
    sync.ref = sync.db.collection('users').doc(user.uid).collection('data');
    sync.rev = +lsGet('wn-sync-rev', '0') || 0;
    if (lsGet('wn-sync-user', '') !== user.uid) {
      sync.rev = 0;
      lsSet('wn-sync-rev', 0);
      lsSet('wn-sync-dirty', '0');
      lsSet('wn-sync-user', user.uid);
    }
    sync.on = true;
    // クラウドの監視はしない。保存は「上書き」、受け取りは「今すぐ同期」を押した時だけ
    setSyncStatus('ready');
  }

  function stopSync() {
    sync.on = false; sync.user = null; sync.ref = null;
    clearTimeout(sync.timer); sync.timer = null;
    setSyncStatus('signedout');
  }

  const loadScript = src => new Promise((res, rej) => {
    const el = document.createElement('script');
    el.src = src; el.onload = res; el.onerror = () => rej(new Error('Firebaseを読み込めません'));
    document.head.appendChild(el);
  });

  async function initSync() {
    const cfg = window.WN_FIREBASE;
    if (!cfg || !cfg.apiKey) { setSyncStatus('unconfigured'); return; }
    try {
      if (!window.firebase) {
        for (const f of ['app', 'auth', 'firestore']) await loadScript(`https://www.gstatic.com/firebasejs/10.12.2/firebase-${f}-compat.js`);
      }
      firebase.initializeApp(cfg);
      sync.auth = firebase.auth();
      sync.db = firebase.firestore();
      sync.auth.onAuthStateChanged(u => { if (u) startSync(u); else stopSync(); });
      window.addEventListener('online', () => { /* 自動同期なし */ });
      window.addEventListener('offline', () => { if (sync.on) setSyncStatus('offline'); });
    } catch (e) { setSyncStatus('error', e.message); }
  }

  const AUTH_MSG = {
    'auth/invalid-email': 'メールアドレスの形式が正しくありません', 'auth/user-not-found': 'このメールアドレスは未登録です',
    'auth/wrong-password': 'パスワードが違います', 'auth/invalid-credential': 'メールアドレスかパスワードが違います',
    'auth/email-already-in-use': 'このメールアドレスは登録済みです（ログインしてください）',
    'auth/weak-password': 'パスワードは6文字以上にしてください', 'auth/network-request-failed': '通信できません'
  };
  async function authAct(kind) {
    if (!sync.auth) { showToast('同期が設定されていません'); return; }
    const email = $('sync-email').value.trim(), pass = $('sync-pass').value;
    if (!email || !pass) { showToast('メールアドレスとパスワードを入力してください'); return; }
    try {
      if (kind === 'signup') await sync.auth.createUserWithEmailAndPassword(email, pass);
      else await sync.auth.signInWithEmailAndPassword(email, pass);
      $('sync-pass').value = '';
    } catch (e) { showToast(AUTH_MSG[e.code] || ('ログインできません：' + (e.code || e.message))); }
  }

  /* =========================================================
   * 自動アップデート（再読み込みしなくても新版に切り替わる）
   * ======================================================= */
  async function checkUpdate() {
    if (location.protocol === 'file:' || navigator.onLine === false) return;
    try {
      const r = await fetch(new URL('app.js', location.href).href, { cache: 'no-store' });
      if (!r.ok) return;
      const m = /const BUILD = '([^']+)'/.exec(await r.text());
      if (!m || m[1] === BUILD) return;
      updateReady = m[1];
      applyUpdate();
    } catch { /* オフライン等は無視 */ }
  }
  const busy = () => state.edit || !!state.textSel || !!cur || !!lasso || ptrs.size > 0 || (g && g.type !== 'none');
  function applyUpdate() {
    if (!updateReady) return;
    let tried = null;
    try { tried = sessionStorage.getItem('wn-upd'); } catch { /* noop */ }
    if (!busy() && tried !== updateReady) {         // 操作中でなければ自動で切り替え（データは保存済み）
      save();
      try { sessionStorage.setItem('wn-upd', updateReady); } catch { /* noop */ }
      location.reload();
      return;
    }
    $('update-bar').classList.remove('hidden');
  }


  /* =========================================================
   * 地図データキャッシュ（見た目同じ・2回目以降を高速化）
   * ======================================================= */
  function idbOpenGeo() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open('world-notes-geo-v12', 1);
      req.onupgradeneeded = () => { try { req.result.createObjectStore('geo'); } catch (e) {} };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }
  async function idbGetGeo(key) {
    try {
      const db = await idbOpenGeo();
      return await new Promise((resolve, reject) => {
        const r = db.transaction('geo', 'readonly').objectStore('geo').get(key);
        r.onsuccess = () => resolve(r.result || null);
        r.onerror = () => reject(r.error);
      });
    } catch { return null; }
  }
  async function idbSetGeo(key, val) {
    try {
      const db = await idbOpenGeo();
      await new Promise((resolve, reject) => {
        const tx = db.transaction('geo', 'readwrite');
        tx.objectStore('geo').put(val, key);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    } catch { /* ignore */ }
  }
  async function loadGeoCached(url, cacheKey) {
    const hit = await idbGetGeo(cacheKey);
    if (hit) return hit;
    const data = await d3.json(url);
    idbSetGeo(cacheKey, data);
    return data;
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
      const climateUrl = 'https://cdn.jsdelivr.net/gh/circleofconfusion/climate-map@master/topojson/1976-2000.geojson';
      const [countries, rivers, lakes, climate] = await Promise.all([
        loadGeoCached(base + 'ne_50m_admin_0_countries.geojson', 'ne50-countries-v1'),
        loadGeoCached(base + 'ne_50m_rivers_lake_centerlines.geojson', 'ne50-rivers-v1'),
        loadGeoCached(base + 'ne_50m_lakes.geojson', 'ne50-lakes-v1').catch(() => null),
        loadGeoCached(climateUrl, 'koppen-1976-2000-v1').catch(err => { console.warn('climate load failed', err); return null; })
      ]);
      prepareData(countries, rivers, lakes, climate);
    } catch (err) {
      console.error(err);
      $('loading').textContent = '地図データの読み込みに失敗しました。通信状況を確認して再読み込みしてください。';
      return;
    }
    buildMap();
    dataReady = true;
    fitView();
    renderFills();
    renderMemoMarks();
    renderPins();
    renderNotes();
    applyTf();
    $('loading').classList.add('hidden');
    updateClimateLegend();
    initSync();
    setTimeout(checkUpdate, 4000);
    setInterval(checkUpdate, 5 * 60 * 1000);
    document.addEventListener('visibilitychange', () => { if (!document.hidden) checkUpdate(); });
    window.addEventListener('focus', checkUpdate);
  }

  boot();
})();
