// Componentes compartidos por las fases 2, 3 y 4 (y utilidades de envío).
(function () {
  var M = window.Macro;
  var h = M.ui.h;
  M.fases = M.fases || {};

  function mensajeError(e) {
    return (e && e.message) ? e.message : 'Ocurrió un error. Intenta de nuevo.';
  }

  // Ejecuta fn() con el botón deshabilitado (evita doble envío). Muestra errores como alerta/toast.
  async function conBoton(boton, textoEnCurso, fn) {
    var original = boton.textContent;
    boton.disabled = true;
    boton.textContent = textoEnCurso || 'Guardando…';
    try {
      return await fn();
    } catch (e) {
      M.ui.toast(mensajeError(e), 'error');
      if (e && (e.codigo === 'FASE_INCORRECTA' || e.codigo === 'FASE_INACTIVA')) M.app.revisarFase();
      if (e && e.codigo === 'PIN') M.app.pedirPin();
      return null;
    } finally {
      boton.disabled = false;
      boton.textContent = original;
    }
  }

  // POST que, si el folio ya tenía datos (YA_EXISTE), pide confirmación y reenvía con sobrescribir.
  async function enviar(accion, datos) {
    try {
      return await M.api.post(accion, datos);
    } catch (e) {
      if (e && e.codigo === 'YA_EXISTE') {
        if (window.confirm(e.message + '\n\n¿Quieres sobrescribir los datos guardados?')) {
          return M.api.post(accion, Object.assign({}, datos, { sobrescribir: true }));
        }
        return null;
      }
      throw e;
    }
  }

  function soloLectura(etiqueta, valor) {
    return M.ui.campo(etiqueta, h('input', { type: 'text', value: valor || '—', readonly: true, class: 'solo-lectura' }));
  }

  // Buscador de folio. opts: { onResultado(datos), onLimpiar() }
  function buscadorFolio(opts) {
    var input = h('input', {
      type: 'text', inputmode: 'numeric', pattern: '[0-9]*', autocomplete: 'off',
      maxlength: '6', placeholder: 'Ej. 025', class: 'input-folio', id: 'folio-input'
    });
    var boton = h('button', { type: 'submit', class: 'btn btn-primario' }, 'Buscar');
    var estado = h('div', { class: 'estado-busqueda' });

    var form = h('form', { class: 'buscador', novalidate: true,
      onsubmit: async function (ev) {
        ev.preventDefault();
        M.ui.vaciar(estado);
        var f = input.value.replace(/\D/g, '');
        if (!f) { estado.appendChild(M.ui.alerta('warning', 'Escribe el número de folio.')); input.focus(); return; }
        if (opts.onLimpiar) opts.onLimpiar();
        var datos = await conBoton(boton, 'Buscando…', function () { return M.api.get('folio', { folio: f }); });
        if (datos) {
          input.value = datos.folio;
          opts.onResultado(datos);
        }
      }
    },
      M.ui.campo('Folio de la carta', input),
      boton);

    input.addEventListener('input', function () {
      M.ui.vaciar(estado);
      if (opts.onLimpiar) opts.onLimpiar();
    });

    return { el: h('div', {}, form, estado), input: input, enfocar: function () { input.focus(); input.select(); } };
  }

  function comprimirImagen(archivo, maxLado, calidad) {
    return new Promise(function (resolve, reject) {
      var url = URL.createObjectURL(archivo);
      var img = new Image();
      img.onload = function () {
        var escala = Math.min(1, maxLado / Math.max(img.width, img.height));
        var c = document.createElement('canvas');
        c.width = Math.max(1, Math.round(img.width * escala));
        c.height = Math.max(1, Math.round(img.height * escala));
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        URL.revokeObjectURL(url);
        resolve(c.toDataURL('image/jpeg', calidad));
      };
      img.onerror = function () {
        URL.revokeObjectURL(url);
        reject(new Error('No se pudo leer la imagen. Intenta con otra foto.'));
      };
      img.src = url;
    });
  }

  // Etiqueta de color con el estatus de permisos de un niño. info: { estatus, faltantes }.
  //  Completos -> SÍ ASISTE | Ninguno -> NO ASISTIRÁ (rojo oscuro) | Incompletos -> NO ASISTIRÁ (marrón) | '' -> sin registrar
  function etiquetaEstatus(info, grande) {
    info = info || {};
    var est = info.estatus || '';
    var clase, texto;
    if (est === 'Completos') { clase = 'completos'; texto = 'SÍ ASISTE · permisos completos'; }
    else if (est === 'Ninguno') { clase = 'ninguno'; texto = 'NO ASISTIRÁ · no entregó documentos'; }
    else if (est === 'Incompletos') { clase = 'incompletos'; texto = 'NO ASISTIRÁ · faltan: ' + (info.faltantes || 'documentos'); }
    else { clase = 'sin'; texto = 'Permisos sin registrar'; }
    return h('div', { class: 'etiqueta-estatus estatus-' + clase + (grande ? ' etiqueta-grande' : ''), role: 'status' }, texto);
  }

  M.comun = {
    etiquetaEstatus: etiquetaEstatus,
    conBoton: conBoton,
    enviar: enviar,
    soloLectura: soloLectura,
    buscadorFolio: buscadorFolio,
    comprimirImagen: comprimirImagen,
    mensajeError: mensajeError
  };
})();
