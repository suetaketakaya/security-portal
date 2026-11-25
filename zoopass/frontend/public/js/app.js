// エミュレーター画面。動作はすべて unit.js のモデルに任せ、ここでは表示と入力の受け渡しだけを行う。
// 出力は textContent だけを使う（innerHTML は使わない）。
import { InfotainmentUnit, SOURCE_LABELS, FUEL_LOW } from "./unit.js";

const BOOT_MS = 1500;
const TOAST_MS = 3000;
const VOLUME_POP_MS = 1500;

const unit = new InfotainmentUnit();
const $ = (id) => document.getElementById(id);
const $$ = (sel) => document.querySelectorAll(sel);
const tempLabel = InfotainmentUnit.tempLabel;

const BUTTON_LABELS = {
  volUp: "VOL ＋", volDown: "VOL －", mute: "MUTE", source: "SOURCE",
  home: "ホーム", apps: "アプリ一覧", navi: "地図（目的地検索）", media: "メディア",
  phone: "電話", settings: "設定",
  tuneUp: "選局 ▶", tuneDown: "◀ 選局", selectSource: "音源を選択",
  playPause: "再生/一時停止", trackNext: "次の曲", trackPrev: "前の曲",
  search: "検索", select: "検索結果を選択", cancelRoute: "案内中止",
  brightUp: "明るさ ＋", brightDown: "明るさ －", theme: "テーマ",
  answer: "応答", reject: "拒否", hangup: "終話",
};

const HVAC_LABELS = {
  driverUp: "運転席温度 ＋", driverDown: "運転席温度 －",
  passengerUp: "助手席温度 ＋", passengerDown: "助手席温度 －",
  fanUp: "風量 ＋", fanDown: "風量 －", ac: "A/C", defrost: "デフロスター",
  sync: "SYNC", seatDriver: "運転席シートヒーター", seatPassenger: "助手席シートヒーター",
};

const VIEW_LABELS = {
  off: "消灯", booting: "起動中", camera: "バックカメラ", call: "電話（着信・通話）",
  home: "ホーム", apps: "アプリ一覧", navi: "地図（目的地検索）", media: "メディア",
  phone: "電話", settings: "設定",
};

const THEME_LABELS = { auto: "自動", light: "ライト", dark: "ダーク" };

// ---------- 表示用の文字列 ----------

function volumeText() {
  if (unit.call) return "通話中（消音）";
  return unit.muted ? "MUTE" : `音量 ${unit.volume}`;
}

function climateText() {
  const c = unit.climate;
  return [
    `運転席 ${tempLabel(c.driverTemp)}`, `助手席 ${tempLabel(c.passengerTemp)}`,
    `風量 ${c.fan}`, `A/C ${c.ac ? "ON" : "OFF"}`, `DEF ${c.defrost ? "ON" : "OFF"}`,
    `SYNC ${c.sync ? "ON" : "OFF"}`, `シート ${c.seatDriver}/${c.seatPassenger}`,
  ].join(" ");
}

function summary(withClimate = false) {
  const parts = [VIEW_LABELS[unit.view()]];
  if (unit.power === "on") {
    parts.push(volumeText(), `${SOURCE_LABELS[unit.source]} ${unit.mediaLabel()}`);
    if (unit.destination) parts.push(`目的地 ${unit.destination.name}`);
    if (withClimate) parts.push(climateText());
  }
  if (unit.message) parts.push(`「${unit.message}」`);
  return parts.join(" / ");
}

function setText(selector, text) {
  for (const el of $$(selector)) el.textContent = text;
}

function setHidden(selector, hidden) {
  // SVG 要素には hidden プロパティがないので、属性で切り替える
  for (const el of $$(selector)) el.toggleAttribute("hidden", hidden);
}

// ---------- 描画 ----------

function renderClock() {
  $("sb-time").textContent = new Date().toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" });
}

