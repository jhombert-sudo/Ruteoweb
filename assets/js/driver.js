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
  serverTimestamp,
  collection,
  getDocs,
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
const btnFichar = document.getElementById("btnFichar");
const loader = document.getElementById("loader");
const welcome = document.getElementById("welcome");

// ✅ NUEVOS
const driverSelect = document.getElementById("driverSelect");
const turnoInfo = document.getElementById("turnoInfo");

// ✅ NUEVO LISTADO
const listaHoy = document.getElementById("lista-hoy");

/*************************************************
 * UTILIDAD FECHA LOCAL (CLAVE 🔑)
 *************************************************/
function hoyISO() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/*************************************************
 * DEVICE ID (LOCK REAL POR CELULAR)
 *************************************************/
function getDeviceId() {
  let id = localStorage.getItem("deviceId");
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem("deviceId", id);
  }
  return id;
}
const deviceId = getDeviceId();

/*************************************************
 * IDENTIDAD DEL CHOFER (DESDE FIRESTORE)
 *************************************************/
let nombreChofer = null;
let driverId = null;
let tipoChofer = "NORMAL";

/*************************************************
 * CARGAR DROPDOWN DE CHOFERES + LOCK SI YA EXISTE
 *************************************************/
async function initChoferDropdown() {
  if (!driverSelect) {
    console.warn("No existe #driverSelect en el HTML");
    return;
  }

  // Estado inicial visible
  driverSelect.innerHTML = `<option value="">Cargando...</option>`;

  // 1) Traer choferes (SIN query para evitar índices)
  let choferes = [];

  try {
    const snapChoferes = await getDocs(collection(db, "choferes"));
    choferes = snapChoferes.docs.map(d => ({ id: d.id, ...d.data() }));

    // Filtrar activos (si no existe el campo, lo tomo como activo)
    choferes = choferes.filter(c => c.activo !== false);

    // Ordenar por nombre_display (o fallback al id)
    choferes.sort((a, b) =>
      String(a.nombre_display || a.id || "").localeCompare(
        String(b.nombre_display || b.id || ""),
        "es"
      )
    );
  } catch (e) {
    console.error("Error cargando choferes:", e);
    driverSelect.innerHTML = `<option value="">❌ Error cargando choferes</option>`;
    return;
  }

  if (!choferes.length) {
    driverSelect.innerHTML = `<option value="">⚠️ No hay choferes cargados</option>`;
    return;
  }

  driverSelect.innerHTML =
    `<option value="">Seleccioná tu nombre</option>` +
    choferes.map(c => `<option value="${c.id}">${c.nombre_display || c.id}</option>`).join("");

  // 2) Si el celular ya está asignado -> bloquear selector
  const refDev = doc(db, "dispositivos", deviceId);
  const snapDev = await getDoc(refDev);

  if (snapDev.exists()) {
    driverId = snapDev.data().driverId;
    nombreChofer = snapDev.data().nombre_display;
    tipoChofer = snapDev.data().tipo || "NORMAL";

    driverSelect.value = driverId;
    driverSelect.disabled = true;

    welcome.innerText = `Bienvenido, ${nombreChofer}`;
    if (turnoInfo) {
      turnoInfo.textContent = (tipoChofer === "TURBO") ? "🚀 TURBO (sin horario fijo)" : "";
    }
    return;
  }

  // 3) Si no está asignado -> permite elegir
  driverSelect.addEventListener("change", () => {
    const elegido = choferes.find(c => c.id === driverSelect.value);
    if (!elegido) {
      driverId = null;
      nombreChofer = null;
      tipoChofer = "NORMAL";
      if (turnoInfo) turnoInfo.textContent = "";
      welcome.innerText = "Bienvenido";
      return;
    }

    driverId = elegido.id;
    nombreChofer = elegido.nombre_display || elegido.id;
    tipoChofer = elegido.tipo || "NORMAL";

    welcome.innerText = `Bienvenido, ${nombreChofer}`;
    if (turnoInfo) {
      turnoInfo.textContent = (tipoChofer === "TURBO") ? "🚀 TURBO (sin horario fijo)" : "";
    }
  });
}

/*************************************************
 * BLOQUEAR CELULAR A CHOFER (1 vez)
 *************************************************/
async function lockDeviceToDriver() {
  const refDev = doc(db, "dispositivos", deviceId);
  const snapDev = await getDoc(refDev);

  if (snapDev.exists()) {
    // Si ya estaba bloqueado, debe coincidir
    if (snapDev.data().driverId !== driverId) {
      alert("⚠️ Este celular ya está asignado a otro chofer.");
      return false;
    }
    return true;
  }

  // Bloqueo inicial
  await setDoc(refDev, {
    deviceId,
    driverId,
    nombre_display: nombreChofer,
    tipo: tipoChofer,
    createdAt: serverTimestamp()
  });

  if (driverSelect) driverSelect.disabled = true;
  return true;
}

/*************************************************
 * EVENTO BOTÓN FICHAR
 *************************************************/
btnFichar.addEventListener("click", async () => {
  loader.classList.remove("hidden");

  // ✅ Debe estar seleccionado
  if (!driverId || !nombreChofer) {
    alert("Seleccioná tu nombre primero.");
    loader.classList.add("hidden");
    return;
  }

  // ✅ Lock por celular
  const ok = await lockDeviceToDriver();
  if (!ok) {
    loader.classList.add("hidden");
    return;
  }

  try {
    await registrarLlegadaFirestore();
  } catch (e) {
    console.error(e);
    alert("❌ Error al registrar llegada");
  }

  loader.classList.add("hidden");
});

