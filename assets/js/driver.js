/*************************************************
 * CONTROL DE VISTA (CHOFER vs PANEL)
 *************************************************/
const params = new URLSearchParams(window.location.search);
const esPanel = params.get("panel") === "1";

// Si estamos en modo PANEL → no ejecutamos fichaje
if (esPanel) {
  const fichajeWrapper = document.querySelector(".wrapper");
  if (fichajeWrapper) fichajeWrapper.style.display = "none";
  console.log("Modo panel: driver.js desactivado");
  throw new Error("Driver desactivado en modo panel");
}

/*************************************************
 * FIREBASE – SOLO INICIALIZACIÓN (LECTURA FUTURA)
 *************************************************/
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyBeLJRUfYACdMtLuKbgcFKgg0TBHUxNnzA",
  authDomain: "despachos-realtime.firebaseapp.com",
  projectId: "despachos-realtime",
  storageBucket: "despachos-realtime.appspot.com",
  messagingSenderId: "741190942056",
  appId: "1:741190942056:web:406de14d0ac4fb617caadd"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app); // preparado para lecturas futuras

/*************************************************
 * ELEMENTOS UI
 *************************************************/
const btnFichar = document.getElementById("btnFichar");
const loader = document.getElementById("loader");
const welcome = document.getElementById("welcome");

/*************************************************
 * IDENTIDAD DEL CHOFER (POR DISPOSITIVO)
 *************************************************/
const nombreChofer = obtenerNombreChofer();
welcome.innerText = `Bienvenido, ${nombreChofer}`;

/*************************************************
 * EVENTO BOTÓN FICHAR
 *************************************************/
btnFichar.addEventListener("click", async () => {
  loader.classList.remove("hidden");

  const identidadOk = validarIdentidadDispositivo(nombreChofer);
  if (!identidadOk) {
    loader.classList.add("hidden");
    return;
  }

  registrarLlegada();
  loader.classList.add("hidden");
});

/*************************************************
 * REGISTRO DE LLEGADA (SOLO WEB)
 *************************************************/
function registrarLlegada() {
  const ahora = new Date();

  console.log("LLEGADA REGISTRADA (WEB)", {
    chofer: nombreChofer,
    hora: ahora.toISOString(),
    estado: "pendiente"
  });

  alert("Llegada registrada correctamente ✅");
}

/*************************************************
 * IDENTIDAD POR DISPOSITIVO
 *************************************************/
function obtenerNombreChofer() {
  let nombre = localStorage.getItem("driverName");

  if (!nombre) {
    nombre = prompt("Ingresá tu nombre y apellido");
    localStorage.setItem("driverName", nombre);
  }

  return nombre;
}

/*************************************************
 * VALIDAR QUE NO CAMBIEN DE IDENTIDAD
 *************************************************/
function validarIdentidadDispositivo(nombreActual) {
  const nombreGuardado = localStorage.getItem("driverName");

  if (nombreGuardado !== nombreActual) {
    alert(
      "⚠️ Este celular ya está registrado con otro chofer.\n" +
      "No podés usar un nombre diferente."
    );
    return false;
  }

  return true;
}
