```markdown
# Detector de Fogo na Lixeira (IoT Trash Bin Monitor)

Este repositório contém o projeto completo para monitorar temperatura e nível de enchimento de uma lixeira usando ESP8266, DHT11, HC-SR04 e protocolo MQTT. Os dados são enviados para um broker Mosquitto e exibidos em um dashboard web em tempo real.

---

## 📂 Estrutura do Repositório
/
├── README.md                 ← (este arquivo de documentação)
├── mosquitto.conf            ← Configuração customizada do broker Mosquitto
├── sketch_jun3a.ino          ← Firmware Arduino (ESP8266) para ler sensores e publicar via MQTT
├── detector lixeira/         ← Front-end (dashboard web)
│   ├── index.html            ← Página HTML principal do dashboard
│   ├── style.css             ← Estilos CSS usados pelo dashboard
│   ├── app.js                ← Lógica JavaScript (MQTT.js + Chart.js) do dashboard
│   └── alarm.mp3             ← Áudio de alarme usado quando a temperatura excede 90 °C
└── (outras pastas/opcionais)  ← Você pode adicionar wiring/ ou refs/ mais tarde, se desejar

```


````

---

## 📋 1. Visão Geral do Projeto

**Nome do projeto:**  
Detector de Fogo na Lixeira usando ESP8266, DHT11, HC-SR04 e MQTT

**Objetivo:**  
1. Ler a temperatura interna de uma lixeira (com DHT11) e medir a distância até o lixo (com HC-SR04).  
2. Publicar esses valores a cada 5 segundos em tópicos MQTT (`trashbin/temperature` e `trashbin/distance`).  
3. Receber esses dados em um dashboard web (via MQTT sobre WebSocket) para exibir gráficos em tempo real, indicar se a lixeira está “aberta” ou “fechada”, mostrar o recorde de temperatura e tocar um alarme no browser se a temperatura atingir ou ultrapassar 90 °C.

---

## 🔧 2. Pré-requisitos

### 2.1 Hardware

- **ESP8266 (NodeMCU ou similar).**  
- **Sensor DHT11** (temperatura e umidade).  
- **Sensor HC-SR04** (ultrassônico para medir distância).  
- **Buzzer ativo** (5 V ou 3,3 V, dependendo do modelo).  
- **Jumpers / cabos** e **protoboard**.  
- **Resistores** para montar o divisor de tensão (2 kΩ e 3,3 kΩ ou valores equivalentes) entre o pino ECHO (5 V) do HC-SR04 e o GPIO do ESP8266 (3,3 V).  
- **Cabo USB** para alimentar e programar o NodeMCU.  

### 2.2 Software (no PC)

- **Mosquitto Broker** (versão ≥ 2.x recomendado).  
  - Instale via gerenciador de pacotes (Linux/Mac) ou baixando do site oficial (Windows).  
- **Arduino IDE** (versão ≥ 1.8.5) ou **VSCode + PlatformIO** para compilar e enviar o firmware ao ESP8266.
- **Browser moderno** (Chrome, Firefox, Edge) com suporte a WebSocket e áudio HTML5.  
- **Git** para clonar este repositório (opcional, mas recomendado).  

---

## ⚙️ 3. Configurando o Mosquitto Broker

1. **Copie o arquivo `mosquitto.conf`** para a pasta de configuração do Mosquitto ou inicie diretamente com ele:
   ```bash
   mosquitto -c mosquitto.conf
````

O conteúdo mínimo de `mosquitto.conf` está assim:

```conf
listener 1883
protocol mqtt

listener 8080
protocol websockets

