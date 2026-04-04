// ================================================================
// mood.js — Color picker proyectivo ZYKOS V3
// Sin emojis. Sin etiquetas. Sin interpretacion automatica.
// 12 circulos de color. El paciente elige. El spy registra.
// ================================================================

;(function(G) {
'use strict';

var COLORS = [
  { hex:'#FF0000', id:'rojo' },
  { hex:'#FF8C00', id:'naranja' },
  { hex:'#FFD700', id:'amarillo' },
  { hex:'#008000', id:'verde' },
  { hex:'#00CED1', id:'turquesa' },
  { hex:'#87CEEB', id:'celeste' },
  { hex:'#00008B', id:'azul' },
  { hex:'#800080', id:'violeta' },
  { hex:'#FF69B4', id:'rosa' },
  { hex:'#8B4513', id:'marron' },
  { hex:'#808080', id:'gris' },
  { hex:'#1a1a1a', id:'negro' }
];

function show(context, onDone) {
  context = context || 'session';
  if (document.getElementById('zykos-mood-overlay')) return;

  var overlay = document.createElement('div');
  overlay.id = 'zykos-mood-overlay';
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.72);z-index:9999;display:flex;align-items:center;justify-content:center;backdrop-filter:blur(6px);opacity:0;transition:opacity .3s;';
  requestAnimationFrame(function() { overlay.style.opacity = '1'; });

  var card = document.createElement('div');
  card.style.cssText = 'background:#1e293b;border-radius:20px;padding:28px 24px;max-width:380px;width:90%;border:1px solid rgba(255,255,255,0.08);text-align:center;';

  var grid = document.createElement('div');
  grid.style.cssText = 'display:grid;grid-template-columns:repeat(4,1fr);gap:12px;padding:8px;';

  COLORS.forEach(function(c) {
    var swatch = document.createElement('div');
    swatch.style.cssText = 'width:56px;height:56px;border-radius:50%;cursor:pointer;border:3px solid transparent;transition:transform .15s,border-color .15s;margin:0 auto;background:' + c.hex + ';';
    swatch.onmouseover = function() { swatch.style.transform='scale(1.15)'; swatch.style.borderColor='rgba(255,255,255,0.3)'; };
    swatch.onmouseout = function() { swatch.style.transform='scale(1)'; swatch.style.borderColor='transparent'; };
    swatch.onclick = function() {
      // Report to spy
      if (typeof ZYKOS !== 'undefined') {
        ZYKOS.report({ color_hex: c.hex });
      }
      // Save to Supabase
      _save(c.hex, c.id, context);
      // Close
      _close(overlay);
      if (typeof onDone === 'function') onDone({ hex: c.hex, id: c.id });
    };
    grid.appendChild(swatch);
  });

  card.appendChild(grid);

  // Skip button — almost invisible
  var skip = document.createElement('div');
  skip.style.cssText = 'text-align:right;margin-top:8px;';
  var skipBtn = document.createElement('span');
  skipBtn.textContent = '\u2014'; // em dash
  skipBtn.style.cssText = 'color:rgba(255,255,255,0.12);cursor:pointer;font-size:0.75rem;user-select:none;';
  skipBtn.onclick = function() {
    _save(null, null, context, true);
    _close(overlay);
    if (typeof onDone === 'function') onDone({ skipped: true });
  };
  skip.appendChild(skipBtn);
  card.appendChild(skip);

  overlay.appendChild(card);
  document.body.appendChild(overlay);
}

function _close(overlay) {
  overlay.style.opacity = '0';
  setTimeout(function() { overlay.remove(); }, 300);
}

function _save(hex, id, context, skipped) {
  try {
    var sb = (typeof getSupabaseClient === 'function') ? getSupabaseClient() : null;
    if (!sb) return;
    var dni = null;
    try { dni = localStorage.getItem('zykos_patient_dni'); } catch(e) {}
    if (!dni) return;

    sb.from('zykos_mood_entries').insert({
      patient_dni: dni,
      color_hex: hex,
      color_id: id,
      color_name: id,
      context_type: context,
      source_activity: (typeof ZYKOS !== 'undefined') ? ZYKOS.getContext() : 'unknown',
      entry_type: 'color',
      session_id: (typeof ZYKOS !== 'undefined') ? ZYKOS.getSessionId() : null,
      skipped: skipped || false,
      created_at: new Date().toISOString()
    }).then(function(){}).catch(function(e){ console.warn('[mood] save:', e); });
  } catch(e) {}
}

G.ZykosMood = { show: show, COLORS: COLORS };

})(typeof window !== 'undefined' ? window : this);
