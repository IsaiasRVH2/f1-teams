// public/js/nextgp.js

(async function fetchNextGPClient() {
    try {
      // Llamar al proxy en tu servidor
      const response = await fetch('/api/proxy/nextgp');
      if (!response.ok) {
        throw new Error('Error al obtener el próximo GP');
      }
      const data = await response.json();
      if (data.race && data.race.length > 0) {
        const race = data.race[0];
        // Usar raceName para el nombre del GP
        const gpName = race.raceName || 'Próximo GP';
        const raceDate = race.schedule.race.date;
        const raceTime = race.schedule.race.time || "00:00:00";
        const raceDateTime = new Date(`${raceDate}T${raceTime}`);
        
        const now = new Date();
        const diff = raceDateTime - now;
        let timeRemaining = "No disponible";
        if (diff > 0) {
          startCountdown(raceDateTime);
        } else {
          timeRemaining = "El GP ya ha comenzado o finalizado.";
        }
        
        document.getElementById('nextGPName').textContent = gpName;
        document.getElementById('nextGPDate').textContent = `Fecha: ${raceDateTime.toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}`;
        
      } else {
        document.getElementById('nextGPName').textContent = 'No disponible';
        document.getElementById('nextGPDate').textContent = 'Fecha: No disponible';
        document.getElementById('timeRemaining').textContent = 'Tiempo restante: No disponible';
      }
    } catch (error) {
      console.error('Error en fetchNextGPClient:', error);
      document.getElementById('nextGPName').textContent = 'No disponible';
      document.getElementById('nextGPDate').textContent = 'Fecha: No disponible';
      document.getElementById('timeRemaining').textContent = 'Tiempo restante: No disponible';
    }
  })();
  
  function startCountdown(raceDateTime) {
    // Actualizar cada 1 segundo
    const intervalId = setInterval(() => {
      const now = new Date();
      const diff = raceDateTime - now;
  
      if (diff <= 0) {
        document.getElementById('timeRemaining').textContent =
          "El GP ya ha comenzado o finalizado.";
        clearInterval(intervalId); // Detener el intervalo
        return;
      }
  
      // Cálculo de días, horas, minutos y segundos
      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
      const minutes = Math.floor((diff / (1000 * 60)) % 60);
      const seconds = Math.floor((diff / 1000) % 60);
  
      document.getElementById('timeRemaining').textContent =
        `Tiempo restante: ${days} días, ${hours} horas, ${minutes} minutos, ${seconds} segundos`;
    }, 1000);
  }