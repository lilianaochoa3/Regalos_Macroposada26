// Registro de permisos (disponible en Fase 1 y Fase 2).
// El voluntario elige escuela/grado/grupo/niño y registra: los 3 documentos firmados (foto o PDF),
// el NSS o seguro de gastos médicos, e indicadores (autismo, discapacidad, notas especiales).
// Sí asiste = 3 documentos con archivo + NSS válido. Si falta algo: NO ASISTIRÁ (el niño sigue en la lista).
(function () {
  var M = window.Macro;
  var h = M.ui.h;

  var DOCS = [
    { clave: 'carta', nombre: 'Carta de autorización' },
    { clave: 'responsiva', nombre: 'Carta responsiva / deslindado' },
    { clave: 'ine', nombre: 'INE del padre o tutor' }
  ];
  var TIPOS = ['NSS (IMSS)', 'ISSSTE', 'Gastos Médicos Mayores'];
  var TIPO_NSS = 'NSS (IMSS)';
  var MAX_PDF = 5 * 1024 * 1024;
  var MAX_ARCHIVOS = 6;
  var MAX_TOTAL = 20 * 1024 * 1024; // caracteres base64 de todos los archivos juntos

  function opciones(select, items, placeholder) {
    M.ui.vaciar(select);
    select.appendChild(h('option', { value: '' }, placeholder));
    items.forEach(function (it) { select.appendChild(h('option', { value: it.value }, it.label)); });
    select.disabled = items.length === 0;
  }

  function leerDataUrl(archivo) {
    return new Promise(function (resolve, reject) {
      var lector = new FileReader();
      lector.onload = function () { resolve(lector.result); };
      lector.onerror = function () { reject(new Error('No se pudo leer el archivo.')); };
      lector.readAsDataURL(archivo);
    });
  }

  // Misma regla que el servidor.
  function seguroValido(tipo, texto) {
    texto = String(texto || '').trim();
    if (!tipo || !texto) return false;
    if (tipo === TIPO_NSS) return /^\d{11}$/.test(texto.replace(/[\s-]/g, ''));
    return texto.length >= 3;
  }

  function etiquetaNino(n) {
    return n.nombre + (n.asistencia ? '  ·  ' + n.asistencia : '');
  }

  // opts: { contenedor, alGuardar(resultado) }
  function montar(opts) {
    var panel = h('section', { class: 'tarjeta panel-permisos', id: 'panel-permisos', hidden: true });
    opts.contenedor.appendChild(panel);

    function cerrar() {
      if (panel.hidden) return;
      panel.hidden = true;
      M.ui.vaciar(panel);
      M.app.setDirty(false);
    }

    async function abrir() {
      panel.hidden = false;
      M.app.setDirty(false);
      M.ui.vaciar(panel);
      panel.appendChild(h('h2', { class: 'titulo-seccion' }, 'Registro de permisos'));
      panel.appendChild(h('p', { class: 'cargando' }, 'Cargando escuelas…'));
      panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
      var catalogo;
      try {
        catalogo = await M.api.get('catalogo');
      } catch (e) {
        M.ui.vaciar(panel);
        panel.appendChild(M.ui.alerta('error', M.comun.mensajeError(e)));
        panel.appendChild(h('button', { type: 'button', class: 'btn btn-primario', onclick: abrir }, 'Reintentar'));
        panel.appendChild(h('button', { type: 'button', class: 'btn btn-secundario', onclick: cerrar }, 'Cerrar'));
        return;
      }
      construirSeleccion(catalogo);
    }

    // ---------- Selección del niño (escuela > grado > grupo > niño) ----------
    function construirSeleccion(catalogo) {
      M.ui.vaciar(panel);
      var ninos = [];
      var selEscuela = h('select', { id: 'pm-escuela' });
      var selGrado = h('select', { id: 'pm-grado' });
      var selGrupo = h('select', { id: 'pm-grupo' });
      var selNino = h('select', { id: 'pm-nino' });
      var campoGrupo = M.ui.campo('Grupo', selGrupo);
      var detalle = h('div', { class: 'detalle', id: 'pm-detalle' });

      panel.appendChild(h('h2', { class: 'titulo-seccion' }, 'Registro de permisos'));
      panel.appendChild(h('p', { class: 'ayuda-panel' }, 'Elige al niño y registra los 3 documentos firmados, el NSS o seguro de gastos médicos y las notas especiales.'));
      panel.appendChild(M.ui.campo('Escuela', selEscuela));
      panel.appendChild(M.ui.campo('Grado', selGrado));
      panel.appendChild(campoGrupo);
      panel.appendChild(M.ui.campo('Nombre del niño', selNino));
      panel.appendChild(detalle);
      panel.appendChild(h('button', { type: 'button', class: 'btn btn-secundario', id: 'pm-cerrar', onclick: cerrar }, 'Cerrar'));

      opciones(selEscuela, catalogo.escuelas.map(function (e) { return { value: e.nombre, label: e.nombre }; }), 'Selecciona la escuela…');
      opciones(selGrado, [], 'Primero elige la escuela');
      opciones(selGrupo, [], '—');
      opciones(selNino, [], 'Primero elige el grado');

      function escuelaActual() {
        return catalogo.escuelas.filter(function (e) { return e.nombre === selEscuela.value; })[0];
      }
      function gradoActual() {
        var esc = escuelaActual();
        return esc ? esc.grados.filter(function (g) { return g.grado === selGrado.value; })[0] : null;
      }

      selEscuela.addEventListener('change', function () {
        M.ui.vaciar(detalle);
        M.app.setDirty(false);
        var esc = escuelaActual();
        opciones(selGrado, esc ? esc.grados.map(function (g) { return { value: g.grado, label: g.grado }; }) : [], esc ? 'Selecciona el grado…' : 'Primero elige la escuela');
        opciones(selGrupo, [], '—');
        campoGrupo.hidden = false;
        opciones(selNino, [], 'Primero elige el grado');
      });

      selGrado.addEventListener('change', function () {
        M.ui.vaciar(detalle);
        M.app.setDirty(false);
        opciones(selNino, [], 'Selecciona el grupo…');
        var g = gradoActual();
        if (!g) { opciones(selGrupo, [], '—'); campoGrupo.hidden = false; return; }
        if (g.grupos.length === 1 && g.grupos[0] === '') {
          campoGrupo.hidden = true;
          opciones(selGrupo, [{ value: '', label: 'Sin grupo' }], '');
          selGrupo.value = '';
          cargarNinos();
        } else {
          campoGrupo.hidden = false;
          opciones(selGrupo, g.grupos.map(function (x) { return { value: x, label: x === '' ? 'Sin grupo' : x }; }), 'Selecciona el grupo…');
        }
      });

      selGrupo.addEventListener('change', function () {
        M.ui.vaciar(detalle);
        M.app.setDirty(false);
        if (selGrupo.value === '' && selGrupo.selectedIndex === 0 && !campoGrupo.hidden) {
          opciones(selNino, [], 'Selecciona el grupo…');
          return;
        }
        cargarNinos();
      });

      async function cargarNinos() {
        opciones(selNino, [], 'Cargando niños…');
        try {
          ninos = await M.api.get('ninos', { escuela: selEscuela.value, grado: selGrado.value, grupo: selGrupo.value });
        } catch (e) {
          opciones(selNino, [], 'Error al cargar');
          M.ui.toast(M.comun.mensajeError(e), 'error');
          return;
        }
        pintarNinos();
      }

      function pintarNinos() {
        var actual = selNino.value;
        opciones(selNino, ninos.map(function (n) { return { value: n.folio, label: etiquetaNino(n) }; }),
          ninos.length ? 'Selecciona al niño… (' + ninos.length + ')' : 'No hay niños en este grupo');
        selNino.value = actual;
      }

      selNino.addEventListener('change', function () {
        if (!selNino.value) { M.ui.vaciar(detalle); M.app.setDirty(false); return; }
        cargarPermisos(selNino.value);
      });

      async function cargarPermisos(folio) {
        M.ui.vaciar(detalle);
        M.app.setDirty(false);
        detalle.appendChild(h('p', { class: 'cargando' }, 'Cargando permisos…'));
        var d;
        try {
          d = await M.api.get('permisos', { folio: folio });
        } catch (e) {
          M.ui.vaciar(detalle);
          M.ui.toast(M.comun.mensajeError(e), 'error');
          return;
        }
        if (selNino.value !== folio) return; // el voluntario ya eligió a otro niño
        formulario(d);
      }

      // ---------- Formulario de permisos ----------
      function formulario(d) {
        M.ui.vaciar(detalle);
        var st = {
          archivos: { carta: [], responsiva: [], ine: [] },
          reemplazar: { carta: false, responsiva: false, ine: false },
          repintar: {}
        };
        var existentes = DOCS.filter(function (x) { return d.documentos[x.clave].archivos > 0; }).length;
        var inicial = existentes === 3 ? 'completo' : existentes > 0 ? 'parcial' : d.registrado ? 'ninguno' : null;

        var radios = {};
        function radio(valor, texto) {
          var input = h('input', { type: 'radio', name: 'pm-resultado', value: valor, checked: inicial === valor });
          radios[valor] = input;
          return h('label', { class: 'radio' }, input, h('span', {}, texto));
        }
        function valorResultado() {
          return radios.completo.checked ? 'completo' : radios.parcial.checked ? 'parcial' : radios.ninguno.checked ? 'ninguno' : null;
        }

        var grupoResultado = h('fieldset', { class: 'grupo-radio', id: 'pm-resultado' },
          h('legend', {}, '¿Qué entregó el padre o tutor? *'),
          radio('completo', 'Entregó los 3 documentos'),
          radio('parcial', 'Le falta alguno de los documentos'),
          radio('ninguno', 'No entregó ningún documento'));

        // Documentos
        var bloqueDocs = h('div', { id: 'pm-docs' });

        function repintarLista(clave, lista) {
          M.ui.vaciar(lista);
          st.archivos[clave].forEach(function (a, i) {
            lista.appendChild(h('li', { class: 'pm-archivo' },
              a.tipo === 'application/pdf'
                ? h('span', { class: 'pm-pdf' }, 'PDF')
                : h('img', { class: 'pm-mini', src: a.data, alt: 'Vista previa de ' + a.nombre }),
              h('span', { class: 'pm-nombre' }, a.nombre),
              h('button', { type: 'button', class: 'btn btn-secundario btn-chico pm-quitar',
                onclick: function () { st.archivos[clave].splice(i, 1); repintarLista(clave, lista); M.app.setDirty(true); actualizar(); } }, 'Quitar')));
          });
        }

        async function agregarArchivos(clave, archivos) {
          for (var i = 0; i < archivos.length; i++) {
            var f = archivos[i];
            try {
              if (st.archivos[clave].length >= MAX_ARCHIVOS) throw new Error('Máximo ' + MAX_ARCHIVOS + ' archivos por documento.');
              var esPdf = f.type === 'application/pdf' || /\.pdf$/i.test(f.name);
              var data, tipoArchivo;
              if (esPdf) {
                if (f.size > MAX_PDF) throw new Error('El PDF "' + f.name + '" pesa más de 5 MB.');
                data = await leerDataUrl(f);
                data = 'data:application/pdf;base64,' + data.slice(data.indexOf(',') + 1);
                tipoArchivo = 'application/pdf';
              } else if (/^image\//.test(f.type)) {
                data = await M.comun.comprimirImagen(f, 1800, 0.8);
                tipoArchivo = 'image/jpeg';
              } else {
                throw new Error('"' + f.name + '" no es una foto ni un PDF.');
              }
              st.archivos[clave].push({ nombre: f.name, tipo: tipoArchivo, data: data });
            } catch (e) {
              M.ui.toast(M.comun.mensajeError(e), 'error');
            }
          }
          st.repintar[clave]();
          M.app.setDirty(true);
          actualizar();
        }

        DOCS.forEach(function (doc) {
          var n = d.documentos[doc.clave].archivos;
          var lista = h('ul', { class: 'pm-lista' });
          var camara = h('input', { type: 'file', accept: 'image/*', capture: 'environment', class: 'pm-file-camara' });
          var galeria = h('input', { type: 'file', accept: 'image/*,application/pdf', multiple: true, class: 'pm-file-archivo' });
          var alElegir = function (ev) {
            var elegidos = Array.prototype.slice.call(ev.target.files || []);
            ev.target.value = '';
            agregarArchivos(doc.clave, elegidos);
          };
          camara.addEventListener('change', alElegir);
          galeria.addEventListener('change', alElegir);
          st.repintar[doc.clave] = function () { repintarLista(doc.clave, lista); };

          var reemp = null;
          if (n > 0) {
            reemp = h('input', { type: 'checkbox', class: 'pm-reemplazar' });
            reemp.addEventListener('change', function () { st.reemplazar[doc.clave] = reemp.checked; actualizar(); });
          }

          bloqueDocs.appendChild(h('div', { class: 'pm-doc', 'data-doc': doc.clave },
            h('div', { class: 'pm-doc-titulo' }, doc.nombre),
            h('div', { class: 'pm-doc-estado' + (n > 0 ? ' pm-ok' : ' pm-falta') },
              n > 0 ? '✔ ' + n + (n === 1 ? ' archivo registrado' : ' archivos registrados') : 'Falta: aún no hay archivos'),
            h('div', { class: 'pm-botones' },
              h('label', { class: 'btn btn-secundario btn-archivo' }, 'Tomar foto', camara),
              h('label', { class: 'btn btn-secundario btn-archivo' }, 'Elegir foto o PDF', galeria)),
            reemp ? h('label', { class: 'casilla casilla-chica' }, reemp, h('span', {}, 'Reemplazar los archivos ya registrados')) : null,
            lista));
        });

        // Seguro médico
        var tipo = h('select', { id: 'pm-tipo' });
        opciones(tipo, TIPOS.map(function (t) { return { value: t, label: t }; }), 'Tipo de seguro…');
        tipo.value = d.tipoSeguro || '';
        var seguro = h('input', {
          type: 'text', id: 'pm-seguro', maxlength: '60', autocomplete: 'off',
          placeholder: d.seguroRegistrado ? 'Registrado: ' + d.seguroMascara + ' (déjalo vacío para conservarlo)' : 'Número de NSS o de póliza'
        });

        // Indicadores
        var chkAutismo = h('input', { type: 'checkbox', id: 'pm-autismo', checked: !!d.autismo });
        var chkDis = h('input', { type: 'checkbox', id: 'pm-discapacidad', checked: !!d.discapacidad });
        var descDis = h('input', { type: 'text', id: 'pm-disc-desc', maxlength: '200', autocomplete: 'off', placeholder: 'Describe la discapacidad', value: d.discapacidadDescripcion || '' });
        var campoDesc = M.ui.campo('Descripción de la discapacidad *', descDis);
        campoDesc.hidden = !d.discapacidad;
        chkDis.addEventListener('change', function () { campoDesc.hidden = !chkDis.checked; });
        var notas = h('textarea', { id: 'pm-notas', maxlength: '500', rows: '3', placeholder: 'Alergias, medicamentos, indicaciones del padre…' }, d.notas || '');

        var resumen = h('div', { id: 'pm-resumen', class: 'pm-resumen', role: 'status' });
        var msg = h('div', { class: 'estado-busqueda' });
        var btn = h('button', { type: 'submit', class: 'btn btn-primario btn-grande', id: 'pm-guardar' }, 'Guardar permisos');

        // Evaluación en vivo (misma lógica que el servidor)
        function evaluar() {
          var res = valorResultado();
          var faltan = [];
          var n = 0;
          DOCS.forEach(function (doc) {
            var ya = st.reemplazar[doc.clave] ? 0 : d.documentos[doc.clave].archivos;
            var nuevos = res === 'ninguno' ? 0 : st.archivos[doc.clave].length;
            if (ya + nuevos > 0) n++; else faltan.push(doc.nombre);
          });
          var txt = seguro.value.trim();
          var nssOk = txt ? seguroValido(tipo.value, txt) : !!d.seguroValido;
          if (!nssOk) faltan.push('NSS / Gastos Médicos Mayores');
          var estatus = n === 0 ? 'Ninguno' : (n < 3 || !nssOk) ? 'Incompletos' : 'Completos';
          var aviso = null;
          if (res === 'completo' && n !== 3) aviso = 'Marcaste que entregó los 3 documentos, pero falta archivo de: ' + DOCS.filter(function (doc) {
            return (st.reemplazar[doc.clave] ? 0 : d.documentos[doc.clave].archivos) + st.archivos[doc.clave].length === 0;
          }).map(function (doc) { return doc.nombre; }).join(', ') + '.';
          if (res === 'parcial' && n === 3) aviso = 'Ya están los 3 documentos: elige "Entregó los 3 documentos".';
          if (res === 'parcial' && n === 0) aviso = 'No hay ningún documento: sube al menos uno o elige "No entregó ningún documento".';
          if (res === 'ninguno' && n !== 0) aviso = 'Marcaste que no entregó documentos, pero ya hay ' + n + ' registrado(s). Elige otra opción.';
          return { res: res, n: n, estatus: estatus, faltantes: faltan.join(', '), aviso: aviso };
        }

        function actualizar() {
          bloqueDocs.hidden = valorResultado() === 'ninguno';
          var ev = evaluar();
          M.ui.vaciar(resumen);
          resumen.appendChild(h('div', { class: 'pm-resumen-titulo' }, 'Con lo capturado, el niño quedará:'));
          resumen.appendChild(M.comun.etiquetaEstatus({ estatus: ev.estatus, faltantes: ev.faltantes }));
          if (ev.aviso) resumen.appendChild(M.ui.alerta('warning', ev.aviso));
          if (ev.estatus !== 'Completos') {
            resumen.appendChild(h('p', { class: 'ayuda-panel' }, 'Mientras falte algo aparece como NO ASISTIRÁ, pero sigue en la lista. Puedes completar su registro después.'));
          }
        }

        var form = h('form', { class: 'pm-form', id: 'pm-form', novalidate: true,
          oninput: function () { M.app.setDirty(true); actualizar(); },
          onchange: function () { actualizar(); },
          onsubmit: async function (ev) {
            ev.preventDefault();
            M.ui.vaciar(msg);
            var aviso = function (t, el) { msg.appendChild(M.ui.alerta('warning', t)); if (el && el.focus) el.focus(); };
            var e = evaluar();
            var txt = seguro.value.trim();
            if (!e.res) return aviso('Indica qué entregó el padre o tutor.');
            if (txt && !tipo.value) return aviso('Elige el tipo de seguro (NSS, ISSSTE o Gastos Médicos Mayores).', tipo);
            if (txt && tipo.value === TIPO_NSS && !/^\d{11}$/.test(txt.replace(/[\s-]/g, ''))) return aviso('El NSS debe tener 11 dígitos.', seguro);
            if (txt && txt.length < 3) return aviso('Escribe el número completo del seguro.', seguro);
            if (chkDis.checked && !descDis.value.trim()) return aviso('Describe la discapacidad.', descDis);
            if (e.aviso) return aviso(e.aviso);

            var docs = {};
            var total = 0;
            DOCS.forEach(function (doc) {
              var lista = e.res === 'ninguno' ? [] : st.archivos[doc.clave];
              lista.forEach(function (a) { total += a.data.length; });
              docs[doc.clave] = {
                archivos: lista.map(function (a) { return { nombre: a.nombre, data: a.data }; }),
                reemplazar: !!st.reemplazar[doc.clave]
              };
            });
            if (total > MAX_TOTAL) return aviso('Los archivos pesan demasiado. Quita algunos o usa fotos más ligeras.');

            var payload = {
              folio: d.folio, resultado: e.res,
              tipoSeguro: tipo.value, seguro: txt,
              autismo: chkAutismo.checked,
              discapacidad: chkDis.checked, discapacidadDescripcion: descDis.value,
              notas: notas.value, docs: docs
            };
            var r = await M.comun.conBoton(btn, 'Subiendo archivos y guardando… (puede tardar)', function () {
              return M.api.post('guardarPermisos', payload);
            });
            if (!r) return;
            exito(r);
          }
        },
          h('h3', { class: 'pm-subtitulo' }, d.nombre),
          h('div', { class: 'alerta-folio alerta-folio-chico' }, h('small', {}, 'FOLIO'), h('strong', {}, d.folio)),
          M.comun.etiquetaEstatus({ estatus: d.estatus, faltantes: d.faltantes }),
          d.autismo ? h('div', { class: 'chip-autismo' }, 'Diagnóstico de autismo registrado') : null,
          grupoResultado,
          bloqueDocs,
          h('h3', { class: 'pm-subtitulo' }, 'NSS o Gastos Médicos Mayores'),
          M.ui.campo('Tipo de seguro', tipo),
          M.ui.campo('Número', seguro, d.seguroRegistrado ? 'Ya hay un número registrado; solo escríbelo si quieres cambiarlo.' : null),
          h('h3', { class: 'pm-subtitulo' }, 'Indicadores y notas'),
          h('label', { class: 'casilla' }, chkAutismo, h('span', {}, 'Diagnóstico de autismo')),
          h('label', { class: 'casilla' }, chkDis, h('span', {}, 'Discapacidad')),
          campoDesc,
          M.ui.campo('Notas especiales', notas),
          resumen,
          msg,
          btn);

        detalle.appendChild(form);
        actualizar();
        detalle.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }

      function exito(r) {
        M.app.setDirty(false);
        var noAsiste = r.asistencia === 'NO ASISTIRÁ';
        M.ui.toast('Permisos guardados: folio ' + r.folio, noAsiste ? 'error' : 'ok');
        M.ui.vaciar(detalle);
        var bloqueFinal = h('div', { id: 'pm-final' },
          h('div', { class: 'alerta-folio alerta-folio-chico' }, h('small', {}, 'FOLIO'), h('strong', {}, r.folio)),
          h('p', { class: 'nombre-nino' }, r.nombre),
          M.comun.etiquetaEstatus(r));
        if (noAsiste) {
          bloqueFinal.appendChild(M.ui.alerta('urgente', h('strong', {}, 'NO ASISTIRÁ. '), 'Falta: ' + (r.faltantes || 'documentos') + '.'));
        } else {
          bloqueFinal.appendChild(M.ui.alerta('ok', h('strong', {}, 'SÍ ASISTE. '), 'Permisos completos.'));
        }
        if (r.autismo) bloqueFinal.appendChild(h('div', { class: 'chip-autismo' }, 'Diagnóstico de autismo registrado'));
        bloqueFinal.appendChild(h('button', { type: 'button', class: 'btn btn-primario', id: 'pm-otro',
          onclick: function () { selNino.value = ''; M.ui.vaciar(detalle); selNino.focus(); } }, 'Registrar otro niño'));
        detalle.appendChild(bloqueFinal);
        detalle.scrollIntoView({ behavior: 'smooth', block: 'start' });
        cargarNinos(); // actualiza el estatus en la lista
        if (opts.alGuardar) opts.alGuardar(r);
      }
    }

    return { abrir: abrir, cerrar: cerrar, estaAbierto: function () { return !panel.hidden; } };
  }

  M.permisos = { montar: montar };
})();
