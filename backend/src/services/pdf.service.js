const PDFDocument = require('pdfkit');

/* ============================================================
   Paleta institucional — se corresponde con el frontend
   ============================================================ */
const C = {
  tinta:     '#0F1B24',
  panel:     '#16232E',
  texto:     '#233040',
  suave:     '#5C6B7A',
  linea:     '#D7DEE5',
  fondoFila: '#F2F5F8',
  verde:     '#1F9D63',
  amarillo:  '#E0A50B',
  naranja:   '#E2601C',
  rojo:      '#C42B2B',
  acento:    '#0E7C8C'
};

const COLOR_NIVEL = { verde: C.verde, amarillo: C.amarillo, naranja: C.naranja, rojo: C.rojo };

const MARGEN = 48;

/* ---------- utilidades ---------- */
const fecha = (v) => v ? new Date(v).toLocaleString('es-PE', { dateStyle: 'medium', timeStyle: 'short' }) : '—';
const texto = (v) => (v === null || v === undefined || v === '') ? '—' : String(v);
const coord = (v) => v == null ? '—' : Number(v).toFixed(6);

/**
 * Crea el documento con encabezado, franja de nivel y pie numerado.
 */
function crearDocumento({ titulo, subtitulo, nivel = 'verde', codigo = null }) {
  const doc = new PDFDocument({
    size: 'A4',
    margins: { top: 130, bottom: 70, left: MARGEN, right: MARGEN },
    bufferPages: true,
    info: { Title: titulo, Author: process.env.ORG_NOMBRE || 'Centro de Operaciones de Emergencia' }
  });

  doc.on('pageAdded', () => encabezado(doc, { titulo, subtitulo, nivel, codigo }));
  encabezado(doc, { titulo, subtitulo, nivel, codigo });
  return doc;
}

function encabezado(doc, { titulo, subtitulo, nivel, codigo }) {
  const ancho = doc.page.width;
  const colorNivel = COLOR_NIVEL[nivel] || C.verde;

  // Banda superior
  doc.save();
  doc.rect(0, 0, ancho, 88).fill(C.tinta);

  // Franja de nivel de alerta (elemento identitario del sistema)
  doc.rect(0, 88, ancho, 7).fill(colorNivel);

  // Marca institucional
  doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(9)
     .text((process.env.ORG_SIGLA || 'COE') + ' · ' + (process.env.ORG_NOMBRE || 'Centro de Operaciones de Emergencia'),
           MARGEN, 24, { characterSpacing: 1.2 });

  doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(17)
     .text(titulo, MARGEN, 40, { width: ancho - MARGEN * 2 - 150 });

  if (subtitulo) {
    doc.fillColor('#9FB2C0').font('Helvetica').fontSize(9)
       .text(subtitulo, MARGEN, 64, { width: ancho - MARGEN * 2 - 150 });
  }

  // Sello de nivel a la derecha
  const w = 132, x = ancho - MARGEN - w;
  doc.roundedRect(x, 30, w, 40, 3).fill(colorNivel);
  doc.fillColor('#FFFFFF').font('Helvetica').fontSize(7)
     .text('NIVEL DE ALERTA', x, 38, { width: w, align: 'center', characterSpacing: 1 });
  doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(15)
     .text(String(nivel).toUpperCase(), x, 49, { width: w, align: 'center', characterSpacing: 2 });

  if (codigo) {
    doc.fillColor(C.suave).font('Courier').fontSize(8)
       .text(codigo, MARGEN, 104, { width: ancho - MARGEN * 2, align: 'right' });
  }
  doc.restore();
  doc.y = 118;
}

function pie(doc) {
  const rango = doc.bufferedPageRange();
  for (let i = rango.start; i < rango.start + rango.count; i++) {
    doc.switchToPage(i);
    const y = doc.page.height - 46;
    doc.save();
    doc.moveTo(MARGEN, y).lineTo(doc.page.width - MARGEN, y).lineWidth(0.6).stroke(C.linea);
    doc.fillColor(C.suave).font('Helvetica').fontSize(7.5);
    doc.text(`Documento generado por SIGMA-SCI el ${new Date().toLocaleString('es-PE')} · Uso oficial`,
      MARGEN, y + 8, { width: doc.page.width - MARGEN * 2 });
    doc.text(`Página ${i + 1} de ${rango.count}`, MARGEN, y + 8,
      { width: doc.page.width - MARGEN * 2, align: 'right' });
    doc.restore();
  }
}

/* ---------- bloques reutilizables ---------- */
function seccion(doc, rotulo) {
  if (doc.y > doc.page.height - 140) doc.addPage();
  doc.moveDown(0.8);
  const y = doc.y;
  doc.save();
  doc.rect(MARGEN, y, 3, 13).fill(C.acento);
  doc.fillColor(C.tinta).font('Helvetica-Bold').fontSize(10.5)
     .text(rotulo.toUpperCase(), MARGEN + 10, y + 1, { characterSpacing: 1.1 });
  doc.restore();
  doc.moveDown(0.7);
}

