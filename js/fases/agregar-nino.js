// Fase 1: agregar un niño que no aparece en la lista.
// Paso 1: nombre + escuela/grado/grupo y verificación contra la lista completa.
// Si ya está: alerta con su nombre, folio y opción de ir a registrar su cartita.
// Paso 2 (solo si no está): lo que pidió. El folio nuevo se asigna al final de la lista.
(function () {
  var M = window.Macro;
  var h = M.ui.h;

  function opciones(select, items, placeholder) {
    M.ui.vaciar(select);
    select.appendChild(h('option', { value: '' }, placeholder));
    items.forEach(function (it) { select.appendChild(h('option', { value: it.value }, it.label)); });
    select.disabled = items.length === 0;
  }

  // opts: { contenedor, catalogo, irAlNino(coincidencia), alGuardar(resultado) }
  function montar(opts) {
    // Puede ser el catálogo o una función que devuelve el más reciente.
    function catalogoActual() { return typeof opts.catalogo === 'function' ? opts.catalogo() : opts.catalogo; }
    var panel = h('section', { class: 'tarjeta panel-agregar', id: 'panel-agregar', hidden: true });
    opts.contenedor.appendChild(panel);

    function abrir() {
      panel.hidden = false;
      paso1({});
      panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    function cerrar() {
      if (panel.hidden) return;
      panel.hidden = true;
      M.ui.vaciar(panel);
      M.app.setDirty(false);
    }

    function etiquetaUbicacion(v) {
      return v.escuela + ' · ' + v.grado + (v.grupo ? ' ' + v.grupo : '');
    }

    // ---------- Paso 1 ----------
    function paso1(v) {
      M.ui.vaciar(panel);
      var catalogo = catalogoActual();
      var apellidos = h('input', { type: 'text', id: 'ag-apellidos', maxlength: '80', autocomplete: 'off', placeholder: 'Ej. Pérez López', value: v.apellidos || '' });
      var nombres = h('input', { type: 'text', id: 'ag-nombres', maxlength: '80', autocomplete: 'off', placeholder: 'Ej. Juan Carlos', value: v.nombres || '' });
      var selEscuela = h('select', { id: 'ag-escuela' });
      var selGrado = h('select', { id: 'ag-grado' });
      var selGrupo = h('select', { id: 'ag-grupo' });
      var campoGrupo = M.ui.campo('Grupo', selGrupo);
      var btn = h('button', { type: 'submit', class: 'btn btn-primario btn-grande' }, 'Verificar si ya está en la lista');
      var msg = h('div', { class: 'estado-busqueda' });

      opciones(selEscuela, catalogo.escuelas.map(function (e) { return { value: e.nombre, label: e.nombre }; }), 'Selecciona la escuela…');
      opciones(selGrado, [], 'Primero elige la escuela');
      opciones(selGrupo, [], '—');

      function escuelaActual() {
        return catalogo.escuelas.filter(function (e) { return e.nombre === selEscuela.value; })[0];
      }
      function gradoActual() {
        var esc = escuelaActual();
        return esc ? esc.grados.filter(function (g) { return g.grado === selGrado.value; })[0] : null;
      }
      function gruposDeGrado() { var g = gradoActual(); return g ? g.grupos : []; }
      function sinGrupos() { var gs = gruposDeGrado(); return gs.length === 1 && gs[0] === ''; }

      selEscuela.addEventListener('change', function () {
        var esc = escuelaActual();
        opciones(selGrado, esc ? esc.grados.map(function (g) { return { value: g.grado, label: g.grado }; }) : [], esc ? 'Selecciona el grado…' : 'Primero elige la escuela');
        opciones(selGrupo, [], '—');
        campoGrupo.hidden = false;
      });
      selGrado.addEventListener('change', function () {
        var gs = gruposDeGrado();
        if (!gradoActual()) { opciones(selGrupo, [], '—'); campoGrupo.hidden = false; return; }
        if (sinGrupos()) {
          campoGrupo.hidden = true;
          opciones(selGrupo, [{ value: '', label: 'Sin grupo' }], '');
        } else {
          campoGrupo.hidden = false;
          opciones(selGrupo, gs.map(function (x) { return { value: x, label: x === '' ? 'Sin grupo' : x }; }), 'Selecciona el grupo…');
        }
      });

      // Restaurar valores si el usuario vuelve del paso 2
      if (v.escuela) {
        selEscuela.value = v.escuela; selEscuela.dispatchEvent(new Event('change'));
        selGrado.value = v.grado; selGrado.dispatchEvent(new Event('change'));
        if (!campoGrupo.hidden) selGrupo.value = v.grupo || '';
      }

      var cancelar = h('button', { type: 'button', class: 'btn btn-secundario', id: 'ag-cancelar', onclick: cerrar }, 'Cancelar');

      panel.appendChild(h('form', { novalidate: true,
        oninput: function () { M.app.setDirty(true); },
        onsubmit: async function (ev) {
          ev.preventDefault();
          M.ui.vaciar(msg);
          var datos = {
            apellidos: apellidos.value.trim().replace(/\s+/g, ' '),
            nombres: nombres.value.trim().replace(/\s+/g, ' '),
            escuela: selEscuela.value,
            grado: selGrado.value,
            grupo: campoGrupo.hidden ? '' : (selGrupo.selectedIndex > 0 ? selGrupo.value : null)
          };
          var falta = null;
          if (!datos.apellidos) falta = ['Escribe los apellidos del niño.', apellidos];
          else if (!datos.nombres) falta = ['Escribe el nombre del niño.', nombres];
          else if (!datos.escuela) falta = ['Selecciona la escuela.', selEscuela];
          else if (!datos.grado) falta = ['Selecciona el grado.', selGrado];
          else if (datos.grupo === null) falta = ['Selecciona el grupo.', selGrupo];
          if (falta) { msg.appendChild(M.ui.alerta('warning', falta[0])); falta[1].focus(); return; }

          var r = await M.comun.conBoton(btn, 'Verificando…', function () {
            return M.api.get('buscarNino', { nombre: datos.apellidos + ' ' + datos.nombres });
          });
          if (!r) return;
          if (r.coincidencias.length) mostrarCoincidencias(datos, r.coincidencias);
          else paso2(datos, false);
        }
      },
        h('h2', { class: 'titulo-seccion' }, 'Agregar niño que no está en la lista'),
        h('p', { class: 'ayuda-panel' }, 'Primero se revisa que no esté ya en la lista (en cualquier escuela). El folio nuevo se asigna al final y los folios actuales no cambian.'),
        M.ui.campo('Apellidos *', apellidos),
        M.ui.campo('Nombre(s) *', nombres),
        M.ui.campo('Escuela *', selEscuela),
        M.ui.campo('Grado *', selGrado),
        campoGrupo,
        msg,
        btn,
        cancelar));
      apellidos.focus();
    }

    // ---------- Alerta: ya está en la lista ----------
    function mostrarCoincidencias(datos, lista) {
      M.ui.vaciar(panel);
      var hayExacta = lista.some(function (c) { return c.tipo === 'exacto'; });

      panel.appendChild(h('h2', { class: 'titulo-seccion' }, hayExacta ? 'Este niño YA está en la lista' : 'Hay nombres parecidos en la lista'));
      panel.appendChild(M.ui.alerta(hayExacta ? 'urgente' : 'warning',
        hayExacta
          ? 'No lo agregues otra vez. Registra su cartita con el folio que ya tiene.'
          : 'Revisa si es el mismo niño antes de agregarlo.'));

      lista.forEach(function (c) {
        panel.appendChild(h('div', { class: 'coincidencia coincidencia-' + c.tipo },
          h('span', { class: 'coincidencia-tipo' }, c.tipo === 'exacto' ? 'MISMO NOMBRE' : 'NOMBRE PARECIDO'),
          h('div', { class: 'coincidencia-etiqueta' }, 'Aparece como:'),
          h('div', { class: 'coincidencia-nombre' }, c.nombre),
          h('div', { class: 'coincidencia-folio' }, h('small', {}, 'FOLIO'), h('strong', {}, c.folio)),
          h('div', { class: 'coincidencia-ubicacion' }, etiquetaUbicacion(c)),
          c.hecha ? h('div', { class: 'coincidencia-hecha' }, 'Su cartita ya fue capturada') : null,
          h('button', { type: 'button', class: 'btn btn-primario btn-ir',
            onclick: function () { cerrar(); opts.irAlNino(c); } },
            c.hecha ? 'Ver / editar la cartita de este niño' : 'Registrar la cartita de este niño')));
      });

      panel.appendChild(h('p', { class: 'ayuda-panel' }, 'Solo si estás seguro de que es otro niño (por ejemplo, otro con el mismo nombre):'));
      panel.appendChild(h('button', { type: 'button', class: 'btn btn-secundario', id: 'ag-continuar',
        onclick: function () {
          if (hayExacta && !window.confirm('Ya existe un niño con ese mismo nombre. Si es el mismo niño se duplicará su folio.\n\n¿Seguro que es otro niño?')) return;
          paso2(datos, true);
        } }, 'No es el mismo niño, continuar'));
      panel.appendChild(h('button', { type: 'button', class: 'btn btn-secundario', id: 'ag-volver', onclick: function () { paso1(datos); } }, 'Volver y corregir los datos'));
      panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    // ---------- Paso 2: lo que pidió ----------
    function paso2(datos, confirmarDuplicado) {
      M.ui.vaciar(panel);
      var zapato = h('input', { type: 'text', inputmode: 'decimal', maxlength: '10', placeholder: 'Ej. 22 o 22.5' });
      var playera = h('input', { type: 'text', maxlength: '10', placeholder: 'Ej. 10, M, Chica' });
      var pantalon = h('input', { type: 'text', maxlength: '10', placeholder: 'Ej. 10, 28' });
      var regalo = h('input', { type: 'text', id: 'ag-regalo', maxlength: '200', placeholder: 'Lo que pidió el niño' });
      var biciSi = h('input', { type: 'radio', name: 'ag-bici', value: 'Sí' });
      var biciNo = h('input', { type: 'radio', name: 'ag-bici', value: 'No' });
      var btn = h('button', { type: 'submit', class: 'btn btn-primario btn-grande' }, 'Agregar niño y guardar cartita');
      var msg = h('div', { class: 'estado-busqueda' });

      panel.appendChild(h('form', { novalidate: true,
        oninput: function () { M.app.setDirty(true); },
        onsubmit: async function (ev) {
          ev.preventDefault();
          M.ui.vaciar(msg);
          if (!regalo.value.trim()) { msg.appendChild(M.ui.alerta('warning', 'Escribe el regalo que pidió el niño.')); regalo.focus(); return; }
          if (!biciSi.checked && !biciNo.checked) { msg.appendChild(M.ui.alerta('warning', 'Indica si pide bicicleta (Sí/No).')); return; }
          var envio = Object.assign({}, datos, {
            tallaZapato: zapato.value, tallaPlayera: playera.value, tallaPantalon: pantalon.value,
            regalo: regalo.value, bicicleta: biciSi.checked ? 'Sí' : 'No',
            confirmarDuplicado: !!confirmarDuplicado
          });
          var r = await M.comun.conBoton(btn, 'Guardando…', async function () {
            try {
              return await M.api.post('agregarNino', envio);
            } catch (e) {
              // Alguien más lo agregó mientras tanto: se vuelve a mostrar la alerta.
              if (e && e.codigo === 'YA_EN_LISTA' && e.extra && e.extra.coincidencias) {
                mostrarCoincidencias(datos, e.extra.coincidencias);
                return null;
              }
              throw e;
            }
          });
          if (!r) return;
          exito(r);
        }
      },
        h('h2', { class: 'titulo-seccion' }, 'Lo que pidió el niño'),
        h('div', { class: 'resumen-nuevo' },
          h('strong', {}, datos.apellidos + ' ' + datos.nombres),
          h('div', {}, etiquetaUbicacion(datos)),
          h('small', {}, 'No está en la lista: se agregará con un folio nuevo.')),
        M.ui.campo('Talla de zapato', zapato),
        M.ui.campo('Talla de playera / chamarra', playera),
        M.ui.campo('Talla de pantalón', pantalon),
        M.ui.campo('Regalo que pidió *', regalo),
        h('fieldset', { class: 'grupo-radio' },
          h('legend', {}, '¿Pide bicicleta? *'),
          h('label', { class: 'radio' }, biciSi, h('span', {}, 'Sí')),
          h('label', { class: 'radio' }, biciNo, h('span', {}, 'No'))),
        msg,
        btn,
        h('button', { type: 'button', class: 'btn btn-secundario', id: 'ag-volver-datos', onclick: function () { paso1(datos); } }, 'Volver y corregir los datos')));
      regalo.focus();
    }

    // ---------- Éxito ----------
    function exito(r) {
      M.app.setDirty(false);
      M.ui.toast('Niño agregado: folio ' + r.folio, 'ok');
      M.ui.vaciar(panel);
      panel.appendChild(h('div', { class: 'alerta-folio', role: 'alert', id: 'ag-folio-nuevo' },
        h('small', {}, 'FOLIO NUEVO'),
        h('strong', {}, r.folio),
        h('span', {}, 'Anota este folio en la carta física')));
      panel.appendChild(h('p', { class: 'nombre-nino' }, r.nombre));
      panel.appendChild(h('p', { class: 'ayuda-panel' }, r.escuela + ' · ' + r.grado + (r.grupo ? ' ' + r.grupo : '') + ' · Cartita guardada.'));
      panel.appendChild(h('button', { type: 'button', class: 'btn btn-primario', id: 'ag-otro', onclick: function () { paso1({}); } }, 'Agregar otro niño'));
      panel.appendChild(h('button', { type: 'button', class: 'btn btn-secundario', id: 'ag-terminar', onclick: cerrar }, 'Terminar'));
      panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
      if (opts.alGuardar) opts.alGuardar(r);
    }

    return { abrir: abrir, cerrar: cerrar, estaAbierto: function () { return !panel.hidden; } };
  }

  M.agregarNino = { montar: montar };
})();
