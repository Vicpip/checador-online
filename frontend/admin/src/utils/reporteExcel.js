import ExcelJS from "exceljs";
import { evaluar } from "../components/EstadoJornadaBadge";
import { formatFecha, formatFechaHora, formatHora } from "./formato";

const AZUL_OSCURO = "FF1E3A5F";
const AZUL_MEDIO = "FF2563EB";
const GRIS_CLARO = "FFF1F5F9";
const AMARILLO = "FFFEF9C3";
const BLANCO = "FFFFFFFF";

const TITULO_FILL = { type: "pattern", pattern: "solid", fgColor: { argb: AZUL_OSCURO } };
const HEADER_FILL = { type: "pattern", pattern: "solid", fgColor: { argb: AZUL_MEDIO } };
const ZEBRA_FILL = { type: "pattern", pattern: "solid", fgColor: { argb: GRIS_CLARO } };
const TOTAL_FILL = { type: "pattern", pattern: "solid", fgColor: { argb: AMARILLO } };

function agregarBloqueTitulo(ws, numColumnas, lineas) {
  lineas.forEach(({ texto, size, bold }, i) => {
    const fila = ws.addRow([texto]);
    ws.mergeCells(fila.number, 1, fila.number, numColumnas);
    const celda = fila.getCell(1);
    celda.font = { color: { argb: BLANCO }, size, bold: !!bold };
    celda.fill = TITULO_FILL;
    celda.alignment = { horizontal: "left", vertical: "middle" };
    fila.height = size + 10;
  });
  ws.addRow([]);
}

function agregarEncabezados(ws, columnas) {
  const fila = ws.addRow(columnas.map((c) => c.header));
  fila.eachCell((celda) => {
    celda.font = { color: { argb: BLANCO }, bold: true };
    celda.fill = HEADER_FILL;
    celda.alignment = { horizontal: "left", vertical: "middle" };
  });
}

function agregarFilaDatos(ws, valores, indice, numFmts) {
  const fila = ws.addRow(valores);
  const zebra = indice % 2 === 1;
  fila.eachCell((celda, colNumber) => {
    if (zebra) celda.fill = ZEBRA_FILL;
    const fmt = numFmts[colNumber - 1];
    if (fmt && typeof celda.value === "number") celda.numFmt = fmt;
  });
  return fila;
}

function ajustarAnchoColumnas(ws, columnas) {
  columnas.forEach((col, i) => {
    let max = col.header.length;
    ws.eachRow((fila) => {
      const val = fila.getCell(i + 1).value;
      if (val == null) return;
      const len = String(val).length;
      if (len > max) max = len;
    });
    ws.getColumn(i + 1).width = Math.min(Math.max(max + 3, 10), 40);
  });
}

/**
 * Builds the "reporte de asistencia" workbook (Resumen + Detalle sheets) from
 * one ReporteOut per técnico (see backend/schemas.py) for the given range.
 * Returns an ArrayBuffer ready to hand to a Blob.
 */
