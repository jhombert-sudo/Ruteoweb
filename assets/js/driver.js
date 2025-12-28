const btnFichar = document.getElementById("btnFichar");
const statusEl = document.getElementById("status");
const infoEl = document.getElementById("info");

const driverNameEl = document.getElementById("driverName");
const arrivalTimeEl = document.getElementById("arrivalTime");

// CONFIGURACIÓN
const CENTRO_LAT = -34.6037;   // ejemplo
const CENTRO_LNG = -58.3816;   // ejemplo
const RADIO_METROS = 300;

// BOTÓN
btnFichar.addEventListener("click", () => {
  statusEl.innerText = "Obteniendo ubicación...";
  obtenerUbicacion();
});

function obtenerUbicacion() {
  if (!navigator.geolocation) {
    statusEl.innerText = "Tu celular no soporta geolocalización";
    return;
  }

  navigator.geolocation.getCurrentPosition(
    onSuccess,
    onError,
    { enableHighAccuracy: true }
  );
}

function onSuccess(position) {
  const lat = position.coords.latitude;
  const lng = position.coords.longitude;

  const distancia = calcularDistancia(lat, lng, CENTRO_LAT, CENTRO_LNG);

  if (distancia > RADIO_METROS) {
    statusEl.innerText = "No estás en el punto de fichaje";
    return;
  }

  registrarLlegada();
}

function onError() {
  statusEl.innerText = "No se pudo obtener la ubicación";
}

function registrarLlegada() {
  const nombre = obtenerNombreChofer();
  const ahora = new Date();

  driverNameEl.innerText = nombre;
  arrivalTimeEl.innerText = ahora.toLocaleTimeString();

  infoEl.classList.remove("hidden");
  statusEl.innerText = "Llegada registrada correctamente";

  console.log("Registro:", {
    chofer: nombre,
    hora: ahora.toISOString(),
    estado: "pendiente"
  });
}

// SIMULACIÓN DE IDENTIDAD (luego Firebase)
function obtenerNombreChofer() {
  let nombre = localStorage.getItem("driverName");

  if (!nombre) {
    nombre = prompt("Ingresá tu nombre");
    localStorage.setItem("driverName", nombre);
  }

  return nombre;
}

// DISTANCIA HAVERSINE
function calcularDistancia(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const toRad = x => x * Math.PI / 180;

  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}
