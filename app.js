// ═══════════════════════════════════════════════════════════════
// From Here. To the Stage. — app.js  (ES Module / 最終版)
// BTS ARIRANG World Tour 2026–2027  Fan Light Experience
// ─────────────────────────────────────────────────────────────
// 変更点サマリ:
//   ✦ 大陸Canvas描画を廃止 → MapRenderer (world-base.png) に委譲
//   ✦ 航路シェア廃止 → デイリー推しシェアに一本化
//   ✦ 複数日公演 + LIVE維持 パッチ統合済み
// ═══════════════════════════════════════════════════════════════

import { hav, brng, blbl, oceanName } from './js/utils/geo.js';
import { MapRenderer }                from './js/renderer/map-renderer.js';

'use strict';

// ════════════════════════════════════════════════
// DOM ユーティリティ
// ════════════════════════════════════════════════
function getEl(id) {
  const el = document.getElementById(id);
  if (!el) console.warn(`[DOM] Element #${id} not found`);
  return el;
}
function setText(id, text) { const el = getEl(id); if (el) el.textContent = text; return el; }
function safeClearElement(el) {
  if (!el) return;
  try {
    if (typeof el.replaceChildren === 'function') el.replaceChildren();
    else el.innerHTML = '';
  } catch(e) {
    while (el.firstChild) { try { el.removeChild(el.firstChild); } catch(_) { break; } }
  }
}

// ════════════════════════════════════════════════
// MEMBERS
// ════════════════════════════════════════════════
const MEMBERS = [
  {id:'rm',    name:'RM',        jp:'RM',    color:'#4A90D9',rgb:'74,144,217'},
  {id:'jin',   name:'Jin',       jp:'ジン',  color:'#FF69B4',rgb:'255,105,180'},
  {id:'suga',  name:'SUGA',      jp:'SUGA',  color:'#9BA4B8',rgb:'155,164,184'},
  {id:'jhope', name:'j-hope',    jp:'J-HOPE',color:'#FF6B35',rgb:'255,107,53'},
  {id:'jimin', name:'Jimin',     jp:'ジミン',color:'#EAC130',rgb:'234,193,48'},
  {id:'v',     name:'V',         jp:'V',     color:'#3DC98A',rgb:'61,201,138'},
  {id:'jk',    name:'Jung Kook', jp:'JK',    color:'#9B72F0',rgb:'155,114,240'},
];

// ════════════════════════════════════════════════
// SHOW DATE PARSER（複数日公演対応）
// ════════════════════════════════════════════════
function parseShowDates(cityData) {
  const dates = [];
  const baseTime = cityData.st ? new Date(cityData.st) : null;
  const baseYear = new Date(cityData.fd + 'T12:00:00Z').getUTCFullYear();
  (cityData.shows || []).forEach(showStr => {
    if (!showStr || showStr === 'TBA') return;
    const parts = showStr.split('/');
    if (parts.length < 2) return;
    const [month, day] = parts.map(Number);
    if (isNaN(month) || isNaN(day)) return;
    let showDate;
    if (baseTime) {
      showDate = new Date(baseTime);
      showDate.setMonth(month - 1);
      showDate.setDate(day);
      if (month === 1 && baseTime.getMonth() === 11) showDate.setFullYear(baseTime.getFullYear() + 1);
    } else {
      showDate = new Date(Date.UTC(baseYear, month - 1, day, 12, 0, 0));
    }
    dates.push(showDate);
  });
  return dates;
}

function getNextShowIndex(v) {
  if (!v.showDates || v.showDates.length === 0) return -1;
  const now = new Date();
  let bestIdx = -1, bestDiff = Infinity;
  for (let i = 0; i < v.showDates.length; i++) {
    const diff = v.showDates[i] - now;
    if (diff > -7200000 && diff < bestDiff) { bestDiff = diff; bestIdx = i; }
  }
  return bestIdx;
}

// ════════════════════════════════════════════════
// TOUR DATA
// ════════════════════════════════════════════════
const TOUR = [];
const _now = new Date();
REGIONS.forEach(r => r.cities.forEach(c => {
  const showDates = parseShowDates(c);
  let nextShowIndex = -1, minDiff = Infinity, hasPastShow = false;
  showDates.forEach((showTime, idx) => {
    const diff = showTime - _now;
    if (diff > -7200000) { if (diff < minDiff) { minDiff = diff; nextShowIndex = idx; } }
    else hasPastShow = true;
  });
  let status = 'future';
  if (nextShowIndex >= 0) {
    const diff = showDates[nextShowIndex] - _now;
    if      (diff < -7200000)                    status = 'past';
    else if (diff <= 3600000 && diff > -7200000) status = 'next';
  } else if (hasPastShow) { status = 'past'; }
  TOUR.push({ ...c, status, showDates, nextShowIndex, regionLabel: r.label, regionLabelJP: r.labelJP, isTBA: !c.st || c.venue === 'TBA' });
}));
let foundNext = false;
for (let i = 0; i < TOUR.length; i++) {
  if (TOUR[i].status === 'past') continue;
  if (!foundNext && TOUR[i].nextShowIndex >= 0) { TOUR[i].status = 'next'; foundNext = true; }
  else if (TOUR[i].status === 'next') TOUR[i].status = 'future';
}

// ════════════════════════════════════════════════
// SECURITY MODULE
// ════════════════════════════════════════════════
const Sec = {
  manifest: null,
  async init() {
    try {
      const r = await fetch('./manifest.json?_=' + Date.now(), {cache:'no-store', signal: AbortSignal.timeout(3000)});
      if (r.ok) this.manifest = await r.json();
    } catch(e) {}
  },
  async hmac(data, keyHex) {
    const keyBytes = new Uint8Array(keyHex.match(/.{2}/g).map(h => parseInt(h, 16)));
    const key = await crypto.subtle.importKey('raw', keyBytes, {name:'HMAC',hash:'SHA-256'}, false, ['sign']);
    const sig  = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(JSON.stringify(data)));
    return Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2,'0')).join('');
  },
  async sign(data)       { if (!this.manifest?.k) return 'unsigned'; return await this.hmac(data, this.manifest.k); },
  async save(key, data)  { const sig = await this.sign(data); localStorage.setItem(key, JSON.stringify({d:data, s:sig, v:this.manifest?.v||0})); },
  async load(key, fallback) {
    const raw = localStorage.getItem(key);
    if (!raw) return {...fallback};
    try {
      const {d, s} = JSON.parse(raw);
      if (this.manifest?.k) {
        const expected = await this.hmac(d, this.manifest.k);
        if (s !== expected && s !== 'unsigned') { localStorage.removeItem(key); return {...fallback}; }
      }
      return d;
    } catch(e) { return {...fallback}; }
  },
};

// ════════════════════════════════════════════════
// SDS-v2 CLIENT MODULE
// ════════════════════════════════════════════════
const SDS = {
  GAS_URL:     '%%GAS_URL%%',
  STORAGE_KEY: 'bts_lr_sds_v2',
  SESSION_KEY: 'bts_lr_sds_sess',
  FP_KEY:      'bts_lr_fp_v1',
  isGASEnabled() { return this.GAS_URL && !this.GAS_URL.startsWith('%%') && this.GAS_URL.startsWith('https://'); },
  jstDateStr()   { return new Date(Date.now() + 9*60*60*1000).toISOString().slice(0, 10); },
  _saltCache: null,
  async getSalt() {
    const today = this.jstDateStr();
    if (this._saltCache?.date === today) return this._saltCache.salt;
    try {
      const res = await fetch(`./tokens/${today}.json?_=${Date.now()}`, {cache:'no-store', signal: AbortSignal.timeout(3000)});
      if (!res.ok) return null;
      const data = await res.json();
      if (data.expires && new Date() >= new Date(data.expires)) return null;
      this._saltCache = { date: today, salt: data.salt || data.token };
      return this._saltCache.salt;
    } catch(e) { return null; }
  },
  async generateNonce() {
    const buf = new Uint8Array(16); crypto.getRandomValues(buf);
    return Array.from(buf).map(b => b.toString(16).padStart(2,'0')).join('');
  },
  async sign(salt, fp, sk, nonce, date) {
    const msg = new TextEncoder().encode(salt + fp + '|' + sk + '|' + nonce + '|' + date);
    const buf = await crypto.subtle.digest('SHA-256', msg);
    return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2,'0')).join('');
  },
  async getFingerprint() {
    const saved = localStorage.getItem(this.FP_KEY);
    if (saved && /^[0-9a-f]{64}$/i.test(saved)) return saved;
    const canvas = document.createElement('canvas');
    const c2 = canvas.getContext('2d');
    c2.font = '14px Chakra Petch, monospace'; c2.fillText('FHTS✦光🌟', 2, 2);
    const raw = canvas.toDataURL() + navigator.language + screen.width + screen.height + (navigator.hardwareConcurrency||0) + (navigator.deviceMemory||0);
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(raw));
    const fp = Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2,'0')).join('');
    localStorage.setItem(this.FP_KEY, fp); return fp;
  },
  loadLocal()   { try { return JSON.parse(localStorage.getItem(this.STORAGE_KEY) || '{}'); } catch(e) { return {}; } },
  loadSession() { try { return JSON.parse(sessionStorage.getItem(this.SESSION_KEY) || '{}'); } catch(e) { return {}; } },
  isLocalSent(sk) {
    const today = this.jstDateStr(), lr = this.loadLocal()[sk], sr = this.loadSession()[sk];
    return lr?.date === today || sr?.date === today;
  },
  saveLocal(sk, memberId, sig, nonce, date) {
    const local = this.loadLocal(); local[sk] = { date, memberId, sig, nonce, savedAt: new Date().toISOString() };
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(local));
    const sess = this.loadSession(); sess[sk] = { date, memberId };
    sessionStorage.setItem(this.SESSION_KEY, JSON.stringify(sess));
  },
  async checkAndSend(sk, memberId) {
    const date = this.jstDateStr();
    if (this.isLocalSent(sk)) return { ok: false, reason: 'local_duplicate', source: 'local' };
    const fp = await this.getFingerprint();
    if (this.isGASEnabled()) {
      const salt = await this.getSalt();
      if (!salt) return { ok: true, reason: 'local_fallback', source: 'local' };
      const nonce = await this.generateNonce();
      const sig   = await this.sign(salt, fp, sk, nonce, date);
      try {
        const result = await (await fetch(this.GAS_URL, {
          method:'POST', headers:{'Content-Type':'text/plain'},
          body: JSON.stringify({showKey:sk, memberId, fingerprint:fp, sig, nonce, date, v:2}),
          signal: AbortSignal.timeout(6000)
        })).text();
        if (result === 'Success')   { this.saveLocal(sk, memberId, sig, nonce, date); return { ok: true, source: 'gas' }; }
        if (result === 'Duplicate') { this.saveLocal(sk, memberId, sig, nonce, date); return { ok: false, reason: 'gas_duplicate', source: 'gas' }; }
        if (result.startsWith('Invalid')) return { ok: false, reason: 'invalid_signature', source: 'gas' };
        if (result.startsWith('Expired')) return { ok: false, reason: 'expired_date', source: 'gas' };
        return { ok: true, reason: 'gas_fallback', source: 'local' };
      } catch(e) { return { ok: true, reason: 'network_fallback', source: 'local' }; }
    } else {
      const salt = await this.getSalt(), nonce = await this.generateNonce();
      const sig = salt ? await this.sign(salt, fp, sk, nonce, date) : 'unsigned';
      this.saveLocal(sk, memberId, sig, nonce, date);
      return { ok: true, source: 'actions-only' };
    }
  }
};

