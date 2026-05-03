// ═══════════════════════════════════════════════════════════════
// From Here. To the Stage. — app.js
// BTS ARIRANG World Tour 2026–2027  Fan Light Experience
// ═══════════════════════════════════════════════════════════════
// ▶ ツアーデータの編集は tour-data.js で行ってください
// ▶ デザインの変更は styles.css で行ってください
// ─────────────────────────────────────────────────────────────
//
// プレースホルダー（deploy.ymlがビルド時に置換）:
//   %%GA4_SCRIPT%%  → Google Analytics スクリプト
//   %%SITE_URL%%    → https://from-here-to-the-stage.github.io/lightyourlove
//   %%GAS_URL%%     → Google Apps Script エンドポイント
//   %%WORKER_URL%%  → Cloudflare Worker エンドポイント
// ═══════════════════════════════════════════════════════════════

'use strict';

// ════════════════════════════════════════════════
// ガード節付きDOM取得ユーティリティ
// ════════════════════════════════════════════════
function getEl(id) {
  const el = document.getElementById(id);
  if (!el) console.warn(`[DOM] Element #${id} not found`);
  return el;
}

function setText(id, text) {
  const el = getEl(id);
  if (el) el.textContent = text;
  return el;
}

// 安全な親要素確認付き子要素削除
function safeRemoveChild(parent, child) {
  if (!parent || !child) return false;
  if (child.parentNode !== parent) {
    console.warn('[DOM] Attempted to remove child not owned by parent', child, parent);
    return false;
  }
  try {
    parent.removeChild(child);
    return true;
  } catch (e) {
    console.warn('[DOM] removeChild failed:', e);
    return false;
  }
}

// 安全な要素クリア（replaceChildren優先、フォールバックでinnerHTML）
function safeClearElement(el) {
  if (!el) return;
  try {
    if (typeof el.replaceChildren === 'function') {
      el.replaceChildren();
    } else {
      el.innerHTML = '';
    }
  } catch (e) {
    console.warn('[DOM] Failed to clear element:', e);
    // 最終手段：子要素を順に削除
    while (el.firstChild) {
      try {
        el.removeChild(el.firstChild);
      } catch (err) {
        break;
      }
    }
  }
}

// ════════════════════════════════════════════════
// MEMBERS
// ════════════════════════════════════════════════
const MEMBERS=[
  {id:'rm',    name:'RM',     jp:'RM',    color:'#4A90D9',rgb:'74,144,217'},
  {id:'jin',   name:'JIN',    jp:'ジン',  color:'#FF69B4',rgb:'255,105,180'},
  {id:'suga',  name:'SUGA',   jp:'SUGA',  color:'#9BA4B8',rgb:'155,164,184'},
  {id:'jhope', name:'J-HOPE', jp:'J-HOPE',color:'#FF6B35',rgb:'255,107,53'},
  {id:'jimin', name:'JIMIN',  jp:'ジミン',color:'#EAC130',rgb:'234,193,48'},
  {id:'v',     name:'V',      jp:'V',     color:'#3DC98A',rgb:'61,201,138'},
  {id:'jk',    name:'JK',     jp:'JK',    color:'#9B72F0',rgb:'155,114,240'},
];

// ════════════════════════════════════════════════
// TOUR DATA
// ════════════════════════════════════════════════
const TOUR=[];
const _now = new Date();
REGIONS.forEach(r=>r.cities.forEach(c=>{
  let status = 'future';
  if(c.st){
    const showTime = new Date(c.st);
    const diff = showTime - _now;
    if(diff < -7200000) status = 'past';
    else if(diff <= 3600000 && diff > -7200000) status = 'next';
    else status = 'future';
  }
  TOUR.push({...c, status, regionLabel:r.label, regionLabelJP:r.labelJP, isTBA:!c.st||c.venue==='TBA'});
}));
let foundNext = false;
for(let i=0;i<TOUR.length;i++){
  if(TOUR[i].status==='past') continue;
  if(!foundNext){ TOUR[i].status='next'; foundNext=true; }
  else if(TOUR[i].status==='next') TOUR[i].status='future';
}

// ════════════════════════════════════════════════
// SECURITY MODULE
// ════════════════════════════════════════════════
const Sec = {
  manifest: null,
  async init() {
    try {
      const r = await fetch('./manifest.json?_=' + Date.now(), {cache:'no-store', signal: AbortSignal.timeout(3000)});
      if(r.ok) this.manifest = await r.json();
    } catch(e) { /* offline fallback */ }
  },
  async hmac(data, keyHex) {
    const keyBytes = new Uint8Array(keyHex.match(/.{2}/g).map(h=>parseInt(h,16)));
    const key = await crypto.subtle.importKey('raw', keyBytes, {name:'HMAC',hash:'SHA-256'}, false, ['sign']);
    const sig  = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(JSON.stringify(data)));
    return Array.from(new Uint8Array(sig)).map(b=>b.toString(16).padStart(2,'0')).join('');
  },
  async sign(data) {
    if(!this.manifest?.k) return 'unsigned';
    return await this.hmac(data, this.manifest.k);
  },
  async save(key, data) {
    const sig  = await this.sign(data);
    localStorage.setItem(key, JSON.stringify({d:data, s:sig, v: this.manifest?.v||0}));
  },
  async load(key, fallback) {
    const raw = localStorage.getItem(key);
    if(!raw) return {...fallback};
    try {
      const {d, s} = JSON.parse(raw);
      if(this.manifest?.k) {
        const expected = await this.hmac(d, this.manifest.k);
        if(s !== expected && s !== 'unsigned') {
          console.warn('[Security] Signature mismatch on', key, '— resetting');
          localStorage.removeItem(key);
          return {...fallback};
        }
      }
      return d;
    } catch(e) { return {...fallback}; }
  },
  status() {
    return this.manifest ? '✓ VERIFIED' : '○ LOCAL';
  }
};

// ════════════════════════════════════════════════
// SDS-v2 CLIENT MODULE
// ════════════════════════════════════════════════
const SDS = {
  GAS_URL:     '%%GAS_URL%%',
  STORAGE_KEY: 'bts_lr_sds_v2',
  SESSION_KEY: 'bts_lr_sds_sess',
  FP_KEY:      'bts_lr_fp_v1',

  isGASEnabled() {
    return this.GAS_URL && !this.GAS_URL.startsWith('%%') && this.GAS_URL.startsWith('https://');
  },

  jstDateStr() {
    return new Date(Date.now() + 9*60*60*1000).toISOString().slice(0, 10);
  },

  _saltCache: null,
  async getSalt() {
    const today = this.jstDateStr();
    if(this._saltCache?.date === today) return this._saltCache.salt;
    try {
      const res = await fetch(`./tokens/${today}.json?_=${Date.now()}`, {
        cache: 'no-store', signal: AbortSignal.timeout(3000)
      });
      if(!res.ok) return null;
      const data = await res.json();
      if(data.expires && new Date() >= new Date(data.expires)) return null;
      this._saltCache = { date: today, salt: data.salt || data.token };
      return this._saltCache.salt;
    } catch(e) { return null; }
  },

  async generateNonce() {
    const buf = new Uint8Array(16);
    crypto.getRandomValues(buf);
    return Array.from(buf).map(b=>b.toString(16).padStart(2,'0')).join('');
  },

  async sign(salt, fingerprint, showKey, nonce, date) {
    const enc = new TextEncoder();
    const msg = enc.encode(salt + fingerprint + '|' + showKey + '|' + nonce + '|' + date);
    const buf = await crypto.subtle.digest('SHA-256', msg);
    return Array.from(new Uint8Array(buf)).map(b=>b.toString(16).padStart(2,'0')).join('');
  },

  async getFingerprint() {
    const saved = localStorage.getItem(this.FP_KEY);
    if(saved && /^[0-9a-f]{64}$/i.test(saved)) return saved;
    const canvas = document.createElement('canvas');
    const c2 = canvas.getContext('2d');
    c2.font = '14px Chakra Petch, monospace';
    c2.fillText('FHTS✦光🌟', 2, 2);
    const raw = canvas.toDataURL()
      + navigator.language + screen.width + screen.height
      + (navigator.hardwareConcurrency||0) + (navigator.deviceMemory||0);
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(raw));
    const fp = Array.from(new Uint8Array(buf)).map(b=>b.toString(16).padStart(2,'0')).join('');
    localStorage.setItem(this.FP_KEY, fp);
    return fp;
  },

  loadLocal() {
    try { return JSON.parse(localStorage.getItem(this.STORAGE_KEY) || '{}'); } catch(e) { return {}; }
  },
  loadSession() {
    try { return JSON.parse(sessionStorage.getItem(this.SESSION_KEY) || '{}'); } catch(e) { return {}; }
  },

  isLocalSent(showKey) {
    const today = this.jstDateStr();
    const local   = this.loadLocal();
    const session = this.loadSession();
    const lr = local[showKey];
    const sr = session[showKey];
    if(lr?.date === today) return true;
    if(sr?.date === today) return true;
    return false;
  },

  async sendToGAS(showKey, memberId, fingerprint, sig, nonce, date) {
    const res = await fetch(this.GAS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify({
        showKey,
        memberId,
        fingerprint,
        sig,
        nonce,
        date,
        v: 2
      }),
      signal: AbortSignal.timeout(6000)
    });
    return await res.text();
  },

  saveLocal(showKey, memberId, sig, nonce, date) {
    const rec = { date, memberId, sig, nonce, savedAt: new Date().toISOString() };
    const local = this.loadLocal();
    local[showKey] = rec;
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(local));
    const sess = this.loadSession();
    sess[showKey] = { date, memberId };
    sessionStorage.setItem(this.SESSION_KEY, JSON.stringify(sess));
  },

  async checkAndSend(showKey, memberId) {
    const date = this.jstDateStr();

    if(this.isLocalSent(showKey)) {
      return { ok: false, reason: 'local_duplicate', source: 'local' };
    }

    const fp = await this.getFingerprint();

    if(this.isGASEnabled()) {
      const salt = await this.getSalt();
      if(!salt) {
        console.warn('[SDS] Salt fetch failed — local-only mode');
        return { ok: true, reason: 'local_fallback', source: 'local' };
      }

      const nonce = await this.generateNonce();
      const sig   = await this.sign(salt, fp, showKey, nonce, date);

      try {
        const result = await this.sendToGAS(showKey, memberId, fp, sig, nonce, date);

        if(result === 'Success') {
          this.saveLocal(showKey, memberId, sig, nonce, date);
          return { ok: true, source: 'gas' };
        }
        if(result === 'Duplicate') {
          this.saveLocal(showKey, memberId, sig, nonce, date);
          return { ok: false, reason: 'gas_duplicate', source: 'gas' };
        }
        if(result.startsWith('Invalid')) {
          return { ok: false, reason: 'invalid_signature', source: 'gas' };
        }
        if(result.startsWith('Expired')) {
          return { ok: false, reason: 'expired_date', source: 'gas' };
        }
        console.warn('[SDS] Unexpected GAS response:', result);
        return { ok: true, reason: 'gas_fallback', source: 'local' };
      } catch(e) {
        console.warn('[SDS] GAS unreachable — local fallback:', e.message);
        return { ok: true, reason: 'network_fallback', source: 'local' };
      }
    } else {
      const salt = await this.getSalt();
      if(salt) {
        const nonce = await this.generateNonce();
        const sig   = await this.sign(salt, fp, showKey, nonce, date);
        this.saveLocal(showKey, memberId, sig, nonce, date);
      } else {
        this.saveLocal(showKey, memberId, 'unsigned', 'no-salt', date);
      }
      return { ok: true, source: 'actions-only' };
    }
  }
};

const DailyToken = {
  STORAGE_KEY: SDS.STORAGE_KEY,
  jstDateStr()  { return SDS.jstDateStr(); },
  todayStr()    { return new Date().toISOString().slice(0,10); },
  getFingerprint() { return SDS.getFingerprint(); },
  showKeyFor(v) { return `${v.fd}_${v.city}`; },
  async isAlreadySent(showKey) { return SDS.isLocalSent(showKey); },
  async recordSend(showKey, fp, memberId) {
    SDS.saveLocal(showKey, memberId, 'post-send', 'bridge', SDS.jstDateStr());
  }
};

