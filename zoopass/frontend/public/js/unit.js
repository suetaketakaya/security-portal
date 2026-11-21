// 車載インフォテインメント「VATL-100」の動作モデル。
// 画面（DOM）には依存しないので、Node.js のテストからもそのまま読み込める。

export const VOLUME_MIN = 0;
export const VOLUME_MAX = 30;
export const STARTUP_VOLUME_LIMIT = 20;
export const REVERSE_VOLUME_LIMIT = 10;
export const FREQ_MIN = 760; // 0.1 MHz 単位（76.0 MHz）
export const FREQ_MAX = 950; // 95.0 MHz
export const DRIVING_SPEED = 5; // km/h
export const SPEED_MAX = 180;
export const KEYWORD_MAX = 20;
export const BRIGHTNESS_MIN = 1;
export const BRIGHTNESS_MAX = 5;

export const SOURCES = ["radio", "bt", "usb"];
export const SOURCE_LABELS = { radio: "ラジオ", bt: "Bluetoothオーディオ", usb: "USB" };

// 目的地検索の対象施設（架空）
export const POIS = [
  { name: "中央駅", km: 3.2 },
  { name: "市役所", km: 2.5 },
  { name: "中央図書館", km: 4.1 },
  { name: "みなと公園", km: 7.8 },
  { name: "みなと水族館", km: 8.3 },
  { name: "さくら公園", km: 5.6 },
  { name: "さくら総合病院", km: 6.0 },
  { name: "東サービスエリア", km: 24.5 },
  { name: "西サービスエリア", km: 31.2 },
  { name: "空港 第1ターミナル", km: 18.9 },
  { name: "空港 第2ターミナル", km: 19.4 },
  { name: "ショッピングモール東", km: 9.7 },
];

export class InfotainmentUnit {
  constructor() {
    this.factoryReset();
  }

  /** 工場出荷状態に戻す（バッテリー取り外し相当） */
  factoryReset() {
    this.vehicle = { acc: false, speed: 0, shift: "P", usb: false, bt: false };
    this.power = "off"; // off | booting | on
    this.volume = 10;
    this.muted = false;
    this.source = "radio";
    this.freq = 800;
    this.brightness = 3;
    this.screen = "home"; // home | navi | settings
    this.keyword = "";
    this.results = [];
    this.destination = null;
    this.call = null; // null | incoming | active
    this.reverse = false;
    this.savedVolume = null;
    this.message = "";
  }

  // ---------- 状態の参照 ----------

  isDriving() {
    return this.vehicle.speed > DRIVING_SPEED;
  }

  isAvailable(source) {
    if (source === "bt") return this.vehicle.bt;
    if (source === "usb") return this.vehicle.usb;
    return true;
  }

  /** 画面に表示するもの（優先度：電源 > バックカメラ > 電話 > 通常画面） */
  view() {
    if (this.power === "off") return "off";
    if (this.power === "booting") return "booting";
    if (this.reverse) return "camera";
    if (this.call) return "call";
    return this.screen;
  }

  freqLabel() {
    return `FM ${(this.freq / 10).toFixed(1)} MHz`;
  }

  // ---------- 車両側の信号 ----------

  setAcc(on) {
    this.message = "";
    if (on === this.vehicle.acc) return;
    this.vehicle.acc = on;
    if (on) {
      this.power = "booting";
      if (this.volume > STARTUP_VOLUME_LIMIT + 1) this.volume = STARTUP_VOLUME_LIMIT;
      this.muted = false;
      this.screen = "home";
    } else {
      if (this.reverse) this.volume = this.savedVolume;
      this.power = "off";
      this.reverse = false;
      this.savedVolume = null;
      this.call = null;
    }
  }

  /** 起動完了（画面側のタイマーから呼ばれる） */
  bootComplete() {
    if (this.power !== "booting") return;
    this.power = "on";
    if (this.vehicle.shift === "R") this.#enterReverse();
  }

  setSpeed(speed) {
    this.message = "";
    const v = Math.trunc(Number(speed));
    this.vehicle.speed = Number.isFinite(v) ? Math.min(Math.max(v, 0), SPEED_MAX) : 0;
    if (this.power === "on" && this.isDriving() && (this.screen === "navi" || this.screen === "settings")) {
      this.screen = "home";
      this.message = "走行中は操作できません";
    }
  }