// ════════════════════════════════════════════════
// PER-SHOW SENT STATE
// ════════════════════════════════════════════════
const SENT_KEY = 'bts_lr_sent_v5';
let sentShows = {};
try { sentShows = JSON.parse(localStorage.getItem(SENT_KEY)||'{}'); } catch(e) {}
const showKey = v => `${v.fd}_${v.city}`;
const isSent  = v => !!sentShows[showKey(v)];
const sentMem = v => { const e = sentShows[showKey(v)]; if (!e) return null; const id = typeof e === 'object' ? e.m : e; return MEMBERS.find(m => m.id === id) || null; };
function markSent(v, m, pwr) {
  sentShows[showKey(v)] = {m: m.id, p: Math.round(pwr), d: new Date().toISOString().slice(0,10)};
  localStorage.setItem(SENT_KEY, JSON.stringify(sentShows));
}

// ════════════════════════════════════════════════
// POWER / STREAK SYSTEM
// ════════════════════════════════════════════════
const POWER_KEY = 'bts_lr_power_v1';
let powerData = {lastDate:'', streak:0, total:0};
function todayStr()     { return new Date().toISOString().slice(0,10); }
function yesterdayStr() { return new Date(Date.now()-86400000).toISOString().slice(0,10); }
function recordDailyVisit() {
  const today = todayStr(); if (powerData.lastDate === today) return;
  powerData.streak = powerData.lastDate === yesterdayStr() ? powerData.streak+1 : 1;
  powerData.total++; powerData.lastDate = today; savePower();
}
function savePower() { Sec.save(POWER_KEY, powerData); }
function getPower()  { return Math.min(powerData.total * 0.8 + powerData.streak * 2.5, 100); }

// ════════════════════════════════════════════════
// DAILY MEMBER CHECKIN SYSTEM
// ════════════════════════════════════════════════
const DAILY_KEY = 'bts_lr_daily_v1';
let dailyData = {date:'', members:[], rainbowCount:0};
function resetDailyIfNeeded() {
  if (dailyData.date !== todayStr()) {
    dailyData = {date: todayStr(), members: [], rainbowCount: dailyData.rainbowCount||0};
    Sec.save(DAILY_KEY, dailyData);
  }
}
function checkInMember(memberId) {
  resetDailyIfNeeded();
  if (dailyData.members.length >= 1) return { action: 'locked', reason: 'already_selected' };
  dailyData.members = [memberId];
  powerData.total = (powerData.total||0) + 1;
  savePower(); Sec.save(DAILY_KEY, dailyData);
  setTimeout(() => showChargeEffect(MEMBERS.find(m => m.id === memberId) || activeMember), 100);

  // GA4: デイリーチェックイン
  GA.trackDailyCheckin(memberId, powerData.total);

  return { action: 'added', memberId };
}

// ════════════════════════════════════════════════
// TITLE COMPUTATION
// ════════════════════════════════════════════════
const TITLE_TIERS = [
  {min:0,  icon:'—',    jp:'—',         en:'—',                  next:1},
  {min:1,  icon:'🌱',   jp:'ルーキー',   en:'ROOKIE',             next:6},
  {min:6,  icon:'⭐',   jp:'ファン',     en:'FAN',                next:16},
  {min:16, icon:'⭐⭐', jp:'ARMY',       en:'ARMY',               next:31},
  {min:31, icon:'💫',   jp:'光の使者',   en:'MESSENGER',          next:51},
  {min:51, icon:'✨',   jp:'星の守護者', en:'STAR GUARDIAN',      next:66},
  {min:66, icon:'🌟',   jp:'皆勤賞',    en:'PERFECT ATTENDANCE', next:null},
];
function computeTitles() {
  const stars = Object.keys(sentShows).length;
  const tier  = [...TITLE_TIERS].reverse().find(t => stars >= t.min) || TITLE_TIERS[0];
  const mc = {};
  Object.values(sentShows).forEach(e => { const id = typeof e === 'object' ? e.m : e; mc[id] = (mc[id]||0)+1; });
  const topEntry = Object.entries(mc).sort((a,b) => b[1]-a[1])[0];
  let oshi = null;
  if (topEntry) {
    const [mid, cnt] = topEntry, m = MEMBERS.find(x => x.id === mid);
    const allSame = stars > 0 && Object.values(sentShows).every(e => (typeof e === 'object' ? e.m : e) === mid);
    if (allSame && stars >= 5)  oshi = {jp:`${m.jp}への一途な愛`, en:`ETERNAL DEVOTION · ${m.name}`, color:m.color};
    else if (cnt >= 10)         oshi = {jp:`${m.jp}の光`,        en:`LIGHT OF ${m.name}`,            color:m.color};
    else if (cnt >= 3)          oshi = {jp:`${m.jp}の声`,        en:`VOICE OF ${m.name}`,            color:m.color};
  }
  const rc = dailyData.rainbowCount||0;
  let rainbow = null;
  if (rc >= 7)      rainbow = {jp:'🌈✨ 虹の伝説', en:'🌈✨ RAINBOW LEGEND'};
  else if (rc >= 3) rainbow = {jp:'🌈🌈 虹の戦士', en:'🌈🌈 RAINBOW WARRIOR'};
  else if (rc >= 1) rainbow = {jp:'🌈 虹の夢',     en:'🌈 RAINBOW DREAMER'};
  return {tier, stars, oshi, rainbow};
}

// ════════════════════════════════════════════════
// APP STATE
// ════════════════════════════════════════════════
let lang         = 'jp';
let activeMember = MEMBERS.find(m => m.id === 'jimin');
let energyCount  = 24831 + Math.floor(Math.random() * 80);
let routeFrom    = TOUR[0], routeTo = TOUR[1], targetStop = TOUR[0];
let devHeading   = 0, demoMode = false, sendReady = false;
let userLat = null, userLng = null, geoGranted = false;
let planeT = 0, planeDir = 1;
let mapRenderer = null;
const shownArrival = new Set();
try { JSON.parse(localStorage.getItem('bts_lr_arr')||'[]').forEach(k => shownArrival.add(k)); } catch(e) {}
const WINDOW_MS = 60 * 60 * 1000;

// ════════════════════════════════════════════════
// LANGUAGE
// ════════════════════════════════════════════════
function applyLangToCards() {
  const isEn = lang === 'en';
  document.querySelectorAll('.txt-jp').forEach(el => { if (el) el.style.display = isEn ? 'none' : ''; });
  document.querySelectorAll('.txt-en').forEach(el => { if (el) el.style.display = isEn ? '' : 'none'; });
  document.querySelectorAll('.sc-tag[data-jp]').forEach(el => { el.textContent = isEn ? el.dataset.en : el.dataset.jp; });
  document.querySelectorAll('[data-name-jp]').forEach(el => { el.textContent = isEn ? el.dataset.nameEn : el.dataset.nameJp; });
}
function toggleLang() {
  lang = lang === 'jp' ? 'en' : 'jp';
  document.body.classList.toggle('lang-en', lang === 'en');
  const langActive = getEl('langActive'), langOther = getEl('langOther');
  if (langActive) langActive.textContent = lang.toUpperCase();
  if (langOther)  langOther.textContent  = lang === 'jp' ? 'EN' : 'JP';
  document.documentElement.lang = lang === 'jp' ? 'ja' : 'en';
  applyLangToCards();
  refreshStep(); updateSendBtnText(); updateCountdown(); updateShowtime();
  renderTitleZone(); refreshDailyUI();
  // ── シェアモーダルが開いている場合は閉じる（言語切替による文字化け防止）──
  const _modal = getEl('shareModal');
  if (_modal && _modal.classList.contains('on')) _modal.classList.remove('on');
}

// ════════════════════════════════════════════════
// STARS BACKGROUND
// ════════════════════════════════════════════════
function initStars() {
  try {
    const el = getEl('stars'); if (!el) return;
    safeClearElement(el);
    for (let i = 0; i < 72; i++) {
      const s = document.createElement('div'); s.className = 'star';
      const sz = Math.random() * 1.8 + 0.7;
      s.style.cssText = `left:${Math.random()*100}%;top:${Math.random()*100}%;width:${sz}px;height:${sz}px;`;
      s.style.setProperty('--d',  (2 + Math.random() * 5) + 's');
      s.style.setProperty('--o',  (0.08 + Math.random() * 0.48).toFixed(2));
      s.style.setProperty('--dl', (Math.random() * 6) + 's');
      el.appendChild(s);
    }
  } catch(e) { console.warn('[Stars] Init failed:', e); }
}

// ════════════════════════════════════════════════
// CARDS
// ════════════════════════════════════════════════
const MONJP = ['1月','2月','3月','4月','5月','6月','7月','8月','9月','10月','11月','12月'];