// ════════════════════════════════════════════════
// PER-SHOW SENT STATE
// ════════════════════════════════════════════════
const SENT_KEY = 'bts_lr_sent_v5';
let sentShows = {};
try { sentShows = JSON.parse(localStorage.getItem(SENT_KEY)||'{}'); } catch(e) {}
const showKey  = v => `${v.fd}_${v.city}`;
const isSent   = v => !!sentShows[showKey(v)];
const sentMem  = v => { const e=sentShows[showKey(v)]; if(!e) return null; const id=typeof e==='object'?e.m:e; return MEMBERS.find(m=>m.id===id)||null; };
function markSent(v, m, pwr) {
  sentShows[showKey(v)] = {m:m.id, p:Math.round(pwr), d:new Date().toISOString().slice(0,10)};
  localStorage.setItem(SENT_KEY, JSON.stringify(sentShows));
}

// ════════════════════════════════════════════════
// POWER / STREAK SYSTEM
// ════════════════════════════════════════════════
const POWER_KEY = 'bts_lr_power_v1';
let powerData = {lastDate:'',streak:0,total:0};

function todayStr() { return new Date().toISOString().slice(0,10); }
function yesterdayStr() { return new Date(Date.now()-86400000).toISOString().slice(0,10); }

function recordDailyVisit() {
  const today = todayStr();
  if(powerData.lastDate === today) return;
  powerData.streak = powerData.lastDate === yesterdayStr() ? powerData.streak+1 : 1;
  powerData.total++;
  powerData.lastDate = today;
  savePower();
}
function savePower() { Sec.save(POWER_KEY, powerData); }
function getPower() { return Math.min(powerData.total*0.8 + powerData.streak*2.5, 100); }

// ════════════════════════════════════════════════
// DAILY MEMBER CHECKIN SYSTEM
// ════════════════════════════════════════════════
const DAILY_KEY = 'bts_lr_daily_v1';
let dailyData = {date:'',members:[],rainbowCount:0};

function resetDailyIfNeeded() {
  if(dailyData.date !== todayStr()) {
    dailyData = {date:todayStr(), members:[], rainbowCount: dailyData.rainbowCount||0};
    Sec.save(DAILY_KEY, dailyData);
  }
}

function checkInMember(memberId) {
  resetDailyIfNeeded();
  if(dailyData.members.length >= 1) {
    return { action: 'locked', reason: 'already_selected' };
  }
  dailyData.members = [memberId];
  powerData.total = (powerData.total||0) + 1;
  savePower();
  Sec.save(DAILY_KEY, dailyData);
  setTimeout(()=> showChargeEffect(MEMBERS.find(m=>m.id===memberId)||activeMember), 100);
  return { action: 'added', memberId };
}

// ════════════════════════════════════════════════
// TITLE COMPUTATION
// ════════════════════════════════════════════════
const TITLE_TIERS = [
  {min:0,  icon:'—',    jp:'—',             en:'—',              next:1},
  {min:1,  icon:'🌱',   jp:'ルーキー',       en:'ROOKIE',         next:6},
  {min:6,  icon:'⭐',   jp:'ファン',         en:'FAN',            next:16},
  {min:16, icon:'⭐⭐', jp:'ARMY',           en:'ARMY',           next:31},
  {min:31, icon:'💫',   jp:'光の使者',       en:'MESSENGER',      next:51},
  {min:51, icon:'✨',   jp:'星の守護者',     en:'STAR GUARDIAN',  next:66},
  {min:66, icon:'🌟',   jp:'皆勤賞',        en:'PERFECT ATTENDANCE', next:null},
];
function computeTitles() {
  const stars = Object.keys(sentShows).length;
  const tier  = [...TITLE_TIERS].reverse().find(t=>stars>=t.min) || TITLE_TIERS[0];
  const mc = {};
  Object.values(sentShows).forEach(e=>{ const id=typeof e==='object'?e.m:e; mc[id]=(mc[id]||0)+1; });
  const topEntry = Object.entries(mc).sort((a,b)=>b[1]-a[1])[0];
  let oshi = null;
  if(topEntry){
    const [mid, cnt] = topEntry;
    const m = MEMBERS.find(x=>x.id===mid);
    const allSame = stars>0 && Object.values(sentShows).every(e=>(typeof e==='object'?e.m:e)===mid);
    if(allSame && stars>=5)  oshi={jp:`${m.jp}への一途な愛`, en:`ETERNAL DEVOTION · ${m.name}`,color:m.color};
    else if(cnt>=10)         oshi={jp:`${m.jp}の光`,        en:`LIGHT OF ${m.name}`,             color:m.color};
    else if(cnt>=3)          oshi={jp:`${m.jp}の声`,        en:`VOICE OF ${m.name}`,             color:m.color};
  }
  const rc = dailyData.rainbowCount||0;
  let rainbow = null;
  if(rc>=7)      rainbow={jp:'🌈✨ 虹の伝説',   en:'🌈✨ RAINBOW LEGEND'};
  else if(rc>=3) rainbow={jp:'🌈🌈 虹の戦士',   en:'🌈🌈 RAINBOW WARRIOR'};
  else if(rc>=1) rainbow={jp:'🌈 虹の夢',       en:'🌈 RAINBOW DREAMER'};
  return {tier, stars, oshi, rainbow};
}

// ════════════════════════════════════════════════
// APP STATE
// ════════════════════════════════════════════════
let lang         = 'jp';
let activeMember = MEMBERS.find(m=>m.id==='jimin');
let energyCount  = 24831 + Math.floor(Math.random()*80);
let routeFrom    = TOUR[0], routeTo = TOUR[1], targetStop = TOUR[0];
let devHeading   = 0, demoMode = false, sendReady = false;
let userLat = null, userLng = null, geoGranted = false;
let planeT=0, planeDir=1;
const shownArrival = new Set();
try { JSON.parse(localStorage.getItem('bts_lr_arr')||'[]').forEach(k=>shownArrival.add(k)); } catch(e){}
const WINDOW_MS = 60*60*1000;

// ════════════════════════════════════════════════
// LANGUAGE
// ════════════════════════════════════════════════
function applyLangToCards(){
  const isEn = lang==='en';
  document.querySelectorAll('.txt-jp').forEach(el=>{
    if(el) el.style.display=isEn?'none':'';
  });
  document.querySelectorAll('.txt-en').forEach(el=>{
    if(el) el.style.display=isEn?'':'none';
  });
}
function toggleLang(){
  lang = lang==='jp'?'en':'jp';
  document.body.classList.toggle('lang-en', lang==='en');
  const langActive = getEl('langActive');
  const langOther = getEl('langOther');
  if(langActive) langActive.textContent = lang.toUpperCase();
  if(langOther) langOther.textContent  = lang==='jp'?'EN':'JP';
  document.documentElement.lang = lang==='jp'?'ja':'en';
  applyLangToCards();
  refreshStep(); updateSendBtnText(); updateCountdown(); updateShowtime();
  renderTitleZone(); refreshDailyUI();
}

// ════════════════════════════════════════════════
// MATH
// ════════════════════════════════════════════════
const toR=d=>d*Math.PI/180, toD=r=>r*180/Math.PI;
function hav(a,b,c,d){
  const R=6371,e=Math.sin(toR(c-a)/2)**2+Math.cos(toR(a))*Math.cos(toR(c))*Math.sin(toR(d-b)/2)**2;
  return R*2*Math.asin(Math.sqrt(e));
}
function brng(a,b,c,d){
  const p1=toR(a),p2=toR(c),Dl=toR(d-b),y=Math.sin(Dl)*Math.cos(p2),x=Math.cos(p1)*Math.sin(p2)-Math.sin(p1)*Math.cos(p2)*Math.cos(Dl);
  return(toD(Math.atan2(y,x))+360)%360;
}
function gc(a,b,c,d,n=100){
  const pts=[],p1=toR(a),l1=toR(b),p2=toR(c),l2=toR(d);
  const dist=2*Math.asin(Math.sqrt(Math.sin((p2-p1)/2)**2+Math.cos(p1)*Math.cos(p2)*Math.sin((l2-l1)/2)**2));
  for(let i=0;i<=n;i++){
    const f=i/n; if(dist<1e-6){pts.push([a,b]);continue;}
    const A=Math.sin((1-f)*dist)/Math.sin(dist),B=Math.sin(f*dist)/Math.sin(dist);
    const x=A*Math.cos(p1)*Math.cos(l1)+B*Math.cos(p2)*Math.cos(l2);
    const y=A*Math.cos(p1)*Math.sin(l1)+B*Math.cos(p2)*Math.sin(l2);
    const z=A*Math.sin(p1)+B*Math.sin(p2);
    pts.push([toD(Math.atan2(z,Math.sqrt(x*x+y*y))),toD(Math.atan2(y,x))]);
  }
  return pts;
}
function ll(la,lo,W,H,p=16){return[((lo+180)/360)*(W-2*p)+p,((90-la)/180)*(H-2*p)+p];}
const BLBL=['N','NNE','NE','ENE','E','ESE','SE','SSE','S','SSW','SW','WSW','W','WNW','NW','NNW'];
function blbl(b){return BLBL[Math.round(b/22.5)%16];}

// ════════════════════════════════════════════════
// STARS BACKGROUND
// ════════════════════════════════════════════════
function initStars(){
  try {
    const el=getEl('stars');
    if(!el) return;
    // 安全なクリア
    safeClearElement(el);
    for(let i=0;i<72;i++){
      const s=document.createElement('div');s.className='star';
      const sz=Math.random()*1.8+.7;
      s.style.cssText=`left:${Math.random()*100}%;top:${Math.random()*100}%;width:${sz}px;height:${sz}px;`;
      s.style.setProperty('--d',(2+Math.random()*5)+'s');
      s.style.setProperty('--o',(0.08+Math.random()*0.48).toFixed(2));
      s.style.setProperty('--dl',(Math.random()*6)+'s');
      el.appendChild(s);
    }
  } catch (e) {
    console.warn('[Stars] Init failed:', e);
  }
}

// ════════════════════════════════════════════════
// CARDS
// ════════════════════════════════════════════════
const MONJP=['1月','2月','3月','4月','5月','6月','7月','8月','9月','10月','11月','12月'];