function render() {
  const view = unit.view();
  const display = $("display");
  display.dataset.view = view;
  display.dataset.theme = unit.isDark() ? "dark" : "light";
  display.style.filter = `brightness(${0.6 + unit.brightness * 0.1})`;
  for (const el of $$(".stage .view")) el.hidden = el.dataset.for !== view;

  // ステータスバー
  renderClock();
  $("sb-temp").textContent = `外気 ${unit.vehicle.outsideTemp}℃`;
  $("sb-bt").hidden = !unit.vehicle.bt;
  $("sb-usb").hidden = !unit.vehicle.usb;
  $("sb-mute").hidden = !unit.muted;
  $("sb-door").hidden = !unit.vehicle.doorOpen;
  $("sb-fuel").hidden = unit.vehicle.fuel >= FUEL_LOW;
  $("notify-badge").hidden = notifications.length === 0;

  // システムバーのナビゲーション（表示中の画面を強調）
  for (const b of $$(".js-nav")) b.classList.toggle("active", b.dataset.screen === view);

  // メディア（ホームのカードとメディアアプリで共通）
  const isRadio = unit.source === "radio";
  setText(".js-source", SOURCE_LABELS[unit.source]);
  setText(".js-media", unit.mediaLabel());
  setText(".js-play-state", isRadio ? "受信中" : unit.playing ? "再生中" : "一時停止中");
  for (const u of $$(".js-play-icon")) u.setAttribute("href", unit.playing ? "#i-pause" : "#i-play");
  for (const a of $$(".js-art")) a.dataset.source = unit.source;
  setHidden(".js-radio-only", !isRadio);
  setHidden(".js-track-only", isRadio);
  for (const tab of $$('.source-tabs [data-arg]')) {
    tab.classList.toggle("active", tab.dataset.arg === unit.source);
    tab.classList.toggle("unavailable", !unit.isAvailable(tab.dataset.arg));
  }

  // 地図
  $("home-route").textContent = unit.destination
    ? `${unit.destination.name} まで 残り ${unit.destination.km.toFixed(1)} km`
    : "目的地が設定されていません";
  setHidden(".js-route-only", !unit.destination);
  const results = $("results");
  results.replaceChildren();
  unit.results.forEach((poi, i) => {
    const li = document.createElement("li");
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "result";
    const name = document.createElement("span");
    name.textContent = poi.name;
    const km = document.createElement("span");
    km.className = "muted";
    km.textContent = `${poi.km.toFixed(1)} km`;
    btn.append(name, km);
    btn.addEventListener("click", () => act("select", i, poi.name));
    li.append(btn);
    results.append(li);
  });

  // 電話
  setText(".js-phone-state", unit.vehicle.bt ? "スマートフォン接続中" : "スマートフォンが接続されていません");
  $("recent-calls").hidden = !unit.vehicle.bt;
  $("call-status").textContent = unit.call === "incoming" ? "着信中…" : "通話中";
  $("btn-answer").hidden = unit.call !== "incoming";
  $("btn-reject").hidden = unit.call !== "incoming";
  $("btn-hangup").hidden = unit.call !== "active";

  // 設定
  $("st-bright").textContent = `${unit.brightness} / 5`;
  for (const b of $$('.segmented [data-arg]')) b.classList.toggle("active", b.dataset.arg === unit.theme);
  $("st-fuel").textContent = `${unit.vehicle.fuel} %`;
  $("st-outside").textContent = `${unit.vehicle.outsideTemp} ℃`;

  // エアコンバー
  const c = unit.climate;
  $("cl-driver").textContent = tempLabel(c.driverTemp);
  $("cl-passenger").textContent = tempLabel(c.passengerTemp);
  $("cl-fan").textContent = c.fan === 0 ? "送風 OFF" : `風量 ${c.fan}`;
  $("cl-fan-bars").dataset.level = String(c.fan);
  $("cl-fan-badge").textContent = c.fan === 0 ? "OFF" : String(c.fan);
  $("cl-seat-driver").dataset.level = String(c.seatDriver);
  $("cl-seat-passenger").dataset.level = String(c.seatPassenger);
  $("cl-ac").classList.toggle("active", c.ac);
  $("cl-defrost").classList.toggle("active", c.defrost);
  $("cl-sync").classList.toggle("active", c.sync);

  // 拡張コントロールをモデルの状態に合わせる
  const v = unit.vehicle;
  $("sig-acc").checked = v.acc;
  $("sig-speed").value = v.speed;
  $("sig-speed-range").value = v.speed;
  for (const r of $$('input[name="shift"]')) r.checked = r.value === v.shift;
  $("sig-night").checked = v.night;
  $("sig-outside").value = v.outsideTemp;
  $("sig-fuel").value = v.fuel;
  $("sig-fuel-range").value = v.fuel;
  $("sig-door").checked = v.doorOpen;
  $("sig-usb").checked = v.usb;
  $("sig-bt").checked = v.bt;

  renderState(view);
}

