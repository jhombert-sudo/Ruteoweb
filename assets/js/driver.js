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
 * FIREBASE – SOLO INICIALIZACIÓN (NO SE USA AÚN)
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

initializeApp(firebaseConfig);
getFirestore(); // preparado para futuro (NO escribe)

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
btnFichar.addEventListener("click", () => {
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
 * REGISTRO DE LLEGADA (FUENTE A – WEB)
 * 👉 ESTO ES LO QUE LEE EL PANEL
 *************************************************/
function registrarLlegada() {
  const ahora = new Date().toISOString();

  // Traemos fichajes existentes del día
  let fichajes = [];
  const raw = localStorage.getItem("fichajes_hoy");

  if (raw) {
    try {
      fichajes = JSON.parse(raw);
      if (!Array.isArray(fichajes)) fichajes = [];
    } catch {
      fichajes = [];
    }
  }

  // Agregamos nuevo fichaje
  fichajes.push({
    chofer: nombreChofer,
    horaLlegada: ahora
  });

  localStorage.setItem("fichajes_hoy", JSON.stringify(fichajes));

  console.log("LLEGADA REGISTRADA (WEB)", {
    chofer: nombreChofer,
    hora: ahora,
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
