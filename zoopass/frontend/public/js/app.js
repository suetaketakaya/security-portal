// エミュレーター画面。動作はすべて unit.js のモデルに任せ、ここでは表示と入力の受け渡しだけを行う。
// 出力は textContent だけを使う（innerHTML は使わない）。
import { InfotainmentUnit, SOURCE_LABELS } from "./unit.js";

const BOOT_MS = 1500;

const unit = new InfotainmentUnit();
const $ = (id) => document.getElementById(id);

const BUTTON_LABELS = {
  volUp: "VOL ＋", volDown: "VOL －", mute: "MUTE", source: "SOURCE", home: "HOME",
  tuneUp: "選局 ▶", tuneDown: "◀ 選局", navi: "目的地検索", settings: "設定",
  search: "検索", select: "検索結果を選択", cancelRoute: "案内中止",
  brightUp: "明るさ ＋", brightDown: "明るさ －",
  answer: "応答", reject: "拒否", hangup: "終話",
};

const VIEW_LABELS = {
  off: "消灯", booting: "起動中", camera: "バックカメラ", call: "電話",
  home: "ホーム", navi: "目的地検索", settings: "設定",
};

// ---------- 表示 ----------

function volumeText() {
  if (unit.call) return "通話中（消音）";
  return unit.muted ? "MUTE" : `VOL ${unit.volume}`;
}

function mediaText() {
  if (unit.source === "radio") return unit.freqLabel();
  return `${SOURCE_LABELS[unit.source]} 再生中`;
}

function summary() {
  const parts = [VIEW_LABELS[unit.view()]];
  if (unit.power === "on") {
    parts.push(volumeText(), mediaText());
    if (unit.destination) parts.push(`目的地 ${unit.destination.name}`);
  }
  if (unit.message) parts.push(`「${unit.message}」`);
  return parts.join(" / ");
}

function render() {
  const view = unit.view();
  const screen = $("screen");
  screen.dataset.view = view;
  screen.style.filter = `brightness(${0.6 + unit.brightness * 0.1})`;
  for (const el of screen.querySelectorAll(".view")) el.hidden = el.dataset.for !== view;

  $("st-source").textContent = SOURCE_LABELS[unit.source];
  $("st-volume").textContent = volumeText();
  $("st-media").textContent = mediaText();
  $("st-bright").textContent = `${unit.brightness} / 5`;

  $("route").hidden = !unit.destination;
  $("route-text").textContent = unit.destination
    ? `目的地：${unit.destination.name}（残り ${unit.destination.km.toFixed(1)} km）`
    : "";

  $("call-title").textContent = unit.call === "incoming" ? "着信中…" : "通話中";
  $("btn-answer").hidden = unit.call !== "incoming";
  $("btn-reject").hidden = unit.call !== "incoming";
  $("btn-hangup").hidden = unit.call !== "active";

  const results = $("results");
  results.replaceChildren();
  unit.results.forEach((poi, i) => {
    const li = document.createElement("li");
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "secondary";
    btn.textContent = `${poi.name}（${poi.km.toFixed(1)} km）`;
    btn.addEventListener("click", () => act("select", i, poi.name));
    li.append(btn);
    results.append(li);
  });

  $("message").textContent = unit.message;
  $("message").hidden = !unit.message;

  // 車両信号パネルをモデルの状態に合わせる
  $("sig-acc").checked = unit.vehicle.acc;
  $("sig-speed").value = unit.vehicle.speed;
  $("sig-speed-range").value = unit.vehicle.speed;
  for (const r of document.querySelectorAll('input[name="shift"]')) r.checked = r.value === unit.vehicle.shift;
  $("sig-usb").checked = unit.vehicle.usb;
  $("sig-bt").checked = unit.vehicle.bt;

  const rows = [
    ["電源", { off: "OFF", booting: "起動中", on: "ON" }[unit.power]],
    ["表示中の画面", VIEW_LABELS[view]],
    ["音量", unit.muted ? `${unit.volume}（ミュート中）` : String(unit.volume)],
    ["音源", SOURCE_LABELS[unit.source]],
    ["周波数", unit.freqLabel()],
    ["車速", `${unit.vehicle.speed} km/h`],
    ["シフト", unit.vehicle.shift],
    ["目的地", unit.destination ? unit.destination.name : "なし"],
    ["電話", { incoming: "着信中", active: "通話中" }[unit.call] ?? "なし"],
  ];
  const tbody = $("state");
  tbody.replaceChildren();
  for (const [k, v] of rows) {
    const tr = document.createElement("tr");
    const th = document.createElement("th");
    const td = document.createElement("td");
    th.textContent = k;
    td.textContent = v;
    tr.append(th, td);
    tbody.append(tr);
  }
}

