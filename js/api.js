// Cliente de la API de Apps Script.
// - Lecturas: GET con parámetros en la URL.
// - Escrituras: POST con Content-Type text/plain (evita el preflight de CORS).
(function () {
  var M = window.Macro;
  var cfg = window.MACRO_CONFIG;
  var query = new URLSearchParams(location.search);
  var usarMock = !cfg.API_URL || query.get('mock') === '1';
  var PIN_KEY = 'macroposada_pin';

  var extra = {}; // modo admin: ?fase=N&admin=CODIGO
  if (!usarMock && query.get('fase') !== null && query.get('admin')) {
    extra.faseForzada = query.get('fase');
    extra.admin = query.get('admin');
  }

  function pinGuardado() {
    try { return localStorage.getItem(PIN_KEY) || ''; } catch (e) { return ''; }
  }

  function guardarPin(pin) {
    try { localStorage.setItem(PIN_KEY, pin); } catch (e) { /* modo privado */ }
  }

  function crearError(mensaje, codigo, datos) {
    var e = new Error(mensaje);
    e.codigo = codigo || 'ERROR';
    e.extra = datos || null;
    return e;
  }

  function desenvolver(resp) {
    if (!resp || typeof resp.ok !== 'boolean') throw crearError('Respuesta inesperada del servidor.', 'INTERNO');
    if (!resp.ok) throw crearError(resp.error || 'Error desconocido.', resp.codigo, resp.extra);
    return resp.data;
  }

  async function llamar(url, opciones, intentos, timeoutMs) {
    var ultimo;
    for (var i = 0; i < intentos; i++) {
      var ctrl = new AbortController();
      var timer = setTimeout(function () { ctrl.abort(); }, timeoutMs);
      try {
        var r = await fetch(url, Object.assign({ signal: ctrl.signal, redirect: 'follow' }, opciones));
        clearTimeout(timer);
        if (!r.ok) throw crearError('El servidor respondió con error (' + r.status + ').', 'RED');
        return await r.json();
      } catch (e) {
        clearTimeout(timer);
        if (e.codigo) throw e;
        ultimo = e;
        if (i < intentos - 1) await new Promise(function (ok) { setTimeout(ok, 700 * (i + 1)); });
      }
    }
    throw crearError('Sin conexión con el servidor. Revisa tu internet e intenta de nuevo.', 'RED', String(ultimo));
  }

  async function get(accion, params) {
    var datos = Object.assign({ accion: accion, pin: pinGuardado() }, extra, params || {});
    if (usarMock) return M.mock.handle(accion, datos);
    var qs = new URLSearchParams(datos).toString();
    var resp = await llamar(cfg.API_URL + '?' + qs, { method: 'GET' }, 3, 25000);
    return desenvolver(resp);
  }

  async function post(accion, params) {
    var datos = Object.assign({ accion: accion, pin: pinGuardado() }, extra, params || {});
    if (usarMock) return M.mock.handle(accion, datos);
    // Sin reintentos automáticos: evita guardar dos veces si la respuesta se pierde.
    var resp = await llamar(cfg.API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(datos)
    }, 1, 150000); // con varias fotos/PDF la subida a Drive puede tardar
    return desenvolver(resp);
  }

  M.api = { get: get, post: post, guardarPin: guardarPin, usarMock: usarMock };
})();