function initCards(){
  try {
    const wrap=getEl('schedCards');
    if(!wrap) {
      console.warn('[Cards] schedCards not found');
      return;
    }
    // 安全なクリア（親要素が存在することを確認）
    safeClearElement(wrap);
    
    let lastRegion='';
    const mons=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const monJP=['1月','2月','3月','4月','5月','6月','7月','8月','9月','10月','11月','12月'];
    
    TOUR.forEach((v,i)=>{
      if(v.regionLabel!==lastRegion){
        lastRegion=v.regionLabel;
        const div=document.createElement('div');
        div.className='swiper-slide region-slide';
        div.style.width='auto';
        div.innerHTML=`<div class="region-tag"><span class="txt-jp">${v.regionLabelJP}</span><span class="txt-en" style="display:none">${v.regionLabel}</span></div>`;
        wrap.appendChild(div);
      }
      const d=new Date(v.fd+'T12:00:00Z'),yr=d.getUTCFullYear();
      const slide=document.createElement('div');slide.className='swiper-slide';
      const isPast=v.status==='past';
      const isNext=v.status==='next';
      const tagJP=isNext?'▶ 次回公演':isPast?'済':'UPCOMING';
      const tagEN=isNext?'▶ NEXT':isPast?'PAST':'UPCOMING';
      const borderCol=isNext?'rgba(91,63,217,.4)':'rgba(91,63,217,.12)';
      const tagCol=isNext?'var(--purple)':'var(--dim)';
      slide.innerHTML=`<div class="scard ${v.status}${v.isTBA?' tba':''}${isSent(v)?' show-sent':''}" id="card${i}" style="border-color:${borderCol};">
        <div class="sc-num" style="font-size:11px;color:var(--dim);letter-spacing:1px;margin-bottom:5px;">${String(i+1).padStart(2,'0')} · ${v.country}</div>
        <div class="sc-tag" id="ctag${i}" style="font-size:11px;font-weight:700;letter-spacing:1px;margin-bottom:5px;color:${tagCol};">${tagJP}</div>
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
      if(cardEl) cardEl.addEventListener('click',()=>selectStop(v,i));
      wrap.appendChild(slide);
    });

    if(typeof Swiper!=='undefined'){
      let sw;
      try {
        sw=new Swiper('#schedSwiper',{slidesPerView:'auto',spaceBetween:8,freeMode:true,grabCursor:true});
        const track=getEl('schedTrack');
        const thumb=getEl('schedThumb');
        function syncBar(){
          if(!track||!thumb) return;
          const wr=document.querySelector('#schedSwiper .swiper-wrapper');
          if(!wr) return;
          const total=wr.scrollWidth, view=sw.width||track.offsetWidth;
          if(total<=view){track.style.display='none';return;}
          track.style.display='';
          const ratio=Math.min(view/total,1);
          const tw=Math.max(ratio*track.offsetWidth,24);
          const maxL=track.offsetWidth-tw;
          const prog=sw.progress||0;
          thumb.style.width=tw+'px';
          thumb.style.left=Math.max(0,Math.min(maxL,prog*maxL))+'px';
        }
        sw.on('progress',syncBar);
        sw.on('setTranslate',syncBar);
        setTimeout(syncBar,200);
        if(track) track.addEventListener('click',e=>{
          const rect=track.getBoundingClientRect();
          const prog=(e.clientX-rect.left)/rect.width;
          sw.setProgress(prog,0);
          syncBar();
        });
      } catch(e) {
        console.warn('[Swiper] Init failed:', e);
      }
    }
  } catch (e) {
    console.error('[Cards] Fatal error in initCards:', e);
  }
}

function refreshCardSent(){
  try {
    TOUR.forEach((v,i)=>{
      const c=getEl('card'+i);
      if(c) c.classList.toggle('show-sent',isSent(v));
    });
  } catch (e) {
    console.warn('[Cards] refreshCardSent failed:', e);
  }
}

// ════════════════════════════════════════════════
// SELECT STOP
// ════════════════════════════════════════════════
function findNextTarget(){
  const now = new Date();
  for(const v of TOUR){
    if(!v.st || v.isTBA || isSent(v)) continue;
    const diff = new Date(v.st) - now;
    if(diff >= 0 && diff <= WINDOW_MS) return v;
  }
  for(const v of TOUR){
    if(v.status==='next' && !isSent(v)) return v;
  }
  for(const v of TOUR){
    if(!isSent(v)){
      if(!v.st) return v;
      if(new Date(v.st) > now) return v;
    }
  }
  return TOUR[TOUR.length-1];
}

function selectStop(v,i){
  try {
    const fi=Math.max(0,i-1);setRoute(TOUR[fi],v);targetStop=v;
    document.querySelectorAll('.scard').forEach(c=>{
      if(c) c.classList.remove('sel');
    });
    const card=getEl('card'+i);
    if(card) card.classList.add('sel');
    const d=new Date(v.fd+'T12:00:00Z');
    const tCity = getEl('tCity');
    const tDetail = getEl('tDetail');
    const tSent = getEl('tSent');
    const tSentTxt = getEl('tSentTxt');
    
    if(tCity) tCity.textContent=v.city+(v.reg?', '+v.reg:'');
    const _mons=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    if(tDetail) tDetail.innerHTML=
      `<span class="txt-jp">${MONJP[d.getUTCMonth()]}${d.getUTCDate()}日 · ${v.venue}</span>`+
      `<span class="txt-en" style="${lang==='jp'?'display:none':''}">${_mons[d.getUTCMonth()]} ${d.getUTCDate()} · ${v.venue}</span>`;
    const sm=sentMem(v);
    if(tSent && tSentTxt){
      if(sm){
        tSentTxt.innerHTML=`<span class="txt-jp">${sm.jp||sm.name}カラーで送信済み</span><span class="txt-en">Sent as ${sm.name}</span>`;
        tSent.classList.add('on');
      } else {
        tSent.classList.remove('on');
      }
    }
    updateShowtime();evaluateSendState();
    if(geoGranted&&userLat)updateCompassFromUser();
    else{
      const lbl=getEl('compassFromLabel');
      if(lbl) lbl.textContent=lang==='jp'?`${TOUR[fi].city} → ${v.city} (📍タップで現在地から)`:`${TOUR[fi].city} → ${v.city} (tap 📍 for your location)`;
    }
  } catch (e) {
    console.error('[SelectStop] Error:', e);
  }
}

// ════════════════════════════════════════════════
// MAP
// ════════════════════════════════════════════════
let mc, mctx;
function initMapCanvas(){
  try {
    mc   = getEl('mapCanvas');
    mctx = mc ? mc.getContext('2d') : null;
  } catch (e) {
    console.warn('[Map] Init failed:', e);
  }
}

function resizeMap(){
  try {
    if(!mc) return;
    const parent = mc.parentElement;
    if(!parent) return;
    const r = parent.getBoundingClientRect();
    mc.width  = r.width  > 0 ? r.width  : (parent.offsetWidth  || 358);
    mc.height = 210;
    drawMap();
  } catch (e) {
    console.warn('[Map] Resize failed:', e);
  }
}

const BGCIT=[[35.6,139.7],[37.6,127],[22.3,114.2],[1.35,103.8],[13.8,100.5],[39.9,116.4],[28.6,77.2],[51.5,-0.1],[48.9,2.4],[52.5,13.4],[40.4,-3.7],[41.9,12.5],[55.8,37.6],[40.7,-74],[34.1,-118.2],[41.9,-87.6],[19.4,-99.1],[-23.5,-46.6],[-34.6,-58.4],[4.7,-74.1],[-12.0,-77.0],[-33.5,-70.6],[22.6,120.3],[14.6,121.0],[22.3,114.2],[27.9,-82.5],[31.8,-106.5],[36.1,-115.2],[40.8,-74.1],[39.3,-76.6],[32.7,-97.1]];

const CONTINENTS=[
  [[70,30],[60,50],[55,75],[30,80],[20,90],[5,100],[5,110],[10,120],[25,125],[40,135],[50,140],[60,130],[65,110],[70,80],[70,50],[70,30]],
  [[71,25],[65,15],[58,5],[45,0],[38,0],[35,12],[38,28],[42,35],[50,38],[58,40],[65,35],[70,28],[71,25]],
  [[37,10],[28,-5],[15,-18],[0,-18],[-15,-12],[-28,16],[-35,20],[-25,33],[-10,40],[5,42],[18,40],[30,33],[37,10]],
  [[70,-140],[60,-130],[48,-125],[32,-118],[18,-100],[15,-88],[20,-80],[25,-80],[35,-75],[44,-65],[52,-55],[60,-65],[70,-80],[72,-100],[70,-140]],
  [[12,-72],[5,-62],[0,-50],[-8,-40],[-20,-42],[-35,-58],[-55,-68],[-42,-65],[-25,-50],[-10,-38],[0,-50],[10,-63],[12,-72]],
  [[-15,130],[-12,136],[-14,142],[-18,148],[-28,153],[-38,148],[-38,142],[-32,134],[-30,122],[-22,114],[-15,122],[-15,130]],
];

function drawContinent(pts,W,H){
  if(!mctx || pts.length<3) return;
  mctx.beginPath();
  let first=true;
  for(const[la,lo]of pts){
    const[x,y]=ll(la,lo,W,H);
    if(first){mctx.moveTo(x,y);first=false;}
    else mctx.lineTo(x,y);
  }
  mctx.closePath();
  mctx.fillStyle='rgba(180,170,230,.28)';
  mctx.strokeStyle='rgba(120,100,200,.45)';
  mctx.lineWidth=0.8;
  mctx.fill();
  mctx.stroke();
}

function drawMap(){
  try {
    if(!mc||!mctx) return;
    const W=mc.width,H=mc.height;
    if(W===0||H===0) return;
    mctx.clearRect(0,0,W,H);

    const bg=mctx.createLinearGradient(0,0,W,H);
    bg.addColorStop(0,'#EEF2FF');
    bg.addColorStop(1,'#E8ECF8');
    mctx.fillStyle=bg; mctx.fillRect(0,0,W,H);

    mctx.strokeStyle='rgba(91,63,217,.10)'; mctx.lineWidth=.6;
    for(let la=-60;la<=90;la+=30){
      mctx.beginPath();
      const[,y]=ll(la,0,W,H);
      mctx.moveTo(0,y);mctx.lineTo(W,y);mctx.stroke();
    }
    for(let lo=-180;lo<=180;lo+=30){
      mctx.beginPath();
      const[x]=ll(0,lo,W,H);
      mctx.moveTo(x,0);mctx.lineTo(x,H);mctx.stroke();
    }

    CONTINENTS.forEach(pts=>drawContinent(pts,W,H));

    BGCIT.forEach(([la,lo])=>{
      const[x,y]=ll(la,lo,W,H);
      if(x<0||x>W||y<0||y>H)return;
      mctx.fillStyle='rgba(91,63,217,.30)';
      mctx.beginPath();mctx.arc(x,y,1.4,0,Math.PI*2);mctx.fill();
    });

    for(let i=0;i<TOUR.length-1;i++){
      const pts2=gc(TOUR[i].lat,TOUR[i].lng,TOUR[i+1].lat,TOUR[i+1].lng,60);
      const s2=[];let c2=[];
      pts2.forEach(([la,lo],j)=>{if(j>0&&Math.abs(lo-pts2[j-1][1])>180){s2.push(c2);c2=[];}c2.push([la,lo]);});s2.push(c2);
      s2.forEach(seg=>{
        if(seg.length<2)return;
        mctx.beginPath();let ff=true;
        seg.forEach(([la,lo])=>{const[x,y]=ll(la,lo,W,H);if(ff){mctx.moveTo(x,y);ff=false;}else mctx.lineTo(x,y);});
        mctx.strokeStyle='rgba(91,63,217,.18)';mctx.lineWidth=.7;mctx.setLineDash([2,8]);mctx.stroke();mctx.setLineDash([]);
      });
    }

    const pwr=getPower(),lw=1.4+(pwr/100)*2,glow=6+(pwr/100)*12;
    const pts=gc(routeFrom.lat,routeFrom.lng,routeTo.lat,routeTo.lng,120);
    const segs=[];let cur=[];
    pts.forEach(([la,lo],j)=>{if(j>0&&Math.abs(lo-pts[j-1][1])>180){segs.push(cur);cur=[];}cur.push([la,lo]);});segs.push(cur);
    segs.forEach(seg=>{
      if(seg.length<2)return;mctx.beginPath();let ff=true;
      seg.forEach(([la,lo])=>{const[x,y]=ll(la,lo,W,H);if(ff){mctx.moveTo(x,y);ff=false;}else mctx.lineTo(x,y);});
      mctx.shadowBlur=glow;mctx.shadowColor=activeMember.color;
      mctx.strokeStyle=activeMember.color;mctx.lineWidth=lw;mctx.setLineDash([5,5]);mctx.stroke();
      mctx.setLineDash([]);mctx.shadowBlur=0;
    });

    TOUR.forEach(v=>{
      const[x,y]=ll(v.lat,v.lng,W,H);
      if(x<3||x>W-3||y<3||y>H+3)return;
      const isTgt=v===targetStop,wasSent=isSent(v);
      const isNext=v.status==='next';
      const col=isNext?'#5B3FD9':isTgt?activeMember.color:wasSent?'#16A34A':'rgba(91,63,217,.35)';
      if(isNext||isTgt){
        mctx.beginPath();mctx.arc(x,y,7+Math.sin(Date.now()/600)*1.5,0,Math.PI*2);
        mctx.strokeStyle=col+'66';mctx.lineWidth=1.5;mctx.stroke();
      }
      mctx.shadowBlur=isNext?12:isTgt?8:0;mctx.shadowColor=col;
      mctx.fillStyle=col;
      mctx.beginPath();mctx.arc(x,y,isNext?4.5:isTgt?4:2,0,Math.PI*2);mctx.fill();
      mctx.shadowBlur=0;
      if(isNext||isTgt){
        mctx.fillStyle=col;
        mctx.font=`${isNext?'bold ':''}8px Chakra Petch,monospace`;
        mctx.fillText(v.city,x+7,y+3);
      }
    });

    if(pts.length>1){
      const idx=Math.min(Math.floor(planeT*pts.length),pts.length-2);
      const[pLa,pLo]=pts[idx];const[px,py]=ll(pLa,pLo,W,H);
      if(px>=0&&px<=W&&py>=0&&py<=H){
        const[nx,ny]=ll(pts[idx+1][0],pts[idx+1][1],W,H);
        const ang=Math.atan2(ny-py,nx-px);
        mctx.save();mctx.translate(px,py);mctx.rotate(ang);
        mctx.shadowBlur=10;mctx.shadowColor=activeMember.color;mctx.fillStyle=activeMember.color;
        mctx.beginPath();mctx.moveTo(9,0);mctx.lineTo(-3,-5);mctx.lineTo(-1,0);mctx.lineTo(-3,5);mctx.closePath();mctx.fill();
        mctx.shadowBlur=0;mctx.restore();
      }
    }
  } catch (e) {
    console.warn('[Map] Draw failed:', e);
  }
}

let lastMap=0;
function loopMap(ts){
  try {
    if(!mc||!mctx){requestAnimationFrame(loopMap);return;}
    if(ts-lastMap>60){
      planeT+=.005*planeDir;
      if(planeT>=1){planeT=1;planeDir=-1;}
      if(planeT<=0){planeT=0;planeDir=1;}
      lastMap=ts;
      drawMap();
    }
    requestAnimationFrame(loopMap);
  } catch (e) {
    console.warn('[Map] Loop error:', e);
  }
}

function setRoute(from,to){
  try {
    routeFrom=from;routeTo=to;
    const d=Math.round(hav(from.lat,from.lng,to.lat,to.lng));
    const b=Math.round(brng(from.lat,from.lng,to.lat,to.lng));
    setText('routeLabel', `${from.city.toUpperCase()} → ${to.city.toUpperCase()}`);
    setText('mapDistVal', d.toLocaleString()+' km');
    setText('cDist', d.toLocaleString()+' km');
    setText('cDeg', b+'°');
    setText('cDir', blbl(b));
    rotateNeedle(b-devHeading);
  } catch (e) {
    console.warn('[Map] setRoute failed:', e);
  }
}

// ════════════════════════════════════════════════
// GEOLOCATION → COMPASS
// ════════════════════════════════════════════════
const GEO_KEY='bts_lr_geo';
try{
  const g=JSON.parse(localStorage.getItem(GEO_KEY)||'null');
  if(g){userLat=g.lat;userLng=g.lng;geoGranted=true;}
} catch(e){}

function updateCompassFromUser(){
  try {
    if(!userLat||!geoGranted)return;
    const v=targetStop;
    const d=Math.round(hav(userLat,userLng,v.lat,v.lng));
    const b=Math.round(brng(userLat,userLng,v.lat,v.lng));
    setText('cDeg', b+'°');
    setText('cDir', blbl(b));
    setText('cDist', d.toLocaleString()+' km');
    rotateNeedle(b-devHeading);
    const lbl=getEl('compassFromLabel');
    if(lbl){
      lbl.textContent=lang==='jp'?`📍 あなた → ${v.city} (${v.venue})`:`📍 You → ${v.city} (${v.venue})`;
      lbl.style.color='var(--dim2)';
    }
    setRoute({lat:userLat,lng:userLng,city:'You',country:''},v);
  } catch (e) {
    console.warn('[Geo] updateCompassFromUser failed:', e);
  }
}

function requestGeo(){
  try {
    if(!navigator.geolocation){
      const l=getEl('compassFromLabel');
      if(l) l.textContent=lang==='jp'?'位置情報非対応':'Not supported';
      return;
    }
    const l=getEl('compassFromLabel');
    if(l) l.textContent=lang==='jp'?'位置情報を取得中…':'Locating…';
    navigator.geolocation.getCurrentPosition(pos=>{
      userLat=pos.coords.latitude;userLng=pos.coords.longitude;geoGranted=true;
      localStorage.setItem(GEO_KEY,JSON.stringify({lat:userLat,lng:userLng}));
      updateCompassFromUser();
      const geoBtn = getEl('geoBtn');
      if(geoBtn){
        geoBtn.style.borderColor='var(--green)';
        geoBtn.style.color='var(--green)';
      }
    },()=>{
      geoGranted=false;
      const fi=TOUR.findIndex(x=>x===targetStop);
      if(l) l.textContent=lang==='jp'?`${routeFrom.city} → ${targetStop.city} (都市間)`:`${routeFrom.city} → ${targetStop.city} (city-to-city)`;
      setRoute(routeFrom,targetStop);
    },{timeout:8000,maximumAge:300000});
  } catch (e) {
    console.warn('[Geo] requestGeo failed:', e);
  }
}

function initCompass(){
  try {
    const ticks=getEl('cTicks');
    if(ticks){
      for(let i=0;i<72;i++){
        const a=i*5,maj=i%9===0,mid=i%3===0,r1=maj?36:mid?38:40,r2=44,rad=toR(a-90);
        const line=document.createElementNS('http://www.w3.org/2000/svg','line');
        line.setAttribute('x1',50+r1*Math.cos(rad));line.setAttribute('y1',50+r1*Math.sin(rad));
        line.setAttribute('x2',50+r2*Math.cos(rad));line.setAttribute('y2',50+r2*Math.sin(rad));
        line.setAttribute('stroke',maj?'rgba(91,63,217,.5)':mid?'rgba(91,63,217,.2)':'rgba(91,63,217,.08)');
        line.setAttribute('stroke-width',maj?1.5:.8);ticks.appendChild(line);
      }
    }
    const geoBtn = getEl('geoBtn');
    if(geoBtn) geoBtn.addEventListener('click',requestGeo);
    
    if(geoGranted&&userLat){
      updateCompassFromUser();
      if(geoBtn){
        geoBtn.style.borderColor='var(--green)';
        geoBtn.style.color='var(--green)';
      }
    } else {
      const b=Math.round(brng(TOUR[0].lat,TOUR[0].lng,TOUR[1].lat,TOUR[1].lng));
      rotateNeedle(b);
      setText('cDeg', b+'°');
      setText('cDir', blbl(b));
      setText('cDist', Math.round(hav(TOUR[0].lat,TOUR[0].lng,TOUR[1].lat,TOUR[1].lng)).toLocaleString()+' km');
      const lbl=getEl('compassFromLabel');
      if(lbl) lbl.textContent=lang==='jp'?`${TOUR[0].city} → ${TOUR[1].city} (📍タップで現在地から)`:`${TOUR[0].city} → ${TOUR[1].city} (tap 📍 for your location)`;
    }
    
    if('DeviceOrientationEvent'in window){
      window.addEventListener('deviceorientationabsolute',onOrient,true);
      window.addEventListener('deviceorientation',onOrient,true);
    }
  } catch (e) {
    console.warn('[Compass] Init failed:', e);
  }
}

function onOrient(e){
  try {
    const h=e.webkitCompassHeading??(e.absolute?-e.alpha:null);
    if(h!==null){
      devHeading=h;
      rotateNeedle(brng(routeFrom.lat,routeFrom.lng,routeTo.lat,routeTo.lng)-devHeading);
    }
  } catch (err) {
    console.warn('[Compass] Orientation error:', err);
  }
}

function rotateNeedle(a){
  try {
    const needle = getEl('needle');
    if(!needle) return;
    needle.style.transition='transform .7s cubic-bezier(.4,0,.2,1)';
    needle.setAttribute('transform',`rotate(${a},50,50)`);
  } catch (e) {
    console.warn('[Compass] rotateNeedle failed:', e);
  }
}

// ════════════════════════════════════════════════
// ENERGY RING
// ════════════════════════════════════════════════
let ec;
function initEnergyCanvas(){
  try {
    const ecEl = getEl('energyCanvas');
    ec = ecEl ? ecEl.getContext('2d') : null;
  } catch (e) {
    console.warn('[Energy] Init failed:', e);
  }
}

function drawEnergy(){
  try {
    if(!ec) return;
    const cx=46,cy=46,r=33,W=92,H=92;
    ec.clearRect(0,0,W,H);
    ec.fillStyle='rgba(237,233,255,.9)';ec.beginPath();ec.arc(cx,cy,r+9,0,Math.PI*2);ec.fill();
    ec.beginPath();ec.arc(cx,cy,r,0,Math.PI*2);ec.strokeStyle='rgba(91,63,217,.18)';ec.lineWidth=7;ec.stroke();
    const p=Math.min(energyCount/120000,1),s=-Math.PI/2;
    ec.beginPath();ec.arc(cx,cy,r,s,s+p*Math.PI*2);
    ec.shadowBlur=10;ec.shadowColor=activeMember.color;
    ec.strokeStyle=activeMember.color;ec.lineWidth=7;ec.lineCap='round';ec.stroke();ec.shadowBlur=0;
    const ex=cx+r*Math.cos(s+p*Math.PI*2),ey=cy+r*Math.sin(s+p*Math.PI*2);
    ec.beginPath();ec.arc(ex,ey,4,0,Math.PI*2);
    ec.fillStyle=activeMember.color;ec.shadowBlur=8;ec.shadowColor=activeMember.color;ec.fill();ec.shadowBlur=0;
  } catch (e) {
    console.warn('[Energy] Draw failed:', e);
  }
}

// ════════════════════════════════════════════════
// MEMBER SELECTOR (Zone 4)
// ════════════════════════════════════════════════
function initMemberSel(){
  try {
    const wrap = getEl('memberBtns');
    if(!wrap) {
      console.warn('[MemberSel] memberBtns not found');
      return;
    }
    safeClearElement(wrap);
    MEMBERS.forEach(m=>{
      const btn = document.createElement('button');
      btn.className = 'mbtn' + (m.id===activeMember.id?' sel':'');
      btn.style.setProperty('--mc', m.color);
      btn.style.setProperty('--mr', m.rgb);
      btn.innerHTML = `<div class="mbtn-dot"></div><div class="mbtn-name">${m.jp||m.name}</div>`;
      btn.addEventListener('click',()=>{
        if(isSent(targetStop)) return;
        activeMember = m;
        document.querySelectorAll('.mbtn').forEach(b=>{
          if(b) b.classList.remove('sel');
        });
        btn.classList.add('sel');
        applyTheme(m);
        evaluateSendState();
      });
      wrap.appendChild(btn);
    });
  } catch (e) {
    console.error('[MemberSel] Init failed:', e);
  }
}

function applyTheme(m){
  try {
    document.documentElement.style.setProperty('--active',m.color);
    document.documentElement.style.setProperty('--active-rgb',m.rgb);
    const cDeg = getEl('cDeg');
    const showtimeCnt = getEl('showtimeCnt');
    const sbPower = getEl('sbPower');
    
    if(cDeg) cDeg.style.color=m.color;
    if(showtimeCnt) showtimeCnt.style.color=m.color;
    if(sbPower) sbPower.style.color=m.color;
    
    drawEnergy();
    updateSendStyle();
  } catch (e) {
    console.warn('[Theme] Apply failed:', e);
  }
}

// ════════════════════════════════════════════════
// DAILY MEMBER CHECKIN GRID (Zone 5)
// ════════════════════════════════════════════════
function initDailyGrid(){
  try {
    const grid = getEl('dailyMembersGrid');
    if(!grid) {
      console.warn('[DailyGrid] dailyMembersGrid not found');
      return;
    }
    safeClearElement(grid);
    const todaySelected = dailyData.members[0] || null;
    
    MEMBERS.forEach(m => {
      const btn = document.createElement('button');
      btn.id  = 'dmb_' + m.id;
      btn.style.setProperty('--mc', m.color);
      btn.style.setProperty('--mr', m.rgb);

      const isSelected = (m.id === todaySelected);
      const isLocked   = todaySelected !== null && !isSelected;
      btn.className = 'dmb' + (isSelected ? ' checked' : '') + (isLocked ? ' dmb-locked' : '');

      btn.innerHTML = `<div class="dmb-dot"></div><div class="dmb-name">${m.jp||m.name}</div>`;

      btn.addEventListener('click', () => {
        const result = checkInMember(m.id);
        if(result.action === 'locked') {
          btn.animate(
            [{transform:'translateX(-3px)'},{transform:'translateX(3px)'},
             {transform:'translateX(-2px)'},{transform:'translateX(2px)'},
             {transform:'translateX(0)'}],
            {duration:250, easing:'ease-out'}
          );
          return;
        }
        refreshDailyUI();
        refreshStatusBar();
      });

      grid.appendChild(btn);
    });
    refreshDailyUI();
  } catch (e) {
    console.error('[DailyGrid] Init failed:', e);
  }
}

function refreshDailyUI(){
  try {
    resetDailyIfNeeded();
    const todaySelected = dailyData.members[0] || null;
    const selectedMember = todaySelected ? MEMBERS.find(m=>m.id===todaySelected) : null;

    MEMBERS.forEach(m => {
      const btn = getEl('dmb_' + m.id);
      if(!btn) return;
      const isSelected = (m.id === todaySelected);
      const isLocked   = todaySelected !== null && !isSelected;
      btn.classList.toggle('checked',    isSelected);
      btn.classList.toggle('dmb-locked', isLocked);
      btn.style.opacity = isLocked ? '0.35' : '1';
      btn.style.cursor  = (todaySelected !== null) ? 'not-allowed' : 'pointer';
    });

    const countEl = getEl('dailyCount');
    if(countEl){
      if(todaySelected && selectedMember){
        countEl.textContent = lang==='jp'
          ? `${selectedMember.jp||selectedMember.name} ✓`
          : `${selectedMember.name} ✓`;
        countEl.style.color = selectedMember.color;
      } else {
        countEl.innerHTML = lang==='jp'
          ? '<span class="txt-jp">未選択</span>'
          : '<span class="txt-en">NOT YET</span>';
        countEl.style.color = 'var(--dim)';
      }
    }

    const rfill = getEl('rainbowFill');
    if(rfill){
      if(todaySelected && selectedMember){
        rfill.style.width = '100%';
        rfill.style.setProperty('--fill-color', selectedMember.color);
        rfill.style.background = selectedMember.color;
      } else {
        rfill.style.width = '0%';
        rfill.style.background = '';
      }
    }

    const rcEl = getEl('rainbowCountEl');
    if(rcEl) rcEl.textContent = dailyData.rainbowCount||0;

    const rc = dailyData.rainbowCount||0;
    const rtEl = getEl('rainbowTitle');
    if(rtEl){
      if(rc>=7)      rtEl.textContent = lang==='jp'?'🌈✨ 虹の伝説':'🌈✨ RAINBOW LEGEND';
      else if(rc>=3) rtEl.textContent = lang==='jp'?'🌈🌈 虹の戦士':'🌈🌈 RAINBOW WARRIOR';
      else if(rc>=1) rtEl.textContent = lang==='jp'?'🌈 虹の夢':'🌈 RAINBOW DREAMER';
      else           rtEl.textContent = '';
    }
  } catch (e) {
    console.warn('[DailyUI] Refresh failed:', e);
  }
}

// ════════════════════════════════════════════════
// AUDIO EFFECTS
// ════════════════════════════════════════════════
let _audioCtx = null;
function getAudioCtx(){
  if(!_audioCtx) _audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  return _audioCtx;
}

function playCrowdCheer(duration=4.0, volume=0.18){
  try {
    const ctx = getAudioCtx();
    const out = ctx.destination;
    const bufLen = ctx.sampleRate * duration;
    const buf    = ctx.createBuffer(2, bufLen, ctx.sampleRate);
    for(let ch=0; ch<2; ch++){
      const d = buf.getChannelData(ch);
      for(let i=0; i<bufLen; i++) d[i] = (Math.random()*2-1);
    }
    const noise = ctx.createBufferSource();
    noise.buffer = buf;
    const bp = ctx.createBiquadFilter();
    bp.type      = 'bandpass';
    bp.frequency.value = 1200;
    bp.Q.value   = 0.8;
    const lp = ctx.createBiquadFilter();
    lp.type      = 'lowpass';
    lp.frequency.setValueAtTime(3000, ctx.currentTime);
    lp.frequency.linearRampToValueAtTime(1800, ctx.currentTime + duration*0.7);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(volume, ctx.currentTime + 0.5);
    gain.gain.setValueAtTime(volume, ctx.currentTime + duration*0.6);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.8;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 0.3;
    lfo.connect(lfoGain);
    lfoGain.connect(gain.gain);
    lfo.start();
    lfo.stop(ctx.currentTime + duration);
    noise.connect(bp);
    bp.connect(lp);
    lp.connect(gain);
    gain.connect(out);
    noise.start();
    noise.stop(ctx.currentTime + duration);
  } catch(e){
    console.warn('[Audio] Crowd cheer failed:', e.message);
  }
}

function playSendWhoosh(color){
  try {
    const ctx = getAudioCtx();
    const dur = 0.9;
    const bufLen = ctx.sampleRate * dur;
    const buf    = ctx.createBuffer(1, bufLen, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for(let i=0; i<bufLen; i++) d[i] = (Math.random()*2-1);
    const noise = ctx.createBufferSource(); noise.buffer = buf;
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.setValueAtTime(4000, ctx.currentTime);
    hp.frequency.exponentialRampToValueAtTime(8000, ctx.currentTime + dur*0.6);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.22, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
    noise.connect(hp); hp.connect(gain); gain.connect(ctx.destination);
    noise.start(); noise.stop(ctx.currentTime + dur);
  } catch(e){}
}

function playChargeSound(){
  try {
    const ctx = getAudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(440, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(660, ctx.currentTime + 0.15);
    osc.frequency.exponentialRampToValueAtTime(520, ctx.currentTime + 0.4);
    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
    osc.connect(gain); gain.connect(ctx.destination);
    osc.start(); osc.stop(ctx.currentTime + 0.5);
  } catch(e){}
}

// ════════════════════════════════════════════════
// CHARGE EFFECT
// ════════════════════════════════════════════════
function showChargeEffect(member){
  try {
    const ov  = getEl('chargeOverlay');
    const canvas = getEl('chargeCanvas');
    if(!ov) return;

    ov.style.setProperty('--charge-color', member.color);
    ov.style.setProperty('--charge-bg', `rgba(${member.rgb},.08)`);

    const chargeEmoji = getEl('chargeEmoji');
    if(chargeEmoji){
      chargeEmoji.style.color = member.color;
      chargeEmoji.style.textShadow = `0 0 30px ${member.color}`;
    }

    const chargeMember = getEl('chargeMember');
    if(chargeMember){
      chargeMember.textContent = lang==='jp' ? (member.jp||member.name) : member.name;
      chargeMember.style.color = member.color;
    }

    const chargeMsgJP = getEl('chargeMsgJP');
    const chargeMsgEN = getEl('chargeMsgEN');
    if(chargeMsgJP) chargeMsgJP.textContent = `${member.jp||member.name}の光をチャージしました`;
    if(chargeMsgEN) chargeMsgEN.textContent = `${member.name} LIGHT CHARGED`;

    ov.classList.add('on');
    drawChargeParticles(canvas, member.color);
    playChargeSound();

    setTimeout(()=>{
      ov.classList.remove('on');
    }, 3000);
  } catch (e) {
    console.warn('[ChargeEffect] Failed:', e);
  }
}

function drawChargeParticles(canvas, color){
  try {
    if(!canvas) return;
    const W = window.innerWidth, H = window.innerHeight;
    canvas.width = W; canvas.height = H;
    const ctx = canvas.getContext('2d');
    const cx = W/2, cy = H/2;

    const particles = Array.from({length:40}, (_,i)=>{
      const angle = (i/40)*Math.PI*2;
      const speed = 2 + Math.random()*3;
      return {
        x:cx, y:cy,
        vx: Math.cos(angle)*speed,
        vy: Math.sin(angle)*speed,
        life:1, decay: 0.018+Math.random()*0.012,
        size: 3+Math.random()*5
      };
    });

    let raf;
    function draw(){
      ctx.clearRect(0,0,W,H);
      let alive=false;
      particles.forEach(p=>{
        if(p.life<=0) return;
        p.x+=p.vx; p.y+=p.vy; p.vy+=0.04; p.life-=p.decay;
        ctx.globalAlpha = Math.max(0,p.life);
        ctx.fillStyle = color;
        ctx.shadowBlur = 12; ctx.shadowColor = color;
        ctx.beginPath();
        ctx.arc(p.x,p.y,p.size*p.life,0,Math.PI*2);
        ctx.fill();
        if(p.life>0) alive=true;
      });
      ctx.globalAlpha=1; ctx.shadowBlur=0;
      if(alive) raf=requestAnimationFrame(draw);
    }
    draw();
    setTimeout(()=>{ cancelAnimationFrame(raf); ctx.clearRect(0,0,W,H); },3000);
  } catch (e) {
    console.warn('[ChargeParticles] Failed:', e);
  }
}

// ════════════════════════════════════════════════
// SEND EFFECT
// ════════════════════════════════════════════════
function showSendEffect(member, venueName, dist){
  try {
    const ov     = getEl('sendOverlay');
    const canvas = getEl('sendCanvas');
    if(!ov) return;
    
    const W = window.innerWidth, H = window.innerHeight;
    if(canvas){
      canvas.width=W; canvas.height=H;
    }

    ov.style.setProperty('--send-color', member.color);
    const rgb = member.rgb.split(',').map(x=>parseInt(x));
    ov.style.setProperty('--send-bg', `rgba(${Math.max(0,rgb[0]-180)},${Math.max(0,rgb[1]-180)},${Math.max(0,rgb[2]-60)},.97)`);

    const sendOrb = getEl('sendOrb');
    if(sendOrb) sendOrb.style.filter = `drop-shadow(0 0 40px ${member.color})`;

    playSendWhoosh(member.color);
    drawSendParticles(canvas, member.color);
    ov.classList.add('on');
  } catch (e) {
    console.warn('[SendEffect] Failed:', e);
  }
}

function drawSendParticles(canvas, color){
  try {
    if(!canvas) return;
    const W=canvas.width, H=canvas.height;
    const ctx=canvas.getContext('2d');
    const cx=W/2, cy=H*0.42;

    const streaks = Array.from({length:60},(_,i)=>{
      const angle=(i/60)*Math.PI*2;
      return {
        angle, len:0, maxLen:60+Math.random()*120,
        speed:3+Math.random()*4, life:1, delay:Math.random()*15
      };
    });

    const sparks = Array.from({length:80},(_,i)=>{
      const a=(i/80)*Math.PI*2;
      const spd=1+Math.random()*5;
      return {x:cx,y:cy,vx:Math.cos(a)*spd,vy:Math.sin(a)*spd-2,life:1,decay:.014+Math.random()*.01,size:2+Math.random()*4};
    });

    let frame=0, raf;
    function draw(){
      try {
        ctx.clearRect(0,0,W,H);
        frame++;

        const glowR = Math.min(200, frame*3);
        const grd = ctx.createRadialGradient(cx,cy,0,cx,cy,glowR);
        grd.addColorStop(0,color+'88');
        grd.addColorStop(1,'transparent');
        ctx.fillStyle=grd; ctx.fillRect(0,0,W,H);

        streaks.forEach(s=>{
          if(frame < s.delay) return;
          s.len = Math.min(s.maxLen, s.len+s.speed);
          s.life = Math.max(0, 1-(frame-s.delay)/80);
          if(s.life<=0) return;
          ctx.globalAlpha=s.life*.7;
          ctx.strokeStyle=color;
          ctx.lineWidth=1.5;
          ctx.shadowBlur=8; ctx.shadowColor=color;
          ctx.beginPath();
          ctx.moveTo(cx+Math.cos(s.angle)*20, cy+Math.sin(s.angle)*20);
          ctx.lineTo(cx+Math.cos(s.angle)*s.len, cy+Math.sin(s.angle)*s.len);
          ctx.stroke();
        });

        sparks.forEach(p=>{
          if(p.life<=0) return;
          p.x+=p.vx; p.y+=p.vy; p.vy+=0.06; p.life-=p.decay;
          ctx.globalAlpha=Math.max(0,p.life*.9);
          ctx.fillStyle=color; ctx.shadowBlur=10; ctx.shadowColor=color;
          ctx.beginPath(); ctx.arc(p.x,p.y,p.size*p.life,0,Math.PI*2); ctx.fill();
        });

        ctx.globalAlpha=1; ctx.shadowBlur=0;
        if(frame<120) raf=requestAnimationFrame(draw);
        else { ctx.clearRect(0,0,W,H); }
      } catch (e) {
        console.warn('[SendParticles] Frame error:', e);
      }
    }
    draw();
  } catch (e) {
    console.warn('[SendParticles] Failed:', e);
  }
}

// ════════════════════════════════════════════════
// COUNTDOWN OVERLAY
// ════════════════════════════════════════════════
let countdownTimer = null;
let countdownShownKey = new Set();
try{ JSON.parse(localStorage.getItem('fhts_cdshown')||'[]').forEach(k=>countdownShownKey.add(k)); } catch(e){}

function tryShowCountdown(){
  try {
    if(!targetStop || !targetStop.st) return;
    const sk = showKey(targetStop);
    const diff = new Date(targetStop.st) - new Date();
    if(diff > 0 && diff <= 3600000 && !countdownShownKey.has(sk)){
      countdownShownKey.add(sk);
      localStorage.setItem('fhts_cdshown', JSON.stringify([...countdownShownKey]));
      openCountdownOverlay(targetStop);
    }
  } catch (e) {
    console.warn('[Countdown] tryShow failed:', e);
  }
}

function openCountdownOverlay(stop, isDemo=false){
  try {
    const ov = getEl('countdownOverlay');
    const canvas = getEl('countdownBg');
    if(!ov) return;

    const sm = sentMem(stop);
    const col = sm ? sm.color : activeMember.color;
    ov.style.setProperty('--cd-color', col);

    const venueLine = stop.venue && stop.venue !== 'TBA' ? `${stop.city} · ${stop.venue}` : stop.city;
    const cdVenue = getEl('cdVenue');
    const cdVenueEN = getEl('cdVenueEN');
    if(cdVenue) cdVenue.textContent = venueLine;
    if(cdVenueEN) cdVenueEN.textContent = venueLine;

    const row = getEl('cdPulseRow');
    if(row){
      safeClearElement(row);
      for(let i=0;i<3;i++){
        const d=document.createElement('div');
        d.className='cd-dot';
        d.style.background=col;
        row.appendChild(d);
      }
    }

    ov.classList.add('on');
    drawCountdownBg(canvas, col);
    playCrowdCheer(5.0, 0.18);

    clearInterval(countdownTimer);
    function updateTimer(){
      try {
        const rem = new Date(stop.st) - new Date();
        const cdTimer = getEl('cdTimer');
        if(rem <= 0){
          if(cdTimer) cdTimer.textContent = '00:00:00';
          clearInterval(countdownTimer);
          if(!isDemo) {
            setTimeout(()=> ov.classList.remove('on'), 3000);
          }
          return;
        }
        const h=Math.floor(rem/3600000);
        const m=Math.floor((rem%3600000)/60000);
        const s=Math.floor((rem%60000)/1000);
        if(cdTimer) cdTimer.textContent =
          `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
      } catch (e) {
        console.warn('[Countdown] Timer error:', e);
      }
    }
    updateTimer();
    countdownTimer = setInterval(updateTimer, 1000);

    const closeBtn = getEl('cdClose');
    if(closeBtn){
      const closeHandler = ()=>{
        ov.classList.remove('on');
        clearInterval(countdownTimer);
        closeBtn.removeEventListener('click', closeHandler);
      };
      closeBtn.addEventListener('click', closeHandler);
    }
  } catch (e) {
    console.error('[Countdown] Open failed:', e);
  }
}

