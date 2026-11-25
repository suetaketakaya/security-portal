// VATL-100 動作モデルの基本テスト（実行：cd tests; npm test）
import { test } from "node:test";
import assert from "node:assert/strict";
import { InfotainmentUnit } from "../frontend/public/js/unit.js";

function started() {
  const u = new InfotainmentUnit();
  u.setAcc(true);
  u.bootComplete();
  return u;
}

test("PWR-01/02: ACC OFF と起動中はボタンを受け付けない", () => {
  const u = new InfotainmentUnit();
  assert.equal(u.press("volUp"), false);
  u.setAcc(true);
  assert.equal(u.view(), "booting");
  assert.equal(u.press("volUp"), false);
  u.bootComplete();
  assert.equal(u.view(), "home");
  assert.equal(u.press("volUp"), true);
});

test("PWR-06: 工場出荷状態", () => {
  const u = started();
  assert.equal(u.volume, 10);
  assert.equal(u.muted, false);
  assert.equal(u.source, "radio");
  assert.equal(u.freqLabel(), "FM 80.0 MHz");
  assert.equal(u.brightness, 3);
  assert.equal(u.destination, null);
});

test("PWR-03/04/05: 再起動で状態を復元し、大音量とミュートは抑える", () => {
  const u = started();
  for (let i = 0; i < 15; i++) u.press("volUp"); // 25
  u.press("mute");
  u.setAcc(false);
  u.setAcc(true);
  u.bootComplete();
  assert.equal(u.volume, 20);
  assert.equal(u.muted, false);
});

test("VOL-01/02: 音量の増減と下限", () => {
  const u = started();
  u.press("volUp");
  assert.equal(u.volume, 11);
  for (let i = 0; i < 20; i++) u.press("volDown");
  assert.equal(u.volume, 0);
});

test("VOL-03/04: MUTE の切替と VOL＋ によるミュート解除", () => {
  const u = started();
  u.press("mute");
  assert.equal(u.muted, true);
  u.press("mute");
  assert.equal(u.muted, false);
  u.press("mute");
  u.press("volUp");
  assert.equal(u.muted, false);
  assert.equal(u.volume, 11);
});

test("SRC-01/02: 使える音源だけを順番に切り替える", () => {
  const u = started();
  u.press("source");
  assert.equal(u.source, "radio");
  u.setUsb(true);
  u.press("source");
  assert.equal(u.source, "usb");
  u.setBt(true);
  u.press("source");
  assert.equal(u.source, "radio");
  u.press("source");
  assert.equal(u.source, "bt");
});

test("SRC-03: Bluetooth 切断でラジオに戻る", () => {
  const u = started();
  u.setBt(true);
  u.press("source");
  u.setBt(false);
  assert.equal(u.source, "radio");
  assert.match(u.message, /Bluetooth/);
});

test("SRC-04/05/06: 選局", () => {
  const u = started();
  u.press("tuneUp");
  assert.equal(u.freqLabel(), "FM 80.1 MHz");
  u.press("tuneDown");
  u.press("tuneDown");
  assert.equal(u.freqLabel(), "FM 79.9 MHz");
  u.freq = 950;
  u.press("tuneUp");
  assert.equal(u.freqLabel(), "FM 76.0 MHz");
  u.setBt(true);
  u.press("source");
  assert.equal(u.press("tuneUp"), false);
});

test("DRV-01/02/03: 走行中は目的地検索と設定を開けない", () => {
  const u = started();
  u.setSpeed(4);
  assert.equal(u.press("navi"), true);
  u.setSpeed(30);
  assert.equal(u.screen, "home");
  assert.equal(u.message, "走行中は操作できません");
  assert.equal(u.press("settings"), false);
  assert.equal(u.press("volUp"), true);
});

test("NAV-02/03/04/05/06: 目的地検索と案内", () => {
  const u = started();
  u.press("navi");
  assert.equal(u.press("search", ""), false);
  assert.equal(u.message, "キーワードを入力してください");
  assert.equal(u.press("search", "あ".repeat(21)), false);
  assert.equal(u.press("search", "あ".repeat(20)), true);
  assert.equal(u.message, "該当する施設がありません");
  u.press("search", " 空港 ");
  assert.equal(u.results.length, 2);
  u.press("select", 0);
  assert.equal(u.screen, "home");
  assert.equal(u.destination.name, "空港 第1ターミナル");
  u.press("cancelRoute");
  assert.equal(u.destination, null);
});

test("REV-01/02/03: R でバックカメラを優先し、音量を 10 に制限する", () => {
  const u = started();
  for (let i = 0; i < 5; i++) u.press("volUp"); // 15
  u.setShift("R");
  assert.equal(u.view(), "camera");
  assert.equal(u.volume, 10);
  assert.equal(u.press("volUp"), false);
});

test("REV-04: 音量 10 以下なら R 解除後もそのまま", () => {
  const u = started();
  u.press("volDown"); // 9
  u.setShift("R");
  u.setShift("D");
  assert.equal(u.view(), "home");
  assert.equal(u.volume, 9);
});

