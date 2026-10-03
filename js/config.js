// Configuración del frontend.
// API_URL: pega aquí la URL del Web App de Apps Script (termina en /exec).
// Si queda vacía, la app corre en MODO PRUEBA con datos de ejemplo (no toca tu Sheet).
window.MACRO_CONFIG = {
  API_URL: 'https://script.google.com/macros/s/AKfycbwXEt9gWW1UlTRhGNm69hb1dzADqlGIqrd1hwxCwWcER8LwpXAYy-dMVhjbng_ubVmm/exec',
  NOMBRE_EVENTO: 'Macroposada 2026',
  POLL_MS: 30000 // cada cuánto se revisa la fase activa
};
