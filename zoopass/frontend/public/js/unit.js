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

export const TEMP_MIN = 32; // 0.5℃ 単位（16.0℃）
export const TEMP_MAX = 64; // 32.0℃
export const FAN_MAX = 8;
export const SEAT_HEAT_MAX = 3;
export const DEFROST_FAN_MIN = 3;
export const FUEL_LOW = 10; // %
export const OUTSIDE_TEMP_MIN = -30;
export const OUTSIDE_TEMP_MAX = 50;

export const SOURCES = ["radio", "bt", "usb"];
export const SOURCE_LABELS = { radio: "ラジオ", bt: "Bluetoothオーディオ", usb: "USB" };
export const SCREENS = ["home", "apps", "navi", "media", "phone", "settings"];
export const THEMES = ["auto", "light", "dark"];

// Bluetooth / USB の曲（架空）
export const TRACKS = {
  bt: ["Morning Drive", "Coastal Road", "City Lights", "Night Cruise"],
  usb: ["Track 01", "Track 02", "Track 03", "Track 04", "Track 05"],
};

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
    this.vehicle = {
      acc: false, speed: 0, shift: "P", usb: false, bt: false,
      night: false, outsideTemp: 20, fuel: 60, doorOpen: false,
    };
    this.power = "off"; // off | booting | on
    this.volume = 10;
    this.muted = false;
    this.source = "radio";
    this.freq = 800;
    this.playing = true;
    this.track = { bt: 0, usb: 0 };
    this.brightness = 3;
    this.theme = "auto";
    this.climate = {
      driverTemp: 44, passengerTemp: 44, // 22.0℃
      sync: false, fan: 3, ac: true, defrost: false,
      seatDriver: 0, seatPassenger: 0,
    };
    this.screen = "home"; // SCREENS のいずれか
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

  /** 再生中の内容（ラジオは周波数、BT / USB は曲名） */
  mediaLabel() {
    if (this.source === "radio") return this.freqLabel();
    return TRACKS[this.source][this.track[this.source]];
  }

  isDark() {
    return this.theme === "dark" || (this.theme === "auto" && this.vehicle.night);
  }

  static tempLabel(halfDegrees) {
    return `${(halfDegrees / 2).toFixed(1)}℃`;
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

  setNight(night) {
    this.message = "";
    this.vehicle.night = Boolean(night);
  }

  setOutsideTemp(temp) {
    this.message = "";
    const v = Math.round(Number(temp));
    this.vehicle.outsideTemp = Number.isFinite(v)
      ? Math.min(Math.max(v, OUTSIDE_TEMP_MIN), OUTSIDE_TEMP_MAX) : 20;
  }

  setFuel(percent) {
    this.message = "";
    const prev = this.vehicle.fuel;
    const v = Math.round(Number(percent));
    this.vehicle.fuel = Number.isFinite(v) ? Math.min(Math.max(v, 0), 100) : prev;
    if (this.power === "on" && prev >= FUEL_LOW && this.vehicle.fuel < FUEL_LOW) {
      this.message = "燃料残量が少なくなっています";
    }
  }

  setDoor(open) {
    this.message = "";
    this.vehicle.doorOpen = Boolean(open);
    if (this.power === "on" && open && this.vehicle.speed > 0) {
      this.message = "ドアが開いています";
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
      case "apps":
      case "media":
      case "phone":
        this.screen = button;
        return true;
      case "selectSource":
        if (!SOURCES.includes(arg) || !this.isAvailable(arg)) return false;
        this.source = arg;
        return true;
      case "playPause":
        if (this.source === "radio") return false;
        this.playing = !this.playing;
        return true;
      case "trackNext":
      case "trackPrev": {
        if (this.source === "radio") return false;
        const n = TRACKS[this.source].length;
        const step = button === "trackNext" ? 1 : n - 1;
        this.track[this.source] = (this.track[this.source] + step) % n;
        return true;
      }
      case "theme":
        if (!THEMES.includes(arg)) return false;
        this.theme = arg;
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

  // ---------- エアコン（画面下のバー） ----------

  /**
   * エアコン操作。バックカメラ表示中や電話中でも操作できる。受け付けたら true を返す
   * @param {"driverUp"|"driverDown"|"passengerUp"|"passengerDown"|"fanUp"|"fanDown"|"ac"|"defrost"|"sync"|"seatDriver"|"seatPassenger"} action
   */
  hvac(action) {
    this.message = "";
    if (this.power !== "on") return false;
    const h = this.climate;
    const clampTemp = (v) => Math.min(Math.max(v, TEMP_MIN), TEMP_MAX);

    switch (action) {
      case "driverUp":
      case "driverDown":
        h.driverTemp = clampTemp(h.driverTemp + (action === "driverUp" ? 1 : -1));
        if (h.sync) h.passengerTemp = h.driverTemp;
        return true;
      case "passengerUp":
      case "passengerDown":
        h.passengerTemp = clampTemp(h.passengerTemp + (action === "passengerUp" ? 1 : -1));
        h.sync = false;
        return true;
      case "sync":
        h.sync = !h.sync;
        if (h.sync) h.passengerTemp = h.driverTemp;
        return true;
      case "fanUp":
        if (h.fan < FAN_MAX) h.fan++;
        return true;
      case "fanDown":
        if (h.fan > 0) h.fan--;
        if (h.fan === 0) {
          h.ac = false;
          h.defrost = false;
        }
        return true;
      case "ac":
        h.ac = !h.ac;
        if (h.ac && h.fan === 0) h.fan = 1;
        return true;
      case "defrost":
        h.defrost = !h.defrost;
        if (h.defrost) {
          h.ac = true;
          if (h.fan < DEFROST_FAN_MIN) h.fan = DEFROST_FAN_MIN;
        }
        return true;
      case "seatDriver":
        h.seatDriver = (h.seatDriver + 1) % (SEAT_HEAT_MAX + 1);
        return true;
      case "seatPassenger":
        h.seatPassenger = (h.seatPassenger + 1) % (SEAT_HEAT_MAX + 1);
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
