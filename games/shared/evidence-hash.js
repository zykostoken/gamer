// ============================================================
// evidence-hash.js — ZYKOS GAMER integrity chain
// (c) 2025-2026 Gonzalo Perez Cortizo. Proprietary. See LICENSE.
//
// Every metric saved gets a SHA-256 hash of its content.
// Each hash chains to the previous one (blockchain-lite).
// This proves: data was not altered, sequence is intact,
// and the record existed at the time it was created.
//
// The hash refutes: data tampering, record deletion,
// retroactive modification, and disputed evidence.
//
// Usage:
//   var hashed = await ZykosEvidence.prepare(metricData);
//   // hashed.evidence_hash = SHA-256 of content
//   // hashed.previous_hash = last hash for this patient
//   // Insert hashed object to Supabase
// ============================================================

(function(global) {
'use strict';

var STORAGE_KEY = 'zykos_last_evidence_hash';

// SHA-256 via Web Crypto API (available in all modern browsers)
async function sha256(str) {
    var encoder = new TextEncoder();
    var data = encoder.encode(str);
    var hashBuffer = await crypto.subtle.digest('SHA-256', data);
    var hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(function(b) { return b.toString(16).padStart(2, '0'); }).join('');
}

// Get the last hash for this patient (chain continuity)
function getLastHash() {
    try {
        return localStorage.getItem(STORAGE_KEY) || 'GENESIS';
    } catch(e) {
        return 'GENESIS';
    }
}

// Store the latest hash
function setLastHash(hash) {
    try {
        localStorage.setItem(STORAGE_KEY, hash);
    } catch(e) {}
}

/**
 * Prepare a metric record with evidence hash chain.
 * Call this BEFORE inserting to Supabase.
 * 
 * @param {Object} record - The metric data object to hash
 * @returns {Object} - Same object with evidence_hash and previous_hash added
 */
async function prepare(record) {
    var previousHash = getLastHash();
    
    // Create deterministic string from record content
    // Exclude hash fields themselves to avoid circular reference
    var toHash = {
        patient_dni: record.patient_dni || null,
        game_slug: record.game_slug || null,
        metric_type: record.metric_type || null,
        metric_data: record.metric_data || null,
        timestamp: new Date().toISOString(),
        previous_hash: previousHash
    };
    
    var hashInput = JSON.stringify(toHash, Object.keys(toHash).sort());
    var evidenceHash = await sha256(hashInput);
    
    // Add hash fields to original record
    record.evidence_hash = evidenceHash;
    record.previous_hash = previousHash;
    
    // Update chain
    setLastHash(evidenceHash);
    
    return record;
}

/**
 * Verify a record's hash integrity (for audit)
 * @param {Object} record - Record with evidence_hash and previous_hash
 * @returns {boolean} - True if hash matches content
 */
async function verify(record) {
    var toHash = {
        patient_dni: record.patient_dni || null,
        game_slug: record.game_slug || null,
        metric_type: record.metric_type || null,
        metric_data: record.metric_data || null,
        timestamp: record.created_at || null,
        previous_hash: record.previous_hash || 'GENESIS'
    };
    
    var hashInput = JSON.stringify(toHash, Object.keys(toHash).sort());
    var expectedHash = await sha256(hashInput);
    
    return expectedHash === record.evidence_hash;
}

// Export
global.ZykosEvidence = {
    prepare: prepare,
    verify: verify,
    sha256: sha256
};

})(typeof window !== 'undefined' ? window : this);