export async function generarReporteExcel({ companyName, fechaInicio, fechaFin, reportes }) {
  const workbook = new ExcelJS.Workbook();
  const generadoEl = formatFechaHora(new Date().toISOString());
  const periodoTexto = `Periodo: ${formatFecha(fechaInicio)} — ${formatFecha(fechaFin)}`;
  const tituloLineas = [
    { texto: companyName, size: 18, bold: true },
    { texto: periodoTexto, size: 12 },
    { texto: `Generado: ${generadoEl}`, size: 10 },
  ];

  // ── Hoja 1: Resumen ───────────────────────────────────────────────────
  const resumenColumnas = [
    { header: "Técnico" },
    { header: "Días trabajados" },
    { header: "Horas normales" },
    { header: "Horas extra" },
    { header: "Puntualidad %" },
    { header: "Faltas" },
    { header: "Tardanzas" },
  ];
  const resumenNumFmts = [null, "0", "0.00", "0.00", '0.00"%"', "0", "0"];
  const wsResumen = workbook.addWorksheet("Resumen");
  agregarBloqueTitulo(wsResumen, resumenColumnas.length, tituloLineas);
  agregarEncabezados(wsResumen, resumenColumnas);

  const totales = {
    diasTrabajados: 0,
    horasNormales: 0,
    horasExtra: 0,
    diasPuntuales: 0,
    faltas: 0,
    tardanzas: 0,
  };

  reportes.forEach((reporte, i) => {
    const horasNormales = Math.max(0, reporte.horas_totales - reporte.horas_extra_totales);
    const tardanzas = reporte.jornadas.filter((j) => j.puntual === false).length;
    totales.diasTrabajados += reporte.dias_trabajados;
    totales.horasNormales += horasNormales;
    totales.horasExtra += reporte.horas_extra_totales;
    totales.diasPuntuales += reporte.dias_puntuales;
    totales.faltas += reporte.dias_faltados;
    totales.tardanzas += tardanzas;

    agregarFilaDatos(
      wsResumen,
      [
        reporte.tecnico.nombre,
        reporte.dias_trabajados,
        horasNormales,
        reporte.horas_extra_totales,
        reporte.puntualidad_pct,
        reporte.dias_faltados,
        tardanzas,
      ],
      i,
      resumenNumFmts
    );
  });

  const puntualidadTotal = totales.diasTrabajados > 0 ? (totales.diasPuntuales / totales.diasTrabajados) * 100 : 0;
  const filaTotal = wsResumen.addRow([
    "Total",
    totales.diasTrabajados,
    totales.horasNormales,
    totales.horasExtra,
    Math.round(puntualidadTotal * 100) / 100,
    totales.faltas,
    totales.tardanzas,
  ]);
  filaTotal.eachCell((celda, colNumber) => {
    celda.fill = TOTAL_FILL;
    celda.font = { bold: true };
    const fmt = resumenNumFmts[colNumber - 1];
    if (fmt && typeof celda.value === "number") celda.numFmt = fmt;
  });

  ajustarAnchoColumnas(wsResumen, resumenColumnas);

  // ── Hoja 2: Detalle ───────────────────────────────────────────────────
  const detalleColumnas = [
    { header: "Técnico" },
    { header: "Fecha" },
    { header: "Entrada" },
    { header: "Salida" },
    { header: "Horas trabajadas" },
    { header: "Horas extra" },
    { header: "Estatus" },
    { header: "Puntual" },
  ];
  const detalleNumFmts = [null, null, null, null, "0.00", "0.00", null, null];
  const wsDetalle = workbook.addWorksheet("Detalle");
  agregarBloqueTitulo(wsDetalle, detalleColumnas.length, tituloLineas);
  agregarEncabezados(wsDetalle, detalleColumnas);

  const filasDetalle = reportes
    .flatMap((reporte) => reporte.jornadas.map((j) => ({ tecnico: reporte.tecnico.nombre, jornada: j })))
    .sort((a, b) => a.jornada.fecha.localeCompare(b.jornada.fecha) || a.tecnico.localeCompare(b.tecnico));

  filasDetalle.forEach(({ tecnico, jornada: j }, i) => {
    const { texto: estatus } = evaluar(j);
    agregarFilaDatos(
      wsDetalle,
      [
        tecnico,
        formatFecha(j.fecha),
        formatHora(j.entrada_hora),
        j.salida_hora ? formatHora(j.salida_hora) : "—",
        j.horas_trabajadas ?? "—",
        j.horas_extra ?? "—",
        estatus,
        j.puntual ? "Sí" : "No",
      ],
      i,
      detalleNumFmts
    );
  });

  ajustarAnchoColumnas(wsDetalle, detalleColumnas);

  return workbook.xlsx.writeBuffer();
}

/** Sanitizes a free-text company name for use inside a downloaded filename. */
export function slugParaArchivo(texto) {
  return (texto || "reporte")
    .normalize("NFD")
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}
