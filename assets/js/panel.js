/*************************************************
 * CONTROL DE VISTA (PANEL SOLO ADMIN)
 *************************************************/
const params = new URLSearchParams(window.location.search);
const esPanel = params.get("panel") === "1";

const panelSection = document.getElementById("panel");

if (!esPanel) {
  if (panelSection) panelSection.style.display = "none";
  throw new Error("Vista chofer: panel deshabilitado");
}

const fichajeWrapper = document.querySelector(".wrapper");
if (fichajeWrapper) fichajeWrapper.style.display = "none";

/*************************************************
 * FIREBASE – LECTURA (PANEL)
 *************************************************/
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getFirestore,
  collection,
  onSnapshot
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyBeLJRUfYACdMtLuKbgcFKgg0TBHUxNnzA",
  authDomain: "despachos-realtime.firebaseapp.com",
  projectId: "despachos-realtime"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

/*************************************************
 * ELEMENTOS UI
 *************************************************/
const listaPendientes = document.getElementById("lista-pendientes");
const listaDespachados = document.getElementById("lista-despachados");

const totalActivos = document.getElementById("total-activos");
const totalPendientes = document.getElementById("total-pendientes");
const totalDespachados = document.getElementById("total-despachados");

/*************************************************
 * ✅ NUEVOS ELEMENTOS (SE CREAN SI NO EXISTEN)
 * - Citados hoy
 * - % asistencia (y ratio)
 * NOTA: quitamos el resumen contextual de arriba (porque ya está en la derecha)
 *************************************************/
const panelResumen = document.querySelector(".panel-resumen");
let totalCitados = document.getElementById("total-citados");
let asistenciaRatio = document.getElementById("asistencia-ratio");
let asistenciaPct = document.getElementById("asistencia-pct");

function ensurePanelExtrasUI_() {
  // ✅ Si existía el resumen contextual de arriba (de alguna versión), lo sacamos
  const ctx = document.getElementById("resumen-contexto-dia");
  if (ctx) ctx.remove();

  // Card "Citados hoy" (sin tocar lo que ya existe)
  if (panelResumen && !totalCitados) {
    const item = document.createElement("div");
    item.className = "resumen-item";
    item.innerHTML = `
      <span class="resumen-label">Citados hoy</span>
      <span id="total-citados" class="resumen-value">0</span>
      <div style="margin-top:10px;font-size:12px;color:#64748b;font-weight:800;">
        Asistencia: <span id="asistencia-ratio">0/0</span>
        · <span id="asistencia-pct">0%</span>
      </div>
    `;
    panelResumen.insertBefore(item, panelResumen.firstChild);

    totalCitados = document.getElementById("total-citados");
    asistenciaRatio = document.getElementById("asistencia-ratio");
    asistenciaPct = document.getElementById("asistencia-pct");
  }
}
ensurePanelExtrasUI_();

/*************************************************
 * UTILIDADES
 *************************************************/
function hoyISO() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function formatearTiempo(ms) {
  if (ms < 0) ms = 0;
  const s = Math.floor(ms / 1000);
  const h = String(Math.floor(s / 3600)).padStart(2, "0");
  const m = String(Math.floor((s % 3600) / 60)).padStart(2, "0");
  const sec = String(s % 60).padStart(2, "0");
  return `${h}:${m}:${sec}`;
}

function calcularAsistenciaPct_(activos, citados) {
  if (!citados || citados <= 0) return 0;
  return Math.round((activos / citados) * 100);
}

function toDateSafe_(v) {
  if (!v) return null;
  if (typeof v?.toDate === "function") return v.toDate();
  if (v instanceof Date) return v;
  if (typeof v === "number") return new Date(v);
  return null;
}

function fmtHora_(d) {
  if (!d || !(d instanceof Date) || isNaN(d.getTime())) return "--:--";
  return d.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" });
}

function normalizeId_(id) {
  return String(id || "").toLowerCase().replace(/\s+/g, "_");
}

/*************************************************
 * Puntualidad (panel)
 *************************************************/
const ON_TIME_GRACE_MIN = 5;

function parseHHMMToMinutes_(hhmm) {
  const m = String(hhmm || "").match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  const hh = Number(m[1]);
  const mm = Number(m[2]);
  if (Number.isNaN(hh) || Number.isNaN(mm)) return null;
  return hh * 60 + mm;
}
function dateToMinutes_(d) {
  return d.getHours() * 60 + d.getMinutes();
}
function calcPuntualidad_(horaCitadaHHMM, llegadaDate) {
  const citaMin = parseHHMMToMinutes_(horaCitadaHHMM);
  if (citaMin == null || !llegadaDate) return null;

  const llegadaMin = dateToMinutes_(llegadaDate);
  const delta = llegadaMin - citaMin;

  if (delta <= 0) return "ANTES";
  if (delta <= ON_TIME_GRACE_MIN) return "A TIEMPO";
  return "TARDE";
}