function initCards() {
  try {
    const wrap = getEl('schedCards'); if (!wrap) return;
    safeClearElement(wrap);
    let lastRegion = '';
    const mons  = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const monJP = ['1月','2月','3月','4月','5月','6月','7月','8月','9月','10月','11月','12月'];
    TOUR.forEach((v, i) => {
      if (v.regionLabel !== lastRegion) {
        lastRegion = v.regionLabel;
        const div = document.createElement('div');
        div.className = 'swiper-slide region-slide'; div.style.width = 'auto';
        div.innerHTML = `<div class="region-tag"><span class="txt-jp">${v.regionLabelJP}</span><span class="txt-en" style="display:none">${v.regionLabel}</span></div>`;
        wrap.appendChild(div);
      }
      const d = new Date(v.fd + 'T12:00:00Z'), yr = d.getUTCFullYear();
      const slide = document.createElement('div'); slide.className = 'swiper-slide';
      const isPast = v.status === 'past', isNext = v.status === 'next';
      const tagJP = isNext ? '▶ 次回公演' : isPast ? '済' : 'UPCOMING';
      const tagEN = isNext ? '▶ NEXT'     : isPast ? 'PAST' : 'UPCOMING';
      const borderCol = isNext ? 'rgba(91,63,217,.4)' : 'rgba(91,63,217,.12)';
      const tagCol    = isNext ? 'var(--purple)' : 'var(--dim)';
      slide.innerHTML = `<div class="scard ${v.status}${v.isTBA?' tba':''}${isSent(v)?' show-sent':''}" id="card${i}" style="border-color:${borderCol};">
        <div class="sc-num" style="font-size:11px;color:var(--dim);letter-spacing:1px;margin-bottom:5px;">${String(i+1).padStart(2,'0')} · ${v.country}</div>
        <div class="sc-tag" id="ctag${i}" data-jp="${tagJP}" data-en="${tagEN}" style="font-size:11px;font-weight:700;letter-spacing:1px;margin-bottom:5px;color:${tagCol};">${lang==='en'?tagEN:tagJP}</div>
        <div class="sc-city" style="font-size:15px;font-weight:800;line-height:1.2;margin-bottom:3px;font-family:'Chakra Petch',sans-serif;">${v.city}</div>
        <div class="sc-venue" style="font-size:11px;color:var(--dim);line-height:1.4;margin-bottom:5px;">${v.venue}</div>
        <div style="font-size:12px;color:var(--text2);font-weight:600;margin-bottom:4px;">
          <span class="txt-jp">${monJP[d.getUTCMonth()]}${d.getUTCDate()}日${yr!==2026?' '+yr+'年':''}</span>
          <span class="txt-en" style="display:none">${mons[d.getUTCMonth()]} ${d.getUTCDate()}${yr!==2026?', '+yr:''}</span>
        </div>
        <div style="display:inline-flex;align-items:center;gap:3px;background:rgba(91,63,217,.1);border-radius:5px;padding:2px 7px;font-size:11px;color:var(--purple);font-weight:600;margin-bottom:5px;">
          ✦ ${v.n}<span class="txt-jp">公演</span><span class="txt-en" style="display:none"> NIGHTS</span>
        </div>
        <div style="font-size:11px;color:var(--dim);">${v.shows.slice(0,3).join(' / ')}${v.shows.length>3?'…':''}</div>
      </div>`;
      const cardEl = slide.querySelector('.scard');
      if (cardEl) cardEl.addEventListener('click', () => selectStop(v, i));
      wrap.appendChild(slide);
    });
    if (typeof Swiper !== 'undefined') {
      try {
        const sw = new Swiper('#schedSwiper', {slidesPerView:'auto', spaceBetween:8, freeMode:true, grabCursor:true});
        const track = getEl('schedTrack'), thumb = getEl('schedThumb');
        function syncBar() {
          if (!track || !thumb) return;
          const wr = document.querySelector('#schedSwiper .swiper-wrapper'); if (!wr) return;
          const total = wr.scrollWidth, view = sw.width || track.offsetWidth;
          if (total <= view) { track.style.display = 'none'; return; }
          track.style.display = '';
          const ratio = Math.min(view/total, 1), tw = Math.max(ratio * track.offsetWidth, 24);
          const maxL = track.offsetWidth - tw, prog = sw.progress || 0;
          thumb.style.width = tw + 'px';
          thumb.style.left  = Math.max(0, Math.min(maxL, prog * maxL)) + 'px';
        }
        sw.on('progress', syncBar); sw.on('setTranslate', syncBar); setTimeout(syncBar, 200);
        if (track) track.addEventListener('click', e => {
          const rect = track.getBoundingClientRect();
          sw.setProgress((e.clientX - rect.left) / rect.width, 0); syncBar();
        });
      } catch(e) { console.warn('[Swiper] Init failed:', e); }
    }
  } catch(e) { console.error('[Cards] Fatal error:', e); }
}

function refreshCardSent() {
  TOUR.forEach((v, i) => { const c = getEl('card'+i); if (c) c.classList.toggle('show-sent', isSent(v)); });
}

// ════════════════════════════════════════════════
// SELECT STOP（複数日公演 + LIVE維持統合版）
// ════════════════════════════════════════════════
function findNextTarget() {
  const now = new Date();
  // 優先①: LIVE中（開演後0〜2時間）かつ送信済み
  for (const v of TOUR) {
    if (!v.st || v.isTBA || !isSent(v)) continue;
    for (const t of (v.showDates || [])) { const d = t - now; if (d <= 0 && d > -7200000) return v; }
  }
  // 優先②: 送信ウィンドウ内の未送信
  for (const v of TOUR) {
    if (!v.st || v.isTBA || isSent(v)) continue;
    for (const t of (v.showDates || [])) { const d = t - now; if (d >= 0 && d <= WINDOW_MS) return v; }
  }
  // 優先③: status==='next' の未送信
  for (const v of TOUR) { if (v.status === 'next' && !isSent(v)) return v; }
  // 優先④: 最も近い未来のshowDateを持つ未送信
  let closest = null, closestDiff = Infinity;
  for (const v of TOUR) {
    if (isSent(v)) continue;
    for (const t of (v.showDates || [])) { const d = t - now; if (d >= 0 && d < closestDiff) { closestDiff = d; closest = v; } }
    if (!v.st && !closest) { closest = v; break; }
  }
  return closest || TOUR[TOUR.length-1];
}

function selectStop(v, i) {
  try {
    const fi = Math.max(0, i-1); setRoute(TOUR[fi], v); targetStop = v;
    document.querySelectorAll('.scard').forEach(c => { if (c) c.classList.remove('sel'); });
    const card = getEl('card'+i); if (card) card.classList.add('sel');
    const d = new Date(v.fd + 'T12:00:00Z');
    const tCity = getEl('tCity'), tDetail = getEl('tDetail'), tSent = getEl('tSent'), tSentTxt = getEl('tSentTxt');
    if (tCity) tCity.textContent = v.city + (v.reg ? ', '+v.reg : '');
    const _mons = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    if (tDetail) tDetail.innerHTML =
      `<span class="txt-jp">${MONJP[d.getUTCMonth()]}${d.getUTCDate()}日 · ${v.venue}</span>` +
      `<span class="txt-en" style="${lang==='jp'?'display:none':''}">${_mons[d.getUTCMonth()]} ${d.getUTCDate()} · ${v.venue}</span>`;
    const sm = sentMem(v);
    if (tSent && tSentTxt) {
      if (sm) { tSentTxt.innerHTML = `<span class="txt-jp">${sm.jp||sm.name}カラーで送信済み</span><span class="txt-en">Sent as ${sm.name}</span>`; tSent.classList.add('on'); }
      else tSent.classList.remove('on');
    }
    updateShowtime(); evaluateSendState();
    if (geoGranted && userLat) updateCompassFromUser();
    else {
      const lbl = getEl('compassFromLabel');
      if (lbl) lbl.innerHTML = `<span class="txt-jp">${TOUR[fi].city} → ${v.city} (📍タップで現在地から)</span><span class="txt-en" style="display:${lang==='en'?'':'none'}">${TOUR[fi].city} → ${v.city} (tap 📍 for your location)</span>`;
    }
  } catch(e) { console.error('[SelectStop] Error:', e); }
}

// ════════════════════════════════════════════════
// MAP — ルート設定・アニメーションループ
// 描画は MapRenderer に完全委譲
// ════════════════════════════════════════════════
function setRoute(from, to) {
  try {
    routeFrom = from; routeTo = to;
    const d = Math.round(hav(from.lat, from.lng, to.lat, to.lng));
    const b = Math.round(brng(from.lat, from.lng, to.lat, to.lng));
    setText('routeLabel', `${from.city.toUpperCase()} → ${to.city.toUpperCase()}`);
    setText('mapDistVal', d.toLocaleString() + ' km');
    setText('cDist', d.toLocaleString() + ' km');
    setText('cDeg', b + '°'); setText('cDir', blbl(b));
    rotateNeedle(b - devHeading);
  } catch(e) { console.warn('[Map] setRoute failed:', e); }
}

let lastMap = 0;
function loopMap(ts) {
  try {
    if (!mapRenderer) { requestAnimationFrame(loopMap); return; }
    if (ts - lastMap > 100) {
      planeT += 0.005 * planeDir;
      if (planeT >= 1) { planeT = 1; planeDir = -1; }
      if (planeT <= 0) { planeT = 0; planeDir  =  1; }
      lastMap = ts;
      TOUR.forEach(v => { v._sent = isSent(v); });
      mapRenderer.renderDynamicLayer({ TOUR, routeFrom, routeTo, targetStop, activeMember, planeT, getPower });
    }
    requestAnimationFrame(loopMap);
  } catch(e) { console.warn('[Map] Loop error:', e); }
}

// ════════════════════════════════════════════════
// GEOLOCATION → COMPASS
// ════════════════════════════════════════════════
const GEO_KEY = 'bts_lr_geo';
try { const g = JSON.parse(localStorage.getItem(GEO_KEY)||'null'); if (g) { userLat = g.lat; userLng = g.lng; geoGranted = true; } } catch(e) {}

function updateCompassFromUser() {
  try {
    if (!userLat || !geoGranted) return;
    const v = targetStop;
    const d = Math.round(hav(userLat, userLng, v.lat, v.lng));
    const b = Math.round(brng(userLat, userLng, v.lat, v.lng));
    setText('cDeg', b+'°'); setText('cDir', blbl(b)); setText('cDist', d.toLocaleString()+' km');
    rotateNeedle(b - devHeading);
    const lbl = getEl('compassFromLabel');
    if (lbl) { lbl.innerHTML = `<span class="txt-jp">📍 あなた → ${v.city} (${v.venue})</span><span class="txt-en" style="display:${lang==='en'?'':'none'}">📍 You → ${v.city} (${v.venue})</span>`; lbl.style.color = 'var(--dim2)'; }
    setRoute({lat:userLat, lng:userLng, city:'You', country:''}, v);
  } catch(e) { console.warn('[Geo] updateCompassFromUser failed:', e); }
}

function requestGeo() {
  try {
    const btn = getEl('geoBtn'), lbl = getEl('compassFromLabel');
    if (!navigator.geolocation) { if (lbl) lbl.innerHTML = `<span class="txt-jp">位置情報非対応</span><span class="txt-en" style="display:${lang==='en'?'':'none'}">Not supported</span>`; return; }
    if (btn) { btn.disabled = true; btn.style.opacity = '0.6'; btn.innerHTML = lang==='jp' ? '<span>📍 取得中…</span>' : '<span>📍 Locating…</span>'; }
    if (lbl) lbl.innerHTML = `<span class="txt-jp">位置情報を取得中…</span><span class="txt-en" style="display:${lang==='en'?'':'none'}">Locating…</span>`;
    if (location.protocol !== 'https:' && location.hostname !== 'localhost') {
      if (lbl) lbl.innerHTML = `<span class="txt-jp">HTTPS環境が必要です</span><span class="txt-en" style="display:${lang==='en'?'':'none'}">Requires HTTPS</span>`;
      if (btn) { btn.disabled = false; btn.style.opacity = '1'; } return;
    }
    navigator.geolocation.getCurrentPosition(
      pos => {
        userLat = pos.coords.latitude; userLng = pos.coords.longitude; geoGranted = true;
        try { localStorage.setItem(GEO_KEY, JSON.stringify({lat:userLat, lng:userLng})); } catch(_) {}
        updateCompassFromUser();
        if (btn) { btn.disabled = false; btn.style.opacity = '1'; btn.style.borderColor = 'var(--green)'; btn.style.color = 'var(--green)'; btn.innerHTML = lang==='jp' ? '<span>📍 現在地で測定</span>' : '<span>📍 MY LOCATION ✓</span>'; }
      },
      err => {
        geoGranted = false;
        const msg = err.code === 1 ? (lang==='jp' ? '位置情報の許可が必要です' : 'Location permission denied') : (lang==='jp' ? '位置情報を取得できません' : 'Could not get location');
        if (lbl) lbl.textContent = msg;
        if (btn) {
          btn.disabled = false; btn.style.opacity = '1'; btn.style.borderColor = 'var(--red)'; btn.style.color = 'var(--red)';
          btn.innerHTML = '<span class="txt-jp">📍 現在地で測定</span><span class="txt-en">📍 USE MY LOCATION</span>';
          setTimeout(() => { if (btn) { btn.style.borderColor = ''; btn.style.color = ''; btn.innerHTML = '<span class="txt-jp">📍 現在地で測定</span><span class="txt-en">📍 USE MY LOCATION</span>'; } }, 2000);
        }
        setRoute(routeFrom, targetStop);
      },
      {timeout:10000, maximumAge:300000, enableHighAccuracy:false}
    );
  } catch(e) { console.warn('[Geo] requestGeo failed:', e); const btn = getEl('geoBtn'); if (btn) { btn.disabled = false; btn.style.opacity = '1'; } }
}

