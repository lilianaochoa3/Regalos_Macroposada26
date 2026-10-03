// Helpers de interfaz. Todo el contenido se inserta con textContent (nunca innerHTML)
// para que los datos del Sheet no puedan inyectar HTML.
(function () {
  var M = window.Macro = window.Macro || {};

  function agregarHijos(el, hijos) {
    hijos.forEach(function (c) {
      if (c === null || c === undefined || c === false) return;
      if (Array.isArray(c)) { agregarHijos(el, c); return; }
      el.appendChild(c.nodeType ? c : document.createTextNode(String(c)));
    });
  }

  function h(tag, attrs) {
    var el = document.createElement(tag);
    attrs = attrs || {};
    Object.keys(attrs).forEach(function (k) {
      var v = attrs[k];
      if (v === null || v === undefined || v === false) return;
      if (k === 'class') el.className = v;
      else if (k.indexOf('on') === 0 && typeof v === 'function') el.addEventListener(k.slice(2), v);
      else if (k === 'value' || k === 'checked' || k === 'disabled' || k === 'selected') el[k] = v;
      else el.setAttribute(k, v === true ? '' : v);
    });
    agregarHijos(el, Array.prototype.slice.call(arguments, 2));
    return el;
  }

  function vaciar(el) {
    while (el.firstChild) el.removeChild(el.firstChild);
    return el;
  }

  function alerta(tipo) {
    var hijos = Array.prototype.slice.call(arguments, 1);
    var el = h('div', { class: 'alerta alerta-' + tipo, role: tipo === 'urgente' || tipo === 'error' ? 'alert' : null });
    agregarHijos(el, hijos);
    return el;
  }

  // Campo con etiqueta: <label class="campo"><span>Etiqueta</span> input </label>
  function campo(etiqueta, control, ayuda) {
    return h('label', { class: 'campo' },
      h('span', { class: 'campo-etiqueta' }, etiqueta),
      control,
      ayuda ? h('small', { class: 'campo-ayuda' }, ayuda) : null);
  }

  function toast(mensaje, tipo) {
    var cont = document.getElementById('toasts');
    var t = h('div', { class: 'toast toast-' + (tipo || 'info') }, mensaje);
    cont.appendChild(t);
    setTimeout(function () {
      t.classList.add('toast-fuera');
      setTimeout(function () { if (t.parentNode) t.parentNode.removeChild(t); }, 400);
    }, tipo === 'error' ? 6000 : 3000);
  }

  M.ui = { h: h, vaciar: vaciar, alerta: alerta, campo: campo, toast: toast };
})();