/*************************************************
 * Colores por demora (SOLO PENDIENTES)
 * Reglas JUCA:
 * 🟢 < 10 min (normal)
 * 🟡 30–40 min (retardo)
 * 🔴 > 60 min (demora)
 * (los demás rangos quedan con el estilo naranja default)
 *************************************************/
function stylePendientePorMin_(li, minEspera) {
  if (!li) return;

  // default: no tocamos estilo (queda naranja por CSS)
  let bg = null, br = null, pill = null, txt = null, note = "";

  if (minEspera < 10) {
    // 🟢
    bg = "#ecfdf5";
    br = "#16a34a";
    pill = "#dcfce7";
    txt = "#166534";
    note = "🟢 Normal";
  } else if (minEspera >= 30 && minEspera <= 40) {
    // 🟡
    bg = "#fffbeb";
    br = "#f59e0b";
    pill = "#ffedd5";
    txt = "#9a3412";
    note = "🟡 Retardo";
  } else if (minEspera > 60) {
    // 🔴
    bg = "#fef2f2";
    br = "#ef4444";
    pill = "#fee2e2";
    txt = "#991b1b";
    note = "🔴 Demora";
  } else {
    return; // no tocar
  }

  li.style.background = bg;
  li.style.borderLeft = `6px solid ${br}`;

  // pintamos cualquier badge pendiente si existe
  const badge = li.querySelector(".badge.pendiente");
  if (badge) {
    badge.style.display = "inline-block";
    badge.style.marginTop = "6px";
    badge.style.padding = "6px 10px";
    badge.style.borderRadius = "999px";
    badge.style.background = pill;
    badge.style.border = `1px solid ${br}`;
    badge.style.color = txt;
    badge.style.fontWeight = "900";
  }

  // agregamos nota de estado si no está
  const existing = li.querySelector('[data-demora-note="1"]');
  if (!existing) {
    const div = document.createElement("div");
    div.dataset.demoraNote = "1";
    div.style.marginTop = "6px";
    div.style.fontSize = "12px";
    div.style.fontWeight = "900";
    div.style.color = txt;
    div.textContent = note;
    li.appendChild(div);
  } else {
    existing.style.color = txt;
    existing.textContent = note;
  }
}

/*************************************************
 * ESTADO GLOBAL
 *************************************************/
let fichajesHoy = [];
let despachosHoy = [];
let citasHoy = []; // para "Citados hoy"

// fallback estable por si no viene horaLlegada/createdAt
const llegadaFallback = new Map();

/*************************************************
 * ESCUCHAR CITAS (CITADOS HOY)
 *************************************************/
onSnapshot(collection(db, "citas_diarias"), (snapshot) => {
  const hoy = hoyISO();
  citasHoy = [];

  snapshot.forEach((docu) => {
    // DocID: YYYY-MM-DD_driverId (como definiste)
    if (docu.id.startsWith(hoy + "_")) {
      citasHoy.push({ _id: docu.id, ...docu.data() });
      return;
    }
    // Fallback por si alguna vez cambia el ID pero mantiene campo fecha
    const data = docu.data();
    if (data?.fecha === hoy) {
      citasHoy.push({ _id: docu.id, ...data });
    }
  });

  render();
});

/*************************************************
 * ESCUCHAR FICHAJES
 *************************************************/
onSnapshot(collection(db, "fichajes_diarios"), (snapshot) => {
  const hoy = hoyISO();
  fichajesHoy = [];

  snapshot.forEach((docu) => {
    if (docu.id.startsWith(hoy + "_")) {
      fichajesHoy.push({ _id: docu.id, ...docu.data() });
    }
  });

  render();
});

/*************************************************
 * ESCUCHAR DESPACHOS
 *************************************************/
onSnapshot(collection(db, "despachos_diarios"), (snapshot) => {
  const hoy = hoyISO();
  despachosHoy = [];

  snapshot.forEach((docu) => {
    if (docu.id.startsWith(hoy + "_")) {
      despachosHoy.push({ _id: docu.id, ...docu.data() });
    }
  });

  render();
});

/*************************************************
 * Helpers: llegada + cita por docId
 *************************************************/
function getLlegada_(f) {
  const d = toDateSafe_(f?.horaLlegada) || toDateSafe_(f?.createdAt);
  if (d) return d;

  const id = String(f?._id || "");
  if (!llegadaFallback.has(id)) llegadaFallback.set(id, new Date());
  return llegadaFallback.get(id);
}

function findCitaByDocId_(citasMap, docId, driverId, hoy) {
  if (docId && citasMap.has(docId)) return citasMap.get(docId);
  if (driverId) {
    const tryId = `${hoy}_${driverId}`;
    if (citasMap.has(tryId)) return citasMap.get(tryId);
  }
  return null;
}

