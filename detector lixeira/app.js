// ─── Configurações MQTT/WebSocket ───────────────────────────────────────────────
const brokerUrl  = 'ws://192.168.15.151:8080/mqtt'; // IP do PC + WebSocket na porta 8080
const topicDHT   = 'lixeira/dht';
const topicDist  = 'lixeira/distancia';

// ─── Referências a elementos do DOM ───────────────────────────────────────────────
const tempValueElem  = document.getElementById('tempValue');
const binStatusElem  = document.getElementById('binStatus');
const alertMsgElem   = document.getElementById('alertMsg');
const recordTempElem = document.getElementById('recordTemp');
const recordTimeElem = document.getElementById('recordTime');
// Referência ao elemento de áudio para o alarme
const audioAlarm     = document.getElementById('audioAlarm');

// ─── Variáveis de recorde ─────────────────────────────────────────────────────────
let recordTemp = -Infinity;
let recordTime = '--:--:--';

// ─── Dados iniciais para o gráfico de temperatura ─────────────────────────────────
const tempData   = [];
const timeLabels = [];

// ─── Configuração do Chart.js ─────────────────────────────────────────────────────
const ctx = document.getElementById('tempChart').getContext('2d');
const tempChart = new Chart(ctx, {
  type: 'line',
  data: {
    labels: timeLabels,
    datasets: [{
      label: 'Temperatura (°C)',
      data: tempData,

      // Desativa suavização e exibe pontos fixos:
      tension: 0,           
      pointRadius: 6,       
      pointHoverRadius: 8,
      pointBackgroundColor: 'rgba(255, 99, 132, 1)',
      pointBorderColor: 'rgba(255, 99, 132, 1)',
      pointBorderWidth: 1,

      borderColor: 'rgba(255, 99, 132, 0.6)',
      borderWidth: 2,
      fill: false
    }]
  },
  options: {
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      x: {
        display: true,
        title: { display: true, text: 'Horário' }
      },
      y: {
        display: true,
        title: { display: true, text: '°C' },
        suggestedMin: 0,
        suggestedMax: 100
      }
    },
    plugins: {
      title: {
        display: true,
        text: 'Temperatura Interna da Lixeira'
      },
      legend: {
        display: false
      }
    },
    interaction: {
      mode: 'nearest',
      axis: 'x',
      intersect: false
    }
  }
});

// ─── Função para adicionar um novo ponto de temperatura no gráfico ────────────────
function adicionarTemperaturaNoGrafico(temp, horarioLabel) {
  tempChart.data.labels.push(horarioLabel);
  tempChart.data.datasets[0].data.push(temp);

  // Mantém apenas as últimas 20 leituras
  if (tempChart.data.labels.length > 20) {
    tempChart.data.labels.shift();
    tempChart.data.datasets[0].data.shift();
  }
  tempChart.update();
}

// ─── Atualiza o recorde se for uma nova temperatura máxima ────────────────────────
function verificaEAtualizaRecorde(temp, horarioLabel) {
  if (temp > recordTemp) {
    recordTemp = temp;
    recordTime = horarioLabel;

    // Atualiza o DOM
    recordTempElem.textContent = `${recordTemp.toFixed(1)} °C`;
    recordTimeElem.textContent = recordTime;
  }
}

// ─── Conecta ao broker MQTT via WebSocket ────────────────────────────────────────
const client = mqtt.connect(brokerUrl);

client.on('connect', () => {
  console.log('Conectado ao broker MQTT via WebSocket');
  client.subscribe(topicDHT);
  client.subscribe(topicDist);
  alertMsgElem.textContent = 'Conectado ao broker. Aguardando dados...';
  alertMsgElem.style.color = 'green';
});

client.on('error', (err) => {
  console.error('Erro no cliente MQTT:', err);
  alertMsgElem.textContent = 'Erro de conexão com o broker!';
  alertMsgElem.style.color = 'red';
});

// ─── Tratamento de mensagens recebidas via MQTT ─────────────────────────────────
client.on('message', (topic, payload) => {
  const message = payload.toString();

  if (topic === topicDHT) {
    // Espera JSON no formato: {"temp": xx.x, "hum": yy.y}
    try {
      const data = JSON.parse(message);
      const temp = parseFloat(data.temp.toFixed(1));
      const now  = new Date();
      const timeLabel = now.toLocaleTimeString();

      // 1) Atualiza valor de temperatura no DOM
      tempValueElem.textContent = `${temp} °C`;

      // 2) Atualiza gráfico
      adicionarTemperaturaNoGrafico(temp, timeLabel);

      // 3) Verifica recorde
      verificaEAtualizaRecorde(temp, timeLabel);

      // 4) Verifica limiares e exibe alerta + toca áudio se ≥ 90 °C
      if (temp >= 60.0) {
        alertMsgElem.textContent = '🔥 ALERTA CRÍTICO: POSSÍVEL INCÊNDIO! DETECTOR SATURADO';
        alertMsgElem.style.color = 'red';
        // Toca o áudio de alarme (se ainda não estiver tocando)
        if (audioAlarm.paused) {
          audioAlarm.currentTime = 0;
          audioAlarm.play().catch(err => console.error('Falha ao tocar áudio:', err));
        }
      }
      else if (temp >= 50.0) {
        alertMsgElem.textContent = '⚠️ CUIDADO: TEMPERATURA ALTA (≥ 50 °C) RISCO DE DANOS AO DETECTOR';
        alertMsgElem.style.color = 'orange';
        // Pausar/parar o áudio, caso estivesse tocando
        if (audioAlarm.paused) {
          audioAlarm.currentTime = 0;
          audioAlarm.play().catch(err => console.error('Falha ao tocar áudio:', err));
        }
      }
      else {
        alertMsgElem.textContent = 'Temperatura normal.';
        alertMsgElem.style.color = 'green';
        // Pausar/parar o áudio caso estivesse tocando
        if (!audioAlarm.paused) {
          audioAlarm.pause();
          audioAlarm.currentTime = 0;
        }
      }
    }
    catch (e) {
      console.error('Erro ao parsear JSON de temperatura:', e);
    }

  } 
  else if (topic === topicDist) {
    // Espera string contendo número, ex: "12.3"
    const dist = parseFloat(parseFloat(message).toFixed(1));
    // Define status da lixeira: <10 cm = fechada, >30 cm = aberta, senão mostra valor
    if (dist <= 10) {
      binStatusElem.textContent = 'Fechada';
      binStatusElem.style.color = 'blue';
    }
    else {
      binStatusElem.textContent = 'Aberta';
      binStatusElem.style.color = 'green';
    }

  }
});
