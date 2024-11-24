#include <ESP8266WiFi.h>
#include <ESP8266HTTPClient.h>
#include <WiFiClientSecure.h>
#include <ArduinoJson.h>
#include <Keypad.h>

// WLAN-Daten
const char* ssid = "TICBOY";
const char* password = "17rdV7!cj3XMe7{4";

// API-Endpunkte
const char* authUrl = "https://192.168.1.10/api/ticboy/authentificate";
String notificationUrl = "https://192.168.1.10/api/ticboy_notifications/";

String userId = "";  // Dynamisch vom Benutzer eingegeben
String userPin = ""; // Dynamisch vom Benutzer eingegeben
String userSecret = "None";

// Keypad-Setup
const byte ROWS = 4; // Anzahl der Zeilen im Keypad
const byte COLS = 4; // Anzahl der Spalten im Keypad

char keys[ROWS][COLS] = {
  {'1', '2', '3', 'A'},
  {'4', '5', '6', 'B'},
  {'7', '8', '9', 'C'},
  {'*', '0', '#', 'D'}
};

byte rowPins[ROWS] = {D1, D2, D3, D4}; // Zeilenanschlüsse des Keypads
byte colPins[COLS] = {D5, D6, D7, D8}; // Spaltenanschlüsse des Keypads

Keypad keypad = Keypad(makeKeymap(keys), rowPins, colPins, ROWS, COLS);

// Verbindung mit dem UNO R3 über SoftwareSerial
#include <SoftwareSerial.h>
SoftwareSerial mySerial(2, 3); // RX, TX

enum InputState { ID_INPUT, PIN_INPUT, AUTHENTICATED };
InputState currentState = ID_INPUT;

void setup() {
  Serial.begin(9600);       // Debugging
  mySerial.begin(9600);     // Kommunikation mit dem UNO R3
  
  // WLAN verbinden
  WiFi.begin(ssid, password);
  
  Serial.println("NodeMCU gestartet...");
  Serial.print("Verbinde mit WLAN: ");
  Serial.println(ssid);
  
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  
  Serial.println("\nWLAN verbunden!");
  Serial.print("IP-Adresse: ");
  Serial.println(WiFi.localIP());
  
  Serial.println("Bitte ID eingeben:");
}

void loop() {
  char key = keypad.getKey();
  if (key) {
    handleKeyInput(key);
  }

  if (currentState == AUTHENTICATED && userSecret != "None") {
    static unsigned long lastRequestTime = 0;
    unsigned long currentMillis = millis();
    if (currentMillis - lastRequestTime >= 10000) {
      lastRequestTime = currentMillis;
      getNotifications();  // POST-Anfrage senden
    }
  }
}

void handleKeyInput(char key) {
  if (currentState == ID_INPUT) {
    if (key == '#') { // Abschluss der ID-Eingabe
      Serial.print("ID abgeschlossen: ");
      Serial.println(userId);
      Serial.println("Bitte PIN eingeben:");
      currentState = PIN_INPUT;
      
    } else {
      userId += key;
      Serial.print("ID: ");
      Serial.println(userId);
    }
  } else if (currentState == PIN_INPUT) {
    if (key == '#') { // Abschluss der PIN-Eingabe
      Serial.print("PIN abgeschlossen: ");
      Serial.println(userPin);
      authenticate();

    } else {
      userPin += key;
      Serial.print("PIN: ");
      Serial.println(userPin);
    }
  }
}

void authenticate() {
  String requestBody = "{\"userId\":\"" + userId + "\",\"userPin\":\"" + userPin + "\"}";
  
  WiFiClientSecure client;
  client.setInsecure();  // Selbstsignierte Zertifikate akzeptieren
  HTTPClient https;

  Serial.println("Sende Authentifizierungsanfrage...");
  
  if (https.begin(client, authUrl)) {  // Verbindung zur Authentifizierungs-API herstellen
    https.addHeader("Content-Type", "application/json");
    
    int httpResponseCode = https.POST(requestBody); // POST-Anfrage senden

    if (httpResponseCode > 0) {
      String response = https.getString();
      Serial.println("Antwort von der Authentifizierungs-API:");
      Serial.println(response);

      // JSON-Antwort verarbeiten
      StaticJsonDocument<512> doc;
      DeserializationError error = deserializeJson(doc, response);

      if (error) {
        Serial.print("Fehler beim Parsen der JSON-Antwort: ");
        Serial.println(error.c_str());
      } else {
        userSecret = doc["hash"].as<String>();
        if (doc["response"].as<int>() == 1){
              currentState = AUTHENTICATED;
        } else{
          Serial.println("Fehler beim Authentifizieren - Pin oder ID falsch");
          currentState = ID_INPUT;
	  userId = "";
	  userPin = "";
          Serial.println("Bitte ID eingeben:");
        }
        if (userSecret.length() > 0) {
          Serial.println("Authentifizierung erfolgreich!");
        } else {
          Serial.println("Fehler: Kein Secret erhalten.");
        }
      }
    } else {
      Serial.print("Fehler bei der POST-Anfrage. HTTP-Code: ");
      Serial.println(httpResponseCode);
    }
    https.end();  // Verbindung schließen
  } else {
    Serial.println("Fehler beim Herstellen der Verbindung zur API.");
  }
}

void getNotifications() {
  String url = notificationUrl + userId;  // API-URL für Benachrichtigungen
  Serial.print("Lade Benachrichtigungen von URL: ");
  Serial.println(url);

  WiFiClientSecure client;
  client.setInsecure();  // Selbstsignierte Zertifikate akzeptieren
  HTTPClient hClient;

  if (hClient.begin(client, url)) {  // Verbindung zur Benachrichtigungs-API herstellen
    hClient.addHeader("Content-Type", "application/json");
    String requestBody = "{\"secret\":\"" + userSecret + "\"}";
    
    int httpResponseCode = hClient.POST(requestBody); // POST-Anfrage senden

    if (httpResponseCode > 0) {
      String response = hClient.getString();
      Serial.println("Antwort von der Benachrichtigungs-API:");
      Serial.println(response);

      // JSON-Antwort verarbeiten
      StaticJsonDocument<512> doc;
      DeserializationError error = deserializeJson(doc, response);

      if (error) {
        Serial.print("Fehler beim Parsen der JSON-Antwort: ");
        Serial.println(error.c_str());
      } else {
        const char* notification = doc["notification"];
        if (notification) {
          Serial.print("Benachrichtigung: ");
          Serial.println(notification);

          // Benachrichtigung an den UNO R3 senden
          mySerial.println(notification);
        } else {
          Serial.println("Keine Benachrichtigung.");
        }
      }
    } else {
      Serial.print("Fehler bei der POST-Anfrage. HTTP-Code: ");
      Serial.println(httpResponseCode);
    }
    hClient.end();  // Verbindung schließen
  } else {
    Serial.println("Fehler beim Herstellen der Verbindung zur Benachrichtigungs-API.");
  }
}
