#include "secret.h"
#include <WiFi.h>
#include <HTTPClient.h>
#include <math.h>
#include <Firebase_ESP_Client.h>
#include <time.h>
#include <string>


const char *ssid = secret_ssid;
const char *pass = secret_pass;
const char *firebaseUrl = secret_firebaseUrl;
#define Api_key secret_Api_key;
#define Database_url secret_Database_url;
#define USER_EMAIL secret_USER_EMAIL;
#define USER_PASSWORD  secret_USER_PASSWORD;

const int SENSOR_PIN1 = 5;

//センサ値処理のパラメタ
const int WINDOW = 5;                 // 揺れを見る窓幅
const int STD_THRESHOLD = 100;         // ゴタゴタ判定のしきい値
const int ACTIVE_FRAMES = 3;           // 連続でゴタゴタなら開始
const int QUIET_FRAMES = 8;            // 連続で静かなら終了
const long MERGE_GAP_MS = 1500;         // 短い間隔なら同じイベントとして結合
const long MIN_DURATION_MS = 500;       // 短すぎる検出は除外


FirebaseData gbdo;
FirebaseAuth auth;
FirebaseConfig config;


const float a = 5.280;
const float b = -21.676;

int datalist[5] = {};
void firebaseSetup(){
    config.api_key = Api_key;
    config.database_url = Database_url;
    auth.user.email = USER_EMAIL;
    auth.user.password = USER_PASSWORD;

    Firebase.begin(&config, &auth);
    Firebase.reconnectWiFi(true);
}

String getNowTime() {
    struct tm timeInfo;
    if (!getLocalTime(&timeInfo)) {
        return "time_error";
    }
    char buffer[30];
    strftime(
        buffer,
        sizeof(buffer),
        "%Y-%m-%d_%H-%M-%S",
        &timeInfo
    );
    return String(buffer);
}


// 最後にセンサデータを送信した時間の初期値
unsigned lastSendTime = 0;

// ピンの初期化をするよ
void PinSTARTER() { pinMode(SENSOR_PIN1, INPUT); }

// センサデータを取得する
int get_data() { return analogRead(SENSOR_PIN1); }

//　標準偏差を求める
double calculate_std(const int data[]){
    double sum = 0.0, mean, standardDeviation = 0.0;
    int n = WINDOW;
    for(int i = 0; i < n; ++i) {
        sum += data[i];
    }
    mean = sum/n;
    for(int i = 0; i < n; ++i) {
        standardDeviation += pow(data[i] - mean, 2);
    }
    return sqrt(standardDeviation/n);
}

void sendFirebase(double calcurate_cm){
    if (Firebase.ready()){
        String nowTime = getNowTime();
        String path = "/test1/" + nowTime;
        bool success = Firebase.RTDB.setDouble(&gbdo, path.c_str(), calcurate_cm);
        if (success) {
            Serial.println("✅ 書き込み成功！");
            } else {
            Serial.printf("❌ 書き込み失敗: %s\n", gbdo.errorReason().c_str());
            }
    }
}

//標準偏差の値からフラグ建設
int hantei(double data_std){

    static int activeCount = 0;
    static int quietCount = 0;
    static bool isActive = false;
    static int framecount = 0;

    // ===== 動いている =====
    if (data_std >= STD_THRESHOLD) {

        activeCount++;
        quietCount = 0;

        // すでに動作中ならフレーム加算
        if (isActive) {
            framecount++;
        }

        // 動き開始
        if (!isActive && activeCount >= ACTIVE_FRAMES) {

            isActive = true;

            activeCount = 0;

            framecount = 0;

            Serial.println("START");

            return 1;
        }
    }

    // ===== 静か =====
    else {

        quietCount++;

        activeCount = 0;

        // 動作中なら静かな時間も含める
        if (isActive) {
            framecount++;
        }

        // 動き終了
        if (isActive && quietCount >= QUIET_FRAMES) {

            isActive = false;

            quietCount = 0;

            int endcount = framecount;

            framecount = 0;

            // 継続時間(ms)
            int duration_ms = endcount * 100;

            // 短すぎるイベント除外
            if (duration_ms < MIN_DURATION_MS) {

                Serial.println("TOO SHORT");

                return 0;
            }

            Serial.print("END : ");
            Serial.println(endcount);

            return endcount;
        }
    }

    return 0;
}


// 100msごとにセンサデータとって5フレームごとに標準偏差とって、
void sensorDataSend() {
  if (millis() - lastSendTime >= 100) {
    lastSendTime = millis();

    int sensorvalue = get_data();
    for(int i = 0; i < 4; i++){
        datalist[i] = datalist[i + 1];
    }
    datalist[4] = sensorvalue;
    // 5フレームを新しくした後に標準偏差求める
    double data_std = calculate_std(datalist);
    // 標準偏差の値からフラグ建設
    int flag = hantei(data_std); //
    if(flag != 1 && flag != 0){
        double calcurate_cm = a * flag + b;
        sendFirebase(calcurate_cm);

      
    }
  }
}
// firebaseに送る


void connectingWifi() {
  WiFi.begin(ssid, pass);
  Serial.print("WiFi connecting");

  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }

  Serial.println();
  Serial.println("WiFi connected");
  Serial.print("IP address: ");
  Serial.println(WiFi.localIP());
}

void setup() {
  Serial.begin(115200);
  PinSTARTER();
  connectingWifi();
  configTime(9 * 3600, 0, "ntp.nict.jp");
  firebaseSetup();
  Serial.println("setup done");
}

void loop() {
    sensorDataSend();
}