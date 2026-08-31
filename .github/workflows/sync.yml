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

const USER = process.env.RPT_USER;
const PASS = process.env.RPT_PASS;
if (!USER || !PASS) {
  console.error('RPT_USER and RPT_PASS must be set in the environment.');
  console.error('Credentials are never hardcoded here: this file is published with the site,');
  console.error('so anything written into it is readable by anyone with the URL.');
  process.exit(1);
}
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

// Strip credentials from any URL before it is printed. Both URL shapes carry them —
// one in the query string, one as path segments — so blank the values, not the names.
function scrub(url) {
  return String(url)
    .replace(/(vUsername=)[^&]*/i, '$1***')
    .replace(/(vPassword=)[^&]*/i, '$1***')
    .replace(new RegExp('/' + encodeURIComponent(USER) + '/' + encodeURIComponent(PASS) + '/', 'g'), '/***/***/');
}

async function getJson(url, tries) {
  tries = tries || 4;
  let lastErr;
  for (let a = 1; a <= tries; a++) {
    try {
      const res = await fetch(url, { headers: { Accept: 'application/json' } });
      if (res.status === 429 || res.status >= 500) throw new Error(`HTTP ${res.status}`);
      if (!res.ok) throw new Error(`HTTP ${res.status} for ${scrub(url)}`);
      const text = await res.text();
      try { return JSON.parse(text); }
      catch (e) { throw new Error(`Non-JSON response: ${text.slice(0, 120)}`); }
    } catch (e) {
      lastErr = e;
      if (a < tries) await new Promise(r => setTimeout(r, 400 * Math.pow(2, a - 1) + Math.random() * 300));
    }
  }
  throw lastErr;
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
function nz(v) { return (v === 0 || v) ? v : null; }
function daysSince(v) { const d = isoDay(v); if (!d) return null; const n = Math.round((Date.now() - new Date(d + 'T12:00:00').getTime()) / 86400000); return n >= 0 ? n : null; }
function maxDaysRan(list) { let m = 0; (list || []).forEach(c => { const n = parseInt(c.DaysRanString, 10); if (!isNaN(n) && n > m) m = n; }); return m || null; }

/* =====================================================================
 * FIELD MAPPING — tuned to the real RodPumpTracker DataPackage response.
 * Each record is a pump run/repair record for a well.
 * ===================================================================== */
function pipeArr(s){ return String(s||'').split('|').map(function(x){return x.trim();}).filter(function(x){return x!=='';}); }
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
    lat: nz(ow.Latitude), lng: nz(ow.Longitude), perfDepth: nz(ow.PerforationsDepth),
    statusRaw: st.label, tone: st.tone,
    runDate: isoDay(pick(rec, ['RunDate'], '')),
    repairDate: isoDay(pick(rec, ['RepairDate'], '')),
    pullDate: isoDay(pick(rec, ['PullDate'], '')),
    failDate: isoDay(pick(rec, ['FailDate'], '')),
    runDays: daysSince(pick(rec, ['RunDate'], '')),
    lastRunLife: maxDaysRan(rec.SrComponentList),
    apiDesignation: pick(rec, ['ApiDescription', 'ApiDescriptionOverride'], ''),
    pumpType: pick(rec, ['PumpType'], ''),
    pumpNo: pick(rec, ['PumpNoRan', 'PumpNo'], ''),
    // RPT's own word for a pump that came off the well and went to the shelf.
    pumpNoRan: pick(rec, ['PumpNoRan'], ''),
    plunger: nz(pick(rec, ['PlungerSize'], null)),
    tubing: nz(pick(rec, ['TubingSize'], null)),
    strokeLen: nz(pick(rec, ['StrokeLen'], null)),
    shop: pick(rec, ['ShopId'], ''),
    serial: pick(rec, ['Serial'], ''),
    failureReason: (function(){ const p = pick(rec, ['PrimaryFailureReason'], 'None'); return (p && p !== 'None') ? p : 'None'; })(),
    reasonPulled: (function(){ const a = pick(rec, ['ActualReasonPulledDescription'], 'None'); if (a && a !== 'None') return a; const b = pick(rec, ['ReasonPulledDescription'], 'None'); return (b && b !== 'None') ? b : ''; })(),
    pumpFit: pick(rec, ['PumpFit'], ''),
    pinSize: nz(pick(rec, ['PinSize'], null)),
    fishNeck: nz(pick(rec, ['FishNeckSize'], null)),
    gacThread: nz(pick(rec, ['GacThreadSize'], null)),
    valveRod: pick(rec, ['ValveRodSize'], ''),
    pullTube: pick(rec, ['PullTubeSize'], ''),
    plungerRings: nz(pick(rec, ['PlungerRings'], null)),
    plungerCups: nz(pick(rec, ['PlungerCups'], null)),
    valveClearance: nz(pick(rec, ['ValveClearance'], null)),
    tvUpper: pick(rec, ['TValveUBallTypeString'], ''), tvLower: pick(rec, ['TValveLBallTypeString'], ''),
    svUpper: pick(rec, ['SValveUBallTypeString'], ''), svLower: pick(rec, ['SValveLBallTypeString'], ''),
    vacuumTest: nz(pick(rec, ['VacuumTest'], null)),
    plungerRun: pipeArr(rec.PlungerRunString), plungerPull: pipeArr(rec.PlungerPullString),
    barrelRun: pipeArr(rec.BarrelRunString), barrelPull: pipeArr(rec.BarrelPullString),
    fmAcid: pick(rec, ['ForeignMaterialAcidSoluble'], ''), fmSamples: pick(rec, ['ForeignMaterialSamplesTaken'], ''),
    fmSeverity: pick(rec, ['ForeignMaterialSeverity'], ''), fmDesc: pick(rec, ['ForeignMatDesc'], ''),
    notes: pick(rec, ['AddlInfo', 'ScNotes'], ''),
    components: (rec.SrComponentList || []).map(function(c){ return { name: c.ComponentName, metal: c.Metallurgy, coating: c.SurfaceCoating, days: c.DaysRanString, fail: c.FailureCode, part: c.PartNumber, notes: c.Notes, primary: c.IsPrimaryFailure, severity: c.Severity, remedy: c.Remedy, placement: c.Placement }; }).filter(function(c){ return c.name; }),
  };
}