/*************************************************
 * RENDER PRINCIPAL
 * - Orden por llegada (primero arriba)
 * - Muestra hora llegada + hora citada/TURBO + puntualidad
 * - Colorea pendientes por minutos (según reglas JUCA)
 *************************************************/
function render() {
  if (!listaPendientes || !listaDespachados) return;

  listaPendientes.innerHTML = "";
  listaDespachados.innerHTML = "";

  const hoy = hoyISO();

  // Map de despachos por id normalizado
  const despachosMap = new Map();
  for (const d of despachosHoy) {
    despachosMap.set(normalizeId_(d._id), d);
  }

  // Map de citas por docId
  const citasMap = new Map();
  for (const c of citasHoy) {
    if (c?._id) citasMap.set(String(c._id), c);
  }

  // Orden por llegada (primero arriba)
  const fichajesOrdenados = [...fichajesHoy].sort((a, b) => {
    return getLlegada_(a).getTime() - getLlegada_(b).getTime();
  });

  let pendientes = 0;
  let despachados = 0;

  for (const f of fichajesOrdenados) {
    const docId = String(f?._id || "");
    const driverId = f?.driverId || null;

    const despacho = despachosMap.get(normalizeId_(docId));
    const llegada = getLlegada_(f);

    const cita = findCitaByDocId_(citasMap, docId, driverId, hoy);
    const tipoCita = String(cita?.tipo || "").toUpperCase();
    const horaCitada = cita?.hora_citada || null;

    const llegadaTxt = fmtHora_(llegada);

    let lineaCita = "";
    if (tipoCita === "TURBO") {
      lineaCita = `🕒 TURBO · Sin horario fijo`;
    } else if (horaCitada) {
      const puntual = calcPuntualidad_(horaCitada, llegada);
      lineaCita = `🕒 Citado: ${horaCitada} · Llegó: ${llegadaTxt}${puntual ? ` (${puntual})` : ""}`;
    } else {
      lineaCita = `🕒 Citado: — · Llegó: ${llegadaTxt}`;
    }

    if (despacho) {
      despachados++;

      const salida = toDateSafe_(despacho.updatedAt) || new Date();
      const duracion = salida - llegada;

      const li = document.createElement("li");
      li.className = "item despachado";
      li.innerHTML = `
        <strong>${f.chofer}</strong><br>
        ${lineaCita}<br>
        🕒 Salida: ${fmtHora_(salida)}<br>
        ⏱ Espera: ${formatearTiempo(duracion)}<br>
        📦 Paquetes: ${despacho.cantidad_comprobantes ?? "-"}<br>
        📍 ${Array.isArray(despacho.localidades) ? despacho.localidades.join(", ") : "-"}
      `;
      listaDespachados.appendChild(li);
    } else {
      pendientes++;

      const esperaMs = new Date() - llegada;
      const esperaMin = Math.floor(esperaMs / 60000);

      const li = document.createElement("li");
      li.className = "item pendiente";
      li.innerHTML = `
        <strong>${f.chofer}</strong><br>
        ${lineaCita}<br>
        ⏱ Espera: ${formatearTiempo(esperaMs)}<br>
        <span class="badge pendiente">Pendiente</span>
      `;

      // ✅ color por minutos (según reglas)
      stylePendientePorMin_(li, esperaMin);

      listaPendientes.appendChild(li);
    }
  }

  // ✅ KPIs EXISTENTES
  if (totalPendientes) totalPendientes.textContent = pendientes;
  if (totalDespachados) totalDespachados.textContent = despachados;
  if (totalActivos) totalActivos.textContent = pendientes + despachados;

  // ✅ KPIs NUEVOS (Citados + % asistencia)
  const citados = Array.isArray(citasHoy) ? citasHoy.length : 0;
  const activos = pendientes + despachados;
  const pct = calcularAsistenciaPct_(activos, citados);

  if (totalCitados) totalCitados.textContent = citados;
  if (asistenciaRatio) asistenciaRatio.textContent = `${activos}/${citados}`;
  if (asistenciaPct) asistenciaPct.textContent = `${pct}%`;
}

/*************************************************
 * ACTUALIZACIÓN EN VIVO
 *************************************************/
setInterval(render, 1000);

/*************************************************
 * RESET SOLO VISTA (NO FIRESTORE)
 *************************************************/
const resetBtn = document.createElement("button");
resetBtn.textContent = "🧪 Reset testing";
resetBtn.style.marginTop = "20px";
resetBtn.onclick = () => {
  if (!confirm("Resetear vista del panel?")) return;
  fichajesHoy = [];
  despachosHoy = [];
  citasHoy = [];
  llegadaFallback.clear();
  render();
};
panelSection.appendChild(resetBtn);