function initCompass() {
  try {
    const ticks = getEl('cTicks');
    if (ticks) {
      const toR = d => d * Math.PI / 180;
      for (let i = 0; i < 72; i++) {
        const a = i*5, maj = i%9===0, mid = i%3===0, r1 = maj?36:mid?38:40, r2 = 44, rad = toR(a-90);
        const line = document.createElementNS('http://www.w3.org/2000/svg','line');
        line.setAttribute('x1', 50+r1*Math.cos(rad)); line.setAttribute('y1', 50+r1*Math.sin(rad));
        line.setAttribute('x2', 50+r2*Math.cos(rad)); line.setAttribute('y2', 50+r2*Math.sin(rad));
        line.setAttribute('stroke', maj?'rgba(91,63,217,.5)':mid?'rgba(91,63,217,.2)':'rgba(91,63,217,.08)');
        line.setAttribute('stroke-width', maj?1.5:.8); ticks.appendChild(line);
      }
    }
    const geoBtn = getEl('geoBtn'); if (geoBtn) geoBtn.addEventListener('click', requestGeo);
    if (geoGranted && userLat) {
      updateCompassFromUser();
      if (geoBtn) { geoBtn.style.borderColor = 'var(--green)'; geoBtn.style.color = 'var(--green)'; }
    } else {
      const b = Math.round(brng(TOUR[0].lat, TOUR[0].lng, TOUR[1].lat, TOUR[1].lng));
      rotateNeedle(b); setText('cDeg', b+'°'); setText('cDir', blbl(b));
      setText('cDist', Math.round(hav(TOUR[0].lat, TOUR[0].lng, TOUR[1].lat, TOUR[1].lng)).toLocaleString()+' km');
      const lbl = getEl('compassFromLabel');
      if (lbl) lbl.innerHTML = `<span class="txt-jp">${TOUR[0].city} → ${TOUR[1].city} (📍タップで現在地から)</span><span class="txt-en" style="display:${lang==='en'?'':'none'}">${TOUR[0].city} → ${TOUR[1].city} (tap 📍 for your location)</span>`;
    }
    if ('DeviceOrientationEvent' in window) {
      window.addEventListener('deviceorientationabsolute', onOrient, true);
      window.addEventListener('deviceorientation', onOrient, true);
    }
  } catch(e) { console.warn('[Compass] Init failed:', e); }
}

function onOrient(e) {
  try {
    const h = e.webkitCompassHeading ?? (e.absolute ? -e.alpha : null);
    if (h !== null) { devHeading = h; rotateNeedle(brng(routeFrom.lat, routeFrom.lng, routeTo.lat, routeTo.lng) - devHeading); }
  } catch(err) { console.warn('[Compass] Orientation error:', err); }
}

function rotateNeedle(a) {
  try {
    const needle = getEl('needle'); if (!needle) return;
    needle.style.transition = 'transform .7s cubic-bezier(.4,0,.2,1)';
    needle.setAttribute('transform', `rotate(${a},50,50)`);
  } catch(e) { console.warn('[Compass] rotateNeedle failed:', e); }
}

// ════════════════════════════════════════════════
// ENERGY RING
// ════════════════════════════════════════════════
let ec;
function initEnergyCanvas() { try { const ecEl = getEl('energyCanvas'); ec = ecEl ? ecEl.getContext('2d') : null; } catch(e) {} }
function drawEnergy() {
  try {
    if (!ec) return;
    const cx=46, cy=46, r=33, W=92, H=92;
    ec.clearRect(0,0,W,H);
    ec.fillStyle = 'rgba(237,233,255,.9)'; ec.beginPath(); ec.arc(cx,cy,r+9,0,Math.PI*2); ec.fill();
    ec.beginPath(); ec.arc(cx,cy,r,0,Math.PI*2); ec.strokeStyle = 'rgba(91,63,217,.18)'; ec.lineWidth = 7; ec.stroke();
    const p = Math.min(energyCount/120000, 1), s = -Math.PI/2;
    ec.beginPath(); ec.arc(cx,cy,r,s,s+p*Math.PI*2);
    ec.shadowBlur=10; ec.shadowColor=activeMember.color; ec.strokeStyle=activeMember.color; ec.lineWidth=7; ec.lineCap='round'; ec.stroke(); ec.shadowBlur=0;
    const ex=cx+r*Math.cos(s+p*Math.PI*2), ey=cy+r*Math.sin(s+p*Math.PI*2);
    ec.beginPath(); ec.arc(ex,ey,4,0,Math.PI*2); ec.fillStyle=activeMember.color; ec.shadowBlur=8; ec.shadowColor=activeMember.color; ec.fill(); ec.shadowBlur=0;
  } catch(e) { console.warn('[Energy] Draw failed:', e); }
}

// ════════════════════════════════════════════════
// MEMBER SELECTOR
// ════════════════════════════════════════════════
function initMemberSel() {
  try {
    const wrap = getEl('memberBtns'); if (!wrap) return;
    safeClearElement(wrap);
    MEMBERS.forEach(m => {
      const btn = document.createElement('button');
      btn.className = 'mbtn' + (m.id === activeMember.id ? ' sel' : '');
      btn.style.setProperty('--mc', m.color); btn.style.setProperty('--mr', m.rgb);
      btn.innerHTML = `<div class="mbtn-dot"></div><div class="mbtn-name" data-name-jp="${m.jp||m.name}" data-name-en="${m.name}">${lang==='en'?m.name:(m.jp||m.name)}</div>`;
      btn.addEventListener('click', () => {
        if (isSent(targetStop)) return;
        activeMember = m;
        document.querySelectorAll('.mbtn').forEach(b => { if (b) b.classList.remove('sel'); });
        btn.classList.add('sel'); applyTheme(m); evaluateSendState();
      });
      wrap.appendChild(btn);
    });
  } catch(e) { console.error('[MemberSel] Init failed:', e); }
}

function applyTheme(m) {
  try {
    document.documentElement.style.setProperty('--active', m.color);
    document.documentElement.style.setProperty('--active-rgb', m.rgb);
    const cDeg = getEl('cDeg'), showtimeCnt = getEl('showtimeCnt'), sbPower = getEl('sbPower');
    if (cDeg) cDeg.style.color = m.color;
    if (showtimeCnt) showtimeCnt.style.color = m.color;
    if (sbPower) sbPower.style.color = m.color;
    drawEnergy(); updateSendStyle();
  } catch(e) { console.warn('[Theme] Apply failed:', e); }
}

// ════════════════════════════════════════════════
// DAILY GRID
// ════════════════════════════════════════════════
function initDailyGrid() {
  try {
    const grid = getEl('dailyMembersGrid'); if (!grid) return;
    safeClearElement(grid);
    const todaySelected = dailyData.members[0] || null;
    MEMBERS.forEach(m => {
      const btn = document.createElement('button');
      btn.id = 'dmb_' + m.id; btn.style.setProperty('--mc', m.color); btn.style.setProperty('--mr', m.rgb);
      const isSelected = m.id === todaySelected, isLocked = todaySelected !== null && !isSelected;
      btn.className = 'dmb' + (isSelected ? ' checked' : '') + (isLocked ? ' dmb-locked' : '');
      btn.innerHTML = `<div class="dmb-dot"></div><div class="dmb-name" data-name-jp="${m.jp||m.name}" data-name-en="${m.name}">${lang==='en'?m.name:(m.jp||m.name)}</div>`;
      btn.addEventListener('click', () => {
        const result = checkInMember(m.id);
        if (result.action === 'locked') {
          btn.animate([{transform:'translateX(-3px)'},{transform:'translateX(3px)'},{transform:'translateX(-2px)'},{transform:'translateX(2px)'},{transform:'translateX(0)'}], {duration:250, easing:'ease-out'});
          return;
        }
        refreshDailyUI(); refreshStatusBar();
      });
      grid.appendChild(btn);
    });
    refreshDailyUI();
  } catch(e) { console.error('[DailyGrid] Init failed:', e); }
}

function refreshDailyUI() {
  try {
    resetDailyIfNeeded();
    const todaySelected = dailyData.members[0] || null;
    const selectedMember = todaySelected ? MEMBERS.find(m => m.id === todaySelected) : null;
    MEMBERS.forEach(m => {
      const btn = getEl('dmb_' + m.id); if (!btn) return;
      const isSelected = m.id === todaySelected, isLocked = todaySelected !== null && !isSelected;
      btn.classList.toggle('checked', isSelected); btn.classList.toggle('dmb-locked', isLocked);
      btn.style.opacity = isLocked ? '0.35' : '1'; btn.style.cursor = todaySelected !== null ? 'not-allowed' : 'pointer';
    });
    const countEl = getEl('dailyCount');
    if (countEl) {
      if (todaySelected && selectedMember) { countEl.textContent = lang==='jp' ? `${selectedMember.jp||selectedMember.name} ✓` : `${selectedMember.name} ✓`; countEl.style.color = selectedMember.color; }
      else { countEl.innerHTML = lang==='jp' ? '<span class="txt-jp">未選択</span>' : '<span class="txt-en">NOT YET</span>'; countEl.style.color = 'var(--dim)'; }
    }
    const rfill = getEl('rainbowFill');
    if (rfill) {
      if (todaySelected && selectedMember) { rfill.style.width = '100%'; rfill.style.setProperty('--fill-color', selectedMember.color); rfill.style.background = selectedMember.color; }
      else { rfill.style.width = '0%'; rfill.style.background = ''; }
    }
    const rcEl = getEl('rainbowCountEl'); if (rcEl) rcEl.textContent = dailyData.rainbowCount || 0;
    const rc = dailyData.rainbowCount || 0, rtEl = getEl('rainbowTitle');
    if (rtEl) {
      if (rc >= 7)      rtEl.textContent = lang==='jp' ? '🌈✨ 虹の伝説' : '🌈✨ RAINBOW LEGEND';
      else if (rc >= 3) rtEl.textContent = lang==='jp' ? '🌈🌈 虹の戦士' : '🌈🌈 RAINBOW WARRIOR';
      else if (rc >= 1) rtEl.textContent = lang==='jp' ? '🌈 虹の夢'     : '🌈 RAINBOW DREAMER';
      else              rtEl.textContent = '';
    }
    // ── デイリーシェアボタン表示制御 ──
    refreshDailyShareButton();
  } catch(e) { console.warn('[DailyUI] Refresh failed:', e); }
}

// ── デイリーシェアボタン表示制御 ────────────────────────────
function refreshDailyShareButton() {
  const container = getEl('dailyShareContainer'); if (!container) return;
  const todaySelected = dailyData.members[0] || null;
  if (todaySelected) {
    container.classList.add('visible');
    const btn = getEl('dailyShareBtn');
    if (btn) {
      const m = MEMBERS.find(x => x.id === todaySelected); if (!m) return;
      btn.style.setProperty('--mc', m.color);
      btn.textContent = lang==='jp' ? `✦ ${m.jp||m.name}の光をシェア` : `✦ Share ${m.name}'s Light`;
    }
  } else {
    container.classList.remove('visible');
  }
}

