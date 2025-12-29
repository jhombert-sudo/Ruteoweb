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
 * UTILIDADES
 *************************************************/
function hoyISO() {
  return new Date().toISOString().substring(0, 10);
}

function formatearTiempo(ms) {
  if (ms < 0) ms = 0;
  const s = Math.floor(ms / 1000);
  const h = String(Math.floor(s / 3600)).padStart(2, "0");
  const m = String(Math.floor((s % 3600) / 60)).padStart(2, "0");
  const sec = String(s % 60).padStart(2, "0");
  return `${h}:${m}:${sec}`;
}

/*************************************************
 * ESTADO GLOBAL
 *************************************************/
let fichajesHoy = [];
let despachosHoy = [];

/*************************************************
 * ESCUCHAR FICHAJES (FUENTE A)
 *************************************************/
const fichajesRef = collection(db, "fichajes_diarios");
onSnapshot(fichajesRef, (snapshot) => {
  const hoy = hoyISO();
  fichajesHoy = [];

  snapshot.forEach((doc) => {
    if (doc.id.startsWith(hoy + "_")) {
      fichajesHoy.push({
        _id: doc.id,        // 🔑 CLAVE REAL
        ...doc.data()
      });
    }
  });
});

/*************************************************
 * ESCUCHAR DESPACHOS (FUENTE B)
 *************************************************/
const despachosRef = collection(db, "despachos_diarios");
onSnapshot(despachosRef, (snapshot) => {
  const hoy = hoyISO();
  despachosHoy = [];

  snapshot.forEach((doc) => {
    if (doc.id.startsWith(hoy + "_")) {
      despachosHoy.push({
        _id: doc.id,        // 🔑 CLAVE REAL
        ...doc.data()
      });
    }
  });
});

/*************************************************
 * RENDER PRINCIPAL
 *************************************************/
function render() {
  listaPendientes.innerHTML = "";
  listaDespachados.innerHTML = "";

  let pendientes = 0;
  let despachados = 0;

  fichajesHoy.forEach((f) => {

    // 🔥 COMPARACIÓN CORRECTA (ID vs ID)
    const despacho = despachosHoy.find(d => d._id === f._id);

    const llegada = f.horaLlegada?.toDate
      ? f.horaLlegada.toDate()
      : new Date(f.horaLlegada);

    if (despacho) {
      /******** DESPACHADO ********/
      despachados++;

      const salida = despacho.updatedAt?.toDate
        ? despacho.updatedAt.toDate()
        : new Date(despacho.updatedAt);

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
      /******** PENDIENTE ********/
      pendientes++;

      const ahora = new Date();
      const espera = ahora - llegada;

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

  totalPendientes.textContent = pendientes;
  totalDespachados.textContent = despachados;
  totalActivos.textContent = pendientes + despachados;
}

/*************************************************
 * ACTUALIZACIÓN EN VIVO
 *************************************************/
setInterval(render, 1000);

/*************************************************
 * RESET SOLO ADMIN (TESTING)
 *************************************************/
const resetBtn = document.createElement("button");
resetBtn.textContent = "🧪 Reset testing";
resetBtn.style.marginTop = "20px";
resetBtn.onclick = () => {
  if (!confirm("Resetear fichajes locales?")) return;
  localStorage.clear();
  location.reload();
};
panelSection.appendChild(resetBtn);
