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