allow_anonymous true
log_type all
```

* **Porta 1883** → MQTT “puro” para o ESP8266.
* **Porta 8080** → MQTT sobre WebSocket para o dashboard navegador.
* `allow_anonymous true` → permite conexão sem usuário/senha (apenas para desenvolvimento local).

2. **Verifique se o broker está “escutando”**:

   ```bash
   # Linux/Mac
   netstat -tulpen | grep -E "1883|8080"
   ```

   ```powershell
   # Windows (PowerShell ou Prompt de Comando)
   netstat -ano | findstr ":1883"
   netstat -ano | findstr ":8080"
   ```

   Você deve ver ambos como `LISTENING`.

3. **Teste básico no terminal**:

   * Em um terminal, execute:

     ```bash
      mosquitto_sub -h localhost -t lixeira/# -v
     ```
   * Em outro terminal, publique manualmente:

     ```bash
     mosquitto_pub -h localhost -t "lixeira/temperature" -m "{\"temp\":25.0,\"hum\":60.0}"
     ```
   * O terminal do `mosquitto_sub` deverá exibir:

     ```
     lixeira/temperature {"temp":25.0,"hum":60.0}
     ```

---

## 📡 4. Instalando e Enviando o Firmware ao ESP8266

### 4.1 Abrir o Arduino IDE

1. **Abra o arquivo** `sketch_jun3a.ino` (dentro da raiz do repositório) no Arduino IDE ou no VSCode (com PlatformIO).

2. **Configure a placa**:
   * `File → Preferences → Additional boards manager urls e escreva "http://arduino.esp8266.com/stable/package_esp8266com_index.json" para conseguir ter o board manager da placa `
   * `Ferramentas → Placa → NodeMCU 1.0 (ESP-12E Module)`
   * `Ferramentas → Flash Size → 4M (1M SPIFFS)` (ou similar)
   * `Ferramentas → Upload Speed → 115200`

3. **Instale as bibliotecas necessárias** (caso ainda não estejam instaladas):

   * `Sketch → Include Library → Manage Libraries…` e instale:

     * **DHT sensor library** (por Adafruit)
     * **PubSubClient** (por Nick O’Leary)
   * O `ESP8266WiFi` já faz parte do core ESP8266.

### 4.2 Ajustar credenciais Wi-Fi e IP do Broker

No início de `sketch_jun3a.ino`, localize e ajuste:

```cpp
const char* ssid     = "Joma";
const char* password = "jm207021";
const char* mqtt_server = "192.168.15.151"; // IP do PC onde está o Mosquitto
```

* Se o seu PC tiver IP diferente, altere `mqtt_server` para o IP correto.

### 4.3 Conectar fisicamente os sensores

#### DHT11

* **Visão do DHT11 (frente para você, face plástica plana):**

  ```
  [ GND ] [ DATA ] [ VCC ]
     ^       ^       ^
     |       |       +--> 3.3 V do NodeMCU
     |       +----------> D4 (GPIO2)
     +------------------> GND do NodeMCU
  ```

#### HC-SR04

* **Visão do HC-SR04 (frente com o letreiro “HC-SR04”):**

  ```
  [ VCC ] [ TRIG ] [ ECHO ] [ GND ]
    ^       ^        ^        ^
    |       |        |        +--> GND do NodeMCU
    |       |        +-------------> D2 (GPIO4)
    |       +----------------------> D1 (GPIO5)
    +-----------------------------> 3V (3v do NodeMCU)
  ```

  * **VCC** → **3 V** (3v do NodeMCU)
  * **TRIG** → **D1** (GPIO5)
  * **ECHO** → **D2** (GPIO4) 
  * **GND** → **GND**

#### Buzzer (ativo)

* **+** → **D5** (GPIO14)
* **–** → **GND**

### 4.4 Fazer Upload

1. Conecte o NodeMCU via USB ao PC.
2. Selecione a **porta serial correta** em `Ferramentas → Porta`.
3. Clique em **Upload**.
4. Abra o **Serial Monitor** (115200 baud) e observe mensagens como:

   ```
   Connecting to WiFi..
   WiFi connected, IP: 192.168.15.123
   Attempting MQTT connection...
   MQTT connected
   Reading DHT11...
   DHT11 → Temp: 25.0 °C, Hum: 60.0 %
   Publishing to topic trashbin/temperature
   Reading HC-SR04...
   HC-SR04 → distance = 12.3 cm
   Publishing to topic trashbin/distance
   ```

---

## 🌐 5. Executando o Dashboard Web

1. Navegue até a pasta `detector lixeira/`.
2. Abra o arquivo `index.html` no seu navegador (duplo clique ou `Ctrl+O → index.html`).

   * Não é necessária a instalação de servidor web; o arquivo pode ser aberto diretamente.
3. Ao carregar, o dashboard tentará conectar-se a:

   ```
   ws://192.168.15.151:8080/mqtt
   ```

   (ou seja, ao broker Mosquitto rodando em `192.168.15.151` na porta 8080).
4. Se a conexão WebSocket for bem-sucedida, aparecerá uma mensagem de “Connected to broker” no canto superior.
5. Conforme o ESP8266 publicar dados, o gráfico automático atualizará:

   * **Temperatura (°C)**: gráfico de linha mostrando os últimos 20 valores.
   * **Status da Lixeira**:

     * `<= 10 cm` → “Closed” (azul)
     * `> 10 cm` → “Open” (verde)
    
   * **Temperatura Recorde**: exibe o maior valor recebido e o horário correspondente.
   * **Alertas**:

     * **< 50 °C** → “Temperature normal.” (verde)
     * **≥ 50 °C e < 90 °C** → “⚠️ High Temperature (≥ 50 °C – risk of sensor damage)” (laranja) e o áudio `alarm.mp3` será reproduzido no browser (verifique se seu navegador permite tocar sons automaticamente).
     * **≥ 90 °C** → “🔥 CRITICAL ALERT: POSSIBLE FIRE!” (vermelho) o audio do alarme tocara novamente se necessario

---

## 🛠 6. Detalhes das Customizações

### 6.1 mosquitto.conf

* Adicionamos dois listeners:

  ```conf
  listener 1883
  protocol mqtt

  listener 8080
  protocol websockets

  allow_anonymous true
  log_type all
  ```
* Isso permite que o ESP8266 (cliente MQTT “puro”) se conecte em TCP:1883 e o dashboard (via WebSocket) se conecte em WS:8080.

### 6.2 Firmware ESP8266 (sketch\_jun3a.ino)

* **Bibliotecas usadas:**

  ```cpp
  #include <ESP8266WiFi.h>
  #include <PubSubClient.h>
  #include <DHT.h>
  ```
* **Pinagem:**

  ```cpp
  #define DHTPIN  D4         // Pino de dados do DHT11
  #define DHTTYPE DHT11

  const int trigPin   = D1; // HC-SR04 TRIG (GPIO5)
  const int echoPin   = D2; // HC-SR04 ECHO (GPIO4, via divisor de tensão)
  const int buzzerPin = D5; // Buzzer (GPIO14)
  ```
* **Funções principais:**

  1. `connectToWiFi()`: conecta ao SSID “Joma” e espera até obter IP.
  2. `connectToMQTT()`: reconecta ao broker em loop, pausando 5 s entre tentativas.
  3. `publishDHT11()`:

     * Lê `temp` e `hum` do DHT11.
     * Publica um JSON em `trashbin/temperature`:

       ```json
       {"temp": <valor>, "hum": <valor>}
       ```
     * Atualiza variável `recordTemp` e `recordTime` se o novo `temp` for maior.
     * Lógica de thresholds do buzzer:

       * `temp >= 90 °C` → `digitalWrite(buzzerPin, HIGH);` ashboard emite alerta Vermelho, (alarme contínuo).
       * `50 °C <= temp < 90 °C` → ashboard emite alerta laranja, (alarme contínuo).
       * `temp < 50 °C` →  dashboard emite alerta verde.
  4. `publishHC_SR04()`:

     * Gera pulso no `trigPin`:

       ```cpp
       digitalWrite(trigPin, LOW);
       delayMicroseconds(2);
       digitalWrite(trigPin, HIGH);
       delayMicroseconds(10);
       digitalWrite(trigPin, LOW);
       ```
     * Lê duração do eco: `duration = pulseIn(echoPin, HIGH, 30000);`
     * Calcula `distanceCM = (duration * 0.0343) / 2.0;`
     * Aplica filtro mediano de janela 5 para descartar leituras isoladas anômalas.
     * Publica em `trashbin/distance` (string com valor em centímetros).

### 6.3 Dashboard Web (`detector lixeira/`)

#### 6.3.1 index.html

* Importa as bibliotecas via CDN:

  ```html
  <script src="https://unpkg.com/mqtt/dist/mqtt.min.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
  ```
* Contém elementos:

  ```html
  <canvas id="tempChart"></canvas>
  <div id="status">
    <div id="currentTemp"></div>
    <div id="binStatus"></div>
  </div>
  <div id="recordSection">
    Record Temp: <span id="recordTemp">—</span> at <span id="recordTime">—</span>
  </div>
  <div id="alerts"></div>
  <audio id="audioAlarm" src="alarm.mp3"></audio>
  ```

#### 6.3.2 app.js

* Conecta-se ao broker usando MQTT.js:

  ```js
  const client = mqtt.connect('ws://192.168.15.151:8080/mqtt');
  ```
* Ao conectar:

  ```js
  client.on('connect', () => {
    console.log("Connected to broker");
    client.subscribe('trashbin/temperature');
    client.subscribe('trashbin/distance');
  });
  ```
* Ao receber mensagem:

  ```js
  client.on('message', (topic, payload) => {
    if (topic === 'trashbin/temperature') {
      const data = JSON.parse(payload.toString());
      const temp = data.temp;
      // Atualiza texto, gráfico, thresholds, recorde, áudio…
    }
    if (topic === 'trashbin/distance') {
      const dist = parseFloat(payload.toString());
      // Atualiza “Closed/Open/~xx cm” no HTML…
    }
  });
  ```
* Função `addTempToChart(temp, timeLabel)` mantém um array de até 20 pontos e atualiza o Chart.js.

#### 6.3.3 style.css

* Define cores e estilo responsivo:

  ```css
  body {
    font-family: Arial, sans-serif;
    margin: 1em;
  }
  #status {
    display: flex;
    justify-content: space-around;
    margin: 1em 0;
  }
  #recordSection, #alerts {
    text-align: center;
    margin: 0.5em 0;
    font-size: 1.1em;
  }
  .alert-green { color: green; }
  .alert-orange { color: orange; }
  .alert-red { color: red; }
  ```

---

## 📷 7. Demonstração / Fotos do Protótipo

A seguir, algumas fotos do protótipo para ilustrar a montagem:

<p align="center">
  <img src="detector lixeira/prototipo_1.jpg" alt="Protótipo montado no protoboard" width="300"/>
  <img src="detector lixeira/prototipo_2.jpg" alt="NodeMCU e sensores conectados" width="300"/>
</p>

* **Protótipo montado no protoboard:** HC-SR04 alimentado em 5 V, divisor de tensão no ECHO → D2, DHT11 em 3.3 V → D4, buzzer em D5.
* **NodeMCU em funcionamento:** Cabo USB conectado, LED Wi-Fi aceso, Serial Monitor exibindo leituras periódicas.

*(Substitua os nomes de arquivo acima pelos nomes reais das suas fotos, caso sejam diferentes.)*

---

## 📝 8. Licença e Créditos

Este projeto é distribuído sob a **Licença MIT**. Sinta-se à vontade para usar, modificar e compartilhar, contanto que mantenha este cabeçalho.

* **Autor:** Joao Marcio Prado Silva
* **E-mail:** [joaomarciopradosilva@gmail.com](mailto:joaomarciopradosilva@gmail.com)
* **Instituição:** IBMEC – Departamento de Engenharia Eletrônica

### Bibliotecas, Ferramentas e Referências

* **DHT sensor library (Adafruit)**
* **PubSubClient (Nick O’Leary)**
* **Chart.js** ([https://www.chartjs.org/](https://www.chartjs.org/))
* **MQTT.js** ([https://github.com/mqttjs/MQTT.js](https://github.com/mqttjs/MQTT.js))
* **Mosquitto** ([https://mosquitto.org/](https://mosquitto.org/))
* **PGFPlots** (usado no artigo LaTeX)
* Trabalhos relacionados (citados no artigo SBrT, seção de Referências)

---

## 🚀 10. Guia Rápido de Uso

1. **Instalar o Mosquitto**:

   ```bash
   # Ubuntu/Debian
   sudo apt update
   sudo apt install mosquitto mosquitto-clients

   # Windows
   # Baixe o instalador no site oficial e instale normalmente.
   ```
2. **Iniciar Mosquitto com a configuração customizada**:

   ```bash
   mosquitto -c mosquitto.conf
   ```
3. **Em um terminal, abra o subscriber**:

   ```bash
   mosquitto_sub -h localhost -t "trashbin/#" -v
   ```
4. **Abra a Arduino IDE** e carregue `sketch_jun3a.ino` no seu ESP8266:

   * Configure SSID, senha e `mqtt_server` corretamente.
   * Confira a pinagem dos sensores e buzzer.
   * Clique em **Upload**.
5. **Monte o hardware** seguindo o diagrama em “Detalhes das Customizações” (seção 6).
6. **Abra o browser** e dê um duplo clique em:

   ```
   detector lixeira/index.html
   ```

   * Aguarde a conexão WebSocket (`ws://<IP_do_broker>:8080/mqtt`).
   * Se conectar, verá no console “Connected to broker”.
   * Observe o gráfico de temperatura e o status da lixeira em tempo real.
7. **Dispare um teste manual** (opcional):

   ```bash
   mosquitto_pub -h localhost -t "trashbin/temperature" -m "{\"temp\":85.0,\"hum\":50.0}"
   ```

   * O dashboard deverá atualizar imediatamente (alerta laranja em ≥ 50 °C) e o áudio de alarme vai tocar.
   * Se você disparar `"temp":95.0`, o alerta ficará vermelho e o áudio de alarme vai tocar.



---



![vivaldi_Qu4CPt2w66](https://github.com/user-attachments/assets/d4438e72-80f1-43c1-ba62-02d96c8ae238)
![vivaldi_v3ZUmGsKAB](https://github.com/user-attachments/assets/a4f12e60-851b-4207-bec6-5b69230159bf)
![vivaldi_izXggpuN2d](https://github.com/user-attachments/assets/b0cefb40-c6be-4873-9d2d-a714fb53a42b)
![vivaldi_egducYBh5w](https://github.com/user-attachments/assets/3faa53b6-f584-460b-80da-0d4f183a0a63)