// ════════════════════════════════════════════════
// AUDIO EFFECTS
// ════════════════════════════════════════════════
let _audioCtx = null;
function getAudioCtx() { if (!_audioCtx) _audioCtx = new (window.AudioContext || window.webkitAudioContext)(); return _audioCtx; }

function playCrowdCheer(duration=4.0, volume=0.18) {
  try {
    const ctx = getAudioCtx(), bufLen = ctx.sampleRate * duration, buf = ctx.createBuffer(2, bufLen, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) { const d = buf.getChannelData(ch); for (let i = 0; i < bufLen; i++) d[i] = Math.random()*2-1; }
    const noise = ctx.createBufferSource(); noise.buffer = buf;
    const bp = ctx.createBiquadFilter(); bp.type='bandpass'; bp.frequency.value=1200; bp.Q.value=0.8;
    const lp = ctx.createBiquadFilter(); lp.type='lowpass'; lp.frequency.setValueAtTime(3000,ctx.currentTime); lp.frequency.linearRampToValueAtTime(1800,ctx.currentTime+duration*0.7);
    const gain = ctx.createGain(); gain.gain.setValueAtTime(0,ctx.currentTime); gain.gain.linearRampToValueAtTime(volume,ctx.currentTime+0.5); gain.gain.setValueAtTime(volume,ctx.currentTime+duration*0.6); gain.gain.exponentialRampToValueAtTime(0.001,ctx.currentTime+duration);
    const lfo = ctx.createOscillator(); lfo.frequency.value=0.8; const lfoGain = ctx.createGain(); lfoGain.gain.value=0.3;
    lfo.connect(lfoGain); lfoGain.connect(gain.gain); lfo.start(); lfo.stop(ctx.currentTime+duration);
    noise.connect(bp); bp.connect(lp); lp.connect(gain); gain.connect(ctx.destination); noise.start(); noise.stop(ctx.currentTime+duration);
  } catch(e) { console.warn('[Audio] Crowd cheer failed:', e.message); }
}

function playSendWhoosh() {
  try {
    const ctx = getAudioCtx(), dur = 0.9, bufLen = ctx.sampleRate*dur, buf = ctx.createBuffer(1,bufLen,ctx.sampleRate);
    const d = buf.getChannelData(0); for (let i = 0; i < bufLen; i++) d[i] = Math.random()*2-1;
    const noise = ctx.createBufferSource(); noise.buffer = buf;
    const hp = ctx.createBiquadFilter(); hp.type='highpass'; hp.frequency.setValueAtTime(4000,ctx.currentTime); hp.frequency.exponentialRampToValueAtTime(8000,ctx.currentTime+dur*0.6);
    const gain = ctx.createGain(); gain.gain.setValueAtTime(0.22,ctx.currentTime); gain.gain.exponentialRampToValueAtTime(0.001,ctx.currentTime+dur);
    noise.connect(hp); hp.connect(gain); gain.connect(ctx.destination); noise.start(); noise.stop(ctx.currentTime+dur);
  } catch(e) {}
}

// ════════════════════════════════════════════════
// CHARGE / SEND EFFECTS
// ════════════════════════════════════════════════
function showChargeEffect(member) {
  try {
    const ov = getEl('chargeOverlay'), canvas = getEl('chargeCanvas'); if (!ov) return;
    ov.style.setProperty('--charge-color', member.color); ov.style.setProperty('--charge-bg', `rgba(${member.rgb},.08)`);
    const chargeEmoji = getEl('chargeEmoji'); if (chargeEmoji) { chargeEmoji.style.color = member.color; chargeEmoji.style.textShadow = `0 0 30px ${member.color}`; }
    const chargeMember = getEl('chargeMember'); if (chargeMember) { chargeMember.textContent = lang==='jp' ? (member.jp||member.name) : member.name; chargeMember.style.color = member.color; }
    const chargeMsgJP = getEl('chargeMsgJP'), chargeMsgEN = getEl('chargeMsgEN');
    if (chargeMsgJP) chargeMsgJP.textContent = `${member.jp||member.name}の光をチャージしました`;
    if (chargeMsgEN) chargeMsgEN.textContent = `${member.name} LIGHT CHARGED`;
    ov.classList.add('on'); _drawChargeParticles(canvas, member.color);
    setTimeout(() => ov.classList.remove('on'), 3000);
  } catch(e) { console.warn('[ChargeEffect] Failed:', e); }
}

function _drawChargeParticles(canvas, color) {
  try {
    if (!canvas) return;
    const W = window.innerWidth, H = window.innerHeight; canvas.width = W; canvas.height = H;
    const ctx = canvas.getContext('2d'), cx = W/2, cy = H/2;
    const particles = Array.from({length:40}, (_,i) => { const angle=(i/40)*Math.PI*2, speed=2+Math.random()*3; return {x:cx, y:cy, vx:Math.cos(angle)*speed, vy:Math.sin(angle)*speed, life:1, decay:0.018+Math.random()*0.012, size:3+Math.random()*5}; });
    let raf;
    function draw() {
      ctx.clearRect(0,0,W,H); let alive = false;
      particles.forEach(p => {
        if (p.life <= 0) return; p.x+=p.vx; p.y+=p.vy; p.vy+=0.04; p.life-=p.decay;
        ctx.globalAlpha=Math.max(0,p.life); ctx.fillStyle=color; ctx.shadowBlur=12; ctx.shadowColor=color;
        ctx.beginPath(); ctx.arc(p.x,p.y,p.size*p.life,0,Math.PI*2); ctx.fill(); if (p.life>0) alive=true;
      });
      ctx.globalAlpha=1; ctx.shadowBlur=0; if (alive) raf=requestAnimationFrame(draw);
    }
    draw(); setTimeout(() => { cancelAnimationFrame(raf); ctx.clearRect(0,0,W,H); }, 3000);
  } catch(e) { console.warn('[ChargeParticles] Failed:', e); }
}

function showSendEffect(member, venueName, dist) {
  try {
    const ov = getEl('sendOverlay'), canvas = getEl('sendCanvas'); if (!ov) return;
    const W = window.innerWidth, H = window.innerHeight; if (canvas) { canvas.width=W; canvas.height=H; }
    ov.style.setProperty('--send-color', member.color);
    const rgb = member.rgb.split(',').map(x => parseInt(x));
    ov.style.setProperty('--send-bg', `rgba(${Math.max(0,rgb[0]-180)},${Math.max(0,rgb[1]-180)},${Math.max(0,rgb[2]-60)},.97)`);
    const sendOrb = getEl('sendOrb'); if (sendOrb) sendOrb.style.filter = `drop-shadow(0 0 40px ${member.color})`;
    playSendWhoosh(); _drawSendParticles(canvas, member.color); ov.classList.add('on');
  } catch(e) { console.warn('[SendEffect] Failed:', e); }
}

function _drawSendParticles(canvas, color) {
  try {
    if (!canvas) return;
    const W=canvas.width, H=canvas.height, ctx=canvas.getContext('2d'), cx=W/2, cy=H*0.42;
    const streaks = Array.from({length:60},(_,i) => { const angle=(i/60)*Math.PI*2; return {angle,len:0,maxLen:60+Math.random()*120,speed:3+Math.random()*4,life:1,delay:Math.random()*15}; });
    const sparks  = Array.from({length:80},(_,i) => { const a=(i/80)*Math.PI*2,spd=1+Math.random()*5; return {x:cx,y:cy,vx:Math.cos(a)*spd,vy:Math.sin(a)*spd-2,life:1,decay:.014+Math.random()*.01,size:2+Math.random()*4}; });
    let frame=0, raf;
    function draw() {
      try {
        ctx.clearRect(0,0,W,H); frame++;
        const glowR=Math.min(200,frame*3), grd=ctx.createRadialGradient(cx,cy,0,cx,cy,glowR);
        grd.addColorStop(0,color+'88'); grd.addColorStop(1,'transparent'); ctx.fillStyle=grd; ctx.fillRect(0,0,W,H);
        streaks.forEach(s => {
          if (frame<s.delay) return; s.len=Math.min(s.maxLen,s.len+s.speed); s.life=Math.max(0,1-(frame-s.delay)/80); if (s.life<=0) return;
          ctx.globalAlpha=s.life*.7; ctx.strokeStyle=color; ctx.lineWidth=1.5; ctx.shadowBlur=8; ctx.shadowColor=color;
          ctx.beginPath(); ctx.moveTo(cx+Math.cos(s.angle)*20,cy+Math.sin(s.angle)*20); ctx.lineTo(cx+Math.cos(s.angle)*s.len,cy+Math.sin(s.angle)*s.len); ctx.stroke();
        });
        sparks.forEach(p => {
          if (p.life<=0) return; p.x+=p.vx; p.y+=p.vy; p.vy+=0.06; p.life-=p.decay;
          ctx.globalAlpha=Math.max(0,p.life*.9); ctx.fillStyle=color; ctx.shadowBlur=10; ctx.shadowColor=color;
          ctx.beginPath(); ctx.arc(p.x,p.y,p.size*p.life,0,Math.PI*2); ctx.fill();
        });
        ctx.globalAlpha=1; ctx.shadowBlur=0;
        if (frame<120) raf=requestAnimationFrame(draw); else ctx.clearRect(0,0,W,H);
      } catch(e) { console.warn('[SendParticles] Frame error:', e); }
    }
    draw();
  } catch(e) { console.warn('[SendParticles] Failed:', e); }
}

// ════════════════════════════════════════════════
// COUNTDOWN OVERLAY
// ════════════════════════════════════════════════
let countdownTimer = null;
let countdownShownKey = new Set();
try { JSON.parse(localStorage.getItem('fhts_cdshown')||'[]').forEach(k => countdownShownKey.add(k)); } catch(e) {}