function renderState(view) {
  const c = unit.climate;
  const rows = [
    ["電源", { off: "OFF", booting: "起動中", on: "ON" }[unit.power]],
    ["表示中の画面", VIEW_LABELS[view]],
    ["音量", unit.muted ? `${unit.volume}（ミュート中）` : String(unit.volume)],
    ["音源", `${SOURCE_LABELS[unit.source]}（${unit.mediaLabel()}）`],
    ["周波数", unit.freqLabel()],
    ["車速", `${unit.vehicle.speed} km/h`],
    ["ギア", unit.vehicle.shift],
    ["目的地", unit.destination ? unit.destination.name : "なし"],
    ["電話", { incoming: "着信中", active: "通話中" }[unit.call] ?? "なし"],
    ["エアコン", climateText()],
    ["テーマ", `${THEME_LABELS[unit.theme]}（${unit.isDark() ? "ダーク" : "ライト"}表示）`],
    ["明るさ", String(unit.brightness)],
  ];
  const tbody = $("state");
  tbody.replaceChildren();
  for (const [k, val] of rows) {
    const tr = document.createElement("tr");
    const th = document.createElement("th");
    const td = document.createElement("td");
    th.textContent = k;
    td.textContent = val;
    tr.append(th, td);
    tbody.append(tr);
  }
}

// ---------- 通知・トースト・音量表示 ----------

const notifications = [];
let toastTimer = null;
let volumeTimer = null;

function notify() {
  if (!unit.message) return;
  const time = new Date().toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" });
  notifications.unshift({ time, text: unit.message });
  renderNotifications();

  const toast = $("toast");
  $("toast-text").textContent = unit.message;
  toast.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { toast.hidden = true; }, TOAST_MS);
}

function renderNotifications() {
  const list = $("notify-list");
  list.replaceChildren();
  if (notifications.length === 0) {
    const li = document.createElement("li");
    li.className = "muted";
    li.textContent = "通知はありません";
    list.append(li);
  }
  for (const n of notifications) {
    const li = document.createElement("li");
    const text = document.createElement("span");
    text.textContent = n.text;
    const time = document.createElement("span");
    time.className = "muted";
    time.textContent = n.time;
    li.append(text, time);
    list.append(li);
  }
  $("notify-badge").hidden = notifications.length === 0;
}

function showVolume() {
  const pop = $("volume-pop");
  const silent = unit.muted || Boolean(unit.call);
  pop.classList.toggle("muted", silent);
  $("volume-icon").setAttribute("href", silent ? "#i-mute" : "#i-vol");
  $("volume-fill").style.width = `${Math.min(unit.volume / 30, 1) * 100}%`;
  $("volume-num").textContent = unit.muted ? "MUTE" : String(unit.volume);
  pop.hidden = false;
  clearTimeout(volumeTimer);
  volumeTimer = setTimeout(() => { pop.hidden = true; }, VOLUME_POP_MS);
}

// ---------- 操作ログ ----------

function log(action, accepted = true, withClimate = false) {
  const li = document.createElement("li");
  const time = new Date().toLocaleTimeString("ja-JP", { hour12: false });
  li.textContent = `${time}  ${action}${accepted ? "" : "（受け付けられず）"}  →  ${summary(withClimate)}`;
  if (!accepted) li.className = "rejected";
  const list = $("log");
  list.append(li);
  list.scrollTop = list.scrollHeight;
}

// ---------- 操作 ----------

/** 画面・ステアリングスイッチのボタン操作 */
function act(button, arg, detail) {
  const accepted = unit.press(button, arg);
  if (button === "navi" && accepted) $("keyword").value = "";
  if (accepted && ["volUp", "volDown", "mute"].includes(button)) showVolume();
  render();
  notify();
  const label = BUTTON_LABELS[button] ?? button;
  log(detail === undefined ? label : `${label}「${detail}」`, accepted);
}

/** エアコンバーの操作 */
function actHvac(action) {
  const accepted = unit.hvac(action);
  render();
  log(HVAC_LABELS[action] ?? action, accepted, true);
}

/** 拡張コントロール（車両側の信号）の操作 */
function signal(label, fn) {
  const result = fn();
  render();
  notify();
  log(`［車両］${label}`, result !== false);
}

let bootTimer = null;