function drawCountdownBg(canvas, col){
  try {
    if(!canvas) return;
    const W=window.innerWidth, H=window.innerHeight;
    canvas.width=W; canvas.height=H;
    const ctx=canvas.getContext('2d');
    const r=parseInt(col.slice(1,3)||'5b',16);
    const g=parseInt(col.slice(3,5)||'3f',16);
    const b=parseInt(col.slice(5,7)||'d9',16);
    const grd=ctx.createRadialGradient(W/2,H/2,0,W/2,H/2,Math.max(W,H)*0.8);
    grd.addColorStop(0,`rgba(${r},${g},${b},.5)`);
    grd.addColorStop(0.5,`rgba(${Math.max(0,r-40)},${Math.max(0,g-40)},${Math.max(0,b-40)},.85)`);
    grd.addColorStop(1,'rgba(9,12,19,.98)');
    ctx.fillStyle=grd; ctx.fillRect(0,0,W,H);

    ctx.fillStyle='rgba(255,255,255,.6)';
    for(let i=0;i<80;i++){
      const x=Math.random()*W, y=Math.random()*H, r=Math.random()*1.5;
      ctx.beginPath(); ctx.arc(x,y,r,0,Math.PI*2); ctx.fill();
    }

    for(let i=1;i<=4;i++){
      const rad=i*80;
      ctx.strokeStyle=`rgba(255,255,255,${0.04/i})`;
      ctx.lineWidth=1;
      ctx.beginPath(); ctx.arc(W/2,H/2,rad,0,Math.PI*2); ctx.stroke();
    }
  } catch (e) {
    console.warn('[CountdownBg] Draw failed:', e);
  }
}