test("TEL-01〜06: 着信・通話", () => {
  const u = started();
  assert.equal(u.incomingCall(), false);
  u.setBt(true);
  assert.equal(u.incomingCall(), true);
  assert.equal(u.view(), "call");
  assert.equal(u.press("volUp"), false);
  u.setShift("R");
  assert.equal(u.view(), "camera");
  u.setShift("P");
  assert.equal(u.view(), "call");
  u.press("answer");
  assert.equal(u.call, "active");
  u.press("hangup");
  assert.equal(u.view(), "home");
  u.incomingCall();
  u.setBt(false);
  assert.equal(u.call, null);
});

test("SET-01: 明るさは 1〜5", () => {
  const u = started();
  u.press("settings");
  for (let i = 0; i < 5; i++) u.press("brightUp");
  assert.equal(u.brightness, 5);
  for (let i = 0; i < 10; i++) u.press("brightDown");
  assert.equal(u.brightness, 1);
});

test("DRV-04: 走行中もメディア・電話・アプリ一覧は開ける", () => {
  const u = started();
  u.setSpeed(60);
  assert.equal(u.press("media"), true);
  assert.equal(u.press("phone"), true);
  assert.equal(u.press("apps"), true);
});

test("SRC-02: 使えない音源はタブから選べない", () => {
  const u = started();
  assert.equal(u.press("selectSource", "usb"), false);
  u.setUsb(true);
  assert.equal(u.press("selectSource", "usb"), true);
  assert.equal(u.source, "usb");
});

test("SRC-07/08: 曲送りは端で折り返し、BT と USB で別々に記憶する", () => {
  const u = started();
  u.setUsb(true);
  u.setBt(true);
  u.press("selectSource", "usb");
  assert.equal(u.press("trackPrev"), true);
  assert.equal(u.mediaLabel(), "Track 05");
  u.press("trackNext");
  assert.equal(u.mediaLabel(), "Track 01");
  u.press("trackNext");
  u.press("selectSource", "bt");
  assert.equal(u.mediaLabel(), "Morning Drive");
  u.press("selectSource", "usb");
  assert.equal(u.mediaLabel(), "Track 02");
  u.press("playPause");
  assert.equal(u.playing, false);
  u.press("selectSource", "radio");
  assert.equal(u.press("trackNext"), false);
});

test("HVAC-01: 温度は 16.0〜32.0℃、0.5℃ 刻み", () => {
  const u = started();
  u.hvac("driverUp");
  assert.equal(InfotainmentUnit.tempLabel(u.climate.driverTemp), "22.5℃");
  for (let i = 0; i < 40; i++) u.hvac("driverUp");
  assert.equal(InfotainmentUnit.tempLabel(u.climate.driverTemp), "32.0℃");
  for (let i = 0; i < 40; i++) u.hvac("passengerDown");
  assert.equal(InfotainmentUnit.tempLabel(u.climate.passengerTemp), "16.0℃");
});

test("HVAC-02: SYNC", () => {
  const u = started();
  u.hvac("passengerDown");
  u.hvac("sync");
  assert.equal(u.climate.passengerTemp, u.climate.driverTemp);
  u.hvac("driverUp");
  assert.equal(u.climate.passengerTemp, u.climate.driverTemp);
  u.hvac("passengerUp");
  assert.equal(u.climate.sync, false);
});

test("HVAC-03/04/05: 風量・A/C・デフロスター", () => {
  const u = started();
  for (let i = 0; i < 10; i++) u.hvac("fanUp");
  assert.equal(u.climate.fan, 8);
  for (let i = 0; i < 10; i++) u.hvac("fanDown");
  assert.equal(u.climate.fan, 0);
  assert.equal(u.climate.ac, false);
  u.hvac("ac");
  assert.equal(u.climate.fan, 1);
  u.hvac("ac");
  u.hvac("defrost");
  assert.equal(u.climate.ac, true);
  assert.equal(u.climate.fan, 3);
  u.hvac("defrost");
  assert.equal(u.climate.ac, true);
  assert.equal(u.climate.fan, 3);
});

test("HVAC-06/07: シートヒーターの切替と、R・電話中の操作", () => {
  const u = started();
  for (let i = 0; i < 4; i++) u.hvac("seatDriver");
  assert.equal(u.climate.seatDriver, 0);
  u.setShift("R");
  assert.equal(u.hvac("seatPassenger"), true);
  u.setShift("P");
  u.setBt(true);
  u.incomingCall();
  assert.equal(u.hvac("fanUp"), true);
  u.setAcc(false);
  assert.equal(u.hvac("fanUp"), false);
});

test("SET-02: テーマ", () => {
  const u = started();
  assert.equal(u.isDark(), false);
  u.setNight(true);
  assert.equal(u.isDark(), true);
  u.press("theme", "light");
  assert.equal(u.isDark(), false);
  u.press("theme", "dark");
  u.setNight(false);
  assert.equal(u.isDark(), true);
});

test("VEH-01/02/03: 外気温・燃料・ドア", () => {
  const u = started();
  u.setOutsideTemp(99);
  assert.equal(u.vehicle.outsideTemp, 50);
  u.setFuel(10);
  assert.equal(u.message, "");
  u.setFuel(9);
  assert.equal(u.message, "燃料残量が少なくなっています");
  u.setFuel(5);
  assert.equal(u.message, "");
  u.setDoor(true);
  assert.equal(u.message, "");
  u.setDoor(false);
  u.setSpeed(1);
  u.setDoor(true);
  assert.equal(u.message, "ドアが開いています");
});