function parrafo(doc, contenido) {
  doc.fillColor(C.texto).font('Helvetica').fontSize(10)
     .text(texto(contenido), MARGEN, doc.y, {
       width: doc.page.width - MARGEN * 2, align: 'justify', lineGap: 2.5
     });
  doc.moveDown(0.5);
}

/** Ficha de pares etiqueta/valor en dos columnas */
function ficha(doc, pares) {
  const anchoTotal = doc.page.width - MARGEN * 2;
  const anchoCol = anchoTotal / 2;
  let y = doc.y;

  pares.forEach((par, i) => {
    const col = i % 2;
    if (col === 0 && i > 0) y += 30;
    if (y > doc.page.height - 110) { doc.addPage(); y = doc.y; }
    const x = MARGEN + col * anchoCol;

    doc.fillColor(C.suave).font('Helvetica').fontSize(7.5)
       .text(par[0].toUpperCase(), x, y, { width: anchoCol - 14, characterSpacing: 0.8 });
    doc.fillColor(C.tinta).font(par[2] === 'mono' ? 'Courier-Bold' : 'Helvetica-Bold').fontSize(10)
       .text(texto(par[1]), x, y + 11, { width: anchoCol - 14 });
  });

  doc.y = y + 34;
}

/** Tabla con encabezado sólido y filas alternadas */
function tabla(doc, columnas, filas, { anchos } = {}) {
  const anchoTotal = doc.page.width - MARGEN * 2;
  const w = anchos || columnas.map(() => anchoTotal / columnas.length);
  const alturaFila = 20;

  const dibujarCabecera = () => {
    const y = doc.y;
    doc.save().rect(MARGEN, y, anchoTotal, alturaFila).fill(C.tinta).restore();
    let x = MARGEN;
    columnas.forEach((c, i) => {
      doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(8)
         .text(String(c).toUpperCase(), x + 7, y + 6.5, { width: w[i] - 12, ellipsis: true, characterSpacing: 0.5 });
      x += w[i];
    });
    doc.y = y + alturaFila;
  };

  dibujarCabecera();

  filas.forEach((fila, idx) => {
    if (doc.y > doc.page.height - 96) { doc.addPage(); dibujarCabecera(); }
    const y = doc.y;
    if (idx % 2 === 0) doc.save().rect(MARGEN, y, anchoTotal, alturaFila).fill(C.fondoFila).restore();
    let x = MARGEN;
    fila.forEach((celda, i) => {
      doc.fillColor(C.texto).font('Helvetica').fontSize(8.5)
         .text(texto(celda), x + 7, y + 6, { width: w[i] - 12, ellipsis: true, lineBreak: false });
      x += w[i];
    });
    doc.y = y + alturaFila;
  });

  doc.save().moveTo(MARGEN, doc.y).lineTo(MARGEN + anchoTotal, doc.y).lineWidth(0.8).stroke(C.linea).restore();
  doc.moveDown(0.8);
}

/** Tarjetas con cifras clave */
function indicadores(doc, items) {
  const anchoTotal = doc.page.width - MARGEN * 2;
  const gap = 10;
  const w = (anchoTotal - gap * (items.length - 1)) / items.length;
  const y = doc.y;

  items.forEach((it, i) => {
    const x = MARGEN + i * (w + gap);
    doc.save();
    doc.roundedRect(x, y, w, 52, 3).fill(C.fondoFila);
    doc.rect(x, y, 3, 52).fill(it.color || C.acento);
    doc.fillColor(C.tinta).font('Helvetica-Bold').fontSize(20)
       .text(String(it.valor ?? 0), x + 10, y + 9, { width: w - 20 });
    doc.fillColor(C.suave).font('Helvetica').fontSize(7.5)
       .text(String(it.rotulo).toUpperCase(), x + 10, y + 35, { width: w - 16, characterSpacing: 0.6 });
    doc.restore();
  });

  doc.y = y + 62;
}

/** Cuadro destacado (para el mensaje que sale a prensa) */
function destacado(doc, titulo, contenido, color = C.acento) {
  const anchoTotal = doc.page.width - MARGEN * 2;
  const y = doc.y;
  const alto = doc.heightOfString(contenido, { width: anchoTotal - 28 }) + 36;
  if (y + alto > doc.page.height - 90) doc.addPage();

  doc.save();
  doc.roundedRect(MARGEN, doc.y, anchoTotal, alto, 3).fill(C.fondoFila);
  doc.rect(MARGEN, doc.y, 3.5, alto).fill(color);
  doc.fillColor(color).font('Helvetica-Bold').fontSize(8)
     .text(titulo.toUpperCase(), MARGEN + 14, doc.y + 10, { characterSpacing: 1 });
  doc.fillColor(C.texto).font('Helvetica').fontSize(10)
     .text(contenido, MARGEN + 14, doc.y + 24, { width: anchoTotal - 28, lineGap: 2.5 });
  doc.restore();
  doc.y = y + alto + 12;
}

function finalizar(doc) { pie(doc); doc.end(); }

module.exports = {
  crearDocumento, seccion, parrafo, ficha, tabla, indicadores, destacado, finalizar,
  fecha, texto, coord, C, COLOR_NIVEL
};
