// Controlador: lee la fase activa, muestra solo ese módulo y la revisa periódicamente.
(function () {
  var M = window.Macro;
  var h = M.ui.h;
  var cfg = window.MACRO_CONFIG;

  var vista = document.getElementById('vista');
  var banner = document.getElementById('banner');
  var tituloFase = document.getElementById('titulo-fase');
  var barraDev = document.getElementById('barra-dev');

  var estado = { fase: null, dirty: false, bloqueado: false, timer: null, refrescos: [] };

  function setDirty(b) { estado.dirty = !!b; }

  // Las vistas registran aquí funciones que se ejecutan en cada revisión periódica (y al volver a la pestaña).
  function alRefrescar(fn) { estado.refrescos.push(fn); }

  function ocultarBanner() {
    banner.hidden = true;
    M.ui.vaciar(banner);
  }

  function mostrarBanner(texto, etiquetaBoton, alClick) {
    M.ui.vaciar(banner);
    banner.appendChild(h('span', {}, texto));
    banner.appendChild(h('button', { type: 'button', class: 'btn btn-secundario btn-chico', onclick: alClick }, etiquetaBoton));
    banner.hidden = false;
  }

  function pantallaError(e) {
    M.ui.vaciar(vista);
    tituloFase.textContent = '';
    vista.appendChild(M.ui.alerta('error', M.comun.mensajeError(e)));
    vista.appendChild(h('button', { type: 'button', class: 'btn btn-primario', onclick: function () { arrancar(); } }, 'Reintentar'));
  }

  async function render(fase) {
    estado.fase = fase;
    estado.dirty = false;
    estado.refrescos = [];
    ocultarBanner();
    M.ui.vaciar(vista);
    window.scrollTo(0, 0);

    if (fase === 0) {
      tituloFase.textContent = 'En espera';
      document.title = cfg.NOMBRE_EVENTO;
      vista.appendChild(h('section', { class: 'tarjeta pantalla-centro' },
        h('h2', { class: 'titulo-seccion' }, 'Captura aún no habilitada'),
        h('p', {}, 'Espera las indicaciones del coordinador. Esta pantalla se actualizará sola cuando se habilite una fase.')));
      return;
    }
    var def = M.fases[fase];
    if (!def) {
      tituloFase.textContent = '';
      vista.appendChild(M.ui.alerta('error', 'Fase no reconocida: ' + fase));
      return;
    }
    tituloFase.textContent = def.titulo;
    document.title = def.titulo + ' · ' + cfg.NOMBRE_EVENTO;
    await def.render(vista);
  }

  function recargarVista() { return render(estado.fase); }

  async function revisarFase() {
    if (estado.bloqueado) return;
    var c;
    try {
      c = await M.api.get('config');
    } catch (e) {
      return; // sin red: se reintenta en el próximo ciclo
    }
    if (estado.bloqueado) return;
    if (c.fase !== estado.fase) {
      if (estado.dirty) {
        mostrarBanner('El coordinador cambió a la Fase ' + c.fase + '. Termina de guardar lo que estás capturando.',
          'Cambiar ahora', function () { render(c.fase); });
      } else {
        M.ui.toast('El coordinador cambió la fase activa.', 'info');
        render(c.fase);
      }
    } else {
      ocultarBanner();
      estado.refrescos.forEach(function (fn) {
        try { Promise.resolve(fn()).catch(function () {}); } catch (e) { /* ignorar */ }
      });
    }
  }

  function pantallaPin(mensaje) {
    estado.bloqueado = true;
    return new Promise(function (resolve) {
      var input = h('input', { type: 'password', inputmode: 'numeric', autocomplete: 'off', placeholder: 'PIN del evento', class: 'input-folio' });
      var btn = h('button', { type: 'submit', class: 'btn btn-primario btn-grande' }, 'Entrar');
      var msg = h('div', { class: 'estado-busqueda' });
      if (mensaje) msg.appendChild(M.ui.alerta('warning', mensaje));
      M.ui.vaciar(vista);
      tituloFase.textContent = '';
      vista.appendChild(h('form', { class: 'tarjeta pantalla-centro', novalidate: true,
        onsubmit: async function (ev) {
          ev.preventDefault();
          M.ui.vaciar(msg);
          if (!input.value.trim()) { msg.appendChild(M.ui.alerta('warning', 'Escribe el PIN.')); return; }
          M.api.guardarPin(input.value.trim());
          btn.disabled = true;
          try {
            await M.api.get('ping');
            estado.bloqueado = false;
            resolve();
          } catch (e) {
            msg.appendChild(M.ui.alerta('error', M.comun.mensajeError(e)));
            btn.disabled = false;
            input.select();
          }
        }
      },
        h('h2', { class: 'titulo-seccion' }, 'PIN del evento'),
        M.ui.campo('Pide el PIN al coordinador', input),
        msg,
        btn));
      input.focus();
    });
  }

  // Se usa cuando una petición a mitad de sesión responde "PIN incorrecto".
  async function pedirPin() {
    await pantallaPin('El PIN cambió o ya no es válido. Vuelve a escribirlo.');
    if (estado.fase !== null) await render(estado.fase);
  }

  async function pinGuardadoValido() {
    try {
      await M.api.get('ping');
      return true;
    } catch (e) {
      if (e && e.codigo === 'PIN') return false;
      throw e;
    }
  }

  function montarBarraDev() {
    var sel = h('select', { 'aria-label': 'Fase activa (prueba)' },
      [0, 1, 2, 3, 4].map(function (n) {
        return h('option', { value: String(n), selected: n === M.mock.faseActual() }, n === 0 ? 'Pausada' : 'Fase ' + n);
      }));
    sel.addEventListener('change', function () {
      M.mock.setFase(parseInt(sel.value, 10));
      revisarFase();
    });
    var reset = h('button', { type: 'button', class: 'btn btn-secundario btn-chico', onclick: function () {
      if (window.confirm('¿Borrar los datos de prueba y volver a los ejemplos?')) { M.mock.reiniciar(); recargarVista(); }
    } }, 'Reiniciar datos');
    M.ui.vaciar(barraDev);
    barraDev.appendChild(h('strong', {}, 'MODO PRUEBA'));
    barraDev.appendChild(h('span', {}, 'Datos de ejemplo; no toca tu Sheet. Fase activa:'));
    barraDev.appendChild(sel);
    barraDev.appendChild(reset);
    barraDev.hidden = false;
  }

  async function arrancar() {
    M.ui.vaciar(vista);
    vista.appendChild(h('p', { class: 'cargando' }, 'Cargando…'));
    var c;
    try {
      c = await M.api.get('config');
      if (c.requierePin && !(await pinGuardadoValido())) await pantallaPin();
    } catch (e) {
      pantallaError(e);
      return;
    }
    await render(c.fase);
    if (!estado.timer) estado.timer = setInterval(revisarFase, cfg.POLL_MS || 30000);
  }

  document.getElementById('titulo-evento').textContent = cfg.NOMBRE_EVENTO;
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'visible' && estado.fase !== null) revisarFase();
  });

  M.app = { setDirty: setDirty, alRefrescar: alRefrescar, revisarFase: revisarFase, recargarVista: recargarVista, pedirPin: pedirPin };

  if (M.api.usarMock) montarBarraDev();
  arrancar();
})();