/*************************************************
 * REGISTRO DE LLEGADA EN FIRESTORE
 *************************************************/
async function registrarLlegadaFirestore() {
  const hoy = hoyISO(); // ✅ FECHA LOCAL
  const docId = `${hoy}_${driverId}`;

  const ref = doc(db, "fichajes_diarios", docId);
  const snap = await getDoc(ref);

  // ❌ Ya fichó hoy
  if (snap.exists()) {
    alert("⚠️ Ya estás registrado hoy.");
    mostrarQR(docId);
    return;
  }

  // Token QR temporal (2 horas)
  const qrToken = crypto.randomUUID();
  const expiraEn = Date.now() + 2 * 60 * 60 * 1000;

  // ✅ Crear fichaje diario (se mantiene tu estructura)
  await setDoc(ref, {
    chofer: nombreChofer,
    driverId,
    tipo: tipoChofer,             // ✅ nuevo (no rompe)
    nombre_display: nombreChofer, // ✅ nuevo (no rompe)
    fecha: hoy,
    estado: "pendiente",
    horaLlegada: serverTimestamp(),
    qrToken,
    qrExpira: expiraEn,
    createdAt: serverTimestamp()
  });

  alert("Llegada registrada correctamente ✅");
  mostrarQR(docId);
}

/*************************************************
 * QR TEMPORAL (VISUAL)
 *************************************************/
function mostrarQR(docId) {
  let contenedor = document.getElementById("qr-container");

  if (!contenedor) {
    contenedor = document.createElement("div");
    contenedor.id = "qr-container";
    contenedor.style.marginTop = "20px";
    contenedor.style.textAlign = "center";
    document.querySelector(".card").appendChild(contenedor);
  }

  const urlQR = `${location.origin}${location.pathname}?scan=${docId}`;

  contenedor.innerHTML = `
    <p><strong>Mostrá este QR al despachar</strong></p>
    <img src="https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(
      urlQR
    )}" />
    <p style="font-size:12px;color:#666">
      QR válido por 2 horas
    </p>
  `;

  setTimeout(() => {
    contenedor.remove();
  }, 2 * 60 * 60 * 1000);
}

/*************************************************
 * LISTADO EN VIVO: REGISTRADOS HOY (ORDEN LLEGADA)
 *************************************************/
let fichajesHoy = [];
let despachosHoy = [];

function getLlegadaDate(f) {
  return (
    f.horaLlegada?.toDate?.() ||
    f.createdAt?.toDate?.() ||
    new Date(0)
  );
}

function renderListadoHoy() {
  if (!listaHoy) return;

  listaHoy.innerHTML = "";

  const ordenados = [...fichajesHoy].sort((a, b) => getLlegadaDate(a) - getLlegadaDate(b));

  if (!ordenados.length) {
    const empty = document.createElement("li");
    empty.style.fontSize = "13px";
    empty.style.color = "#64748b";
    empty.textContent = "Todavía no hay registrados hoy.";
    listaHoy.appendChild(empty);
    return;
  }

  for (const f of ordenados) {
    const llegada = getLlegadaDate(f);
    const hora = llegada.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" });

    // Match despacho (exacto + fallback normalizado)
    const despacho = despachosHoy.find(d => d._id === f._id) ||
      despachosHoy.find(d =>
        String(d._id).toLowerCase().replace(/\s+/g, "_") === String(f._id).toLowerCase()
      );

    const estado = despacho ? "Despachado" : "Pendiente";
    const badgeBg = despacho ? "#ecfdf5" : "#fff7ed";
    const badgeBorder = despacho ? "#16a34a" : "#f59e0b";
    const badgeText = despacho ? "#166534" : "#9a3412";

    const li = document.createElement("li");
    li.style.padding = "12px";
    li.style.borderRadius = "12px";
    li.style.background = "#ffffff";
    li.style.boxShadow = "0 10px 22px rgba(15,23,42,0.12)";
    li.style.display = "flex";
    li.style.alignItems = "center";
    li.style.justifyContent = "space-between";
    li.style.gap = "12px";

    li.innerHTML = `
      <div>
        <div style="font-weight:800;color:#0f172a;">${f.chofer || f.nombre_display || "-"}</div>
        <div style="font-size:12px;color:#64748b;">🕒 Llegada: ${hora}</div>
      </div>
      <span style="
        font-size:12px;
        padding:6px 10px;
        border-radius:999px;
        background:${badgeBg};
        border:1px solid ${badgeBorder};
        color:${badgeText};
        font-weight:800;
      ">${estado}</span>
    `;

    listaHoy.appendChild(li);
  }
}

function iniciarListadoHoyEnVivo() {
  const hoy = hoyISO();

  // Fichajes
  onSnapshot(collection(db, "fichajes_diarios"), (snapshot) => {
    fichajesHoy = [];
    snapshot.forEach((d) => {
      if (d.id.startsWith(hoy + "_")) {
        fichajesHoy.push({ _id: d.id, ...d.data() });
      }
    });
    renderListadoHoy();
  });

  // Despachos
  onSnapshot(collection(db, "despachos_diarios"), (snapshot) => {
    despachosHoy = [];
    snapshot.forEach((d) => {
      if (d.id.startsWith(hoy + "_")) {
        despachosHoy.push({ _id: d.id, ...d.data() });
      }
    });
    renderListadoHoy();
  });
}

/*************************************************
 * INIT
 *************************************************/
initChoferDropdown();
iniciarListadoHoyEnVivo();
