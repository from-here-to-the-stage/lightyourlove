// ═══════════════════════════════════════════════════════════════
// js/renderer/map-renderer.js
// Canvas地図描画エンジン
//   静的レイヤー: world-base.png（またはCanvas描画フォールバック）
//   動的レイヤー: 航路・飛行機・公演地ドット（毎フレーム）
// ═══════════════════════════════════════════════════════════════

import { ll, gc } from '../utils/geo.js';
import { MAP_CONFIG } from '../config/map-config.js';

const C = MAP_CONFIG.COLORS;

export class MapRenderer {
  constructor(canvas) {
    this.canvas     = canvas;
    this.ctx        = canvas.getContext('2d');
    this.bgCache    = null;   // 静的レイヤーキャッシュ
    this.cities     = [];     // cities.json
    this.continents = [];     // continents.json（フォールバック用）
    this.bgImage    = null;   // world-base.png
    this.useImage   = MAP_CONFIG.USE_IMAGE_BACKGROUND;
  }

  // ── 初期化（JSON + 画像の非同期読込）────────────────────────
  async init() {
    // 都市データは常に読込
    try {
      const r = await fetch('./js/data/cities.json');
      this.cities = await r.json();
    } catch(e) { console.warn('[MapRenderer] cities.json load failed:', e); }

    if (this.useImage) {
      try {
        this.bgImage = await this._loadImage(MAP_CONFIG.BG_IMAGE_PATH);
      } catch(e) {
        console.warn('[MapRenderer] Background image load failed — falling back to Canvas draw:', e);
        this.useImage = false;
      }
    }

    // 画像モードでない場合のみ大陸データを読込
    if (!this.useImage) {
      try {
        const r = await fetch('./js/data/continents.json');
        const data = await r.json();
        this.continents = data.features || [];
      } catch(e) { console.warn('[MapRenderer] continents.json load failed:', e); }
    }
  }

  // ── リサイズ（親要素に合わせる）────────────────────────────
  resize() {
    const parent = this.canvas.parentElement;
    if (!parent) return;
    const r = parent.getBoundingClientRect();
    this.canvas.width  = r.width > 0 ? r.width : (parent.offsetWidth || 358);
    this.canvas.height = 210;
    this.bgCache = null;  // サイズ変更でキャッシュ無効化
  }

  // ── 静的レイヤー生成・キャッシュ ────────────────────────────
  async renderStaticLayer() {
    const W = this.canvas.width, H = this.canvas.height;
    if (W === 0 || H === 0) return;

    const oc   = document.createElement('canvas');
    oc.width = W; oc.height = H;
    const octx = oc.getContext('2d');

    if (this.useImage && this.bgImage) {
      // 画像モード: world-base.png をそのまま貼る
      octx.drawImage(this.bgImage, 0, 0, W, H);
    } else {
      // フォールバック: Canvas 自前描画
      this._drawOcean(octx, W, H);
      this._drawGrid(octx, W, H);
      this._drawContinents(octx, W, H);
    }

    this.bgCache = { canvas: oc, w: W, h: H };
  }

  // ── 動的レイヤー描画（毎フレーム呼ぶ）────────────────────────
  // params: { TOUR, routeFrom, routeTo, targetStop, activeMember, planeT, getPower }
  renderDynamicLayer(params) {
    const { TOUR, routeFrom, routeTo, targetStop, activeMember, planeT, getPower } = params;
    const ctx = this.ctx;
    const W = this.canvas.width, H = this.canvas.height;
    if (W === 0 || H === 0) return;

    ctx.clearRect(0, 0, W, H);
    if (this.bgCache && this.bgCache.w === W && this.bgCache.h === H) {
      ctx.drawImage(this.bgCache.canvas, 0, 0);
    }

    this._drawCityDots(ctx, W, H);
    this._drawBgRoutes(ctx, W, H, TOUR);
    this._drawActiveRoute(ctx, W, H, routeFrom, routeTo, activeMember, getPower());
    this._drawTourDots(ctx, W, H, TOUR, targetStop, activeMember);
    this._drawPlane(ctx, W, H, routeFrom, routeTo, planeT, activeMember);
  }