function drawArrivalBg(color){
  try {
    const canvas=getEl('arrivalCanvas');
    if(!canvas) return;
    const W=window.innerWidth, H=window.innerHeight;
    canvas.width=W; canvas.height=H;
    const ctx=canvas.getContext('2d');
    const r=parseInt(color.slice(1,3)||'1e',16);
    const g=parseInt(color.slice(3,5)||'17',16);
    const b=parseInt(color.slice(5,7)||'47',16);
    const grd=ctx.createRadialGradient(W/2,H/2,0,W/2,H/2,Math.max(W,H));
    grd.addColorStop(0,`rgba(${r},${g},${b},.6)`);
    grd.addColorStop(1,'rgba(9,12,19,.98)');
    ctx.fillStyle=grd; ctx.fillRect(0,0,W,H);
    for(let i=0;i<60;i++){
      const x=Math.random()*W,y=Math.random()*H,sz=Math.random()*2;
      ctx.fillStyle=`rgba(255,255,255,${Math.random()*.7+.3})`;
      ctx.beginPath(); ctx.arc(x,y,sz,0,Math.PI*2); ctx.fill();
    }
  } catch (e) {
    console.warn('[ArrivalBg] Draw failed:', e);
  }
}

function closeArrival(){
  try {
    const ov = getEl('showtimeOverlay');
    if(ov) ov.classList.remove('on');
  } catch (e) {
    console.warn('[Arrival] Close failed:', e);
  }
}