function openCountdownOverlay(stop, isDemo=false) {
  try {
    const ov = getEl('countdownOverlay'), canvas = getEl('countdownBg'); if (!ov) return;
    const sm = sentMem(stop), col = sm ? sm.color : activeMember.color;
    ov.style.setProperty('--cd-color', col);
    const venueLine = stop.venue && stop.venue !== 'TBA' ? `${stop.city} · ${stop.venue}` : stop.city;
    const cdVenue = getEl('cdVenue'), cdVenueEN = getEl('cdVenueEN');
    if (cdVenue) cdVenue.textContent = venueLine; if (cdVenueEN) cdVenueEN.textContent = venueLine;
    const row = getEl('cdPulseRow');
    if (row) { safeClearElement(row); for (let i=0;i<3;i++) { const d=document.createElement('div'); d.className='cd-dot'; d.style.background=col; row.appendChild(d); } }
    ov.classList.add('on'); _drawCountdownBg(canvas, col); playCrowdCheer(5.0, 0.18);
    clearInterval(countdownTimer);
    function updateTimer() {
      const rem = new Date(stop.st) - new Date(), cdTimer = getEl('cdTimer');
      if (rem <= 0) { if (cdTimer) cdTimer.textContent='00:00:00'; clearInterval(countdownTimer); if (!isDemo) setTimeout(() => ov.classList.remove('on'), 3000); return; }
      const h=Math.floor(rem/3600000), m=Math.floor((rem%3600000)/60000), s=Math.floor((rem%60000)/1000);
      if (cdTimer) cdTimer.textContent = `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
    }
    updateTimer(); countdownTimer = setInterval(updateTimer, 1000);
    const closeBtn = getEl('cdClose');
    if (closeBtn) {
      const closeHandler = () => { ov.classList.remove('on'); clearInterval(countdownTimer); closeBtn.removeEventListener('click', closeHandler); };
      closeBtn.addEventListener('click', closeHandler);
    }
  } catch(e) { console.error('[Countdown] Open failed:', e); }
}

function _drawCountdownBg(canvas, col) {
  try {
    if (!canvas) return;
    const W=window.innerWidth, H=window.innerHeight; canvas.width=W; canvas.height=H;
    const ctx=canvas.getContext('2d');
    const r=parseInt(col.slice(1,3)||'5b',16), g=parseInt(col.slice(3,5)||'3f',16), b=parseInt(col.slice(5,7)||'d9',16);
    const grd=ctx.createRadialGradient(W/2,H/2,0,W/2,H/2,Math.max(W,H)*0.8);
    grd.addColorStop(0,`rgba(${r},${g},${b},.5)`); grd.addColorStop(0.5,`rgba(${Math.max(0,r-40)},${Math.max(0,g-40)},${Math.max(0,b-40)},.85)`); grd.addColorStop(1,'rgba(9,12,19,.98)');
    ctx.fillStyle=grd; ctx.fillRect(0,0,W,H);
    ctx.fillStyle='rgba(255,255,255,.6)';
    for (let i=0;i<80;i++) { const x=Math.random()*W, y=Math.random()*H, rr=Math.random()*1.5; ctx.beginPath(); ctx.arc(x,y,rr,0,Math.PI*2); ctx.fill(); }
    for (let i=1;i<=4;i++) { ctx.strokeStyle=`rgba(255,255,255,${0.04/i})`; ctx.lineWidth=1; ctx.beginPath(); ctx.arc(W/2,H/2,i*80,0,Math.PI*2); ctx.stroke(); }
  } catch(e) { console.warn('[CountdownBg] Draw failed:', e); }
}

function closeArrival() { try { const ov=getEl('showtimeOverlay'); if(ov) ov.classList.remove('on'); } catch(e) {} }

// ════════════════════════════════════════════════
// TITLE ZONE
// ════════════════════════════════════════════════
function renderTitleZone() {
  try {
    const {tier, stars, oshi, rainbow} = computeTitles();
    const _pm = parseInt(localStorage.getItem('fhts_tier_min')||'0', 10);
    if (tier.min > _pm) {
      GA.trackTitleEarned(tier.en, stars);
      localStorage.setItem('fhts_tier_min', String(tier.min));
    }
    const _rc2 = dailyData.rainbowCount || 0, _pr = parseInt(localStorage.getItem('fhts_prev_rc')||'0', 10);
    if (_rc2 > _pr && [1,3,7].includes(_rc2)) {
      GA.trackRainbow(_rc2, powerData.streak);
      localStorage.setItem('fhts_prev_rc', String(_rc2));
    }
    const iconEl=getEl('titleIcon'), nameEl=getEl('titleName'), progEl=getEl('titleProgress'), fillEl=getEl('titleProgFill');
    const oshiEl=getEl('subTitleOshi'), rbEl=getEl('subTitleRainbow'), mbox=getEl('milestoneBox'), mtxt=getEl('milestoneTxt');
    if (iconEl) iconEl.textContent = tier.icon;
    if (nameEl) {
      nameEl.innerHTML = `<span class="txt-jp">${tier.jp}</span><span class="txt-en" style="display:none">${tier.en}</span>`;
      if (document.body.classList.contains('lang-en')) { const jp=nameEl.querySelector('.txt-jp'), en=nameEl.querySelector('.txt-en'); if(jp)jp.style.display='none'; if(en)en.style.display=''; }
    }
    if (iconEl) iconEl.textContent = tier.icon;
    if (nameEl) nameEl.textContent = lang==='jp' ? tier.jp : tier.en;
    if (tier.next) {
      const prev = TITLE_TIERS.find(t => t.next === tier.next)?.min ?? 0;
      const pct = Math.min((stars-prev) / (tier.next-prev) * 100, 100);
      if (fillEl) fillEl.style.width = pct + '%';
      if (progEl) progEl.textContent = lang==='jp' ? `次の称号まで ${tier.next-stars}公演` : `${tier.next-stars} shows to next title`;
    } else {
      if (fillEl) fillEl.style.width = '100%';
      if (progEl) progEl.textContent = lang==='jp' ? '最高称号達成！' : 'Maximum title achieved!';
    }
    if (oshiEl) { if (oshi) { oshiEl.textContent=lang==='jp'?oshi.jp:oshi.en; oshiEl.style.color=oshi.color; } else { oshiEl.textContent='—'; oshiEl.style.color=''; } }
    if (rbEl)   { if (rainbow) rbEl.textContent=lang==='jp'?rainbow.jp:rainbow.en; else rbEl.textContent='—'; }
    const sbStars=getEl('sbStars'), sbTitle=getEl('sbTitle');
    if (sbStars) sbStars.textContent = stars;
    if (sbTitle) sbTitle.textContent = (lang==='jp'?tier.jp:tier.en).replace(/[🌱⭐💫✨🌟—]/g,'').trim() || tier.icon;
    if (mtxt) {
      if (tier.next) { mtxt.innerHTML = lang==='jp' ? `<b>${tier.next-stars}公演</b>で「${TITLE_TIERS.find(t=>t.min===tier.next)?.[lang==='jp'?'jp':'en']||''}」に到達` : `<b>${tier.next-stars} more shows</b> to reach <b>${TITLE_TIERS.find(t=>t.min===tier.next)?.en||''}</b>`; }
      else { if (mbox) mbox.style.display='none'; }
    }
  } catch(e) { console.warn('[TitleZone] Render failed:', e); }
}

// ════════════════════════════════════════════════
// STATUS BAR
// ════════════════════════════════════════════════
function refreshStatusBar() {
  try {
    const pwr = Math.round(getPower());
    document.documentElement.style.setProperty('--power', pwr);
    const powerFill = getEl('powerFill'); if (powerFill) powerFill.style.width = pwr+'%';
    const powerValText = getEl('powerValText'); if (powerValText) powerValText.textContent = pwr+' / 100';
    setText('streakNum', powerData.streak);
    const nxt = findNextTarget(), ncEl = getEl('sbNextCity'), ctEl = getEl('sbCountdown');
    if (ncEl && nxt) ncEl.textContent = nxt.city + (nxt.country ? ', '+nxt.country : '');
    if (ctEl && nxt && nxt.st) {
      const nsIdx = getNextShowIndex(nxt);
      const nextShow = nxt.showDates && nsIdx >= 0 ? nxt.showDates[nsIdx] : new Date(nxt.st);
      const diff = nextShow - new Date();
      ctEl.textContent = diff > 0 ? fmt(diff) : (lang==='jp' ? '開演中' : 'LIVE NOW');
    } else if (ctEl) { ctEl.textContent = '—'; }
    const starsEl = getEl('sbStars'); if (starsEl) starsEl.textContent = Object.keys(sentShows||{}).length;
    renderTitleZone();
  } catch(e) { console.warn('[StatusBar] Refresh failed:', e); }
}

// ════════════════════════════════════════════════
// SEND STATE MACHINE
// ════════════════════════════════════════════════
function _getNextDiff() {
  const nsIdx = getNextShowIndex(targetStop);
  return targetStop.showDates && nsIdx >= 0 ? targetStop.showDates[nsIdx]-new Date() : (targetStop.st ? new Date(targetStop.st)-new Date() : null);
}

function evaluateSendState() {
  try {
    const btn = getEl('sendBtn'); if (!btn) return;
    if (isSent(targetStop)) { applySentState(); return; }
    if (targetStop.isTBA || !targetStop.st) { applyTBAState(); return; }
    const diff = _getNextDiff();
    if (diff !== null && diff < -7200000) { applyExpiredState(); return; }
    if ((diff !== null && diff <= WINDOW_MS) || demoMode) { activateSendReady(); return; }
    applyLockedState();
  } catch(e) { console.warn('[SendState] Evaluation failed:', e); }
}

function applyLockedState()  { sendReady=false; const b=getEl('sendBtn'); if(b)b.className='locked';   refreshStep(1); updateSendBtnText(); }
function applyTBAState()     { sendReady=false; const b=getEl('sendBtn'); if(b)b.className='tba-lock'; refreshStep(1); updateSendBtnText(); }
function applyExpiredState() { sendReady=false; const b=getEl('sendBtn'); if(b)b.className='locked';   refreshStep(1); updateSendBtnText(); }
function applySentState()    { sendReady=false; const b=getEl('sendBtn'); if(b)b.className='sent';     refreshStep(3); updateSendBtnText(); }
function activateSendReady() {
  if (isSent(targetStop)) return;
  sendReady=true; const b=getEl('sendBtn'); if(b)b.className='ready';
  refreshStep(2); updateSendStyle(); updateSendBtnText();
}

function refreshStep(forceStep) {
  try {
    const statusEl = getEl('sendStatus'); if (!statusEl) return;
    const step = forceStep || (sendReady ? 2 : isSent(targetStop) ? 3 : 1);
    const diff2 = _getNextDiff();
    if (step === 3) { statusEl.textContent = lang==='jp' ? '✦ 光を送信済み · 開演時刻に点灯します' : '✦ Light sent · Will glow at showtime'; statusEl.style.color='var(--green)'; }
    else if (step === 2) { const m=diff2!=null?Math.max(0,Math.floor(diff2/60000)):0; statusEl.textContent = lang==='jp' ? `✦ 送信可能 · 開演まで${m}分` : `✦ WINDOW OPEN · ${m}min to showtime`; statusEl.style.color='var(--purple)'; }
    else {
      if (targetStop.isTBA) { statusEl.textContent = lang==='jp' ? '会場・開演時間 発表待ち' : 'VENUE & TIME TBA'; statusEl.style.color='var(--dim)'; }
      else if (diff2!=null && diff2<0) { statusEl.textContent = lang==='jp' ? 'この公演は終了しました' : 'This show has ended'; statusEl.style.color='var(--dim)'; }
      else { const h=diff2!=null?Math.ceil(diff2/3600000):null; statusEl.textContent = lang==='jp' ? (h!=null&&h<=24?`開演${h}時間前 · あと${h-1}時間で送信可`:'開演1時間前に送信可能') : (h!=null&&h<=24?`${h}h to show · opens in ${h-1}h`:'Unlocks 1h before showtime'); statusEl.style.color='var(--dim)'; }
    }
  } catch(e) { console.warn('[SendState] refreshStep failed:', e); }
}

function updateSendBtnText() {
  try {
    const btn = getEl('sendBtn'); if (!btn) return;
    const cls = btn.className, diff2 = _getNextDiff(), expired = diff2!==null&&diff2<0&&!isSent(targetStop);
    if (cls==='ready')    { const m=diff2!=null?Math.max(0,Math.floor(diff2/60000)):0; const pwr=Math.round(getPower()); btn.textContent = lang==='jp' ? `✦ 光を送る · ${activeMember.jp}カラー · 残${m}分 · PWR${pwr}` : `✦ SHOOT LIGHT · ${activeMember.name} · ${m}min · PWR${pwr}`; }
    else if (cls==='sent')      { const sm=sentMem(targetStop)||activeMember; btn.textContent = lang==='jp' ? `✦ ${sm.jp||sm.name}カラーで送信済み · 次の公演でも送れます` : `✦ Sent as ${sm.name} · Available at next show`; }
    else if (cls==='tba-lock')  { btn.textContent = lang==='jp' ? '⏳ 会場・開演時間 発表待ち' : '⏳ VENUE & TIME TBA'; }
    else if (expired)           { btn.textContent = lang==='jp' ? '— この公演は終了しました' : '— This show has ended'; }
    else { const h=diff2!=null?Math.ceil(diff2/3600000):null; btn.textContent = lang==='jp' ? (h!=null&&h<=24?`🔒 あと${h-1}時間で送信ウィンドウが開きます`:'🔒 開演1時間前に送信可能') : (h!=null&&h<=24?`🔒 Window opens in ${h-1}h`:'🔒 UNLOCKS 1H BEFORE SHOWTIME'); }
  } catch(e) { console.warn('[SendBtn] Update text failed:', e); }
}

function updateSendStyle() {
  try {
    const btn = getEl('sendBtn'); if (!btn || btn.className !== 'ready') return;
    btn.style.background = `linear-gradient(135deg,${activeMember.color},${activeMember.color}77)`;
    btn.style.boxShadow  = `0 4px 28px ${activeMember.color}55`;
    btn.style.color = '#000'; updateSendBtnText();
  } catch(e) { console.warn('[SendStyle] Update failed:', e); }
}

// ════════════════════════════════════════════════
// SEND
// ════════════════════════════════════════════════
async function doSend() {
  try {
    if (!sendReady || isSent(targetStop)) return;
    const btn = getEl('sendBtn'); if (!btn) return;
    btn.textContent = lang==='jp' ? '⟳ 確認中…' : '⟳ CHECKING…'; btn.style.cursor='wait'; btn.disabled=true;
    const wKey = showKey(targetStop), sdsResult = await SDS.checkAndSend(wKey, activeMember.id);
    btn.style.cursor=''; btn.disabled=false;
    if (!sdsResult.ok) {
      markSent(targetStop, activeMember, getPower()); sendReady=false; applySentState();
      alert(lang==='jp' ? (sdsResult.reason==='invalid_signature'?'セキュリティエラー。ページを再読み込みしてください。':'この公演にはすでに光を送っています。\n次の公演でまた送れます。') : (sdsResult.reason==='invalid_signature'?'Security error. Please reload the page.':'You already sent your light for this show.\nSend again at the next show!'));
      return;
    }
    const pwr = getPower(); markSent(targetStop, activeMember, pwr); energyCount++;

    // GA4: 光を送る
    const _daysToShow = targetStop.st
      ? Math.round((new Date(targetStop.st) - new Date()) / 86400000)
      : 0;
    GA.trackSendLight(
      targetStop.venue,
      targetStop.city,
      activeMember.name,
      getPower(),
      _daysToShow
    );

    const fLa = geoGranted&&userLat ? userLat : routeFrom.lat, fLo = geoGranted&&userLng ? userLng : routeFrom.lng;
    const dist = Math.round(hav(fLa, fLo, targetStop.lat, targetStop.lng));
    const ocean = oceanName(fLa, fLo, targetStop.lat, targetStop.lng);
    const sendMsg=getEl('sendMsg'), journeyDesc=getEl('journeyDesc'), powerBonus=getEl('powerBonus');
    if (sendMsg)     sendMsg.textContent     = lang==='jp' ? `${activeMember.jp||activeMember.name}の光を送りました` : `${activeMember.name}'S LIGHT IS ON ITS WAY`;
    if (journeyDesc) journeyDesc.textContent = lang==='jp' ? `${ocean.jp}\n${dist.toLocaleString()} km 先の ${targetStop.city} へ` : `${ocean.en}\n${dist.toLocaleString()} km to ${targetStop.city}`;
    if (powerBonus)  powerBonus.textContent  = lang==='jp' ? `⚡ POWER ${Math.round(pwr)} · 光の強度 +${Math.round(pwr/100*100)}%` : `⚡ POWER ${Math.round(pwr)} · Intensity +${Math.round(pwr/100*100)}%`;
    showSendEffect(activeMember, targetStop.city, dist);
    setTimeout(() => {
      const sendOverlay = getEl('sendOverlay'); if (sendOverlay) sendOverlay.classList.remove('on');
      sendReady=false; applySentState();
      const sm=sentMem(targetStop), tSent=getEl('tSent'), tSentTxt=getEl('tSentTxt');
      if (sm&&tSent&&tSentTxt) { tSentTxt.innerHTML=`<span class="txt-jp">${sm.jp||sm.name}カラーで光を送信済み</span><span class="txt-en">Light sent as ${sm.name}</span>`; tSent.classList.add('on'); }
      refreshCardSent();
      const eCount = getEl('eCount'); if (eCount) eCount.textContent = energyCount.toLocaleString();
      drawEnergy(); renderTitleZone(); refreshStatusBar();
      if (geoGranted && userLat) updateCompassFromUser();
    }, 4000);
  } catch(e) { console.error('[Send] doSend failed:', e); const btn=getEl('sendBtn'); if(btn){btn.style.cursor='';btn.disabled=false;} }
}

// ════════════════════════════════════════════════
// SEND BUTTON INIT
// ════════════════════════════════════════════════
function initSendBtn() {
  const btn = getEl('sendBtn'); if (btn) btn.addEventListener('click', doSend);
  evaluateSendState();
  let tc=0, tt;
  const livePill = getEl('livePill');
  if (livePill) {
    livePill.addEventListener('click', () => {
      clearTimeout(tt); tc++;
      if (tc >= 3) { tc=0; demoMode=true; const dh=getEl('demoHint'); if(dh){dh.textContent=lang==='jp'?'✦ デモ ON':'✦ DEMO ON';dh.style.color='var(--gold)';} activateSendReady(); }
      tt = setTimeout(() => tc=0, 1000);
    });
  }
}

// ════════════════════════════════════════════════
// COUNTDOWN
// ════════════════════════════════════════════════
function fmt(ms) {
  if (ms === null) return lang==='jp' ? '発表待ち' : 'TBA';
  if (ms <= 0)     return lang==='jp' ? '開演中！' : 'SHOWTIME!';
  const d=Math.floor(ms/86400000), h=Math.floor((ms%86400000)/3600000), m=Math.floor((ms%3600000)/60000);
  if (lang==='jp') return d>0 ? `${d}日 ${h}時間 ${m}分` : h>0 ? `${h}時間 ${m}分` : `${m}分`;
  return d>0 ? `${d}d ${h}h` : h>0 ? `${h}h ${m}m` : `${m}m`;
}

function updateCountdown() {
  try {
    const nxt = findNextTarget(); if (!nxt || !nxt.st) { setText('mainCnt','—'); return; }
    const nsIdx = getNextShowIndex(nxt);
    const diff = nxt.showDates && nsIdx>=0 ? nxt.showDates[nsIdx]-new Date() : new Date(nxt.st)-new Date();
    setText('mainCnt', fmt(Math.max(diff, 0)));
    const jpLbl=document.getElementById('mainCntLblJP'), enLbl=document.getElementById('mainCntLblEN');
    if (jpLbl) jpLbl.textContent = nxt.city + 'まで';
    if (enLbl) enLbl.textContent = 'TO ' + nxt.city.toUpperCase();
  } catch(e) { console.warn('[Countdown] Update failed:', e); }
}

function updateShowtime() {
  try {
    const _nxt = findNextTarget();
    if (_nxt) {
      const ncEl=getEl('sbNextCity'), ctEl=getEl('sbCountdown');
      if (ncEl) ncEl.textContent = _nxt.city + (_nxt.country?', '+_nxt.country:'');
      if (ctEl && _nxt.st) {
        const _nsIdx=getNextShowIndex(_nxt);
        const _ns=_nxt.showDates&&_nsIdx>=0?_nxt.showDates[_nsIdx]:new Date(_nxt.st);
        const _diff=_ns-new Date();
        ctEl.textContent = _diff>0 ? fmt(_diff) : (lang==='jp'?'開演中':'LIVE NOW');
      } else if (ctEl) ctEl.textContent='—';
    }
    // LIVE維持ガード
    const isTargetLive = targetStop && targetStop.st && (() => {
      const dates = targetStop.showDates || [new Date(targetStop.st)];
      return dates.some(t => { const d=t-new Date(); return d<=0&&d>-7200000; });
    })();
    const _fresh = findNextTarget();
    if (_fresh && _fresh !== targetStop && !demoMode && !isTargetLive) {
      selectStop(_fresh, TOUR.indexOf(_fresh));
    }
    const showtimeCnt = getEl('showtimeCnt');
    if (!targetStop.st) { if (showtimeCnt) showtimeCnt.textContent=fmt(null); return; }
    const diff = _getNextDiff();
    if (showtimeCnt) showtimeCnt.textContent = fmt(diff);
    if (!isSent(targetStop) && !targetStop.isTBA) {
      if (diff > 0 && diff <= WINDOW_MS && !sendReady) activateSendReady();
      else if (diff <= 0 && sendReady) applyExpiredState();
    }
    checkShowtimeArrival();
  } catch(e) { console.warn('[Showtime] Update failed:', e); }
}

function checkShowtimeArrival() {
  try {
    const now = new Date();
    TOUR.forEach(v => {
      if (!isSent(v) || !v.st) return;
      const showTimes = v.showDates&&v.showDates.length>0 ? v.showDates : [new Date(v.st)];
      showTimes.forEach(showTime => {
        const dateStr = showTime.toISOString().slice(0,10), k = showKey(v)+'_'+dateStr;
        if (shownArrival.has(k)) return;
        const diff = now - showTime;
        if (diff >= 0 && diff <= 10*60*1000) {
          shownArrival.add(k); localStorage.setItem('bts_lr_arr', JSON.stringify([...shownArrival]));
          const sm=sentMem(v), el=getEl('showtimeVenue');
          if (el) { el.textContent=`${v.city} · ${v.venue}`; if(sm)el.style.color=sm.color; }
          const ov=getEl('showtimeOverlay'); if(ov)ov.classList.add('on');
        }
      });
    });
  } catch(e) { console.warn('[Showtime] Check arrival failed:', e); }
}

// ════════════════════════════════════════════════
// SHARE — デイリー推しシェア（航路シェア廃止）
// ════════════════════════════════════════════════

// ── Canvas生成（位置情報・航路変数を一切使用しない）──────────
function buildDailyShareCanvas() {
  try {
    const memberId = dailyData.members[0];
    if (!memberId) { console.warn('[DailyShare] No member selected today'); return; }
    const member = MEMBERS.find(m => m.id === memberId); if (!member) return;

    const c = getEl('dailyShareCanvas'); if (!c) return;
    const ctx = c.getContext('2d');
    // サイズを毎回明示上書き（HTML属性との競合防止）
    const W = 600, H = 360; c.width = W; c.height = H;

    const { tier, rainbow } = computeTitles();
    const pwr    = Math.round(getPower());
    const streak = powerData.streak || 0;

    const today = new Date();
    const dow   = ['日','月','火','水','木','金','土'][today.getDay()];
    const dowEN = ['SUN','MON','TUE','WED','THU','FRI','SAT'][today.getDay()];
    const dateStr = lang==='jp'
      ? `${today.getFullYear()}.${String(today.getMonth()+1).padStart(2,'0')}.${String(today.getDate()).padStart(2,'0')} ${dow}`
      : `${today.toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'}).toUpperCase()} ${dowEN}`;

    // 背景グラデーション
    const cx = W/2, cy = H/2;
    const bg = ctx.createRadialGradient(cx, cy, 40, cx, cy, Math.max(W,H)*0.8);
    bg.addColorStop(0,   member.color + '22');
    bg.addColorStop(0.5, '#0a0c14');
    bg.addColorStop(1,   '#050608');
    ctx.fillStyle = bg; ctx.fillRect(0,0,W,H);

    // 星屑
    for (let i=0; i<120; i++) {
      const alpha = 0.03 + Math.random()*0.12;
      ctx.fillStyle = member.color + Math.floor(alpha*255).toString(16).padStart(2,'0');
      ctx.beginPath(); ctx.arc(Math.random()*W, Math.random()*H, Math.random()*1.5, 0, Math.PI*2); ctx.fill();
    }

    // 円形グロー
    ctx.shadowBlur=30; ctx.shadowColor=member.color+'66';
    ctx.strokeStyle=member.color+'44'; ctx.lineWidth=1.5;
    ctx.beginPath(); ctx.arc(cx,155,70,0,Math.PI*2); ctx.stroke(); ctx.shadowBlur=0;

    // メンバーイニシャル
    const initials = member.name.split(' ').map(s=>s[0]).join('');
    ctx.font='bold 52px Chakra Petch, monospace';
    ctx.fillStyle=member.color; ctx.textAlign='center';
    ctx.shadowBlur=20; ctx.shadowColor=member.color;
    ctx.fillText(initials, cx, 170); ctx.shadowBlur=0;

    // 日付
    ctx.font='11px Chakra Petch, monospace';
    ctx.fillStyle='rgba(255,255,255,0.35)'; ctx.textAlign='left';
    ctx.fillText(dateStr, 24, 34);

    // ブランド
    ctx.font='bold 13px Chakra Petch, monospace';
    ctx.fillStyle='#D4AF37'; ctx.fillText('✦ FHTS  DAILY LIGHT', 24, 56);

    // メンバー名
    const nameLabel = lang==='jp' ? (member.jp||member.name) : member.name;
    ctx.font='bold 24px Chakra Petch, monospace';
    ctx.fillStyle='#ffffff'; ctx.textAlign='center';
    ctx.fillText(`CHEERING FOR: ${nameLabel}`, cx, 255);

    // 称号・POWER
    ctx.font='13px Chakra Petch, monospace'; ctx.fillStyle=member.color;
    ctx.fillText(`${lang==='jp'?tier.jp:tier.en}  ·  POWER ${pwr}`, cx, 280);

    // 連続日数（streak≥2のみ）
    let yNext = 302;
    if (streak >= 2) {
      ctx.font='11px Chakra Petch, monospace'; ctx.fillStyle='rgba(255,255,255,0.6)';
      ctx.fillText(lang==='jp'?`🔥 ${streak}日連続チェックイン`:`🔥 ${streak}-day streak`, cx, yNext);
      yNext = 322;
    }

    // Rainbow称号（該当時のみ）
    if (rainbow) {
      ctx.font='bold 11px Chakra Petch, monospace'; ctx.fillStyle='#FF69B4';
      ctx.fillText(lang==='jp'?rainbow.jp:rainbow.en, cx, yNext);
    }

    // フッター（位置情報なし）
    ctx.textAlign='right'; ctx.font='10px Chakra Petch, monospace';
    ctx.fillStyle='rgba(255,255,255,0.25)';
    ctx.fillText('#BTSDailyLight · @fhts_app', W-24, H-18);
    ctx.textAlign='left';

  } catch(e) { console.warn('[DailyShare] Build canvas failed:', e); }
}

// ── initShare（リスナー重複防止＋デイリー一本化）─────────────
function initShare() {
  try {
    const modal      = getEl('shareModal');
    const closeShare = getEl('closeShare');

    // 旧 shareBtn は非表示
    const shareBtn = getEl('shareBtn'); if (shareBtn) shareBtn.style.display = 'none';

    // .spbtn のリスナーをクローン置換でリセット（重複防止）
    document.querySelectorAll('.spbtn').forEach(btn => {
      const newBtn = btn.cloneNode(true);
      btn.parentNode.replaceChild(newBtn, btn);
    });

    // デイリーシェアボタン → モーダル表示
    const dailyShareBtn = getEl('dailyShareBtn');
    if (dailyShareBtn) {
      dailyShareBtn.addEventListener('click', () => {
        buildDailyShareCanvas();
        if (modal) modal.classList.add('on');
      });
    }

    // .spbtn → DL / SNSシェア
    document.querySelectorAll('.spbtn').forEach(btn => {
      btn.addEventListener('click', async () => {
        try {
          const memberId = dailyData.members[0];
          if (!memberId) { console.warn('[DailyShare] No member selected'); return; }
          const member = MEMBERS.find(m => m.id === memberId); if (!member) return;

          const sc = getEl('dailyShareCanvas'); if (!sc) return;
          const blob = await new Promise(r => sc.toBlob(r, 'image/png'));
          const file = new File([blob], 'bts-daily-oshi.png', { type:'image/png' });
          const text = `✦ FHTS Daily Light · ${member.name} · POWER ${Math.round(getPower())} · #BTSDailyLight`;

          if (navigator.share && navigator.canShare({ files:[file] })) {
            await navigator.share({ files:[file], text });
          } else {
            const a = document.createElement('a'); a.href = sc.toDataURL('image/png'); a.download = 'bts-daily-oshi.png'; a.click();
          }
          GA.trackDailyShare('native_share_or_download');
        } catch(e) { console.warn('[DailyShare] Share failed:', e); }
      });
    });

    if (closeShare) closeShare.addEventListener('click', () => { if(modal)modal.classList.remove('on'); });
    if (modal)      modal.addEventListener('click', e => { if(e.target===modal)modal.classList.remove('on'); });

  } catch(e) { console.error('[Share] Init failed:', e); }
}

// ════════════════════════════════════════════════
// INIT
// ════════════════════════════════════════════════
async function init() {
  try {
    const langBtn = getEl('langBtn'); if (langBtn) langBtn.addEventListener('click', toggleLang);
    await Sec.init();
    powerData = await Sec.load(POWER_KEY, {lastDate:'',streak:0,total:0});
    dailyData  = await Sec.load(DAILY_KEY, {date:'',members:[],rainbowCount:0});
    recordDailyVisit(); resetDailyIfNeeded();

    // MapRenderer 初期化（非同期: JSON + 画像読込）
    const mc = getEl('mapCanvas');
    if (mc) {
      mapRenderer = new MapRenderer(mc);
      await mapRenderer.init();
      mapRenderer.resize();
      await mapRenderer.renderStaticLayer();
    }

    initEnergyCanvas(); initCards();

    window.addEventListener('resize', async () => {
      try { if (mapRenderer) { mapRenderer.resize(); await mapRenderer.renderStaticLayer(); } }
      catch(e) { console.warn('[Resize] Handler error:', e); }
    });

    initCompass(); initMemberSel(); initDailyGrid(); initSendBtn(); initShare();

    const _nt=findNextTarget(), _ni=TOUR.indexOf(_nt), _pi=Math.max(0,_ni-1);
    setRoute(TOUR[_pi], _nt); applyTheme(activeMember); selectStop(_nt, _ni);
    refreshStatusBar(); refreshDailyUI(); renderTitleZone();

    requestAnimationFrame(loopMap);
    drawEnergy(); updateCountdown(); updateShowtime();
    setInterval(updateCountdown, 30000);
    setInterval(updateShowtime,  60000);
    setInterval(drawEnergy, 120);
    setInterval(() => {
      try { energyCount += Math.floor(Math.random()*4)+1; const el=getEl('eCount'); if(el)el.textContent=energyCount.toLocaleString(); }
      catch(e) {}
    }, 3200);
    checkShowtimeArrival();
  } catch(e) { console.error('[Init] Fatal error:', e); }
}

// ════════════════════════════════════════════════
// GA4 ANALYTICS MODULE
// ════════════════════════════════════════════════
const GA = {
  CONSENT_KEY: 'bts_lr_consent_v1',
  init() {
    try {
      if (typeof gtag === 'undefined') { console.warn('[GA] gtag not defined'); return; }
      const saved=localStorage.getItem(this.CONSENT_KEY), banner=getEl('consentBanner');
      if (saved==='granted') { this.grant(false); }
      else if (saved !== 'denied') { if (banner) banner.classList.add('show'); }
      const cbAccept=getEl('cbAccept'), cbDecline=getEl('cbDecline'), privacyLink=getEl('privacyLink');
      if (cbAccept)    cbAccept.addEventListener('click', ()=>this.grant(true));
      if (cbDecline)   cbDecline.addEventListener('click', ()=>this.deny());
      if (privacyLink) privacyLink.addEventListener('click', ()=>{ if(banner)banner.classList.add('show'); });
    } catch(e) { console.warn('[GA] Init failed:', e); }
  },
  grant(save=true) {
    try {
      if (typeof gtag==='undefined') return;
      if (save) localStorage.setItem(this.CONSENT_KEY,'granted');
      gtag('consent','update',{analytics_storage:'granted'});
      const banner=getEl('consentBanner'); if(banner)banner.classList.remove('show');
      gtag('event','page_view',{page_title:'BTS Light Route',page_location:location.href});
    } catch(e) {}
  },
  deny() {
    try {
      if (typeof gtag==='undefined') return;
      localStorage.setItem(this.CONSENT_KEY,'denied');
      gtag('consent','update',{analytics_storage:'denied'});
      const banner=getEl('consentBanner'); if(banner)banner.classList.remove('show');
    } catch(e) {}
  },
  track(ev, params={}) { try { if(typeof gtag!=='undefined')gtag('event',ev,params); } catch(e) {} },
  trackSendLight(venue,city,memberName,power,daysToShow) { this.track('send_light',{venue_city:city,member_name:memberName,power_level:Math.round(power),days_to_show:daysToShow}); },
  trackDailyCheckin(memberId,checkinCount) { this.track('daily_checkin',{member_id:memberId,daily_count:checkinCount}); },
  trackRainbow(totalRainbows,streakDays)   { this.track('rainbow_achieved',{total_rainbows:totalRainbows,streak_days:streakDays}); },
  trackTitleEarned(titleEn,totalStars)     { this.track('title_earned',{title:titleEn,total_stars:totalStars}); },
  trackGeoGranted()  { this.track('geo_permission_granted'); },
  trackLangSwitch(to){ this.track('language_switch',{to_lang:to}); },
  // ── デイリーシェア専用（航路シェアから分離）──
  trackDailyShare(platform) {
    this.track('share_daily_oshi', {
      platform,
      member_id:   dailyData.members[0] || 'unknown',
      power_level: Math.round(getPower()),
    });
  },
};

window.addEventListener('DOMContentLoaded', () => {
  try { init(); GA.init(); }
  catch(e) { console.error('[Bootstrap] Fatal error:', e); }
});
