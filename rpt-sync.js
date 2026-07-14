/*
 * rpt-sync.js — Pull today's Rod Pump Tracker data and publish rpt-feed.json
 * -------------------------------------------------------------------------
 * WHY THIS RUNS ON A SERVER (not in the app):
 *   The RPT API takes the username & password IN THE URL. If the browser app
 *   called it directly, anyone using the app could read those credentials and
 *   pull every operator's data. This script keeps the credentials server-side,
 *   calls RPT, converts the result to the app's rpt-feed.json format, and
 *   writes that file. You then publish rpt-feed.json next to the app.
 *
 * REQUIREMENTS: Node.js 18+ (uses built-in fetch). No npm install needed.
 *
 * RUN:
 *   node rpt-sync.js
 *   node rpt-sync.js 2026-07-06        (specific date)
 *
 * CONFIG: set these as environment variables (preferred) or edit below.
 *   RPT_USER, RPT_PASS, RPT_DATE_FMT, RPT_OUT
 */

const USER = process.env.RPT_USER || 'postauto';
const PASS = process.env.RPT_PASS || 'Postauto0226';
const OUT  = process.env.RPT_OUT  || 'rpt-feed.json';
const BASE = 'https://www.rodpumptracker.com/api';

// RPT's date format is unconfirmed. Try these in order until one returns data.
const DATE_FORMATS = ['YYYY-MM-DD', 'MM-DD-YYYY', 'M/D/YYYY'];

function fmtDate(d, fmt) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  if (fmt === 'YYYY-MM-DD') return `${y}-${m}-${day}`;
  if (fmt === 'MM-DD-YYYY') return `${m}-${day}-${y}`;
  if (fmt === 'M/D/YYYY') return `${d.getMonth() + 1}/${d.getDate()}/${y}`;
  return `${y}-${m}-${day}`;
}