  // ════════════════════════════════════════════════════════════
  // 内部描画メソッド
  // ════════════════════════════════════════════════════════════

  _pt(la, lo, W, H) { return ll(la, lo, W, H, MAP_CONFIG.GCP); }

  // ── 背景都市ドット ───────────────────────────────────────────
  _drawCityDots(ctx, W, H) {
    ctx.fillStyle = C.cityDot;
    this.cities.forEach(({ lat, lng }) => {
      const [x, y] = this._pt(lat, lng, W, H);
      if (x < 0 || x > W || y < 0 || y > H) return;
      ctx.beginPath(); ctx.arc(x, y, 1.4, 0, Math.PI * 2); ctx.fill();
    });
  }

  // ── ツアー全体航路（薄い破線）───────────────────────────────
  _drawBgRoutes(ctx, W, H, TOUR) {
    for (let i = 0; i < TOUR.length - 1; i++) {
      this._drawGCLine(ctx, W, H,
        TOUR[i].lat, TOUR[i].lng,
        TOUR[i+1].lat, TOUR[i+1].lng,
        MAP_CONFIG.GC_SEGMENTS_BG,
        C.routePassive, 0.6, [2, 8]
      );
    }
  }

  // ── アクティブ航路（パワー連動のグロー）────────────────────
  _drawActiveRoute(ctx, W, H, from, to, member, pwr) {
    const lw   = 1.4 + (pwr / 100) * 2;
    const glow = 6   + (pwr / 100) * 12;
    ctx.shadowBlur  = glow;
    ctx.shadowColor = member.color;
    this._drawGCLine(ctx, W, H,
      from.lat, from.lng, to.lat, to.lng,
      MAP_CONFIG.GC_SEGMENTS,
      member.color, lw, [5, 5]
    );
    ctx.shadowBlur = 0;
  }

