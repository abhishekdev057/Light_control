#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <HTTPClient.h>

const char *WIFI_SSID = "AirFiber-5g";
const char *WIFI_PASSWORD = "chalalowifi";
const char *BASE_URL = "https://light-control-five.vercel.app";
const char *DEVICE_ID = "esp32-relay-01";
const char *DEVICE_TOKEN = "justdevice";

constexpr int RELAY26_PIN = 26;
constexpr int RELAY27_PIN = 27;

// Set to false if your relay board is active LOW.
constexpr bool RELAY_ACTIVE_HIGH = true;

constexpr unsigned long WIFI_CONNECT_TIMEOUT_MS = 15000;
constexpr unsigned long WIFI_RETRY_INTERVAL_MS = 10000;
constexpr unsigned long HEARTBEAT_INTERVAL_MS = 5000;
constexpr unsigned long SYNC_INTERVAL_MS = 1500;
constexpr unsigned long REPORT_RETRY_INTERVAL_MS = 2000;
constexpr uint32_t HTTP_TIMEOUT_MS = 5000;

struct HttpResult {
  int statusCode;
  String body;
};

WiFiClientSecure secureClient;

bool desiredRelay26 = false;
bool desiredRelay27 = false;
bool appliedRelay26 = false;
bool appliedRelay27 = false;
bool hasAppliedState = false;
bool deviceRegistered = false;
bool reportPending = false;
bool wifiWasConnected = false;

unsigned long lastWifiAttemptMs = 0;
unsigned long lastHeartbeatMs = 0;
unsigned long lastSyncMs = 0;
unsigned long lastReportAttemptMs = 0;

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

void resetDeviceSessionState() {
  deviceRegistered = false;
  lastHeartbeatMs = 0;
  lastSyncMs = 0;
  lastReportAttemptMs = 0;
}

bool shouldReRegister(int statusCode) {
  return statusCode == 404;
}

void handleRequestFailure(const char *label, const HttpResult &result) {
  Serial.print(label);
  Serial.print(" failed. Status: ");
  Serial.println(result.statusCode);

  if (result.body.length() > 0) {
    Serial.println(result.body);
  }

  if (shouldReRegister(result.statusCode)) {
    resetDeviceSessionState();
  }
}

HttpResult httpPostJson(const String &url, const String &payload) {
  HTTPClient http;
  HttpResult result{ -1, "" };

  secureClient.setInsecure();
  secureClient.setTimeout(HTTP_TIMEOUT_MS);

  if (!http.begin(secureClient, url)) {
    return result;
  }

  http.setTimeout(HTTP_TIMEOUT_MS);
  http.addHeader("Content-Type", "application/json");
  http.addHeader("Connection", "close");

  result.statusCode = http.POST(payload);
  result.body = result.statusCode > 0 ? http.getString() : "";
  http.end();

  return result;
}

HttpResult httpGet(const String &url) {
  HTTPClient http;
  HttpResult result{ -1, "" };

  secureClient.setInsecure();
  secureClient.setTimeout(HTTP_TIMEOUT_MS);

  if (!http.begin(secureClient, url)) {
    return result;
  }

  http.setTimeout(HTTP_TIMEOUT_MS);
  http.addHeader("Connection", "close");

  result.statusCode = http.GET();
  result.body = result.statusCode > 0 ? http.getString() : "";
  http.end();

  return result;
}

bool connectToWiFi() {
  const wl_status_t wifiStatus = WiFi.status();

  if (wifiStatus == WL_CONNECTED) {
    if (!wifiWasConnected) {
      wifiWasConnected = true;
      resetDeviceSessionState();
      Serial.print("Wi-Fi connected. IP: ");
      Serial.println(WiFi.localIP());
    }

    return true;
  }

  if (wifiWasConnected) {
    wifiWasConnected = false;
    resetDeviceSessionState();
    Serial.println("Wi-Fi disconnected.");
  }

  const unsigned long now = millis();

  if (now - lastWifiAttemptMs < WIFI_RETRY_INTERVAL_MS && lastWifiAttemptMs != 0) {
    return false;
  }

  lastWifiAttemptMs = now;

  Serial.println("Connecting to Wi-Fi...");
  WiFi.mode(WIFI_STA);
  WiFi.setAutoReconnect(true);
  WiFi.persistent(false);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  const unsigned long startedAt = millis();

  while (WiFi.status() != WL_CONNECTED &&
         millis() - startedAt < WIFI_CONNECT_TIMEOUT_MS) {
    delay(400);
    Serial.print(".");
  }

  Serial.println();

  if (WiFi.status() == WL_CONNECTED) {
    wifiWasConnected = true;
    resetDeviceSessionState();
    Serial.print("Wi-Fi connected. IP: ");
    Serial.println(WiFi.localIP());
    return true;
  }

  Serial.println("Wi-Fi connection failed.");
  return false;
}