async function getJson(url) {
  const res = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url.replace(PASS, '***')}`);
  const text = await res.text();
  try { return JSON.parse(text); }
  catch (e) { throw new Error(`Non-JSON response: ${text.slice(0, 120)}`); }
}

// Pull a value from an object trying several possible key names (case-insensitive).
function pick(obj, names, dflt) {
  if (!obj) return dflt;
  const lower = {};
  for (const k of Object.keys(obj)) lower[k.toLowerCase()] = obj[k];
  for (const n of names) {
    const v = lower[n.toLowerCase()];
    if (v !== undefined && v !== null && v !== '') return v;
  }
  return dflt;
}

// Map RPT's Status/PumpStatus to the app's tone + label.
function statusInfo(rec) {
  const s = String(pick(rec, ['Status', 'status'], '')).toLowerCase();
  const ps = String(pick(rec, ['PumpStatus', 'pumpStatus'], '')).toLowerCase();
  const failed = String(pick(rec, ['PrimaryFailureReason'], 'None')) !== 'None';
  if (/pull|pending/.test(s) || /pull|pending/.test(ps)) return { label: pick(rec, ['Status'], 'Pulled'), tone: 'warn' };
  if (failed || /fail|down|off/.test(s) || /fail|down|off/.test(ps)) return { label: pick(rec, ['Status'], 'Down'), tone: 'bad' };
  if (/run/.test(s) || /run/.test(ps)) return { label: pick(rec, ['Status'], 'Run'), tone: 'ok' };
  return { label: pick(rec, ['Status'], '—'), tone: 'ok' };
}
function isoDay(v) { return (v && !String(v).startsWith('0001')) ? String(v).slice(0, 10) : ''; }
function daysSince(v) { const d = isoDay(v); if (!d) return null; const n = Math.round((Date.now() - new Date(d + 'T12:00:00').getTime()) / 86400000); return n >= 0 ? n : null; }
function maxDaysRan(list) { let m = 0; (list || []).forEach(c => { const n = parseInt(c.DaysRanString, 10); if (!isNaN(n) && n > m) m = n; }); return m || null; }

/* =====================================================================
 * FIELD MAPPING — tuned to the real RodPumpTracker DataPackage response.
 * Each record is a pump run/repair record for a well.
 * ===================================================================== */
function mapRecord(rec) {
  const ow = rec.OilWell || {};
  const st = statusInfo(rec);
  return {
    name: pick(rec, ['WellName'], '') || ow.WellName || 'Well',
    api: pick(rec, ['WellApi'], '') || ow.WellApi || '',
    operator: ow.Operatorr || ow.Operator || pick(rec, ['Operator'], ''),
    lease: ow.Lease || '', field: ow.FieldName || '',
    county: [ow.County, ow.State].filter(Boolean).join(', '),
    contact: pick(rec, ['Contact'], ''),
    statusRaw: st.label, tone: st.tone,
    runDate: isoDay(pick(rec, ['RunDate'], '')),
    repairDate: isoDay(pick(rec, ['RepairDate'], '')),
    runDays: daysSince(pick(rec, ['RunDate'], '')),
    lastRunLife: maxDaysRan(rec.SrComponentList),
    apiDesignation: pick(rec, ['ApiDescription', 'ApiDescriptionOverride'], ''),
    pumpType: pick(rec, ['PumpType'], ''),
    pumpNo: pick(rec, ['PumpNoRan', 'PumpNo'], ''),
    plunger: pick(rec, ['PlungerSize'], null),
    tubing: pick(rec, ['TubingSize'], null),
    strokeLen: pick(rec, ['StrokeLen'], null),
    shop: pick(rec, ['ShopId'], ''),
    serial: pick(rec, ['Serial'], ''),
    failureReason: (function(){ const p = pick(rec, ['PrimaryFailureReason'], 'None'); if (p && p !== 'None') return p; const a = pick(rec, ['ActualReasonPulledDescription'], 'None'); return (a && a !== 'None') ? a : 'None'; })(),
    reasonPulled: (function(){ const a = pick(rec, ['ActualReasonPulledDescription'], 'None'); if (a && a !== 'None') return a; const b = pick(rec, ['ReasonPulledDescription'], 'None'); return (b && b !== 'None') ? b : ''; })(),
    pumpFit: pick(rec, ['PumpFit'], ''),
    pinSize: pick(rec, ['PinSize'], null),
    fishNeck: pick(rec, ['FishNeckSize'], null),
    gacThread: pick(rec, ['GacThreadSize'], null),
    valveRod: pick(rec, ['ValveRodSize'], ''),
    pullTube: pick(rec, ['PullTubeSize'], ''),
    perfDepth: (ow.PerforationsDepth || null),
    components: (rec.SrComponentList || []).map(c => ({ name: c.ComponentName, metal: c.Metallurgy, days: c.DaysRanString, fail: c.FailureCode })).filter(c => c.name),
  };
}

// Group all records per well, keep full history (newest first); current = latest.
function dedupeLatest(wells) {
  const groups = {};
  for (const w of wells) { const k = w.api || w.name; (groups[k] = groups[k] || []).push(w); }
  return Object.values(groups).map(function(recs){
    recs.sort(function(a,b){ return (b.runDate||'').localeCompare(a.runDate||''); });
    const cur = Object.assign({}, recs[0]);
    cur.history = recs.map(function(r){ return { runDate:r.runDate, repairDate:r.repairDate, apiDesignation:r.apiDesignation, pumpType:r.pumpType, statusRaw:r.statusRaw, tone:r.tone, lastRunLife:r.lastRunLife, failureReason:r.failureReason, reasonPulled:r.reasonPulled, shop:r.shop, serial:r.serial, components:r.components }; });
    return cur;
  }).sort(function(a,b){ return (a.operator||'').localeCompare(b.operator||'') || (a.name||'').localeCompare(b.name||''); });
}

// Find the array of well records wherever RPT nests it.
function extractRecords(pkg) {
  if (Array.isArray(pkg)) return pkg;
  for (const k of ['wells', 'data', 'items', 'records', 'results', 'list', 'value']) {
    if (Array.isArray(pkg[k])) return pkg[k];
  }
  // one level deeper
  for (const k of Object.keys(pkg)) {
    if (pkg[k] && typeof pkg[k] === 'object') {
      for (const kk of ['wells', 'data', 'items', 'records']) {
        if (Array.isArray(pkg[k][kk])) return pkg[k][kk];
      }
    }
  }
  return [];
}

async function main() {
  const fs = require('fs');
  const dateArg = process.argv[2];
  const baseDay = dateArg ? new Date(dateArg + 'T12:00:00') : new Date();
  // Sweep a range of days and MERGE every record (RPT returns per-day results).
  // Default pulls ~5 years of history. Override with RPT_DAYS to change the window.
  const RANGE = parseInt(process.env.RPT_DAYS || '1825', 10);
  const days = [];
  for (let i = 0; i < RANGE; i++) days.push(new Date(baseDay.getTime() - i * 86400000));

  const U = encodeURIComponent(USER), P = encodeURIComponent(PASS);
  const ENDPOINTS = ['DataPackage/GetDataDay'];
  function candidates(ep, ds) {
    const d = encodeURIComponent(ds);
    return [
      `${BASE}/${ep}?vUsername=${U}&vPassword=${P}&vDate=${d}`,
      `${BASE}/${ep}/${U}/${P}/${d}`,
    ];
  }

  const all = [];           // every raw record across all days
  let anyOk = false, daysWithData = 0;
  const summary = [];
  for (const ep of ENDPOINTS) {
    for (const day of days) {
      const ds = fmtDate(day, 'YYYY-MM-DD');
      for (const url of candidates(ep, ds)) {
        try {
          const data = await getJson(url);
          anyOk = true;
          const recs = extractRecords(data);
          if (recs.length) { all.push.apply(all, recs); daysWithData++; summary.push(`  ${ds}: ${recs.length} records`); }
          break; // this URL style worked for this date; move to next date
        } catch (e) {
          if (url.includes('?')) { /* try path style next */ }
          else summary.push(`  ${ds}: ${e.message}`);
        }
      }
    }
  }
  console.log(`Pulled ${all.length} records across ${daysWithData} day(s) in the last ${RANGE}.`);
  if (summary.length) console.log(summary.slice(0, 40).join('\n'));

  if (!anyOk) { console.error('No response from RPT. Check credentials / network.'); process.exit(1); }

  // Save the raw merged records so field names / operators can be confirmed.
  fs.writeFileSync('rpt-raw.json', JSON.stringify(all, null, 2));
  console.log('Saved raw merged records to rpt-raw.json');

  const wells = dedupeLatest(all.map(mapRecord));

  const feed = {
    customer: 'All Wells',
    updated: new Date().toISOString(),
    accounts: loadAccounts(fs),
    wells,
  };
  fs.writeFileSync(OUT, JSON.stringify(feed, null, 2));
  console.log(`Wrote ${OUT} with ${wells.length} wells across ${new Set(wells.map(w=>w.operator).filter(Boolean)).size} operator(s).`);
  if (!wells.length) {
    console.log('\n⚠️  No wells returned across the whole range.');
    console.log('   Login + API address work (server replied). Likely the "postauto" account');
    console.log('   is not linked to wells yet — ask RodPumpTracker support to assign operators to it.');
  }
}

// Keep your operator/login assignments in accounts.json so re-syncs preserve them.
function loadAccounts(fs) {
  try { return JSON.parse(fs.readFileSync('accounts.json', 'utf8')); }
  catch (e) {
    return {
      'propilot@postcompaniesllc.com': { staff: true },
      'djackson@postcompaniesllc.com': { staff: true },
    };
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
