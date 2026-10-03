// Fase 3: Regalo recibido (control de calidad).
(function () {
  var M = window.Macro;
  var h = M.ui.h;

  function resumenPedido(p) {
    var partes = [];
    if (p.regalo) partes.push('Regalo: ' + p.regalo);
    if (p.bicicleta) partes.push('¿Bicicleta?: ' + p.bicicleta);
    if (p.tallaZapato) partes.push('Zapato: ' + p.tallaZapato);
    if (p.tallaPlayera) partes.push('Playera/chamarra: ' + p.tallaPlayera);
    if (p.tallaPantalon) partes.push('Pantalón: ' + p.tallaPantalon);
    return partes.join(' · ');
  }

  M.fases[3] = {
    titulo: 'Fase 3 · Regalo recibido',

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
        var prev = d.recibidoActual || null;
        var fotoDataUrl = null;

        var archivo = h('input', { type: 'file', accept: 'image/*', capture: 'environment', class: 'input-archivo', id: 'f3-foto' });
        var vista = h('img', { class: 'vista-foto', alt: 'Vista previa de la foto del regalo', hidden: true });
        var estadoFoto = h('div', { class: 'estado-busqueda' });
        var recibio = h('input', { type: 'text', maxlength: '120', autocomplete: 'off', placeholder: 'Nombre de quien recibe', value: prev ? prev.recibio : '' });
        var esSi = h('input', { type: 'radio', name: 'f3-es', value: 'Sí' });
        var esNo = h('input', { type: 'radio', name: 'f3-es', value: 'No' });
        var avisoNo = h('div', { class: 'aviso-no' });
        var btn = h('button', { type: 'submit', class: 'btn btn-primario btn-grande' }, 'Guardar recepción');
        var msg = h('div', { class: 'estado-busqueda' });

        function actualizarAviso() {
          M.ui.vaciar(avisoNo);
          if (esNo.checked) {
            avisoNo.appendChild(M.ui.alerta('urgente',
              h('strong', {}, '¡ATENCIÓN! '),
              'Colocar en la caja de incidencias sin deshacer el regalo.'));
          }
        }
        esSi.addEventListener('change', actualizarAviso);
        esNo.addEventListener('change', actualizarAviso);

        archivo.addEventListener('change', async function () {
          M.ui.vaciar(estadoFoto);
          fotoDataUrl = null;
          vista.hidden = true;
          var f = archivo.files && archivo.files[0];
          if (!f) return;
          estadoFoto.appendChild(h('p', { class: 'cargando' }, 'Procesando foto…'));
          try {
            fotoDataUrl = await M.comun.comprimirImagen(f, 1280, 0.75);
            vista.src = fotoDataUrl;
            vista.hidden = false;
            M.ui.vaciar(estadoFoto);
          } catch (e) {
            M.ui.vaciar(estadoFoto);
            estadoFoto.appendChild(M.ui.alerta('error', M.comun.mensajeError(e)));
          }
        });

        resultado.appendChild(h('div', { class: 'alerta-folio alerta-folio-chico' }, h('small', {}, 'FOLIO'), h('strong', {}, d.folio)));
        if (!d.cartitaHecha || !(d.pidio && d.pidio.regalo)) {
          resultado.appendChild(M.ui.alerta('warning', 'Este folio no tiene el regalo capturado en la Fase 1.'));
        }
        if (prev) {
          resultado.appendChild(M.ui.alerta('warning', 'Este regalo ya fue registrado como recibido por ' + prev.recibio + '. Si guardas, se sobrescribirán los datos.'));
        }

        resultado.appendChild(h('form', { class: 'tarjeta', novalidate: true,
          oninput: function () { M.app.setDirty(true); },
          onsubmit: async function (ev) {
            ev.preventDefault();
            M.ui.vaciar(msg);
            if (!fotoDataUrl) { msg.appendChild(M.ui.alerta('warning', 'Toma o sube la foto del regalo.')); return; }
            if (!recibio.value.trim()) { msg.appendChild(M.ui.alerta('warning', 'Escribe el nombre de quien recibe el regalo.')); recibio.focus(); return; }
            if (!esSi.checked && !esNo.checked) { msg.appendChild(M.ui.alerta('warning', 'Indica si es lo que pidió el niño.')); return; }
            var r = await M.comun.conBoton(btn, 'Subiendo foto y guardando…', function () {
              return M.comun.enviar('fase3', { folio: d.folio, foto: fotoDataUrl, recibio: recibio.value, esLoPedido: esSi.checked ? 'Sí' : 'No' });
            });
            if (!r) return;
            M.app.setDirty(false);
            M.ui.vaciar(resultado);
            if (r.incidencia) {
              resultado.appendChild(M.ui.alerta('urgente',
                h('strong', {}, 'INCIDENCIA REGISTRADA · Folio ' + r.folio + '. '),
                'Colocar en la caja de incidencias sin deshacer el regalo.'));
            } else {
              resultado.appendChild(M.ui.alerta('ok', h('strong', {}, 'Guardado. '), 'Folio ' + r.folio + ' · ' + r.nombre + '.'));
            }
            M.ui.toast('Recepción guardada: folio ' + r.folio, 'ok');
            buscador.input.value = '';
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }
        },
          h('h2', { class: 'titulo-seccion' }, 'Regalo recibido'),
          M.comun.soloLectura('Nombre del niño', d.nombre),
          M.comun.soloLectura('Lo que pidió', resumenPedido(d.pidio || {})),
          M.ui.alerta('importante', h('strong', {}, 'IMPORTANTE: '), 'No deshacer el regalo.'),
          h('div', { class: 'campo' },
            h('span', { class: 'campo-etiqueta' }, 'Foto del regalo *'),
            archivo, vista, estadoFoto),
          M.ui.campo('Nombre de quien recibe el regalo *', recibio),
          h('fieldset', { class: 'grupo-radio' },
            h('legend', {}, '¿Es lo que pidió el niño? *'),
            h('label', { class: 'radio' }, esSi, h('span', {}, 'Sí')),
            h('label', { class: 'radio' }, esNo, h('span', {}, 'No'))),
          avisoNo,
          msg,
          btn));
        resultado.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }
  };
})();
