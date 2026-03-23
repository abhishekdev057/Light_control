#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <HTTPClient.h>

// Replace these values before uploading.
const char *WIFI_SSID = "AirFiber-5g";
const char *WIFI_PASSWORD = "chalalowifi";
const char *BASE_URL = "https://light-control-five.vercel.app";
const char *DEVICE_ID = "esp32-relay-01";
const char *DEVICE_TOKEN = "Justdevice";

constexpr int RELAY26_PIN = 26;
constexpr int RELAY27_PIN = 27;

// Set to false if your relay board is active LOW.
constexpr bool RELAY_ACTIVE_HIGH = true;

constexpr unsigned long WIFI_CONNECT_TIMEOUT_MS = 15000;
constexpr unsigned long WIFI_RETRY_INTERVAL_MS = 10000;
constexpr unsigned long HEARTBEAT_INTERVAL_MS = 5000;
constexpr unsigned long SYNC_INTERVAL_MS = 1500;

WiFiClientSecure secureClient;

bool desiredRelay26 = false;
bool desiredRelay27 = false;
bool appliedRelay26 = false;
bool appliedRelay27 = false;
bool hasAppliedState = false;
bool deviceRegistered = false;

unsigned long lastWifiAttemptMs = 0;
unsigned long lastHeartbeatMs = 0;
unsigned long lastSyncMs = 0;

String boolToJson(bool value) {
  return value ? "true" : "false";
}

