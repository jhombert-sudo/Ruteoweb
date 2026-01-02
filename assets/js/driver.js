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

// ✅ NUEVO: LISTADO (2 columnas)
const hoyBox = document.getElementById("hoy-box");
const listaPendientesChofer = document.getElementById("lista-pendientes-chofer");
const listaDespachadosChofer = document.getElementById("lista-despachados-chofer");

// ✅ NUEVO: QR PLEGABLE (NO ROMPE SI NO EXISTE)
const btnToggleQR = document.getElementById("btnToggleQR");
const qrContainer = document.getElementById("qr-container");

// ✅ NUEVO: Mi horario (NO ROMPE SI NO EXISTE)
const miHorarioBox = document.getElementById("mi-horario-box");

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
 * QR PLEGABLE: helpers (NO ROMPE)
 *************************************************/
function setQRVisible_(visible) {
  if (qrContainer) qrContainer.style.display = visible ? "block" : "none";
  if (btnToggleQR) btnToggleQR.textContent = visible ? "Ocultar QR" : "Mostrar QR";
}

function enableQRToggle_() {
  if (!btnToggleQR) return;

  btnToggleQR.style.display = "block"; // aparece el botón cuando hay QR para mostrar
  // si todavía no se seteó, dejamos oculto por defecto
  if (qrContainer && (qrContainer.style.display === "" || qrContainer.style.display === "none")) {
    setQRVisible_(false);
  }

  // evitar duplicar listeners si se llama varias veces
  if (btnToggleQR.dataset.bound === "1") return;
  btnToggleQR.dataset.bound = "1";

  btnToggleQR.addEventListener("click", () => {
    const visible = qrContainer && qrContainer.style.display !== "none";
    setQRVisible_(!visible);
  });
}

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

    // ✅ Si ya tiene chofer asignado, vemos si ya fichó hoy y mostramos/ocultamos el bloque
    await actualizarVisibilidadListado();
    // ✅ Si ya fichó hoy, también habilitamos el toggle (si existe QR renderizado luego)
    hideQRUIUntilNeeded_();
    return;
  }

  // 3) Si no está asignado -> permite elegir
  driverSelect.addEventListener("change", async () => {
    const elegido = choferes.find(c => c.id === driverSelect.value);
    if (!elegido) {
      driverId = null;
      nombreChofer = null;
      tipoChofer = "NORMAL";
      if (turnoInfo) turnoInfo.textContent = "";
      welcome.innerText = "Bienvenido";
      if (hoyBox) hoyBox.style.display = "none";
      hideQRUIUntilNeeded_();
      return;
    }

    driverId = elegido.id;
    nombreChofer = elegido.nombre_display || elegido.id;
    tipoChofer = elegido.tipo || "NORMAL";

    welcome.innerText = `Bienvenido, ${nombreChofer}`;
    if (turnoInfo) {
      turnoInfo.textContent = (tipoChofer === "TURBO") ? "🚀 TURBO (sin horario fijo)" : "";
    }

    // ✅ Aún no fichó => oculto
    if (hoyBox) hoyBox.style.display = "none";
    hideQRUIUntilNeeded_();
  });
}

/*************************************************
 * OCULTAR UI QR / mi horario hasta que haya fichaje
 *************************************************/
function hideQRUIUntilNeeded_() {
  if (btnToggleQR) btnToggleQR.style.display = "none";
  if (qrContainer) qrContainer.style.display = "none";
  // miHorarioBox queda listo para futuro (si no lo usamos ahora no rompe)
  if (miHorarioBox) miHorarioBox.style.display = "none";
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
    await actualizarVisibilidadListado(); // ✅ muestra el bloque si corresponde
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

  // ✅ Ahora sí: aparece el listado
  await actualizarVisibilidadListado();
}

