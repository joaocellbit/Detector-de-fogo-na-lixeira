#include <ESP8266WiFi.h>
#include <PubSubClient.h>
#include <DHT.h>

// ─── CONFIGURAÇÕES Wi-Fi ───────────────────────────────────────────────────────
const char* ssid     = "Joma";
const char* password = "jm207021";

// ─── CONFIGURAÇÕES MQTT (BROKER) ────────────────────────────────────────────────
const char* mqtt_server = "192.168.15.151";  // IP do seu PC com Mosquitto
const int   mqtt_port   = 1883;              // Porta MQTT (sem TLS)

// ─── OBJETOS Wi-Fi e MQTT ───────────────────────────────────────────────────────
WiFiClient espClient;
PubSubClient client(espClient);

// ─── CONFIGURAÇÕES DHT11 ───────────────────────────────────────────────────────
#define DHTPIN  D4       // Conectar o pino DATA do DHT11 em D4 (GPIO2)
#define DHTTYPE DHT11    // Estamos usando DHT11 (não DHT22)
DHT dht(DHTPIN, DHTTYPE);

// ─── CONFIGURAÇÕES HC-SR04 ─────────────────────────────────────────────────────
const int trigPin = D1;  // Conectar TRIG em D1 (GPIO5)
const int echoPin = D2;  // Conectar ECHO em D2 (GPIO4), sensor alimentado a 3.3 V

// ─── VARIÁVEIS AUXILIARES ───────────────────────────────────────────────────────
unsigned long lastPublish    = 0;
const unsigned long interval = 5000;  // Publicar a cada 5 segundos


// ─── CALLBACK MQTT (não usamos subscribe por enquanto) ─────────────────────────
void callback(char* topic, byte* payload, unsigned int length) {
  // Vazio porque, neste teste completo, NÃO vamos receber mensagens, só publicar
}


// ─── TENTA CONECTAR AO BROKER MQTT ─────────────────────────────────────────────
void connectToMQTT() {
  while (!client.connected()) {
    Serial.print("Tentando conexão MQTT… ");
    if (client.connect("ESP8266Client")) {
      Serial.println("Conectado ao broker MQTT");
      // Se no futuro você quiser usar subscribe, coloque aqui:
      // client.subscribe("algum/topico");
    } else {
      Serial.print("Falha (rc=");
      Serial.print(client.state());
      Serial.println("). Re-tentando em 5 s");
      delay(5000);
    }
  }
}


// ─── TENTA CONECTAR AO WI-FI ─────────────────────────────────────────────────────
void setupWiFi() {
  delay(10);
  Serial.println();
  Serial.print("Conectando-se a ");
  Serial.println(ssid);

  WiFi.begin(ssid, password);
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }

  Serial.println();
  Serial.println("Wi-Fi conectado");
  Serial.print("IP do ESP8266: ");
  Serial.println(WiFi.localIP());
}


// ─── SETUP() ────────────────────────────────────────────────────────────────────
void setup() {
  Serial.begin(115200);
  while (!Serial) { }  // Garante que a Serial esteja pronta

  // 1) Conecta no Wi-Fi
  setupWiFi();

  // 2) Configura o cliente MQTT
  client.setServer(mqtt_server, mqtt_port);
  client.setCallback(callback);

  // 3) Inicializa sensores
  dht.begin();
  pinMode(trigPin, OUTPUT);
  pinMode(echoPin, INPUT);
  digitalWrite(trigPin, LOW);
  delay(100);

  // 4) Conecta pela primeira vez ao broker MQTT
  connectToMQTT();

  Serial.println("Setup completo: ESP8266 pronto para ler sensores e publicar.");
  Serial.println("──────────────────────────────────────────────────────────────");
}


// ─── LOOP() ─────────────────────────────────────────────────────────────────────
void loop() {
  // 1) Garante que o MQTT permaneça conectado
  if (!client.connected()) {
    connectToMQTT();
  }
  client.loop();

  // 2) Publica a cada ‘interval’ milissegundos
  unsigned long now = millis();
  if (now - lastPublish > interval) {
    lastPublish = now;

    // ─── 2.1) LEITURA DHT11 ───────────────────────────────────────────────────
    Serial.println("=== Iniciando leitura DHT11 ===");
    float hum  = dht.readHumidity();
    float temp = dht.readTemperature();  // Leitura em °C

    if (isnan(hum) || isnan(temp)) {
      Serial.println("Erro ao ler do DHT11!");
    } else {
      Serial.print("Leitura DHT11 OK → Umidade: ");
      Serial.print(hum, 1);
      Serial.print(" %  |  Temp: ");
      Serial.print(temp, 1);
      Serial.println(" °C");

      // Monta payload JSON simples
      char payloadDHT[64];
      snprintf(payloadDHT, sizeof(payloadDHT),
               "{\"temp\":%.1f,\"hum\":%.1f}", temp, hum);

      Serial.print("Payload DHT11 = ");
      Serial.println(payloadDHT);

      // Publica no tópico "lixeira/dht"
      if (client.publish("lixeira/dht", payloadDHT)) {
        Serial.println("Publicou DHT11 com sucesso");
      } else {
        Serial.println("Falha ao publicar DHT11");
      }
    }

    // ─── 2.2) LEITURA HC-SR04 ─────────────────────────────────────────────────
    Serial.println("=== Iniciando leitura HC-SR04 ===");
    digitalWrite(trigPin, LOW);
    delayMicroseconds(2);
    digitalWrite(trigPin, HIGH);
    delayMicroseconds(10);
    digitalWrite(trigPin, LOW);

    long duration = pulseIn(echoPin, HIGH, 30000);
    if (duration == 0) {
      Serial.println("HC-SR04: Sem echo (fora de alcance ou erro)");
    } else {
      float distanceCM = (duration * 0.0343) / 2.0;
      Serial.print("Leitura HC-SR04 OK → distanceCM = ");
      Serial.print(distanceCM, 1);
      Serial.println(" cm");

      // Monta payload (texto puro com a distância em cm)
      char payloadDist[32];
      snprintf(payloadDist, sizeof(payloadDist), "%.1f", distanceCM);

      Serial.print("Payload HC-SR04 = ");
      Serial.println(payloadDist);

      // Publica no tópico "lixeira/distancia"
      if (client.publish("lixeira/distancia", payloadDist)) {
        Serial.println("Publicou HC-SR04 com sucesso");
      } else {
        Serial.println("Falha ao publicar HC-SR04");
      }
    }

    Serial.println("---------- FIM CICLO ----------");
    Serial.println();
  }
}
