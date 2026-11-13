/* ============================== 아기 패러글라이딩 · 하늘 월드 (sky.js) ==============================
   index.html이 불러와 createSky(host)로 만든다. 렌더러 · 아기 · 진주 · 매점 · 토스트 · 소리 · 같이 놀기는 host 것을 그대로 쓴다.
   지형 · 마을 · 비행 규칙 · 탈것 수치는 체험판(아기 패러글라이딩 하늘 여행)을 그대로 옮겼다. */
import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.min.js';

/* ================= 조정용 상수 ================= */
export const PEARL_PER_SCORE = 10;          // 착륙 점수 ÷ 10 (반올림) = 진주
export const FLIGHT_TIME_PTS_MAX = 200;     // 비행 시간 점수는 10분(200점)까지만 쳐 줘요
export const BUS_PRICE = 5, PIGGY_PRICE = 3, SNACK_PRICE = 2;
export const BUS_SEATS = 10, BUS_AI_WAIT = 20;
export const VEH = [
  { id: 'stroller', name: '자동 유모차', icon: '👶', price: 20, speed: 13, climb: 0.6, desc: '누워서 하늘 보며 스르르~' },
  { id: 'kick', name: '킥보드', icon: '🛴', price: 30, speed: 16, climb: 0.55, desc: '씽씽~ 가볍게 출발' },
  { id: 'roller', name: '인라인 롤러', icon: '🛼', price: 50, speed: 18, climb: 0.55, desc: '발에 바퀴 달고 슝슝' },
  { id: 'bike', name: '자전거', icon: '🚲', price: 90, speed: 21, climb: 0.6, desc: '앞 바구니 달린 아기 자전거' },
  { id: 'moto', name: '배달 오토바이', icon: '🛵', price: 160, speed: 28, climb: 0.95, desc: '부릉부릉 동네 배달 오토바이' },
  { id: 'car', name: '빨간 오픈카', icon: '🚗', price: 300, speed: 34, climb: 1, desc: '뚜껑 열고 바람 맞으며 정상까지' },
  { id: 'tiller', name: '경운기', icon: '🚜', price: 40, speed: 14, climb: 1, desc: '탈탈탈~ 느리지만 오르막 끄떡없음' }];
export const VEHMAP = Object.fromEntries(VEH.map(v => [v.id, v]));
/* 날개 색: 무지개는 처음부터 있고, 나머지는 매점(장비 → 하늘 장비)에서 진주로 사요 */
export const WINGS = {
  rainbow: { name: '무지개', cols: ['#ff6b6b', '#ffa94d', '#ffd43b', '#69db7c', '#4dabf7', '#9775fa'], helmet: '#ffd43b' },
  berry: { name: '딸기', cols: ['#ff8fab', '#ffffff', '#ff8fab', '#ffc2d1'], helmet: '#ff8fab' },
  sky: { name: '하늘', cols: ['#4dabf7', '#ffffff', '#a5d8ff'], helmet: '#74c0fc' },
  lemon: { name: '레몬', cols: ['#ffd43b', '#ff922b', '#ffe066'], helmet: '#ff922b' },
  mint: { name: '민트', cols: ['#38d9a9', '#e6fcf5', '#96f2d7'], helmet: '#20c997' },
  starlight: { name: '별빛', cols: ['#3b3f8f', '#ffd43b', '#5c63c9', '#fff3bf'], helmet: '#5c63c9', stars: true }};

/* ================= 유틸 ================= */
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (e0, e1, x) => { let t = clamp((x - e0) / (e1 - e0), 0, 1); return t * t * (3 - 2 * t); };
const wrapA = a => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };
const lerpAngle = (a, b, t) => a + wrapA(b - a) * t;
function hash(x, z){ const h = Math.sin(x * 127.1 + z * 311.7) * 43758.5453; return h - Math.floor(h); }
function vnoise(x, z){ const xi = Math.floor(x), zi = Math.floor(z), xf = x - xi, zf = z - zi; const u = xf * xf * (3 - 2 * xf), v = zf * zf * (3 - 2 * zf);
  const a = hash(xi, zi), b = hash(xi + 1, zi), c = hash(xi, zi + 1), d = hash(xi + 1, zi + 1); return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v; }
