// Fase 2: Cartita entregada (apadrinamiento).
(function () {
  var M = window.Macro;
  var h = M.ui.h;

  M.fases[2] = {
    titulo: 'Fase 2 · Cartita entregada',

    render: function (root) {
      var resultado = h('div', { class: 'detalle' });
      var buscador = M.comun.buscadorFolio({
        onResultado: mostrar,
        onLimpiar: function () { M.ui.vaciar(resultado); M.app.setDirty(false); }
      });
      var contPermisos = h('div', { class: 'zona-agregar' });
      var permisos = { abrir: function () {}, cerrar: function () {} }; // se reemplaza abajo
      contPermisos.appendChild(h('button', { type: 'button', class: 'btn btn-secundario', id: 'f2-permisos',
        onclick: function () {
          M.ui.vaciar(resultado);
          buscador.input.value = '';
          M.app.setDirty(false);
          permisos.abrir();
        } }, 'Registro de permisos'));
      root.appendChild(contPermisos);
      permisos = M.permisos.montar({ contenedor: contPermisos });
      root.appendChild(h('section', { class: 'tarjeta' }, h('h2', { class: 'titulo-seccion' }, 'Buscar folio'), buscador.el));
      root.appendChild(resultado);
      buscador.enfocar();

      function mostrar(d) {
        permisos.cerrar();
        M.ui.vaciar(resultado);
        M.app.setDirty(false);
        var prev = d.padrinoActual || null;

        var padrino = h('input', { type: 'text', maxlength: '200', autocomplete: 'off', placeholder: 'Nombre y apellidos', value: prev ? prev.padrino : '' });
        var tel = h('input', { type: 'tel', inputmode: 'tel', maxlength: '20', autocomplete: 'off', placeholder: '10 dígitos', value: prev ? prev.telefono : '' });
        var entrego = h('input', { type: 'text', maxlength: '120', autocomplete: 'off', placeholder: 'Quien entregó la cartita', value: prev ? prev.entrego : '' });
        var btn = h('button', { type: 'submit', class: 'btn btn-primario btn-grande' }, 'Guardar apadrinamiento');
        var msg = h('div', { class: 'estado-busqueda' });

        resultado.appendChild(h('div', { class: 'alerta-folio alerta-folio-chico' }, h('small', {}, 'FOLIO'), h('strong', {}, d.folio)));
        if (d.permisos) resultado.appendChild(M.comun.etiquetaEstatus(d.permisos)); // estatus de permisos (informativo)
        if (!d.cartitaHecha) {
          resultado.appendChild(M.ui.alerta('warning', 'Este folio aún no tiene la cartita capturada en la Fase 1.'));
        }
        if (prev) {
          resultado.appendChild(M.ui.alerta('warning', 'Este folio ya tiene padrino: ' + prev.padrino + '. Si guardas, se sobrescribirán los datos.'));
        }

        resultado.appendChild(h('form', { class: 'tarjeta', novalidate: true,
          oninput: function () { M.app.setDirty(true); },
          onsubmit: async function (ev) {
            ev.preventDefault();
            M.ui.vaciar(msg);
            var digitos = tel.value.replace(/\D/g, '');
            if (!padrino.value.trim()) { msg.appendChild(M.ui.alerta('warning', 'Escribe el nombre completo del padrino.')); padrino.focus(); return; }
            if (digitos.length < 10 || digitos.length > 13) { msg.appendChild(M.ui.alerta('warning', 'El teléfono debe tener 10 dígitos.')); tel.focus(); return; }
            if (!entrego.value.trim()) { msg.appendChild(M.ui.alerta('warning', 'Escribe el nombre de quien entregó la cartita.')); entrego.focus(); return; }
            var r = await M.comun.conBoton(btn, 'Guardando…', function () {
              return M.comun.enviar('fase2', { folio: d.folio, padrino: padrino.value, telefono: tel.value, entrego: entrego.value });
            });
            if (!r) return;
            M.app.setDirty(false);
            M.ui.toast('Apadrinamiento guardado: folio ' + r.folio, 'ok');
            M.ui.vaciar(resultado);
            resultado.appendChild(M.ui.alerta('ok', h('strong', {}, 'Guardado. '), 'Folio ' + r.folio + ' · ' + r.nombre + '.'));
            buscador.input.value = '';
            buscador.enfocar();
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }
        },
          h('h2', { class: 'titulo-seccion' }, 'Datos del padrino'),
          M.comun.soloLectura('Nombre del niño', d.nombre),
          M.ui.campo('Nombre completo del padrino *', padrino),
          M.ui.campo('Número de teléfono *', tel),
          M.ui.campo('Nombre de quien entregó la cartita *', entrego),
          msg,
          btn));
        resultado.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }
  };
})();
