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
 * - Resumen contextual arriba de las listas
 *************************************************/
const panelResumen = document.querySelector(".panel-resumen");
let totalCitados = document.getElementById("total-citados");
let asistenciaRatio = document.getElementById("asistencia-ratio");
let asistenciaPct = document.getElementById("asistencia-pct");

function ensurePanelExtrasUI_() {
  // 1) Card "Citados hoy" en el resumen (sin tocar lo que ya existe)
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
    // Insertar al principio para que se vea primero
    panelResumen.insertBefore(item, panelResumen.firstChild);

    totalCitados = document.getElementById("total-citados");
    asistenciaRatio = document.getElementById("asistencia-ratio");
    asistenciaPct = document.getElementById("asistencia-pct");
  }

  // 2) Resumen contextual arriba de las listas (solo si existe estructura)
  const panelMain = document.querySelector(".panel-main");
  const panelTablas = document.querySelector(".panel-tablas");
  if (panelMain && panelTablas && !document.getElementById("resumen-contexto-dia")) {
    const box = document.createElement("div");
    box.id = "resumen-contexto-dia";
    box.style.cssText = `
      background:#ffffff;
      border-radius:18px;
      padding:14px 16px;
      box-shadow: 0 18px 40px rgba(15,23,42,0.12);
      display:flex;
      flex-wrap:wrap;
      gap:12px;
      align-items:center;
      justify-content:flex-start;
      font-weight:900;
      color:#0f172a;
    `;

    box.innerHTML = `
      <span style="display:inline-flex;gap:8px;align-items:center;">
        📅 <span>Citados:</span> <span id="ctx-citados">0</span>
      </span>
      <span style="opacity:.35;">|</span>
      <span style="display:inline-flex;gap:8px;align-items:center;">
        🏢 <span>En empresa:</span> <span id="ctx-empresa">0</span>
      </span>
      <span style="opacity:.35;">|</span>
      <span style="display:inline-flex;gap:8px;align-items:center;">
        🚚 <span>Despachados:</span> <span id="ctx-despachados">0</span>
      </span>
    `;

    panelMain.insertBefore(box, panelTablas);
  }
}

// Crear UI extra apenas entra al panel
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

/*************************************************
 * ESTADO GLOBAL
 *************************************************/
let fichajesHoy = [];
let despachosHoy = [];
let citasHoy = []; // ✅ NUEVO: para "Citados hoy"

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
 * RENDER PRINCIPAL
 *************************************************/
function render() {
  if (!listaPendientes || !listaDespachados) return;

  listaPendientes.innerHTML = "";
  listaDespachados.innerHTML = "";

  let pendientes = 0;
  let despachados = 0;

  fichajesHoy.forEach((f) => {
    // 🔑 MATCH CORRECTO (normalizando solo el despacho) - se mantiene tu lógica
    const despacho = despachosHoy.find(d =>
      String(d._id || "")
        .toLowerCase()
        .replace(/\s+/g, "_") === String(f._id || "")
    );

    // ⏱ llegada segura
    const llegada =
      f.horaLlegada?.toDate?.() ||
      f.createdAt?.toDate?.() ||
      new Date();

    if (despacho) {
      despachados++;

      // 🕒 salida real si existe, fallback visual si no
      const salida =
        despacho.updatedAt?.toDate?.() ||
        new Date();

      const duracion = salida - llegada;

      const li = document.createElement("li");
      li.className = "item despachado";
      li.innerHTML = `
        <strong>${f.chofer}</strong><br>
        🕒 Salida: ${salida.toLocaleTimeString()}<br>
        ⏱ Espera: ${formatearTiempo(duracion)}<br>
        📦 Paquetes: ${despacho.cantidad_comprobantes ?? "-"}<br>
        📍 ${Array.isArray(despacho.localidades) ? despacho.localidades.join(", ") : "-"}
      `;
      listaDespachados.appendChild(li);
    } else {
      pendientes++;

      const espera = new Date() - llegada;

      const li = document.createElement("li");
      li.className = "item pendiente";
      li.innerHTML = `
        <strong>${f.chofer}</strong><br>
        ⏱ Espera: ${formatearTiempo(espera)}<br>
        <span class="badge pendiente">Pendiente</span>
      `;
      listaPendientes.appendChild(li);
    }
  });

  // ✅ KPIs EXISTENTES (igual que antes)
  if (totalPendientes) totalPendientes.textContent = pendientes;
  if (totalDespachados) totalDespachados.textContent = despachados;
  if (totalActivos) totalActivos.textContent = pendientes + despachados; // activos = fichados hoy

  // ✅ NUEVOS KPIs (Citados + % asistencia)
  const citados = Array.isArray(citasHoy) ? citasHoy.length : 0;
  const activos = pendientes + despachados;
  const pct = calcularAsistenciaPct_(activos, citados);

  if (totalCitados) totalCitados.textContent = citados;
  if (asistenciaRatio) asistenciaRatio.textContent = `${activos}/${citados}`;
  if (asistenciaPct) asistenciaPct.textContent = `${pct}%`;

  // ✅ Resumen contextual arriba de las listas
  const ctxCit = document.getElementById("ctx-citados");
  const ctxEmp = document.getElementById("ctx-empresa");
  const ctxDes = document.getElementById("ctx-despachados");

  if (ctxCit) ctxCit.textContent = citados;
  if (ctxEmp) ctxEmp.textContent = activos;
  if (ctxDes) ctxDes.textContent = despachados;
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
  render();
};
panelSection.appendChild(resetBtn);
