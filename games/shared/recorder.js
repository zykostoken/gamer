/**
 * ZYKOS RECORDER v3.0
 * Uniform trial-level event capture for ALL games.
 * Records what the Corsario cannot see: game semantics.
 *
 * Every game imports this and calls recordTrial() for each trial/action.
 * All games write to the SAME table (zykos_trial_events) with the SAME schema.
 *
 * WHAT IT RECORDS:
 * - What item was presented, what was selected, if it was correct
 * - Commission / omission error type
 * - RT per trial (response timestamp - stimulus timestamp)
 * - Position of action (click/deposit coordinates)
 * - Deposit precision (for drag-drop games)
 * - Stage/level/difficulty context
 *
 * WHAT IT DOES NOT DO:
 * - No jitter, no hesitation, no fatigue, no composites
 * - No clinical flags, no diagnostic labels
 * - Those come from post-hoc analysis in Supabase
 */
(function() {
  'use strict';

  var BATCH_SIZE = 20;  // Flush every N trials
  var _sb = null;
  var _sessionId = null;
  var _patientDni = null;
  var _gameSlug = null;
  var _trialIndex = 0;
  var _buffer = [];
  var _sessionStartMs = Date.now();
  var _active = false;
  var _lastHash = null;

  // --- INIT ---
  function init(opts) {
    if (!opts || !opts.supabaseClient || !opts.sessionId || !opts.patientDni || !opts.gameSlug) {
      console.warn('[recorder] Missing opts: supabaseClient, sessionId, patientDni, gameSlug');
      return;
    }
    _sb = opts.supabaseClient;
    _sessionId = opts.sessionId;
    _patientDni = opts.patientDni;
    _gameSlug = opts.gameSlug;
    _trialIndex = 0;
    _buffer = [];
    _sessionStartMs = Date.now();
    _active = true;
    _lastHash = null;
  }

  /**
   * Record a single trial/event.
   * @param {Object} trial
   * @param {string} trial.event_type       - 'trial' | 'undo' | 'restart' | 'stage_change' | 'deposit'
   * @param {string} [trial.item_presented]  - What was shown to user
   * @param {string} [trial.item_selected]   - What user chose/did
   * @param {string} [trial.target]          - Correct answer / target zone
   * @param {boolean} [trial.is_correct]     - Was it right?
   * @param {string} [trial.error_type]      - 'commission' | 'omission' | null
   * @param {number} [trial.stimulus_onset_ms] - ms since session start when stimulus appeared
   * @param {number} [trial.response_ms]     - ms since session start when user responded
   * @param {number} [trial.position_x]      - Action x coordinate
   * @param {number} [trial.position_y]      - Action y coordinate
   * @param {number} [trial.target_x]        - Target x coordinate
   * @param {number} [trial.target_y]        - Target y coordinate
   * @param {number} [trial.deposit_offset_px] - Distance from target (drag-drop)
   * @param {string} [trial.stage]           - Level/phase/tier
   * @param {string} [trial.difficulty]      - Difficulty label
   * @param {Object} [trial.extra]           - Any game-specific data
   */
  function recordTrial(trial) {
    if (!_active) return;

    var now = Date.now() - _sessionStartMs;
    var stimOnset = trial.stimulus_onset_ms != null ? trial.stimulus_onset_ms : null;
    var responseMs = trial.response_ms != null ? trial.response_ms : now;
    var rt = (stimOnset != null && responseMs != null) ? (responseMs - stimOnset) : null;

    var row = {
      session_id: _sessionId,
      patient_dni: _patientDni,
      game_slug: _gameSlug,
      trial_index: _trialIndex,
      event_type: trial.event_type || 'trial',
      item_presented: trial.item_presented || null,
      item_selected: trial.item_selected || null,
      target: trial.target || null,
      is_correct: trial.is_correct != null ? trial.is_correct : null,
      error_type: trial.error_type || null,
      stimulus_onset_ms: stimOnset,
      response_ms: responseMs,
      rt_ms: rt,
      position_x: trial.position_x != null ? trial.position_x : null,
      position_y: trial.position_y != null ? trial.position_y : null,
      target_x: trial.target_x != null ? trial.target_x : null,
      target_y: trial.target_y != null ? trial.target_y : null,
      deposit_offset_px: trial.deposit_offset_px != null ? trial.deposit_offset_px : null,
      stage: trial.stage || null,
      difficulty: trial.difficulty || null,
      extra: trial.extra || null
    };

    _trialIndex++;
    _buffer.push(row);

    if (_buffer.length >= BATCH_SIZE) {
      flush();
    }
  }

  // --- FLUSH ---
  async function flush() {
    if (!_sb || _buffer.length === 0) return;

    var batch = _buffer.splice(0);

    try {
      var result = await _sb.from('zykos_trial_events').insert(batch);
      if (result.error) {
        console.warn('[recorder] flush error:', result.error.message);
        // Put back on failure
        _buffer = batch.concat(_buffer);
      }
    } catch (err) {
      console.warn('[recorder] flush exception:', err.message);
      _buffer = batch.concat(_buffer);
    }
  }

  // --- END SESSION ---
  // Call when game finishes. Flushes remaining buffer.
  async function endSession() {
    _active = false;
    await flush();
  }

  // --- CONVENIENCE: record a simple correct/incorrect trial ---
  function recordSimple(itemPresented, itemSelected, isCorrect, stimOnsetMs, responseMs, stage, extra) {
    recordTrial({
      event_type: 'trial',
      item_presented: itemPresented,
      item_selected: itemSelected,
      is_correct: isCorrect,
      error_type: isCorrect ? null : (itemSelected ? 'commission' : 'omission'),
      stimulus_onset_ms: stimOnsetMs,
      response_ms: responseMs,
      stage: stage,
      extra: extra
    });
  }

  // --- EXPOSE ---
  window.ZykosRecorder = {
    init: init,
    recordTrial: recordTrial,
    recordSimple: recordSimple,
    flush: flush,
    endSession: endSession
  };

})();
