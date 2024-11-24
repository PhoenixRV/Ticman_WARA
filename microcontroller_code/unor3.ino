#include <LiquidCrystal.h>
#include <SoftwareSerial.h>

// LCD1602 Keypad Shield Pins
LiquidCrystal lcd(8, 9, 4, 5, 6, 7);

// SoftwareSerial für Kommunikation mit NodeMCU
SoftwareSerial mySerial(2, 3); // RX, TX

// Variablen für das Scrolling
String notification = "";
unsigned long scrollStartTime = 0;
int scrollIndex = 0;
const unsigned long scrollInterval = 300; // Scroll-Geschwindigkeit (ms)

void setup() {
  lcd.begin(16, 2);
  lcd.print("Warte auf Daten");
  mySerial.begin(9600);  // Kommunikation mit NodeMCU
  Serial.begin(9600);    // Debugging
}

void loop() {
  // Daten von NodeMCU empfangen
  if (mySerial.available()) {
    notification = mySerial.readStringUntil('\n'); // Empfang der Benachrichtigung
    notification.trim(); // Entferne unnötige Leerzeichen

    lcd.clear();
    lcd.setCursor(0, 0);
    lcd.print("Benachrichtigung:");
    Serial.println("Benachrichtigung empfangen:");
    Serial.println(notification);

    // Scrolling vorbereiten
    scrollStartTime = millis();
    scrollIndex = 0;

    // Sofortanzeige des Anfangs
    displayNotification(notification);
  }

  // Scroll-Mechanismus
  if (notification.length() > 16 && millis() - scrollStartTime >= scrollInterval) {
    scrollStartTime = millis();
    scrollIndex++;
    if (scrollIndex > notification.length() - 16) {
      scrollIndex = 0; // Zurück zum Anfang der Nachricht
    }
    displayNotification(notification.substring(scrollIndex));
  }
}

// Funktion zur Ausgabe der Benachrichtigung
void displayNotification(String text) {
  lcd.setCursor(0, 1);
  lcd.print("                "); // Lösche alte Zeichen
  lcd.setCursor(0, 1);
  lcd.print(text.substring(0, 16)); // Zeige max. 16 Zeichen an
}