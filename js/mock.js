// MODO PRUEBA: imita la API de Apps Script con datos de ejemplo guardados en localStorage.
// Se activa cuando API_URL está vacía en config.js (o con ?mock=1). No toca el Sheet real.
(function () {
  var M = window.Macro = window.Macro || {};
  var DB_KEY = 'macroposada_mock_db_v1';
  var FASE_KEY = 'macroposada_mock_fase';

  function nuevo(folio, nombre, escuela, grado, grupo, fila, columna) {
    return {
      folio: folio, nombre: nombre, escuela: escuela, grado: grado, grupo: grupo,
      hecha: false, tallaZapato: '', tallaPlayera: '', tallaPantalon: '', regalo: '', bicicleta: '',
      padrino: '', telefono: '', entrego: '', fechaApadrinamiento: '',
      urlFoto: '', recibio: '', esLoPedido: '', incidencia: '', fechaRecepcion: '',
      filaRegalo: fila || '', columnaRegalo: columna || '',
      entregado: false, iniciales: '', fechaEntrega: ''
    };
  }

  function semilla() {
    return [
      nuevo(1, 'Ayala Valtierra Angel Javier', 'Juan de la Barrera', '1o', 'A', '3', 'C'),
      nuevo(2, 'Becerra Santoyo Dorian Alejandro', 'Juan de la Barrera', '1o', 'A', '3', 'D'),
      nuevo(3, 'Carranza Robledo Luisa Ashley', 'Juan de la Barrera', '1º', 'B', '', ''),
      nuevo(4, 'Cruz Canizales Juan Manuel', 'Juan de la Barrera', '2o', 'A', '1', 'A'),
      nuevo(5, 'Diaz Martin Del Campo Carlos Gerardo', 'Juan de la Barrera', '2º', 'A', '1', 'B'),
      nuevo(6, 'Flores Villalobos Ania Yamilet', 'Dr. Franco Guel Jimenez', '3o', 'A', '2', 'A'),
      nuevo(7, 'Gomez Flores Victoria Regina', 'Dr. Franco Guel Jimenez', '3o', 'A', '2', 'B'),
      nuevo(8, 'Gutierrez Silva Miguel Alexander', 'Dr. Franco Guel Jimenez', '3o', 'B', '', ''),
      nuevo(9, 'Lopez Ramirez Sofia', 'Octavio Paz', '4o', '', '4', 'A'),
      nuevo(10, 'Mendoza Ruiz Daniel', 'Octavio Paz', '4o', '', '4', 'B'),
      nuevo(11, 'Navarro Torres Camila', 'Octavio Paz', '5o', '', '4', 'C')
    ];
  }

  function cargar() {
    try {
      var s = localStorage.getItem(DB_KEY);
      if (s) return JSON.parse(s);
    } catch (e) { /* ignorar */ }
    return semilla();
  }
  function guardar(db) {
    try { localStorage.setItem(DB_KEY, JSON.stringify(db)); } catch (e) { /* ignorar */ }
  }

  function fail(msg, codigo) {
    var e = new Error(msg);
    e.codigo = codigo || 'ERROR';
    throw e;
  }

  function normGrado(v) {
    var s = String(v == null ? '' : v).trim();
    var m = /^(\d+)\s*[oOº°]?$/.exec(s);
    return m ? m[1] + 'º' : s;
  }
  function fmt(n) { return String(n).padStart(3, '0'); }
  function ahora() { return new Date().toISOString().replace('T', ' ').slice(0, 19); }

  function faseActual() {
    var f = parseInt(localStorage.getItem(FASE_KEY), 10);
    return f >= 0 && f <= 4 ? f : 1;
  }
  function exigirFase(fase, esperada) {
    if (fase === 0) fail('La captura aún no está habilitada.', 'FASE_INACTIVA');
    if (fase !== esperada) fail('Esta acción no corresponde a la fase activa (Fase ' + fase + '). Recarga la página.', 'FASE_INCORRECTA');
  }
  function exigirFaseEn(fase, permitidas) {
    if (fase === 0) fail('La captura aún no está habilitada.', 'FASE_INACTIVA');
    if (permitidas.indexOf(fase) < 0) fail('Esta acción no corresponde a la fase activa (Fase ' + fase + '). Recarga la página.', 'FASE_INCORRECTA');
  }
  function buscar(db, folio) {
    var n = parseInt(String(folio || '').replace(/\D/g, ''), 10);
    if (isNaN(n)) fail('Escribe un folio válido (solo números).', 'VALIDACION');
    var r = db.filter(function (x) { return x.folio === n; })[0];
    if (!r) fail('El folio ' + fmt(n) + ' no existe.', 'NO_ENCONTRADO');
    return r;
  }

  function catalogo(db) {
    var arbol = {};
    db.forEach(function (r) {
      var g = normGrado(r.grado);
      arbol[r.escuela] = arbol[r.escuela] || {};
      arbol[r.escuela][g] = arbol[r.escuela][g] || {};
      arbol[r.escuela][g][r.grupo] = true;
    });
    return {
      escuelas: Object.keys(arbol).sort().map(function (esc) {
        return {
          nombre: esc,
          grados: Object.keys(arbol[esc]).sort().map(function (g) {
            return { grado: g, grupos: Object.keys(arbol[esc][g]).sort() };
          })
        };
      })
    };
  }

  // ---- Búsqueda de nombres (misma lógica que apps-script/Fases.gs) ----
  var PARTICULAS = ['de', 'del', 'la', 'las', 'los', 'y', 'e', 'da', 'van', 'von'];
  function tokens(s) {
    var vistos = {};
    return String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
      .replace(/[^a-z\s]/g, ' ').split(/\s+/).filter(function (t) {
        if (!t || PARTICULAS.indexOf(t) >= 0 || vistos[t]) return false;
        vistos[t] = true;
        return true;
      });
  }
  function distancia(a, b) {
    var prev = [], i, j;
    for (j = 0; j <= b.length; j++) prev[j] = j;
    for (i = 1; i <= a.length; i++) {
      var cur = [i];
      for (j = 1; j <= b.length; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = cur;
    }
    return prev[b.length];
  }
  function tokenIgual(a, b) { return a === b || (a.length >= 5 && b.length >= 5 && distancia(a, b) <= 1); }
  function comparar(a, b) {
    if (!a.length || !b.length) return null;
    if (a.length === b.length && a.every(function (x) { return b.indexOf(x) >= 0; })) return 'exacto';
    var n = a.filter(function (x) { return b.some(function (y) { return tokenIgual(x, y); }); }).length;
    return n >= 2 && n >= Math.min(a.length, b.length) ? 'parecido' : null;
  }
  function coincidencias(db, nombre) {
    var tk = tokens(nombre);
    var lista = [];
    db.forEach(function (r) {
      var tipo = comparar(tk, tokens(r.nombre));
      if (tipo) lista.push({ tipo: tipo, folio: fmt(r.folio), nombre: r.nombre, escuela: r.escuela, grado: normGrado(r.grado), grupo: r.grupo, hecha: r.hecha });
    });
    lista.sort(function (x, y) { return (x.tipo === y.tipo ? 0 : x.tipo === 'exacto' ? -1 : 1) || (x.folio < y.folio ? -1 : 1); });
    return lista.slice(0, 6);
  }
  function titulo(s) {
    return String(s || '').replace(/\s+/g, ' ').trim().toLowerCase().replace(/(^|\s)(\S)/g, function (m, a, b) { return a + b.toUpperCase(); });
  }

  // ---- Permisos (misma lógica que apps-script/Permisos.gs) ----
  var DOCS_MOCK = [
    { clave: 'carta', nombre: 'Carta de autorización' },
    { clave: 'responsiva', nombre: 'Carta responsiva / deslindado' },
    { clave: 'ine', nombre: 'INE del padre o tutor' }
  ];
  var TIPOS_MOCK = ['NSS (IMSS)', 'ISSSTE', 'Gastos Médicos Mayores'];
  function perm(r) {
    if (!r.permisos) {
      r.permisos = { registrado: false, docs: { carta: 0, responsiva: 0, ine: 0 }, tipoSeguro: '', seguro: '', autismo: false, discapacidad: false, discapacidadDesc: '', notas: '' };
    }
    return r.permisos;
  }
  function seguroValidoMock(tipo, texto) {
    texto = String(texto || '').trim();
    if (!tipo || !texto) return false;
    if (tipo === 'NSS (IMSS)') return /^\d{11}$/.test(texto.replace(/[\s-]/g, ''));
    return texto.length >= 3;
  }
  function mascara(s) {
    s = String(s || '');
    if (!s) return '';
    return s.length > 4 ? new Array(s.length - 3).join('\u2022') + s.slice(-4) : '\u2022\u2022\u2022\u2022';
  }
  function calc(r) {
    var p = perm(r);
    var n = 0, faltan = [];
    DOCS_MOCK.forEach(function (d) { if (p.docs[d.clave] > 0) n++; else faltan.push(d.nombre); });
    var nssOk = seguroValidoMock(p.tipoSeguro, p.seguro);
    if (!nssOk) faltan.push('NSS / Gastos Médicos Mayores');
    var registrado = n > 0 || p.registrado;
    var estatus = !registrado ? '' : n === 0 ? 'Ninguno' : (n < 3 || !nssOk) ? 'Incompletos' : 'Completos';
    return {
      registrado: registrado, entregados: n, nssOk: nssOk, estatus: estatus,
      asistencia: estatus === '' ? '' : estatus === 'Completos' ? 'Sí asiste' : 'NO ASISTIRÁ',
      faltantes: (estatus === '' || estatus === 'Completos') ? '' : faltan.join(', ')
    };
  }

  function handle(accion, p) {
    return new Promise(function (resolve, reject) {
      setTimeout(function () {
        try { resolve(ejecutar(accion, p)); } catch (e) { reject(e); }
      }, 250); // latencia simulada
    });
  }

  function ejecutar(accion, p) {
    var db = cargar();
    var fase = faseActual();

    if (accion === 'config') return { fase: fase, requierePin: false };
    if (accion === 'ping') return { ok: true };

    if (accion === 'catalogo') { exigirFaseEn(fase, [1, 2]); return catalogo(db); }

    if (accion === 'ninos') {
      exigirFaseEn(fase, [1, 2]);
      return db.filter(function (r) {
        return r.escuela === p.escuela && normGrado(r.grado) === normGrado(p.grado) && r.grupo === (p.grupo || '');
      }).map(function (r) {
        var cn = calc(r);
        var it = { folio: fmt(r.folio), nombre: r.nombre, hecha: r.hecha, estatus: cn.estatus, asistencia: cn.asistencia, faltantes: cn.faltantes };
        if (r.hecha) it.datos = { tallaZapato: r.tallaZapato, tallaPlayera: r.tallaPlayera, tallaPantalon: r.tallaPantalon, regalo: r.regalo, bicicleta: r.bicicleta };
        return it;
      }).sort(function (a, b) { return a.nombre.localeCompare(b.nombre, 'es'); });
    }

    if (accion === 'folio') {
      if (fase < 2) exigirFase(fase, 2);
      var r = buscar(db, p.folio);
      var out = { folio: fmt(r.folio), nombre: r.nombre, escuela: r.escuela, grado: normGrado(r.grado), grupo: r.grupo, cartitaHecha: r.hecha };
      if (fase === 2) { var c2 = calc(r); out.permisos = { estatus: c2.estatus, asistencia: c2.asistencia, faltantes: c2.faltantes }; }
      if (fase === 2 && r.padrino) out.padrinoActual = { padrino: r.padrino, telefono: r.telefono, entrego: r.entrego, fecha: r.fechaApadrinamiento };
      if (fase === 3) {
        out.pidio = { regalo: r.regalo, bicicleta: r.bicicleta, tallaZapato: r.tallaZapato, tallaPlayera: r.tallaPlayera, tallaPantalon: r.tallaPantalon };
        if (r.recibio) out.recibidoActual = { recibio: r.recibio, esLoPedido: r.esLoPedido, incidencia: r.incidencia, url: r.urlFoto, fecha: r.fechaRecepcion };
      }
      if (fase === 4) {
        out.ubicacion = { fila: r.filaRegalo, columna: r.columnaRegalo };
        out.regalo = r.regalo;
        if (r.entregado) out.entregadoActual = { iniciales: r.iniciales, fecha: r.fechaEntrega };
      }
      return out;
    }

    if (accion === 'permisos') {
      exigirFaseEn(fase, [1, 2]);
      var rp = buscar(db, p.folio), pp = perm(rp), cp = calc(rp);
      var documentos = {};
      DOCS_MOCK.forEach(function (d) { documentos[d.clave] = { nombre: d.nombre, archivos: pp.docs[d.clave] }; });
      return {
        folio: fmt(rp.folio), nombre: rp.nombre, escuela: rp.escuela, grado: normGrado(rp.grado), grupo: rp.grupo, cartitaHecha: rp.hecha,
        documentos: documentos, tipoSeguro: pp.tipoSeguro, seguroRegistrado: !!pp.seguro, seguroValido: cp.nssOk, seguroMascara: mascara(pp.seguro),
        autismo: pp.autismo, discapacidad: pp.discapacidad, discapacidadDescripcion: pp.discapacidadDesc, notas: pp.notas,
        registrado: cp.registrado, estatus: cp.estatus, asistencia: cp.asistencia, faltantes: cp.faltantes
      };
    }

    if (accion === 'guardarPermisos') {
      exigirFaseEn(fase, [1, 2]);
      var rg = buscar(db, p.folio), pg = perm(rg);
      var resultado = String(p.resultado || '');
      if (['completo', 'parcial', 'ninguno'].indexOf(resultado) < 0) fail('Indica qué entregó el padre o tutor.', 'VALIDACION');
      var tipo = String(p.tipoSeguro || '').trim(), seguro = String(p.seguro || '').trim();
      if (tipo && TIPOS_MOCK.indexOf(tipo) < 0) fail('Tipo de seguro no válido.', 'VALIDACION');
      if (seguro && !tipo) fail('Elige el tipo de seguro (NSS, ISSSTE o Gastos Médicos Mayores).', 'VALIDACION');
      if (seguro && tipo === 'NSS (IMSS)') {
        var dig = seguro.replace(/[\s-]/g, '');
        if (!/^\d{11}$/.test(dig)) fail('El NSS debe tener 11 dígitos.', 'VALIDACION');
        seguro = dig;
      } else if (seguro && seguro.length < 3) {
        fail('Escribe el número completo del seguro.', 'VALIDACION');
      }
      var disc = p.discapacidad === true, descDisc = String(p.discapacidadDescripcion || '').trim();
      if (disc && !descDisc) fail('Describe la discapacidad.', 'VALIDACION');
      var entrada = p.docs || {}, nuevos = {}, finales = 0, sinArchivo = [];
      DOCS_MOCK.forEach(function (d) {
        var e = entrada[d.clave] || {};
        var arch = Array.isArray(e.archivos) ? e.archivos : [];
        if (arch.length > 6) fail('Máximo 6 archivos por documento (' + d.nombre + ').', 'VALIDACION');
        arch.forEach(function (a) {
          if (!/^data:(image\/(jpeg|png|webp)|application\/pdf);base64,/.test(String((a && a.data) || ''))) fail('Formato de archivo no válido en "' + d.nombre + '" (usa foto o PDF).', 'VALIDACION');
        });
        var ya = e.reemplazar === true ? 0 : pg.docs[d.clave];
        nuevos[d.clave] = { reemplazar: e.reemplazar === true, n: arch.length };
        if (ya + arch.length > 0) finales++; else sinArchivo.push(d.nombre);
      });
      if (resultado === 'completo' && finales !== 3) fail('Marcaste que entregó los 3 documentos, pero falta archivo de: ' + sinArchivo.join(', ') + '.', 'VALIDACION');
      if (resultado === 'parcial' && finales === 3) fail('Ya están los 3 documentos: elige "Entregó los 3 documentos".', 'VALIDACION');
      if (resultado === 'parcial' && finales === 0) fail('No hay ningún documento: sube al menos uno o elige "No entregó ningún documento".', 'VALIDACION');
      if (resultado === 'ninguno' && finales !== 0) fail('Marcaste que no entregó documentos, pero ya hay ' + finales + ' registrado(s). Elige otra opción.', 'VALIDACION');
      DOCS_MOCK.forEach(function (d) { pg.docs[d.clave] = (nuevos[d.clave].reemplazar ? 0 : pg.docs[d.clave]) + nuevos[d.clave].n; });
      if (seguro) { pg.tipoSeguro = tipo; pg.seguro = seguro; }
      pg.autismo = p.autismo === true;
      pg.discapacidad = disc;
      pg.discapacidadDesc = disc ? descDisc : '';
      pg.notas = String(p.notas || '').trim();
      pg.registrado = true;
      guardar(db);
      var cg = calc(rg);
      return {
        folio: fmt(rg.folio), nombre: rg.nombre, estatus: cg.estatus, asistencia: cg.asistencia, faltantes: cg.faltantes,
        documentos: { carta: pg.docs.carta, responsiva: pg.docs.responsiva, ine: pg.docs.ine }, autismo: pg.autismo, discapacidad: pg.discapacidad
      };
    }

    if (accion === 'buscarNino') {
      exigirFase(fase, 1);
      if (tokens(p.nombre).length < 2) fail('Escribe al menos un nombre y un apellido.', 'VALIDACION');
      return { coincidencias: coincidencias(db, p.nombre) };
    }

    if (accion === 'agregarNino') {
      exigirFase(fase, 1);
      var ap = titulo(p.apellidos), no = titulo(p.nombres);
      if (!ap) fail('Escribe los apellidos del niño.', 'VALIDACION');
      if (!no) fail('Escribe el nombre del niño.', 'VALIDACION');
      var nombreNuevo = ap + ' ' + no;
      var gradoN = normGrado(p.grado), grupoN = String(p.grupo || '').trim();
      var existe = db.some(function (r) { return r.escuela === p.escuela && normGrado(r.grado) === gradoN && r.grupo === grupoN; });
      if (!existe) fail('Esa combinación de escuela, grado y grupo no existe en la lista.', 'VALIDACION');
      if (!String(p.regalo || '').trim()) fail('Escribe el regalo que pidió el niño.', 'VALIDACION');
      if (p.bicicleta !== 'Sí' && p.bicicleta !== 'No') fail('Indica si pide bicicleta (Sí/No).', 'VALIDACION');
      var coinc = coincidencias(db, nombreNuevo);
      if (coinc.length && !p.confirmarDuplicado) {
        var ed = new Error('Este niño ya aparece en la lista.');
        ed.codigo = 'YA_EN_LISTA';
        ed.extra = { coincidencias: coinc };
        throw ed;
      }
      var max = db.reduce(function (m, r) { return Math.max(m, r.folio); }, 0);
      var nr = nuevo(max + 1, nombreNuevo, p.escuela, gradoN, grupoN);
      nr.hecha = true;
      nr.tallaZapato = String(p.tallaZapato || '').trim();
      nr.tallaPlayera = String(p.tallaPlayera || '').trim();
      nr.tallaPantalon = String(p.tallaPantalon || '').trim();
      nr.regalo = String(p.regalo).trim();
      nr.bicicleta = p.bicicleta;
      db.push(nr);
      guardar(db);
      return { folio: fmt(nr.folio), nombre: nombreNuevo, escuela: p.escuela, grado: gradoN, grupo: grupoN, nuevo: true };
    }

    if (accion === 'fase1') {
      exigirFase(fase, 1);
      var r1 = buscar(db, p.folio);
      if (!String(p.regalo || '').trim()) fail('Escribe el regalo que pidió el niño.', 'VALIDACION');
      if (p.bicicleta !== 'Sí' && p.bicicleta !== 'No') fail('Indica si pide bicicleta (Sí/No).', 'VALIDACION');
      if (r1.hecha && !p.sobrescribir) fail('Este folio ya tiene la cartita capturada.', 'YA_EXISTE');
      r1.tallaZapato = String(p.tallaZapato || '').trim();
      r1.tallaPlayera = String(p.tallaPlayera || '').trim();
      r1.tallaPantalon = String(p.tallaPantalon || '').trim();
      r1.regalo = String(p.regalo).trim();
      r1.bicicleta = p.bicicleta;
      r1.hecha = true;
      guardar(db);
      return { folio: fmt(r1.folio), nombre: r1.nombre };
    }

    if (accion === 'fase2') {
      exigirFase(fase, 2);
      var r2 = buscar(db, p.folio);
      var tel = String(p.telefono || '').replace(/\D/g, '');
      if (!String(p.padrino || '').trim()) fail('Escribe el nombre completo del padrino.', 'VALIDACION');
      if (tel.length < 10 || tel.length > 13) fail('El teléfono debe tener 10 dígitos.', 'VALIDACION');
      if (!String(p.entrego || '').trim()) fail('Escribe el nombre de quien entregó la cartita.', 'VALIDACION');
      if (r2.padrino && !p.sobrescribir) fail('Este folio ya tiene padrino registrado.', 'YA_EXISTE');
      r2.padrino = String(p.padrino).trim(); r2.telefono = tel; r2.entrego = String(p.entrego).trim();
      r2.fechaApadrinamiento = ahora();
      guardar(db);
      return { folio: fmt(r2.folio), nombre: r2.nombre };
    }

    if (accion === 'fase3') {
      exigirFase(fase, 3);
      var r3 = buscar(db, p.folio);
      if (!String(p.recibio || '').trim()) fail('Escribe el nombre de quien recibe el regalo.', 'VALIDACION');
      if (p.esLoPedido !== 'Sí' && p.esLoPedido !== 'No') fail('Indica si es lo que pidió el niño.', 'VALIDACION');
      if (!p.foto) fail('Falta la foto del regalo.', 'VALIDACION');
      if (r3.recibio && !p.sobrescribir) fail('Este regalo ya fue registrado como recibido.', 'YA_EXISTE');
      r3.recibio = String(p.recibio).trim(); r3.esLoPedido = p.esLoPedido;
      r3.incidencia = p.esLoPedido === 'No' ? 'Sí' : 'No';
      r3.urlFoto = 'https://drive.google.com/mock/foto-' + fmt(r3.folio);
      r3.fechaRecepcion = ahora();
      guardar(db);
      return { folio: fmt(r3.folio), nombre: r3.nombre, incidencia: p.esLoPedido === 'No', url: r3.urlFoto };
    }

    if (accion === 'fase4') {
      exigirFase(fase, 4);
      var r4 = buscar(db, p.folio);
      if (p.entregado !== true) fail('Marca la casilla "Entregado".', 'VALIDACION');
      var ini = String(p.iniciales || '').toUpperCase().replace(/[^A-ZÁÉÍÓÚÑ]/g, '');
      if (ini.length < 1 || ini.length > 6) fail('Escribe tus iniciales (1 a 6 letras).', 'VALIDACION');
      if (r4.entregado && !p.sobrescribir) fail('Este regalo ya está marcado como entregado.', 'YA_EXISTE');
      r4.entregado = true; r4.iniciales = ini; r4.fechaEntrega = ahora();
      guardar(db);
      return { folio: fmt(r4.folio), nombre: r4.nombre };
    }

    fail('Acción desconocida.', 'BAD_REQUEST');
  }

  M.mock = {
    handle: handle,
    faseActual: faseActual,
    datos: cargar,
    guardarDatos: guardar,
    setFase: function (n) { localStorage.setItem(FASE_KEY, String(n)); },
    reiniciar: function () { localStorage.removeItem(DB_KEY); }
  };
})();