function setAcc(on) {
  clearTimeout(bootTimer);
  signal(on ? "イグニッション ON" : "イグニッション OFF", () => unit.setAcc(on));
  if (on) {
    bootTimer = setTimeout(() => {
      unit.bootComplete();
      render();
      log("起動完了");
    }, BOOT_MS);
  }
}

// ---------- 入力 ----------

const THEME_DETAIL = (arg) => THEME_LABELS[arg];
const SOURCE_DETAIL = (arg) => SOURCE_LABELS[arg];

for (const btn of $$("[data-press]")) {
  btn.addEventListener("click", () => {
    const { press, arg } = btn.dataset;
    const detail = press === "theme" ? THEME_DETAIL(arg) : press === "selectSource" ? SOURCE_DETAIL(arg) : undefined;
    act(press, arg, detail);
  });
}

for (const btn of $$("[data-hvac]")) {
  btn.addEventListener("click", () => actHvac(btn.dataset.hvac));
}

$("search-form").addEventListener("submit", (e) => {
  e.preventDefault();
  const kw = $("keyword").value;
  act("search", kw, kw);
});

$("sb-notify").addEventListener("click", () => {
  $("hvac-panel").hidden = true;
  $("notifications").hidden = !$("notifications").hidden;
});
$("hvac-toggle").addEventListener("click", () => {
  $("notifications").hidden = true;
  $("hvac-panel").hidden = !$("hvac-panel").hidden;
});
$("hvac-close").addEventListener("click", () => { $("hvac-panel").hidden = true; });
$("notify-clear").addEventListener("click", () => {
  notifications.length = 0;
  renderNotifications();
});

// 拡張コントロールのタブ
for (const tab of $$(".ctl-tabs [data-tab]")) {
  tab.addEventListener("click", () => {
    for (const t of $$(".ctl-tabs [data-tab]")) t.setAttribute("aria-selected", String(t === tab));
    for (const p of $$(".ctl-panel")) p.hidden = p.dataset.panel !== tab.dataset.tab;
  });
}

$("sig-acc").addEventListener("change", (e) => setAcc(e.target.checked));

function bindRange(rangeId, numberId, label, unitLabel, fn) {
  const apply = (value) => signal(`${label} ${value}${unitLabel}`, () => fn(value));
  $(numberId).addEventListener("change", (e) => apply(e.target.value));
  $(rangeId).addEventListener("change", (e) => apply(e.target.value));
  $(rangeId).addEventListener("input", (e) => { $(numberId).value = e.target.value; });
}
bindRange("sig-speed-range", "sig-speed", "車速", " km/h", (v) => unit.setSpeed(v));
bindRange("sig-fuel-range", "sig-fuel", "燃料残量", " %", (v) => unit.setFuel(v));

for (const r of $$('input[name="shift"]')) {
  r.addEventListener("change", () => signal(`ギア ${r.value}`, () => unit.setShift(r.value)));
}

$("sig-night").addEventListener("change", (e) =>
  signal(e.target.checked ? "夜間" : "昼間", () => unit.setNight(e.target.checked)));
$("sig-outside").addEventListener("change", (e) =>
  signal(`外気温 ${e.target.value}℃`, () => unit.setOutsideTemp(e.target.value)));
$("sig-door").addEventListener("change", (e) =>
  signal(e.target.checked ? "運転席ドア 開" : "運転席ドア 閉", () => unit.setDoor(e.target.checked)));
$("sig-usb").addEventListener("change", (e) =>
  signal(e.target.checked ? "USB 接続" : "USB 取り外し", () => unit.setUsb(e.target.checked)));
$("sig-bt").addEventListener("change", (e) =>
  signal(e.target.checked ? "Bluetooth 接続" : "Bluetooth 切断", () => unit.setBt(e.target.checked)));
$("sig-call").addEventListener("click", () => signal("着信", () => unit.incomingCall()));

$("sig-reset").addEventListener("click", () => {
  clearTimeout(bootTimer);
  $("keyword").value = "";
  notifications.length = 0;
  renderNotifications();
  signal("工場出荷状態に戻す", () => unit.factoryReset());
});

$("log-copy").addEventListener("click", async () => {
  const text = [...$("log").children].map((li) => li.textContent).join("\n");
  await navigator.clipboard.writeText(text);
});
$("log-clear").addEventListener("click", () => $("log").replaceChildren());

setInterval(renderClock, 15000);
renderNotifications();
render();