bool registerDevice() {
  const String payload =
      String("{\"deviceId\":\"") + DEVICE_ID + "\",\"token\":\"" + DEVICE_TOKEN + "\"}";
  const HttpResult result =
      httpPostJson(String(BASE_URL) + "/api/device/register", payload);

  if (result.statusCode == 200 && responseLooksSuccessful(result.body)) {
    deviceRegistered = true;
    Serial.println("Device registered.");
    return true;
  }

  handleRequestFailure("Register", result);
  return false;
}

bool pingDevice() {
  const String payload =
      String("{\"deviceId\":\"") + DEVICE_ID + "\",\"token\":\"" + DEVICE_TOKEN +
      "\",\"ip\":\"" + WiFi.localIP().toString() + "\"}";
  const HttpResult result =
      httpPostJson(String(BASE_URL) + "/api/device/ping", payload);

  if (result.statusCode == 200 && responseLooksSuccessful(result.body)) {
    return true;
  }

  handleRequestFailure("Ping", result);
  return false;
}

bool reportAppliedState() {
  if (!hasAppliedState) {
    return true;
  }

  const String payload =
      String("{\"deviceId\":\"") + DEVICE_ID + "\",\"token\":\"" + DEVICE_TOKEN +
      "\",\"relay26\":" + boolToJson(appliedRelay26) + ",\"relay27\":" +
      boolToJson(appliedRelay27) + "}";
  const HttpResult result =
      httpPostJson(String(BASE_URL) + "/api/device/report", payload);

  if (result.statusCode == 200 && responseLooksSuccessful(result.body)) {
    reportPending = false;
    return true;
  }

  reportPending = true;
  handleRequestFailure("Report", result);
  return false;
}

bool fetchDesiredState(bool &relay26, bool &relay27) {
  const String url =
      String(BASE_URL) + "/api/device/sync?deviceId=" + urlEncode(String(DEVICE_ID)) +
      "&token=" + urlEncode(String(DEVICE_TOKEN));
  const HttpResult result = httpGet(url);

  if (result.statusCode != 200) {
    handleRequestFailure("Sync", result);
    return false;
  }

  bool parsedRelay26 = false;
  bool parsedRelay27 = false;

  if (!extractJsonBool(result.body, "r26", parsedRelay26) ||
      !extractJsonBool(result.body, "r27", parsedRelay27)) {
    Serial.println("Unable to parse sync response.");
    Serial.println(result.body);
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

  if (changed || forceReport) {
    reportPending = true;
  }

  if (reportPending && WiFi.status() == WL_CONNECTED) {
    lastReportAttemptMs = millis();
    reportAppliedState();
  }
}

bool performInitialSync() {
  bool nextRelay26 = false;
  bool nextRelay27 = false;

  if (!fetchDesiredState(nextRelay26, nextRelay27)) {
    return false;
  }

  // After power restore, fetch backend state again and restore both relays.
  applyDesiredState(nextRelay26, nextRelay27, true);
  return true;
}

void processPendingReport(unsigned long now) {
  if (!reportPending || WiFi.status() != WL_CONNECTED) {
    return;
  }

  if (lastReportAttemptMs != 0 &&
      now - lastReportAttemptMs < REPORT_RETRY_INTERVAL_MS) {
    return;
  }

  lastReportAttemptMs = now;
  reportAppliedState();
}

void ensureOnlineAndSynchronized() {
  if (!connectToWiFi()) {
    return;
  }

  if (!deviceRegistered) {
    if (!registerDevice()) {
      return;
    }

    if (!performInitialSync()) {
      return;
    }

    const unsigned long now = millis();
    lastHeartbeatMs = now;
    lastSyncMs = now;
    return;
  }

  const unsigned long now = millis();

  if (now - lastHeartbeatMs >= HEARTBEAT_INTERVAL_MS) {
    if (pingDevice()) {
      lastHeartbeatMs = now;
    }
  }

  if (now - lastSyncMs >= SYNC_INTERVAL_MS) {
    bool nextRelay26 = false;
    bool nextRelay27 = false;

    if (fetchDesiredState(nextRelay26, nextRelay27)) {
      applyDesiredState(nextRelay26, nextRelay27, false);
      lastSyncMs = now;
    }
  }

  processPendingReport(now);
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
    if (registerDevice()) {
      performInitialSync();
    }
  }
}

void loop() {
  ensureOnlineAndSynchronized();
  delay(50);
}