  setShift(shift) {
    this.message = "";
    const prev = this.vehicle.shift;
    this.vehicle.shift = shift;
    if (this.power !== "on") return;
    if (shift === "R" && prev !== "R") this.#enterReverse();
    if (shift !== "R" && prev === "R") this.#exitReverse();
  }

  #enterReverse() {
    this.reverse = true;
    this.savedVolume = this.volume;
    if (this.volume > REVERSE_VOLUME_LIMIT) this.volume = REVERSE_VOLUME_LIMIT;
  }

  #exitReverse() {
    this.reverse = false;
    this.volume = Math.min(this.savedVolume, REVERSE_VOLUME_LIMIT);
    this.savedVolume = null;
  }

  setUsb(connected) {
    this.message = "";
    this.vehicle.usb = connected;
  }

  setBt(connected) {
    this.message = "";
    this.vehicle.bt = connected;
    if (connected) return;
    this.call = null;
    if (this.source === "bt") {
      this.source = "radio";
      this.message = "Bluetoothが切断されました";
    }
  }

  incomingCall() {
    this.message = "";
    if (this.power !== "on" || !this.vehicle.bt || this.call) return false;
    this.call = "incoming";
    return true;
  }

  // ---------- ヘッドユニットのボタン ----------

  /** ボタン操作。受け付けたら true を返す */
  press(button, arg) {
    this.message = "";
    if (this.power !== "on" || this.reverse) return false;

    if (this.call) {
      if (button === "answer" && this.call === "incoming") {
        this.call = "active";
        return true;
      }
      if (button === "reject" || button === "hangup") {
        this.call = null;
        return true;
      }
      return false;
    }

    switch (button) {
      case "volUp":
        this.muted = false;
        if (this.volume <= VOLUME_MAX) this.volume++;
        return true;
      case "volDown":
        if (this.volume > VOLUME_MIN) this.volume--;
        return true;
      case "mute":
        this.muted = !this.muted;
        return true;
      case "source":
        this.#nextSource();
        return true;
      case "tuneUp":
        if (this.source !== "radio") return false;
        this.freq = this.freq >= FREQ_MAX ? FREQ_MIN : this.freq + 1;
        return true;
      case "tuneDown":
        if (this.source !== "radio") return false;
        if (this.freq > FREQ_MIN) this.freq--;
        return true;
      case "home":
        this.screen = "home";
        return true;
      case "navi":
      case "settings":
        if (this.isDriving()) {
          this.message = "走行中は操作できません";
          return false;
        }
        this.screen = button;
        if (button === "navi") {
          this.keyword = "";
          this.results = [];
        }
        return true;
      case "search":
        return this.#search(arg);
      case "select":
        return this.#select(arg);
      case "cancelRoute":
        if (!this.destination) return false;
        this.destination = null;
        this.message = "案内を中止しました";
        return true;
      case "brightUp":
        if (this.brightness < BRIGHTNESS_MAX) this.brightness++;
        return true;
      case "brightDown":
        if (this.brightness > BRIGHTNESS_MIN) this.brightness--;
        return true;
      default:
        return false;
    }
  }

  #nextSource() {
    const start = SOURCES.indexOf(this.source);
    for (let i = 1; i <= SOURCES.length; i++) {
      const s = SOURCES[(start + i) % SOURCES.length];
      if (this.isAvailable(s)) {
        this.source = s;
        return;
      }
    }
  }

  #search(keyword) {
    if (this.screen !== "navi" || this.isDriving()) return false;
    const kw = String(keyword ?? "");
    this.keyword = kw;
    this.results = [];
    if (kw.length === 0) {
      this.message = "キーワードを入力してください";
      return false;
    }
    if (kw.trim().length > KEYWORD_MAX) {
      this.message = `${KEYWORD_MAX}文字以内で入力してください`;
      return false;
    }
    const q = kw.trim();
    this.results = POIS.filter((p) => p.name.includes(q));
    if (this.results.length === 0) this.message = "該当する施設がありません";
    return true;
  }

  #select(index) {
    const poi = this.results[index];
    if (this.screen !== "navi" || !poi) return false;
    this.destination = { ...poi };
    this.screen = "home";
    this.message = "案内を開始します";
    return true;
  }
}
