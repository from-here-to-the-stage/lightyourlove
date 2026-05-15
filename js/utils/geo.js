// ═══════════════════════════════════════════════════════════════
// js/utils/geo.js
// 地理計算ユーティリティ — 投影・距離・方位角・大圏航路・海域名
// app.js / map-renderer.js / コンパス から共通 import して使う
// ═══════════════════════════════════════════════════════════════

export const toR = d => d * Math.PI / 180;
export const toD = r => r * 180 / Math.PI;

// ── Mercator 投影（GCPキャリブレーション済み）─────────────────
// gcp は map-config.js の MAP_CONFIG.GCP を渡す
export function ll(la, lo, W, H, gcp) {
  const x = (gcp.LNG_S * lo + gcp.LNG_O) / gcp.IMG_W * W;
  const m = Math.log(Math.tan(Math.PI / 4 + la * Math.PI / 360));
  const y = (gcp.LAT_S * m + gcp.LAT_O) / gcp.IMG_H * H;
  return [x, y];
}

// ── Haversine 距離（km）────────────────────────────────────────
export function hav(a, b, c, d) {
  const R = 6371;
  const e = Math.sin(toR(c - a) / 2) ** 2
          + Math.cos(toR(a)) * Math.cos(toR(c)) * Math.sin(toR(d - b) / 2) ** 2;
  return R * 2 * Math.asin(Math.sqrt(e));
}

// ── 方位角（度）───────────────────────────────────────────────
export function brng(a, b, c, d) {
  const p1 = toR(a), p2 = toR(c), Dl = toR(d - b);
  const y = Math.sin(Dl) * Math.cos(p2);
  const x = Math.cos(p1) * Math.sin(p2) - Math.sin(p1) * Math.cos(p2) * Math.cos(Dl);
  return (toD(Math.atan2(y, x)) + 360) % 360;
}

// ── 大圏航路（点列）───────────────────────────────────────────
export function gc(a, b, c, d, n = 100) {
  const pts = [];
  const p1 = toR(a), l1 = toR(b), p2 = toR(c), l2 = toR(d);
  const dist = 2 * Math.asin(Math.sqrt(
    Math.sin((p2 - p1) / 2) ** 2 +
    Math.cos(p1) * Math.cos(p2) * Math.sin((l2 - l1) / 2) ** 2
  ));
  for (let i = 0; i <= n; i++) {
    const f = i / n;
    if (dist < 1e-6) { pts.push([a, b]); continue; }
    const A = Math.sin((1 - f) * dist) / Math.sin(dist);
    const B = Math.sin(f * dist) / Math.sin(dist);
    const x = A * Math.cos(p1) * Math.cos(l1) + B * Math.cos(p2) * Math.cos(l2);
    const y = A * Math.cos(p1) * Math.sin(l1) + B * Math.cos(p2) * Math.sin(l2);
    const z = A * Math.sin(p1) + B * Math.sin(p2);
    pts.push([toD(Math.atan2(z, Math.sqrt(x * x + y * y))), toD(Math.atan2(y, x))]);
  }
  return pts;
}

// ── コンパス方位ラベル ─────────────────────────────────────────
const BLBL = ['N','NNE','NE','ENE','E','ESE','SE','SSE','S','SSW','SW','WSW','W','WNW','NW','NNW'];
export function blbl(b) { return BLBL[Math.round(b / 22.5) % 16]; }

// ── 海域名判定（送信メッセージ用）────────────────────────────
export function oceanName(fLa, fLo, tLa, tLo) {
  const mLo = (fLo + tLo) / 2, mLa = (fLa + tLa) / 2, lDiff = Math.abs(tLo - fLo);
  if (lDiff > 150 || (mLo < -60 && mLo > -180 && mLa > 0))
    return { jp: '太平洋上を移動中', en: 'crossing the Pacific Ocean' };
  if (mLo > -60 && mLo < 20 && mLa > 0)
    return { jp: '大西洋上を移動中', en: 'crossing the Atlantic Ocean' };
  if (mLo > 20 && mLo < 120 && mLa > 10)
    return { jp: 'ユーラシア大陸上空を移動中', en: 'crossing Eurasia' };
  if (mLo > 60 && mLo < 120 && mLa < 10)
    return { jp: 'インド洋上を移動中', en: 'crossing the Indian Ocean' };
  return { jp: '上空を移動中', en: 'on its way' };
}