String urlEncode(const String &value) {
  String encoded;
  const char *hex = "0123456789ABCDEF";

  for (size_t i = 0; i < value.length(); i++) {
    const char c = value.charAt(i);

    if ((c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z') ||
        (c >= '0' && c <= '9') || c == '-' || c == '_' ||
        c == '.' || c == '~') {
      encoded += c;
      continue;
    }

    encoded += '%';
    encoded += hex[(c >> 4) & 0x0F];
    encoded += hex[c & 0x0F];
  }

  return encoded;
}

bool responseLooksSuccessful(const String &body) {
  return body.indexOf("\"success\":true") >= 0 || body.indexOf("\"ok\":true") >= 0;
}

bool extractJsonBool(const String &body, const char *key, bool &value) {
  const String token = "\"" + String(key) + "\":";
  int index = body.indexOf(token);

  if (index < 0) {
    return false;
  }

  index += token.length();

  while (index < static_cast<int>(body.length()) &&
         (body.charAt(index) == ' ' || body.charAt(index) == '\n' ||
          body.charAt(index) == '\r' || body.charAt(index) == '\t')) {
    index++;
  }

  if (body.startsWith("true", index)) {
    value = true;
    return true;
  }

  if (body.startsWith("false", index)) {
    value = false;
    return true;
  }

  return false;
}

int relayPinLevel(bool relayOn) {
  if (RELAY_ACTIVE_HIGH) {
    return relayOn ? HIGH : LOW;
  }

  return relayOn ? LOW : HIGH;
}

void applyRelayOutputs(bool relay26, bool relay27) {
  digitalWrite(RELAY26_PIN, relayPinLevel(relay26));
  digitalWrite(RELAY27_PIN, relayPinLevel(relay27));
}

int httpPostJson(const String &url, const String &payload, String &responseBody) {
  HTTPClient http;
  secureClient.setInsecure();

  if (!http.begin(secureClient, url)) {
    return -1;
  }

  http.setTimeout(5000);
  http.addHeader("Content-Type", "application/json");

  const int statusCode = http.POST(payload);
  responseBody = statusCode > 0 ? http.getString() : "";
  http.end();

  return statusCode;
}

int httpGet(const String &url, String &responseBody) {
  HTTPClient http;
  secureClient.setInsecure();

  if (!http.begin(secureClient, url)) {
    return -1;
  }

  http.setTimeout(5000);

  const int statusCode = http.GET();
  responseBody = statusCode > 0 ? http.getString() : "";
  http.end();

  return statusCode;
}

bool connectToWiFi() {
  if (WiFi.status() == WL_CONNECTED) {
    return true;
  }

  const unsigned long now = millis();

  if (now - lastWifiAttemptMs < WIFI_RETRY_INTERVAL_MS && lastWifiAttemptMs != 0) {
    return false;
  }

  lastWifiAttemptMs = now;

  Serial.println("Connecting to Wi-Fi...");
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  const unsigned long startedAt = millis();

  while (WiFi.status() != WL_CONNECTED &&
         millis() - startedAt < WIFI_CONNECT_TIMEOUT_MS) {
    delay(400);
    Serial.print(".");
  }

  Serial.println();

  if (WiFi.status() == WL_CONNECTED) {
    Serial.print("Wi-Fi connected. IP: ");
    Serial.println(WiFi.localIP());
    deviceRegistered = false;
    return true;
  }

  Serial.println("Wi-Fi connection failed.");
  return false;
}

bool registerDevice() {
  String responseBody;
  const String payload =
      String("{\"deviceId\":\"") + DEVICE_ID + "\",\"token\":\"" + DEVICE_TOKEN + "\"}";
  const int statusCode =
      httpPostJson(String(BASE_URL) + "/api/device/register", payload, responseBody);

  if (statusCode == 200 && responseLooksSuccessful(responseBody)) {
    deviceRegistered = true;
    Serial.println("Device registered.");
    return true;
  }

  Serial.print("Register failed. Status: ");
  Serial.println(statusCode);
  Serial.println(responseBody);
  return false;
}

bool pingDevice() {
  String responseBody;
  const String payload =
      String("{\"deviceId\":\"") + DEVICE_ID + "\",\"token\":\"" + DEVICE_TOKEN +
      "\",\"ip\":\"" + WiFi.localIP().toString() + "\"}";
  const int statusCode =
      httpPostJson(String(BASE_URL) + "/api/device/ping", payload, responseBody);

  if (statusCode == 200 && responseLooksSuccessful(responseBody)) {
    return true;
  }

  Serial.print("Ping failed. Status: ");
  Serial.println(statusCode);
  Serial.println(responseBody);
  return false;
}

bool reportAppliedState() {
  String responseBody;
  const String payload =
      String("{\"deviceId\":\"") + DEVICE_ID + "\",\"token\":\"" + DEVICE_TOKEN +
      "\",\"relay26\":" + boolToJson(appliedRelay26) + ",\"relay27\":" +
      boolToJson(appliedRelay27) + "}";
  const int statusCode =
      httpPostJson(String(BASE_URL) + "/api/device/report", payload, responseBody);

  if (statusCode == 200 && responseLooksSuccessful(responseBody)) {
    return true;
  }

  Serial.print("Report failed. Status: ");
  Serial.println(statusCode);
  Serial.println(responseBody);
  return false;
}

bool fetchDesiredState(bool &relay26, bool &relay27) {
  String responseBody;
  const String url =
      String(BASE_URL) + "/api/device/sync?deviceId=" + urlEncode(String(DEVICE_ID)) +
      "&token=" + urlEncode(String(DEVICE_TOKEN));
  const int statusCode = httpGet(url, responseBody);

  if (statusCode != 200) {
    Serial.print("Sync failed. Status: ");
    Serial.println(statusCode);
    Serial.println(responseBody);
    return false;
  }

  bool parsedRelay26 = false;
  bool parsedRelay27 = false;

  if (!extractJsonBool(responseBody, "r26", parsedRelay26) ||
      !extractJsonBool(responseBody, "r27", parsedRelay27)) {
    Serial.println("Unable to parse sync response.");
    Serial.println(responseBody);
    return false;
  }

  relay26 = parsedRelay26;
  relay27 = parsedRelay27;
  return true;
}

void applyDesiredState(bool relay26, bool relay27, bool forceReport) {
  const bool changed =
      !hasAppliedState || relay26 != appliedRelay26 || relay27 != appliedRelay27;

  applyRelayOutputs(relay26, relay27);

  desiredRelay26 = relay26;
  desiredRelay27 = relay27;
  appliedRelay26 = relay26;
  appliedRelay27 = relay27;
  hasAppliedState = true;

  if ((changed || forceReport) && WiFi.status() == WL_CONNECTED) {
    reportAppliedState();
  }
}

bool performInitialSync() {
  bool nextRelay26 = false;
  bool nextRelay27 = false;

  if (!fetchDesiredState(nextRelay26, nextRelay27)) {
    return false;
  }

  // After power restore, this pulls the last saved backend state and reapplies it.
  applyDesiredState(nextRelay26, nextRelay27, true);
  return true;
}

void ensureOnlineAndSynchronized() {
  if (!connectToWiFi()) {
    return;
  }

  if (!deviceRegistered) {
    if (!registerDevice()) {
      return;
    }

    performInitialSync();
    lastHeartbeatMs = millis();
    lastSyncMs = millis();
    return;
  }

  const unsigned long now = millis();

  if (now - lastHeartbeatMs >= HEARTBEAT_INTERVAL_MS) {
    pingDevice();
    lastHeartbeatMs = now;
  }

  if (now - lastSyncMs >= SYNC_INTERVAL_MS) {
    bool nextRelay26 = false;
    bool nextRelay27 = false;

    if (fetchDesiredState(nextRelay26, nextRelay27)) {
      applyDesiredState(nextRelay26, nextRelay27, false);
    }

    lastSyncMs = now;
  }
}

void setup() {
  Serial.begin(115200);
  delay(500);

  pinMode(RELAY26_PIN, OUTPUT);
  pinMode(RELAY27_PIN, OUTPUT);

  // Safe default while the board reconnects and asks the backend for state.
  applyRelayOutputs(false, false);

  connectToWiFi();
  if (WiFi.status() == WL_CONNECTED) {
    registerDevice();
    performInitialSync();
  }
}

void loop() {
  ensureOnlineAndSynchronized();
  delay(50);
}
