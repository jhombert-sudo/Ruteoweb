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
  projectId: "despachos-realtime",
  storageBucket: "despachos-realtime.appspot.com",
  messagingSenderId: "741190942056",
  appId: "1:741190942056:web:406de14d0ac4fb617caadd"
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
  return new Date().toISOString().substring(0, 10); // YYYY-MM-DD
}

/*************************************************
 * ESTADO WEB (PENDIENTES)
 * 👉 Esto vive solo en memoria del navegador
 *************************************************/
const pendientesWeb = new Set();

/*
  NOTA IMPORTANTE:
  - driver.js registra llegada en la web
  - acá simulamos pendientes leyendo localStorage
  - luego el despacho desde Firestore los mueve a despachados
*/

// Detectamos al chofer del dispositivo actual (si existe)
const choferLocal = localStorage.getItem("driverName");
if (choferLocal) {
  pendientesWeb.add(choferLocal);
}

/*************************************************
 * ESCUCHAR FIRESTORE (DESPACHADOS HOY)
 *************************************************/
const colRef = collection(db, "despachos_diarios");

onSnapshot(colRef, (snapshot) => {

  const hoy = hoyISO();
  const despachadosHoy = [];

  snapshot.forEach((doc) => {
    if (doc.id.startsWith(hoy + "_")) {
      despachadosHoy.push(doc.data());
    }
  });

  renderPanel(despachadosHoy);
});

/*************************************************
 * RENDER PANEL
 *************************************************/
function renderPanel(despachadosHoy) {

  // Limpiar listas
  listaPendientes.innerHTML = "";
  listaDespachados.innerHTML = "";

  // === DESPACHADOS ===
  despachadosHoy.forEach((d) => {

    // Sacamos de pendientes si ya fue despachado
    pendientesWeb.delete(d.chofer);

    const li = document.createElement("li");
    li.innerHTML = `
      <strong>${d.chofer}</strong><br>
      Paquetes: ${d.cantidad_comprobantes}<br>
      Localidades: ${d.localidades.join(", ")}
    `;
    listaDespachados.appendChild(li);
  });

  // === PENDIENTES ===
  pendientesWeb.forEach((chofer) => {
    const li = document.createElement("li");
    li.textContent = chofer;
    listaPendientes.appendChild(li);
  });

  // === CONTADORES ===
  const pendientesCount = pendientesWeb.size;
  const despachadosCount = despachadosHoy.length;
  const activosCount = pendientesCount + despachadosCount;

  totalPendientes.textContent = pendientesCount;
  totalDespachados.textContent = despachadosCount;
  totalActivos.textContent = activosCount;
}
