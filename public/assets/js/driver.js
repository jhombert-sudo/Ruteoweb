const btnLlegada = document.getElementById('btnLlegada');
const estado = document.getElementById('estado');

btnLlegada.addEventListener('click', () => {
  estado.classList.remove('oculto');
  estado.innerText = '⏳ Registrando llegada...';

  setTimeout(() => {
    estado.innerText = '✅ Llegada registrada correctamente';
  }, 1500);
});