// ════════════════════════════════════════════════
// TITLE ZONE (Zone 6)
// ════════════════════════════════════════════════
function renderTitleZone(){
  try {
    const {tier,stars,oshi,rainbow}=computeTitles();
    
    const iconEl = getEl('titleIcon');
    const nameEl = getEl('titleName');
    const progEl = getEl('titleProgress');
    const fillEl = getEl('titleProgFill');
    const oshiEl = getEl('subTitleOshi');
    const rbEl = getEl('subTitleRainbow');
    const mbox = getEl('milestoneBox');
    const mtxt = getEl('milestoneTxt');
    const sbStars = getEl('sbStars');
    const sbTitle = getEl('sbTitle');

    if(iconEl) iconEl.textContent = tier.icon || '🌱';
    if(nameEl){
      nameEl.innerHTML = `<span class="txt-jp">${tier.jp||'ルーキー'}</span><span class="txt-en" style="display:none">${tier.en||'ROOKIE'}</span>`;
      if(document.body.classList.contains('lang-en')){
        const jpSpan = nameEl.querySelector('.txt-jp');
        const enSpan = nameEl.querySelector('.txt-en');
        if(jpSpan) jpSpan.style.display='none';
        if(enSpan) enSpan.style.display='';
      }
    }
    if(iconEl) iconEl.textContent=tier.icon;
    if(nameEl) nameEl.textContent=lang==='jp'?tier.jp:tier.en;

    if(tier.next){
      const prev=TITLE_TIERS.find(t=>t.next===tier.next)?.min??0;
      const span=tier.next-prev;
      const done=stars-prev;
      const pct=Math.min(done/span*100,100);
      if(fillEl) fillEl.style.width=pct+'%';
      if(progEl) progEl.textContent=lang==='jp'?`次の称号まで ${tier.next-stars}公演`:`${tier.next-stars} shows to next title`;
    } else {
      if(fillEl) fillEl.style.width='100%';
      if(progEl) progEl.textContent=lang==='jp'?'最高称号達成！':'Maximum title achieved!';
    }

    if(oshiEl){
      if(oshi){oshiEl.textContent=lang==='jp'?oshi.jp:oshi.en;oshiEl.style.color=oshi.color;}
      else{oshiEl.textContent='—';oshiEl.style.color='';}
    }

    if(rbEl){
      if(rainbow){rbEl.textContent=lang==='jp'?rainbow.jp:rainbow.en;}
      else rbEl.textContent='—';
    }

    if(sbStars) sbStars.textContent=stars;
    if(sbTitle) sbTitle.textContent=(lang==='jp'?tier.jp:tier.en).replace(/[🌱⭐💫✨🌟—]/g,'').trim()||tier.icon;

    if(mtxt){
      if(tier.next){
        mtxt.innerHTML=lang==='jp'
          ?`<b>${tier.next-stars}公演</b>で「${TITLE_TIERS.find(t=>t.min===tier.next)?.[lang==='jp'?'jp':'en']||''}」に到達`
          :`<b>${tier.next-stars} more shows</b> to reach <b>${TITLE_TIERS.find(t=>t.min===tier.next)?.en||''}</b>`;
      } else {
        if(mbox) mbox.style.display='none';
      }
    }
  } catch (e) {
    console.warn('[TitleZone] Render failed:', e);
  }
}

// ════════════════════════════════════════════════
// STATUS BAR
// ════════════════════════════════════════════════
function refreshStatusBar(){
  try {
    const pwr=Math.round(getPower());
    setText('sbStreak', powerData.streak+'🔥');
    setText('sbPower', pwr);
    
    const powerFill = getEl('powerFill');
    if(powerFill) powerFill.style.width=pwr+'%';
    
    const powerValText = getEl('powerValText');
    if(powerValText) powerValText.textContent=pwr+' / 100';
    
    setText('streakNum', powerData.streak);
    document.documentElement.style.setProperty('--power',pwr);
    renderTitleZone();
  } catch (e) {
    console.warn('[StatusBar] Refresh failed:', e);
  }
}

// ════════════════════════════════════════════════
// SEND STATE MACHINE
// ════════════════════════════════════════════════
function evaluateSendState(){
  try {
    const btn = getEl('sendBtn');
    const statusEl = getEl('sendStatus');
    if(!btn) return;
    
    if(isSent(targetStop)){
      applySentState(); return;
    }
    if(targetStop.isTBA){
      applyTBAState(); return;
    }
    if(!targetStop.st){
      applyTBAState(); return;
    }
    const diff = new Date(targetStop.st) - new Date();
    if(diff < -7200000){
      applyExpiredState(); return;
    }
    if(diff <= WINDOW_MS || demoMode){
      activateSendReady();
      return;
    }
    applyLockedState();
  } catch (e) {
    console.warn('[SendState] Evaluation failed:', e);
  }
}

function applyLockedState(){
  try {
    sendReady=false;
    const b=getEl('sendBtn');
    const statusEl = getEl('sendStatus');
    if(b) b.className='locked';
    refreshStep(1);
    updateSendBtnText();
  } catch (e) {
    console.warn('[SendState] applyLocked failed:', e);
  }
}

function applyTBAState(){
  try {
    sendReady=false;
    const b=getEl('sendBtn');
    if(b) b.className='tba-lock';
    refreshStep(1);
    updateSendBtnText();
  } catch (e) {
    console.warn('[SendState] applyTBA failed:', e);
  }
}

