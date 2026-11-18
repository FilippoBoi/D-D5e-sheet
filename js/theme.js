/**
 * Tema chiaro/scuro. Script classico caricato nella <head> (prima del CSS dipinto) per evitare il lampo
 * del tema sbagliato. Senza scelta salvata si segue il sistema operativo; il pulsante nella testata la forza.
 */
(function () {
  var KEY = 'dnd-sheet-theme';
  var root = document.documentElement;
  var media = window.matchMedia ? window.matchMedia('(prefers-color-scheme: light)') : null;

  function stored() {
    try { var v = localStorage.getItem(KEY); return v === 'light' || v === 'dark' ? v : null; } catch (e) { return null; }
  }
  function effective() { return stored() || (media && media.matches ? 'light' : 'dark'); }
  function apply() {
    var theme = effective();
    var saved = stored();
    if (saved) root.setAttribute('data-theme', saved); else root.removeAttribute('data-theme');
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', theme === 'light' ? '#E9DCBC' : '#120F1C');
    var btn = document.querySelector('[data-action="toggle-theme"]');
    if (btn) btn.setAttribute('aria-pressed', theme === 'light' ? 'true' : 'false');
  }

  apply();
  if (media && media.addEventListener) media.addEventListener('change', apply);
  document.addEventListener('DOMContentLoaded', function () {
    apply();
    var btn = document.querySelector('[data-action="toggle-theme"]');
    if (!btn) return;
    btn.addEventListener('click', function () {
      try { localStorage.setItem(KEY, effective() === 'light' ? 'dark' : 'light'); } catch (e) { /* senza storage vale solo per questa visita */ }
      if (!stored()) root.setAttribute('data-theme', effective() === 'light' ? 'dark' : 'light');
      apply();
    });
  });
})();