  // ── 公演地ドット ─────────────────────────────────────────────
  _drawTourDots(ctx, W, H, TOUR, targetStop, activeMember) {
    const now = Date.now();
    TOUR.forEach(v => {
      const [x, y] = this._pt(v.lat, v.lng, W, H);
      if (x < 3 || x > W - 3 || y < 3 || y > H - 3) return;

      const isTgt  = v === targetStop;
      const isNext = v.status === 'next';
      const col    = isNext      ? C.dotNext
                   : isTgt       ? activeMember.color
                   : v._sent     ? C.dotSent
                                 : C.dotDefault;

      // パルスリング
      if (isNext || isTgt) {
        ctx.beginPath();
        ctx.arc(x, y, 7 + Math.sin(now / 600) * 1.5, 0, Math.PI * 2);
        ctx.strokeStyle = col + '66'; ctx.lineWidth = 1.5; ctx.stroke();
      }

      ctx.shadowBlur  = isNext ? 12 : isTgt ? 8 : 0;
      ctx.shadowColor = col;
      ctx.fillStyle   = col;
      ctx.beginPath();
      ctx.arc(x, y, isNext ? 4.5 : isTgt ? 4 : 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;

      if (isNext || isTgt) {
        ctx.fillStyle = col;
        ctx.font = `${isNext ? 'bold ' : ''}8px Chakra Petch,monospace`;
        ctx.fillText(v.city, x + 7, y + 3);
      }
    });
  }

  // ── 飛行機アニメーション ─────────────────────────────────────
  _drawPlane(ctx, W, H, from, to, planeT, activeMember) {
    const pts = gc(from.lat, from.lng, to.lat, to.lng, MAP_CONFIG.GC_SEGMENTS);
    if (pts.length < 2) return;

    const idx = Math.min(Math.floor(planeT * pts.length), pts.length - 2);
    const [px2, py2] = this._pt(pts[idx][0],   pts[idx][1],   W, H);
    const [nx,  ny]  = this._pt(pts[idx+1][0], pts[idx+1][1], W, H);
    if (px2 < 0 || px2 > W || py2 < 0 || py2 > H) return;

    const ang = Math.atan2(ny - py2, nx - px2);
    ctx.save();
    ctx.translate(px2, py2); ctx.rotate(ang);
    ctx.shadowBlur  = 10;
    ctx.shadowColor = activeMember.color;
    ctx.fillStyle   = activeMember.color;
    ctx.beginPath();
    ctx.moveTo(9, 0); ctx.lineTo(-3, -5); ctx.lineTo(-1, 0); ctx.lineTo(-3, 5);
    ctx.closePath(); ctx.fill();
    ctx.shadowBlur = 0;
    ctx.restore();
  }

  // ── 大圏線描画（日付変更線またぎ対応）───────────────────────
  _drawGCLine(ctx, W, H, la1, lo1, la2, lo2, n, color, lw, dash) {
    const pts = gc(la1, lo1, la2, lo2, n);
    const segs = []; let cur = [];
    pts.forEach(([la, lo], j) => {
      if (j > 0 && Math.abs(lo - pts[j-1][1]) > 180) { segs.push(cur); cur = []; }
      cur.push([la, lo]);
    });
    segs.push(cur);
    segs.forEach(seg => {
      if (seg.length < 2) return;
      ctx.beginPath(); let first = true;
      seg.forEach(([la, lo]) => {
        const [x, y] = this._pt(la, lo, W, H);
        if (first) { ctx.moveTo(x, y); first = false; } else ctx.lineTo(x, y);
      });
      ctx.strokeStyle = color; ctx.lineWidth = lw;
      ctx.setLineDash(dash); ctx.stroke(); ctx.setLineDash([]);
    });
  }

  // ════════════════════════════════════════════════════════════
  // Canvas描画フォールバック（USE_IMAGE_BACKGROUND: false 時）
  // ════════════════════════════════════════════════════════════

  _drawOcean(octx, W, H) {
    const bg = octx.createLinearGradient(0, 0, W, H);
    C.ocean.forEach((c, i) => bg.addColorStop(i / (C.ocean.length - 1), c));
    octx.fillStyle = bg; octx.fillRect(0, 0, W, H);
  }

  _drawGrid(octx, W, H) {
    octx.setLineDash([2, 4]); octx.lineWidth = 0.5;
    octx.strokeStyle = C.gridMinor;
    for (let la = -60; la <= 90; la += 30) {
      octx.beginPath();
      const [, y] = this._pt(la, 0, W, H);
      octx.moveTo(0, y); octx.lineTo(W, y); octx.stroke();
    }
    for (let lo = -180; lo <= 180; lo += 30) {
      octx.beginPath();
      const [x] = this._pt(0, lo, W, H);
      octx.moveTo(x, 0); octx.lineTo(x, H); octx.stroke();
    }
    octx.setLineDash([]); octx.strokeStyle = C.gridMajor; octx.lineWidth = 0.7;
    const [, eq] = this._pt(0, 0, W, H);
    octx.beginPath(); octx.moveTo(0, eq); octx.lineTo(W, eq); octx.stroke();
    const [pm] = this._pt(0, 0, W, H);
    octx.beginPath(); octx.moveTo(pm, 0); octx.lineTo(pm, H); octx.stroke();
    octx.setLineDash([]);
  }

  _drawContinents(octx, W, H) {
    this.continents.forEach(feat => {
      const pts  = feat.coordinates;
      const fill = feat.type === 'island' ? C.islandFill   : C.continentFill;
      const str  = feat.type === 'island' ? C.islandStroke : C.continentStroke;
      const lw   = feat.type === 'island' ? 0.5 : 0.7;
      if (!pts || pts.length < 3) return;
      octx.beginPath(); let first = true;
      for (const [la, lo] of pts) {
        const [x, y] = this._pt(la, lo, W, H);
        if (x < -20 || x > W + 20 || y < -20 || y > H + 20) { first = true; continue; }
        if (first) { octx.moveTo(x, y); first = false; } else octx.lineTo(x, y);
      }
      octx.closePath();
      octx.fillStyle = fill; octx.strokeStyle = str; octx.lineWidth = lw;
      octx.fill(); octx.stroke();
    });
  }

  // ── 画像読込ユーティリティ ───────────────────────────────────
  _loadImage(src) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload  = () => resolve(img);
      img.onerror = () => reject(new Error(`Failed to load: ${src}`));
      img.src = src;
    });
  }
}