// Group all records per well, keep full history (newest first); current = latest.
function dedupeLatest(wells) {
  const groups = {};
  for (const w of wells) { const k = w.api || w.name; (groups[k] = groups[k] || []).push(w); }
  // Most recent service event across a record's dates (junked pumps have no runDate).
  function eventDate(r){ return [r.repairDate, r.pullDate, r.failDate, r.runDate].filter(Boolean).sort().pop() || ''; }
  function isTeardown(r){ return /junk|repair/i.test(String(r.statusRaw||'')); }
  return Object.values(groups).map(function(recs){
    recs.sort(function(a,b){ return eventDate(b).localeCompare(eventDate(a)); });
    // Report/current record = most recent Junked or Repaired (teardown) record; fall back to newest event.
    var teardowns = recs.filter(isTeardown);
    var cur = Object.assign({}, (teardowns.length ? teardowns[0] : recs[0]));

    // Consolidate history into ONE row per physical pump (serial).
    // RPT emits a record per status change (New -> Run -> Repair/Junked) AND the day-sweep
    // returns the same record on multiple days, so a single pump run can appear 8+ times.
    // One physical pump can be reinstalled later, so group by serial AND run, not serial alone:
    // a new runDate for a serial we have already closed out starts a fresh group.
    var bySerial = {}, order = [];
    recs.forEach(function(r){
      var ser = String(r.serial || '').trim().toLowerCase();
      var key = ser
        ? ser + '|' + (r.runDate || '')
        : 'noserial|' + (r.runDate || r.repairDate || '') + '|' + r.apiDesignation;
      if (!bySerial[key]) { bySerial[key] = []; order.push(key); }
      bySerial[key].push(r);
    });
    cur.history = order.map(function(key){
      var g = bySerial[key];
      var pick1 = function(field){ for (var i=0;i<g.length;i++) if (g[i][field]) return g[i][field]; return ''; };
      var dates = function(field){ return g.map(function(r){ return r[field]; }).filter(Boolean).sort(); };
      var runs = dates('runDate'), repairs = dates('repairDate'), pulls = dates('pullDate');
      var teardown = g.filter(function(r){ return isTeardown(r); })[0] || null;
      var lives = g.map(function(r){ return r.lastRunLife; }).filter(function(v){ return v != null && v > 0; });
      var notes = g.map(function(r){ return String(r.notes || ''); }).sort(function(a,b){ return b.length - a.length; })[0] || '';
      var fail = teardown && teardown.failureReason && teardown.failureReason !== 'None'
        ? teardown.failureReason : pick1('failureReason');
      return {
        serial: g[0].serial || '',
        runDate: runs[0] || '',                          // first installed
        repairDate: repairs[repairs.length-1] || '',      // last shop event
        pullDate: pulls[pulls.length-1] || '',
        statusRaw: (teardown ? teardown.statusRaw : g[0].statusRaw) || '',
        tone: (teardown ? teardown.tone : g[0].tone) || '',
        lastRunLife: lives.length ? Math.max.apply(null, lives) : null,
        failureReason: fail,
        reasonPulled: (teardown && teardown.reasonPulled) || pick1('reasonPulled'),
        apiDesignation: pick1('apiDesignation'),
        pumpType: pick1('pumpType'),
        shop: pick1('shop'),
        notes: notes,
        records: g.length                                 // how many RPT rows collapsed into this
      };
    });
    // Collapse rows that describe the same pump+run (the day-sweep can emit a serial under
    // both a run record and a later teardown record), then order strictly by event date.
    var merged = {}, mOrder = [];
    cur.history.forEach(function(h){
      var k = (String(h.serial||'').trim().toLowerCase() || 'x') + '|' + (h.runDate || h.repairDate || '');
      var prev = merged[k];
      if (!prev) { merged[k] = h; mOrder.push(k); return; }
      prev.runDate = prev.runDate || h.runDate;
      if ((h.repairDate||'') > (prev.repairDate||'')) prev.repairDate = h.repairDate;
      if ((h.pullDate||'') > (prev.pullDate||'')) prev.pullDate = h.pullDate;
      if (h.lastRunLife != null && (prev.lastRunLife == null || h.lastRunLife > prev.lastRunLife)) prev.lastRunLife = h.lastRunLife;
      if (String(h.notes||'').length > String(prev.notes||'').length) prev.notes = h.notes;
      if (isTeardown(h)) { prev.statusRaw = h.statusRaw; prev.tone = h.tone; }
      if (h.failureReason && h.failureReason !== 'None') prev.failureReason = h.failureReason;
      prev.reasonPulled = prev.reasonPulled || h.reasonPulled;
      prev.records += h.records;
    });
    cur.history = mOrder.map(function(k){ return merged[k]; })
      .sort(function(a, b){ return eventDate(b).localeCompare(eventDate(a)); });

    // Repair-and-return consolidation.
    // RPT writes the teardown (Repair/Junked) and the reinstall as separate rows even when the
    // SAME pump goes straight back into the SAME well. In the shop that is one job — a repair
    // and return, "R&R" — so fold the teardown row into the run that follows it. Dates can land
    // either side of each other because the shop closes the repair ticket after the pump ships,
    // so match on a window, not on order.
    var DAY = 86400000;
    var ts = function(d){ return d ? new Date(d + 'T00:00:00').getTime() : null; };
    var shopDay = function(h){ return [h.repairDate, h.pullDate, h.failDate].filter(Boolean).sort().pop() || ''; };
    var dropped = {};
    cur.history.forEach(function(t, ti){
      if (t.runDate || !isTeardown(t)) return;
      var td = ts(shopDay(t)); if (td == null) return;
      var ser = String(t.serial || '').trim().toLowerCase(); if (!ser) return;
      for (var i = 0; i < cur.history.length; i++) {
        var r = cur.history[i];
        if (i === ti || dropped[i] || !r.runDate) continue;
        if (String(r.serial || '').trim().toLowerCase() !== ser) continue;
        if (Math.abs(ts(r.runDate) - td) > 14 * DAY) continue;
        r.jobType = 'R&R';
        r.repairDate = [r.repairDate, t.repairDate].filter(Boolean).sort().pop() || '';
        r.pullDate = [r.pullDate, t.pullDate].filter(Boolean).sort().pop() || '';
        if (t.failureReason && t.failureReason !== 'None' && (!r.failureReason || r.failureReason === 'None')) r.failureReason = t.failureReason;
        r.reasonPulled = r.reasonPulled || t.reasonPulled;
        if (String(t.notes || '').length > String(r.notes || '').length) r.notes = t.notes;
        if (t.lastRunLife != null && (r.lastRunLife == null || t.lastRunLife > r.lastRunLife)) r.lastRunLife = t.lastRunLife;
        r.records += t.records;
        dropped[ti] = 1;
        break;
      }
    });
    cur.history = cur.history.filter(function(h, i){ return !dropped[i]; });
    // Second R&R signal: the shop writes "Pump sent to location: <spec>" in the notes.
    // "None", "TA", "Did not run our pump" mean nothing went back; an actual pump
    // description (20-125-RHBC-20-4-0-0 BBO-262) means a pump was returned to the well
    // even when RPT never wrote the Run row.
    var decodeNotes = function(s){ return String(s || '').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&#39;/g, "'").replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/\s+/g, ' ').trim(); };
    var sentTo = function(n){ var m = decodeNotes(n).match(/Pump sent to location:\s*(.*?)\s*(?:Job\s*overview:|$)/i); return m ? m[1].trim().replace(/[,;]\s*$/, '') : ''; };
    var isPumpSpec = function(s){ return /\d{2}\s*-\s*\d{3}\s*-\s*[A-Z]{3,4}/i.test(s); };
    cur.history.forEach(function(h){
      var s = sentTo(h.notes);
      if (isPumpSpec(s)) h.pumpSentTo = s;
      if (h.jobType) return;
      if (!h.runDate) h.jobType = h.pumpSentTo ? 'R&R' : (/junk/i.test(h.statusRaw || '') ? 'Junked' : 'Teardown');
      else h.jobType = isTeardown(h) ? 'Completed run' : 'Install';
    });

    // If the record we picked as current is a teardown but the same pump went back in
    // (R&R), the well is running — carry the run forward so it is not reported as
    // "no install on record".
    var newest = cur.history[0];
    // Shop notes live on the well record, not the history row, so the newest job reads
    // its "pump sent to location" from there.
    var curSent = sentTo(cur.notes) || (newest ? sentTo(newest.notes) : '');
    if (newest && isPumpSpec(curSent)) {
      newest.pumpSentTo = curSent;
      if (!newest.runDate) newest.jobType = 'R&R';
    }
    if (newest && !cur.runDate && newest.runDate) {
      cur.runDate = newest.runDate;
      cur.runDays = Math.round((Date.now() - new Date(newest.runDate + 'T12:00:00').getTime()) / DAY);
      cur.statusRaw = 'Run';
      cur.tone = 'ok';
    }
    cur.jobType = newest ? newest.jobType : '';
    cur.pumpSentTo = newest ? (newest.pumpSentTo || '') : '';
    return cur;
  }).sort(function(a,b){ return (a.operator||'').localeCompare(b.operator||'') || (a.name||'').localeCompare(b.name||''); });
}

// Shelf inventory: RPT flags these explicitly with PumpNoRan = "Inventoried".
function buildInventory(all, toWell) {
  const items = [];
  for (const rec of all) {
    if (!/^inventoried$/i.test(String(pick(rec, ['PumpNoRan'], '')).trim())) continue;
    const w = toWell(rec);
    const ready = w.repairDate || isoDay(pick(rec, ['ReceivedDate'], '')) || '';
    items.push({
      serial: w.serial || '', operator: w.operator || '', apiDesignation: w.apiDesignation || '',
      plunger: w.plunger || null, pumpType: w.pumpType || '', typeBbl: pick(rec, ['TypeBbl'], ''),
      shop: w.shop || '', ready: ready, statusRaw: w.statusRaw || '',
      lastWell: w.name || '', barrelLen: nz(pick(rec, ['LenBbl'], null)), strokeLen: w.strokeLen || null,
      pullPumpNo: pick(rec, ['PumpNo'], ''), pullDate: w.pullDate || '', rptId: pick(rec, ['GlobalId'], ''),
      daysOnShelf: (function(){ if (!ready) return null; const n = Math.round((Date.now() - new Date(ready + 'T12:00:00').getTime())/86400000); return n >= 0 ? n : null; })(),
    });
  }
  // Newest ready first; de-dupe by serial keeping the most recent.
  items.sort(function(a,b){ return String(b.ready).localeCompare(String(a.ready)); });
  const seen = {}, out = [];
  for (const it of items) { const k = it.serial || (it.apiDesignation + '|' + it.ready); if (seen[k]) continue; seen[k] = 1; out.push(it); }
  return out;
}

// A shelf pump is no longer available once it goes back downhole: drop any item whose
// serial has a run date later than the day it was inventoried.
function pruneInstalled(inventory, wells) {
  const ran = {};
  const note = function(serial, date){
    const s = String(serial || '').trim().toLowerCase();
    if (!s || !date) return;
    if (!ran[s] || date > ran[s]) ran[s] = date;
  };
  wells.forEach(function(w){
    note(w.serial, w.runDate);
    (w.history || []).forEach(function(h){ note(h.serial, h.runDate); });
  });
  return inventory.filter(function(it){
    const s = String(it.serial || '').trim().toLowerCase();
    return !(s && it.ready && ran[s] && ran[s] > it.ready);
  });
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
  const zlib = require('zlib');
  const dateArg = process.argv[2];
  const baseDay = dateArg ? new Date(dateArg + 'T12:00:00') : new Date();

  /* ------------------------------------------------------------------
     Request budget. RPT answers one day per request, so a 1,825-day
     sweep is ~1,825 calls — which is what set off their monitoring.
     Normal runs now pull a short trailing window and merge it into a
     cached copy of everything pulled before; the full sweep runs once
     a month — on the first scheduled run of the month — or on demand
     with RPT_FULL=1.
     ------------------------------------------------------------------ */
  const CACHE = process.env.RPT_CACHE || 'rpt-raw-cache.json.gz';
  const cacheExists = fs.existsSync(CACHE);
  const FULL = process.env.RPT_FULL === '1'
    || baseDay.getUTCDate() <= 7         // monthly full sweep (runs are weekly, so the 1st is rarely a run day)
    || !cacheExists;                     // nothing to merge into yet
  const RANGE = parseInt(process.env.RPT_DAYS || (FULL ? '1825' : '14'), 10);
  console.log(FULL
    ? `Full sweep: ${RANGE} day requests${cacheExists ? '' : ' (no cache yet)'}.`
    : `Rolling window: ${RANGE} day requests, merged into ${CACHE}.`);
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
  let anyOk = false, daysWithData = 0, daysFailed = 0;
  const summary = [];
  const CONC = parseInt(process.env.RPT_CONC || '24', 10);   // parallel day requests
  async function pullDay(day) {
    const ds = fmtDate(day, 'YYYY-MM-DD');
    for (const ep of ENDPOINTS) {
      for (const url of candidates(ep, ds)) {
        try {
          const data = await getJson(url);
          anyOk = true;
          const recs = extractRecords(data);
          if (recs.length) { daysWithData++; summary.push(`  ${ds}: ${recs.length} records`); }
          return recs;
        } catch (e) {
          if (!url.includes('?')) { daysFailed++; summary.push(`  ${ds}: ${e.message}`); }
        }
      }
    }
    return [];
  }
  // Parallel batches — 1,825 sequential requests never finishes inside a CI job.
  for (let i = 0; i < days.length; i += CONC) {
    const batch = days.slice(i, i + CONC);
    const results = await Promise.all(batch.map(function(d){ return pullDay(d).catch(function(){ return []; }); }));
    results.forEach(function(recs){ if (recs && recs.length) all.push.apply(all, recs); });
    if (i % (CONC * 20) === 0) console.log(`  ...${Math.min(i + CONC, days.length)}/${days.length} days, ${all.length} records`);
  }
  console.log(`Pulled ${all.length} records across ${daysWithData} day(s) in the last ${RANGE}. Failed days: ${daysFailed}.`);
  if (daysFailed > RANGE * 0.2) console.error(`::warning::${daysFailed}/${RANGE} day requests failed.`);
  if (summary.length) console.log(summary.slice(0, 40).join('\n'));

  // Diagnose the failure rather than guessing at it. A uniform status code across every
  // day is a server- or account-side answer, not a rate limit.
  if (daysFailed === days.length && days.length > 1) {
    const codes = {};
    summary.forEach(function (l) { const m = l.match(/HTTP (\d{3})/); if (m) codes[m[1]] = (codes[m[1]] || 0) + 1; });
    const only = Object.keys(codes).length === 1 ? Object.keys(codes)[0] : null;
    if (only === '404') {
      console.error('\nEvery request returned HTTP 404, on both URL shapes.');
      console.error('The endpoint ' + ENDPOINTS[0] + ' no longer answers for this account.');
      console.error('That is an RPT-side change: the route was renamed or removed, or API');
      console.error('access for this login was turned off. Contact RodPumpTracker support.');
    } else if (only === '401' || only === '403') {
      console.error('\nEvery request returned HTTP ' + only + ' - the credentials were rejected.');
      console.error('Check the RPT_USER / RPT_PASS repository secrets.');
    } else if (only === '429') {
      console.error('\nEvery request was rate limited. Lower RPT_CONC and re-run.');
    }
  }

  if (!anyOk) { console.error('No response from RPT. Check credentials / network.'); process.exit(1); }

  /* Merge this pull into the cached history, then rebuild the feed from the union.
     Key on RPT's GlobalId where present so a record revised today replaces the
     cached copy instead of duplicating it. */
  const rawKey = function (r) {
    return r.GlobalId
      || [r.SerialNo, r.RunDate, r.PullDate, r.Status, r.PumpNo].join('|');
  };
  if (!FULL) {
    try {
      const cached = JSON.parse(zlib.gunzipSync(fs.readFileSync(CACHE)).toString('utf8'));
      const seen = {};
      all.forEach(function (r) { seen[rawKey(r)] = 1; });
      let kept = 0;
      (Array.isArray(cached) ? cached : []).forEach(function (r) {
        if (!seen[rawKey(r)]) { all.push(r); kept++; }
      });
      console.log(`Merged ${kept} cached record(s) with ${Object.keys(seen).length} from this pull.`);
    } catch (e) {
      console.error(`::warning::Could not read ${CACHE} (${e.message}). Re-run with RPT_FULL=1 to rebuild it.`);
      process.exit(1);
    }
  }
  try {
    const dedup = {};
    all.forEach(function (r) { dedup[rawKey(r)] = r; });
    const uniq = Object.keys(dedup).map(function (k) { return dedup[k]; });
    fs.writeFileSync(CACHE, zlib.gzipSync(Buffer.from(JSON.stringify(uniq)), { level: 9 }));
    console.log(`Cached ${uniq.length} raw record(s) to ${CACHE}.`);
  } catch (e) { console.error(`::warning::Could not write ${CACHE}: ${e.message}`); }

  // Save the raw merged records so field names / operators can be confirmed.
  // Raw dump is debug-only — it can reach 150 MB+. Enable with RPT_RAW=1.
  if (process.env.RPT_RAW === '1') {
    fs.writeFileSync('rpt-raw.json', JSON.stringify(all, null, 2));
    console.log('Saved raw merged records to rpt-raw.json');
  }

  const wells = dedupeLatest(all.map(mapRecord));

  // GUARD: never overwrite a healthy feed with a truncated pull.
  // Compare against the most complete existing feed (sync folder OR repo root).
  try {
    let prevN = 0;
    for (const p of [OUT, '../rpt-feed.json', 'rpt-feed.json']) {
      try { if (fs.existsSync(p)) { const prev = JSON.parse(fs.readFileSync(p, 'utf8')); prevN = Math.max(prevN, (prev.wells || []).length); } } catch (e) {}
    }
    if (prevN > 50 && wells.length < prevN * 0.75) {
      console.error(`\n⛔ Truncated pull detected: got ${wells.length} wells vs ${prevN} in the existing feed.`);
      console.error('   Keeping the existing feed to avoid clobbering good data. Re-run when RPT is fully reachable.');
      process.exit(1);
    }
  } catch (e) { /* no readable previous feed — proceed */ }

  const inventoryAll = buildInventory(all, mapRecord);
  const inventory = pruneInstalled(inventoryAll, wells);
  const pruned = inventoryAll.length - inventory.length;
  // Inventory records sometimes lack OperatorName — inherit it from the well it last ran in.
  (function(){
    const byName = {};
    wells.forEach(function(w){ if (w.name) byName[String(w.name).toLowerCase()] = w.operator || ''; });
    inventory.forEach(function(it){ if (!it.operator) { const op = byName[String(it.lastWell).toLowerCase()]; if (op) it.operator = op; } });
  })();
  const feed = {
    customer: 'All Wells',
    updated: new Date().toISOString(),
    accounts: loadAccounts(fs),
    wells,
    inventory,
  };
  fs.writeFileSync(OUT, JSON.stringify(feed));
  console.log(`Wrote ${OUT} with ${wells.length} wells across ${new Set(wells.map(w=>w.operator).filter(Boolean)).size} operator(s).`);
  console.log(`Shelf inventory: ${inventory.length} pump(s) ready to run (${pruned} excluded \u2014 already reinstalled).`);
  if (!wells.length) {
    console.log('\n⚠️  No wells returned across the whole range.');
    console.log('   Login + API address work (server replied). Likely the sync account');
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
