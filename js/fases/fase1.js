// Fase 1: Datos de la cartita (captura inicial).
(function () {
  var M = window.Macro;
  var h = M.ui.h;

  function opciones(select, items, placeholder) {
    M.ui.vaciar(select);
    select.appendChild(h('option', { value: '' }, placeholder));
    items.forEach(function (it) {
      select.appendChild(h('option', { value: it.value }, it.label));
    });
    select.disabled = items.length === 0;
  }

  M.fases[1] = {
    titulo: 'Fase 1 · Datos de la cartita',

    render: async function (root) {
      var catalogo = null;
      var ninos = [];
      var cargaEnCurso = Promise.resolve();
      var agregar = { cerrar: function () {} }; // se reemplaza al cargar el catálogo
      var permisos = { cerrar: function () {} }; // idem (registro de permisos)

      var selEscuela = h('select', { id: 'f1-escuela', required: true });
      var selGrado = h('select', { id: 'f1-grado', required: true });
      var selGrupo = h('select', { id: 'f1-grupo' });
      var selNino = h('select', { id: 'f1-nino', required: true });
      var campoGrupo = M.ui.campo('Grupo', selGrupo);
      var detalle = h('div', { class: 'detalle' });

      var seccion = h('section', { class: 'tarjeta' },
        h('h2', { class: 'titulo-seccion' }, 'Selecciona al niño'),
        M.ui.campo('Escuela', selEscuela),
        M.ui.campo('Grado', selGrado),
        campoGrupo,
        M.ui.campo('Nombre del niño', selNino));
      root.appendChild(seccion);
      root.appendChild(detalle);

      opciones(selEscuela, [], 'Cargando…');
      try {
        catalogo = await M.api.get('catalogo');
      } catch (e) {
        M.ui.vaciar(seccion);
        seccion.appendChild(M.ui.alerta('error', M.comun.mensajeError(e)));
        seccion.appendChild(h('button', { class: 'btn btn-primario', type: 'button', onclick: function () { M.app.recargarVista(); } }, 'Reintentar'));
        return;
      }
      rellenarEscuelas();
      opciones(selGrado, [], 'Primero elige la escuela');
      opciones(selGrupo, [], '—');
      opciones(selNino, [], 'Primero elige el grado');
      campoGrupo.hidden = false;

      function escuelaActual() {
        return catalogo.escuelas.filter(function (e) { return e.nombre === selEscuela.value; })[0];
      }
      function gradoActual() {
        var esc = escuelaActual();
        return esc ? esc.grados.filter(function (g) { return g.grado === selGrado.value; })[0] : null;
      }

      function rellenarEscuelas() {
        opciones(selEscuela, catalogo.escuelas.map(function (e) { return { value: e.nombre, label: e.nombre }; }), 'Selecciona la escuela…');
      }
      function rellenarGrados() {
        var esc = escuelaActual();
        opciones(selGrado, esc ? esc.grados.map(function (g) { return { value: g.grado, label: g.grado }; }) : [], esc ? 'Selecciona el grado…' : 'Primero elige la escuela');
      }
      // Devuelve true si el grado no tiene grupos (entonces el campo Grupo se oculta).
      function rellenarGrupos() {
        var g = gradoActual();
        if (!g) { opciones(selGrupo, [], '—'); campoGrupo.hidden = false; return false; }
        var soloSinGrupo = g.grupos.length === 1 && g.grupos[0] === '';
        if (soloSinGrupo) {
          campoGrupo.hidden = true;
          opciones(selGrupo, [{ value: '', label: 'Sin grupo' }], '');
          selGrupo.value = '';
        } else {
          campoGrupo.hidden = false;
          opciones(selGrupo, g.grupos.map(function (x) { return { value: x, label: x === '' ? 'Sin grupo' : x }; }), 'Selecciona el grupo…');
        }
        return soloSinGrupo;
      }

      selEscuela.addEventListener('change', function () {
        M.ui.vaciar(detalle);
        rellenarGrados();
        opciones(selGrupo, [], '—');
        campoGrupo.hidden = false;
        opciones(selNino, [], 'Primero elige el grado');
        ninos = [];
      });

      selGrado.addEventListener('change', function () {
        M.ui.vaciar(detalle);
        opciones(selNino, [], 'Selecciona el grupo…');
        ninos = [];
        if (rellenarGrupos()) cargarNinos();
      });

      selGrupo.addEventListener('change', function () {
        M.ui.vaciar(detalle);
        if (selGrupo.value === '' && selGrupo.selectedIndex === 0 && !campoGrupo.hidden) {
          opciones(selNino, [], 'Selecciona el grupo…');
          return;
        }
        cargarNinos();
      });

      function cargarNinos() {
        cargaEnCurso = cargarNinosAsync();
        return cargaEnCurso;
      }

      async function cargarNinosAsync() {
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
        opciones(selNino, ninos.map(function (n) {
          return { value: n.folio, label: n.nombre + (n.hecha ? '  ✔ ya capturada' : '') + (n.asistencia ? '  ·  ' + n.asistencia : '') };
        }), ninos.length ? 'Selecciona al niño… (' + ninos.length + ')' : 'No hay niños en este grupo');
        selNino.value = actual;
      }

      selNino.addEventListener('change', function () {
        var n = ninos.filter(function (x) { return x.folio === selNino.value; })[0];
        mostrarDetalle(n);
      });

      // Selecciona en la cascada a un niño que ya está en la lista (viene de la alerta de coincidencias).
      async function irAlNino(c) {
        selEscuela.value = c.escuela; selEscuela.dispatchEvent(new Event('change'));
        selGrado.value = c.grado; selGrado.dispatchEvent(new Event('change'));
        if (!campoGrupo.hidden) {
          selGrupo.value = c.grupo; selGrupo.dispatchEvent(new Event('change'));
        }
        await cargaEnCurso;
        selNino.value = c.folio;
        selNino.dispatchEvent(new Event('change'));
      }

      var contAgregar = h('div', { class: 'zona-agregar' });
      var btnAgregar = h('button', { type: 'button', class: 'btn btn-secundario', id: 'f1-agregar',
        onclick: function () {
          M.ui.vaciar(detalle);
          M.app.setDirty(false);
          selNino.value = '';
          permisos.cerrar();
          agregar.abrir();
        } }, '+ Agregar niño que no está en la lista');
      var btnPermisos = h('button', { type: 'button', class: 'btn btn-secundario', id: 'f1-permisos',
        onclick: function () {
          M.ui.vaciar(detalle);
          M.app.setDirty(false);
          selNino.value = '';
          agregar.cerrar();
          permisos.abrir();
        } }, 'Registro de permisos');
      contAgregar.appendChild(btnAgregar);
      contAgregar.appendChild(btnPermisos);
      root.insertBefore(contAgregar, detalle);
      agregar = M.agregarNino.montar({
        contenedor: contAgregar,
        catalogo: function () { return catalogo; }, // siempre el más reciente
        irAlNino: irAlNino,
        alGuardar: function (r) {
          // Si la lista que se está viendo es la del niño nuevo, se actualiza para que aparezca.
          var grupoVisible = campoGrupo.hidden ? '' : selGrupo.value;
          if (selEscuela.value === r.escuela && selGrado.value === r.grado && grupoVisible === r.grupo) cargarNinos();
        }
      });

      permisos = M.permisos.montar({
        contenedor: contAgregar,
        alGuardar: function () { refrescar(false); } // actualiza el estatus que se ve en la lista
      });

      // ---------- Actualización de la lista (altas/bajas hechas en el Sheet) ----------
      var firmaCatalogo = JSON.stringify(catalogo);
      var refrescando = false;

      // Aplica un catálogo nuevo conservando la selección si sigue siendo válida; si no, la reinicia.
      function aplicarCatalogo(nuevo) {
        var esc = selEscuela.value, gra = selGrado.value;
        var gru = (campoGrupo.hidden || selGrupo.selectedIndex > 0) ? selGrupo.value : null;
        catalogo = nuevo;
        rellenarEscuelas();
        var valida = true;
        selEscuela.value = esc;
        if (esc && selEscuela.value !== esc) valida = false;
        if (esc && valida) {
          rellenarGrados();
          selGrado.value = gra;
          if (gra && selGrado.value !== gra) valida = false;
        }
        if (gra && valida) {
          rellenarGrupos();
          if (!campoGrupo.hidden && gru !== null) {
            selGrupo.value = gru;
            if (selGrupo.value !== gru) valida = false;
          }
        }
        if (!valida) {
          selEscuela.value = '';
          rellenarGrados();
          opciones(selGrupo, [], '—');
          campoGrupo.hidden = false;
          opciones(selNino, [], 'Primero elige el grado');
          ninos = [];
          M.ui.vaciar(detalle);
          M.app.setDirty(false);
          M.ui.toast('La lista de escuelas cambió. Vuelve a seleccionar.', 'error');
        }
      }

      async function refrescarNinos() {
        var esc = selEscuela.value, gra = selGrado.value, gru = selGrupo.value;
        var nuevos = await M.api.get('ninos', { escuela: esc, grado: gra, grupo: gru });
        // Si mientras tanto cambió la selección, esta respuesta ya no aplica.
        if (esc !== selEscuela.value || gra !== selGrado.value || gru !== selGrupo.value) return;
        if (JSON.stringify(nuevos) === JSON.stringify(ninos)) return;
        var actual = selNino.value;
        ninos = nuevos;
        pintarNinos();
        if (actual && selNino.value !== actual) {
          M.ui.vaciar(detalle);
          M.app.setDirty(false);
          M.ui.toast('El niño que tenías seleccionado ya no está en la lista.', 'error');
        }
      }

      async function refrescar(manual) {
        if (refrescando) return;
        refrescando = true;
        try {
          var cat = await M.api.get('catalogo');
          var firma = JSON.stringify(cat);
          if (firma !== firmaCatalogo) { firmaCatalogo = firma; aplicarCatalogo(cat); }
          if (selGrado.value && (campoGrupo.hidden || selGrupo.selectedIndex > 0)) await refrescarNinos();
          if (manual) M.ui.toast('Lista actualizada.', 'ok');
        } catch (e) {
          if (manual) M.ui.toast(M.comun.mensajeError(e), 'error');
        } finally {
          refrescando = false;
        }
      }

      var btnActualizar = h('button', { type: 'button', class: 'btn btn-secundario btn-chico btn-actualizar', id: 'f1-actualizar',
        onclick: function () { refrescar(true); } }, '↻ Actualizar lista');
      seccion.appendChild(btnActualizar);
      M.app.alRefrescar(function () { return refrescar(false); }); // cada ciclo de revisión y al volver a la pestaña

      function mostrarDetalle(n) {
        M.ui.vaciar(detalle);
        M.app.setDirty(false);
        if (!n) return;
        agregar.cerrar();
        permisos.cerrar();

        var d = n.datos || {};
        var zapato = h('input', { type: 'text', inputmode: 'decimal', maxlength: '10', placeholder: 'Ej. 22 o 22.5', value: d.tallaZapato || '' });
        var playera = h('input', { type: 'text', maxlength: '10', placeholder: 'Ej. 10, M, Chica', value: d.tallaPlayera || '' });
        var pantalon = h('input', { type: 'text', maxlength: '10', placeholder: 'Ej. 10, 28', value: d.tallaPantalon || '' });
        var regalo = h('input', { type: 'text', maxlength: '200', required: true, placeholder: 'Lo que pidió el niño', value: d.regalo || '' });
        var biciSi = h('input', { type: 'radio', name: 'f1-bici', value: 'Sí', checked: d.bicicleta === 'Sí' });
        var biciNo = h('input', { type: 'radio', name: 'f1-bici', value: 'No', checked: d.bicicleta === 'No' });
        var btn = h('button', { type: 'submit', class: 'btn btn-primario btn-grande' }, 'Guardar cartita');
        var msg = h('div', { class: 'estado-busqueda' });

        var form = h('form', { class: 'tarjeta', novalidate: true,
          oninput: function () { M.app.setDirty(true); },
          onsubmit: async function (ev) {
            ev.preventDefault();
            M.ui.vaciar(msg);
            if (!regalo.value.trim()) { msg.appendChild(M.ui.alerta('warning', 'Escribe el regalo que pidió el niño.')); regalo.focus(); return; }
            if (!biciSi.checked && !biciNo.checked) { msg.appendChild(M.ui.alerta('warning', 'Indica si pide bicicleta (Sí/No).')); return; }
            var datos = {
              folio: n.folio,
              tallaZapato: zapato.value, tallaPlayera: playera.value, tallaPantalon: pantalon.value,
              regalo: regalo.value, bicicleta: biciSi.checked ? 'Sí' : 'No'
            };
            var r = await M.comun.conBoton(btn, 'Guardando…', function () { return M.comun.enviar('fase1', datos); });
            if (!r) return;
            n.hecha = true;
            n.datos = { tallaZapato: zapato.value.trim(), tallaPlayera: playera.value.trim(), tallaPantalon: pantalon.value.trim(), regalo: regalo.value.trim(), bicicleta: datos.bicicleta };
            M.app.setDirty(false);
            M.ui.toast('Cartita guardada: folio ' + r.folio, 'ok');
            selNino.value = '';
            pintarNinos();
            M.ui.vaciar(detalle);
            detalle.appendChild(M.ui.alerta('ok', h('strong', {}, 'Guardado. '), 'Folio ' + r.folio + ' · ' + r.nombre + '. Selecciona al siguiente niño.'));
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }
        },
          h('h2', { class: 'titulo-seccion' }, 'Datos de la cartita'),
          M.ui.campo('Talla de zapato', zapato),
          M.ui.campo('Talla de playera / chamarra', playera),
          M.ui.campo('Talla de pantalón', pantalon),
          M.ui.campo('Regalo que pidió *', regalo),
          h('fieldset', { class: 'grupo-radio' },
            h('legend', {}, '¿Pide bicicleta? *'),
            h('label', { class: 'radio' }, biciSi, h('span', {}, 'Sí')),
            h('label', { class: 'radio' }, biciNo, h('span', {}, 'No'))),
          msg,
          btn);

        detalle.appendChild(h('div', { class: 'alerta-folio', role: 'alert' },
          h('small', {}, 'FOLIO'),
          h('strong', {}, n.folio),
          h('span', {}, 'Anota este folio en la carta física')));
        detalle.appendChild(h('p', { class: 'nombre-nino' }, n.nombre));
        detalle.appendChild(M.comun.etiquetaEstatus(n)); // estatus de permisos (informativo)
        if (n.hecha) {
          detalle.appendChild(M.ui.alerta('warning', 'Este niño ya tiene su cartita capturada. Si guardas, se sobrescribirán los datos.'));
        }
        detalle.appendChild(form);
        detalle.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }
  };
})();
