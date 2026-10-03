// Fase 4: Regalo entregado (día del evento).
(function () {
  var M = window.Macro;
  var h = M.ui.h;

  M.fases[4] = {
    titulo: 'Fase 4 · Regalo entregado',

    render: function (root) {
      var resultado = h('div', { class: 'detalle' });
      var buscador = M.comun.buscadorFolio({
        onResultado: mostrar,
        onLimpiar: function () { M.ui.vaciar(resultado); M.app.setDirty(false); }
      });
      root.appendChild(h('section', { class: 'tarjeta' }, h('h2', { class: 'titulo-seccion' }, 'Buscar folio'), buscador.el));
      root.appendChild(resultado);
      buscador.enfocar();

      function mostrar(d) {
        M.ui.vaciar(resultado);
        M.app.setDirty(false);
        var ub = d.ubicacion || {};
        var prev = d.entregadoActual || null;
        var sinUbicacion = !ub.fila && !ub.columna;

        var check = h('input', { type: 'checkbox', id: 'f4-entregado' });
        var iniciales = h('input', { type: 'text', maxlength: '6', autocomplete: 'off', autocapitalize: 'characters', placeholder: 'Ej. JLR', class: 'input-iniciales' });
        iniciales.addEventListener('input', function () { iniciales.value = iniciales.value.toUpperCase(); });
        var btn = h('button', { type: 'submit', class: 'btn btn-primario btn-grande' }, 'Confirmar entrega');
        var msg = h('div', { class: 'estado-busqueda' });

        resultado.appendChild(h('div', { class: 'alerta-folio alerta-folio-chico' }, h('small', {}, 'FOLIO'), h('strong', {}, d.folio)));
        resultado.appendChild(h('p', { class: 'nombre-nino' }, d.nombre));

        if (sinUbicacion) {
          resultado.appendChild(M.ui.alerta('warning', 'Este regalo no tiene ubicación registrada. Avisa al administrador.'));
        } else {
          resultado.appendChild(h('div', { class: 'ubicacion' },
            h('div', { class: 'ubicacion-celda' }, h('small', {}, 'FILA'), h('strong', {}, ub.fila || '—')),
            h('div', { class: 'ubicacion-celda' }, h('small', {}, 'COLUMNA'), h('strong', {}, ub.columna || '—'))));
        }
        if (prev) {
          resultado.appendChild(M.ui.alerta('warning', 'Este regalo ya fue entregado' + (prev.iniciales ? ' (' + prev.iniciales + ')' : '') + (prev.fecha ? ' el ' + prev.fecha : '') + '. Si guardas, se sobrescribirá el registro.'));
        }

        resultado.appendChild(h('form', { class: 'tarjeta', novalidate: true,
          oninput: function () { M.app.setDirty(true); },
          onsubmit: async function (ev) {
            ev.preventDefault();
            M.ui.vaciar(msg);
            var ini = iniciales.value.toUpperCase().replace(/[^A-ZÁÉÍÓÚÑ]/g, '');
            if (!check.checked) { msg.appendChild(M.ui.alerta('warning', 'Marca la casilla "Entregado".')); return; }
            if (ini.length < 1 || ini.length > 6) { msg.appendChild(M.ui.alerta('warning', 'Escribe tus iniciales (1 a 6 letras).')); iniciales.focus(); return; }
            var r = await M.comun.conBoton(btn, 'Guardando…', function () {
              return M.comun.enviar('fase4', { folio: d.folio, entregado: true, iniciales: ini });
            });
            if (!r) return;
            M.app.setDirty(false);
            M.ui.toast('Entrega registrada: folio ' + r.folio, 'ok');
            M.ui.vaciar(resultado);
            resultado.appendChild(M.ui.alerta('ok', h('strong', {}, 'Entrega registrada. '), 'Folio ' + r.folio + ' · ' + r.nombre + '.'));
            buscador.input.value = '';
            buscador.enfocar();
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }
        },
          h('h2', { class: 'titulo-seccion' }, 'Cierre de entrega'),
          h('label', { class: 'casilla' }, check, h('span', {}, 'Entregado')),
          M.ui.campo('Iniciales del voluntario *', iniciales),
          msg,
          btn));
        resultado.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }
  };
})();
