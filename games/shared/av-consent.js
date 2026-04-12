// ================================================================
// av-consent.js — Modal de consentimiento AV por sesion
// (c) 2025-2026 Gonzalo Perez Cortizo. Proprietary. See LICENSE.
//
// Se muestra una vez por sesion al login.
// El paciente elige el nivel de captura AV.
// La eleccion se guarda en sessionStorage (no persiste entre logins).
//
// Niveles:
//   'full'    — camara + microfono
//   'camera'  — solo camara
//   'audio'   — solo microfono
//   'none'    — sin AV (funciona igual, metricas AV = null)
//
// Uso:
//   showAVConsent('/games/portal/');  // muestra modal, luego redirige
//   getAVConsent();                   // retorna 'full'|'camera'|'audio'|'none'
// ================================================================

(function() {
'use strict';

var AV_KEY = 'zykos_av_consent';

function getAVConsent() {
    try { return sessionStorage.getItem(AV_KEY) || 'none'; } catch(e) { return 'none'; }
}

function setAVConsent(level) {
    try { sessionStorage.setItem(AV_KEY, level); } catch(e) {}
}

function showAVConsent(redirectUrl) {
    // Eliminar modal anterior si existe
    var old = document.getElementById('av-consent-overlay');
    if (old) old.remove();

    var overlay = document.createElement('div');
    overlay.id = 'av-consent-overlay';
    overlay.style.cssText = [
        'position:fixed;inset:0;z-index:99999',
        'background:rgba(0,0,0,0.75)',
        'display:flex;align-items:center;justify-content:center',
        'padding:24px;font-family:system-ui,sans-serif'
    ].join(';');

    overlay.innerHTML = [
        '<div style="background:#12121a;border:1px solid rgba(255,255,255,.1);border-radius:20px;',
            'padding:32px;max-width:480px;width:100%;color:#e8e8ed">',
        '<div style="font-size:1.1rem;font-weight:500;margin-bottom:8px">',
            'Camara y microfono — opcional',
        '</div>',
        '<p style="color:rgba(255,255,255,.5);font-size:.85rem;line-height:1.6;margin-bottom:24px">',
            'ZYKOS puede usar la camara para verificar tu presencia durante el juego ',
            'y detectar ausencias o periodos de rigidez. ',
            'El video se procesa localmente — ningun frame sale de tu dispositivo. ',
            '<strong style="color:rgba(255,255,255,.7)">Si no queres activar nada, el sistema funciona igual.</strong>',
        '</p>',
        '<div id="av-options" style="display:flex;flex-direction:column;gap:8px;margin-bottom:24px">',
            _optionHTML('full',   'Camara + microfono', 'Maxima informacion de contexto. Detecta presencia, rigidez y actividad vocal.'),
            _optionHTML('camera', 'Solo camara',        'Detecta presencia y episodios de rigidez/ausencia. Sin audio.'),
            _optionHTML('audio',  'Solo microfono',     'Detecta actividad vocal y nivel de ruido ambiental. Sin video.'),
            _optionHTML('none',   'Sin camara ni microfono', 'El sistema funciona igual. Las metricas AV quedaran vacias.'),
        '</div>',
        '<button id="av-confirm" onclick="window._avConfirm()" style="',
            'width:100%;padding:12px;border-radius:12px;border:none;',
            'background:linear-gradient(135deg,#00d4ff,#0099cc);',
            'color:#000;font-weight:600;font-size:.95rem;cursor:pointer">',
            'Confirmar y continuar',
        '</button>',
        '<p style="color:rgba(255,255,255,.3);font-size:.75rem;text-align:center;margin-top:12px">',
            'Podes cambiar esto la proxima vez que inicies sesion.',
        '</p>',
        '</div>'
    ].join('');

    document.body.appendChild(overlay);

    // Seleccionar 'none' por defecto
    _selectOption('none');

    window._avConfirm = function() {
        var selected = sessionStorage.getItem('_av_pending') || 'none';
        setAVConsent(selected);
        sessionStorage.removeItem('_av_pending');

        var el = document.getElementById('av-consent-overlay');
        if (el) el.remove();

        // Solicitar permisos AV si corresponde, luego redirigir
        _requestPermissions(selected, function() {
            window.location.href = redirectUrl;
        });
    };
}

function _optionHTML(value, title, desc) {
    return [
        '<div class="av-option" data-value="' + value + '" ',
            'onclick="window._avSelect(\'' + value + '\')" ',
            'style="background:#1a1a27;border:1px solid rgba(255,255,255,.08);',
            'border-radius:12px;padding:14px 16px;cursor:pointer;transition:border-color .15s">',
            '<div style="font-size:.88rem;font-weight:500;color:#e8e8ed;margin-bottom:3px">' + title + '</div>',
            '<div style="font-size:.78rem;color:rgba(255,255,255,.4);line-height:1.5">' + desc + '</div>',
        '</div>'
    ].join('');
}

function _selectOption(value) {
    sessionStorage.setItem('_av_pending', value);
    document.querySelectorAll('.av-option').forEach(function(el) {
        var isSelected = el.dataset.value === value;
        el.style.borderColor = isSelected ? '#00d4ff' : 'rgba(255,255,255,.08)';
        el.style.background   = isSelected ? 'rgba(0,212,255,.08)' : '#1a1a27';
    });
}

window._avSelect = _selectOption;

function _requestPermissions(level, cb) {
    if (level === 'none') { cb(); return; }

    var constraints = {};
    if (level === 'full')   { constraints.video = true; constraints.audio = true; }
    if (level === 'camera') { constraints.video = true; }
    if (level === 'audio')  { constraints.audio = true; }

    navigator.mediaDevices.getUserMedia(constraints)
        .then(function(stream) {
            // Guardar el stream en window para que los agentes lo usen
            // Los tracks se paran cuando los agentes terminen la sesion
            window._zykosAVStream = stream;
            cb();
        })
        .catch(function(err) {
            // Si el usuario niega o hay error, continuar sin AV
            console.warn('[av-consent] Permiso denegado o error:', err.message);
            setAVConsent('none');
            cb();
        });
}

// API publica
window.showAVConsent = showAVConsent;
window.getAVConsent  = getAVConsent;
window.ZykosAVConsent = { get: getAVConsent, show: showAVConsent };

})();
