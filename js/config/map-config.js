// ═══════════════════════════════════════════════════════════════
// js/config/map-config.js
// 地図設定の一元管理 — GCP・配色・背景画像パス
//
// GCP導出: all_cities_pixel_coordinates_updated.csv 34都市
//   X: 最小二乗回帰  R²≈0.9999 / 平均誤差≈0.3px
//   Y: 精密2点解 + 30点検証  平均誤差≈4.8px
//
// IMG_H は world-base.png の実際の高さ(px)に合わせること:
//   確認コマンド: file assets/maps/world-base.png
// ═══════════════════════════════════════════════════════════════

export const MAP_CONFIG = {

  // ── Ground Control Points（Mercator投影キャリブレーション）────
  GCP: {
    IMG_W:  1338,      // world-base.png 幅 (Sydney x=1338.0 で確定)
    IMG_H:  870,       // ★ world-base.png の実測値に要更新（現在は推定値）
    LNG_S:  4.0906,    // px/degree longitude（最小二乗回帰）
    LNG_O:  719.474,   // x offset at lng=0
    LAT_S: -260.88,    // px/Mercator unit（負=y下向き）
    LAT_O:  597.29,    // y offset at equator
  },

  // ── 背景モード切替 ────────────────────────────────────────────
  // true  = 画像モード: world-base.png を Canvas 背景に使用（推奨）
  //         航路・飛行機・公演地ドットのみ Canvas で上書き描画
  // false = Canvas描画モード: continents.json を読み込んで自前描画
  //         画像読み込み失敗時は自動でこちらにフォールバック
  USE_IMAGE_BACKGROUND: true,
  BG_IMAGE_PATH: './assets/maps/world-base.png',

  // ── 配色定義 ─────────────────────────────────────────────────
  COLORS: {
    // 航路
    routePassive:    'rgba(91,63,217,.14)',   // 全体ルート破線

    // 公演地ドット
    dotNext:         '#5B3FD9',              // 次回公演
    dotSent:         '#16A34A',              // 送信済み
    dotDefault:      'rgba(91,63,217,.38)', // 未来公演

    // 背景都市ドット
    cityDot:         'rgba(91,63,217,.28)',

    // グリッド線（Canvas描画モード用）
    gridMinor:       'rgba(91,63,217,.08)',
    gridMajor:       'rgba(91,63,217,.14)',

    // Canvas描画モード用（画像フォールバック時のみ使用）
    ocean:           ['#E8EDFF', '#DDE4FA', '#D8E2F8'],
    continentFill:   'rgba(170,160,225,.30)',
    continentStroke: 'rgba(110,90,200,.50)',
    islandFill:      'rgba(170,160,225,.22)',
    islandStroke:    'rgba(110,90,200,.38)',
  },

  // ── アニメーション設定 ────────────────────────────────────────
  MAP_FPS:        10,   // 地図描画フレームレート（ms間隔: 1000/FPS）
  PLANE_SPEED:    0.005, // 飛行機移動速度（0〜1 / フレーム）
  GC_SEGMENTS:    120,  // アクティブ航路の大圏分割数
  GC_SEGMENTS_BG: 60,   // 背景航路の大圏分割数
};

// ── GCP検証テーブル（34都市・回帰誤差）─────────────────────────
// city              lng        lat      px_act  py_act  dx    dy
// Sydney         151.209  -33.868   1338.0   761.0   0.0   0.0  (基準点)
// London          -0.067   51.604    719.2   325.5  -0.2   0.0  (基準点)
// Melbourne      144.963  -37.813   1312.4   781.1  +0.2  -3.7
// Tokyo          139.752   35.706   1291.1   406.5  +0.1  -1.0
// Brussels         4.352   50.850    737.3   329.4   0.0  +2.3
// Santiago       -70.611  -33.464    430.7   758.9  -0.4  +1.5
// ──────────────────────────────────────────────────────────────
// IMG_H=870 は推定値。実画像確認後に LAT_O を微調整すると全体がシフト。
