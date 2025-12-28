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

// Ocultamos la vista de fichaje
const fichajeWrapper = document.querySelector(".wrapper");
if (fichajeWrapper) fichajeWrapper.style.display = "none";

/*************************************************
 * FIREBASE – SOLO LECTURA (PANEL)
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
 * ELEMENTOS DEL PANEL
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
  const s = Math.floor(ms / 1000);
  const h = String(Math.floor(s / 3600)).padStart(2, "0");
  const m = String(Math.floor((s % 3600) / 60)).padStart(2, "0");
  const sec = String(s % 60).padStart(2, "0");
  return `${h}:${m}:${sec}`;
}

/*************************************************
 * FICHAJES (FUENTE A – WEB)
 *************************************************/
function obtenerFichajes() {
  const raw = localStorage.getItem("fichajes_hoy");
  if (!raw) return [];
  try {
    const data = JSON.parse(raw);
    return Array.isArray(data) ? data : [data];
  } catch {
    return [];
  }
}

/*************************************************
 * DESPACHOS (FUENTE B – FIRESTORE)
 *************************************************/
let despachosHoy = [];

const colRef = collection(db, "despachos_diarios");
onSnapshot(colRef, (snapshot) => {
  const hoy = hoyISO();
  despachosHoy = [];

  snapshot.forEach((doc) => {
    if (doc.id.startsWith(hoy + "_")) {
      despachosHoy.push(doc.data());
    }
  });
});

/*************************************************
 * RENDER (SE ACTUALIZA EN VIVO)
 *************************************************/
function render() {
  const fichajes = obtenerFichajes();

  listaPendientes.innerHTML = "";
  listaDespachados.innerHTML = "";

  let pendientes = 0;
  let despachados = 0;

  fichajes.forEach((f) => {
    const despacho = despachosHoy.find(d => d.chofer === f.chofer);
    const llegada = new Date(f.horaLlegada);
    const ahora = new Date();
    const tiempo = formatearTiempo(ahora - llegada);

    if (despacho) {
      // 🟢 DESPACHADO
      despachados++;
      const li = document.createElement("li");
      li.innerHTML = `
        <strong>${f.chofer}</strong><br>
        ⏱ ${tiempo}<br>
        Paquetes: ${despacho.cantidad_comprobantes}<br>
        Localidades: ${Array.isArray(despacho.localidades) ? despacho.localidades.join(", ") : "-"}
      `;
      listaDespachados.appendChild(li);
    } else {
      // 🟡 PENDIENTE
      pendientes++;
      const li = document.createElement("li");
      li.innerHTML = `
        <strong>${f.chofer}</strong><br>
        ⏱ ${tiempo}
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
 * BOTÓN RESET (SOLO TESTING)
 *************************************************/
const resetBtn = document.createElement("button");
resetBtn.textContent = "🧪 Reset testing";
resetBtn.style.marginTop = "20px";
resetBtn.onclick = () => {
  localStorage.removeItem("fichajes_hoy");
  localStorage.removeItem("driverName");
  location.reload();
};
panelSection.appendChild(resetBtn);
