// ================================================================
// spy.js — ZYKOS V3 Observador Continuo
// (c) 2025-2026 Gonzalo Perez Cortizo. Proprietary. See LICENSE.
//
// Se carga UNA VEZ en portal.html. No se reinicia entre juegos.
// Graba desde el primer milisegundo hasta que se cierra la pestana.
// El stream es sagrado: se guarda integro, nunca se modifica.
//
// Captura en tiempo real, constante.
// Analisis siempre diferido.
// La velocidad es velocidad. No es tristeza.
// La interpretacion es del profesional, no del codigo.
// ================================================================

;(function(G) {
'use strict';

// ================================================================
// DICCIONARIO CANONICO — 53 metricas, vocabulario unico
// Si no esta aca, no existe en la plataforma.
// ================================================================
var DICT = {
  // MOTOR: Tremor (M1)
  tremor_reposo_px:       { d:'MOTOR', u:'px', r:[0,50], c:'M1' },
  tremor_inicio_px:       { d:'MOTOR', u:'px', r:[0,50], c:'M1' },
  tremor_terminal_px:     { d:'MOTOR', u:'px', r:[0,50], c:'M1' },
  // MOTOR: Velocidad (M2)
  rt_mean_ms:             { d:'MOTOR', u:'ms', r:[100,5000], c:'M2' },
  vel_peak_mean:          { d:'MOTOR', u:'px/ms', r:[0,5], c:'M2' },
  vel_peak_sd:            { d:'MOTOR', u:'px/ms', r:[0,3], c:'M2' },
  // MOTOR: Precision (M3)
  dismetria_mean_px:      { d:'MOTOR', u:'px', r:[0,200], c:'M3' },
  eficiencia_trayectoria: { d:'MOTOR', u:'ratio', r:[0,1], c:'M3' },
  rectificaciones_count:  { d:'MOTOR', u:'count', r:[0,500], c:'M3' },
  // MOTOR: Extrapiramidal (M4)
  vel_cv:                 { d:'MOTOR', u:'ratio', r:[0,2], c:'M4' },
  rigidez_index:          { d:'MOTOR', u:'index', r:[0,1], c:'M4' },
  cogwheel_index:         { d:'MOTOR', u:'index', r:[0,1], c:'M4' },
  clasp_knife_ratio:      { d:'MOTOR', u:'ratio', r:[0,10], c:'M4' },
  espasticidad_index:     { d:'MOTOR', u:'index', r:[0,1], c:'M4' },
  // ATENCION (A1)
  rt_sd_ms:               { d:'ATENCION', u:'ms', r:[0,2000], c:'A1' },
  rt_cv:                  { d:'ATENCION', u:'ratio', r:[0,2], c:'A1' },
  decaimiento_vigilancia: { d:'ATENCION', u:'ratio', r:[0.5,3], c:'A1' },
  iiv_consecutiva:        { d:'ATENCION', u:'ms', r:[0,2000], c:'A1' },
  // ATENCION: Fatiga (A2)
  fatiga_motor:           { d:'ATENCION', u:'ratio', r:[0,3], c:'A2' },
  fatiga_precision:       { d:'ATENCION', u:'ratio', r:[0,3], c:'A2' },
  fatiga_global:          { d:'ATENCION', u:'ratio', r:[0,3], c:'A2' },
  // EJECUTIVO: Inhibicion (E1)
  errores_comision:       { d:'EJECUTIVO', u:'count', r:[0,100], c:'E1' },
  errores_omision:        { d:'EJECUTIVO', u:'count', r:[0,100], c:'E1' },
  impulsividad_ratio:     { d:'EJECUTIVO', u:'ratio', r:[0,1], c:'E1' },
  inhibicion_motor:       { d:'EJECUTIVO', u:'ratio', r:[0,1], c:'E1' },
  falsos_clicks:          { d:'EJECUTIVO', u:'count', r:[0,200], c:'E1' },
  // EJECUTIVO: Planificacion (E2)
  eficacia_objetivo:      { d:'EJECUTIVO', u:'ratio', r:[0,1], c:'E2' },
  eficacia_plan:          { d:'EJECUTIVO', u:'ratio', r:[0,1], c:'E2' },
  economia_cognitiva:     { d:'EJECUTIVO', u:'ratio', r:[0,1], c:'E2' },
  secuencia_correcta_pct: { d:'EJECUTIVO', u:'pct', r:[0,100], c:'E2' },
  hesitaciones_count:     { d:'EJECUTIVO', u:'count', r:[0,200], c:'E2' },
  hesitacion_mean_ms:     { d:'EJECUTIVO', u:'ms', r:[0,5000], c:'E2' },
  // EJECUTIVO: Flexibilidad (E3)
  perseveracion_count:    { d:'EJECUTIVO', u:'count', r:[0,50], c:'E3' },
  autocorreccion_ratio:   { d:'EJECUTIVO', u:'ratio', r:[0,1], c:'E3' },
  post_error_rt_ratio:    { d:'EJECUTIVO', u:'ratio', r:[0,5], c:'E3' },
  // MEMORIA
  memory_span:            { d:'MEMORIA', u:'count', r:[0,20], c:'MEM1' },
  curva_aprendizaje:      { d:'MEMORIA', u:'ratio', r:[0,3], c:'MEM2' },
  // COMPRENSION
  instruction_time_ms:    { d:'COMPRENSION', u:'ms', r:[0,60000], c:'C1' },
  instruction_reread:     { d:'COMPRENSION', u:'count', r:[0,50], c:'C1' },
  first_action_latency_ms:{ d:'EJECUTIVO', u:'ms', r:[0,30000], c:'C1' },
  // CALCULO
  error_estimacion_abs:   { d:'CALCULO', u:'currency', r:[0,10000], c:'CAL1' },
  error_estimacion_pct:   { d:'CALCULO', u:'pct', r:[0,100], c:'CAL1' },
  // AFECTIVO
  color_hex:              { d:'AFECTIVO', u:'hex', r:null, c:'AFEC2' },
  color_congruencia:      { d:'AFECTIVO', u:'index', r:[-1,1], c:'AFEC2' },
  engagement_decay:       { d:'AFECTIVO', u:'ratio', r:[0,3], c:'AFEC1' },
  // META
  session_duration_ms:    { d:'META', u:'ms', r:[0,3600000], c:null },
  total_clicks:           { d:'META', u:'count', r:[0,10000], c:null },
  total_actions:          { d:'META', u:'count', r:[0,10000], c:null },
  // HARDWARE
  hw_idle_jitter_px:      { d:'HARDWARE', u:'px', r:[0,20], c:null },
  hw_latency_ms:          { d:'HARDWARE', u:'ms', r:[0,100], c:null },
  // CONTEXTO
  tab_switches:           { d:'CONTEXTO', u:'count', r:[0,100], c:'A1' },
  time_hidden_ms:         { d:'CONTEXTO', u:'ms', r:[0,3600000], c:'A1' },
  orientation_changes:    { d:'CONTEXTO', u:'count', r:[0,50], c:null },
  connection_lost:        { d:'CONTEXTO', u:'count', r:[0,10], c:null }
};

// ================================================================
// STATE — Everything the spy accumulates
// ================================================================
var _t0 = performance.now();  // Time zero — page load
var _sid = null;              // Session ID
var _dni = null;              // Patient DNI
var _uid = null;              // Patient user ID
var _ctx = 'loading';         // Current context
var _stream = [];             // Raw event buffer
var _chunkIdx = 0;            // Persistence chunk counter
var _persistTimer = null;     // 30s persistence interval

// Accumulators for metric computation
var _lastPos = null;
var _lastMoveT = 0;
var _lastClickT = 0;
var _phase = 'idle';
var _phaseT = 0;
var _moveStartSamples = [];
var _preClickSamples = [];
var _velocities = [];
var _accelerations = [];
var _reposoJitters = [];
var _inicioJitters = [];
var _terminalJitters = [];
var _clickDistances = [];
var _velOscillations = [];
var _accelDrops = [];
var _rts = [];
var _hesitations = [];
var _clickTargets = [];
var _totalClicks = 0;
var _rapidClicks = 0;
var _abortedMoves = 0;
var _removedAfterClick = 0;
var _notRemovedAfterClick = 0;
var _firstActionT = null;
var _tabSwitches = 0;
var _hiddenSince = null;
var _hiddenTotal = 0;
var _orientChanges = 0;
var _connLost = 0;
var _scrollbacks = 0;
var _lastScrollY = 0;
var _instructionStart = 0;
var _instructionTime = 0;
var _mouseDownTarget = null;
var _observer = null;
var _pendingStimuli = [];
var _gameReported = {};       // Data reported by game modules
var _gameErrors = [];         // Error events from games
var _gamePaths = [];          // Path data from games
var _calibrated = false;
var _hwJitter = 0;

// Context-segmented accumulators (per game context)
var _ctxMetrics = {};         // {context: {rts:[], velocities:[], ...}}

// ================================================================
// HELPERS
// ================================================================
function _ts() { return Math.round(performance.now() - _t0); }
function _mean(a) { return a.length ? a.reduce(function(s,v){return s+v;},0)/a.length : 0; }
function _sd(a) {
  if (a.length < 2) return 0;
  var m = _mean(a);
  return Math.sqrt(a.map(function(v){return(v-m)*(v-m);}).reduce(function(s,v){return s+v;},0)/(a.length-1));
}
function _tid(el) { return el ? (el.id || el.className.toString().split(' ')[0] || el.tagName.toLowerCase()) : ''; }

// ================================================================
// PUSH — Add event to stream
// ================================================================
function _push(type, data) {
  var evt = { t: _ts(), k: type, ctx: _ctx };
  if (data) {
    var keys = Object.keys(data);
    for (var i = 0; i < keys.length; i++) evt[keys[i]] = data[keys[i]];
  }
  _stream.push(evt);
}

// ================================================================
// EVENT HANDLERS — Always listening, always recording
// ================================================================
function _onMove(e) {
  var now = performance.now();
  var x = e.clientX || (e.touches && e.touches[0] ? e.touches[0].clientX : 0);
  var y = e.clientY || (e.touches && e.touches[0] ? e.touches[0].clientY : 0);

  if (!_lastPos) { _lastPos = {x:x, y:y, t:now}; return; }
  var dt = now - _lastPos.t;
  if (dt < 8) return;

  var dx = x - _lastPos.x, dy = y - _lastPos.y;
  var dist = Math.sqrt(dx*dx + dy*dy);
  var speed = dt > 0 ? dist/dt : 0;
  var prevSpeed = _velocities.length > 0 ? _velocities[_velocities.length-1] : 0;
  var accel = dt > 0 ? (speed - prevSpeed)/dt : 0;

  _velocities.push(speed);
  _accelerations.push(accel);

  var sinceMove = now - _lastMoveT;

  if (dist > 2) {
    if (_phase === 'idle' && sinceMove > 500) {
      _phase = 'moving'; _phaseT = now; _moveStartSamples = [];
    }
    _lastMoveT = now;
    if (_phase === 'moving' && (now - _phaseT) < 150) _moveStartSamples.push(dist);
    _preClickSamples.push(dist);
    if (_preClickSamples.length > 20) _preClickSamples.shift();

    // Cogwheel detection
    if (_velocities.length >= 3) {
      var v = _velocities, vi = v.length-1;
      if ((v[vi]-v[vi-1])*(v[vi-1]-v[vi-2]) < 0 && Math.abs(v[vi]-v[vi-1]) > 0.05) {
        _velOscillations.push(Math.abs(v[vi]-v[vi-1]));
      }
    }
    // Clasp-knife detection
    if (accel < -0.01 && prevSpeed > 0.1) _accelDrops.push(Math.abs(accel));
  } else {
    if (_phase === 'moving') { _phase = 'idle'; _phaseT = now; }
    if (sinceMove > 500 && dist > 0.1) _reposoJitters.push(dist);
  }

  _lastPos = {x:x, y:y, t:now};

  // Push to stream every 5th sample (memory efficiency)
  if (_velocities.length % 5 === 0) {
    _push('m', {x:Math.round(x), y:Math.round(y), s:+(speed.toFixed(3))});
  }
}

function _onClick(e) {
  var now = performance.now();
  var x = e.clientX, y = e.clientY;
  _totalClicks++;

  if (!_firstActionT) _firstActionT = now;
  if (_lastClickT > 0 && (now - _lastClickT) < 150) _rapidClicks++;
  if (_lastClickT > 0) {
    var gap = now - _lastClickT;
    if (gap > 200 && gap < 30000) _hesitations.push(gap);
  }

  // Terminal tremor
  if (_preClickSamples.length >= 3) {
    _terminalJitters.push(_mean(_preClickSamples.slice(-5)));
  }
  // Inicio tremor
  if (_moveStartSamples.length >= 2) {
    _inicioJitters.push(_mean(_moveStartSamples));
  }
  _moveStartSamples = [];

  // Dismetria
  var target = document.elementFromPoint(x, y);
  if (target) {
    var r = target.getBoundingClientRect();
    _clickDistances.push(Math.sqrt(Math.pow(x-(r.left+r.width/2),2) + Math.pow(y-(r.top+r.height/2),2)));
  }

  // Perseveration tracking
  _clickTargets.push(_tid(e.target));

  // Stimulus matching for RT
  if (_pendingStimuli.length > 0) {
    var bestIdx = -1, bestDist = Infinity;
    _pendingStimuli.forEach(function(stim, idx) {
      var d = Math.sqrt(Math.pow(x-(stim.rx+stim.rw/2),2) + Math.pow(y-(stim.ry+stim.rh/2),2));
      if (d < bestDist && d < 300) { bestDist = d; bestIdx = idx; }
    });
    if (bestIdx >= 0) {
      var rt = now - _pendingStimuli[bestIdx].at;
      if (rt > 50 && rt < 10000) _rts.push(rt);
      _pendingStimuli.splice(bestIdx, 1);
    }
    _pendingStimuli = _pendingStimuli.filter(function(s) { return (now-s.at) < 5000; });
  }

  // Commission proxy: click on something that stays = nothing happened = wrong target
  var clicked = e.target;
  setTimeout(function() {
    if (!clicked.parentNode || !document.contains(clicked)) _removedAfterClick++;
    else _notRemovedAfterClick++;
  }, 500);

  // Instruction time ends on first click
  if (_instructionStart && !_instructionTime) {
    _instructionTime = performance.now() - _instructionStart;
    _instructionStart = 0;
  }

  _lastClickT = now;
  _push('c', {x:Math.round(x), y:Math.round(y), tg:_tid(e.target)});
}

function _onMouseDown(e) { _mouseDownTarget = e.target; }
function _onMouseUp(e) {
  if (_mouseDownTarget && _mouseDownTarget !== e.target) _abortedMoves++;
  _mouseDownTarget = null;
}

function _onMutation(mutations) {
  var now = performance.now();
  mutations.forEach(function(mut) {
    mut.addedNodes.forEach(function(node) {
      if (node.nodeType !== 1) return;
      var rect = node.getBoundingClientRect ? node.getBoundingClientRect() : null;
      if (!rect || rect.width < 15 || rect.height < 15 || rect.top < 0) return;
      if (node.onclick || node.style.cursor === 'pointer' || node.tagName === 'BUTTON' || rect.width >= 30) {
        _pendingStimuli.push({at:now, rx:rect.left, ry:rect.top, rw:rect.width, rh:rect.height});
      }
    });
  });
}

function _onVisibility() {
  if (document.hidden) {
    _tabSwitches++;
    _hiddenSince = performance.now();
    _push('h', {v:1});
  } else {
    if (_hiddenSince) _hiddenTotal += performance.now() - _hiddenSince;
    _hiddenSince = null;
    _push('h', {v:0});
  }
}

function _onScroll() {
  var y = window.scrollY || window.pageYOffset || 0;
  if (y < _lastScrollY - 20) _scrollbacks++;
  _lastScrollY = y;
}

function _onOffline() { _connLost++; _push('net', {v:0}); }
function _onOnline() { _push('net', {v:1}); }
function _onOrientation() { _orientChanges++; }
function _onError(e) { _push('err', {m:(e.message||'').slice(0,100)}); }

// ================================================================
// ATTACH — Start listening. Called ONCE. Never called again.
// ================================================================
function _attach() {
  document.addEventListener('mousemove', _onMove, {passive:true});
  document.addEventListener('touchmove', _onMove, {passive:true});
  document.addEventListener('click', _onClick, {passive:true, capture:true});
  document.addEventListener('touchstart', function(e) {
    _onClick({clientX: e.touches[0].clientX, clientY: e.touches[0].clientY, target: e.target});
  }, {passive:true, capture:true});
  document.addEventListener('mousedown', _onMouseDown, {passive:true});
  document.addEventListener('mouseup', _onMouseUp, {passive:true});
  document.addEventListener('visibilitychange', _onVisibility);
  window.addEventListener('scroll', _onScroll, {passive:true});
  window.addEventListener('offline', _onOffline);
  window.addEventListener('online', _onOnline);
  window.addEventListener('orientationchange', _onOrientation);
  window.addEventListener('error', _onError);

  // MutationObserver for stimulus detection
  if (document.body) {
    _observer = new MutationObserver(_onMutation);
    _observer.observe(document.body, {childList:true, subtree:true});
  }

  // Auto-calibrate: measure hardware jitter for first 3 seconds
  setTimeout(function() {
    if (_reposoJitters.length > 5) {
      _hwJitter = _mean(_reposoJitters);
      _calibrated = true;
    }
  }, 3000);

  // Persist stream every 30 seconds
  _persistTimer = setInterval(_persistChunk, 30000);
}

// ================================================================
// PERSISTENCE — Stream chunks to Supabase
// ================================================================
async function _persistChunk() {
  if (_stream.length === 0 || !_dni) return;

  var chunk = _stream.splice(0, _stream.length); // Take all, reset buffer
  var sb = (typeof getSupabaseClient === 'function') ? getSupabaseClient() : null;
  if (!sb) return;

  try {
    var payload = {
      session_id: _sid,
      patient_dni: _dni,
      chunk_index: _chunkIdx++,
      context: _ctx,
      events: chunk,
      event_count: chunk.length
    };

    var res = await sb.from('zykos_raw_stream').insert(payload);
    if (res.error) console.warn('[spy] chunk persist:', res.error.message);
  } catch(e) {
    // Failed to persist — put events back
    _stream = chunk.concat(_stream);
    console.warn('[spy] persist failed, buffered:', _stream.length);
  }
}

// ================================================================
// COMPUTE — Extract 53 canonical metrics from accumulated data
// Called on session end (page unload or explicit call)
// ================================================================
function _compute() {
  var dur = performance.now() - _t0;
  var rMean = _mean(_rts);
  var rSd = _sd(_rts);
  var vMean = _mean(_velocities);
  var vSd = _sd(_velocities);
  var vCv = vMean > 0 ? vSd/vMean : 0;

  // IIV consecutiva
  var rtDiffs = [];
  for (var i = 1; i < _rts.length; i++) rtDiffs.push(Math.abs(_rts[i]-_rts[i-1]));

  // Vigilance decrement
  var decaimiento = 1;
  if (_rts.length >= 6) {
    var mid = Math.floor(_rts.length/2);
    decaimiento = _mean(_rts.slice(0,mid)) > 0 ? _mean(_rts.slice(mid))/_mean(_rts.slice(0,mid)) : 1;
  }

  // Fatiga
  var fMotor = 1, fPrec = 1;
  if (_reposoJitters.length >= 6) {
    var jm = Math.floor(_reposoJitters.length/2);
    var j1 = _mean(_reposoJitters.slice(0,jm)), j2 = _mean(_reposoJitters.slice(jm));
    fMotor = j1 > 0 ? j2/j1 : 1;
  }
  if (_clickDistances.length >= 6) {
    var dm = Math.floor(_clickDistances.length/2);
    var d1 = _mean(_clickDistances.slice(0,dm)), d2 = _mean(_clickDistances.slice(dm));
    fPrec = d1 > 0 ? d2/d1 : 1;
  }

  // Cogwheel
  var cog = (_velOscillations.length > 0 && _velocities.length > 10)
    ? Math.min(1, _velOscillations.length/(_velocities.length/10)) : 0;

  // Clasp-knife
  var ck = 1;
  if (_accelDrops.length > 0) {
    var mDrop = _mean(_accelDrops);
    var mAcc = _mean(_accelerations.map(function(a){return Math.abs(a);}));
    ck = mAcc > 0 ? mDrop/mAcc : 1;
  }

  // Perseveration
  var persev = 0;
  for (var j = 2; j < _clickTargets.length; j++) {
    if (_clickTargets[j] === _clickTargets[j-1] && _clickTargets[j] === _clickTargets[j-2]) persev++;
  }

  var metrics = {
    tremor_reposo_px:       +(_mean(_reposoJitters).toFixed(2)),
    tremor_inicio_px:       +(_mean(_inicioJitters).toFixed(2)),
    tremor_terminal_px:     +(_mean(_terminalJitters).toFixed(2)),
    dismetria_mean_px:      +(_mean(_clickDistances).toFixed(2)),
    eficiencia_trayectoria: null,
    rectificaciones_count:  null,
    vel_peak_mean:          +(vMean.toFixed(4)),
    vel_peak_sd:            +(vSd.toFixed(4)),
    vel_cv:                 +(vCv.toFixed(3)),
    rigidez_index:          +(Math.max(0,1-vCv).toFixed(3)),
    cogwheel_index:         +(cog.toFixed(3)),
    clasp_knife_ratio:      +(ck.toFixed(3)),
    espasticidad_index:     +(Math.min(1,Math.max(0,(ck-1)/4)).toFixed(3)),
    rt_mean_ms:             _rts.length > 0 ? +(rMean.toFixed(1)) : null,
    rt_sd_ms:               _rts.length > 0 ? +(rSd.toFixed(1)) : null,
    rt_cv:                  _rts.length > 0 ? +((rSd/rMean).toFixed(3)) : null,
    decaimiento_vigilancia: +(decaimiento.toFixed(3)),
    iiv_consecutiva:        rtDiffs.length > 0 ? +(_sd(rtDiffs).toFixed(1)) : null,
    fatiga_motor:           +(fMotor.toFixed(3)),
    fatiga_precision:       +(fPrec.toFixed(3)),
    fatiga_global:          +((fMotor+fPrec+decaimiento)/3).toFixed(3),
    errores_comision:       _gameReported.errores_comision != null ? _gameReported.errores_comision : _notRemovedAfterClick,
    errores_omision:        _gameReported.errores_omision != null ? _gameReported.errores_omision : null,
    impulsividad_ratio:     _totalClicks > 0 ? +(_rapidClicks/_totalClicks).toFixed(3) : 0,
    inhibicion_motor:       _totalClicks > 0 ? +(_abortedMoves/_totalClicks).toFixed(3) : 0,
    falsos_clicks:          _gameReported.falsos_clicks != null ? _gameReported.falsos_clicks : null,
    eficacia_objetivo:      _gameReported.eficacia_objetivo != null ? _gameReported.eficacia_objetivo : null,
    eficacia_plan:          _gameReported.eficacia_plan != null ? _gameReported.eficacia_plan : null,
    economia_cognitiva:     _totalClicks > 0 ? +(_removedAfterClick/_totalClicks).toFixed(3) : 0,
    secuencia_correcta_pct: _gameReported.secuencia_correcta_pct != null ? _gameReported.secuencia_correcta_pct : null,
    hesitaciones_count:     _hesitations.length,
    hesitacion_mean_ms:     _hesitations.length > 0 ? +(_mean(_hesitations).toFixed(0)) : null,
    perseveracion_count:    persev,
    autocorreccion_ratio:   _totalClicks > 0 ? +(_abortedMoves/_totalClicks).toFixed(3) : 0,
    post_error_rt_ratio:    _gameReported.post_error_rt_ratio != null ? _gameReported.post_error_rt_ratio : null,
    memory_span:            _gameReported.memory_span != null ? _gameReported.memory_span : null,
    curva_aprendizaje:      _gameReported.curva_aprendizaje != null ? _gameReported.curva_aprendizaje : null,
    instruction_time_ms:    _instructionTime ? Math.round(_instructionTime) : null,
    instruction_reread:     _scrollbacks,
    first_action_latency_ms: _firstActionT ? Math.round(_firstActionT - _t0) : null,
    error_estimacion_abs:   _gameReported.error_estimacion_abs != null ? _gameReported.error_estimacion_abs : null,
    error_estimacion_pct:   _gameReported.error_estimacion_pct != null ? _gameReported.error_estimacion_pct : null,
    color_hex:              _gameReported.color_hex || null,
    color_congruencia:      null, // computed longitudinally in dashboard
    engagement_decay:       null, // computed longitudinally in dashboard
    session_duration_ms:    Math.round(dur),
    total_clicks:           _totalClicks,
    total_actions:          _removedAfterClick + _notRemovedAfterClick,
    hw_idle_jitter_px:      +(_hwJitter.toFixed(2)),
    hw_latency_ms:          null,
    tab_switches:           _tabSwitches,
    time_hidden_ms:         Math.round(_hiddenTotal),
    orientation_changes:    _orientChanges,
    connection_lost:        _connLost
  };

  // Merge any game-reported canonical metrics
  Object.keys(_gameReported).forEach(function(k) {
    if (DICT[k] && metrics[k] === null) metrics[k] = _gameReported[k];
  });

  return metrics;
}

// ================================================================
// PERSIST METRICS — Called on session end
// ================================================================
async function _persistMetrics(metrics) {
  // Flush remaining stream
  await _persistChunk();

  var sb = (typeof getSupabaseClient === 'function') ? getSupabaseClient() : null;
  if (!sb || !_dni) return;

  try {
    // Session record
    await sb.from('zykos_sessions').insert({
      session_id: _sid,
      patient_dni: _dni,
      started_at: new Date(_t0).toISOString(),
      ended_at: new Date().toISOString(),
      duration_ms: metrics.session_duration_ms,
      games_played: Object.keys(_ctxMetrics).filter(function(k){return k.indexOf('play/') === 0;}),
      device_info: {
        ua: navigator.userAgent,
        w: screen.width, h: screen.height,
        dpr: window.devicePixelRatio || 1
      }
    });

    // Computed metrics
    await sb.from('zykos_game_metrics').insert({
      patient_dni: _dni,
      game_slug: 'session_global',
      metric_type: 'v3_computed',
      metric_data: metrics,
      session_id: _sid,
      session_date: new Date().toISOString().slice(0,10)
    });

    // Per-context metrics (if games were played)
    // These would be computed per-game-segment in a more advanced version

  } catch(e) {
    console.error('[spy] metrics persist:', e.message);
  }
}

// ================================================================
// PUBLIC API — ZYKOS global object
// ================================================================
var ZYKOS = {

  // Games call this to deposit domain-specific metrics
  // using canonical dictionary names
  report: function(data) {
    if (!data) return;
    Object.keys(data).forEach(function(k) {
      _gameReported[k] = data[k];
    });
  },

  // Context change (called by router)
  setContext: function(ctx) {
    _ctx = ctx || 'unknown';
    _push('r', {to: _ctx});

    // Reset instruction tracking for new context
    _instructionStart = performance.now();
    _instructionTime = 0;
  },

  // End session explicitly
  endSession: function() {
    if (!_sid) return;
    clearInterval(_persistTimer);
    var metrics = _compute();
    _persistMetrics(metrics);
    _sid = null;
  },

  // Read-only
  getDictionary: function() { return DICT; },
  getMetricCount: function() { return Object.keys(DICT).length; },
  isActive: function() { return _sid !== null; },
  getSessionId: function() { return _sid; },
  getContext: function() { return _ctx; }
};

// ================================================================
// AUTO-START — Immediately on script load. No waiting for DOM.
// ================================================================
(function _boot() {
  // Generate session ID
  _sid = 'zs_' + Date.now() + '_' + Math.random().toString(36).substr(2,6);
  _ctx = 'loading';

  // Extract patient info
  var params = new URLSearchParams(window.location.search);
  _dni = params.get('dni') || null;
  try { if (!_dni) _dni = localStorage.getItem('zykos_patient_dni'); } catch(e) {}
  try { _uid = JSON.parse(localStorage.getItem('zykos_user') || '{}').id || null; } catch(e) {}

  if (!_dni) {
    // No patient identified — spy stays dormant but ready
    // Will activate if DNI appears later (post-login)
    return;
  }

  // Store session ID for cross-context reference
  try { sessionStorage.setItem('zykos_session_id', _sid); } catch(e) {}

  // Attach listeners as soon as possible
  if (document.body) {
    _attach();
  } else {
    document.addEventListener('DOMContentLoaded', _attach);
  }
})();

// End session on page unload
window.addEventListener('beforeunload', function() {
  if (ZYKOS.isActive()) ZYKOS.endSession();
});

// Also try to persist on visibility hidden (mobile browsers kill beforeunload)
document.addEventListener('visibilitychange', function() {
  if (document.hidden && ZYKOS.isActive()) {
    _persistChunk(); // At least save the stream
  }
});

// Export
G.ZYKOS = ZYKOS;
G.ZYKOS_DICT = DICT;

})( typeof window !== 'undefined' ? window : this);