// ---------- 操作ログ ----------

function log(action, accepted = true) {
  const li = document.createElement("li");
  const time = new Date().toLocaleTimeString("ja-JP", { hour12: false });
  li.textContent = `${time}  ${action}${accepted ? "" : "（受け付けられず）"}  →  ${summary()}`;
  if (!accepted) li.className = "rejected";
  const list = $("log");
  list.append(li);
  list.scrollTop = list.scrollHeight;
}

/** ヘッドユニットのボタン操作 */
function act(button, arg, detail) {
  const accepted = unit.press(button, arg);
  if (button === "navi" && accepted) $("keyword").value = "";
  render();
  const label = BUTTON_LABELS[button] ?? button;
  log(detail === undefined ? label : `${label}「${detail}」`, accepted);
}

/** 車両信号の操作 */
function signal(label, fn) {
  const result = fn();
  render();
  log(label, result !== false);
}

let bootTimer = null;

function setAcc(on) {
  clearTimeout(bootTimer);
  signal(on ? "ACC ON" : "ACC OFF", () => unit.setAcc(on));
  if (on) {
    bootTimer = setTimeout(() => {
      unit.bootComplete();
      render();
      log("起動完了");
    }, BOOT_MS);
  }
}

// ---------- 入力 ----------

for (const btn of document.querySelectorAll("[data-press]")) {
  btn.addEventListener("click", () => act(btn.dataset.press));
}

$("search-form").addEventListener("submit", (e) => {
  e.preventDefault();
  const kw = $("keyword").value;
  act("search", kw, kw);
});

$("sig-acc").addEventListener("change", (e) => setAcc(e.target.checked));

function setSpeed(value) {
  signal(`車速 ${value} km/h`, () => unit.setSpeed(value));
}
$("sig-speed").addEventListener("change", (e) => setSpeed(e.target.value));
$("sig-speed-range").addEventListener("change", (e) => setSpeed(e.target.value));
$("sig-speed-range").addEventListener("input", (e) => { $("sig-speed").value = e.target.value; });

for (const r of document.querySelectorAll('input[name="shift"]')) {
  r.addEventListener("change", () => signal(`シフト ${r.value}`, () => unit.setShift(r.value)));
}

$("sig-usb").addEventListener("change", (e) =>
  signal(e.target.checked ? "USB接続" : "USB取り外し", () => unit.setUsb(e.target.checked)));
$("sig-bt").addEventListener("change", (e) =>
  signal(e.target.checked ? "Bluetooth接続" : "Bluetooth切断", () => unit.setBt(e.target.checked)));
$("sig-call").addEventListener("click", () => signal("着信", () => unit.incomingCall()));

$("sig-reset").addEventListener("click", () => {
  clearTimeout(bootTimer);
  $("keyword").value = "";
  signal("工場出荷状態に戻す", () => unit.factoryReset());
});

$("log-copy").addEventListener("click", async () => {
  const text = [...$("log").children].map((li) => li.textContent).join("\n");
  await navigator.clipboard.writeText(text);
});
$("log-clear").addEventListener("click", () => $("log").replaceChildren());

render();
