/**
 * ZYKOS CORSARIO v3.0
 * Continuous biometric telemetry capture.
 * Game-agnostic. Runs before, during, and after games.
 * Writes chunked events to zykos_raw_stream.
 *
 * WHAT IT CAPTURES (raw sensor data only):
 * - Mouse/touch position (x, y) with timestamp
 * - Click/tap events (position, timestamp)
 * - Scroll events (direction, delta, timestamp)
 * - Focus/blur (tab switches)
 * - Viewport dimensions, device type
 *
 * WHAT IT DOES NOT DO:
 * - No analysis, no interpretation, no clinical labels
 * - No tremor detection, no hesitation counting
 * - Those are post-hoc in Supabase
 */
(function() {
  'use strict';

  // --- CONFIG ---
  var CHUNK_INTERVAL_MS = 2000;  // Flush every 2 seconds
  var SAMPLE_EVERY_N = 2;        // Sample every Nth mousemove (reduce noise)
  var MAX_BUFFER = 500;          // Max events before forced flush

  // --- STATE ---
  var _sessionId = null;
  var _patientDni = null;
  var _sb = null;
  var _buffer = [];
  var _chunkIndex = 0;
  var _moveCounter = 0;
  var _sessionStart = Date.now();
  var _flushTimer = null;
  var _active = false;

  // --- INIT ---
  function init(opts) {
    if (!opts || !opts.supabaseClient || !opts.sessionId || !opts.patientDni) {
      console.warn('[corsario] Missing required opts: supabaseClient, sessionId, patientDni');
      return;
    }
    _sb = opts.supabaseClient;
    _sessionId = opts.sessionId;
    _patientDni = opts.patientDni;
    _sessionStart = Date.now();
    _chunkIndex = 0;
    _buffer = [];
    _active = true;

    _bindEvents();
    _flushTimer = setInterval(_flush, CHUNK_INTERVAL_MS);

    // Capture initial viewport
    _push('viewport', {
      w: window.innerWidth,
      h: window.innerHeight,
      dpr: window.devicePixelRatio || 1,
      touch: navigator.maxTouchPoints > 0,
      ua: navigator.userAgent.substring(0, 200)
    });
  }

  // --- EVENT BINDING ---
  function _bindEvents() {
    document.addEventListener('mousemove', _onMove, { passive: true });
    document.addEventListener('touchmove', _onTouch, { passive: true });
    document.addEventListener('click', _onClick, { passive: true });
    document.addEventListener('touchstart', _onTap, { passive: true });
    document.addEventListener('scroll', _onScroll, { passive: true });
    window.addEventListener('focus', function() { _push('focus', {}); });
    window.addEventListener('blur', function() { _push('blur', {}); });
    window.addEventListener('resize', function() {
      _push('resize', { w: window.innerWidth, h: window.innerHeight });
    });
    window.addEventListener('beforeunload', function() {
      _push('unload', {});
      _flush(); // Final flush
    });
  }

  // --- EVENT HANDLERS ---
  function _onMove(e) {
    _moveCounter++;
    if (_moveCounter % SAMPLE_EVERY_N !== 0) return;
    _push('m', { x: e.clientX, y: e.clientY });
  }

  function _onTouch(e) {
    if (!e.touches || !e.touches[0]) return;
    _moveCounter++;
    if (_moveCounter % SAMPLE_EVERY_N !== 0) return;
    _push('t', { x: Math.round(e.touches[0].clientX), y: Math.round(e.touches[0].clientY) });
  }

  function _onClick(e) {
    _push('click', { x: e.clientX, y: e.clientY, btn: e.button });
  }

  function _onTap(e) {
    if (!e.touches || !e.touches[0]) return;
    _push('tap', { x: Math.round(e.touches[0].clientX), y: Math.round(e.touches[0].clientY) });
  }

  function _onScroll() {
    _push('scroll', {
      x: window.scrollX || window.pageXOffset || 0,
      y: window.scrollY || window.pageYOffset || 0
    });
  }

  // --- PUSH EVENT TO BUFFER ---
  function _push(type, data) {
    if (!_active) return;
    _buffer.push({
      t: Date.now() - _sessionStart,  // ms since session start
      e: type,
      d: data
    });
    if (_buffer.length >= MAX_BUFFER) {
      _flush();
    }
  }

  // --- FLUSH BUFFER TO SUPABASE ---
  async function _flush() {
    if (!_active || !_sb || _buffer.length === 0) return;

    var chunk = _buffer.splice(0);  // Take all and clear
    var payload = {
      session_id: _sessionId,
      patient_dni: _patientDni,
      chunk_index: _chunkIndex,
      context: window.location.pathname,
      events: chunk,
      event_count: chunk.length
    };

    _chunkIndex++;

    try {
      var result = await _sb.from('zykos_raw_stream').insert(payload);
      if (result.error) {
        console.warn('[corsario] flush error:', result.error.message);
        // Put events back if save failed
        _buffer = chunk.concat(_buffer);
        _chunkIndex--;
      }
    } catch (err) {
      console.warn('[corsario] flush exception:', err.message);
      _buffer = chunk.concat(_buffer);
      _chunkIndex--;
    }
  }

  // --- STOP ---
  function stop() {
    _active = false;
    if (_flushTimer) clearInterval(_flushTimer);
    _flush(); // Final flush
    document.removeEventListener('mousemove', _onMove);
    document.removeEventListener('touchmove', _onTouch);
    document.removeEventListener('click', _onClick);
    document.removeEventListener('touchstart', _onTap);
    document.removeEventListener('scroll', _onScroll);
  }

  // --- SET CONTEXT (game changes, modal opens, etc) ---
  function setContext(ctx) {
    _push('ctx', { context: ctx });
  }

  // --- EXPOSE ---
  window.ZykosCorsario = {
    init: init,
    stop: stop,
    setContext: setContext,
    flush: _flush
  };

})();
