// ================================================================
// router.js — SPA Router for ZYKOS Portal
// Hash-based routing. No server config needed.
// Loads game modules dynamically into #zykos-app container.
// ================================================================

;(function(G) {
'use strict';

var _container = null;
var _activeGame = null;
var _routes = {};
var _menuRenderer = null;
var _onRouteChange = null;

var Router = {

  init: function(containerId, menuFn, onChangeFn) {
    _container = document.getElementById(containerId);
    _menuRenderer = menuFn;
    _onRouteChange = onChangeFn;
    window.addEventListener('hashchange', Router._handle);
    // Handle initial route
    Router._handle();
  },

  navigate: function(hash) {
    window.location.hash = hash;
  },

  registerGame: function(slug, loaderFn) {
    _routes[slug] = loaderFn;
  },

  _handle: function() {
    var hash = window.location.hash.replace('#', '') || '/';

    // Notify spy of context change
    if (typeof _onRouteChange === 'function') _onRouteChange(hash);

    // Destroy active game if any
    if (_activeGame) {
      try { _activeGame.destroy(); } catch(e) { console.warn('[router] destroy error:', e.message); }
      _activeGame = null;
    }

    // Clear container
    _container.innerHTML = '';

    // Route: menu
    if (hash === '/' || hash === '') {
      if (typeof _menuRenderer === 'function') _menuRenderer(_container);
      return;
    }

    // Route: play/game-slug
    var match = hash.match(/^\/play\/(.+)$/);
    if (match) {
      var slug = match[1];
      if (_routes[slug]) {
        // Create game container
        var gameWrap = document.createElement('div');
        gameWrap.id = 'game-container';
        gameWrap.style.cssText = 'width:100%;min-height:80vh;position:relative;';
        _container.appendChild(gameWrap);

        // Load game module
        _routes[slug](gameWrap, function(gameInstance) {
          _activeGame = gameInstance;
        });
      } else {
        _container.innerHTML = '<div style="text-align:center;padding:40px;color:var(--dim);">Juego no encontrado: ' + slug + '</div>';
      }
      return;
    }

    // Route: history
    if (hash === '/history') {
      _container.innerHTML = '<div style="padding:20px;color:var(--text);">Historial — en desarrollo</div>';
      return;
    }

    // Route: profile
    if (hash === '/profile') {
      _container.innerHTML = '<div style="padding:20px;color:var(--text);">Perfil — en desarrollo</div>';
      return;
    }

    // Unknown route
    _container.innerHTML = '<div style="text-align:center;padding:40px;color:var(--dim);">Ruta desconocida</div>';
  },

  getActiveSlug: function() {
    var hash = window.location.hash.replace('#', '') || '/';
    var match = hash.match(/^\/play\/(.+)$/);
    return match ? match[1] : null;
  },

  isInGame: function() {
    return _activeGame !== null;
  }
};

G.ZykosRouter = Router;

})(typeof window !== 'undefined' ? window : this);
