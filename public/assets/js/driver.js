const btn = document.getElementById("btnLlegada");
const estado = document.getElementById("estado");

btn.addEventListener("click", () => {
  estado.classList.remove("oculto");
  estado.innerText = "Llegada registrada (simulación)";
});