/*************************************************
 * QR TEMPORAL (VISUAL) + ✅ QR PLEGABLE
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

  // ✅ Activamos el botón plegable y dejamos el QR oculto por defecto
  enableQRToggle_();
  setQRVisible_(false);

  setTimeout(() => {
    // si se borra el contenedor, también escondemos el botón
    if (contenedor) contenedor.remove();
    if (btnToggleQR) btnToggleQR.style.display = "none";
  }, 2 * 60 * 60 * 1000);
}

/*************************************************
 * LISTADO EN VIVO: ESTADO DEL DÍA (ORDEN LLEGADA)
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
  if (!listaPendientesChofer || !listaDespachadosChofer) return;

  listaPendientesChofer.innerHTML = "";
  listaDespachadosChofer.innerHTML = "";

  const ordenados = [...fichajesHoy].sort((a, b) => getLlegadaDate(a) - getLlegadaDate(b));

  const pendientes = [];
  const despachados = [];

  for (const f of ordenados) {
    const despacho = despachosHoy.find(d => d._id === f._id) ||
      despachosHoy.find(d =>
        String(d._id).toLowerCase().replace(/\s+/g, "_") === String(f._id).toLowerCase()
      );

    if (despacho) despachados.push(f);
    else pendientes.push(f);
  }

  function cardItem(f, estado) {
    const llegada = getLlegadaDate(f);
    const hora = llegada.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" });

    const badge = estado === "Despachado"
      ? { bg: "#dcfce7", br: "#16a34a", tx: "#166534", label: "Despachado" }
      : { bg: "#ffedd5", br: "#f59e0b", tx: "#9a3412", label: "Pendiente" };

    const li = document.createElement("li");
    li.style.padding = "10px 12px";
    li.style.borderRadius = "12px";
    li.style.background = "#ffffff";
    li.style.boxShadow = "0 8px 18px rgba(15,23,42,0.10)";
    li.style.display = "flex";
    li.style.alignItems = "center";
    li.style.justifyContent = "space-between";
    li.style.gap = "10px";

    li.innerHTML = `
      <div>
        <div style="font-weight:900;color:#0f172a;">${f.chofer || f.nombre_display || "-"}</div>
        <div style="font-size:12px;color:#64748b;">🕒 Llegada: ${hora}</div>
      </div>
      <span style="
        font-size:12px;
        padding:6px 10px;
        border-radius:999px;
        background:${badge.bg};
        border:1px solid ${badge.br};
        color:${badge.tx};
        font-weight:900;
        white-space:nowrap;
      ">${badge.label}</span>
    `;

    return li;
  }

  if (!pendientes.length) {
    const li = document.createElement("li");
    li.style.fontSize = "13px";
    li.style.color = "#9a3412";
    li.textContent = "Sin pendientes.";
    listaPendientesChofer.appendChild(li);
  } else {
    pendientes.forEach(f => listaPendientesChofer.appendChild(cardItem(f, "Pendiente")));
  }

  if (!despachados.length) {
    const li = document.createElement("li");
    li.style.fontSize = "13px";
    li.style.color = "#166534";
    li.textContent = "Sin despachados.";
    listaDespachadosChofer.appendChild(li);
  } else {
    despachados.forEach(f => listaDespachadosChofer.appendChild(cardItem(f, "Despachado")));
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
 * MOSTRAR/OCULTAR BLOQUE SOLO SI ESTE CHOFER FICHÓ HOY
 *************************************************/
async function actualizarVisibilidadListado() {
  if (!hoyBox || !driverId) return;

  const hoy = hoyISO();
  const docId = `${hoy}_${driverId}`;
  const ref = doc(db, "fichajes_diarios", docId);
  const snap = await getDoc(ref);

  hoyBox.style.display = snap.exists() ? "block" : "none";
}

/*************************************************
 * INIT
 *************************************************/
hideQRUIUntilNeeded_();
initChoferDropdown();
iniciarListadoHoyEnVivo();
actualizarVisibilidadListado();