function fbm(x, z){ let s = 0, a = 0.5, f = 1; for (let i = 0; i < 4; i++){ s += a * vnoise(x * f, z * f); f *= 2.03; a *= 0.5; } return s; }
let seed = 7; const rnd = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
const pick = a => a[Math.floor(Math.random() * a.length)];
const fmtT = s => { s = Math.max(0, Math.floor(s)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };
function segDist(px, pz, ax, az, bx, bz){ const vx = bx - ax, vz = bz - az, l2 = vx * vx + vz * vz; let t = l2 ? ((px - ax) * vx + (pz - az) * vz) / l2 : 0; t = clamp(t, 0, 1); return Math.hypot(px - ax - vx * t, pz - az - vz * t); }
const store = { get(k, d){ try { const v = localStorage.getItem('bpg_' + k); return v == null ? d : JSON.parse(v); } catch (e){ return d; } }, set(k, v){ try { localStorage.setItem('bpg_' + k, JSON.stringify(v)); } catch (e){} } };

/* ================= 지도: 단양 양방산 (체험판과 같은 수치) ================= */
export const MAP = { name: '단양 양방산 활공장', launchReal: 664, landReal: 140, trailKm: 3.52 };
const PAD = { x: 0, z: 24 }, LAND = { x: 90, z: 330 }, TOWN = { x: -170, z: 440 }, VIL = { x: 178, z: 312 };
const WATER = 0.6, WIND = { x: 0.5, z: -1.3 };
const HILLS = [[-560, 120, 90, 140], [560, -180, 110, 150], [-280, -600, 110, 160], [430, 780, 95, 140], [-680, 660, 80, 130], [150, -700, 100, 170]];
function riverZ(x){ return 430 + 170 * Math.sin((x - 80) * 0.0042); }
function riverDist(x, z){ const sl = 0.714 * Math.cos((x - 80) * 0.0042); return Math.abs(z - riverZ(x)) / Math.sqrt(1 + sl * sl); }
/* 고수대교 느낌의 다리: 강을 가로질러 단양읍과 착륙장 쪽을 이어요 (걸어서 건널 수 있음) */
const BR = (() => { const x = -40, z = riverZ(x), sl = 0.714 * Math.cos((x - 80) * 0.0042), n = Math.hypot(sl, 1); const dx = -sl / n, dz = 1 / n, half = 64;
  return { x, z, dx, dz, half, w: 3.7, top: 3.2, ang: Math.atan2(dx, dz), townEnd: [x + dx * half, z + dz * half], nearEnd: [x - dx * half, z - dz * half] }; })();
const toTownDir = (() => { const vx = BR.townEnd[0] - TOWN.x, vz = BR.townEnd[1] - TOWN.z, l = Math.hypot(vx, vz); return [vx / l, vz / l]; })();
const ROADS = [
  [BR.townEnd[0], BR.townEnd[1], TOWN.x + toTownDir[0] * 20, TOWN.z + toTownDir[1] * 20, 4.2],
  [BR.nearEnd[0], BR.nearEnd[1], LAND.x - 58, LAND.z - 12, 3.6],
  [LAND.x + 58, LAND.z - 14, VIL.x - 12, VIL.z - 4, 3.6],
  [VIL.x - 40, VIL.z - 14, LAND.x - 6, LAND.z - 44, 3.2]];
function mainH(x, z){ const r = Math.hypot(x, z), th = Math.atan2(x, z); const re = r * (1 + 0.14 * Math.sin(3 * th + 0.7) + 0.06 * Math.sin(7 * th + 2.1));
  return 170 * (0.45 * Math.exp(-((re / 150) ** 2)) + 0.55 * Math.pow(Math.max(0, 1 - re / 330), 1.6)); }
function baseH(x, z){
  let h = mainH(x, z) + 3.5;
  for (const [hx, hz, hh, hs] of HILLS) h += hh * Math.exp(-((x - hx) ** 2 + (z - hz) ** 2) / (hs * hs));
  const n = fbm(x * 0.012, z * 0.012);
  h += (n - 0.45) * (3 + 14 * smooth(0, 60, h));
  const R = Math.hypot(x, z);
  h += 250 * smooth(820, 1250, R) * (0.45 + 0.7 * fbm(x * 0.004 + 7.3, z * 0.004 + 3.1));
  const d = riverDist(x, z);
  const vf = smooth(260, 80, d); h = h * (1 - vf) + (2 + (n - 0.45) * 1.2) * vf;
  const lf = smooth(85, 52, Math.hypot(x - LAND.x, z - LAND.z)); h = h * (1 - lf) + 2.3 * lf;
  const vg = smooth(72, 46, Math.hypot(x - VIL.x, z - VIL.z)); h = h * (1 - vg) + 2.6 * vg;
  const tf = smooth(150, 108, Math.hypot(x - TOWN.x, z - TOWN.z)); h = h * (1 - tf) + 3 * tf;
  const cf = smooth(46, 26, d); h = h * (1 - cf) - 4 * cf;
  return h;
}
const PH = baseH(PAD.x, PAD.z) + 0.5;
function finalH(x, z){ const h = baseH(x, z); const pf = smooth(22, 13, Math.hypot(x - PAD.x, z - PAD.z)); return h * (1 - pf) + PH * pf; }
const toReal = y => Math.round(MAP.landReal + (y - 2.3) * (MAP.launchReal - MAP.landReal) / (PH - 2.3));

/* 높이 격자 (그려지는 지형과 똑같이) — 처음 들어올 때 한 번만 만든다 */
const WS = 2600, GN = 300, CELL = WS / GN, HALF = WS / 2, GW = GN + 1;
let HG = null;
function ensureGrid(){ if (HG) return; HG = new Float32Array(GW * GW); for (let j = 0; j < GW; j++) for (let i = 0; i < GW; i++) HG[j * GW + i] = finalH(-HALF + i * CELL, -HALF + j * CELL); }
function heightAt(x, z){
  const fx = clamp((x + HALF) / CELL, 0, GN - 1e-4), fz = clamp((z + HALF) / CELL, 0, GN - 1e-4);
  const i = Math.floor(fx), j = Math.floor(fz), tx = fx - i, tz = fz - j;
  const h00 = HG[j * GW + i], h10 = HG[j * GW + i + 1], h01 = HG[(j + 1) * GW + i], h11 = HG[(j + 1) * GW + i + 1];
  return (tx + tz <= 1) ? h00 + (h10 - h00) * tx + (h01 - h00) * tz : h11 + (h01 - h11) * (1 - tx) + (h10 - h11) * (1 - tz);
}
const onPad = (x, z) => Math.abs(x - PAD.x) < 12 && Math.abs(z - PAD.z - 1) < 9;
function onBridge(x, z){ const dx = x - BR.x, dz = z - BR.z; const lz = dx * BR.dx + dz * BR.dz, lx = dx * BR.dz - dz * BR.dx; return Math.abs(lx) < BR.w && Math.abs(lz) < BR.half; }
function groundAt(x, z){ if (onPad(x, z)) return PH + 0.12; const h = heightAt(x, z); if (onBridge(x, z)) return Math.max(h, BR.top); return Math.max(h, WATER - 0.55); }

/* 등산로: 착륙장 → 양방산 정상 (경사 25%로 산을 감아 오르는 길) */
function buildTrail(){
  const pts = [[LAND.x - 6, LAND.z - 44]]; let x = pts[0][0], z = pts[0][1]; const grade = 0.25, step = 2.5;
  for (let k = 0; k < 4000; k++){
    const dP = Math.hypot(x - PAD.x, z - PAD.z); if (dP < 7) break; let dx, dz;
    if (dP < 55){ dx = (PAD.x - x) / dP; dz = (PAD.z - z) / dP; }
    else { const e = 2, gx = (mainH(x + e, z) - mainH(x - e, z)) / (2 * e), gz = (mainH(x, z + e) - mainH(x, z - e)) / (2 * e);
      const gm = Math.hypot(gx, gz) + 1e-6, ux = gx / gm, uz = gz / gm, tx = -uz, tz = ux, s = Math.min(1, grade / gm), c = Math.sqrt(1 - s * s);
      dx = tx * c + ux * s; dz = tz * c + uz * s; }
    x += dx * step; z += dz * step; pts.push([x, z]);
  }
  const cum = [0]; for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  return { pts, cum, len: cum[cum.length - 1] };
}
const TRAIL = buildTrail();
function trailNearest(x, z){ let bi = 0, bd = 1e9; for (let i = 0; i < TRAIL.pts.length; i++){ const p = TRAIL.pts[i]; const d = (p[0] - x) ** 2 + (p[1] - z) ** 2; if (d < bd){ bd = d; bi = i; } } return { i: bi, d: Math.sqrt(bd) }; }
function trailAt(frac){ const L = frac * TRAIL.len; let i = 1; while (i < TRAIL.cum.length - 1 && TRAIL.cum[i] < L) i++; const a = TRAIL.pts[i - 1], b = TRAIL.pts[i]; const t = (L - TRAIL.cum[i - 1]) / Math.max(1e-6, TRAIL.cum[i] - TRAIL.cum[i - 1]);
  const x = lerp(a[0], b[0], t), z = lerp(a[1], b[1], t); const tx = b[0] - a[0], tz = b[1] - a[1], tl = Math.hypot(tx, tz) || 1; return { x, z, tx: tx / tl, tz: tz / tl }; }

const THERMALS = [
  { x: 20, z: 115, r: 50, s: 3.2, top: 300 }, { x: -170, z: 110, r: 52, s: 3.4, top: 320 }, { x: 190, z: -40, r: 48, s: 3.0, top: 290 },
  { x: -60, z: -230, r: 54, s: 3.6, top: 330 }, { x: 300, z: 170, r: 46, s: 2.8, top: 270 }];
function isRoad(x, z){
  const dt = Math.hypot(x - TOWN.x, z - TOWN.z); if (Math.abs(dt - 40) < 3.4 || Math.abs(dt - 78) < 4.2) return 1; if (dt < 26) return 2;
  if (Math.hypot(x - VIL.x, z - VIL.z) < 20) return 2;
  for (const r of ROADS) if (segDist(x, z, r[0], r[1], r[2], r[3]) < r[4]) return 1; return 0; }
const SHOP_POS = { x: 198, z: 298 }, SNACK_POS = { x: 174, z: 340 }, STOP_POS = { x: 144, z: 290 }, FRIEND_HOME = { x: 74, z: 290 };
const WINDDIR = Math.atan2(WIND.x, WIND.z);
/* 걸어서 등산 기록은 착륙장 쪽(정상에서 200 넘게, 해발 100 넘게 아래)에서 출발했을 때만 쳐요 */
const CLIMB_MIN_DIST = 200, CLIMB_MIN_DROP = 100;
/* 쉽게: 링은 크게(반지름 10, 13 안이면 통과), 다음 링·착륙 과녁 근처에서는 살짝 그쪽으로 이끌어 줘요 */
const RING_R = 10, RING_HIT = 13, RING_ASSIST = 75, LAND_ASSIST = 95, ACC_RANGE = 75;

/* ============================== 하늘 월드 만들기 ============================== */
export function createSky(H){
  const TOUCH = !!H.TOUCH;
  let scene = null, camera = null, skyDome = null, built = false;
  const M = c => new THREE.MeshLambertMaterial({ color: c });
  function canvasTex(w, h, draw){ const cv = document.createElement('canvas'); cv.width = w; cv.height = h; const g = cv.getContext('2d'); draw(g, w, h); const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t; }
  function roundRect(g, x, y, w, h, r){ g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
  function makeTag(text, bg = '#ffffff', fg = '#3b3a4a', w = 2.8){
    const mc = document.createElement('canvas').getContext('2d'); mc.font = 'bold 44px Jua, sans-serif'; const tw = Math.ceil(mc.measureText(text).width) + 48; const CW = Math.max(256, Math.min(2048, tw + 16));
    const tex = canvasTex(CW, 96, (g, W, Hh) => { g.font = 'bold 44px Jua, sans-serif'; g.fillStyle = bg; g.globalAlpha = .94; roundRect(g, (W - tw) / 2, 10, tw, 76, 38); g.fill(); g.globalAlpha = 1; g.fillStyle = fg; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, W / 2, 50); });
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true })); const k = w * 0.3 / 96; s.scale.set(CW * k, w * 0.3, 1); s.renderOrder = 10; STAGS.push(s); return s;
  }
  /* 여러 줄 말풍선: 긴 안내도 화면 밖으로 안 나가게 줄을 나눠 그린다 */
  function makeBubble(text, bg = '#ffffff', fg = '#3b3a4a'){
    const W = 620, pad = 30, fs = 40, mc = document.createElement('canvas').getContext('2d'); mc.font = `bold ${fs}px Jua, sans-serif`;
    const lines = []; let cur = ''; for (const ch of [...text]){ const t = cur + ch; if (mc.measureText(t).width > W - pad * 2 && cur){ const sp = cur.lastIndexOf(' '); if (sp > cur.length * 0.5){ lines.push(cur.slice(0, sp)); cur = cur.slice(sp + 1) + ch; } else { lines.push(cur); cur = ch; } } else cur = t; } if (cur) lines.push(cur);
    const tw = Math.min(W - pad * 2, Math.max(...lines.map(l => mc.measureText(l).width))) + pad * 2, Hh = lines.length * (fs + 12) + 44;
    const tex = canvasTex(W, Hh, (g, Wc, Hc) => { g.font = `bold ${fs}px Jua, sans-serif`; g.fillStyle = bg; g.globalAlpha = .96; const x0 = (Wc - tw) / 2; roundRect(g, x0, 4, tw, Hc - 26, 26); g.fill();
      g.beginPath(); g.moveTo(Wc / 2 - 14, Hc - 23); g.lineTo(Wc / 2, Hc - 4); g.lineTo(Wc / 2 + 14, Hc - 23); g.closePath(); g.fill(); g.globalAlpha = 1;
      g.fillStyle = fg; g.textAlign = 'center'; g.textBaseline = 'middle'; lines.forEach((l, i) => g.fillText(l, Wc / 2, 4 + 18 + (fs + 12) * (i + 0.5) - 6)); });
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true })); const k = 0.0068; s.scale.set(W * k, Hh * k, 1); s.center.set(0.5, 0); s.renderOrder = 11; return s;
  }
  function makeSign(lines, w = 6, h = 3, bg = '#7a5236'){
    const g = new THREE.Group(); const post = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.18, h + 1.4, 8), M('#6b4a2f')); post.position.y = (h + 1.4) / 2; g.add(post);
    const tex = canvasTex(512, Math.round(512 * h / w), (c, W, Hh) => { c.fillStyle = bg; roundRect(c, 4, 4, W - 8, Hh - 8, 26); c.fill(); c.strokeStyle = '#f5e6c8'; c.lineWidth = 8; roundRect(c, 14, 14, W - 28, Hh - 28, 18); c.stroke();
      c.fillStyle = '#fff8e8'; c.textAlign = 'center'; c.textBaseline = 'middle'; const fs = Math.min(64, Hh / (lines.length + 0.6)); lines.forEach((l, i) => { c.font = (i === 0 ? 'bold ' : '') + Math.round(fs * (i === 0 ? 1 : 0.78)) + 'px Jua, sans-serif'; c.fillText(l, W / 2, Hh / 2 + (i - (lines.length - 1) / 2) * fs * 1.05); }); });
    const wood = M('#6b4a2f'), face = new THREE.MeshLambertMaterial({ map: tex });
    const board = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.25), [wood, wood, wood, wood, face, face]); board.position.y = h / 2 + 1.2; g.add(board); return g;
  }
  function box(w, h, d, c, x = 0, y = 0, z = 0, par){ const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), typeof c === 'string' ? M(c) : c); m.position.set(x, y, z); if (par) par.add(m); return m; }
  function tube(a, b, r, c, par){ const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b); const l = A.distanceTo(B); const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, l, 8), typeof c === 'string' ? M(c) : c); m.position.copy(A).add(B).multiplyScalar(0.5); m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), B.clone().sub(A).normalize()); par.add(m); return m; }
  function wheel(r, w, par, x, y, z, hubC = '#e9ecef'){ const g = new THREE.Group(); g.position.set(x, y, z); const t = new THREE.Mesh(new THREE.CylinderGeometry(r, r, w, 18), M('#2d2d35')); t.rotation.z = Math.PI / 2; g.add(t);
    const h = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.5, r * 0.5, w + 0.02, 12), M(hubC)); h.rotation.z = Math.PI / 2; g.add(h); box(w + 0.03, r * 1.5, r * 0.22, hubC, 0, 0, 0, g); par.add(g); return { m: g, r }; }
  const COLL = []; let STAGS = [];
  function pushOut(o, rad){ for (const c of COLL){ const dx = o.x - c.x, dz = o.z - c.z, rr = c.r + rad, d2 = dx * dx + dz * dz; if (d2 < rr * rr){ const d = Math.sqrt(d2) || 0.001; o.x = c.x + dx / d * rr; o.z = c.z + dz / d * rr; } } }

  /* ---------- 하늘 · 빛 · 지형 · 강 ---------- */
  function buildBase(){
    const HORIZON = new THREE.Color('#d6eeff');
    scene.fog = new THREE.Fog(HORIZON, 380, 1750);
    scene.add(new THREE.HemisphereLight(0xe8f6ff, 0x6d8a52, 1.35));
    const sun = new THREE.DirectionalLight(0xfff0d8, 2.3); sun.position.set(-300, 520, 260); scene.add(sun);
    skyDome = new THREE.Mesh(new THREE.SphereGeometry(3500, 32, 16), new THREE.ShaderMaterial({ side: THREE.BackSide, depthWrite: false, fog: false,
      uniforms: { top: { value: new THREE.Color('#5aaef0') }, hor: { value: HORIZON.clone() } },
      vertexShader: 'varying vec3 vP;void main(){vP=normalize(position);gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
      fragmentShader: 'uniform vec3 top;uniform vec3 hor;varying vec3 vP;void main(){float h=clamp(vP.y*1.7+0.04,0.,1.);gl_FragColor=vec4(mix(hor,top,pow(h,0.65)),1.);\n#include <colorspace_fragment>\n}' }));
    skyDome.renderOrder = -1; scene.add(skyDome);
    /* 지형 (11월 단풍) */
    const pos = new Float32Array(GW * GW * 3), col = new Float32Array(GW * GW * 3); const c = new THREE.Color();
    const C = { grass: new THREE.Color('#9fd06a'), grass2: new THREE.Color('#86bf55'), field: new THREE.Color('#a8e070'), field2: new THREE.Color('#93d05e'),
      sand: new THREE.Color('#e8d7a6'), bed: new THREE.Color('#6f9fa6'), forest: new THREE.Color('#4f8a3c'), forest2: new THREE.Color('#3f7534'),
      orange: new THREE.Color('#e0782f'), red: new THREE.Color('#c9472f'), yellow: new THREE.Color('#e7b43c'), rock: new THREE.Color('#a39586'), far: new THREE.Color('#6e9a7c'),
      road: new THREE.Color('#bdb6a8'), plaza: new THREE.Color('#e6dcc6'), town: new THREE.Color('#b8d98a') };
    for (let j = 0; j < GW; j++) for (let i = 0; i < GW; i++){
      const k = j * GW + i, x = -HALF + i * CELL, z = -HALF + j * CELL, h = HG[k]; pos[k * 3] = x; pos[k * 3 + 1] = h; pos[k * 3 + 2] = z;
      const hx = (HG[j * GW + Math.min(GN, i + 1)] - HG[j * GW + Math.max(0, i - 1)]) / (2 * CELL), hz = (HG[Math.min(GN, j + 1) * GW + i] - HG[Math.max(0, j - 1) * GW + i]) / (2 * CELL);
      const slope = Math.hypot(hx, hz); const n = fbm(x * 0.03, z * 0.03), n2 = fbm(x * 0.018 + 100, z * 0.018 - 50); const d = riverDist(x, z); const rd = h > 0.4 ? isRoad(x, z) : 0;
      if (h < 0.4) c.copy(C.bed);
      else if (rd === 1) c.copy(C.road);
      else if (rd === 2) c.copy(C.plaza);
      else if (d < 58 && h < 3.6) c.copy(C.sand);
      else if (Math.hypot(x - LAND.x, z - LAND.z) < 60) c.copy((Math.floor((x + z * 0.3) / 7) & 1) ? C.field : C.field2);
      else if (Math.hypot(x - TOWN.x, z - TOWN.z) < 125 && h < 6) c.copy(C.town).lerp(C.grass2, n * 0.5);
      else if (h < 7) c.copy(C.grass).lerp(C.grass2, n);
      else {
        c.copy(C.forest).lerp(C.forest2, n);
        if (n2 > 0.5){ const a = C[['orange', 'red', 'yellow'][Math.floor(hash(Math.floor(x / 40), Math.floor(z / 40)) * 3)]]; c.lerp(a, smooth(0.5, 0.62, n2) * 0.85); }
        if (Math.hypot(x, z) > 800) c.lerp(C.far, 0.45);
        if (slope > 1.05) c.lerp(C.rock, smooth(1.05, 1.6, slope));
        if (h < 12) c.lerp(C.grass, smooth(12, 7, h));
      }
      col[k * 3] = c.r; col[k * 3 + 1] = c.g; col[k * 3 + 2] = c.b;
    }
    const idx = new Uint32Array(GN * GN * 6); let p = 0;
    for (let j = 0; j < GN; j++) for (let i = 0; i < GN; i++){ const a = j * GW + i, b = a + 1, cc = a + GW, dd = cc + 1; idx[p++] = a; idx[p++] = cc; idx[p++] = b; idx[p++] = b; idx[p++] = cc; idx[p++] = dd; }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    g.setIndex(new THREE.BufferAttribute(idx, 1)); g.computeVertexNormals();
    scene.add(new THREE.Mesh(g, new THREE.MeshLambertMaterial({ vertexColors: true })));
    const water = new THREE.Mesh(new THREE.PlaneGeometry(WS, WS), new THREE.MeshPhongMaterial({ color: '#4fb3d9', transparent: true, opacity: .86, shininess: 90, specular: 0xffffff }));
    water.rotation.x = -Math.PI / 2; water.position.y = WATER; scene.add(water);
    /* 등산로 띠 */
    { const P = TRAIL.pts, n = P.length, ps = [], ind = [];
      for (let i = 0; i < n; i++){ const a = P[Math.max(0, i - 1)], b = P[Math.min(n - 1, i + 1)]; let tx = b[0] - a[0], tz = b[1] - a[1]; const l = Math.hypot(tx, tz) || 1; tx /= l; tz /= l;
        const sx = -tz * 1.9, sz = tx * 1.9; const x = P[i][0], z = P[i][1];
        ps.push(x + sx, heightAt(x + sx, z + sz) + 0.28, z + sz, x - sx, heightAt(x - sx, z - sz) + 0.28, z - sz);
        if (i < n - 1){ const k = i * 2; ind.push(k, k + 2, k + 1, k + 1, k + 2, k + 3); } }
      const tg = new THREE.BufferGeometry(); tg.setAttribute('position', new THREE.Float32BufferAttribute(ps, 3)); tg.setIndex(ind); tg.computeVertexNormals();
      scene.add(new THREE.Mesh(tg, new THREE.MeshLambertMaterial({ color: '#dcb57c', side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }))); }
  }
  /* ---------- 나무 (InstancedMesh) ---------- */
  function buildTrees(){
    const N = TOUCH ? 1500 : 2200; const cone = new THREE.ConeGeometry(1.7, 5.2, 7); cone.translate(0, 4.0, 0);
    const ball = new THREE.IcosahedronGeometry(2.3, 1); ball.translate(0, 3.6, 0); const trunkG = new THREE.CylinderGeometry(0.32, 0.45, 1.8, 6); trunkG.translate(0, 0.9, 0);
    const mC = new THREE.InstancedMesh(cone, new THREE.MeshLambertMaterial({ color: 0xffffff }), N);
    const mB = new THREE.InstancedMesh(ball, new THREE.MeshLambertMaterial({ color: 0xffffff, flatShading: true }), N);
    const mT = new THREE.InstancedMesh(trunkG, M('#7b5638'), N * 2);
    const greens = ['#3f7a37', '#4c8c3c', '#2f6a35'].map(c => new THREE.Color(c)); const autumn = ['#e0782f', '#d24a2c', '#efb63a', '#c96a2a', '#6aa04a'].map(c => new THREE.Color(c));
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), v = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0); let nc = 0, nb = 0, nt = 0;
    for (let k = 0; k < 26000 && (nc < N || nb < N); k++){
      const x = (rnd() * 2 - 1) * 1150, z = (rnd() * 2 - 1) * 1150; const h = heightAt(x, z); if (h < 5) continue;
      if (riverDist(x, z) < 60) continue; if (Math.hypot(x - LAND.x, z - LAND.z) < 75) continue; if (Math.hypot(x - TOWN.x, z - TOWN.z) < 140) continue; if (Math.hypot(x - VIL.x, z - VIL.z) < 80) continue; if (Math.hypot(x - PAD.x, z - PAD.z) < 34) continue;
      if (Math.hypot(x - 14, z + 10) < 14) continue; if (isRoad(x, z)) continue;
      const tn = trailNearest(x, z); if (tn.d < 6) continue;
      const hx = heightAt(x + 2, z) - heightAt(x - 2, z), hz = heightAt(x, z + 2) - heightAt(x, z - 2); if (Math.hypot(hx, hz) / 4 > 1.3) continue;
      const n2 = fbm(x * 0.018 + 100, z * 0.018 - 50); const sc = 0.75 + rnd() * 0.7;
      q.setFromAxisAngle(up, rnd() * 6.28); s.set(sc, sc * (0.85 + rnd() * 0.4), sc); v.set(x, h - 0.3, z); m.compose(v, q, s);
      const useBall = (n2 > 0.48 && rnd() < 0.8) || rnd() < 0.25;
      if (useBall && nb < N){ mB.setMatrixAt(nb, m); mB.setColorAt(nb, autumn[Math.floor(rnd() * autumn.length)].clone().offsetHSL(0, 0, (rnd() - 0.5) * 0.08)); nb++; }
      else if (!useBall && nc < N){ mC.setMatrixAt(nc, m); mC.setColorAt(nc, greens[Math.floor(rnd() * 3)]); nc++; } else continue;
      if (nt < N * 2){ mT.setMatrixAt(nt++, m); }
    }
    mC.count = nc; mB.count = nb; mT.count = nt; [mC, mB, mT].forEach(o => { o.instanceMatrix.needsUpdate = true; if (o.instanceColor) o.instanceColor.needsUpdate = true; scene.add(o); });
  }

  /* ---------- 탈것 모양 (상표 없는 동네 탈것) — 둥근 몸체 · 타이어 · 휠 · 작은 소품까지 ---------- */
  let delivTex = null, plankTex = null, faceTex = null;
  const VMAT = {};
  const vmat = (c, o) => { const k = c + (o ? JSON.stringify(o) : ''); if (VMAT[k]) return VMAT[k]; const shiny = o && o.shiny; const p = Object.assign({ color: c }, o || {}); delete p.shiny;
    return (VMAT[k] = shiny ? new THREE.MeshPhongMaterial(Object.assign({ shininess: 70, specular: 0x444444 }, p)) : new THREE.MeshLambertMaterial(p)); };
  const PAINT = c => vmat(c, { shiny: true }), CHROME = () => vmat('#e9eef2', { shiny: true, shininess: 120, specular: 0xffffff }), RUBBER = () => vmat('#2b2b33');
  function vmesh(geo, mat, par, x = 0, y = 0, z = 0){ const m = new THREE.Mesh(geo, typeof mat === 'string' ? vmat(mat) : mat); m.position.set(x, y, z); if (par) par.add(m); return m; }
  /* 모서리가 둥근 상자 */
  function rbox(w, h, d, r, mat, par, x = 0, y = 0, z = 0){
    r = Math.min(r, w / 2 - 0.001, h / 2 - 0.001, d / 2 - 0.001); const s = new THREE.Shape(), a = w / 2 - r, b = h / 2 - r, c = Math.min(r * 0.6, a, b);
    s.moveTo(-a + c, -b); s.lineTo(a - c, -b); s.quadraticCurveTo(a, -b, a, -b + c); s.lineTo(a, b - c); s.quadraticCurveTo(a, b, a - c, b); s.lineTo(-a + c, b); s.quadraticCurveTo(-a, b, -a, b - c); s.lineTo(-a, -b + c); s.quadraticCurveTo(-a, -b, -a + c, -b);
    const g = new THREE.ExtrudeGeometry(s, { depth: Math.max(0.001, d - 2 * r), bevelEnabled: true, bevelThickness: r, bevelSize: r, bevelSegments: 3, curveSegments: 4 }); g.translate(0, 0, -(d - 2 * r) / 2);
    return vmesh(g, mat, par, x, y, z); }
  /* 두 점을 잇는 둥근 막대(끝에 공을 달아 이음매를 매끈하게) */
  function rod(a, b, r, mat, par, joints){ const m = tube(a, b, r, typeof mat === 'string' ? vmat(mat) : mat, par); if (joints) for (const p of [a, b]) vmesh(new THREE.SphereGeometry(r * 1.15, 10, 8), m.material, par, ...p); return m; }
  /* 바퀴: 도넛 타이어 + 휠 + 허브 (+자전거는 바큇살). 축은 X */
  function wheel2(r, w, par, x, y, z, o = {}){
    const g = new THREE.Group(); g.position.set(x, y, z); const tr = Math.min(w / 2, r * 0.32), R = r - tr;
    const tire = vmesh(new THREE.TorusGeometry(R, tr, o.lug ? 5 : 10, o.lug ? 14 : 28), RUBBER(), g); tire.rotation.y = Math.PI / 2;
    const rimC = o.rim || '#f1f3f5', rimM = o.chrome ? CHROME() : vmat(rimC, { shiny: true });
    if (o.spokes){ const rim = vmesh(new THREE.TorusGeometry(R - tr * 0.2, tr * 0.28, 6, 28), rimM, g); rim.rotation.y = Math.PI / 2;
      for (let i = 0; i < o.spokes; i++){ const a = i / o.spokes * Math.PI; const sp = vmesh(new THREE.CylinderGeometry(0.008, 0.008, (R - tr * 0.2) * 2, 4), vmat('#ced4da'), g); sp.rotation.x = a; }
      const hub = vmesh(new THREE.CylinderGeometry(r * 0.1, r * 0.1, w * 0.9, 10), vmat('#adb5bd'), g); hub.rotation.z = Math.PI / 2; }
    else { const disc = vmesh(new THREE.CylinderGeometry(R * 0.98, R * 0.98, w * 0.62, 20), rimM, g); disc.rotation.z = Math.PI / 2;
      const cap = vmesh(new THREE.CylinderGeometry(R * 0.36, R * 0.42, w * 0.78, 14), o.capC ? vmat(o.capC, { shiny: true }) : CHROME(), g); cap.rotation.z = Math.PI / 2;
      const ring = vmesh(new THREE.TorusGeometry(R * 0.78, tr * 0.22, 5, 24), o.chrome ? vmat('#adb5bd', { shiny: true }) : vmat('#ffffff', { shiny: true }), g); ring.rotation.y = Math.PI / 2; }
    par.add(g); return { m: g, r }; }
  /* 바퀴 덮개(흙받이): 바퀴 위를 감싸는 반원 띠 */
  function fender(r, w, c, par, x, y, z, from = 0.15, len = 0.7){ const f = vmesh(new THREE.CylinderGeometry(r, r, w, 18, 1, true, Math.PI * from, Math.PI * len), vmat(c, { shiny: true, side: THREE.DoubleSide }), par, x, y, z); f.rotation.z = Math.PI / 2; return f; }
  function light(par, x, y, z, r, c = '#fff8db', red){ const m = vmesh(new THREE.SphereGeometry(r, 12, 9), vmat(red ? '#ff4d4d' : c, { emissive: red ? '#c92a2a' : '#ffe08a', emissiveIntensity: 0.6 }), par, x, y, z); return m; }

  function makeSkate(){ const g = new THREE.Group(); const P0 = PAINT('#9775fa');
    rbox(0.3, 0.1, 0.5, 0.045, P0, g, 0, 0.01, 0); rbox(0.31, 0.14, 0.2, 0.06, P0, g, 0, 0.06, 0.15); rbox(0.31, 0.05, 0.5, 0.02, vmat('#ffffff'), g, 0, -0.04, 0);
    rbox(0.08, 0.07, 0.52, 0.02, CHROME(), g, 0, -0.08, 0);
    for (const z of [-0.18, -0.06, 0.06, 0.18]){ const w = vmesh(new THREE.CylinderGeometry(0.058, 0.058, 0.055, 14), vmat('#ffd43b', { shiny: true }), g, 0, -0.12, z); w.rotation.z = Math.PI / 2; const h = vmesh(new THREE.CylinderGeometry(0.022, 0.022, 0.065, 8), vmat('#f1f3f5'), g, 0, -0.12, z); h.rotation.z = Math.PI / 2; }
    rbox(0.07, 0.06, 0.08, 0.02, vmat('#ff8fab'), g, 0, -0.1, -0.28); return g; }

  function makeVehicle(id, add = true){
    if (!delivTex) delivTex = canvasTex(256, 200, (g, W, Hh) => { g.fillStyle = '#ffd43b'; g.fillRect(0, 0, W, Hh); g.fillStyle = '#ffffff'; roundRect(g, 18, 18, W - 36, Hh - 36, 26); g.fill(); g.fillStyle = '#e8603c'; g.font = 'bold 62px Jua, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('아기', W / 2, Hh * 0.37); g.fillText('배달', W / 2, Hh * 0.67); });
    if (!plankTex) plankTex = canvasTex(128, 128, (g, W, Hh) => { g.fillStyle = '#c8945a'; g.fillRect(0, 0, W, Hh); for (let i = 0; i < 4; i++){ g.fillStyle = i % 2 ? '#bd8a52' : '#d09c62'; g.fillRect(0, i * 32 + 2, W, 28); g.fillStyle = 'rgba(80,45,15,.35)'; g.fillRect(0, i * 32, W, 3); for (const x of [14, 108]){ g.beginPath(); g.arc(x, i * 32 + 16, 2.5, 0, 7); g.fill(); } } });
    const g = new THREE.Group(); const W = []; let seat = new THREE.Vector3(), pose = 'sit', camDist = 10, rad = 0.7;
    if (id === 'kick'){
      const body = PAINT('#ff7a59');
      rbox(0.42, 0.075, 1.12, 0.035, body, g, 0, 0.2, -0.04); rbox(0.34, 0.012, 0.9, 0.006, vmat('#3d3d46'), g, 0, 0.243, -0.06);
      fender(0.17, 0.12, '#ff7a59', g, 0, 0.13, -0.58, 0.38, 0.6);
      W.push(wheel2(0.13, 0.075, g, 0, 0.13, 0.58, { rim: '#ffd43b' }), wheel2(0.13, 0.075, g, 0, 0.13, -0.58, { rim: '#ffd43b' }));
      rod([0, 0.22, 0.5], [0, 0.32, 0.6], 0.035, CHROME(), g); for (const s of [-1, 1]) rod([s * 0.05, 0.13, 0.58], [s * 0.05, 0.36, 0.6], 0.018, CHROME(), g);
      rod([0, 0.34, 0.6], [0, 1.24, 0.5], 0.035, CHROME(), g); vmesh(new THREE.CylinderGeometry(0.055, 0.055, 0.12, 12), body, g, 0, 0.78, 0.55).rotation.x = -0.11;
      rod([-0.33, 1.24, 0.5], [0.33, 1.24, 0.5], 0.03, CHROME(), g, true);
      for (const s of [-1, 1]){ const k = vmesh(new THREE.CapsuleGeometry(0.045, 0.14, 4, 10), vmat('#ff8fab'), g, s * 0.41, 1.24, 0.5); k.rotation.z = Math.PI / 2;
        for (let i = 0; i < 3; i++){ const st = vmesh(new THREE.PlaneGeometry(0.03, 0.22), vmat(['#ffd43b', '#74c0fc', '#ff8fab'][i], { side: THREE.DoubleSide }), g, s * (0.5 + i * 0.008), 1.13, 0.5 - i * 0.01); st.rotation.z = s * (0.25 + i * 0.12); } }
      light(g, 0, 1.05, 0.57, 0.05); vmesh(new THREE.SphereGeometry(0.035, 10, 8), vmat('#ffd43b', { shiny: true }), g, 0.18, 1.29, 0.5);
      rod([0.14, 0.17, -0.3], [0.24, 0.02, -0.38], 0.012, vmat('#868e96'), g);
      seat.set(0, 0.21, -0.15); pose = 'kick'; camDist = 9.5; }
    else if (id === 'roller'){ seat.set(0, 0.12, 0); pose = 'skate'; camDist = 9.5; }
    else if (id === 'bike'){
      const fc = PAINT('#4dabf7'), acc = vmat('#ff8fab', { shiny: true });
      W.push(wheel2(0.42, 0.075, g, 0, 0.42, 0.64, { spokes: 10, rim: '#ffffff' }), wheel2(0.42, 0.075, g, 0, 0.42, -0.64, { spokes: 10, rim: '#ffffff' }));
      fender(0.48, 0.12, '#4dabf7', g, 0, 0.42, 0.64, 0.05, 0.55); fender(0.48, 0.12, '#4dabf7', g, 0, 0.42, -0.64, 0.45, 0.55);
      const R = [0, 0.42, -0.64], F = [0, 0.42, 0.64], BB = [0, 0.36, -0.04], S = [0, 0.9, -0.22], Hd = [0, 0.98, 0.42];
      rod(BB, S, 0.05, fc, g, true); rod(BB, [0, 0.82, 0.4], 0.055, fc, g, true); rod([0, 0.82, 0.4], Hd, 0.05, fc, g, true); rod(Hd, F, 0.035, CHROME(), g);
      for (const s of [-1, 1]){ rod([s * 0.06, 0.42, -0.64], [s * 0.04, 0.36, -0.04], 0.025, fc, g); rod([s * 0.06, 0.42, -0.64], [s * 0.03, 0.88, -0.2], 0.022, fc, g); }
      vmesh(new THREE.TorusGeometry(0.1, 0.022, 6, 18), CHROME(), g, 0.07, 0.36, -0.04).rotation.y = Math.PI / 2;
      for (const s of [-1, 1]){ rod([s * 0.09, 0.36, -0.04], [s * 0.12, 0.36 + s * 0.14, -0.04 + s * 0.05], 0.018, vmat('#868e96'), g); rbox(0.12, 0.03, 0.07, 0.012, vmat('#343a40'), g, s * 0.17, 0.36 + s * 0.14, -0.04 + s * 0.05); }
      rod([0, 0.9, -0.22], [0, 1.02, -0.25], 0.03, CHROME(), g); const sd = vmesh(new THREE.SphereGeometry(0.18, 14, 10), vmat('#5c3d2e', { shiny: true }), g, 0, 1.05, -0.26); sd.scale.set(0.95, 0.3, 1.25);
      rod([0, 0.98, 0.42], [0, 1.12, 0.44], 0.03, CHROME(), g); const hb = new THREE.CatmullRomCurve3([new THREE.Vector3(-0.36, 1.16, 0.32), new THREE.Vector3(-0.2, 1.13, 0.44), new THREE.Vector3(0.2, 1.13, 0.44), new THREE.Vector3(0.36, 1.16, 0.32)]);
      vmesh(new THREE.TubeGeometry(hb, 16, 0.025, 6), CHROME(), g);
      for (const s of [-1, 1]){ const k = vmesh(new THREE.CapsuleGeometry(0.035, 0.1, 4, 8), acc, g, s * 0.38, 1.16, 0.3); k.rotation.x = Math.PI / 2; k.rotation.z = s * 0.4;
        for (let i = 0; i < 3; i++){ const st = vmesh(new THREE.PlaneGeometry(0.025, 0.24), vmat(['#ffd43b', '#74c0fc', '#ff8fab'][i], { side: THREE.DoubleSide }), g, s * (0.4 + i * 0.01), 1.04, 0.24 - i * 0.012); st.rotation.z = s * (0.2 + i * 0.1); } }
      vmesh(new THREE.SphereGeometry(0.045, 10, 8), vmat('#ffd43b', { shiny: true }), g, -0.16, 1.17, 0.46);
      const bk = new THREE.Group(); bk.position.set(0, 1.0, 0.72); g.add(bk); const wk = vmat('#e9b96e');
      rbox(0.42, 0.04, 0.32, 0.015, wk, bk, 0, -0.13, 0); for (const [w, d, x, z] of [[0.42, 0.03, 0, 0.15], [0.42, 0.03, 0, -0.15], [0.03, 0.32, 0.2, 0], [0.03, 0.32, -0.2, 0]]) for (const y of [-0.06, 0.04, 0.13]) rbox(w, 0.04, d, 0.012, wk, bk, x, y, z);
      for (const [x, z] of [[0.2, 0.15], [-0.2, 0.15], [0.2, -0.15], [-0.2, -0.15]]) rod([x, -0.14, z], [x, 0.15, z], 0.012, wk, bk);
      for (const [x, c] of [[-0.08, '#ff6b6b'], [0.08, '#ffd43b']]){ vmesh(new THREE.SphereGeometry(0.06, 10, 8), vmat(c), bk, x, 0.17, 0.02); }
      light(g, 0, 0.98, 0.9, 0.05);
      for (const s of [-1, 1]){ rod([s * 0.06, 0.42, -0.64], [s * 0.34, 0.2, -0.62], 0.016, CHROME(), g); W.push(wheel2(0.13, 0.05, g, s * 0.36, 0.13, -0.62, { rim: '#ff8fab' })); }
      seat.set(0, 0.66, -0.24); pose = 'pedal'; camDist = 10; }
    else if (id === 'moto'){
      const red = PAINT('#e8322b'), cream = PAINT('#fff8ee');
      W.push(wheel2(0.32, 0.17, g, 0, 0.32, 0.74, { rim: '#ced4da' }), wheel2(0.32, 0.17, g, 0, 0.32, -0.74, { rim: '#ced4da' }));
      fender(0.38, 0.2, '#e8322b', g, 0, 0.32, 0.74, 0.1, 0.55);
      const cowl = vmesh(new THREE.CapsuleGeometry(0.27, 0.6, 6, 14), red, g, 0, 0.6, -0.48); cowl.rotation.x = Math.PI / 2; cowl.scale.set(1.12, 1, 0.78);
      const strip = vmesh(new THREE.CapsuleGeometry(0.285, 0.5, 6, 14), cream, g, 0, 0.56, -0.5); strip.rotation.x = Math.PI / 2; strip.scale.set(1.13, 1, 0.3);
      rbox(0.44, 0.08, 0.62, 0.035, vmat('#495057'), g, 0, 0.36, 0.1); rbox(0.4, 0.06, 0.5, 0.02, vmat('#343a40'), g, 0, 0.405, 0.1);
      const sh = rbox(0.6, 0.82, 0.14, 0.06, red, g, 0, 0.78, 0.5); sh.rotation.x = -0.18; rbox(0.5, 0.06, 0.04, 0.02, CHROME(), g, 0, 0.6, 0.58).rotation.x = -0.18;
      const st = vmesh(new THREE.CapsuleGeometry(0.11, 0.28, 4, 10), red, g, 0, 1.18, 0.5); st.rotation.x = -0.35;
      light(g, 0, 1.24, 0.66, 0.1); vmesh(new THREE.TorusGeometry(0.1, 0.018, 6, 18), CHROME(), g, 0, 1.24, 0.655).rotation.x = 0.0;
      rod([-0.4, 1.32, 0.44], [0.4, 1.32, 0.44], 0.026, CHROME(), g, true);
      for (const s of [-1, 1]){ const k = vmesh(new THREE.CapsuleGeometry(0.035, 0.12, 4, 8), vmat('#343a40'), g, s * 0.46, 1.32, 0.44); k.rotation.z = Math.PI / 2;
        rod([s * 0.3, 1.32, 0.44], [s * 0.38, 1.6, 0.4], 0.012, CHROME(), g); const mr = vmesh(new THREE.CylinderGeometry(0.075, 0.075, 0.025, 14), CHROME(), g, s * 0.39, 1.64, 0.4); mr.rotation.x = Math.PI / 2; }
      rbox(0.4, 0.13, 0.7, 0.06, vmat('#343a40', { shiny: true }), g, 0, 0.92, -0.32);
      rbox(0.16, 0.08, 0.06, 0.02, vmat('#ff4d4d', { emissive: '#c92a2a', emissiveIntensity: 0.6 }), g, 0, 0.66, -0.98);
      rod([0.16, 0.28, -0.4], [0.18, 0.36, -0.95], 0.045, CHROME(), g);
      rbox(0.5, 0.06, 0.45, 0.02, vmat('#495057'), g, 0, 0.96, -0.78);
      const db = rbox(0.66, 0.56, 0.58, 0.06, PAINT('#ffd43b'), g, 0, 1.28, -0.78);
      for (const [z, ry] of [[-1.075, Math.PI], [-0.485, 0]]){ const pl = vmesh(new THREE.PlaneGeometry(0.54, 0.42), new THREE.MeshLambertMaterial({ map: delivTex }), g, 0, 1.28, z); pl.rotation.y = ry; }
      seat.set(0, 0.62, -0.2); camDist = 11; rad = 0.9; }
    else if (id === 'car'){
      const red = PAINT('#e8322b'), red2 = PAINT('#c92a2a');
      /* 옆에서 본 모양(앞 +z)을 그려서 폭만큼 밀어 몸통을 만든다 */
      const s = new THREE.Shape(); s.moveTo(-1.6, 0.36); s.lineTo(1.5, 0.36); s.quadraticCurveTo(1.86, 0.38, 1.86, 0.6); s.quadraticCurveTo(1.84, 0.78, 1.55, 0.8); s.lineTo(0.7, 0.88); s.quadraticCurveTo(0.58, 0.9, 0.5, 0.86);
      s.lineTo(-0.82, 0.84); s.quadraticCurveTo(-0.95, 0.86, -1.05, 0.92); s.lineTo(-1.5, 0.92); s.quadraticCurveTo(-1.84, 0.9, -1.84, 0.62); s.quadraticCurveTo(-1.84, 0.38, -1.6, 0.36);
      const bg = new THREE.ExtrudeGeometry(s, { depth: 1.22, bevelEnabled: true, bevelThickness: 0.14, bevelSize: 0.12, bevelSegments: 4, curveSegments: 10 }); bg.translate(0, 0, -0.61); bg.rotateY(-Math.PI / 2);
      vmesh(bg, red, g);
      rbox(1.32, 0.05, 1.4, 0.02, vmat('#6b4a3a'), g, 0, 0.885, -0.18);
      for (const sx of [-0.36, 0.36]){ rbox(0.52, 0.16, 0.56, 0.07, vmat('#fff3e0', { shiny: true }), g, sx, 0.98, -0.28); const bk = rbox(0.52, 0.66, 0.16, 0.07, vmat('#fff3e0', { shiny: true }), g, sx, 1.26, -0.6); bk.rotation.x = -0.14;
        rbox(0.34, 0.2, 0.12, 0.06, vmat('#fff3e0', { shiny: true }), g, sx, 1.66, -0.66); }
      for (const sx of [-0.62, 0.62]) rod([sx, 0.92, 0.5], [sx * 0.97, 1.36, 0.36], 0.022, CHROME(), g, true); rod([-0.6, 1.36, 0.36], [0.6, 1.36, 0.36], 0.022, CHROME(), g);
      const ws = vmesh(new THREE.PlaneGeometry(1.2, 0.46), new THREE.MeshPhongMaterial({ color: '#bfe8ff', transparent: true, opacity: 0.45, shininess: 120, side: THREE.DoubleSide }), g, 0, 1.14, 0.43); ws.rotation.x = -0.3;
      rod([-0.36, 0.95, 0.4], [-0.36, 1.1, 0.18], 0.03, vmat('#343a40'), g); const sw = vmesh(new THREE.TorusGeometry(0.17, 0.03, 8, 20), vmat('#343a40', { shiny: true }), g, -0.36, 1.12, 0.17); sw.rotation.x = -1.05;
      for (const sx of [-0.52, 0.52]){ light(g, sx, 0.74, 1.72, 0.13); const rg = vmesh(new THREE.TorusGeometry(0.13, 0.025, 6, 18), CHROME(), g, sx, 0.74, 1.76); rg.rotation.y = 0; }
      const gr = vmesh(new THREE.TorusGeometry(0.34, 0.05, 6, 20, Math.PI), vmat('#343a40'), g, 0, 0.66, 1.9); gr.rotation.z = Math.PI; gr.scale.set(1, 0.45, 1);
      for (const z of [1.98, -1.98]){ const bp = vmesh(new THREE.CapsuleGeometry(0.06, 1.3, 4, 10), CHROME(), g, 0, 0.44, z); bp.rotation.z = Math.PI / 2; }
      for (const sx of [-0.5, 0.5]) rbox(0.22, 0.1, 0.05, 0.03, vmat('#ff4d4d', { emissive: '#c92a2a', emissiveIntensity: 0.6 }), g, sx, 0.78, -1.93);
      for (const sx of [-1, 1]){ rod([sx * 0.66, 0.95, 0.45], [sx * 0.8, 1.02, 0.45], 0.015, CHROME(), g); vmesh(new THREE.SphereGeometry(0.07, 10, 8), CHROME(), g, sx * 0.83, 1.04, 0.45).scale.set(0.5, 0.8, 1); }
      rbox(0.04, 0.05, 2.6, 0.02, CHROME(), g, -0.735, 0.72, -0.05); rbox(0.04, 0.05, 2.6, 0.02, CHROME(), g, 0.735, 0.72, -0.05);
      for (const [x, z] of [[-0.86, 1.15], [0.86, 1.15], [-0.86, -1.12], [0.86, -1.12]]){ W.push(wheel2(0.38, 0.26, g, x, 0.38, z, { rim: '#f8f9fa', chrome: true, capC: '#e8322b' })); fender(0.46, 0.32, '#c92a2a', g, x, 0.38, z, 0.08, 0.7); }
      rod([0.4, 0.3, -1.85], [0.42, 0.3, -2.02], 0.045, CHROME(), g);
      seat.set(-0.36, 0.62, -0.2); camDist = 12; rad = 1.6; }
    else if (id === 'tiller'){
      const blue = PAINT('#2f6fdb'), red = PAINT('#e8322b'), dk = vmat('#343a40', { shiny: true });
      rbox(0.84, 0.62, 0.86, 0.1, blue, g, 0, 1.0, 1.55); rbox(0.7, 0.46, 0.08, 0.03, dk, g, 0, 1.0, 2.0);
      for (let i = 0; i < 4; i++) rbox(0.62, 0.035, 0.02, 0.01, CHROME(), g, 0, 0.84 + i * 0.1, 2.05);
      const tank = vmesh(new THREE.CapsuleGeometry(0.17, 0.4, 4, 12), red, g, 0, 1.42, 1.5); tank.rotation.x = Math.PI / 2; vmesh(new THREE.CylinderGeometry(0.05, 0.05, 0.06, 10), CHROME(), g, 0, 1.6, 1.5);
      rod([0.3, 1.3, 1.36], [0.3, 1.95, 1.36], 0.05, vmat('#495057'), g); vmesh(new THREE.CylinderGeometry(0.075, 0.05, 0.12, 10), vmat('#212529'), g, 0.3, 2.0, 1.36);
      const fw = vmesh(new THREE.CylinderGeometry(0.34, 0.34, 0.08, 20), red, g, -0.47, 1.05, 1.5); fw.rotation.z = Math.PI / 2; vmesh(new THREE.TorusGeometry(0.34, 0.03, 6, 22), CHROME(), g, -0.52, 1.05, 1.5).rotation.y = Math.PI / 2;
      light(g, 0.28, 1.25, 2.02, 0.08); light(g, -0.28, 1.25, 2.02, 0.08);
      W.push(wheel2(0.5, 0.26, g, -0.62, 0.5, 1.55, { rim: '#e8322b', lug: true, capC: '#ffd43b' }), wheel2(0.5, 0.26, g, 0.62, 0.5, 1.55, { rim: '#e8322b', lug: true, capC: '#ffd43b' }));
      for (const s of [-1, 1]){ rod([s * 0.25, 1.15, 1.2], [s * 0.46, 1.32, 0.42], 0.04, CHROME(), g, true); const k = vmesh(new THREE.CapsuleGeometry(0.045, 0.14, 4, 8), vmat('#212529'), g, s * 0.5, 1.33, 0.36); k.rotation.x = Math.PI / 2 - 0.3; }
      rod([0, 0.72, 1.2], [0, 0.72, 0.6], 0.06, vmat('#495057'), g);
      const cart = new THREE.Group(); cart.position.set(0, 0, -0.5); g.add(cart); const pl = new THREE.MeshLambertMaterial({ map: plankTex }), rail = vmat('#a8743a');
      vmesh(new THREE.BoxGeometry(1.62, 0.16, 1.92), pl, cart, 0, 0.72, 0); rbox(1.7, 0.1, 2.0, 0.03, rail, cart, 0, 0.62, 0);
      for (const s of [-1, 1]){ const sd = vmesh(new THREE.BoxGeometry(0.08, 0.42, 1.92), pl, cart, s * 0.81, 1.0, 0); sd.rotation.y = Math.PI / 2 * 0; rbox(0.1, 0.06, 2.0, 0.025, rail, cart, s * 0.81, 1.23, 0); }
      vmesh(new THREE.BoxGeometry(1.62, 0.42, 0.08), pl, cart, 0, 1.0, -0.96); rbox(1.7, 0.06, 0.1, 0.025, rail, cart, 0, 1.23, -0.96);
      for (const s of [-1, 1]){ W.push(wheel2(0.3, 0.16, g, s * 0.92, 0.3, -0.5, { rim: '#e8322b', capC: '#ffd43b' })); fender(0.36, 0.2, '#a8743a', g, s * 0.92, 0.3, -0.5, 0.15, 0.7); }
      rbox(0.52, 0.12, 0.42, 0.05, vmat('#495057', { shiny: true }), g, 0, 1.0, 0.42); rbox(0.52, 0.32, 0.08, 0.04, vmat('#495057', { shiny: true }), g, 0, 1.18, 0.2);
      for (let i = 0; i < 3; i++) vmesh(new THREE.SphereGeometry(0.16 - i * 0.03, 10, 8), vmat(['#ff922b', '#ffd43b', '#94d82d'][i]), cart, -0.4 + i * 0.32, 0.92, -0.5);
      seat.set(0, 0.72, 0.42); camDist = 11; rad = 1.4; }
    else if (id === 'stroller'){
      /* 자동 유모차: 아기가 누워서 스르르. 머리 쪽(-z)에 해가리개 */
      const mint = PAINT('#8fd8c9'), wf = CHROME();
      const ring = new THREE.Shape(), hole = new THREE.Path(), rr = (p, w, d, r) => { p.moveTo(-w / 2 + r, -d / 2); p.lineTo(w / 2 - r, -d / 2); p.quadraticCurveTo(w / 2, -d / 2, w / 2, -d / 2 + r); p.lineTo(w / 2, d / 2 - r); p.quadraticCurveTo(w / 2, d / 2, w / 2 - r, d / 2); p.lineTo(-w / 2 + r, d / 2); p.quadraticCurveTo(-w / 2, d / 2, -w / 2, d / 2 - r); p.lineTo(-w / 2, -d / 2 + r); p.quadraticCurveTo(-w / 2, -d / 2, -w / 2 + r, -d / 2); };
      rr(ring, 1.24, 2.3, 0.5); rr(hole, 1.06, 2.12, 0.42); ring.holes.push(hole);
      const tg = new THREE.ExtrudeGeometry(ring, { depth: 0.4, bevelEnabled: true, bevelThickness: 0.05, bevelSize: 0.04, bevelSegments: 3, curveSegments: 10 }); tg.rotateX(-Math.PI / 2);
      vmesh(tg, mint, g, 0, 0.62, 0);
      const trim = new THREE.Shape(), th = new THREE.Path(); rr(trim, 1.34, 2.4, 0.55); rr(th, 1.08, 2.14, 0.43); trim.holes.push(th);
      const tm = new THREE.ExtrudeGeometry(trim, { depth: 0.04, bevelEnabled: true, bevelThickness: 0.03, bevelSize: 0.03, bevelSegments: 2, curveSegments: 10 }); tm.rotateX(-Math.PI / 2); vmesh(tm, vmat('#ffffff', { shiny: true }), g, 0, 1.03, 0);
      const rib = new THREE.Shape(), rh = new THREE.Path(); rr(rib, 1.37, 2.43, 0.56); rr(rh, 1.25, 2.31, 0.5); rib.holes.push(rh);
      const rbg = new THREE.ExtrudeGeometry(rib, { depth: 0.07, bevelEnabled: false, curveSegments: 10 }); rbg.rotateX(-Math.PI / 2); vmesh(rbg, vmat('#ff9ec4', { shiny: true }), g, 0, 0.78, 0);
      for (const [x, z, c] of [[0.66, 0.5, '#ffd43b'], [0.66, -0.2, '#74c0fc'], [-0.66, 0.4, '#ffd43b'], [-0.66, -0.3, '#74c0fc']]){ const st = vmesh(new THREE.OctahedronGeometry(0.07), vmat(c, { shiny: true }), g, x, 0.92, z); st.scale.set(0.4, 1, 1); }
      rbox(1.16, 0.1, 2.2, 0.05, mint, g, 0, 0.62, 0); rbox(1.02, 0.12, 2.04, 0.06, vmat('#ffffff'), g, 0, 0.72, 0);
      rbox(0.62, 0.12, 0.34, 0.06, vmat('#fff0f6'), g, 0, 0.8, -0.78);
      const hood = new THREE.Group(); hood.position.set(0, 1.04, -0.74); hood.rotation.y = Math.PI; hood.scale.set(0.95, 1.0, 1.0); g.add(hood);
      vmesh(new THREE.SphereGeometry(0.66, 20, 10, 0, Math.PI, 0, Math.PI / 2), vmat('#ff9ec4', { shiny: true, side: THREE.DoubleSide }), hood);
      for (const a of [0.02, 0.6, 1.15]) vmesh(new THREE.TorusGeometry(0.665, 0.02, 5, 22, Math.PI), vmat('#ffffff'), hood).rotation.x = a;
      const toy = new THREE.Group(); toy.position.set(0, 1.5, -0.2); g.add(toy); rod([0, 0, 0], [0, -0.3, 0.08], 0.006, vmat('#ffffff'), toy); vmesh(new THREE.OctahedronGeometry(0.08), vmat('#ffd43b', { shiny: true }), toy, 0, -0.34, 0.09);
      rod([-0.62, 1.04, -0.72], [0.62, 1.04, -0.72], 0.012, vmat('#ffffff'), g);
      for (const s of [-1, 1]){
        rod([s * 0.56, 0.58, -0.9], [s * 0.56, 0.3, -0.95], 0.03, wf, g, true); rod([s * 0.56, 0.58, 0.9], [s * 0.56, 0.24, 0.98], 0.03, wf, g, true);
        rod([s * 0.56, 0.58, -0.9], [s * 0.56, 0.58, 0.9], 0.028, wf, g);
        rod([s * 0.56, 0.6, -1.0], [s * 0.5, 1.75, -1.5], 0.035, wf, g, true); }
      const hb = vmesh(new THREE.CapsuleGeometry(0.05, 0.95, 4, 10), vmat('#495057'), g, 0, 1.76, -1.51); hb.rotation.z = Math.PI / 2;
      rbox(0.9, 0.22, 0.8, 0.06, vmat('#495057'), g, 0, 0.36, -0.2);
      for (const s of [-1, 1]){ W.push(wheel2(0.3, 0.12, g, s * 0.62, 0.3, -0.95, { rim: '#ffffff', capC: '#ff9ec4' })); W.push(wheel2(0.24, 0.1, g, s * 0.62, 0.24, 0.98, { rim: '#ffffff', capC: '#ff9ec4' })); }
      for (const s of [-1, 1]) rod([s * 0.56, 0.3, -0.95], [s * 0.62, 0.3, -0.95], 0.02, wf, g);
      seat.set(0, 0.36, 0.3); pose = 'lie'; camDist = 10; rad = 1.1; }
    bakeVehicle(g, W); g.visible = false; if (add) scene.add(g); return { g, W, seat, pose, camDist, rad, id };
  }
  /* 같은 재질끼리 한 덩어리로 합쳐서 그리기 횟수를 줄인다(바퀴는 돌아야 하니 바퀴끼리만 따로) */
  const BK_M = new THREE.Matrix4(), BK_I = new THREE.Matrix4();
  function bakeInto(root, skip){
    root.updateMatrixWorld(true); BK_I.copy(root.matrixWorld).invert(); const groups = new Map();
    root.traverse(o => { if (!o.isMesh) return; for (let p = o.parent; p && p !== root; p = p.parent) if (skip.has(p)) return; if (!groups.has(o.material)) groups.set(o.material, []); groups.get(o.material).push(o); });
    for (const [mat, list] of groups){ if (list.length < 2) continue; let n = 0;
      const parts = list.map(o => { const gg = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone(); gg.applyMatrix4(BK_M.multiplyMatrices(BK_I, o.matrixWorld)); n += gg.attributes.position.count; return gg; });
      const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), uv = new Float32Array(n * 2); let i = 0;
      for (const p of parts){ pos.set(p.attributes.position.array, i * 3); if (p.attributes.normal) nor.set(p.attributes.normal.array, i * 3); if (p.attributes.uv) uv.set(p.attributes.uv.array, i * 2); i += p.attributes.position.count; p.dispose(); }
      const mg = new THREE.BufferGeometry(); mg.setAttribute('position', new THREE.BufferAttribute(pos, 3)); mg.setAttribute('normal', new THREE.BufferAttribute(nor, 3)); mg.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
      for (const o of list){ o.parent.remove(o); o.geometry.dispose(); } root.add(new THREE.Mesh(mg, mat)); } }
  function bakeVehicle(g, W){ const wheels = new Set(W.map(w => w.m)); bakeInto(g, wheels); for (const w of wheels) bakeInto(w, new Set()); }
  let VOBJ = {}; const vobj = id => VOBJ[id] || (VOBJ[id] = makeVehicle(id));

  /* ---------- 단양읍 (구경시장) · 다리 ---------- */
  let HOUSES = [], DISPLAY = [], socks = [], BENCHES = [];
  function buildTown(){
    const houseTex = canvasTex(128, 128, (g, W, Hh) => { g.fillStyle = '#ffffff'; g.fillRect(0, 0, W, Hh); g.fillStyle = '#bfe3ff'; for (const x of [18, 78]){ g.fillRect(x, 22, 32, 30); }
      g.strokeStyle = '#ffffff'; g.lineWidth = 4; for (const x of [18, 78]){ g.beginPath(); g.moveTo(x + 16, 22); g.lineTo(x + 16, 52); g.moveTo(x, 37); g.lineTo(x + 32, 37); g.stroke(); }
      g.fillStyle = '#a0703f'; g.fillRect(50, 74, 28, 54); g.fillStyle = '#ffd43b'; g.beginPath(); g.arc(72, 102, 3, 0, 7); g.fill(); g.fillStyle = 'rgba(0,0,0,.06)'; g.fillRect(0, 120, W, 8); });
    const N = 90; const body = new THREE.BoxGeometry(6, 4, 6); body.translate(0, 2, 0); const roof = new THREE.ConeGeometry(5.2, 3, 4); roof.rotateY(Math.PI / 4); roof.translate(0, 5.4, 0);
    const mb = new THREE.InstancedMesh(body, new THREE.MeshLambertMaterial({ map: houseTex }), N), mr = new THREE.InstancedMesh(roof, new THREE.MeshLambertMaterial({ color: 0xffffff }), N);
    const bc = ['#fff4e0', '#ffe3e3', '#e7f5ff', '#f4fce3', '#fff9db', '#f3f0ff'].map(c => new THREE.Color(c)), rc = ['#e8604c', '#4c86c6', '#7a8b99', '#e0913a', '#5aa36a', '#c0587e'].map(c => new THREE.Color(c));
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), v = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0); let n = 0; const roadA = Math.atan2(toTownDir[0], toTownDir[1]);
    const place = (x, z, face, sc) => { if (n >= N) return; const h = heightAt(x, z); q.setFromAxisAngle(up, face); s.set(sc, sc * (rnd() < 0.2 ? 1.6 : 1), sc); v.set(x, h - 0.2, z); m.compose(v, q, s);
      mb.setMatrixAt(n, m); mr.setMatrixAt(n, m); mb.setColorAt(n, bc[n % bc.length]); mr.setColorAt(n, rc[Math.floor(rnd() * rc.length)]); COLL.push({ x, z, r: 3.9 * sc }); HOUSES.push({ x, z }); n++; };
    for (const [r0, r1, cnt] of [[50, 60, 22], [90, 112, 58]]){ for (let k = 0; k < cnt; k++){ const a = k / cnt * Math.PI * 2 + rnd() * 0.08; if (Math.abs(wrapA(a - roadA)) < 0.2) continue; const r = r0 + rnd() * (r1 - r0);
      const x = TOWN.x + Math.sin(a) * r, z = TOWN.z + Math.cos(a) * r; if (riverDist(x, z) < 54) continue; place(x, z, a + Math.PI, 0.85 + rnd() * 0.35); } }
    [[214, 326], [206, 350], [228, 302], [196, 272], [226, 280], [150, 352]].forEach(([x, z]) => place(x, z, Math.atan2(VIL.x - x, VIL.z - z), 0.9));
    mb.count = mr.count = n; [mb, mr].forEach(o => { o.instanceMatrix.needsUpdate = true; o.instanceColor.needsUpdate = true; scene.add(o); });
    const gx = TOWN.x + toTownDir[0] * 27, gz = TOWN.z + toTownDir[1] * 27, gy = heightAt(gx, gz); const gate = new THREE.Group(); gate.position.set(gx, gy, gz); gate.rotation.y = Math.atan2(toTownDir[0], toTownDir[1]);
    for (const s2 of [-1, 1]){ box(0.7, 6, 0.7, '#d9480f', s2 * 5, 3, 0, gate); COLL.push({ x: gx + s2 * 5 * Math.cos(gate.rotation.y), z: gz - s2 * 5 * Math.sin(gate.rotation.y), r: 0.6 }); }
    const gt = canvasTex(512, 128, (c, W, Hh) => { c.fillStyle = '#d9480f'; c.fillRect(0, 0, W, Hh); c.fillStyle = '#fff3bf'; c.font = 'bold 70px Jua, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('단양 구경시장', W / 2, Hh / 2 + 4); });
    const gb = new THREE.Mesh(new THREE.BoxGeometry(11.5, 2.2, 0.5), [M('#d9480f'), M('#d9480f'), M('#d9480f'), M('#d9480f'), new THREE.MeshLambertMaterial({ map: gt }), new THREE.MeshLambertMaterial({ map: gt })]); gb.position.y = 6.4; gate.add(gb); scene.add(gate);
    const awn = canvasTex(64, 64, (c, W, Hh) => { for (let i = 0; i < 8; i++){ c.fillStyle = i % 2 ? '#ffffff' : '#ff6b6b'; c.fillRect(i * 8, 0, 8, Hh); } });
    const awnB = canvasTex(64, 64, (c, W, Hh) => { for (let i = 0; i < 8; i++){ c.fillStyle = i % 2 ? '#ffffff' : '#4dabf7'; c.fillRect(i * 8, 0, 8, Hh); } });
    const goods = ['#ffffff', '#ff8787', '#ffd43b', '#8ce99a', '#f4a261'];
    for (let k = 0; k < 9; k++){ const a = k / 9 * Math.PI * 2 + 0.35; if (Math.abs(wrapA(a - roadA)) < 0.35) continue;
      const x = TOWN.x + Math.sin(a) * 17, z = TOWN.z + Math.cos(a) * 17, y = heightAt(x, z); const st = new THREE.Group(); st.position.set(x, y, z); st.rotation.y = a + Math.PI;
      box(2.6, 0.9, 1.3, '#c8945a', 0, 0.45, 0, st); for (const s2 of [-1, 1]) box(0.12, 2.4, 0.12, '#8d6e63', s2 * 1.3, 1.2, -0.6, st);
      const aw = new THREE.Mesh(new THREE.BoxGeometry(3, 0.12, 1.9), new THREE.MeshLambertMaterial({ map: k % 2 ? awn : awnB })); aw.position.set(0, 2.4, 0.1); aw.rotation.x = 0.18; st.add(aw);
      for (let j = 0; j < 6; j++){ const b = new THREE.Mesh(new THREE.SphereGeometry(0.2, 8, 6), M(goods[(j + k) % goods.length])); b.position.set(-0.9 + j * 0.36, 1.02, (j % 2) * 0.3 - 0.15); st.add(b); }
      scene.add(st); COLL.push({ x, z, r: 1.6 }); }
    const tr = new THREE.Group(); tr.position.set(TOWN.x, heightAt(TOWN.x, TOWN.z), TOWN.z); box(0.6, 3, 0.6, '#7b5638', 0, 1.5, 0, tr); const crown = new THREE.Mesh(new THREE.IcosahedronGeometry(3.4, 1), new THREE.MeshLambertMaterial({ color: '#e0782f', flatShading: true })); crown.position.y = 5; tr.add(crown); scene.add(tr); COLL.push({ x: TOWN.x, z: TOWN.z, r: 1.4 });
    const s1 = makeSign(['단양읍', '구경시장 · 고수대교'], 7, 3, '#3f6fa8'); s1.position.set(BR.townEnd[0] + toTownDir[0] * -6 + 4, heightAt(BR.townEnd[0], BR.townEnd[1]), BR.townEnd[1] - toTownDir[1] * 6); s1.rotation.y = Math.atan2(-toTownDir[0], -toTownDir[1]); scene.add(s1);
    const ra = roadA + 1.2; const s3 = makeSign(['쏘가리 매운탕 거리', '→ 강변 쪽'], 7, 3, '#2b8a3e'); const sx = TOWN.x + Math.sin(ra) * 46, sz = TOWN.z + Math.cos(ra) * 46; s3.position.set(sx, heightAt(sx, sz), sz); s3.rotation.y = ra + Math.PI; scene.add(s3);
    const br = new THREE.Group(); br.position.set(BR.x, 0, BR.z); br.rotation.y = BR.ang;
    box(BR.w * 2, 0.6, BR.half * 2, '#e9e4da', 0, BR.top - 0.3, 0, br); for (const s2 of [-1, 1]) box(0.18, 0.8, BR.half * 2, '#ffffff', s2 * (BR.w - 0.1), BR.top + 0.4, 0, br);
    const arch = new THREE.Mesh(new THREE.TorusGeometry(BR.half * 0.72, 0.9, 8, 48, Math.PI), M('#e2483d')); arch.rotation.y = Math.PI / 2; arch.position.y = BR.top; arch.scale.set(1, 0.38, 1); br.add(arch);
    for (const zz of [-34, 0, 34]){ const pl = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.4, 8, 8), M('#d9d2c4')); pl.position.set(0, BR.top - 4.4, zz); br.add(pl); }
    const bt = makeTag('고수대교', '#e2483d', '#fff', 2.2); bt.position.set(0, BR.top + 7.5, 0); br.add(bt);
    scene.add(br);
  }
  /* ---------- 강변 아기마을: 탈것 가게 · 마늘빵 매점 · 버스 정류장 · 등산로 입구 ---------- */
  function buildVillage(){
    const sh = new THREE.Group(); const sy = heightAt(SHOP_POS.x, SHOP_POS.z); sh.position.set(SHOP_POS.x, sy, SHOP_POS.z); const face = Math.atan2(LAND.x - SHOP_POS.x, LAND.z - SHOP_POS.z); sh.rotation.y = face;
    box(10, 5, 7, '#fff4e6', 0, 2.5, 0, sh); const rf = new THREE.Mesh(new THREE.ConeGeometry(7.6, 3.2, 4), M('#ff8fab')); rf.rotation.y = Math.PI / 4; rf.scale.set(1, 1, 0.72); rf.position.y = 6.6; sh.add(rf);
    box(2.4, 3, 0.2, '#a0703f', 0, 1.5, 3.55, sh); box(3.2, 1.8, 0.2, '#bfe3ff', -3.2, 2.8, 3.55, sh); box(3.2, 1.8, 0.2, '#bfe3ff', 3.2, 2.8, 3.55, sh);
    const st = canvasTex(512, 128, (c, W, Hh) => { c.fillStyle = '#ff7a59'; roundRect(c, 4, 4, W - 8, Hh - 8, 30); c.fill(); c.fillStyle = '#fff'; c.font = 'bold 64px Jua, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('아기 탈것 가게', W / 2, Hh / 2 + 4); });
    const sg = new THREE.Mesh(new THREE.PlaneGeometry(8, 2), new THREE.MeshLambertMaterial({ map: st, transparent: true })); sg.position.set(0, 5.4, 3.62); sh.add(sg);
    const aw = canvasTex(64, 64, (c, W, Hh) => { for (let i = 0; i < 8; i++){ c.fillStyle = i % 2 ? '#ffffff' : '#ff7a59'; c.fillRect(i * 8, 0, 8, Hh); } });
    const awm = new THREE.Mesh(new THREE.BoxGeometry(10.4, 0.15, 2.2), new THREE.MeshLambertMaterial({ map: aw })); awm.position.set(0, 4.1, 4.5); awm.rotation.x = 0.22; sh.add(awm);
    scene.add(sh); COLL.push({ x: SHOP_POS.x, z: SHOP_POS.z, r: 5.2 });
    ['stroller', 'kick', 'bike', 'moto', 'car', 'tiller'].forEach((id, i) => { const v = makeVehicle(id); const lx = -9.5 + i * 3.8, lz = 9.5; const wx = SHOP_POS.x + Math.cos(face) * lx + Math.sin(face) * lz, wz = SHOP_POS.z - Math.sin(face) * lx + Math.cos(face) * lz;
      v.g.position.set(wx, heightAt(wx, wz), wz); v.g.rotation.y = face + 0.6; v.g.visible = true; const tg = makeTag(VEHMAP[id].icon + ' 진주 ' + VEHMAP[id].price, '#ffffff', '#e8603c', 1.6); tg.position.set(wx, v.g.position.y + (id === 'car' ? 2.4 : 2.2), wz); scene.add(tg); DISPLAY.push(v.g, tg); });
    const tent = new THREE.Group(); tent.position.set(SNACK_POS.x, heightAt(SNACK_POS.x, SNACK_POS.z), SNACK_POS.z);
    const roof = new THREE.Mesh(new THREE.ConeGeometry(5, 2.6, 4), M('#ff9f43')); roof.rotation.y = Math.PI / 4; roof.position.y = 4.8; tent.add(roof);
    for (const [a, b] of [[-3, -3], [3, -3], [-3, 3], [3, 3]]){ const p = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 3.6, 6), M('#fff')); p.position.set(a, 1.8, b); tent.add(p); }
    box(5, 1.1, 2, '#fff3e0', 0, 0.55, 0, tent); for (let j = 0; j < 5; j++){ const b = new THREE.Mesh(new THREE.SphereGeometry(0.28, 10, 8), M('#f4d58d')); b.scale.set(1, 0.7, 1); b.position.set(-1.6 + j * 0.8, 1.25, 0); tent.add(b); }
    scene.add(tent); COLL.push({ x: SNACK_POS.x, z: SNACK_POS.z, r: 2.6 });
    const t1 = makeTag(`마늘빵 매점 · 진주 ${SNACK_PRICE}`, '#ff9f43', '#fff', 2.2); t1.position.set(SNACK_POS.x, tent.position.y + 7, SNACK_POS.z); scene.add(t1);
    const bs = new THREE.Group(); bs.position.set(STOP_POS.x, heightAt(STOP_POS.x, STOP_POS.z), STOP_POS.z); bs.rotation.y = Math.PI / 2;
    box(4, 0.15, 1.6, '#4c86c6', 0, 2.8, 0, bs); for (const s2 of [-1.8, 1.8]) box(0.12, 2.8, 0.12, '#adb5bd', s2, 1.4, -0.6, bs); box(3.4, 0.12, 0.6, '#b07a4b', 0, 0.6, -0.4, bs); box(3.8, 1.6, 0.06, '#dbeffe', 0, 1.9, -0.75, bs);
    scene.add(bs); COLL.push({ x: STOP_POS.x, z: STOP_POS.z, r: 1.4 });
    const t2 = makeTag(`양방산 정상행 마을버스 · 진주 ${BUS_PRICE}`, '#4c86c6', '#fff', 3.2); t2.position.set(STOP_POS.x, bs.position.y + 4.6, STOP_POS.z); scene.add(t2);
    const p0 = TRAIL.pts[2], p1 = TRAIL.pts[6]; const ta = Math.atan2(p1[0] - p0[0], p1[1] - p0[1]); const tg = new THREE.Group(); tg.position.set(p0[0], heightAt(p0[0], p0[1]), p0[1]); tg.rotation.y = ta;
    for (const s2 of [-1, 1]) box(0.5, 4.4, 0.5, '#8d6e63', s2 * 3, 2.2, 0, tg);
    const gtex = canvasTex(512, 128, (c, W, Hh) => { c.fillStyle = '#5b8f3f'; c.fillRect(0, 0, W, Hh); c.fillStyle = '#fff'; c.font = 'bold 54px Jua, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('양방산 등산로 · 정상 3.5km', W / 2, Hh / 2 + 4); });
    const gb = new THREE.Mesh(new THREE.BoxGeometry(7.4, 1.6, 0.3), [M('#5b8f3f'), M('#5b8f3f'), M('#5b8f3f'), M('#5b8f3f'), new THREE.MeshLambertMaterial({ map: gtex }), new THREE.MeshLambertMaterial({ map: gtex })]); gb.position.y = 4.6; tg.add(gb); scene.add(tg);
  }
  function makeWindsock(){ const g = new THREE.Group(); const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.12, 6, 6), M('#dddddd')); pole.position.y = 3; g.add(pole);
    const sockG = new THREE.CylinderGeometry(0.55, 0.25, 3, 12, 5, true).toNonIndexed(); const cols = []; const p = sockG.attributes.position; for (let i = 0; i < p.count; i += 3){ const y = (p.getY(i) + p.getY(i + 1) + p.getY(i + 2)) / 3; const band = Math.floor((y + 1.5) / 0.6); const c = new THREE.Color(band % 2 ? '#ff7a3d' : '#ffffff'); for (let k = 0; k < 3; k++) cols.push(c.r, c.g, c.b); }
    sockG.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3)); const sock = new THREE.Mesh(sockG, new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide }));
    sock.rotation.x = -Math.PI / 2; sock.position.set(0, 5.6, 1.5); const hold = new THREE.Group(); hold.add(sock); hold.rotation.y = WINDDIR; g.add(hold); g.userData.sock = hold; return g; }
  function buildPadAndField(){
    scene.add(box(24, 0.6, 18, '#7fcf5a', PAD.x, PH - 0.2, PAD.z + 1));
    for (let i = -1; i <= 1; i++) scene.add(box(2.2, 0.62, 18, '#f2f7ee', PAD.x + i * 6, PH - 0.19, PAD.z + 1));
    const ws = makeWindsock(); ws.position.set(PAD.x - 13, PH, PAD.z + 6); scene.add(ws); socks.push(ws);
    const sign = makeSign(['양방산 활공장', '해발 664m · 이륙장'], 7, 3.2); sign.position.set(PAD.x + 10, PH, PAD.z - 8); sign.rotation.y = Math.PI * 0.9; scene.add(sign);
    const t = new THREE.Group(); const ox = 14, oz = -10, oh = heightAt(ox, oz); t.position.set(ox, oh, oz);
    const body = new THREE.Mesh(new THREE.CylinderGeometry(3, 3.6, 9, 16), M('#f1ece2')); body.position.y = 4.5; t.add(body);
    const glass = new THREE.Mesh(new THREE.CylinderGeometry(4.6, 4.2, 3.2, 16), new THREE.MeshPhongMaterial({ color: '#8fd3f4', shininess: 100, transparent: true, opacity: .85 })); glass.position.y = 10.4; t.add(glass);
    const cap = new THREE.Mesh(new THREE.ConeGeometry(5.4, 2.4, 16), M('#4c86c6')); cap.position.y = 13.2; t.add(cap); scene.add(t); COLL.push({ x: ox, z: oz, r: 3.8 });
    const tt = makeTag('양방산 전망대', '#4c86c6', '#fff', 3); tt.position.set(ox, oh + 17, oz); scene.add(tt);
    const y = heightAt(LAND.x, LAND.z) + 0.06;
    [[12, '#ffffff'], [9.5, '#ff6b5b'], [6.5, '#ffffff'], [3.5, '#ff6b5b'], [1.2, '#ffd43b']].forEach(([r, c], i) => { const m = new THREE.Mesh(new THREE.CircleGeometry(r, 40), new THREE.MeshBasicMaterial({ color: c, polygonOffset: true, polygonOffsetFactor: -1 - i, polygonOffsetUnits: -1 - i })); m.rotation.x = -Math.PI / 2; m.position.set(LAND.x, y + i * 0.01, LAND.z); scene.add(m); });
    const ws2 = makeWindsock(); ws2.position.set(LAND.x + 30, heightAt(LAND.x + 30, LAND.z - 8), LAND.z - 8); scene.add(ws2); socks.push(ws2);
    const sign2 = makeSign(['남한강 착륙장', '해발 140m'], 7, 3.2); sign2.position.set(LAND.x - 22, heightAt(LAND.x - 22, LAND.z - 30), LAND.z - 30); sign2.rotation.y = Math.PI * 0.95; scene.add(sign2);
    [0.12, 0.5, 0.86].forEach(f => { const p = trailAt(f); const sx = -p.tz, sz = p.tx; const x = p.x + sx * 3.4, z = p.z + sz * 3.4; const remain = ((1 - f) * MAP.trailKm).toFixed(1);
      const s = makeSign(['정상(이륙장)까지', remain + 'km'], 5, 2.6, '#5b8f3f'); s.position.set(x, heightAt(x, z), z); s.rotation.y = Math.atan2(-p.tx, -p.tz); scene.add(s); });
    [0.33, 0.68].forEach(f => { const p = trailAt(f); const r = Math.hypot(p.x, p.z) || 1; const x = p.x + p.x / r * 4.2, z = p.z + p.z / r * 4.2; const face = Math.atan2(p.x / r, p.z / r);
      const b = new THREE.Group(); b.position.set(x, heightAt(x, z), z); b.rotation.y = face; const wood = M('#b07a4b');
      box(3.4, 0.25, 1.1, wood, 0, 0.75, 0, b); box(3.4, 0.9, 0.2, wood, 0, 1.35, -0.55, b); for (const lx of [-1.4, 1.4]) box(0.2, 0.75, 1, wood, lx, 0.37, 0, b);
      scene.add(b); const tg = makeTag('쉼터 · 산멍', '#5b8f3f', '#fff', 1.8); tg.position.set(x, heightAt(x, z) + 3.2, z); scene.add(tg); BENCHES.push({ x, z, face }); });
  }
  /* ---------- 구름 · 상승기류 · 별 · 링 · 단풍잎 ---------- */
  let TP = [], PUFFS = [], STARS = [], RINGS = [], PICKS = [];
  function makeCloud(s){ const g = new THREE.Group(); const m = new THREE.MeshLambertMaterial({ color: '#ffffff', emissive: '#9fb4c8', emissiveIntensity: 0.35 });
    const n = 6 + Math.floor(rnd() * 4); for (let i = 0; i < n; i++){ const b = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 10), m); const r = (0.6 + rnd() * 0.6) * s; b.scale.set(r * 1.3, r * 0.8, r); b.position.set((rnd() - 0.5) * s * 2.6, (rnd() - 0.2) * s * 0.5, (rnd() - 0.5) * s * 1.4); g.add(b); } return g; }
  function starShape(R1, R2, n = 5){ const s = new THREE.Shape(); for (let i = 0; i < n * 2; i++){ const r = i % 2 ? R2 : R1, a = i / (n * 2) * Math.PI * 2 + Math.PI / 2; const x = Math.cos(a) * r, y = Math.sin(a) * r; i ? s.lineTo(x, y) : s.moveTo(x, y); } s.closePath(); return s; }
  function buildSkyStuff(){
    THERMALS.forEach(t => { const c = makeCloud(16); c.position.set(t.x, t.top + 22, t.z); scene.add(c); });
    for (let i = 0; i < 16; i++){ const c = makeCloud(14 + rnd() * 14); const a = rnd() * 6.28, r = 250 + rnd() * 900; c.position.set(Math.cos(a) * r, 300 + rnd() * 90, Math.sin(a) * r); scene.add(c); }
    const dotTex = canvasTex(32, 32, (g) => { const gr = g.createRadialGradient(16, 16, 0, 16, 16, 16); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 32, 32); });
    THERMALS.forEach(t => { const n = TOUCH ? 70 : 110, pos = new Float32Array(n * 3), st = []; for (let i = 0; i < n; i++) st.push({ a: rnd() * 6.28, r: Math.sqrt(rnd()) * t.r * 0.8, y: rnd() });
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      const pts = new THREE.Points(g, new THREE.PointsMaterial({ map: dotTex, size: 1.5, transparent: true, opacity: .5, depthWrite: false, color: '#ffffff' })); pts.frustumCulled = false; scene.add(pts); TP.push({ t, st, g, base: heightAt(t.x, t.z) }); });
    for (let i = 0; i < 10; i++){ const p = new THREE.Mesh(new THREE.SphereGeometry(0.25, 8, 6), new THREE.MeshLambertMaterial({ color: '#e9ecef', transparent: true, opacity: 0.7 })); p.visible = false; scene.add(p); PUFFS.push({ m: p, t: 0 }); }
    const starGeo = new THREE.ExtrudeGeometry(starShape(1.6, 0.7), { depth: 0.45, bevelEnabled: true, bevelSize: 0.15, bevelThickness: 0.15, bevelSegments: 2 }); starGeo.center();
    const starMat = new THREE.MeshPhongMaterial({ color: '#ffd43b', emissive: '#c98a00', emissiveIntensity: .45, shininess: 90 });
    const addStar = (x, y, z) => { const m = new THREE.Mesh(starGeo, starMat); m.position.set(x, y, z); scene.add(m); STARS.push({ m, x, y, z, got: false }); };
    THERMALS.forEach((t, i) => { [t.top - 95, t.top - 62, t.top - 32].forEach((y, k) => { const a = k * 2.1 + i; addStar(t.x + Math.cos(a) * t.r * 0.26, y, t.z + Math.sin(a) * t.r * 0.26); }); });
    [[-120, 70, 330], [-260, 55, 300], [200, 60, 300], [140, 95, 120], [-90, 120, 40], [60, 40, 420]].forEach(p => addStar(p[0], p[1], p[2]));
    { const pts = [[10, 150, 90], [40, 138, 175], [70, 128, 250]]; const cx = LAND.x, cz = LAND.z, rr = 55; for (let k = 0; k < 7; k++){ const ph = -2.2 + k * Math.PI / 3; pts.push([cx + rr * Math.sin(ph), 118 - k * 8, cz + rr * Math.cos(ph)]); }
      const geo = new THREE.TorusGeometry(RING_R, 0.75, 10, 48);
      pts.forEach((p, i) => { const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)]; const hd = Math.atan2(b[0] - a[0], b[2] - a[2]);
        const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: .5 })); m.position.set(p[0], p[1], p[2]); m.rotation.y = hd; scene.add(m); RINGS.push({ m, x: p[0], y: p[1], z: p[2], got: false }); }); }
    const leafGeo = new THREE.ShapeGeometry(starShape(0.55, 0.24)); const leafMats = ['#e8590c', '#f03e3e', '#f59f00'].map(c => new THREE.MeshLambertMaterial({ color: c, side: THREE.DoubleSide, emissive: c, emissiveIntensity: .25 }));
    const acornGeo = new THREE.SphereGeometry(0.3, 12, 10); const acornCap = new THREE.SphereGeometry(0.33, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2);
    const n = Math.floor(TRAIL.len / 16); for (let i = 1; i < n; i++){ const f = i / n; const p = trailAt(f); const side = (i % 2 ? 1 : -1) * 0.9; const x = p.x - p.tz * side, z = p.z + p.tx * side;
      let m; const acorn = i % 5 === 0; if (acorn){ m = new THREE.Group(); const b = new THREE.Mesh(acornGeo, M('#b5763a')); b.scale.set(1, 1.2, 1); m.add(b); const c = new THREE.Mesh(acornCap, M('#6b4a2f')); c.position.y = 0.18; m.add(c); }
      else m = new THREE.Mesh(leafGeo, leafMats[i % 3]);
      m.position.set(x, heightAt(x, z) + 0.9, z); scene.add(m); PICKS.push({ m, x, z, acorn, got: false, ph: rnd() * 6 }); }
  }
  function resetPicks(){ PICKS.forEach(p => { p.got = false; p.m.visible = true; }); }
  /* ---------- 마을버스 (모양) ---------- */
  let BUS = null;
  function buildBus(){
    if (!faceTex) faceTex = canvasTex(256, 128, (g, W, Hh) => { g.fillStyle = '#ffdcca'; g.fillRect(0, 0, W, Hh); for (const s of [-1, 1]){ g.fillStyle = '#24171d'; g.beginPath(); g.ellipse(64 + s * 22, 66, 8, 10, 0, 0, 7); g.fill(); g.fillStyle = 'rgba(255,110,140,.5)'; g.beginPath(); g.ellipse(64 + s * 36, 80, 10, 6, 0, 0, 7); g.fill(); } g.fillStyle = '#c4485a'; g.beginPath(); g.arc(64, 86, 6, 0, Math.PI); g.fill(); });
    const g = new THREE.Group(); const side = canvasTex(512, 160, (c, W, Hh) => { c.fillStyle = '#7cc35a'; c.fillRect(0, 0, W, Hh); c.fillStyle = '#ffffff'; c.fillRect(0, 0, W, 22); c.fillStyle = '#cfefff'; for (let i = 0; i < 5; i++){ roundRect(c, 18 + i * 98, 32, 80, 58, 10); c.fill(); }
      c.fillStyle = '#fff'; c.font = 'bold 40px Jua, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('양방산 정상행', W / 2, 124); });
    const front = canvasTex(256, 232, (c, W, Hh) => { c.fillStyle = '#7cc35a'; c.fillRect(0, 0, W, Hh); c.fillStyle = '#222'; c.fillRect(30, 12, 196, 38); c.fillStyle = '#ffd43b'; c.font = 'bold 30px Jua, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('양방산', W / 2, 32);
      c.fillStyle = '#cfefff'; roundRect(c, 22, 62, 212, 92, 12); c.fill(); c.fillStyle = '#fff3bf'; c.beginPath(); c.arc(48, 196, 16, 0, 7); c.arc(208, 196, 16, 0, 7); c.fill(); });
    const back = canvasTex(256, 232, (c, W, Hh) => { c.fillStyle = '#7cc35a'; c.fillRect(0, 0, W, Hh); c.fillStyle = '#cfefff'; roundRect(c, 30, 26, 196, 80, 12); c.fill(); c.fillStyle = '#fff'; c.font = 'bold 28px Jua, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('아기 마을버스', W / 2, 146); c.fillStyle = '#ff6b6b'; c.beginPath(); c.arc(44, 196, 14, 0, 7); c.arc(212, 196, 14, 0, 7); c.fill(); });
    const sm = new THREE.MeshLambertMaterial({ map: side }), fm = new THREE.MeshLambertMaterial({ map: front }), bm = new THREE.MeshLambertMaterial({ map: back }), gm = M('#7cc35a');
    const body = new THREE.Mesh(new THREE.BoxGeometry(2.7, 2.3, 7.6), [sm, sm, M('#ffffff'), gm, fm, bm]); body.position.y = 1.75; g.add(body);
    const W = []; for (const [x, z] of [[-1.25, 2.6], [1.25, 2.6], [-1.25, -2.6], [1.25, -2.6]]) W.push(wheel(0.5, 0.34, g, x, 0.5, z));
    const heads = []; const hm = new THREE.MeshLambertMaterial({ map: faceTex, emissive: '#ffcdb8', emissiveIntensity: 0.42 });
    [-2.7, -1.35, 0, 1.35, 2.7].forEach(z => { for (const s of [-1, 1]){ const h = new THREE.Mesh(new THREE.SphereGeometry(0.34, 16, 12), hm); h.position.set(s * 0.95, 2.25, z); h.rotation.y = s > 0 ? Math.PI / 2 : -Math.PI / 2; h.visible = false; g.add(h); heads.push(h); } });
    scene.add(g); const home = { x: STOP_POS.x + 3, z: STOP_POS.z + 5, h: -Math.PI / 2 }; g.position.set(home.x, groundAt(home.x, home.z), home.z); g.rotation.y = home.h;
    BUS = { g, W, heads, home, state: 'idle', o: { x: home.x, z: home.z, heading: home.h, idx: 0 }, route: null, backT: 0, t0: 0, riders: 0, ai: 0 };
  }

  /* ---------- 아기 (바다와 똑같은 아기) · 헬멧 · 날개 ---------- */
  const WING_H = 6.4, BABY_H = 2.0;
  const skyGearOf = (g, keepCap, keepVest) => Object.assign({}, g, { mask: 'none', snorkel: 'off', fins: 'none', tube: 'none', board: 'none', vest: keepVest ? g.vest : 'none', cap: keepCap ? g.cap : 'none' });
  function headBox(head){ head.updateMatrixWorld(true); const inv = new THREE.Matrix4().copy(head.matrixWorld).invert(), box = new THREE.Box3(), tmp = new THREE.Box3(), m = new THREE.Matrix4();
    head.traverse(o => { if (o.isMesh && o.visible){ if (!o.geometry.boundingBox) o.geometry.computeBoundingBox(); tmp.copy(o.geometry.boundingBox).applyMatrix4(m.multiplyMatrices(inv, o.matrixWorld)); box.union(tmp); } }); return box; }
  function addHelmet(b, kind, color){
    const head = b.rig.CH.head; if (!head) return; const bx = headBox(head), c = bx.getCenter(new THREE.Vector3()), s = bx.getSize(new THREE.Vector3()), R = Math.max(s.x, s.z) * 0.53;
    const g = new THREE.Group(); g.position.copy(c); head.add(g); b.helmet = g;
    const hc = color || '#ffd43b', hmat = new THREE.MeshPhongMaterial({ color: hc, shininess: 60 });
    const dome = new THREE.Mesh(new THREE.SphereGeometry(R, 32, 18, 0, Math.PI * 2, 0, Math.PI * 0.47), hmat); dome.rotation.x = -0.42; dome.position.set(0, R * 0.12, -R * 0.05); g.add(dome);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(R * 0.99, R * 0.07, 8, 40), new THREE.MeshPhongMaterial({ color: new THREE.Color(hc).offsetHSL(0, 0, -0.12), shininess: 40 })); rim.rotation.x = Math.PI / 2; rim.position.y = R * Math.cos(Math.PI * 0.47); dome.add(rim);
    if (kind === 'bear'){ const inner = M('#ffd6e0');
      for (const sd of [-1, 1]){ const e = new THREE.Mesh(new THREE.SphereGeometry(R * 0.31, 16, 12), hmat); e.scale.set(1, 1, 0.6); e.position.set(sd * R * 0.66, R * 0.9, -R * 0.2); g.add(e);
        const ei = new THREE.Mesh(new THREE.SphereGeometry(R * 0.18, 12, 10), inner); ei.scale.set(1, 1, 0.4); ei.position.set(sd * R * 0.66, R * 0.88, -R * 0.04); g.add(ei); }
      const n = new THREE.Vector3(0, 0.62, 0.79).normalize(), q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), n);
      const lensM = new THREE.MeshPhongMaterial({ color: '#9fe3ff', shininess: 120, specular: '#ffffff' }), rimM = M('#ff8fab');
      for (const sd of [-1, 1]){ const p = n.clone().multiplyScalar(R * 1.02); p.x = sd * R * 0.28; const l = new THREE.Mesh(new THREE.CylinderGeometry(R * 0.22, R * 0.22, R * 0.08, 20), lensM); l.quaternion.copy(q); l.position.copy(p); g.add(l);
        const r = new THREE.Mesh(new THREE.TorusGeometry(R * 0.23, R * 0.05, 8, 20), rimM); r.quaternion.copy(q).multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI / 2)); r.position.copy(p); g.add(r); } }
  }
  /* 바다 아기를 그대로 만들어 하늘 크기(체험판 아기 키)에 맞춘다. w = 바깥 묶음(세계 단위), g = 바다 아기(키 맞춰 늘림) */
  function makeBaby(gear, opt = {}){
    const rig = H.newRig(); const w = new THREE.Group(), g = new THREE.Group(); w.add(g); g.add(rig.root); rig.root.position.set(0, 0, 0); rig.root.rotation.set(0, 0, 0); rig.root.visible = true;
    H.buildBabyInto(rig, skyGearOf(gear, opt.keepCap, opt.keepVest)); rig.root.updateMatrixWorld(true);
    const bb = new THREE.Box3().setFromObject(rig.root), h = Math.max(0.3, bb.max.y - Math.min(0, bb.min.y)), sc = BABY_H / h * (opt.scale || 1); g.scale.setScalar(sc); g.position.y = -Math.min(0, bb.min.y) * sc;
    const b = { w, g, rig, sc, scale: opt.scale || 1, st: 'idle', o: {}, harness: null, helmet: null };
    if (opt.helmet) addHelmet(b, opt.helmet, opt.helmetColor);
    const hn = new THREE.Mesh(new THREE.SphereGeometry(0.5, 16, 12), M('#4a4e69')); hn.scale.set(1.2, 0.55, 1.25); hn.position.set(0, 0.36, -0.12); hn.visible = false; w.add(hn); b.harness = hn;
    return b;
  }
  function freeBaby(b){ if (!b) return; H.disposeRig(b.rig); b.w.parent?.remove(b.w); }
  const T0 = () => ({ pitch: 0, yaw: 0, roll: 0, bob: 0, aLx: 0, aRx: 0, aLz: 0.15, aRz: -0.15, lLx: 0, lRx: 0, lLz: 0, lRz: 0 });
  const setSt = (b, st, o = {}) => { b.st = st; b.o = o; if (b.harness) b.harness.visible = false; };
  function poseFly(b, brake, t){ const T = T0(); T.pitch = -0.08; T.bob = 0.04; T.lLx = -1.35 + Math.sin(t * 3) * 0.12; T.lRx = -1.35 + Math.sin(t * 3 + 1.5) * 0.12; T.aLx = -2.75 + brake[0] * 1.1; T.aRx = -2.75 + brake[1] * 1.1; T.aLz = 0.35; T.aRz = -0.35; setSt(b, 'pose', { T }); b.harness.visible = true; }
  function poseStand(b, mv, run){ setSt(b, mv ? (run ? 'run' : 'walk') : 'idle', { moving: !!mv }); }
  function poseSeat(b, armX = -1.15){ const T = T0(); T.pitch = -0.1; T.lLx = T.lRx = -1.45; T.aLx = T.aRx = armX; T.aLz = 0.25; T.aRz = -0.25; setSt(b, 'pose', { T }); }
  function posePedal(b, ph){ const T = T0(); T.pitch = 0.12; T.lLx = -1.05 + Math.sin(ph) * 0.5; T.lRx = -1.05 - Math.sin(ph) * 0.5; T.aLx = T.aRx = -1.2; T.aLz = 0.25; T.aRz = -0.25; setSt(b, 'pose', { T }); }
  function poseKick(b, ph, mv){ const T = T0(); T.pitch = 0.08; T.aLx = T.aRx = -1.15; T.aLz = 0.12; T.aRz = -0.12; T.lRx = mv ? Math.max(0, Math.sin(ph)) * 0.9 - 0.1 : 0; setSt(b, 'pose', { T }); }
  function poseLie(b, ph, mv){ const T = T0(), k = Math.sin(ph); T.pitch = -1.36 + Math.sin(ph * 0.35) * 0.03; T.roll = Math.sin(ph * 0.5) * (mv ? 0.05 : 0.02); T.aLz = 1.0 + k * 0.25; T.aRz = -(1.0 - k * 0.25); T.aLx = T.aRx = -0.2; T.lLx = -0.35 + k * (mv ? 0.25 : 0.08); T.lRx = -0.35 - k * (mv ? 0.25 : 0.08); T.lLz = 0.18; T.lRz = -0.18; setSt(b, 'pose', { T }); }
  function poseSkate(b, ph, mv){ const T = T0(), s = Math.sin(ph) * (mv ? 1 : 0); T.pitch = 0.22; T.roll = s * 0.08; T.lLz = 0.12 + Math.max(0, s) * 0.45; T.lRz = -(0.12 + Math.max(0, -s) * 0.45); T.lLx = T.lRx = -0.15; T.aLx = s * 0.6; T.aRx = -s * 0.6; T.aLz = 0.6; T.aRz = -0.6; setSt(b, 'pose', { T }); }
  function posePiggy(b){ const T = T0(); T.pitch = -0.05; T.lLx = T.lRx = -1.0; T.lLz = 0.55; T.lRz = -0.55; T.aLx = T.aRx = -1.65; T.aLz = -0.25; T.aRz = 0.25; setSt(b, 'pose', { T }); }
  function poseCarry(b, ph, mv){ const T = T0(), s = Math.sin(ph) * (mv ? 1 : 0); T.pitch = 0.18; T.lLx = s * 0.7; T.lRx = -s * 0.7; T.bob = Math.abs(Math.cos(ph)) * 0.05 * (mv ? 1 : 0); T.aLx = T.aRx = 0.9; T.aLz = 0.45; T.aRz = -0.45; setSt(b, 'pose', { T }); }
  function poseHard(b, k){ const T = T0(); T.pitch = -Math.sin(Math.PI * k) * 0.9; T.bob = -Math.sin(Math.PI * k) * 0.12; T.aLz = 1.4; T.aRz = -1.4; setSt(b, 'pose', { T }); }

  function wingShape(x, y, z, span, R){ const u = x / (span / 2); const taper = 0.42 + 0.58 * Math.sqrt(Math.max(0, 1 - u * u * 0.94)); const z2 = z * taper + (1 - taper) * 0.25; const ang = x / R; return [(R + y) * Math.sin(ang), (R + y) * Math.cos(ang) - R, z2]; }
  function makeWing(pal){
    const span = 9.4, chord = 2.5, R = 9.5, segs = pal.cols.length * 3;
    const geo = new THREE.BoxGeometry(span, 0.38, chord, segs, 1, 3).toNonIndexed(); const p = geo.attributes.position; const cols = [];
    for (let i = 0; i < p.count; i += 3){ const cx = (p.getX(i) + p.getX(i + 1) + p.getX(i + 2)) / 3; const cell = clamp(Math.floor((cx / span + 0.5) * segs), 0, segs - 1); const c = new THREE.Color(pal.cols[cell % pal.cols.length]); for (let k = 0; k < 3; k++) cols.push(c.r, c.g, c.b); }
    for (let i = 0; i < p.count; i++){ const [a, b, c] = wingShape(p.getX(i), p.getY(i), p.getZ(i), span, R); p.setXYZ(i, a, b, c); }
    geo.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3)); geo.computeVertexNormals();
    const g = new THREE.Group(); g.add(new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide })));
    if (pal.stars){ const sm = new THREE.MeshBasicMaterial({ color: '#fff3bf' }); for (let i = 0; i < 9; i++){ const x = (i / 8 - 0.5) * span * 0.82, [a, b, c] = wingShape(x, 0.2, (i % 2 ? 0.45 : -0.35), span, R); const s = new THREE.Mesh(new THREE.OctahedronGeometry(0.16), sm); s.position.set(a, b + 0.02, c); g.add(s); } }
    const lp = []; for (const f of [-0.95, -0.7, -0.45, -0.2, 0.2, 0.45, 0.7, 0.95]){ for (const zz of [0.6, -0.3]){ const [a, b, c] = wingShape(f * span / 2, -0.19, zz, span, R); lp.push(a, b, c, (f < 0 ? -0.34 : 0.34), -WING_H + 1.0, 0); } }
    const lg = new THREE.BufferGeometry(); lg.setAttribute('position', new THREE.Float32BufferAttribute(lp, 3));
    const lines = new THREE.LineSegments(lg, new THREE.LineBasicMaterial({ color: '#555566', transparent: true, opacity: .55 })); g.add(lines);
    return { g, lines };
  }
  const wingPal = id => WINGS[id] || WINGS.rainbow;
  /* 패러글라이더 한 벌: 날개 · 줄 · 아기. 땅에서는 날개를 접어 숨긴다 */
  function makeGlider(gear, wingId, name, tagBg, opt = {}){
    const rig = new THREE.Group(); const pivot = new THREE.Group(); pivot.position.y = WING_H; rig.add(pivot);
    const wing = makeWing(wingPal(wingId)); pivot.add(wing.g); const hang = new THREE.Group(); hang.position.y = -WING_H; pivot.add(hang);
    const helmet = opt.helmet || gear.helmet || 'basic';
    const baby = makeBaby(gear, { helmet: helmet === 'none' ? null : helmet, helmetColor: wingPal(wingId).helmet, scale: opt.scale }); hang.add(baby.w);
    let tag = null; if (name){ tag = makeTag(name, tagBg || '#ffffff', tagBg ? '#fff' : '#3b3a4a'); tag.position.y = 2.75 * (opt.scale || 1); hang.add(tag); }
    scene.add(rig); return { rig, pivot, wing, hang, baby, tag, wingId };
  }
  function freeGlider(G0){ if (!G0) return; freeBaby(G0.baby); G0.rig.traverse(o => { if (o.isMesh || o.isLineSegments || o.isSprite){ o.geometry?.dispose?.(); const ms = Array.isArray(o.material) ? o.material : [o.material]; for (const m of ms){ m?.map?.dispose?.(); m?.dispose?.(); } } }); scene.remove(G0.rig); }

  /* ---------- AI 패러글라이더 · 마을 사람 · 동네 차 · 튼튼이 (모두 이름표에 AI라고 써요) ---------- */
  let NPCS = [], VILLAGERS = [], CARS = [], FRIEND = null, STAFF = [];
  /* 정상 안전요원 (AI) 5명: 이륙장 둘레에 서서 응원하고, 어떻게 출발하는지 차례로 말풍선으로 알려 줘요 */
  const STAFF_SPOTS = [[-8.5, 23], [8.5, 22], [-9.5, 33.5], [9.5, 34], [6.5, 43]];
  const STAFF_NAMES = ['안전요원 바람이', '안전요원 하늘이', '안전요원 구름이', '안전요원 솔이', '안전요원 단풍이'];
  const STAFF_TIPS = () => [
    TOUCH ? '오른쪽 아래 [이륙!] 버튼을 누르면 앞으로 달려서 날아올라요!' : 'Space를 누르면 앞으로 달려서 날아올라요!',
    '바람은 앞쪽 남한강에서 불어와요. 주황 바람자루를 봐요!',
    '이륙장 가운데 하얀 줄에 서서 출발하면 똑바로 날아요',
    TOUCH ? '날 때는 조이스틱 ←→로 방향, 위로 밀면 가속, 아래로 당기면 브레이크!' : '날 때는 A·D로 방향, W는 가속, S는 브레이크!',
    '하얀 점이 빙글빙글 올라가는 곳에서 원을 그리면 쑥쑥 올라가요',
    '노란 링 10개를 따라 내려가요. 링 가까이 가면 살짝 링 쪽으로 끌어당겨 줘요',
    '마지막엔 남한강 착륙장 과녁 쪽으로 살짝 데려다줘요. 가운데에 내릴수록 점수가 커요',
    TOUCH ? '땅이 가까워지면 [브레이크]를 꾹! 사뿐 착륙해요' : '땅이 가까워지면 S를 꾹! 사뿐 착륙해요',
    '과녁 한가운데에 내리면 진주를 더 많이 받아요',
    '헬멧 꼭 쓰고, 출발 전에 앞에 아무도 없는지 봐요'];
  const STAFF_CHEER = ['화이팅!', '잘 다녀와~', '멋지다! 날았다!', '바람 좋다, 출발!', '하늘에서 손 흔들어 줘!'];
  const STAFF_WELCOME = ['어서 와! 또 날아 볼까?', '정상까지 왔구나, 대단해!', '숨 고르고 또 출발해요~'];
  function buildStaff(){
    STAFF_SPOTS.forEach(([x, z], i) => { const g0 = Object.assign(H.npcGear(4000 + i), { vest: 'vest', vestColor: '#c8f53a', cap: 'none' });
      const b = makeBaby(g0, { keepVest: true, helmet: 'basic', helmetColor: '#ff7a1a', scale: i === 4 ? 1.25 : 1.15 }); const grp = new THREE.Group(); grp.add(b.w);
      const tag = makeTag(STAFF_NAMES[i] + ' (AI)', '#ff7a1a', '#fff', 1.7); tag.position.y = 2.75 * b.scale + 0.15; grp.add(tag);
      grp.position.set(x, groundAt(x, z), z); grp.rotation.y = Math.atan2(PAD.x - x, PAD.z + 6 - z); scene.add(grp); COLL.push({ x, z, r: 0.7 });
      STAFF.push({ b, grp, tag, x, z, h: grp.rotation.y, bubble: null, bubbleT: 0, waveT: 0 }); });
    STAFF.tip = 0; STAFF.t = 1.5;
  }
  const LINES_TOWN = ['안녕, 아기 파일럿!', '오늘 바람 좋다~', '마늘빵 먹어 봤니?', '구경시장 구경 왔구나!', '쏘가리 매운탕 거리는 강변 쪽이야', '하늘에서 우리 집 보였어?', '다리 건너면 착륙장이야'];
  const LINES_VIL = ['착륙 잘했어?', '가게에 킥보드 들어왔대!', '버스는 10명 모여야 출발해', '튼튼이가 업어 준대!', '정상까지 3.5km, 화이팅!', '오픈카 타면 바람이 시원해~'];
  function buildPeople(){
    [['콩이', 'berry', 0, 190], ['두부', 'sky', 1, 230], ['보리', 'lemon', 3, 260], ['몽이', 'mint', 2, 170]].forEach(([nm, wg, ti, alt], i) => { const r = makeGlider(H.npcGear(1000 + i), wg, nm + ' (AI)', '#8a7fd6');
      r.wing.g.visible = true; NPCS.push({ r, t: THERMALS[ti], a: rnd() * 6.28, alt, w: 0.32 + rnd() * 0.08, ph: rnd() * 6 }); });
    const mk = (area, ring, dir, i, scale) => { const b = makeBaby(H.npcGear(2000 + i), { keepCap: true, scale }); const grp = new THREE.Group(); grp.add(b.w); scene.add(grp);
      VILLAGERS.push({ b, grp, area, ring, dir, a: rnd() * 6.28, sp: 2.2 + rnd() * 1.2, pause: 0, walkT: 4 + rnd() * 8, cool: rnd() * 5, bubble: null, bubbleT: 0, x: 0, z: 0, h: 0, moving: false }); };
    const sc = i => [1, 1, 1.25, 1.3, 1.3, 1, 1, 1.15][i % 8];
    for (let i = 0; i < 6; i++) mk('town', 44, i % 2 ? 1 : -1, i, sc(i)); for (let i = 0; i < 5; i++) mk('town', 83, i % 2 ? -1 : 1, i + 6, sc(i + 3)); for (let i = 0; i < 3; i++) mk('town', 7 + i * 3, 1, i + 11, sc(i + 5));
    for (let i = 0; i < 4; i++) mk('vil', 8 + i * 3, i % 2 ? 1 : -1, i + 14, sc(i + 1));
    ['#4dabf7', '#ffd43b', '#69db7c'].forEach((c, i) => { const g = new THREE.Group(); box(1.8, 0.75, 3.2, c, 0, 0.75, 0, g); box(1.6, 0.7, 1.7, '#f1f3f5', 0, 1.45, -0.2, g); box(1.62, 0.5, 1.5, '#a5d8ff', 0, 1.48, -0.2, g);
      const W = []; for (const [x, z] of [[-0.9, 1.1], [0.9, 1.1], [-0.9, -1.1], [0.9, -1.1]]) W.push(wheel(0.38, 0.25, g, x, 0.38, z)); scene.add(g); CARS.push({ g, W, a: i * Math.PI * 2 / 3, sp: 7.5, honk: 0 }); });
    const fb = makeBaby(H.npcGear(3333), { helmet: 'basic', helmetColor: '#ff922b', scale: 1.4 }); const grp = new THREE.Group(); grp.add(fb.w);
    const tag = makeTag(`튼튼이 (AI) · 업어 줄게! 진주 ${PIGGY_PRICE}`, '#ff922b', '#fff', 2.6); tag.position.y = 3.6; grp.add(tag); grp.position.set(FRIEND_HOME.x, groundAt(FRIEND_HOME.x, FRIEND_HOME.z), FRIEND_HOME.z); scene.add(grp);
    FRIEND = { b: fb, grp, tag, state: 'idle', o: { x: FRIEND_HOME.x, z: FRIEND_HOME.z, heading: 0, idx: 0 }, route: null, backT: 0, ph: 0 };
  }

  /* ============================== 나 · 진주 · 탈것 ============================== */
  let me = null, skates = null, myKey = '';
  const P = { x: PAD.x, y: PH, z: PAD.z - 4, heading: 0, mode: 'ground', vy: 0, jv: 0, speed: 0, turn: 0, roll: 0, anim: 0, flare: 1, tk: null, landT: 0, sitT: 0, warned: false, moving: false, spd: 0, idleT: 0,
    ride: null, auto: store.get('auto', false), boost: 0, wwarn: false, f: { t: 0, maxY: 0, stars: 0, rings: 0 }, climb: { active: false, t: 0, steps: 0, rode: false }, steps: 0,
    bt: 0, bgo: false, pq: null, cy: '', carrier: '', run: false };
  let SEL = store.get('sel', null), leafTotal = store.get('leaf', 0), acornTotal = store.get('acorn', 0);
  let best = Object.assign({ score: 0, acc: null, climb: 0 }, store.get('best2', {}));
  let lastResult = null, flights = store.get('flights', 0);
  const owns = id => H.owns('veh', id);
  const ownList = () => VEH.filter(v => owns(v.id)).map(v => v.id);
  const toast = (m, cls) => H.toast(m, cls);
  const beep = (f, dur = 0.1, vol = 0.12, type = 'sine', f2) => H.AudioSys.blip(f, f2 || f * 1.001, dur, type, vol);
  const chime = () => H.AudioSys.chime ? H.AudioSys.chime() : (beep(880, 0.12, 0.1), setTimeout(() => beep(1320, 0.18, 0.1), 90));
  const honk = () => { beep(392, 0.16, 0.09, 'square'); setTimeout(() => beep(392, 0.2, 0.09, 'square'), 200); };
  function limbBox(o){ return headBox(o); }
  function attachSkates(on){ if (!me) return; const legs = me.baby.rig.CH.legs; if (!legs) return;
    if (on && !skates){ skates = legs.map(l => { const bx = limbBox(l), c = bx.getCenter(new THREE.Vector3()), s = makeSkate(); s.scale.setScalar(1 / me.baby.sc); s.position.set(c.x, bx.min.y - 0.04 / me.baby.sc, c.z + 0.02 / me.baby.sc); l.add(s); return s; }); }
    if (!on && skates){ skates.forEach(s => s.parent?.remove(s)); skates = null; } }
  function buildPlayer(){ const vis = me ? me.wing.g.visible : false; const lines = me ? me.wing.lines.visible : false;
    if (me){ attachSkates(false); freeGlider(me); }
    const gear = H.gear(); me = makeGlider(gear, gear.wing || 'rainbow', H.nick() || '아기 파일럿', '', { helmet: gear.helmet || 'basic' }); me.wing.g.visible = vis; me.wing.lines.visible = lines;
    if (P.ride === 'roller') attachSkates(true); }
  function puffAt(x, y, z){ for (let i = 0; i < 5; i++){ const p = PUFFS.find(q => !q.m.visible); if (!p) break; p.m.visible = true; p.t = 0; p.m.position.set(x + (Math.random() - 0.5) * 1.5, y + 0.4 + Math.random(), z + (Math.random() - 0.5) * 1.5); p.vy = 1 + Math.random(); } }
  function mount(id){ if (P.mode !== 'ground' || !owns(id)) return; if (P.cy){ toast('친구를 업고 있을 때는 탈것을 못 타요'); return; } if (P.ride) dismount(true); P.ride = id; SEL = id; store.set('sel', id); vobj(id).g.visible = true; attachSkates(id === 'roller'); puffAt(P.x, P.y, P.z);
    if (P.climb.active) P.climb.rode = true; toast(`${VEHMAP[id].icon} ${VEHMAP[id].name} 출발!`); beep(660, 0.1, 0.08); setTimeout(() => beep(880, 0.12, 0.08), 90); }
  function dismount(silent){ if (!P.ride) return; const v = VOBJ[P.ride]; if (v) v.g.visible = false; attachSkates(false); P.ride = null; if (!silent) toast('탈것에서 내렸어요'); }
  function toggleRide(){ if (P.mode !== 'ground') return; if (P.ride){ dismount(); return; } const own = ownList(); if (SEL && owns(SEL)) mount(SEL); else if (own.length) mount(own[0]); else { H.openStore('veh'); toast('아직 탈것이 없어요. 진주로 사 보세요!'); } }
  function toggleAuto(){ P.auto = !P.auto; store.set('auto', P.auto); toast(P.auto ? '길 자동 따라가기를 켰어요. 다리와 등산로를 따라 정상까지 가요' : '길 자동 따라가기를 껐어요'); }
  const needPts = n => { if (H.pearl() >= n) return true; toast(`진주가 ${n - H.pearl()}개 더 필요해요. 사뿐히 착륙하면 진주가 쌓여요`); return false; };
  function buySnack(){ if (!needPts(SNACK_PRICE)) return; H.spendPearl(SNACK_PRICE); P.boost = 60; toast('냠냠 마늘빵! 1분 동안 걸음이 빨라져요'); beep(700, 0.1, 0.08); }
  function sitBench(b){ dismount(true); P.mode = 'sit'; P.sitT = 0; P.x = b.x; P.z = b.z; P.heading = b.face; cam.yaw = b.face + Math.PI; toast('산멍 중… 남한강을 바라봐요'); }
  function standUp(){ P.mode = 'ground'; P.x += Math.sin(P.heading) * 1.3; P.z += Math.cos(P.heading) * 1.3; if (P.sitT > 20) toast(`산멍 ${Math.floor(P.sitT)}초! 마음이 편안해졌어요`); }
  /* 마을버스: 진짜 친구가 10명 모이면 바로, 아니면 처음 탄 사람 기준 20초 뒤 AI 친구가 빈자리를 채우고 출발 */
  function boardBus(){ if (BUS.state === 'go' || BUS.state === 'top'){ toast('버스가 이미 출발했어요. 금방 돌아와요'); return; } if (!needPts(BUS_PRICE)) return; H.spendPearl(BUS_PRICE); dismount(true); P.mode = 'bus'; P.bt = Date.now(); P.bgo = false; if (P.climb.active) P.climb.rode = true;
    toast(`버스에 탔어요! 친구 ${BUS_SEATS}명이 모이면 바로, 아니면 ${BUS_AI_WAIT}초 뒤 AI 친구들이 빈자리를 채우고 출발해요`); }
  function cancelBus(){ if (P.mode !== 'bus' || P.bgo) return; H.addPearl(BUS_PRICE); P.mode = 'ground'; P.bt = 0; P.x = STOP_POS.x - 3; P.z = STOP_POS.z - 3; toast(`버스에서 내렸어요 (진주 ${BUS_PRICE}개 돌려받음)`); }
  function resetBus(){ BUS.state = 'idle'; BUS.riders = 0; BUS.ai = 0; BUS.heads.forEach(h => h.visible = false); BUS.o = { x: BUS.home.x, z: BUS.home.z, heading: BUS.home.h, idx: 0 }; placeVehicle(BUS.g, BUS.o.x, BUS.o.z, BUS.o.heading, 3.5); }
  function startPiggy(){ if (!needPts(PIGGY_PRICE)) return; H.spendPearl(PIGGY_PRICE); dismount(true); P.mode = 'piggy'; P.carrier = ''; FRIEND.state = 'carry'; if (P.climb.active) P.climb.rode = true; const fp = FRIEND.grp.position; FRIEND.o = { x: fp.x, z: fp.z, heading: FRIEND.grp.rotation.y, idx: 0 };
    FRIEND.route = TRAIL.pts.slice(trailNearest(fp.x, fp.z).i).concat([[PAD.x, PAD.z - 3]]); toast('튼튼이: 꽉 잡아! 출발~'); beep(600, 0.1, 0.08); }
  function follow(o, route, speed, dt){ let rem = speed * dt; while (rem > 0 && o.idx < route.length){ const t = route[o.idx], dx = t[0] - o.x, dz = t[1] - o.z, d = Math.hypot(dx, dz); if (d <= rem){ o.x = t[0]; o.z = t[1]; rem -= d; o.idx++; } else { o.x += dx / d * rem; o.z += dz / d * rem; rem = 0; } }
    const la = route[Math.min(route.length - 1, o.idx + 2)]; if (la){ const hd = Math.atan2(la[0] - o.x, la[1] - o.z); if (Math.hypot(la[0] - o.x, la[1] - o.z) > 0.5) o.heading = lerpAngle(o.heading, hd, Math.min(1, dt * 4)); } return o.idx >= route.length; }
  function placeVehicle(g, x, z, h, L){ const fx = Math.sin(h), fz = Math.cos(h); const hf = groundAt(x + fx * L, z + fz * L), hb = groundAt(x - fx * L, z - fz * L); g.rotation.order = 'YXZ'; g.rotation.set(-Math.atan2(hf - hb, 2 * L), h, 0); g.position.set(x, (hf + hb) / 2, z); }
  function finishClimb(via){ staffCheer('back'); const was = P.climb.active, walk = via === '걷기' && !P.climb.rode; P.climb.active = false; const ct = P.climb.t; let nb = false;
    if (was && walk && ct >= 30){ if (!best.climb || ct < best.climb){ best.climb = Math.round(ct * 10) / 10; store.set('best2', best); nb = true; } H.skyRecord({ climb: Math.round(ct * 10) / 10 }); }
    toast(`정상 도착! ${via}${was ? ' · ' + fmtT(ct) : ''}${was && walk ? ' · ' + Math.round(P.climb.steps).toLocaleString() + '걸음' : ''}${nb ? ' · 걸어서 등산 최고 기록!' : ''} · ${TOUCH ? '[이륙!]' : 'Space'}로 다시 날아요`, nb ? 'found' : ''); chime(); }

  /* ============================== 조작 ============================== */
  const vk = { main: false, sub: false };
  const cam = { yaw: Math.PI, pitch: 0.3, d: 10, walkDist: 9, flyDist: 17, off: 0, drag: false, dragT: -9, tx: PAD.x, ty: PH, tz: PAD.z };
  function readInput(){ if (H.blocked()) return { x: 0, y: 0, run: false }; const k = H.keys, J = H.JOY; let x = 0, y = 0;
    if (k.KeyA || k.ArrowLeft) x -= 1; if (k.KeyD || k.ArrowRight) x += 1; if (k.KeyW || k.ArrowUp) y += 1; if (k.KeyS || k.ArrowDown) y -= 1;
    x += J.x || 0; y += J.y || 0; const flying = P.mode === 'flying'; if (flying && vk.main) y -= 1; if (flying && vk.sub) y += 1;
    return { x: clamp(x, -1, 1), y: clamp(y, -1, 1), run: !!(k.ShiftLeft || k.ShiftRight || (!flying && !P.ride && vk.sub)) }; }
  const nearPad = () => Math.hypot(P.x - PAD.x, P.z - PAD.z) < 19;
  function mainAction(){ if (resultOpen()) hideResult();
    if (P.mode === 'ground'){ if (P.cy){ toast('친구를 업고 있어요. 정상까지 걸어가요'); return; } if (nearPad()) startTakeoff(); else if (P.ride) honk(); else if (P.y <= groundAt(P.x, P.z) + 0.05){ P.jv = 6.5; beep(520, 0.12, 0.08, 'sine', 780); } }
    else if (P.mode === 'sit') standUp(); }
  function useAction(){ if (P.mode === 'sit'){ standUp(); return; } if (P.mode === 'bus'){ cancelBus(); return; } if (P.mode === 'piggy' && P.carrier){ toast('친구가 내려 줄 때까지 꽉 잡아요'); return; } const it = nearInter(); if (it) it.act(); }
  function zoom(f){ if (P.mode === 'flying' || P.mode === 'takeoff') cam.flyDist = clamp(cam.flyDist * f, 5, 60); else cam.walkDist = clamp(cam.walkDist * f, 1.6, 40); }
  function drag(dx, dy){ const flying = P.mode === 'flying' || P.mode === 'takeoff'; if (flying) cam.off -= dx * 0.006; else cam.yaw -= dx * 0.006; cam.pitch = clamp(cam.pitch + dy * 0.004, -0.15, 1.25); cam.drag = true; cam.dragT = NOW; }
  function interactables(){ const L = [
    { x: SHOP_POS.x, z: SHOP_POS.z, r: 10, label: '아기 탈것 가게 들어가기', short: '가게', act: () => H.openStore('veh') },
    { x: SNACK_POS.x, z: SNACK_POS.z, r: 5.5, label: `마늘빵 사 먹기 (진주 ${SNACK_PRICE})`, short: '마늘빵', act: buySnack },
    { x: STOP_POS.x, z: STOP_POS.z, r: 7, label: `마을버스 타기 (진주 ${BUS_PRICE})`, short: '버스', act: boardBus, ok: () => BUS.state === 'idle' || BUS.state === 'wait' },
    { x: FRIEND.grp.position.x, z: FRIEND.grp.position.z, r: 5, label: `튼튼이(AI)에게 업히기 (진주 ${PIGGY_PRICE})`, short: '업히기', act: startPiggy, ok: () => FRIEND.state === 'idle' && !P.cy },
    ...BENCHES.map(b => ({ x: b.x, z: b.z, r: 4.5, label: '벤치에 앉아 산멍하기', short: '앉기', act: () => sitBench(b), ok: () => !P.cy }))];
    if (P.cy){ const R = remoteById(P.cy); L.push({ x: P.x, z: P.z, r: 99, label: `${R ? R.name : '친구'} 님 내려 주기`, short: '내려 주기', act: () => putDown(true) }); }
    else for (const R of REMOTES.values()) if (R.md === 'g' && !R.rd && !R.cy && R.id) L.push({ x: R.tgt.x, z: R.tgt.z, r: 5, label: `${R.name} 님에게 업어 달라고 하기`, short: '업어 줘', act: () => requestPiggy(R) });
    return L; }
  function nearInter(){ if (P.mode !== 'ground') return null; let b = null, bd = 1e9; for (const it of interactables()){ if (it.ok && !it.ok()) continue; const d = Math.hypot(P.x - it.x, P.z - it.z); if (d < it.r && d < bd){ bd = d; b = it; } } return b; }

  /* ============================== 날기 · 착륙 ============================== */
  let NOW = 0, varioT = 0, puffT = 0; const V3 = new THREE.Vector3();
  function resetFlightStats(){ P.f = { t: 0, maxY: P.y, stars: 0, rings: 0 }; STARS.forEach(s => { s.got = false; s.m.visible = true; }); RINGS.forEach(r => { r.got = false; r.m.visible = true; }); }
  function resetToPad(){ dismount(true); P.mode = 'ground'; P.x = PAD.x; P.z = PAD.z - 5; P.y = PH; P.heading = 0; P.vy = P.jv = 0; P.roll = 0; cam.yaw = Math.PI; cam.off = 0; P.climb.active = false; P.bt = 0; P.bgo = false; P.cy = ''; P.carrier = ''; P.pq = null;
    if (me){ me.wing.g.visible = false; me.rig.visible = true; } resetFlightStats(); resetPicks(); }
  function startTakeoff(){ dismount(true); P.mode = 'takeoff'; P.tk = { t: 0, sx: P.x, sz: P.z, ex: PAD.x, ez: PAD.z + 27 }; P.heading = 0; me.wing.g.visible = true; me.wing.lines.visible = false; resetFlightStats(); P.f.maxY = P.y; P.climb.active = false;
    cam.off = 0; beep(300, 0.5, 0.06, 'triangle', 600); toast('달려! 달려!'); staffCheer('go'); }
  function thermalLift(x, y, z){ let L = 0; for (const t of THERMALS){ const d = Math.hypot(x - t.x, z - t.z); if (d < t.r) L += t.s * (1 - (d / t.r) ** 2) * smooth(t.top + 20, t.top - 50, y); else if (d < t.r * 1.5) L -= 0.3 * (1 - (d - t.r) / (t.r * 0.5)); } return L; }
  function thermalAt(x, z){ for (const t of THERMALS){ const d = Math.hypot(x - t.x, z - t.z); if (d < t.r) return { t, d, k: 1 - d / t.r }; } return null; }
  function ridgeLift(x, z, agl){ if (agl > 45) return 0; const ws = Math.hypot(WIND.x, WIND.z), ux = WIND.x / ws, uz = WIND.z / ws; const sl = (heightAt(x + ux * 8, z + uz * 8) - heightAt(x, z)) / 8; if (sl <= 0) return 0; return Math.min(2.2, ws * sl * 1.6) * (1 - agl / 45); }
  function autoTarget(){ if (onBridge(P.x, P.z)) return { x: BR.nearEnd[0] - BR.dx * 8, z: BR.nearEnd[1] - BR.dz * 8, name: '다리 (고수대교)' }; const across = P.z > riverZ(P.x) + 6; if (across){ const dT = Math.hypot(P.x - BR.townEnd[0], P.z - BR.townEnd[1]); const e = (onBridge(P.x, P.z) || dT < 6) ? BR.nearEnd : BR.townEnd; return { x: e[0], z: e[1], name: '다리 (고수대교)' }; }
    const tn = trailNearest(P.x, P.z); if (tn.d > 10){ const p = TRAIL.pts[tn.i]; return { x: p[0], z: p[1], name: '등산로' }; } const j = Math.min(TRAIL.pts.length - 1, tn.i + 6); if (j >= TRAIL.pts.length - 2) return { x: PAD.x, z: PAD.z, name: '이륙장' }; const p = TRAIL.pts[j]; return { x: p[0], z: p[1], name: '정상 방향' }; }
  function updateGround(dt, inp){
    const V = P.ride ? VEHMAP[P.ride] : null; let mx = 0, mz = 0; const manual = Math.hypot(inp.x, inp.y) > 0.08; P.autoMoving = false;
    if (manual){ const fx = -Math.sin(cam.yaw), fz = -Math.cos(cam.yaw), rx = -fz, rz = fx; mx = fx * inp.y + rx * inp.x; mz = fz * inp.y + rz * inp.x; }
    else if (P.auto && Math.hypot(P.x - PAD.x, P.z - PAD.z) > 9){ const t = autoTarget(); mx = t.x - P.x; mz = t.z - P.z; const l = Math.hypot(mx, mz) || 1; mx /= l; mz /= l; P.autoMoving = true; }
    const mag = Math.hypot(mx, mz); P.moving = mag > 0.08; P.spd = 0; P.run = false;
    if (P.moving){ const dx = mx / mag, dz = mz / mag; let sp = V ? V.speed : (inp.run || P.autoMoving ? 13 : 8); P.run = !V && sp > 10; if (!V && P.boost > 0) sp *= 1.3; if (P.cy) sp *= 0.8; sp *= Math.min(1, mag);
      const h0 = heightAt(P.x, P.z), gr = (heightAt(P.x + dx * 1.5, P.z + dz * 1.5) - h0) / 1.5;
      if (V) sp *= lerp(1, V.climb, smooth(0.12, 0.6, gr)); else { if (gr > 0.55) sp *= 0.7; if (gr > 1.1) sp *= 0.5; }
      if (!V && h0 < WATER - 0.2 && !onBridge(P.x, P.z)) sp *= 0.45;
      let nx = P.x + dx * sp * dt, nz = P.z + dz * sp * dt;
      if (onBridge(P.x, P.z) && !onBridge(nx, nz) && Math.abs((nx - BR.x) * BR.dx + (nz - BR.z) * BR.dz) < BR.half - 0.3){ const lz = (nx - BR.x) * BR.dx + (nz - BR.z) * BR.dz, lx = clamp((nx - BR.x) * BR.dz - (nz - BR.z) * BR.dx, -BR.w + 0.4, BR.w - 0.4); nx = BR.x + BR.dx * lz + BR.dz * lx; nz = BR.z + BR.dz * lz - BR.dx * lx; }
      if (V && heightAt(nx, nz) < WATER - 0.1 && !onBridge(nx, nz)){ nx = P.x; nz = P.z; sp = 0; if (!P.wwarn){ toast(`${V.name}는 물에 못 들어가요! 다리로 건너요`); P.wwarn = true; } } else P.wwarn = false;
      const o = { x: nx, z: nz }; pushOut(o, V ? vobj(P.ride).rad : 0.55); P.x = o.x; P.z = o.z;
      P.heading = lerpAngle(P.heading, Math.atan2(dx, dz), Math.min(1, dt * (V ? 4.5 : 10))); P.spd = sp; P.anim += sp * dt * (V ? 0.9 : 1.5);
      if (!V){ const st = sp * dt / 0.55; P.steps += st; if (P.climb.active) P.climb.steps += st; }
      const R = Math.hypot(P.x, P.z); if (R > 1150){ P.x *= 1150 / R; P.z *= 1150 / R; } P.idleT = 0;
    } else P.idleT += dt;
    if (P.boost > 0) P.boost -= dt; if (P.climb.active) P.climb.t += dt;
    const g = groundAt(P.x, P.z);
    if (!V && (P.jv > 0 || P.y > g + 0.6)){ P.jv -= 18 * dt; P.y += P.jv * dt; if (P.y <= g){ P.y = g; P.jv = 0; } } else { P.y = g; P.jv = 0; }
    P.roll = lerp(P.roll, 0, dt * 5);
    if (!V && P.idleT > 1.2 && !P.cy){ const cb = Math.atan2(camera.position.x - P.x, camera.position.z - P.z); P.heading = lerpAngle(P.heading, cb, Math.min(1, dt * 3)); }
    for (const p of PICKS){ if (!p.got && Math.hypot(P.x - p.x, P.z - p.z) < (V ? 2.6 : 1.8)){ p.got = true; p.m.visible = false; if (p.acorn){ acornTotal++; store.set('acorn', acornTotal); toast('도토리 +1'); } else { leafTotal++; store.set('leaf', leafTotal); } beep(p.acorn ? 660 : 990, 0.08, 0.07); } }
    if (P.climb.active && Math.hypot(P.x - PAD.x, P.z - PAD.z) < 14) finishClimb(V ? V.name : P.cy ? '친구 업고 걷기' : '걷기');
  }
  function updateTakeoff(dt){
    const TT = 1.7; P.tk.t += dt; const t = Math.min(1, P.tk.t / TT), e = t * t; P.x = lerp(P.tk.sx, P.tk.ex, e); P.z = lerp(P.tk.sz, P.tk.ez, e);
    const g = groundAt(P.x, P.z); const lift = Math.max(0, (t - 0.55) / 0.45); P.y = lift > 0 ? Math.max(g + lift * lift * 2.4, P.y - 1.2 * dt) : g;
    const wi = smooth(0, 0.75, t); me.wing.g.position.set(0, lerp(-WING_H + 0.4, 0, wi), lerp(-6.5, 0, wi)); me.wing.g.rotation.x = lerp(-1.45, 0, wi); me.wing.g.scale.setScalar(lerp(0.55, 1, wi)); me.wing.lines.visible = t > 0.78;
    P.anim += dt * 14 * (0.4 + t); P.moving = true;
    if (t >= 1){ P.mode = 'flying'; P.speed = 9; P.vy = -0.2; P.turn = 0; P.y = Math.max(P.y, heightAt(P.x, P.z) + 2.4); P.flare = 1; P.f.maxY = P.y; toast('날았다!'); beep(660, 0.15, 0.08); setTimeout(() => beep(990, 0.2, 0.08), 120); }
  }
  function updateFlight(dt, inp){
    const F = P.f; P.turn = lerp(P.turn, -inp.x * 0.85, Math.min(1, dt * 3)); P.heading = wrapA(P.heading + P.turn * dt); P.roll = lerp(P.roll, -P.turn * 0.75, Math.min(1, dt * 4));
    let tS = 11, sink = 1.3; if (inp.y > 0.2){ tS = lerp(11, 14.5, inp.y); sink += 0.85 * inp.y; } else if (inp.y < -0.2){ const b = -inp.y; tS = lerp(11, 7, b); sink += 0.3 * b; } sink += Math.abs(P.turn) * 0.5;
    P.speed = lerp(P.speed, tS, Math.min(1, dt * 1.5));
    const g = groundAt(P.x, P.z), agl = P.y - g;
    if (inp.y < -0.4 && agl < 6 && P.flare > 0){ sink *= 0.15; P.flare -= dt * 0.75; P.speed = lerp(P.speed, 5, dt * 2); }
    const lift = thermalLift(P.x, P.y, P.z) + ridgeLift(P.x, P.z, agl); P.vy = lerp(P.vy, -sink + lift, Math.min(1, dt * 2.2));
    const R = Math.hypot(P.x, P.z); if (R > 950){ P.heading = lerpAngle(P.heading, Math.atan2(-P.x, -P.z), dt * 0.7); if (!P.warned){ toast('너무 멀리 왔어요! 착륙장 쪽으로 돌아가요'); P.warned = true; } } else if (R < 850) P.warned = false;
    /* 링 보조: 앞쪽 가까이 있는 다음 링 쪽으로 방향과 높이를 살짝 맞춰 줘요 (조작을 세게 하면 내 조작이 먼저) */
    { const nr = RINGS.find(r => !r.got); P.assist = '';
      if (nr){ const dx = nr.x - P.x, dz = nr.z - P.z, dh = Math.hypot(dx, dz), ang = Math.atan2(dx, dz), off = Math.abs(wrapA(ang - P.heading));
        if (dh < RING_ASSIST && off < 1.0){ const k = smooth(RING_ASSIST, 20, dh) * (1 - Math.min(1, Math.abs(inp.x) * 1.5)); if (k > 0.02){ P.heading = lerpAngle(P.heading, ang, Math.min(1, dt * 1.6 * k)); P.vy += clamp((nr.y - (P.y + 1.5)) * 0.35, -2.2, 1.6) * k * dt * 2; P.assist = 'ring'; } } }
      else { const dx = LAND.x - P.x, dz = LAND.z - P.z, dh = Math.hypot(dx, dz);
        if (dh < LAND_ASSIST && agl < 55){ const k = smooth(LAND_ASSIST, 25, dh) * (1 - Math.min(1, Math.abs(inp.x) * 1.5)); if (k > 0.02){ P.heading = lerpAngle(P.heading, Math.atan2(dx, dz), Math.min(1, dt * 1.3 * k)); P.assist = 'land'; } } } }
    const ti = thermalAt(P.x, P.z); const wsc = ti ? 1 - smooth(0, 0.35, ti.k) : 1;
    if (ti && Math.abs(P.turn) > 0.35 && ti.d > 4){ P.x += (ti.t.x - P.x) / ti.d * 2.2 * dt; P.z += (ti.t.z - P.z) / ti.d * 2.2 * dt; }
    const fx = Math.sin(P.heading), fz = Math.cos(P.heading); P.x += (fx * P.speed + WIND.x * wsc) * dt; P.z += (fz * P.speed + WIND.z * wsc) * dt; P.y = Math.min(P.y + P.vy * dt, 345); P.moving = false;
    F.t += dt; F.maxY = Math.max(F.maxY, P.y);
    for (const s of STARS){ if (!s.got && Math.hypot(P.x - s.x, P.y + 3 - s.m.position.y, P.z - s.z) < 6){ s.got = true; s.m.visible = false; F.stars++; chime(); } }
    const nr = RINGS.find(r => !r.got); for (const r of RINGS){ if (!r.got && Math.hypot(P.x - r.x, P.y + 1.5 - r.y, P.z - r.z) < RING_HIT){ r.got = true; r.m.visible = false; F.rings++; beep(r === nr ? 784 : 620, 0.18, 0.1, 'triangle', r === nr ? 1175 : 880); if (F.rings === RINGS.length) toast('링 10개 모두 통과!', 'found'); } }
    const g2 = groundAt(P.x, P.z); if (P.y <= Math.max(g2, WATER - 0.3)){ P.y = g2; touchdown(); }
  }
  function touchdown(){
    const F = P.f, sinkV = Math.max(0, -P.vy), g = heightAt(P.x, P.z), inWater = g < WATER - 0.2 && !onBridge(P.x, P.z), dl = Math.hypot(P.x - LAND.x, P.z - LAND.z);
    const q = inWater ? 'water' : sinkV < 1.0 ? 'soft' : sinkV < 2.2 ? 'ok' : 'hard';
    const acc = (!inWater && dl < ACC_RANGE) ? Math.max(0, Math.round(150 - dl * 2)) : 0; const bonus = { soft: 100, ok: 40, hard: 0, water: 0 }[q];
    const tp = Math.min(FLIGHT_TIME_PTS_MAX, Math.round(F.t / 3));
    const score = F.stars * 10 + F.rings * 10 + bonus + acc + tp; const nb = score > (best.score || 0); if (nb){ best.score = score; }
    const accD = (!inWater && dl < 60) ? Math.round(dl * 10) / 10 : null; const nba = accD !== null && (best.acc == null || accD < best.acc); if (nba) best.acc = accD; store.set('best2', best);
    const pearls = Math.round(score / PEARL_PER_SCORE); flights++; store.set('flights', flights);
    lastResult = { q, sinkV, dl, acc, accD, bonus, tp, score, nb, nba, inWater, out: dl > 220, pearls }; if (pearls > 0) H.addPearl(pearls);
    H.skyRecord({ score, acc: accD, n: flights }); P.ls = (P.ls || 0) + 1; P.lsc = score;
    P.mode = 'landing'; P.landT = 0; P.speed = 0; P.turn = 0; me.wing.lines.visible = false;
    beep(q === 'hard' ? 120 : 200, 0.25, 0.15, 'sine', 80);
    if (q === 'water') toast('풍덩! 남한강에 빠졌어요'); else if (q === 'hard') toast('쿵! 엉덩방아'); else if (q === 'soft') toast('사뿐~');
  }
  function updateLanding(dt){
    P.landT += dt; const t = Math.min(1, P.landT / 1.1); const r = lastResult;
    me.wing.g.position.set(0, lerp(0, -WING_H + 0.3, smooth(0, 1, t)), lerp(0, -5.5, t)); me.wing.g.rotation.x = lerp(0, -1.5, t); me.wing.g.scale.setScalar(lerp(1, 0.6, t));
    P.roll = lerp(P.roll, 0, dt * 6); P.y = groundAt(P.x, P.z);
    if (P.landT > 1.15){ me.wing.g.visible = false; P.mode = 'ground'; P.vy = 0; P.jv = 0; P.idleT = 0; resetPicks();
      const far = Math.hypot(P.x - PAD.x, P.z - PAD.z) > CLIMB_MIN_DIST && P.y < PH - CLIMB_MIN_DROP; P.climb = { active: far, t: 0, steps: 0, rode: false }; showResult(); }
  }
  /* ============================== 새 떼 ==============================
     갈매기: 상승기류마다 몇 마리씩 빙글빙글 돌며 높이를 바꾼다(새가 도는 곳 = 상승기류 힌트).
     강 위 갈매기: 착륙장 근처 강 위를 낮게 돈다.
     기러기: V자 편대로 골짜기를 크게 한 바퀴씩 돈다. 옆에서 나란히 날면 진주.
     위치는 실제 시계로 정해서, 같은 하늘의 친구도 거의 같은 자리에서 새를 본다. 그리기는 4번(몸 · 날개 × 2종). */
  let BIRDS = null;
  const BQ = new THREE.Quaternion(), BE = new THREE.Euler(0, 0, 0, 'YXZ'), BM = new THREE.Matrix4(), BW = new THREE.Matrix4(), BS = new THREE.Vector3(), BP = new THREE.Vector3(), BWL = new THREE.Matrix4();
  function colorMerge(parts){
    const geos = parts.map(([g, c, m]) => { const q = g.index ? g.toNonIndexed() : g.clone(); g.dispose(); if (m) q.applyMatrix4(m); const n = q.attributes.position.count, col = new Float32Array(n * 3), C = new THREE.Color(c);
      for (let i = 0; i < n; i++){ col[i * 3] = C.r; col[i * 3 + 1] = C.g; col[i * 3 + 2] = C.b; } q.setAttribute('color', new THREE.BufferAttribute(col, 3)); return q; });
    let n = 0; for (const q of geos) n += q.attributes.position.count; const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), col = new Float32Array(n * 3); let o = 0;
    for (const q of geos){ pos.set(q.attributes.position.array, o * 3); nor.set(q.attributes.normal.array, o * 3); col.set(q.attributes.color.array, o * 3); o += q.attributes.position.count; q.dispose(); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.BufferAttribute(nor, 3)); g.setAttribute('color', new THREE.BufferAttribute(col, 3)); return g;
  }
  const bm = (x, y, z, sx, sy, sz, rx = 0, ry = 0, rz = 0) => new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), new THREE.Vector3(sx, sy ?? sx, sz ?? sx));
  const SPH = () => new THREE.SphereGeometry(1, 14, 10);
  function birdBody(kind){
    if (kind === 0) return colorMerge([   /* 통통한 아기 갈매기 */
      [SPH(), '#ffffff', bm(0, 0, 0, 0.27, 0.25, 0.44)], [SPH(), '#ffffff', bm(0, 0.15, 0.36, 0.23)],
      [new THREE.ConeGeometry(0.06, 0.18, 8), '#ffa94d', bm(0, 0.1, 0.64, 1, 1, 1, Math.PI / 2)],
      [SPH(), '#212529', bm(0.12, 0.2, 0.52, 0.042)], [SPH(), '#212529', bm(-0.12, 0.2, 0.52, 0.042)],
      [SPH(), '#ffffff', bm(0.132, 0.215, 0.555, 0.014)], [SPH(), '#ffffff', bm(-0.108, 0.215, 0.555, 0.014)],
      [SPH(), '#ffb3c7', bm(0.15, 0.1, 0.5, 0.045, 0.03, 0.03)], [SPH(), '#ffb3c7', bm(-0.15, 0.1, 0.5, 0.045, 0.03, 0.03)],
      [SPH(), '#dfe6ee', bm(0, 0.04, -0.46, 0.16, 0.05, 0.22)], [SPH(), '#495057', bm(0, 0.05, -0.62, 0.12, 0.04, 0.08)],
      [SPH(), '#ffc078', bm(0.08, -0.2, -0.14, 0.05, 0.04, 0.09)], [SPH(), '#ffc078', bm(-0.08, -0.2, -0.14, 0.05, 0.04, 0.09)]]);
    return colorMerge([                   /* 동글동글 기러기 */
      [SPH(), '#9c9283', bm(0, 0, 0, 0.3, 0.27, 0.5)], [SPH(), '#e9e3d5', bm(0, -0.08, 0.06, 0.24, 0.18, 0.38)],
      [new THREE.CylinderGeometry(0.085, 0.11, 0.42, 10), '#2b2b2b', bm(0, 0.12, 0.5, 1, 1, 1, 1.0)],
      [SPH(), '#2b2b2b', bm(0, 0.26, 0.72, 0.17)], [SPH(), '#ffffff', bm(0.1, 0.24, 0.72, 0.07, 0.06, 0.08)], [SPH(), '#ffffff', bm(-0.1, 0.24, 0.72, 0.07, 0.06, 0.08)],
      [SPH(), '#111111', bm(0.1, 0.31, 0.8, 0.035)], [SPH(), '#111111', bm(-0.1, 0.31, 0.8, 0.035)],
      [SPH(), '#ffffff', bm(0.11, 0.325, 0.825, 0.012)], [SPH(), '#ffffff', bm(-0.09, 0.325, 0.825, 0.012)],
      [new THREE.ConeGeometry(0.055, 0.15, 8), '#ff922b', bm(0, 0.25, 0.93, 1, 1, 1, Math.PI / 2)],
      [SPH(), '#ffb3c7', bm(0.13, 0.2, 0.78, 0.035, 0.025, 0.025)], [SPH(), '#ffb3c7', bm(-0.13, 0.2, 0.78, 0.035, 0.025, 0.025)],
      [SPH(), '#3b3631', bm(0, 0.04, -0.52, 0.17, 0.06, 0.2)]]);
  }
  function birdWing(kind){   /* 오른쪽 날개(+x). 왼쪽은 거울로 뒤집어 쓴다 */
    const s = new THREE.Shape(); s.moveTo(0, 0.2); s.quadraticCurveTo(0.55, 0.3, 1.12, 0.03); s.quadraticCurveTo(0.78, -0.13, 0.42, -0.12); s.quadraticCurveTo(0.18, -0.22, 0, -0.17); s.closePath();
    const g = new THREE.ShapeGeometry(s, 6); g.rotateX(Math.PI / 2); const p = g.attributes.position, n = p.count, col = new Float32Array(n * 3);
    const A = new THREE.Color(kind ? '#8a8174' : '#e7edf3'), B = new THREE.Color(kind ? '#3f3a34' : '#495057'), C = new THREE.Color();
    for (let i = 0; i < n; i++){ C.copy(A).lerp(B, smooth(0.62, 0.95, p.getX(i))); col[i * 3] = C.r; col[i * 3 + 1] = C.g; col[i * 3 + 2] = C.b; }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3)); return g;
  }
  function buildBirds(){
    BIRDS = { list: [], k: [null, null], seenG: false, seenV: false, nearT: 0, chirpT: 2, payT: -1e9, mates: 0 };
    const L = BIRDS.list, per = TOUCH ? 4 : 6;
    THERMALS.forEach((t, ti) => { const base = heightAt(t.x, t.z), lo = Math.max(base + 30, WATER + 30), hi = t.top - 12;
      for (let i = 0; i < per; i++) L.push({ k: 0, cx: t.x, cz: t.z, r: t.r * (0.32 + rnd() * 0.42), a0: rnd() * 6.28, w: 0.24 + rnd() * 0.1, y: lo + (hi - lo) * (i + rnd() * 0.8) / per, amp: 6 + rnd() * 8, ph: rnd() * 6.28, s: 1.5 + rnd() * 0.3, therm: true }); });
    for (let i = 0; i < 5; i++) L.push({ k: 0, cx: PAD.x + 25, cz: PAD.z + 55, r: 18 + i * 5, a0: rnd() * 6.28, w: 0.3 - i * 0.02, y: PH + 4 + i * 5, amp: 3, ph: rnd() * 6.28, s: 1.5 + rnd() * 0.25 });
    for (let i = 0; i < (TOUCH ? 4 : 6); i++){ const x = LAND.x - 40 + rnd() * 90; L.push({ k: 0, cx: x, cz: riverZ(x), r: 14 + rnd() * 16, a0: rnd() * 6.28, w: -(0.3 + rnd() * 0.12), y: WATER + 14 + rnd() * 16, amp: 4, ph: rnd() * 6.28, s: 1.4 + rnd() * 0.2 }); }
    for (let f = 0; f < 2; f++) for (let i = 0; i < 7; i++){ const rank = Math.ceil(i / 2), side = i === 0 ? 0 : (i % 2 ? 1 : -1); L.push({ k: 1, flock: f, lead: i === 0, back: rank * 3.8, side: side * rank * 3.0, ph: rnd() * 6.28, s: 1.8 + rnd() * 0.15 }); }
    const mat = new THREE.MeshLambertMaterial({ vertexColors: true }), wmat = new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide });
    for (const k of [0, 1]){ const n = L.filter(b => b.k === k).length; let j = 0; for (const b of L) if (b.k === k) b.i = j++;
      const body = new THREE.InstancedMesh(birdBody(k), mat, n), wing = new THREE.InstancedMesh(birdWing(k), wmat, n * 2);
      for (const m of [body, wing]){ m.frustumCulled = false; m.instanceMatrix.setUsage(THREE.DynamicDrawUsage); scene.add(m); } BIRDS.k[k] = { body, wing }; }
    for (const b of L){ b.ox = b.oy = b.oz = 0; b.x = b.y0 = 0; }
    updateBirds(0);
  }
  function gooseLead(f, T){ const a = T * 0.03 + f * Math.PI, cx = 60, cz = 140, rx = 430, rz = 330, x = cx + Math.sin(a) * rx, z = cz + Math.cos(a) * rz;
    const tx = Math.cos(a) * rx, tz = -Math.sin(a) * rz, tl = Math.hypot(tx, tz); return { x, z, y: PH - 8 + 30 * Math.sin(a * 2 + f), hx: tx / tl, hz: tz / tl }; }
  function updateBirds(dt){
    if (!BIRDS) return; const T = (Date.now() / 1000) % 86400, flying = P.mode === 'flying' || P.mode === 'takeoff'; let nearG = 1e9, nearV = 1e9;
    const G2 = [gooseLead(0, T), gooseLead(1, T)];
    for (const b of BIRDS.list){
      let x, y, z, hd, roll = 0, flap, sp;
      if (b.k === 0){ const a = b.a0 + b.w * T, sg = Math.sign(b.w); x = b.cx + Math.cos(a) * b.r; z = b.cz + Math.sin(a) * b.r; y = b.y + b.amp * Math.sin(T * 0.06 + b.ph);
        hd = Math.atan2(-Math.sin(a) * sg, Math.cos(a) * sg); roll = 0.38 * sg; const burst = Math.sin(T * 0.45 + b.ph * 3) > 0.55; flap = burst ? Math.sin(T * 10 + b.ph) * 0.65 : 0.12 + Math.sin(T * 1.3 + b.ph) * 0.05; sp = 9; }
      else { const G = G2[b.flock], rx = G.hz, rz = -G.hx; x = G.x - G.hx * b.back + rx * b.side; z = G.z - G.hz * b.back + rz * b.side; y = G.y - b.back * 0.15 + Math.sin(T * 0.9 + b.ph) * 0.25; hd = Math.atan2(G.hx, G.hz); roll = -0.06; flap = Math.sin(T * 7.5 + b.ph) * 0.6; sp = 11; }
      /* 가까이 날아오면 깜짝 놀라 퍼드덕 비켜난다 */
      const dx = x + b.ox - P.x, dy = y + b.oy - (P.y + 2.6), dz = z + b.oz - P.z, d = Math.hypot(dx, dy, dz); let tx = 0, ty = 0, tz = 0;
      if (d < 13 && d > 0.01){ const k = (13 - d) * 0.9 / d; tx = dx * k; ty = Math.abs(dy) * k * 0.5 + 1.2; tz = dz * k; flap = Math.sin(T * 16 + b.ph) * 0.8; }
      const e = 1 - Math.exp(-dt * (d < 13 ? 3 : 0.6)); b.ox += (tx - b.ox) * e; b.oy += (ty - b.oy) * e; b.oz += (tz - b.oz) * e;
      x += b.ox; y += b.oy; z += b.oz; b.x = x; b.y0 = y; b.zz = z;
      if (flying){ const dd = Math.hypot(x - P.x, y - P.y, z - P.z); if (b.k === 0) nearG = Math.min(nearG, dd); else nearV = Math.min(nearV, dd); }
      const K = BIRDS.k[b.k]; BE.set(0, hd, roll); BQ.setFromEuler(BE); BS.setScalar(b.s); BP.set(x, y, z); BM.compose(BP, BQ, BS); K.body.setMatrixAt(b.i, BM);
      for (const sd of [1, -1]){ BW.makeRotationZ(flap * sd); BW.setPosition(sd * 0.2, 0.08, 0.04); if (sd < 0) BW.multiply(BWL.makeScale(-1, 1, 1)); BW.premultiply(BM); K.wing.setMatrixAt(b.i * 2 + (sd > 0 ? 0 : 1), BW); } }
    for (const K of BIRDS.k){ K.body.instanceMatrix.needsUpdate = true; K.wing.instanceMatrix.needsUpdate = true; }
    if (!dt || !started) return;
    if (nearG < 40 && !BIRDS.seenG){ BIRDS.seenG = true; toast('갈매기들이 빙글빙글 도는 곳은 상승기류예요! 같이 돌면 쑥쑥 올라가요'); }
    if (nearV < 60 && !BIRDS.seenV){ BIRDS.seenV = true; toast('V자로 날아가는 기러기 떼예요! 옆에 붙어서 나란히 날아 봐요'); }
    if (Math.min(nearG, nearV) < 22){ BIRDS.chirpT -= dt; if (BIRDS.chirpT <= 0){ BIRDS.chirpT = 0.9 + Math.random() * 1.6; const f = nearV < nearG ? 520 : 1500 + Math.random() * 500; beep(f, 0.06, 0.035, 'triangle', f * (nearV < nearG ? 0.8 : 1.25)); } }
    /* 기러기 편대 옆(꼬리 쪽 빈자리)에서 4초 함께 날면 진주 */
    let mate = false; if (P.mode === 'flying') for (const G of G2){ const d = Math.hypot(G.x - P.x, G.z - P.z), dy = Math.abs(G.y - P.y); if (d < 26 && dy < 12){ const vx = Math.sin(P.heading), vz = Math.cos(P.heading); if (vx * G.hx + vz * G.hz > 0.6) mate = true; } }
    BIRDS.mates = mate ? BIRDS.mates + dt : Math.max(0, BIRDS.mates - dt * 0.5);
    if (BIRDS.mates > 4 && NOW - BIRDS.payT > 150){ BIRDS.payT = NOW; BIRDS.mates = 0; H.addPearl(3); toast('기러기 떼랑 나란히 날았어요! 진주 +3', 'found'); beep(660, 0.12, 0.08, 'triangle', 990); }
  }

  /* ============================== 같이 날기 (친구들) ============================== */
  const REMOTES = new Map(); let busRefT = 0;
  const remoteById = id => { for (const R of REMOTES.values()) if (R.id === id) return R; return null; };
  const num = v => (typeof v === 'number' && isFinite(v) ? v : 0);
  function onPeers(ch){
    for (const p of ch.left || []) dropRemote(p.peer);
    for (const p of ch.peers || []){ if (p.sameTab) continue; const pr = p.presence || {};
      if (pr.v !== 2 || pr.w !== 'sky' || typeof pr.x !== 'number'){ dropRemote(p.peer); continue; }
      let R = REMOTES.get(p.peer); const fresh = !R;
      if (!R){ R = { key: p.peer, tgt: new THREE.Vector3(), h: 0, first: true, gearKey: '', name: '', ls: null, pqSeen: '', veh: null, rdShown: null }; REMOTES.set(p.peer, R); }
      R.id = typeof pr.id === 'string' ? pr.id.slice(0, 40) : ''; R.tgt.set(clamp(num(pr.x), -1300, 1300), clamp(num(pr.y), -10, 420), clamp(num(pr.z), -1300, 1300)); R.h = num(pr.h); R.roll = clamp(num(pr.r), -1, 1);
      R.md = typeof pr.md === 'string' ? pr.md : 'g'; R.mv = !!pr.mv; R.run = !!pr.rn; R.rd = VEHMAP[pr.rd] ? pr.rd : ''; R.bt = num(pr.bt); R.bgo = !!pr.bgo; R.cy = typeof pr.cy === 'string' ? pr.cy : ''; R.on = typeof pr.on === 'string' ? pr.on : ''; R.pq = typeof pr.pq === 'string' ? pr.pq : ''; R.bk = clamp(num(pr.bk), 0, 1);
      const nm = H.cleanNick(pr.nk) || '친구'; const wg = WINGS[pr.wg] ? pr.wg : 'rainbow', hm = pr.hm === 'bear' ? 'bear' : 'basic';
      const gk = JSON.stringify([pr.g || {}, wg, hm, nm]); if (gk !== R.gearKey){ R.gearKey = gk; R.name = nm; const vis = R.gl ? R.gl.wing.g.visible : false; if (R.gl) freeGlider(R.gl); R.gl = makeGlider(H.sanitizeGear(pr.g), wg, nm, '#2fa7d8', { helmet: hm }); R.gl.wing.g.visible = vis; }
      if (R.first){ R.gl.rig.position.copy(R.tgt); R.first = false; }
      if (R.md === 't' && R.prevMd && R.prevMd !== 't' && Math.hypot(R.tgt.x - PAD.x, R.tgt.z - PAD.z) < 40) staffCheer('go', R.name); R.prevMd = R.md;
      if (typeof pr.ls === 'number' && pr.ls !== R.ls){ if (R.ls !== null && pr.sc > 0) toast(`${R.name} 님이 착륙했어요! ${Math.round(clamp(num(pr.sc), 0, 800))}점`); R.ls = pr.ls; }
      if (fresh && started) setTimeout(() => { if (REMOTES.has(p.peer)) toast(`${R.name} 님이 ${MAP.name}에 왔어요`); }, 1200);
    }
    H.onSkyPeers?.(REMOTES.size);
  }
  function dropRemote(key){ const R = REMOTES.get(key); if (!R) return; if (R.gl) freeGlider(R.gl); if (R.veh) scene.remove(R.veh.g); REMOTES.delete(key); if (P.cy && R.id === P.cy) putDown(false); if (P.carrier && R.id === P.carrier){ P.mode = 'ground'; P.carrier = ''; toast('친구가 떠나서 내려왔어요'); } }
  function clearRemotes(){ for (const k of [...REMOTES.keys()]) dropRemote(k); }
  function presence(){ const r1 = v => Math.round(v * 10) / 10, gear = H.gear();
    const md = { ground: 'g', takeoff: 't', flying: 'f', landing: 'l', sit: 's', bus: 'b', piggy: 'p' }[P.mode] || 'g';
    return { v: 2, w: 'sky', id: myKey, x: r1(P.x), y: r1(P.y), z: r1(P.z), h: Math.round(P.heading * 100) / 100, r: Math.round(P.roll * 100) / 100, md, mv: P.moving ? 1 : 0, rn: P.run ? 1 : 0, rd: P.ride || '', wg: gear.wing || 'rainbow', hm: gear.helmet || 'basic', g: gear, nk: H.nick(),
      bt: P.mode === 'bus' ? P.bt : 0, bgo: P.mode === 'bus' && P.bgo ? 1 : 0, cy: P.cy || '', on: P.carrier || '', pq: P.pq && Date.now() - P.pq.t < 15000 ? `${P.pq.to}:${P.pq.n}` : '', ls: P.ls || 0, sc: P.lsc || 0, bk: P.mode === 'flying' ? Math.round(clamp(-lastInp.y, 0, 1) * 10) / 10 : 0 }; }
  /* 업어 줘: 부탁 → 친구가 수락하면 친구 등에 업혀 가요. 친구끼리는 무료 */
  let pqN = 0, reqFrom = null;
  function requestPiggy(R){ if (P.mode !== 'ground' || P.cy) return; dismount(true); P.pq = { to: R.id, n: ++pqN, t: Date.now() }; toast(`${R.name} 님에게 업어 달라고 했어요. 수락하면 등에 업혀요`); }
  function acceptPiggy(R){ hideReq(); if (!R || P.mode !== 'ground'){ return; } dismount(true); P.cy = R.id; P.cyT = NOW; toast(`${R.name} 님을 업었어요! 정상까지 걸어가요`); beep(600, 0.1, 0.08); }
  function putDown(say){ const R = remoteById(P.cy); P.cy = ''; if (say) toast(`${R ? R.name + ' 님을' : '친구를'} 내려 줬어요`); }
  function piggyNet(dt){
    /* 받은 부탁 */
    if (!reqFrom && P.mode === 'ground' && !P.cy && !P.pq){ for (const R of REMOTES.values()){ if (!R.pq || !myKey || R.pqSeen === R.pq) continue; const [to] = R.pq.split(':'); if (to === myKey){ R.pqSeen = R.pq; showReq(R); break; } } }
    /* 내가 부탁했는데 친구가 업어 줌 */
    if (P.pq && P.mode === 'ground'){ const R = remoteById(P.pq.to); if (R && R.cy === myKey){ P.mode = 'piggy'; P.carrier = R.id; P.pq = null; if (P.climb.active) P.climb.rode = true; toast(`${R.name} 님 등에 업혔어요!`); }
      else if (Date.now() - P.pq.t > 15000){ P.pq = null; toast('친구가 아직 바쁜가 봐요. 다음에 다시 부탁해요'); } }
    /* 업혀 가는 중: 친구 등 위치를 따라가요 */
    if (P.mode === 'piggy' && P.carrier){ const R = remoteById(P.carrier); if (!R || R.cy !== myKey){ P.mode = 'ground'; P.carrier = ''; P.y = groundAt(P.x, P.z); toast(R ? `${R.name} 님이 내려 줬어요` : '친구가 내려 줬어요'); }
      else { const q = R.gl.rig.position, h = R.gl.rig.rotation.y; P.x = q.x - Math.sin(h) * 0.55; P.z = q.z - Math.cos(h) * 0.55; P.y = q.y + 0.6; P.heading = h;
        if (Math.hypot(P.x - PAD.x, P.z - PAD.z) < 14){ P.mode = 'ground'; P.carrier = ''; P.y = groundAt(P.x, P.z); finishClimb(`${R.name} 님 등`); } } }
    /* 내가 업고 있는 중 */
    if (P.cy){ const R = remoteById(P.cy); if (!R){ P.cy = ''; } else if (R.md !== 'p' || R.on !== myKey){ if (NOW - (P.cyT || 0) > 4){ const arrived = Math.hypot(P.x - PAD.x, P.z - PAD.z) < 20; P.cy = ''; toast(arrived ? `${R.name} 님을 정상까지 업어다 줬어요! 고마워요` : `${R.name} 님이 내렸어요`, arrived ? 'found' : ''); } } else P.cyT = NOW; }
  }
  /* 마을버스 (같이 타기) */
  function busNet(dt){
    const now = Date.now(), wait = [];
    if (P.mode === 'bus' && !P.bgo && BUS.state !== 'go') wait.push({ id: myKey || 'me', bt: P.bt, me: true });
    let goRemote = false; for (const R of REMOTES.values()){ if (R.md !== 'b') continue; if (R.bgo) goRemote = true; else if (R.bt) wait.push({ id: R.id, bt: R.bt }); }
    if (BUS.state === 'idle' && (wait.length || goRemote)) BUS.state = 'wait';
    if (BUS.state === 'wait'){
      const n = Math.min(BUS_SEATS, wait.length + [...REMOTES.values()].filter(R => R.md === 'b' && R.bgo).length); BUS.riders = n; BUS.heads.forEach((h, i) => h.visible = i < n);
      if (!wait.length && !goRemote){ resetBus(); return; }
      wait.sort((a, b) => a.bt - b.bt || (a.id < b.id ? -1 : 1)); const driver = wait[0];
      const iDrive = driver && driver.me, ready = wait.length >= BUS_SEATS || (iDrive && now - P.bt >= BUS_AI_WAIT * 1000);
      if (goRemote || (iDrive && ready)) departBus(n);
      else if (P.mode === 'bus'){ busRefT -= dt; if (busRefT <= 0){ busRefT = 1; P.busLeft = Math.max(0, Math.ceil(BUS_AI_WAIT - (now - (driver?.bt || now)) / 1000)); } }
    }
  }
  function departBus(real){ BUS.state = 'go'; BUS.ai = Math.max(0, BUS_SEATS - real); BUS.heads.forEach(h => h.visible = true); BUS.o = { x: BUS.g.position.x, z: BUS.g.position.z, heading: BUS.home.h, idx: 0 };
    BUS.route = [[STOP_POS.x - 22, STOP_POS.z + 4], [LAND.x - 4, LAND.z - 40]].concat(TRAIL.pts.slice(1, TRAIL.pts.length - 4));
    if (P.mode === 'bus'){ P.bgo = true; toast(BUS.ai ? `친구 ${real}명 + AI 친구 ${BUS.ai}명이 탔어요! 출발~ 부릉부릉` : `${BUS_SEATS}명 다 모였어요! 출발~ 부릉부릉`); honk(); } }
  function updateBus(dt){
    busNet(dt);
    if (BUS.state === 'wait' && P.mode === 'bus'){ P.x = BUS.g.position.x; P.z = BUS.g.position.z; P.y = BUS.g.position.y; }
    else if (BUS.state === 'go'){ const done = follow(BUS.o, BUS.route, 22, dt); placeVehicle(BUS.g, BUS.o.x, BUS.o.z, BUS.o.heading, 3.5); for (const w of BUS.W) w.m.rotation.x += 22 * dt / w.r;
      if (P.mode === 'bus'){ P.x = BUS.o.x; P.z = BUS.o.z; P.y = BUS.g.position.y; P.heading = BUS.o.heading; }
      if (done){ BUS.state = 'top'; BUS.backT = 4; if (P.mode === 'bus'){ P.mode = 'ground'; P.bt = 0; P.bgo = false; P.x = PAD.x + 7; P.z = PAD.z + 2; P.y = groundAt(P.x, P.z); P.heading = 0; me.rig.visible = true; finishClimb('마을버스'); } } }
    else if (BUS.state === 'top'){ BUS.backT -= dt; if (BUS.backT <= 0) resetBus(); }
  }
  function updatePiggy(dt){ const F = FRIEND;
    F.tag.visible = F.state === 'idle';
    if (F.state === 'carry'){ const done = follow(F.o, F.route, 11, dt); F.grp.position.set(F.o.x, groundAt(F.o.x, F.o.z), F.o.z); F.grp.rotation.y = F.o.heading; F.ph += dt * 11 * 1.1; poseCarry(F.b, F.ph, 1);
      F.grp.updateMatrixWorld(true); V3.set(0, 0.84, -0.7); F.b.w.localToWorld(V3); me.rig.position.copy(V3); me.rig.rotation.set(0, F.o.heading, 0);
      P.x = F.o.x; P.z = F.o.z; P.y = F.grp.position.y; P.heading = F.o.heading;
      if (done){ F.state = 'back'; F.backT = 3.5; P.mode = 'ground'; P.x = PAD.x + 4; P.z = PAD.z - 2; P.y = groundAt(P.x, P.z); P.heading = 0; finishClimb('튼튼이 등'); setTimeout(() => toast('튼튼이: 헥헥… 다 왔다!'), 1800); } }
    else if (F.state === 'back'){ F.backT -= dt; setSt(F.b, 'idle', { wave: true }); if (F.backT <= 0){ F.state = 'idle'; F.grp.position.set(FRIEND_HOME.x, groundAt(FRIEND_HOME.x, FRIEND_HOME.z), FRIEND_HOME.z); } }
  }
  function staySay(s, text, dur = 3.6){ if (!ui) return; const used = new Set(STAFF.filter(q => q !== s && q.bubbleT > 0).map(q => q.slot)), i = s.bubbleT > 0 ? s.slot : [0, 1, 2].find(k => !used.has(k)); if (i === undefined) return;
    s.slot = i; s.bubble = true; s.bubbleT = dur; const d = $s('skSay' + i); d.querySelector('b').textContent = STAFF_NAMES[STAFF.indexOf(s)]; d.querySelector('span').textContent = text; d.classList.remove('hidden'); s.tag.visible = false; }
  const onScreen = s => { V3.set(s.x, s.grp.position.y + 2.4, s.z).project(camera); return V3.z < 1 && Math.abs(V3.x) < 0.8 && Math.abs(V3.y) < 0.8; };
  function staffCheer(kind, who){ if (!STAFF.length) return; const L = kind === 'go' ? STAFF_CHEER : STAFF_WELCOME, n = kind === 'go' ? 3 : 1, start = Math.floor(Math.random() * STAFF.length);
    const order = STAFF.slice().sort((a, b) => onScreen(b) - onScreen(a)); for (let k = 0; k < n; k++){ const s = order[k % order.length]; staySay(s, (who ? who + ' 님 ' : '') + L[(start + k) % L.length], 2.8); s.waveT = 3; s.b.rig.X = { kind: 'laugh', el: 0, dur: 1.8, t: 0 }; }
    if (kind === 'go') for (const s of STAFF) s.waveT = Math.max(s.waveT, 2.5); STAFF.t = 4.5; }
  function updateStaff(dt){ if (!STAFF.length) return;
    const camD = Math.hypot(camera.position.x - PAD.x, camera.position.z - PAD.z), vis = camD < 230, dP = Math.hypot(P.x - PAD.x, P.z - PAD.z);
    const listen = started && dP < 38 && (P.mode === 'ground' || P.mode === 'sit') && !P.cy;
    if (listen){ STAFF.t -= dt; if (STAFF.t <= 0){ const tips = STAFF_TIPS(); let best = null, bd = 1e9; STAFF.forEach((s, i) => { if (s.bubbleT > 0) return; const d = Math.hypot(P.x - s.x, P.z - s.z) + (i === STAFF.last ? 99 : 0); if (d < bd){ bd = d; best = s; } });
      if (best && !onScreen(best)){ const alt = STAFF.filter(s => s.bubbleT <= 0 && onScreen(s)).sort((a, b) => Math.hypot(P.x - a.x, P.z - a.z) - Math.hypot(P.x - b.x, P.z - b.z))[0]; if (alt) best = alt; }
      if (best){ STAFF.last = STAFF.indexOf(best); staySay(best, tips[STAFF.tip % tips.length]); STAFF.tip++; if (STAFF.tip % 3 === 0) best.waveT = 1.6; } STAFF.t = 4.2; } }
    for (const s of STAFF){ s.grp.visible = vis; if (s.bubbleT > 0){ s.bubbleT -= dt; const d = ui && $s('skSay' + s.slot);
        if (s.bubbleT <= 0){ s.bubble = null; s.tag.visible = true; d?.classList.add('hidden'); }
        else if (d){ V3.set(s.x, s.grp.position.y + 2.75 * s.b.scale + 0.5, s.z).project(camera); if (!vis || V3.z > 1 || Math.abs(V3.x) > 1.15 || Math.abs(V3.y) > 1.15){ d.style.opacity = '0'; } else { const w = d.offsetWidth || 200, h = d.offsetHeight || 50, sx = (V3.x + 1) / 2 * innerWidth, sy = (1 - V3.y) / 2 * innerHeight, y = clamp(sy - h - 10, 70, innerHeight - h - 120), x = clamp(sx - w / 2, 8, innerWidth - w - (y < 330 && innerWidth > 560 ? 170 : y < 260 ? 130 : 8));
          d.style.opacity = '1'; d.style.transform = `translate(${Math.round(x)}px,${Math.round(y)}px)`; d.style.setProperty('--tx', clamp(sx - x, 16, w - 16) + 'px'); } } }
      if (!vis) continue; s.waveT -= dt;
      const look = dP < 22 && P.mode !== 'flying' ? Math.atan2(P.x - s.x, P.z - s.z) : P.mode === 'flying' || P.mode === 'takeoff' ? Math.atan2(P.x - s.x, P.z - s.z) : Math.atan2(PAD.x - s.x, PAD.z + 6 - s.z);
      s.h = lerpAngle(s.h, look, Math.min(1, dt * 3)); s.grp.rotation.y = s.h;
      setSt(s.b, 'idle', { wave: s.waveT > 0 || (P.mode === 'takeoff') }); H.animRig(s.b.rig, dt, s.b.st, s.b.o); } }
  function updateFriendIdle(dt){ const F = FRIEND; if (F.state !== 'idle') return; const d = Math.hypot(P.x - F.grp.position.x, P.z - F.grp.position.z);
    if (d < 14){ F.grp.rotation.y = lerpAngle(F.grp.rotation.y, Math.atan2(P.x - F.grp.position.x, P.z - F.grp.position.z), Math.min(1, dt * 4)); setSt(F.b, 'idle', { wave: true }); } else setSt(F.b, 'idle'); }
  function updateVillagers(dt){
    const cx = camera.position.x, cz = camera.position.z, lim = TOUCH ? 6 : 10;
    const order = VILLAGERS.map(v => [v, Math.hypot(cx - v.x, cz - v.z)]).sort((a, b) => a[1] - b[1]);
    order.forEach(([v, d], i) => { v.vis = i < lim && d < 170; v.grp.visible = v.vis; });
    for (const v of VILLAGERS){ const C = v.area === 'town' ? TOWN : VIL;
      const near = Math.hypot(P.x - v.x, P.z - v.z); v.cool -= dt; let moving = false;
      if (v.bubbleT > 0){ v.bubbleT -= dt; if (v.bubbleT <= 0 && v.bubble){ v.grp.remove(v.bubble); v.bubble.material.map.dispose(); v.bubble.material.dispose(); v.bubble = null; } }
      if (near < 6 && P.mode === 'ground'){ v.h = lerpAngle(v.h, Math.atan2(P.x - v.x, P.z - v.z), Math.min(1, dt * 5));
        if (v.cool <= 0 && v.vis){ v.cool = 14; v.bubbleT = 3.4; if (v.bubble) v.grp.remove(v.bubble); v.bubble = makeTag(pick(v.area === 'town' ? LINES_TOWN : LINES_VIL), '#ffffff', '#3b3a4a', 2.6); v.bubble.position.y = 2.4 * v.b.scale + 0.9; v.grp.add(v.bubble); beep(900, 0.06, 0.04); } }
      else if (v.pause > 0) v.pause -= dt;
      else { v.a += v.dir * v.sp / v.ring * dt; v.walkT -= dt; if (v.walkT <= 0){ v.pause = 1.5 + Math.random() * 3; v.walkT = 5 + Math.random() * 9; } moving = true; v.h = Math.atan2(Math.cos(v.a) * v.dir, -Math.sin(v.a) * v.dir); }
      v.x = C.x + Math.sin(v.a) * v.ring; v.z = C.z + Math.cos(v.a) * v.ring;
      if (v.ox || v.oz){ v.x += v.ox; v.z += v.oz; const kk = Math.exp(-dt * 1.2); v.ox *= kk; v.oz *= kk; if (Math.abs(v.ox) + Math.abs(v.oz) < 0.02) v.ox = v.oz = 0; }
      if (!v.vis) continue;
      v.grp.position.set(v.x, groundAt(v.x, v.z), v.z); v.grp.rotation.y = v.h; setSt(v.b, moving ? 'walk' : 'idle', { moving, wave: near < 6 && P.mode === 'ground' }); H.animRig(v.b.rig, dt, v.b.st, v.b.o); }
  }
  function updateCars(dt){ for (const c of CARS){ const r = 78, x = TOWN.x + Math.sin(c.a) * r, z = TOWN.z + Math.cos(c.a) * r, h = Math.atan2(Math.cos(c.a), -Math.sin(c.a));
    const dx = P.x - x, dz = P.z - z, d = Math.hypot(dx, dz); const ahead = d < 7 && (dx * Math.sin(h) + dz * Math.cos(h)) / Math.max(d, 0.01) > 0.4 && P.mode === 'ground'; c.honk -= dt;
    if (ahead){ if (c.honk <= 0 && d < 5.5){ c.honk = 4; honk(); } } else { c.a += c.sp / r * dt; for (const w of c.W) w.m.rotation.x += c.sp * dt / w.r; }
    placeVehicle(c.g, x, z, h, 1.4); } }
  /* ============================== 부딪히면 통! ==============================
     걷거나 탈것을 탈 때 친구 · 마을 사람 · 안전요원(AI) · 튼튼이와 부딪히면 서로 튕겨 나간다. 친구 화면에서는 친구 쪽이 스스로 튕긴다 */
  const KB = { x: 0, z: 0, t: 0 };
  function bumpFx(ux, uz, sp){ KB.x = ux * sp; KB.z = uz * sp; KB.t = NOW + 0.55; if (!P.ride && P.y <= groundAt(P.x, P.z) + 0.05) P.jv = 5.5; beep(330, 0.08, 0.07); setTimeout(() => beep(620, 0.08, 0.05), 80); }
  function bumpOthers(dt){
    if (KB.x || KB.z){ if (P.mode === 'ground'){ const o = { x: P.x + KB.x * dt, z: P.z + KB.z * dt }; if (!(P.ride && heightAt(o.x, o.z) < WATER - 0.1 && !onBridge(o.x, o.z))){ pushOut(o, P.ride ? vobj(P.ride).rad : 0.55); P.x = o.x; P.z = o.z; } }
      const k = Math.exp(-dt * 4.5); KB.x *= k; KB.z *= k; if (Math.hypot(KB.x, KB.z) < 0.1) KB.x = KB.z = 0; }
    if (!started || P.mode !== 'ground' || P.cy || NOW < KB.t) return;
    const me = P.ride ? 1.7 : 0.85, sp = P.ride ? 8 : 6.5;
    const hit = (x, z, r) => { const dx = P.x - x, dz = P.z - z, d = Math.hypot(dx, dz); if (d >= me + r) return null; return d > 0.01 ? [dx / d, dz / d] : [Math.sin(P.heading + Math.PI), Math.cos(P.heading + Math.PI)]; };
    for (const R of REMOTES.values()){ if (R.md !== 'g' || !R.gl || R.cy) continue; const q = R.gl.rig.position; if (Math.abs(q.y - P.y) > 1.6) continue; const u = hit(q.x, q.z, R.rd ? 1.7 : 0.85); if (u){ bumpFx(u[0], u[1], sp); toast(pick(['통! 친구랑 부딪혔어요', '쿵! 미안해요~'])); return; } }
    for (const v of VILLAGERS){ if (!v.vis) continue; const u = hit(v.x, v.z, 0.85); if (!u) continue; bumpFx(u[0], u[1], sp); v.ox = (v.ox || 0) - u[0] * 1.6; v.oz = (v.oz || 0) - u[1] * 1.6;
      v.bubbleT = 2.6; v.cool = Math.max(v.cool, 6); if (v.bubble) v.grp.remove(v.bubble); v.bubble = makeTag(pick(['어이쿠!', '아야~', '통! 히히', '조심조심!']), '#ffffff', '#3b3a4a', 2.2); v.bubble.position.y = 2.4 * v.b.scale + 0.9; v.grp.add(v.bubble); return; }
    for (const s of STAFF){ if (!s.grp.visible) continue; const u = hit(s.x, s.z, 0.85); if (u){ bumpFx(u[0], u[1], sp); staySay(s, pick(['어이쿠! 천천히 다녀요', '통! 괜찮아요?', '뛰지 말고 걸어요~']), 2.6); return; } }
    if (FRIEND && FRIEND.state === 'idle'){ const q = FRIEND.grp.position, u = hit(q.x, q.z, 0.85); if (u){ bumpFx(u[0], u[1], sp); toast('통! 튼튼이랑 부딪혔어요'); return; } }
  }
  function updateRemotes(dt){
    const k = 1 - Math.exp(-dt * 8);
    for (const R of REMOTES.values()){ const G0 = R.gl; if (!G0) continue; const root = G0.rig;
      const onMe = R.md === 'p' && R.on && R.on === myKey && P.cy === R.id, onOther = R.md === 'p' && R.on && !onMe ? remoteById(R.on) : null;
      if (onMe || onOther?.gl){ const q = onMe ? me.rig.position : onOther.gl.rig.position, h = onMe ? P.heading : onOther.gl.rig.rotation.y; root.position.set(q.x - Math.sin(h) * 0.55, q.y + 0.6, q.z - Math.cos(h) * 0.55); root.rotation.y = h; }
      else { if (root.position.distanceTo(R.tgt) > 40) root.position.copy(R.tgt); else root.position.lerp(R.tgt, k);
      root.rotation.y = lerpAngle(root.rotation.y, R.h, 1 - Math.exp(-dt * 8)); } const fl = R.md === 'f' || R.md === 't' || R.md === 'l';
      G0.wing.g.visible = fl; G0.wing.lines.visible = R.md === 'f'; G0.pivot.rotation.z = lerp(G0.pivot.rotation.z, R.md === 'f' ? R.roll : 0, k); G0.wing.g.position.set(0, 0, 0); G0.wing.g.rotation.x = 0; G0.wing.g.scale.setScalar(1);
      root.visible = R.md !== 'b'; if (G0.tag) G0.tag.visible = true;
      if (R.rd !== R.rdShown){ if (R.veh){ scene.remove(R.veh.g); R.veh = null; } if (R.rd){ R.veh = makeVehicle(R.rd); R.veh.g.visible = true; } R.rdShown = R.rd; }
      const b = G0.baby;
      if (R.md === 'f') poseFly(b, [R.bk, R.bk], NOW);
      else if (R.md === 's') setSt(b, 'sit');
      else if (R.md === 'p') posePiggy(b);
      else if (R.veh){ placeVehicle(R.veh.g, root.position.x, root.position.z, root.rotation.y, 1.2); R.veh.g.updateMatrixWorld(true); V3.copy(R.veh.seat); R.veh.g.localToWorld(V3); root.position.copy(V3); root.quaternion.copy(R.veh.g.quaternion);
        for (const w of R.veh.W) if (R.mv) w.m.rotation.x += 14 * dt / w.r; const pz = R.veh.pose, ph = NOW * 8; if (pz === 'kick') poseKick(b, ph, R.mv); else if (pz === 'skate') poseSkate(b, ph, R.mv); else if (pz === 'pedal') posePedal(b, ph); else if (pz === 'lie') poseLie(b, NOW * 2.5, R.mv); else poseSeat(b); }
      else if (R.cy) poseCarry(b, NOW * 10, R.mv);
      else poseStand(b, R.mv, R.run);
      H.animRig(b.rig, dt, b.st, b.o);
    }
  }
  /* ============================== 한 프레임 ============================== */
  let started = false, lastInp = { x: 0, y: 0 }, shadow = null, tagT = 0, myNick = null; const ZUP = new THREE.Vector3(0, 0, 1), shN = new THREE.Vector3(0, 1, 0);
  let wind = null;
  function audioOn(){ const A = H.AudioSys; if (!A.ctx || wind) return; try { const ctx = A.ctx, buf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate), d = buf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource(); src.buffer = buf; src.loop = true; const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 450; f.Q.value = 0.7; const g = ctx.createGain(); g.gain.value = 0; src.connect(f); f.connect(g); g.connect(A.master); src.start(); wind = { src, f, g };
    A.filt?.frequency.setTargetAtTime(160, ctx.currentTime, 0.4); } catch (e){ wind = null; } }
  function audioOff(){ const A = H.AudioSys; if (wind){ try { wind.src.stop(); wind.g.disconnect(); } catch (e){} wind = null; } if (A.ctx && A.filt) A.filt.frequency.setTargetAtTime(850, A.ctx.currentTime, 0.4); }
  function update(dt){
    const inp = readInput(); lastInp = inp; NOW = performance.now() / 1000;
    if (resultOpen() && (Math.abs(inp.x) + Math.abs(inp.y) > 0.3)) hideResult();
    if (started){
      if (P.mode === 'ground'){ updateGround(dt, inp); bumpOthers(dt); } else if (P.mode === 'takeoff') updateTakeoff(dt); else if (P.mode === 'flying') updateFlight(dt, inp); else if (P.mode === 'landing') updateLanding(dt);
      else if (P.mode === 'sit'){ P.sitT += dt; P.y = groundAt(P.x, P.z); if (Math.abs(inp.x) + Math.abs(inp.y) > 0.3) standUp(); }
    }
    updateBus(dt); updatePiggy(dt); piggyNet(dt);
    const flyingish = P.mode === 'flying' || P.mode === 'takeoff'; me.rig.visible = P.mode !== 'bus';
    if (!(P.mode === 'piggy' && !P.carrier)){ me.rig.position.set(P.x, P.y, P.z); me.rig.rotation.set(0, P.heading, 0); }
    me.pivot.rotation.z = P.roll; me.pivot.rotation.x = flyingish ? clamp(-P.vy * 0.03, -0.12, 0.12) : 0;
    const b = me.baby;
    if (P.mode === 'flying') poseFly(b, [clamp(-inp.y, 0, 1) + clamp(-inp.x, 0, 1) * 0.6, clamp(-inp.y, 0, 1) + clamp(inp.x, 0, 1) * 0.6], NOW);
    else if (P.mode === 'takeoff'){ if (P.tk.t > 1.1) poseFly(b, [0.4, 0.4], NOW); else { poseStand(b, true, true); b.harness.visible = true; } }
    else if (P.mode === 'sit') setSt(b, 'sit');
    else if (P.mode === 'piggy') posePiggy(b);
    else if (P.mode === 'landing'){ if (lastResult?.q === 'hard') poseHard(b, Math.min(1, P.landT / 1.1)); else setSt(b, 'idle'); b.harness.visible = P.landT < 0.66; }
    else if (P.mode === 'ground' && P.ride){ const v = vobj(P.ride); placeVehicle(v.g, P.x, P.z, P.heading, 1.2); v.g.visible = true; for (const w of v.W) w.m.rotation.x += P.spd * dt / w.r;
      v.g.updateMatrixWorld(true); V3.copy(v.seat); v.g.localToWorld(V3); me.rig.position.copy(V3); me.rig.quaternion.copy(v.g.quaternion);
      const pz = v.pose; if (pz === 'kick') poseKick(b, P.anim * 1.3, P.moving); else if (pz === 'skate') poseSkate(b, P.anim * 1.1, P.moving); else if (pz === 'pedal') posePedal(b, P.anim * 2.2); else if (pz === 'lie') poseLie(b, NOW * 2.5, P.moving); else poseSeat(b);
      if (P.ride === 'tiller' && P.moving){ puffT -= dt; if (puffT <= 0){ puffT = 0.16; V3.set(0.25, 1.95, 1.4); v.g.localToWorld(V3); const p = PUFFS.find(q => !q.m.visible); if (p){ p.m.visible = true; p.t = 0; p.m.position.copy(V3); p.vy = 1.6; } beep(110, 0.05, 0.05, 'square'); } } }
    else if (P.cy) poseCarry(b, P.anim, P.moving);
    else { poseStand(b, P.moving, P.run); b.o.wave = !P.moving && P.idleT > 1.6 && P.mode === 'ground'; }
    H.animRig(b.rig, dt, b.st, b.o);
    const gs = groundAt(P.x, P.z); const agl = P.y - gs; shadow.visible = P.mode !== 'bus'; shadow.position.set(P.x, gs + (onPad(P.x, P.z) || onBridge(P.x, P.z) ? 0.06 : 0.15), P.z);
    if (onPad(P.x, P.z) || onBridge(P.x, P.z) || gs <= WATER) shN.set(0, 1, 0); else shN.set(-(heightAt(P.x + 1, P.z) - heightAt(P.x - 1, P.z)), 2, -(heightAt(P.x, P.z + 1) - heightAt(P.x, P.z - 1))).normalize();
    shadow.quaternion.setFromUnitVectors(ZUP, shN); shadow.material.opacity = 0.32 * clamp(1 - agl / 90, 0.12, 1); shadow.scale.setScalar((P.ride ? 1.6 : 1) + Math.min(agl, 60) * 0.012);
    STARS.forEach(s => { if (!s.got){ s.m.rotation.y = NOW * 1.6; s.m.position.y = s.y + Math.sin(NOW * 2 + s.x) * 0.4; } });
    PICKS.forEach(p => { if (!p.got){ p.m.rotation.y = NOW * 1.4 + p.ph; p.m.position.y = heightAt(p.x, p.z) + 0.9 + Math.sin(NOW * 2 + p.ph) * 0.15; } });
    const nextRing = RINGS.find(r => !r.got); RINGS.forEach(r => { if (r.got) return; const on = r === nextRing && P.mode === 'flying'; r.m.material.color.set(on ? '#ffd43b' : '#ffffff'); r.m.material.opacity = on ? 0.95 : 0.45; r.m.scale.setScalar(on ? 1 + Math.sin(NOW * 5) * 0.05 : 1); });
    TP.forEach(o => { const p = o.g.attributes.position; const Hh = o.t.top + 20 - o.base; o.st.forEach((s, i) => { s.y += dt * (0.05 + 0.03 * (i % 3)); if (s.y > 1) s.y -= 1; s.a += dt * 0.7; p.setXYZ(i, o.t.x + Math.cos(s.a) * s.r, o.base + s.y * Hh, o.t.z + Math.sin(s.a) * s.r); }); p.needsUpdate = true; });
    NPCS.forEach(n => { n.a += n.w * dt; const r = n.t.r * 0.75; const x = n.t.x + Math.cos(n.a) * r, z = n.t.z + Math.sin(n.a) * r; n.r.rig.position.set(x, n.alt + Math.sin(NOW * 0.25 + n.ph) * 12, z);
      n.r.rig.rotation.y = Math.atan2(-Math.sin(n.a), Math.cos(n.a)); n.r.pivot.rotation.z = -0.32; const near = n.r.rig.position.distanceTo(camera.position) < 260; n.r.baby.w.visible = near; if (near){ poseFly(n.r.baby, [0.3, 0.1], NOW + n.ph); H.animRig(n.r.baby.rig, dt, n.r.baby.st, n.r.baby.o); } });
    socks.forEach(s => { s.userData.sock.rotation.z = Math.sin(NOW * 3) * 0.08; }); updateBirds(dt);
    PUFFS.forEach(p => { if (!p.m.visible) return; p.t += dt; p.m.position.y += p.vy * dt; p.m.scale.setScalar(1 + p.t * 1.2); p.m.material.opacity = 0.45 * (1 - p.t); if (p.t >= 1) p.m.visible = false; });
    updateVillagers(dt); updateCars(dt); updateFriendIdle(dt); updateStaff(dt); if (FRIEND.state !== 'carry' && FRIEND.state !== 'back' || true) H.animRig(FRIEND.b.rig, dt, FRIEND.b.st, FRIEND.b.o);
    updateRemotes(dt);
    const dd = Math.hypot(camera.position.x - VIL.x, camera.position.z - VIL.z); DISPLAY.forEach(o => o.visible = dd < 320);
    tagT -= dt; if (tagT <= 0){ tagT = 0.25; STAGS = STAGS.filter(s => s.parent); for (const s of STAGS){ if (!s.parent || s.parent !== scene) continue; const d = s.position.distanceTo(camera.position); s.visible = d > 9 && d < 420 && (DISPLAY.includes(s) ? dd < 320 : true); } }
    if (me && H.nick() !== myNick){ myNick = H.nick(); if (me.tag){ me.hang.remove(me.tag); me.tag.material.map.dispose(); me.tag.material.dispose(); } me.tag = makeTag(myNick || '아기 파일럿'); me.tag.position.y = 2.75; me.hang.add(me.tag); }
    audioOn(); if (wind){ const sp = P.mode === 'flying' ? P.speed : 0; wind.g.gain.value = lerp(wind.g.gain.value, H.AudioSys.muted ? 0 : (P.mode === 'flying' ? 0.05 + sp * 0.006 : 0.012), dt * 2); wind.f.frequency.value = 300 + sp * 45;
      if (P.mode === 'flying'){ varioT -= dt; if (P.vy > 0.25 && varioT <= 0){ beep(480 + P.vy * 170, 0.07, 0.07); varioT = Math.max(0.12, 0.55 - P.vy * 0.13); } } }
    updateCamera(dt);
  }
  function updateCamera(dt){
    const flying = P.mode === 'flying' || P.mode === 'takeoff'; let tx = P.x, ty = P.y + (flying ? 3.4 : 1.3), tz = P.z, want = started ? (flying ? cam.flyDist : cam.walkDist) : 26;
    if (P.mode === 'bus'){ tx = BUS.g.position.x; ty = BUS.g.position.y + 2.2; tz = BUS.g.position.z; want = Math.max(20, cam.walkDist); cam.pitch = Math.max(cam.pitch, 0.42); }
    else if (P.mode === 'piggy'){ ty = P.y + 1.4; want = Math.max(11, cam.walkDist); }
    else if (P.ride) want = cam.walkDist * vobj(P.ride).camDist / 9;
    if (!flying && P.mode !== 'bus' && want < 6) ty += (6 - want) * 0.08; /* 가까이 당기면 얼굴 쪽을 본다 */
    if (cam.drag && NOW - cam.dragT > 0.25) cam.drag = false;
    if (!started){ cam.yaw += dt * 0.1; }
    else if (flying){ cam.yaw = lerpAngle(cam.yaw, P.heading + Math.PI + cam.off, Math.min(1, dt * 2.2)); if (!cam.drag) cam.off *= Math.exp(-dt * 0.6); }
    else if (P.mode === 'sit'){ cam.yaw += dt * 0.05; }
    else if ((P.mode === 'bus' && BUS.state === 'go') || P.mode === 'piggy' || ((P.ride || P.autoMoving) && P.moving)){ if (!cam.drag) cam.yaw = lerpAngle(cam.yaw, P.heading + Math.PI, Math.min(1, dt * 1.3)); }
    cam.d = lerp(cam.d, want, Math.min(1, dt * 2));
    const k = Math.min(1, dt * 9); cam.tx = lerp(cam.tx, tx, k); cam.ty = lerp(cam.ty, ty, k); cam.tz = lerp(cam.tz, tz, k);
    const cp = Math.cos(cam.pitch), sp = Math.sin(cam.pitch); let cx = cam.tx + Math.sin(cam.yaw) * cp * cam.d, cy = cam.ty + sp * cam.d, cz = cam.tz + Math.cos(cam.yaw) * cp * cam.d;
    const gh = Math.max(groundAt(cx, cz), WATER) + 1.2; if (cy < gh) cy = gh; camera.position.set(cx, cy, cz); camera.lookAt(cam.tx, cam.ty, cam.tz); skyDome.position.copy(camera.position);
  }

  /* ============================== 화면 (HUD · 작은 지도 · 결과 카드 · 부탁 카드 · 모바일 버튼) ============================== */
  const CSS = `
  body.skyw #depth,body.skyw #breath,body.skyw #dive,body.skyw #calm,body.skyw #surfHud,body.skyw #bagHud,body.skyw #keys,body.skyw #actions,body.skyw #act,body.skyw #mung,body.skyw #under,body.skyw #mask,body.skyw #bDex,body.skyw #bView,body.skyw #bTod,body.skyw #mTod{display:none!important}
  #skyUi{position:fixed;inset:0;pointer-events:none;z-index:6;font-family:var(--body);color:var(--basalt)}
  #skyUi .skp{background:rgba(251,243,225,.94);border-radius:16px;padding:7px 11px;box-shadow:0 4px 0 rgba(36,36,42,.14);border:2px dashed var(--rope)}
  #skStats{position:absolute;left:12px;top:86px;font-size:12px;min-width:186px}
  #skStats .row{display:flex;gap:9px;flex-wrap:wrap;align-items:baseline}
  #skStats b{font-family:var(--display);font-weight:normal;font-size:15px;margin-left:2px}
  #skVario{height:6px;border-radius:4px;background:#eceaf3;overflow:hidden;position:relative;margin-top:5px}
  #skVarioF{position:absolute;top:0;bottom:0;left:50%;width:0;background:#5bd18b}
  #skClimb{margin-top:6px;font-size:12px}#skClimb b{font-family:var(--display);font-weight:normal}
  #skClimbBar{height:6px;border-radius:4px;background:#eceaf3;overflow:hidden;margin-top:4px}#skClimbF{height:100%;width:0;background:linear-gradient(90deg,#ffb35c,#ff7a59)}
  #skRight{position:absolute;right:12px;top:100px;display:flex;flex-direction:column;align-items:flex-end;gap:6px;pointer-events:auto}
  #skMap{width:140px;height:140px;border-radius:18px;box-shadow:0 4px 0 rgba(36,36,42,.14);background:#dfeee0;border:3px solid #fff}
  #skNav{display:flex;align-items:center;gap:8px;font-size:12px;padding:5px 10px 5px 6px;pointer-events:none}
  #skNavA{width:28px;height:28px;border-radius:50%;background:#fff3e6;display:flex;align-items:center;justify-content:center;font-size:17px}
  #skNav b{font-family:var(--display);font-weight:normal;font-size:14px;display:block;line-height:1.1}
  #skRight .ib{width:42px;height:42px;border-radius:14px;border:0;background:rgba(251,243,225,.96);box-shadow:0 3px 0 rgba(36,36,42,.16);font-size:20px;display:grid;place-items:center}
  #skRight .ib.on{background:#ffe08a}#skRight .ib.dim{opacity:.5}
  #skRight .ibs{display:flex;gap:6px}
  #skPrompt{position:absolute;left:50%;bottom:calc(18px + env(safe-area-inset-bottom));transform:translateX(-50%);background:rgba(36,36,42,.82);color:#fff;padding:8px 16px;border-radius:999px;font-size:13px;white-space:nowrap;max-width:94vw;overflow:hidden;text-overflow:ellipsis}
  #skMob{position:absolute;right:12px;bottom:calc(14px + env(safe-area-inset-bottom));display:grid;grid-template-columns:auto auto;gap:10px;align-items:end;pointer-events:auto}
  #skMob button{border:0;border-radius:50%;font-family:var(--display);color:var(--basalt);box-shadow:0 4px 0 rgba(36,36,42,.2);touch-action:none}
  #skMain{width:84px;height:84px;background:var(--hallabong);color:#fff!important;font-size:17px;grid-column:2;grid-row:2}
  #skSub{width:62px;height:62px;background:rgba(251,243,225,.97);font-size:14px;grid-column:1;grid-row:2}
  #skUse{width:62px;height:62px;background:#ffe08a;font-size:13px;grid-column:2;grid-row:1;justify-self:center}
  #skMob button.held{transform:scale(.94);filter:brightness(.95)}
  #skRes,#skReq{position:absolute;inset:0;display:grid;place-items:center;pointer-events:auto;background:rgba(24,40,60,.28)}
  #skReq{background:none;place-items:start center;padding-top:90px;pointer-events:none}
  #skyUi .card{background:#fffaf0;border-radius:24px;padding:18px 18px 16px;width:min(360px,92vw);box-shadow:0 10px 30px rgba(20,40,60,.28);border:3px solid #fff;pointer-events:auto;text-align:center}
  #skRes h3{margin:2px 0 2px;font-family:var(--display);font-weight:normal;font-size:24px}#skRes .sub{font-size:13px;opacity:.75;margin-bottom:10px}
  #skRes .grid{display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px;margin:8px 0}#skRes .grid div{background:#f1f6ff;border-radius:12px;padding:6px 4px;font-size:11px}#skRes .grid b{display:block;font-family:var(--display);font-weight:normal;font-size:15px}
  #skRes .score{font-family:var(--display);font-size:30px;color:var(--hallabong)}#skRes .pearlw{font-size:14px;margin:2px 0 4px}#skRes .best{font-size:12px;opacity:.75}
  #skyUi .card .btn{display:block;width:100%;margin-top:8px;padding:11px;border-radius:14px;border:0;font-size:15px;background:#f1ede4}
  #skyUi .card .btn.primary{background:var(--hallabong);color:#fff}
  #skyUi .safe{font-size:11px;opacity:.7;margin:10px 0 0;line-height:1.45}
  .sksay{position:absolute;left:0;top:0;max-width:min(250px,64vw);background:#fff;color:var(--basalt);border-radius:16px;padding:8px 12px 9px;font-size:14px;line-height:1.35;box-shadow:0 4px 0 rgba(36,36,42,.16);border:2px solid #ffb35c;pointer-events:none;will-change:transform}
  .sksay::after{content:'';position:absolute;left:var(--tx,50%);bottom:-9px;margin-left:-8px;border:8px solid transparent;border-top-color:#ffb35c;border-bottom:0}
  .sksay b{display:block;font-family:var(--display);font-weight:normal;font-size:12px;color:#e8601a;margin-bottom:1px}
  #skReq .card{width:min(320px,90vw)}#skReq .row{display:flex;gap:8px}#skReq .row .btn{margin-top:10px;flex:1;width:auto}
  @media (max-width:720px){#skStats{top:74px;min-width:0;max-width:calc(100vw - 150px);font-size:11px}#skStats b{font-size:13px}#skMap{width:104px;height:104px}#skRight{top:64px}#skRight .ib{width:38px;height:38px;font-size:18px}#skPrompt{bottom:auto;top:calc(max(12px,env(safe-area-inset-top)) + 4px);font-size:11.5px;max-width:58vw;padding:6px 12px;left:auto;right:auto;transform:none;left:50%;transform:translateX(-50%);display:none}}
  `;
  let ui = null; const $s = id => ui && ui.querySelector('#' + id);
  function buildUi(){
    if (!document.getElementById('skyCss')){ const st = document.createElement('style'); st.id = 'skyCss'; st.textContent = CSS; document.head.appendChild(st); }
    ui = document.createElement('div'); ui.id = 'skyUi'; ui.className = 'hidden';
    ui.innerHTML = `<div class="skp" id="skStats"><div class="row"><span>해발<b id="skAlt">664</b>m</span><span>상승<b id="skV">0.0</b></span><span>시간<b id="skT">0:00</b></span><span>별<b id="skStar">0</b></span><span>링<b id="skRing">0/10</b></span><span>단풍<b id="skLeaf">0</b></span></div><div id="skVario"><i id="skVarioF"></i></div>
      <div id="skClimb" class="hidden"><div id="skCTxt">등산 0%</div><div id="skClimbBar"><i id="skClimbF" style="display:block"></i></div></div></div>
      <div id="skRight"><canvas id="skMap" width="280" height="280" aria-label="양방산 작은 지도"></canvas><div class="skp" id="skNav"><span id="skNavA">➤</span><span><b id="skNavN">착륙장</b><span id="skNavD">0m</span></span></div>
        <div class="ibs"><button class="ib" id="skShop" type="button" title="탈것 가게" aria-label="탈것 가게">🛒</button><button class="ib dim" id="skRide" type="button" title="탈것 타기/내리기 (R)" aria-label="탈것 타기 또는 내리기">🛴</button><button class="ib" id="skAuto" type="button" title="길 자동 따라가기 (G)" aria-label="길 자동 따라가기">🧭</button></div></div>
      <div id="skPrompt"></div><div class="sksay hidden" id="skSay0"><b></b><span></span></div><div class="sksay hidden" id="skSay1"><b></b><span></span></div><div class="sksay hidden" id="skSay2"><b></b><span></span></div>
      <div id="skMob" class="hidden"><button id="skUse" type="button" class="hidden">E</button><button id="skSub" type="button">달리기</button><button id="skMain" type="button">이륙!</button></div>
      <div id="skRes" class="hidden"><div class="card"><h3 id="skRT">사뿐 착륙!</h3><div class="sub" id="skRS">남한강 착륙장</div>
        <div class="grid"><div>비행 시간<b id="skR1">0:00</b></div><div>최고 해발<b id="skR2">0m</b></div><div>모은 별<b id="skR3">0</b></div><div>통과한 링<b id="skR4">0</b></div><div>착륙 정확도<b id="skR5">-</b></div><div>착지 충격<b id="skR6">-</b></div></div>
        <div class="score" id="skRScore">0점</div><div class="pearlw" id="skRPearl"></div><div class="best" id="skRBest"></div>
        <button class="btn primary" id="skRShop" type="button">진주로 탈것 고르기</button><button class="btn" id="skRWalk" type="button">그냥 걸어서 올라갈래요</button><button class="btn hidden" id="skRCar" type="button">회수 차량 불러서 착륙장으로</button>
        <p class="safe">실제 패러글라이딩은 자격 있는 파일럿과 2인승(탠덤)으로만 타요. 실제로는 업체 차량으로 이륙장까지 올라가요.</p></div></div>
      <div id="skReq" class="hidden"><div class="card"><b id="skQT">친구가 업어 달래요!</b><div class="row"><button class="btn primary" id="skQY" type="button">업어 주기</button><button class="btn" id="skQN" type="button">다음에</button></div></div></div>`;
    document.body.appendChild(ui);
    $s('skShop').onclick = () => H.openStore('veh'); $s('skRide').onclick = () => toggleRide(); $s('skAuto').onclick = () => toggleAuto();
    $s('skRShop').onclick = () => { hideResult(); H.openStore('veh'); }; $s('skRWalk').onclick = () => { hideResult(); toast('길을 따라 정상까지 걸어 올라가요! G를 누르면 길을 자동으로 따라가요'); };
    $s('skRCar').onclick = () => { hideResult(); P.x = LAND.x - 6; P.z = LAND.z - 40; P.y = groundAt(P.x, P.z); P.heading = Math.PI; toast('회수 차량이 착륙장까지 데려다줬어요'); };
    $s('skQY').onclick = () => acceptPiggy(reqFrom); $s('skQN').onclick = () => hideReq();
    const hold = (el, k, onDown) => { el.addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); vk[k] = true; el.classList.add('held'); H.AudioSys.init?.(); if (onDown) onDown(); });
      const up = () => { vk[k] = false; el.classList.remove('held'); }; el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up); el.addEventListener('pointerleave', up); };
    hold($s('skMain'), 'main', () => { if (P.mode !== 'flying') mainAction(); }); hold($s('skSub'), 'sub', () => { if (P.mode === 'ground' && P.ride) dismount(); });
    $s('skUse').addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); useAction(); });
    buildMinimapBase();
  }
  const resultOpen = () => !!ui && !$s('skRes').classList.contains('hidden');
  function hideResult(){ if (ui) $s('skRes').classList.add('hidden'); }
  function showReq(R){ reqFrom = R; $s('skQT').textContent = `${R.name} 님이 업어 달래요! 업으면 같이 정상까지 걸어가요`; $s('skReq').classList.remove('hidden'); beep(760, 0.1, 0.08); setTimeout(() => { if (reqFrom === R) hideReq(); }, 14000); }
  function hideReq(){ reqFrom = null; if (ui) $s('skReq').classList.add('hidden'); }
  function showResult(){ const r = lastResult, F = P.f;
    $s('skRT').textContent = { soft: '사뿐 착륙!', ok: '착륙 성공!', hard: '쿵! 엉덩방아', water: '풍덩! 강물 착륙' }[r.q];
    $s('skRS').textContent = r.inWater ? '남한강 물속 · 걸어서 강가로 나와요' : r.dl < 60 ? '남한강 착륙장' : r.out ? '착륙장에서 멀리 떨어진 곳 (아웃랜딩)' : '착륙장 근처';
    $s('skR1').textContent = fmtT(F.t); $s('skR2').textContent = toReal(F.maxY).toLocaleString() + 'm'; $s('skR3').textContent = F.stars + ' / ' + STARS.length; $s('skR4').textContent = F.rings + ' / ' + RINGS.length;
    $s('skR5').textContent = r.acc > 0 ? (r.dl < 1.2 ? '정중앙! ' : '') + '중심에서 ' + r.dl.toFixed(1) + 'm' : '착륙장 밖'; $s('skR6').textContent = r.sinkV.toFixed(1) + ' m/s';
    $s('skRScore').textContent = r.score + '점'; $s('skRPearl').textContent = r.pearls > 0 ? `진주 +${r.pearls}개 · 지금 ${H.pearl()}개` : `진주는 점수 ${PEARL_PER_SCORE}점마다 1개씩 받아요`;
    $s('skRBest').textContent = (r.nb ? '내 최고 점수! · ' : `내 최고 ${best.score}점 · `) + `착지 ${r.bonus} + 정확도 ${r.acc} + 비행 시간 ${r.tp}` + (r.nba ? ' · 정밀착륙 최고 기록!' : '');
    $s('skRCar').classList.toggle('hidden', !r.out); $s('skRes').classList.remove('hidden'); if (r.nb || r.nba) chime(); }
  /* 작은 지도 */
  let mmBase = null; const MMR = 700, MMS = 280; const w2c = (x, z) => [(x / MMR + 1) * MMS / 2, (z / MMR + 1) * MMS / 2];
  function buildMinimapBase(){ const cv = document.createElement('canvas'); cv.width = cv.height = MMS; const g = cv.getContext('2d'); const img = g.createImageData(MMS, MMS);
    for (let j = 0; j < MMS; j++) for (let i = 0; i < MMS; i++){ const x = (i / MMS * 2 - 1) * MMR, z = (j / MMS * 2 - 1) * MMR; const h = heightAt(x, z); let r, gg, b;
      if (h < WATER){ r = 95; gg = 180; b = 220; } else if (isRoad(x, z)){ r = 205; gg = 198; b = 184; } else { const t = clamp(h / 180, 0, 1); r = lerp(170, 120, t); gg = lerp(215, 150, t); b = lerp(130, 95, t); if (Math.floor(h / 18) !== Math.floor(heightAt(x + 4, z) / 18)){ r -= 25; gg -= 25; b -= 25; } }
      const k = (j * MMS + i) * 4; img.data[k] = r; img.data[k + 1] = gg; img.data[k + 2] = b; img.data[k + 3] = 255; }
    g.putImageData(img, 0, 0);
    g.strokeStyle = '#e2483d'; g.lineWidth = 4; g.beginPath(); g.moveTo(...w2c(BR.townEnd[0], BR.townEnd[1])); g.lineTo(...w2c(BR.nearEnd[0], BR.nearEnd[1])); g.stroke();
    g.fillStyle = '#e8a3a3'; HOUSES.forEach(h => { const [a, c] = w2c(h.x, h.z); g.fillRect(a - 1.5, c - 1.5, 3, 3); });
    g.strokeStyle = '#c98b4a'; g.lineWidth = 3; g.setLineDash([5, 4]); g.beginPath(); TRAIL.pts.forEach((p, i) => { const [a, c] = w2c(p[0], p[1]); i ? g.lineTo(a, c) : g.moveTo(a, c); }); g.stroke(); g.setLineDash([]);
    g.fillStyle = 'rgba(255,255,255,.45)'; THERMALS.forEach(t => { const [a, c] = w2c(t.x, t.z); g.beginPath(); g.arc(a, c, t.r / MMR * MMS / 2, 0, 7); g.fill(); });
    const [lx, lz] = w2c(LAND.x, LAND.z); g.fillStyle = '#ff6b5b'; g.beginPath(); g.arc(lx, lz, 9, 0, 7); g.fill(); g.fillStyle = '#fff'; g.beginPath(); g.arc(lx, lz, 4, 0, 7); g.fill();
    const [px, pz] = w2c(PAD.x, PAD.z); g.fillStyle = '#3b3a4a'; g.beginPath(); g.moveTo(px, pz - 10); g.lineTo(px - 8, pz + 6); g.lineTo(px + 8, pz + 6); g.closePath(); g.fill();
    g.font = 'bold 18px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; [[SHOP_POS, '🛒'], [STOP_POS, '🚏'], [TOWN, '🏘️']].forEach(([p, t]) => { const [a, c] = w2c(p.x, p.z); g.fillText(t, a, c); });
    g.font = 'bold 14px sans-serif'; g.fillStyle = '#2b5d86'; g.fillText('남한강', ...w2c(40, 410)); mmBase = cv; }
  function drawMinimap(){ const mm = $s('skMap'); if (!mm || !mmBase) return; const mg = mm.getContext('2d'); mg.drawImage(mmBase, 0, 0);
    const nr = RINGS.find(r => !r.got); if (nr && P.mode === 'flying'){ const [a, c] = w2c(nr.x, nr.z); mg.strokeStyle = '#ffc83d'; mg.lineWidth = 3; mg.beginPath(); mg.arc(a, c, 6, 0, 7); mg.stroke(); }
    mg.fillStyle = '#8a7fd6'; NPCS.forEach(n => { const [a, c] = w2c(n.r.rig.position.x, n.r.rig.position.z); mg.beginPath(); mg.arc(a, c, 3.5, 0, 7); mg.fill(); });
    mg.fillStyle = '#2fa7d8'; for (const R of REMOTES.values()){ if (!R.gl) continue; const [a, c] = w2c(R.gl.rig.position.x, R.gl.rig.position.z); mg.beginPath(); mg.arc(a, c, 4.5, 0, 7); mg.fill(); }
    { const [a, c] = w2c(BUS.g.position.x, BUS.g.position.z); mg.fillStyle = '#4caf50'; mg.fillRect(a - 5, c - 4, 10, 8); }
    const [a, c] = w2c(P.x, P.z); mg.save(); mg.translate(a, c); mg.rotate(-P.heading + Math.PI); mg.fillStyle = '#ff7a59'; mg.strokeStyle = '#fff'; mg.lineWidth = 2.5; mg.beginPath(); mg.moveTo(0, -11); mg.lineTo(7, 8); mg.lineTo(0, 4); mg.lineTo(-7, 8); mg.closePath(); mg.fill(); mg.stroke(); mg.restore(); }
  const STATE_LABEL = () => { const V = P.ride ? VEHMAP[P.ride] : null; return { ground: V ? `${V.name} 타는 중` : P.cy ? '친구 업고 가는 중' : P.climb.active ? '등산 중' : nearPad() ? '이륙장' : '산책 중', takeoff: '이륙 중', flying: '비행 중', landing: '착륙!', sit: '산멍 중', bus: '마을버스 탑승', piggy: '업혀 가는 중' }[P.mode]; };
  let hudT = 0, layT = 0;
  function updateHUD(dt){ hudT -= dt; layT -= dt; if (hudT > 0) return; hudT = 0.1;
    if (layT <= 0){ layT = 0.6; const sc = document.getElementById('spotcard'), tb = document.getElementById('topbar');
      if (sc){ const r = sc.getBoundingClientRect(); if (r.height) $s('skStats').style.top = Math.round(r.bottom + 8) + 'px'; }
      if (tb){ const r = tb.getBoundingClientRect(); if (r.height) $s('skRight').style.top = Math.round(r.bottom + 8) + 'px'; } }
    const V = P.ride ? VEHMAP[P.ride] : null, fl = P.mode === 'flying';
    H.setState(STATE_LABEL());
    $s('skAlt').textContent = toReal(P.y).toLocaleString(); $s('skV').textContent = fl ? (P.vy >= 0 ? '+' : '') + P.vy.toFixed(1) : '-';
    $s('skT').textContent = fmtT(fl || P.mode === 'landing' ? P.f.t : P.climb.active ? P.climb.t : P.mode === 'sit' ? P.sitT : 0); $s('skStar').textContent = P.f.stars; $s('skRing').textContent = P.f.rings + '/' + RINGS.length; $s('skLeaf').textContent = leafTotal;
    const vf = $s('skVarioF'); const v = fl ? clamp(P.vy / 4, -1, 1) : 0; vf.style.left = (v >= 0 ? 50 : 50 + v * 50) + '%'; vf.style.width = Math.abs(v * 50) + '%'; vf.style.background = v >= 0 ? '#5bd18b' : '#ff8a7a';
    const ground = P.mode === 'ground' || P.mode === 'bus' || P.mode === 'piggy', showClimb = ground && (P.climb.active || !nearPad()); $s('skClimb').classList.toggle('hidden', !showClimb);
    let tgt, name;
    if (fl || P.mode === 'takeoff'){ const nr = RINGS.find(r => !r.got); if (nr && fl){ tgt = nr; name = `다음 링 ${P.f.rings + 1}/${RINGS.length}`; } else { tgt = LAND; name = '착륙장'; } }
    else { const tn = trailNearest(P.x, P.z); const frac = TRAIL.cum[tn.i] / TRAIL.len * (tn.d < 30 ? 1 : 0);
      if (showClimb){ $s('skCTxt').textContent = `등산 ${Math.round(frac * 100)}% · 정상까지 ${((1 - frac) * MAP.trailKm).toFixed(1)}km` + (V ? ` · ${V.icon}` : ` · ${Math.round(P.climb.active ? P.climb.steps : P.steps).toLocaleString()}걸음`) + (P.boost > 0 ? ` · 마늘빵 ${Math.ceil(P.boost)}초` : ''); $s('skClimbF').style.width = (frac * 100) + '%'; }
      if (nearPad()){ tgt = PAD; name = '이륙장'; } else { const at = autoTarget(); tgt = at; name = at.name; } }
    const bb = Math.atan2(tgt.x - P.x, tgt.z - P.z); const rot = -(bb - (cam.yaw + Math.PI)); $s('skNavA').style.transform = `rotate(${rot - Math.PI / 2}rad)`;
    $s('skNavN').textContent = name; $s('skNavD').textContent = name === '정상 방향' ? '길 따라 쭉!' : Math.round(Math.hypot(tgt.x - P.x, tgt.z - P.z)) + 'm';
    const it = nearInter(); let pr = '';
    if (P.mode === 'ground'){ if (nearPad()) pr = TOUCH ? '[이륙!] 버튼을 누르면 달려서 이륙해요' : 'Space 달려서 이륙! · 마우스 드래그로 둘러보기';
      else if (it) pr = (TOUCH ? `[${it.short}] 버튼 · ` : 'E · ') + it.label;
      else if (V) pr = `${V.icon} ${V.name}` + (TOUCH ? ' · [내리기]' : ' · R 내리기 · G 길 자동 따라가기 · Space 빵빵');
      else pr = TOUCH ? '길 따라 정상까지 · 🛒 탈것 · 🧭 길 자동 따라가기' : '길 따라 정상까지 · Shift 달리기 · R 탈것 · G 길 자동 따라가기'; }
    else if (fl){ const agl = P.y - groundAt(P.x, P.z); pr = agl < 14 ? `땅이 가까워요! ${TOUCH ? '[브레이크]' : 'S'}를 꾹 = 플레어(사뿐 착륙 +100점)` : (TOUCH ? '조이스틱 ←→ 방향 · ↑ 가속 · ↓ 브레이크 · 하얀 점에서 빙글빙글 돌면 올라가요' : 'A/D 방향 · W 가속 · S 브레이크 · 하얀 점에서 빙글빙글 돌면 올라가요'); }
    else if (P.mode === 'sit') pr = '산멍 ' + fmtT(P.sitT) + ' · 움직이면 일어나요';
    else if (P.mode === 'bus') pr = BUS.state === 'wait' ? `친구 기다리는 중 ${BUS.riders}/${BUS_SEATS}명` + (P.busLeft ? ` · ${P.busLeft}초 뒤 AI 친구와 출발` : '') + (TOUCH ? ' · [내리기]' : ' · E 내리기(진주 돌려받음)') : '부릉부릉~ 정상으로 가는 중';
    else if (P.mode === 'piggy') pr = P.carrier ? `${remoteById(P.carrier)?.name || '친구'} 님 등에 업혀 가는 중… 영차 영차` : '튼튼이 등에 업혀 가는 중… 영차 영차';
    $s('skPrompt').textContent = pr;
    $s('skRide').textContent = SEL && VEHMAP[SEL] ? VEHMAP[SEL].icon : '🛴'; $s('skRide').classList.toggle('dim', !ownList().length); $s('skRide').classList.toggle('on', !!P.ride); $s('skAuto').classList.toggle('on', !!P.auto);
    if (TOUCH){ const showUse = (P.mode === 'ground' && !!it) || P.mode === 'sit' || (P.mode === 'bus' && BUS.state === 'wait'); $s('skUse').classList.toggle('hidden', !showUse); $s('skUse').textContent = P.mode === 'bus' ? '내리기' : P.mode === 'sit' ? '일어나기' : it ? it.short : 'E';
      $s('skMain').textContent = fl ? '브레이크' : P.mode === 'sit' ? '일어나기' : nearPad() ? '이륙!' : P.ride ? '빵빵' : '점프'; $s('skSub').textContent = fl ? '가속' : P.ride ? '내리기' : '달리기'; }
    drawMinimap();
  }

  /* ============================== 탈것 가게 (매점 창 그대로) ============================== */
  /* 가게 그림: 이모지 대신 진짜 탈것 모양을 작게 찍어서 보여 준다(렌더러가 없으면 이모지) */
  const THUMB = {}; let TH = null; const SRGB8 = new Uint8Array(256).map((_, i) => { const c = i / 255; return Math.round((c <= 0.0031308 ? c * 12.92 : 1.055 * Math.pow(c, 1 / 2.4) - 0.055) * 255); });
  function vehThumb(id){
    if (THUMB[id] !== undefined) return THUMB[id]; const R = H.renderer?.(); if (!R){ THUMB[id] = null; return null; }
    try {
      const S = 192; if (!TH){ const sc = new THREE.Scene(); sc.add(new THREE.HemisphereLight(0xe8f6ff, 0x9a8a70, 1.7)); const d = new THREE.DirectionalLight(0xfff0d8, 2.3); d.position.set(-2, 5, 4); sc.add(d); TH = { sc, cam: new THREE.PerspectiveCamera(30, 1, 0.05, 80), rt: new THREE.WebGLRenderTarget(S, S, { samples: 4 }), buf: new Uint8Array(S * S * 4) }; }
      let o; if (id === 'roller'){ o = new THREE.Group(); for (const x of [-0.18, 0.18]){ const k = makeSkate(); k.position.set(x, 0.18, x * 0.8); o.add(k); } } else { o = makeVehicle(id, false).g; o.visible = true; }
      o.rotation.y = 0.75; TH.sc.add(o); o.updateMatrixWorld(true); const bb = new THREE.Box3().setFromObject(o), c = bb.getCenter(new THREE.Vector3()), r = bb.getSize(new THREE.Vector3()).length() * 0.5, dist = r / Math.sin(15 * Math.PI / 180) * 0.95;
      TH.cam.position.set(c.x + dist * 0.12, c.y + dist * 0.36, c.z + dist * 0.92); TH.cam.lookAt(c);
      const prev = R.getRenderTarget(), cc = new THREE.Color(); R.getClearColor(cc); const ca = R.getClearAlpha();
      R.setRenderTarget(TH.rt); R.setClearColor(0x000000, 0); R.clear(); R.render(TH.sc, TH.cam); R.readRenderTargetPixels(TH.rt, 0, 0, S, S, TH.buf); R.setRenderTarget(prev); R.setClearColor(cc, ca);
      TH.sc.remove(o); o.traverse(m => { if (m.geometry) m.geometry.dispose(); });
      const cv = document.createElement('canvas'); cv.width = cv.height = S; const x = cv.getContext('2d'), img = x.createImageData(S, S), B = TH.buf;
      for (let y = 0; y < S; y++) for (let i = 0; i < S; i++){ const si = ((S - 1 - y) * S + i) * 4, di = (y * S + i) * 4, a = B[si + 3]; if (!a) continue; const k = 255 / a;
        img.data[di] = SRGB8[Math.min(255, Math.round(B[si] * k))]; img.data[di + 1] = SRGB8[Math.min(255, Math.round(B[si + 1] * k))]; img.data[di + 2] = SRGB8[Math.min(255, Math.round(B[si + 2] * k))]; img.data[di + 3] = a; }
      x.putImageData(img, 0, 0); THUMB[id] = cv; return cv;
    } catch (e){ console.warn('veh thumb', e); THUMB[id] = null; return null; }
  }
  function renderStore(tab, body, sub){
    const mk = H.el, ic = (e, bg) => H.iconCanvas(x => { x.fillStyle = bg || '#fff3e6'; x.beginPath(); x.arc(0, 0, 50, 0, 7); x.fill(); x.font = '58px sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(e, 0, 5); });
    const vic = v => { const t = vehThumb(v.id); return t ? H.iconCanvas(x => { x.fillStyle = '#fff3e6'; x.beginPath(); x.arc(0, 0, 50, 0, 7); x.fill(); x.drawImage(t, -56, -56, 112, 112); }) : ic(v.icon); };
    const price = n => { const p = mk('span', 'price'); p.appendChild(mk('i')); p.appendChild(document.createTextNode(String(n))); return p; };
    if (tab === 'veh'){ sub.textContent = '한 번 사면 계속 타요 · 사뿐히 착륙할수록 진주가 쌓여요';
      for (const v of VEH){ const own = owns(v.id), on = P.ride === v.id, c = mk('div', 'sti' + (on ? ' on' : '')); c.id = 'sv-' + v.id; c.appendChild(vic(v));
        const w = mk('div', 'w'); w.appendChild(mk('b', '', v.name + (own ? ' ✓' : ''))); w.appendChild(mk('small', '', `${v.desc} · 걷기의 ${(v.speed / 8).toFixed(1)}배${v.climb < 0.8 ? ' · 오르막은 낑낑' : ''}`)); c.appendChild(w);
        const b = mk('button', 'btn' + (own && on ? '' : ' primary')); b.type = 'button';
        if (!own){ b.appendChild(price(v.price)); b.appendChild(document.createTextNode(' 사기')); b.disabled = H.pearl() < v.price; b.onclick = () => { if (!H.spendPearl(v.price)) { toast(`진주가 ${v.price - H.pearl()}개 더 필요해요`); return; } H.giveOwned('veh', v.id); chime(); H.openStore(false); if (P.mode === 'ground') mount(v.id); toast(`${v.icon} ${v.name}를 샀어요! 타고 출발~`, 'found'); }; }
        else if (on){ b.textContent = '내리기'; b.onclick = () => { dismount(); H.refreshStore(); }; }
        else { b.textContent = '타기'; b.disabled = P.mode !== 'ground'; b.onclick = () => { H.openStore(false); mount(v.id); }; }
        c.appendChild(b); body.appendChild(c); } }
    else { sub.textContent = '현장에서 쓰는 1회 이용권이에요';
      for (const [e, n, d, pz, act] of [['🚌', '마을버스', `친구 ${BUS_SEATS}명이 모이면 바로, 아니면 ${BUS_AI_WAIT}초 뒤 AI 친구와 출발`, BUS_PRICE, '정류장에서 타요'], ['🤗', '친구 등에 업히기', '튼튼이(AI)는 진주 3개 · 진짜 친구는 "업어 줘" 부탁(무료)', PIGGY_PRICE, '등산로 입구 튼튼이'], ['🧄', '마늘빵', '1분 동안 걸음이 빨라져요', SNACK_PRICE, '매점에서 사요']]){
        const c = mk('div', 'sti'); c.appendChild(ic(e, '#eaf6ff')); const w = mk('div', 'w'); w.appendChild(mk('b', '', n)); w.appendChild(mk('small', '', d)); c.appendChild(w);
        const b = mk('button', 'btn'); b.type = 'button'; b.disabled = true; b.appendChild(price(pz)); b.appendChild(document.createTextNode(' ' + act)); c.appendChild(b); body.appendChild(c); } }
    if (H.TEST){ const t = mk('button', 'btn'); t.type = 'button'; t.id = 'skTestPearl'; t.textContent = '테스트용 진주 +300'; t.onclick = () => { H.addPearl(300); H.refreshStore(); }; body.appendChild(t); }
    body.appendChild(mk('p', 'stnote safe', '실제 패러글라이딩은 자격 있는 파일럿과 2인승(탠덤)으로만 타요. 실제로는 업체 차량으로 이륙장까지 올라가요.'));
  }

  /* ============================== 들어가기 · 나가기 ============================== */
  function disposeScene(){ if (!scene) return; const seen = new Set();
    scene.traverse(o => { if (o.geometry && !seen.has(o.geometry)){ seen.add(o.geometry); o.geometry.dispose(); } const ms = o.material ? (Array.isArray(o.material) ? o.material : [o.material]) : []; for (const m of ms){ if (!m || seen.has(m)) continue; seen.add(m); if (m.map && !seen.has(m.map)){ seen.add(m.map); m.map.dispose(); } m.dispose(); } });
    scene.clear(); }
  function enter(){
    if (built) return; ensureGrid(); seed = 7;
    scene = new THREE.Scene(); camera = new THREE.PerspectiveCamera(58, innerWidth / innerHeight, 0.3, 5000);
    COLL.length = 0; STAGS = []; STAFF = []; HOUSES = []; DISPLAY = []; socks = []; BENCHES = []; TP = []; PUFFS = []; STARS = []; RINGS = []; PICKS = []; NPCS = []; VILLAGERS = []; CARS = []; VOBJ = {}; skates = null; me = null;
    buildBase(); buildTrees(); buildTown(); buildVillage(); buildPadAndField(); buildSkyStuff(); buildBirds(); buildBus(); buildPeople(); buildStaff();
    shadow = new THREE.Mesh(new THREE.CircleGeometry(0.9, 24), new THREE.MeshBasicMaterial({ color: '#000', transparent: true, opacity: .3, depthWrite: false })); scene.add(shadow);
    myKey = H.myId(); buildPlayer(); resetToPad(); P.ride = null; P.mode = 'ground'; cam.d = 26; cam.tx = PAD.x; cam.ty = PH; cam.tz = PAD.z;
    buildUi(); resize(); built = true;
  }
  function exit(){ if (!built) return; audioOff(); clearRemotes(); hideReq(); for (const n of NPCS) freeBaby(n.r.baby); for (const v of VILLAGERS) freeBaby(v.b); for (const s of STAFF) freeBaby(s.b); if (FRIEND) freeBaby(FRIEND.b); if (me) freeBaby(me.baby);
    disposeScene(); scene = null; camera = null; built = false; started = false; if (ui){ ui.remove(); ui = null; } me = null; }
  function resize(){ if (!camera) return; const w = innerWidth, h = innerHeight; camera.aspect = w / h; const portrait = w / h < 0.8; camera.fov = portrait ? 72 : 58; if (portrait && !resize.done){ cam.flyDist = 22; cam.walkDist = 10.5; resize.done = true; } camera.updateProjectionMatrix(); }
  function key(code, repeat){ if (!started || H.blocked()) return false; if (code === 'Escape'){ if (resultOpen()){ hideResult(); return true; } if (reqFrom){ hideReq(); return true; } return false; }
    if (repeat) return ['Space', 'KeyE', 'KeyR', 'KeyG', 'KeyC'].includes(code);
    if (code === 'Space'){ if (P.mode !== 'flying') mainAction(); return true; } if (code === 'KeyE'){ if (reqFrom){ acceptPiggy(reqFrom); return true; } useAction(); return true; } if (code === 'KeyR'){ toggleRide(); return true; } if (code === 'KeyG'){ toggleAuto(); return true; } if (code === 'KeyC'){ cam.off = 0; return true; }
    return false; }
  function setStarted(v){ started = v; if (ui){ ui.classList.toggle('hidden', !v); $s('skMob').classList.toggle('hidden', !TOUCH); } if (v){ resetToPad(); cam.d = cam.walkDist; } }
  return {
    WINGS, VEH, VEHMAP, MAP, PEARL_PER_SCORE,
    get active(){ return built; }, get scene(){ return scene; }, get camera(){ return camera; }, get started(){ return started; },
    enter, exit, resize, setStarted, key, drag, zoom: f => zoom(f),
    frame(dt){ if (!built) return; update(dt); if (started && ui) updateHUD(dt); },
    presence, onPeers, clearRemotes, peerCount: () => REMOTES.size, peerNames: () => [...REMOTES.values()].map(R => R.name),
    renderStore, rebuildMe(){ if (built) buildPlayer(); }, hideUi(v){ if (ui) ui.classList.toggle('hidden', v || !started); },
    get best(){ return best; }, get mode(){ return P.mode; }, P, get BUS(){ return BUS; }, get FRIEND(){ return FRIEND; }, get renderInfo(){ return null; }, PAD, LAND, TRAIL, STOP_POS, SHOP_POS, SNACK_POS, FRIEND_HOME, BENCHES: () => BENCHES, RINGS: () => RINGS, STARS: () => STARS, THERMALS, REMOTES, heightAt, groundAt,
    _test: { get birds(){ return BIRDS && { n: BIRDS.list.length, seenG: BIRDS.seenG, seenV: BIRDS.seenV, mates: BIRDS.mates, pos: BIRDS.list.map(b => [b.k, Math.round(b.x), Math.round(b.y0), Math.round(b.zz)]) }; }, gooseLead: f => gooseLead(f, (Date.now() / 1000) % 86400), get staff(){ return STAFF.map(s => ({ x: s.x, z: s.z, talking: !!s.bubble, wave: s.waveT > 0, vis: s.grp.visible })); }, get villagers(){ return VILLAGERS.map(v => ({ x: v.x, z: v.z, vis: v.vis, ox: v.ox || 0, oz: v.oz || 0, say: !!v.bubble })); }, get kb(){ return Math.hypot(KB.x, KB.z); }, startTakeoff, mount, boardBus, cancelBus, startPiggy, toggleAuto, useAction, mainAction, requestPiggy, acceptPiggy: () => acceptPiggy(reqFrom), get reqFrom(){ return reqFrom; }, nearInter, resultOpen, hideResult, cam, vk, touchdown },
  };
}
