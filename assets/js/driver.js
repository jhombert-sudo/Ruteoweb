/*************************************************
 * CONTROL DE VISTA (CHOFER vs PANEL)
 *************************************************/
const params = new URLSearchParams(window.location.search);
const esPanel = params.get("panel") === "1";

if (esPanel) {
  const fichajeWrapper = document.querySelector(".wrapper");
  if (fichajeWrapper) fichajeWrapper.style.display = "none";
  throw new Error("Driver desactivado en modo panel");
}

/*************************************************
 * FIREBASE – INICIALIZACIÓN
 *************************************************/
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  serverTimestamp
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

  await registrarLlegadaFirestore();
  loader.classList.add("hidden");
});

/*************************************************
 * REGISTRO DE LLEGADA EN FIRESTORE
 *************************************************/
async function registrarLlegadaFirestore() {
  const hoy = new Date().toISOString().substring(0, 10);
  const docId = `${hoy}_${nombreChofer.toUpperCase()}`;

  const ref = doc(db, "fichajes_hoy", docId);
  const snap = await getDoc(ref);

  // ❌ Ya fichó hoy
  if (snap.exists()) {
    alert("⚠️ Ya estás registrado hoy.");
    mostrarQR(nombreChofer);
    return;
  }

  // ✅ Crear fichaje
  await setDoc(ref, {
    chofer: nombreChofer,
    fecha: hoy,
    horaLlegada: new Date().toISOString(),
    estado: "pendiente",
    createdAt: serverTimestamp()
  });

  alert("Llegada registrada correctamente ✅");
  mostrarQR(nombreChofer);
}

/*************************************************
 * QR TEMPORAL (2 HORAS)
 *************************************************/
function mostrarQR(nombre) {
  let contenedor = document.getElementById("qr-container");

  if (!contenedor) {
    contenedor = document.createElement("div");
    contenedor.id = "qr-container";
    contenedor.style.marginTop = "20px";
    contenedor.style.textAlign = "center";
    document.querySelector(".card").appendChild(contenedor);
  }

  contenedor.innerHTML = `
    <p><strong>Mostrá este QR al despachar</strong></p>
    <img src="https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(
      nombre + "|" + Date.now()
    )}" />
    <p style="font-size:12px;color:#666">
      QR válido por 2 horas
    </p>
  `;

  // Expira a las 2 horas
  setTimeout(() => {
    contenedor.remove();
  }, 2 * 60 * 60 * 1000);
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