function applyExpiredState(){
  try {
    sendReady=false;
    const b=getEl('sendBtn');
    if(b) b.className='locked';
    refreshStep(1);
    updateSendBtnText();
  } catch (e) {
    console.warn('[SendState] applyExpired failed:', e);
  }
}

function applySentState(){
  try {
    sendReady=false;
    const b=getEl('sendBtn');
    if(b) b.className='sent';
    refreshStep(3);
    updateSendBtnText();
  } catch (e) {
    console.warn('[SendState] applySent failed:', e);
  }
}

function activateSendReady(){
  try {
    if(isSent(targetStop)) return;
    sendReady=true;
    const b=getEl('sendBtn');
    if(b) b.className='ready';
    refreshStep(2);
    updateSendStyle();
    updateSendBtnText();
  } catch (e) {
    console.warn('[SendState] activateReady failed:', e);
  }
}

function refreshStep(forceStep){
  try {
    const statusEl = getEl('sendStatus');
    if(!statusEl) return;
    const step = forceStep || (sendReady?2:isSent(targetStop)?3:1);
    const diff2 = targetStop.st ? new Date(targetStop.st)-new Date() : null;
    if(step===3){
      statusEl.textContent = lang==='jp'?'✦ 光を送信済み · 開演時刻に点灯します':'✦ Light sent · Will glow at showtime';
      statusEl.style.color = 'var(--green)';
    } else if(step===2){
      const m = diff2!=null ? Math.max(0,Math.floor(diff2/60000)) : 0;
      statusEl.textContent = lang==='jp'?`✦ 送信可能 · 開演まで${m}分`:`✦ WINDOW OPEN · ${m}min to showtime`;
      statusEl.style.color = 'var(--purple)';
    } else {
      if(targetStop.isTBA){
        statusEl.textContent = lang==='jp'?'会場・開演時間 発表待ち':'VENUE & TIME TBA';
        statusEl.style.color = 'var(--dim)';
      } else if(diff2!=null&&diff2<0){
        statusEl.textContent = lang==='jp'?'この公演は終了しました':'This show has ended';
        statusEl.style.color = 'var(--dim)';
      } else {
        const h = diff2!=null ? Math.ceil(diff2/3600000) : null;
        statusEl.textContent = lang==='jp'
          ?(h!=null&&h<=24?`開演${h}時間前 · あと${h-1}時間で送信可`:'開演1時間前に送信可能')
          :(h!=null&&h<=24?`${h}h to show · opens in ${h-1}h`:'Unlocks 1h before showtime');
        statusEl.style.color = 'var(--dim)';
      }
    }
  } catch (e) {
    console.warn('[SendState] refreshStep failed:', e);
  }
}

function updateSendBtnText(){
  try {
    const btn=getEl('sendBtn');
    if(!btn) return;
    const cls=btn.className;
    const diff2=targetStop.st?new Date(targetStop.st)-new Date():null;
    const expired=diff2!==null&&diff2<0&&!isSent(targetStop);
    
    if(cls==='ready'){
      const m=diff2!=null?Math.max(0,Math.floor(diff2/60000)):0;
      const pwr=Math.round(getPower());
      btn.textContent=lang==='jp'?`✦ 光を送る · ${activeMember.jp}カラー · 残${m}分 · PWR${pwr}`:`✦ SHOOT LIGHT · ${activeMember.name} · ${m}min · PWR${pwr}`;
    } else if(cls==='sent'){
      const sm=sentMem(targetStop)||activeMember;
      btn.textContent=lang==='jp'?`✦ ${sm.jp||sm.name}カラーで送信済み · 次の公演でも送れます`:`✦ Sent as ${sm.name} · Available at next show`;
    } else if(cls==='tba-lock'){
      btn.textContent=lang==='jp'?'⏳ 会場・開演時間 発表待ち':'⏳ VENUE & TIME TBA';
    } else if(expired){
      btn.textContent=lang==='jp'?'— この公演は終了しました':'— This show has ended';
    } else {
      const h=diff2!=null?Math.ceil(diff2/3600000):null;
      btn.textContent=lang==='jp'?(h!=null&&h<=24?`🔒 あと${h-1}時間で送信ウィンドウが開きます`:'🔒 開演1時間前に送信可能'):(h!=null&&h<=24?`🔒 Window opens in ${h-1}h`:'🔒 UNLOCKS 1H BEFORE SHOWTIME');
    }
  } catch (e) {
    console.warn('[SendBtn] Update text failed:', e);
  }
}

function updateSendStyle(){
  try {
    const btn=getEl('sendBtn');
    if(!btn || btn.className!=='ready') return;
    btn.style.background=`linear-gradient(135deg,${activeMember.color},${activeMember.color}77)`;
    btn.style.boxShadow=`0 4px 28px ${activeMember.color}55`;
    btn.style.color='#000';
    updateSendBtnText();
  } catch (e) {
    console.warn('[SendStyle] Update failed:', e);
  }
}

// ════════════════════════════════════════════════
// LIGHT JOURNEY DESCRIPTION
// ════════════════════════════════════════════════
function oceanName(fLa,fLo,tLa,tLo){
  try {
    const mLo=(fLo+tLo)/2,mLa=(fLa+tLa)/2,lDiff=Math.abs(tLo-fLo);
    if(lDiff>150||(mLo<-60&&mLo>-180&&mLa>0))return{jp:'太平洋上を移動中',en:'crossing the Pacific Ocean'};
    if(mLo>-60&&mLo<20&&mLa>0)return{jp:'大西洋上を移動中',en:'crossing the Atlantic Ocean'};
    if(mLo>20&&mLo<120&&mLa>10)return{jp:'ユーラシア大陸上空を移動中',en:'crossing Eurasia'};
    if(mLo>60&&mLo<120&&mLa<10)return{jp:'インド洋上を移動中',en:'crossing the Indian Ocean'};
    return{jp:'上空を移動中',en:'on its way'};
  } catch (e) {
    return{jp:'上空を移動中',en:'on its way'};
  }
}

// ════════════════════════════════════════════════
// SEND
// ════════════════════════════════════════════════
async function doSend(){
  try {
    if(!sendReady||isSent(targetStop))return;
    const btn=getEl('sendBtn');
    if(!btn) return;

    const origText = btn.textContent;
    btn.textContent = lang==='jp' ? '⟳ 確認中…' : '⟳ CHECKING…';
    btn.style.cursor = 'wait'; btn.disabled = true;

    const wKey   = showKey(targetStop);
    const sdsResult = await SDS.checkAndSend(wKey, activeMember.id);

    btn.style.cursor = ''; btn.disabled = false;

    if(!sdsResult.ok) {
      markSent(targetStop, activeMember, getPower());
      sendReady = false; applySentState();
      const reason = sdsResult.reason;
      const msg = lang==='jp'
        ? (reason === 'invalid_signature'
            ? 'セキュリティエラー。ページを再読み込みしてください。'
            : 'この公演にはすでに光を送っています。\n次の公演でまた送れます。')
        : (reason === 'invalid_signature'
            ? 'Security error. Please reload the page.'
            : 'You already sent your light for this show.\nSend again at the next show!');
      alert(msg);
      return;
    }

    const pwr = getPower();
    markSent(targetStop, activeMember, pwr);
    energyCount++;

    const fLa=geoGranted&&userLat?userLat:routeFrom.lat;
    const fLo=geoGranted&&userLng?userLng:routeFrom.lng;
    const dist=Math.round(hav(fLa,fLo,targetStop.lat,targetStop.lng));
    const ocean=oceanName(fLa,fLo,targetStop.lat,targetStop.lng);

    const sendMsg=getEl('sendMsg');
    const journeyDesc=getEl('journeyDesc');
    const powerBonus=getEl('powerBonus');
    
    if(sendMsg) sendMsg.textContent=lang==='jp'
      ?`${activeMember.jp||activeMember.name}の光を送りました`
      :`${activeMember.name}'S LIGHT IS ON ITS WAY`;

    if(journeyDesc) journeyDesc.textContent=lang==='jp'
      ?`${ocean.jp}\n${dist.toLocaleString()} km 先の ${targetStop.city} へ`
      :`${ocean.en}\n${dist.toLocaleString()} km to ${targetStop.city}`;

    if(powerBonus) powerBonus.textContent=lang==='jp'
      ?`⚡ POWER ${Math.round(pwr)} · 光の強度 +${Math.round(pwr/100*100)}%`
      :`⚡ POWER ${Math.round(pwr)} · Intensity +${Math.round(pwr/100*100)}%`;

    showSendEffect(activeMember, targetStop.city, dist);

    setTimeout(()=>{
      const sendOverlay = getEl('sendOverlay');
      if(sendOverlay) sendOverlay.classList.remove('on');
      sendReady=false; applySentState();
      const sm=sentMem(targetStop);
      const tSent=getEl('tSent');
      const tSentTxt=getEl('tSentTxt');
      if(sm && tSent && tSentTxt){
        tSentTxt.innerHTML=
          `<span class="txt-jp">${sm.jp||sm.name}カラーで光を送信済み</span>`
          +`<span class="txt-en">Light sent as ${sm.name}</span>`;
        tSent.classList.add('on');
      }
      refreshCardSent();
      const eCount = getEl('eCount');
      if(eCount) eCount.textContent=energyCount.toLocaleString();
      drawEnergy(); renderTitleZone(); refreshStatusBar();
      if(geoGranted&&userLat) updateCompassFromUser();
    }, 4000);
  } catch (e) {
    console.error('[Send] doSend failed:', e);
    const btn=getEl('sendBtn');
    if(btn) {
      btn.style.cursor = '';
      btn.disabled = false;
    }
  }
}

// ════════════════════════════════════════════════
// SEND BUTTON INIT
// ════════════════════════════════════════════════
function initSendBtn(){
  try {
    const btn = getEl('sendBtn');
    if(btn) btn.addEventListener('click', doSend);
    evaluateSendState();

    let tc=0, tt;
    const livePill = getEl('livePill');
    if(livePill){
      livePill.addEventListener('click',()=>{
        clearTimeout(tt); tc++;
        if(tc>=3){
          tc=0; demoMode=true;
          const dh=getEl('demoHint');
          if(dh){
            dh.textContent=lang==='jp'?'✦ デモ ON':'✦ DEMO ON';
            dh.style.color='var(--gold)';
          }
          activateSendReady();
        }
        tt=setTimeout(()=>tc=0,1000);
      });
    }
  } catch (e) {
    console.error('[SendBtn] Init failed:', e);
  }
}

// ════════════════════════════════════════════════
// COUNTDOWN
// ════════════════════════════════════════════════
function fmt(ms){
  try {
    if(ms===null)return lang==='jp'?'発表待ち':'TBA';
    if(ms<=0)return lang==='jp'?'開演中！':'SHOWTIME!';
    const d=Math.floor(ms/86400000),h=Math.floor((ms%86400000)/3600000),m=Math.floor((ms%3600000)/60000);
    if(lang==='jp')return d>0?`${d}日 ${h}時間 ${m}分`:h>0?`${h}時間 ${m}分`:`${m}分`;
    return d>0?`${d}d ${h}h`:h>0?`${h}h ${m}m`:`${m}m`;
  } catch (e) {
    return lang==='jp'?'--':'--';
  }
}

function updateCountdown(){
  try {
    const diff=new Date('2026-04-09T19:00:00+09:00')-new Date();
    const s=fmt(Math.max(diff,0));
    setText('mainCnt', s);
  } catch (e) {
    console.warn('[Countdown] Update failed:', e);
  }
}

function updateShowtime(){
  try {
    const _fresh = findNextTarget();
    if(_fresh && _fresh !== targetStop && !demoMode){
      const _fi = TOUR.indexOf(_fresh);
      selectStop(_fresh, _fi);
    }
    const showtimeCnt = getEl('showtimeCnt');
    if(!targetStop.st){
      if(showtimeCnt) showtimeCnt.textContent=fmt(null);
      return;
    }
    const diff=new Date(targetStop.st)-new Date();
    if(showtimeCnt) showtimeCnt.textContent=fmt(diff);
    if(!isSent(targetStop)&&!targetStop.isTBA){
      if(diff>0&&diff<=WINDOW_MS&&!sendReady)activateSendReady();
      if(diff<=0&&sendReady)applyExpiredState();
    }
    checkShowtimeArrival();
  } catch (e) {
    console.warn('[Showtime] Update failed:', e);
  }
}

