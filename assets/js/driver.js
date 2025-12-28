const btnFichar = document.getElementById("btnFichar");
const loader = document.getElementById("loader");
const welcome = document.getElementById("welcome");

/* CONFIGURACIÓN (GEO DESACTIVADA TEMPORALMENTE) */
const CENTRO_LAT = -34.6037;
const CENTRO_LNG = -58.3816;
const RADIO_METROS = 300;

/* IDENTIDAD DEL CHOFER (POR DISPOSITIVO) */
const nombreChofer = obtenerNombreChofer();
welcome.innerText = `Bienvenido, ${nombreChofer}`;

/* EVENTO BOTÓN */
btnFichar.addEventListener("click", async () => {
  const autenticado = await autenticarDispositivo();
  if (!autenticado) return;

  loader.classList.remove("hidden");
  obtenerUbicacion();
});

/* GEOLOCALIZACIÓN */
function obtenerUbicacion() {
  if (!navigator.geolocation) {
    alert("Tu dispositivo no soporta geolocalización");
    loader.classList.add("hidden");
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

  // VALIDACIÓN DE ZONA (DESACTIVADA POR AHORA)
  // const distancia = calcularDistancia(lat, lng, CENTRO_LAT, CENTRO_LNG);
  // if (distancia > RADIO_METROS) {
  //   alert("No estás en el punto de fichaje");
  //   loader.classList.add("hidden");
  //   return;
  // }

  registrarLlegada(lat, lng);
}

function onError() {
  alert("No se pudo obtener la ubicación");
  loader.classList.add("hidden");
}

/* REGISTRO (SIMULADO) */
function registrarLlegada(lat, lng) {
  const ahora = new Date();

  console.log("LLEGADA REGISTRADA", {
    chofer: nombreChofer,
    hora: ahora.toISOString(),
    lat,
    lng,
    estado: "pendiente"
  });

  alert("Llegada registrada correctamente ✅");
  loader.classList.add("hidden");
}

/* IDENTIDAD POR CELULAR */
function obtenerNombreChofer() {
  let nombre = localStorage.getItem("driverName");

  if (!nombre) {
    nombre = prompt("Ingresá tu nombre");
    localStorage.setItem("driverName", nombre);
  }

  return nombre;
}

/* AUTENTICACIÓN BIOMÉTRICA REAL (FACE ID / HUELLA / PIN) */
async function autenticarDispositivo() {
  if (!window.PublicKeyCredential) {
    return true;
  }

  try {
    await navigator.credentials.get({
      publicKey: {
        challenge: new Uint8Array(32),
        timeout: 60000,
        userVerification: "required"
      }
    });
    return true;
  } catch (e) {
    alert("Autenticación cancelada");
    return false;
  }
}

/* DISTANCIA (PARA CUANDO ACTIVEMOS GEO) */
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