function checkShowtimeArrival(){
  try {
    const now=new Date();
    TOUR.forEach(v=>{
      if(!isSent(v)||!v.st)return;
      const k=showKey(v);if(shownArrival.has(k))return;
      const diff=now-new Date(v.st);
      if(diff>=0&&diff<=10*60*1000){
        shownArrival.add(k);
        localStorage.setItem('bts_lr_arr',JSON.stringify([...shownArrival]));
        const sm=sentMem(v);
        const el=getEl('showtimeVenue');
        if(el){
          el.textContent=`${v.city} · ${v.venue}`;
          if(sm)el.style.color=sm.color;
        }
        const ov=getEl('showtimeOverlay');
        if(ov) ov.classList.add('on');
      }
    });
  } catch (e) {
    console.warn('[Showtime] Check arrival failed:', e);
  }
}

// ════════════════════════════════════════════════
// SHARE
// ════════════════════════════════════════════════
function buildShareCanvas(){
  try {
    const c=getEl('shareCanvas'),ctx=c?c.getContext('2d'):null;
    if(!c || !ctx) return;
    const W=600,H=280;
    const bg=ctx.createLinearGradient(0,0,W,H);bg.addColorStop(0,'#EEF0FF');bg.addColorStop(1,'#E8EAFF');
    ctx.fillStyle=bg;ctx.fillRect(0,0,W,H);
    for(let i=0;i<95;i++){ctx.fillStyle=`rgba(255,255,255,${(Math.random()*.2+.04).toFixed(2)})`;ctx.beginPath();ctx.arc(Math.random()*W,Math.random()*H,Math.random()*1.3,0,Math.PI*2);ctx.fill();}
    ctx.strokeStyle='rgba(155,114,240,.12)';ctx.lineWidth=.8;
    for(let lo=-180;lo<=180;lo+=30){ctx.beginPath();const x=((lo+180)/360)*(W-36)+18;ctx.moveTo(x,0);ctx.lineTo(x,H);ctx.stroke();}
    for(let la=-60;la<=90;la+=30){ctx.beginPath();const y=((90-la)/180)*(H-36)+18;ctx.moveTo(0,y);ctx.lineTo(W,y);ctx.stroke();}
    const pts=gc(routeFrom.lat,routeFrom.lng,routeTo.lat,routeTo.lng,120);
    const segs=[];let cur=[];
    pts.forEach(([la,lo],j)=>{if(j>0&&Math.abs(lo-pts[j-1][1])>180){segs.push(cur);cur=[];}cur.push([la,lo]);});segs.push(cur);
    const pwr=getPower(),lw=1.5+(pwr/100)*2;
    segs.forEach(seg=>{if(seg.length<2)return;ctx.beginPath();let ff=true;seg.forEach(([la,lo])=>{const x=((lo+180)/360)*(W-36)+18,y=((90-la)/180)*(H-36)+18;if(ff){ctx.moveTo(x,y);ff=false;}else ctx.lineTo(x,y);});ctx.shadowBlur=12;ctx.shadowColor=activeMember.color;ctx.strokeStyle=activeMember.color+'cc';ctx.lineWidth=lw;ctx.setLineDash([6,6]);ctx.stroke();ctx.setLineDash([]);ctx.shadowBlur=0;});
    [[routeFrom,'#EAC130'],[routeTo,activeMember.color]].forEach(([v,col])=>{const x=((v.lng+180)/360)*(W-36)+18,y=((90-v.lat)/180)*(H-36)+18;ctx.shadowBlur=14;ctx.shadowColor=col;ctx.fillStyle=col;ctx.beginPath();ctx.arc(x,y,5,0,Math.PI*2);ctx.fill();ctx.shadowBlur=0;ctx.fillStyle='rgba(255,255,255,.85)';ctx.font='bold 11px Chakra Petch,monospace';ctx.fillText(v.city,x+9,y+4);});
    ctx.font='bold 27px Chakra Petch,monospace';ctx.fillStyle='#D4AF37';ctx.shadowBlur=16;ctx.shadowColor='rgba(176,125,16,.5)';ctx.fillText('✦ FHTS',20,42);ctx.shadowBlur=0;
    ctx.font='9px Chakra Petch,monospace';ctx.fillStyle='rgba(255,255,255,.3)';ctx.fillText('LIGHT ROUTE · GLOBAL EDITION 2026–27',20,58);
    const b2=Math.round(brng(routeFrom.lat,routeFrom.lng,routeTo.lat,routeTo.lng)),d2=Math.round(hav(routeFrom.lat,routeFrom.lng,routeTo.lat,routeTo.lng));
    ctx.fillStyle='rgba(255,255,255,.2)';ctx.font='9px Chakra Petch,monospace';ctx.fillText(`${b2}° · ${d2.toLocaleString()} km · #BTSLightRoute`,20,H-14);
    const {tier}=computeTitles();
    ctx.fillStyle=activeMember.color;ctx.font='bold 10px Chakra Petch,monospace';
    const tag=`${lang==='jp'?activeMember.jp:activeMember.name} · ${lang==='jp'?tier.jp:tier.en}`.replace(/[🌱⭐💫✨🌟—]/g,'').trim();
    ctx.fillText(tag,W-20-ctx.measureText(tag).width,H-14);
  } catch (e) {
    console.warn('[Share] Build canvas failed:', e);
  }
}

function initShare(){
  try {
    const modal=getEl('shareModal');
    const shareBtn = getEl('shareBtn');
    const closeShare = getEl('closeShare');
    
    if(shareBtn) shareBtn.addEventListener('click',()=>{buildShareCanvas();if(modal)modal.classList.add('on');});
    if(closeShare) closeShare.addEventListener('click',()=>{if(modal)modal.classList.remove('on');});
    if(modal) modal.addEventListener('click',e=>{if(e.target===modal)modal.classList.remove('on');});
    
    document.querySelectorAll('.spbtn').forEach(btn=>{
      if(!btn) return;
      btn.addEventListener('click',async()=>{
        try{
          const sc=getEl('shareCanvas');
          if(!sc) return;
          const blob=await new Promise(r=>sc.toBlob(r,'image/png')),file=new File([blob],'bts-light-route.png',{type:'image/png'}),text=`✦ BTS LIGHT ROUTE · ${routeFrom.city.toUpperCase()} → ${routeTo.city.toUpperCase()} · #BTSLightRoute`;
          if(navigator.share&&navigator.canShare({files:[file]}))await navigator.share({files:[file],text});
          else{
            const a=document.createElement('a');
            a.href=sc.toDataURL('image/png');
            a.download='bts-light-route.png';
            a.click();
          }
        }catch{
          const sc=getEl('shareCanvas');
          if(!sc) return;
          const a=document.createElement('a');
          a.href=sc.toDataURL('image/png');
          a.download='bts-light-route.png';
          a.click();
        }
      });
    });
  } catch (e) {
    console.error('[Share] Init failed:', e);
  }
}

// ════════════════════════════════════════════════
// INIT
// ════════════════════════════════════════════════
async function init(){
  try {
    const langBtn = getEl('langBtn');
    if(langBtn) langBtn.addEventListener('click', toggleLang);
    
    await Sec.init();

    powerData = await Sec.load(POWER_KEY, {lastDate:'',streak:0,total:0});
    dailyData  = await Sec.load(DAILY_KEY, {date:'',members:[],rainbowCount:0});

    recordDailyVisit();
    resetDailyIfNeeded();

    initMapCanvas();
    initEnergyCanvas();

    initCards();
    
    if(typeof resizeMap === 'function') resizeMap();
    if(mc && mc.width === 0 && mc.parentElement){ mc.width = mc.parentElement.offsetWidth || 358; mc.height = 200; }
    window.addEventListener('resize', ()=>{ 
      try {
        if(typeof resizeMap === 'function') resizeMap(); 
      } catch (e) {
        console.warn('[Resize] Handler error:', e);
      }
    });
    
    initCompass();
    initMemberSel();
    initDailyGrid();
    initSendBtn();
    initShare();

    const _nt  = findNextTarget();
    const _ni  = TOUR.indexOf(_nt);
    const _pi  = Math.max(0, _ni - 1);
    setRoute(TOUR[_pi], _nt);
    applyTheme(activeMember);
    selectStop(_nt, _ni);

    refreshStatusBar();
    refreshDailyUI();
    renderTitleZone();

    requestAnimationFrame(loopMap);
    drawEnergy();
    updateCountdown();
    updateShowtime();
    setInterval(updateCountdown, 30000);
    setInterval(updateShowtime,  60000);
    setInterval(drawEnergy, 120);
    setInterval(()=>{
      try {
        energyCount += Math.floor(Math.random()*4)+1;
        const el = getEl('eCount');
        if(el) el.textContent = energyCount.toLocaleString();
      } catch (e) {
        console.warn('[Energy] Interval error:', e);
      }
    }, 3200);

    checkShowtimeArrival();
  } catch (e) {
    console.error('[Init] Fatal error:', e);
  }
}

// ════════════════════════════════════════════════
// GA4 ANALYTICS MODULE
// ════════════════════════════════════════════════
const GA = {
  CONSENT_KEY: 'bts_lr_consent_v1',

  init() {
    try {
      const saved = localStorage.getItem(this.CONSENT_KEY);
      const banner = getEl('consentBanner');
      if(saved === 'granted') {
        this.grant(false);
      } else if(saved === 'denied') {
        // keep hidden
      } else {
        if(banner) banner.classList.add('show');
      }

      const cbAccept = getEl('cbAccept');
      const cbDecline = getEl('cbDecline');
      const privacyLink = getEl('privacyLink');
      
      if(cbAccept) cbAccept.addEventListener('click', () => this.grant(true));
      if(cbDecline) cbDecline.addEventListener('click', () => this.deny());
      if(privacyLink) privacyLink.addEventListener('click', () => {
        if(banner) banner.classList.add('show');
      });
    } catch (e) {
      console.warn('[GA] Init failed:', e);
    }
  },

  grant(save = true) {
    try {
      if(save) localStorage.setItem(this.CONSENT_KEY, 'granted');
      gtag('consent', 'update', { analytics_storage: 'granted' });
      const banner = getEl('consentBanner');
      if(banner) banner.classList.remove('show');
      gtag('event', 'page_view', {
        page_title:    'BTS Light Route',
        page_location: location.href,
      });
    } catch (e) {
      console.warn('[GA] Grant failed:', e);
    }
  },

  deny() {
    try {
      localStorage.setItem(this.CONSENT_KEY, 'denied');
      gtag('consent', 'update', { analytics_storage: 'denied' });
      const banner = getEl('consentBanner');
      if(banner) banner.classList.remove('show');
    } catch (e) {
      console.warn('[GA] Deny failed:', e);
    }
  },

  track(eventName, params = {}) {
    try { gtag('event', eventName, params); } catch(e) {}
  },

  trackSendLight(venue, city, memberName, power, daysToShow) {
    this.track('send_light', {
      venue_city:    city,
      member_name:   memberName,
      power_level:   Math.round(power),
      days_to_show:  daysToShow,
    });
  },

  trackDailyCheckin(memberId, checkinCount) {
    this.track('daily_checkin', {
      member_id:     memberId,
      daily_count:   checkinCount,
    });
  },

  trackRainbow(totalRainbows, streakDays) {
    this.track('rainbow_achieved', {
      total_rainbows: totalRainbows,
      streak_days:    streakDays,
    });
  },

  trackTitleEarned(titleEn, totalStars) {
    this.track('title_earned', {
      title:       titleEn,
      total_stars: totalStars,
    });
  },

  trackGeoGranted() {
    this.track('geo_permission_granted');
  },

  trackLangSwitch(to) {
    this.track('language_switch', { to_lang: to });
  },

  trackShare(platform) {
    this.track('share_route_image', { platform });
  },
};

window.addEventListener('DOMContentLoaded', () => { 
  try {
    init(); 
    GA.init(); 
  } catch (e) {
    console.error('[Bootstrap] Fatal error:', e);
  }
});