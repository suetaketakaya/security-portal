// Firestore セキュリティルールのテスト
// 実行（zoopass フォルダで）: firebase emulators:exec --only firestore "npm --prefix tests test"

import { test, before, after, beforeEach } from "node:test";
import { readFileSync } from "node:fs";
import {
  initializeTestEnvironment, assertSucceeds, assertFails,
} from "@firebase/rules-unit-testing";
import {
  doc, collection, getDoc, getDocs, setDoc, updateDoc, deleteDoc, query, where,
  writeBatch, increment, serverTimestamp,
} from "firebase/firestore";

function jstDate(offsetDays) {
  return new Date(Date.now() + 9 * 3600e3 + offsetDays * 86400e3).toISOString().slice(0, 10);
}

const DATE = jstDate(3);
const PAST = jstDate(-3);
const CAPACITY = 5;

let env;

before(async () => {
  env = await initializeTestEnvironment({
    projectId: "demo-zoopass",
    firestore: {
      rules: readFileSync(new URL("../database/firestore.rules", import.meta.url), "utf8"),
      host: "127.0.0.1",
      port: 8080,
    },
  });
});

after(async () => {
  await env.cleanup();
});

beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, "slots", DATE), { date: DATE, capacity: CAPACITY, reserved: 0 });
    await setDoc(doc(db, "slots", PAST), { date: PAST, capacity: CAPACITY, reserved: 0 });
    await setDoc(doc(db, "admins", "admin"), {});
  });
});

const as = (uid) => env.authenticatedContext(uid).firestore();
const anon = () => env.unauthenticatedContext().firestore();

/** 予約バッチ。オプションで各値を改ざんして不正リクエストを作る */
function reserve(db, uid, opts = {}) {
  const { date = DATE, tickets = 2, slotDelta = tickets, owner = uid, withSlot = true } = opts;
  const ref = doc(collection(db, "reservations"));
  const batch = writeBatch(db);
  batch.set(ref, { uid: owner, date, tickets, status: "active", createdAt: serverTimestamp() });
  if (withSlot) {
    batch.update(doc(db, "slots", date), { reserved: increment(slotDelta), lastOp: ref.id });
  }
  return { id: ref.id, commit: () => batch.commit() };
}

function cancel(db, id, date, tickets) {
  const batch = writeBatch(db);
  batch.update(doc(db, "reservations", id), { status: "cancelled", cancelledAt: serverTimestamp() });
  batch.update(doc(db, "slots", date), { reserved: increment(-tickets), lastOp: id });
  return batch.commit();
}

async function reservedCount(date = DATE) {
  let n;
  await env.withSecurityRulesDisabled(async (ctx) => {
    n = (await getDoc(doc(ctx.firestore(), "slots", date))).data().reserved;
  });
  return n;
}

// ---------- 受付枠 ----------

test("未ログインでも受付枠は読める", async () => {
  await assertSucceeds(getDoc(doc(anon(), "slots", DATE)));
});

test("一般ユーザーは受付枠を作れない・管理者は作れる", async () => {
  const d = jstDate(10);
  await assertFails(setDoc(doc(as("alice"), "slots", d), { date: d, capacity: 10, reserved: 0 }));
  await assertSucceeds(setDoc(doc(as("admin"), "slots", d), { date: d, capacity: 10, reserved: 0 }));
});

test("管理者でも reserved が0以外の枠は作れない", async () => {
  const d = jstDate(10);
  await assertFails(setDoc(doc(as("admin"), "slots", d), { date: d, capacity: 10, reserved: 3 }));
});

test("予約を伴わずに reserved だけを書き換えられない", async () => {
  await assertFails(updateDoc(doc(as("alice"), "slots", DATE), { reserved: 0, lastOp: "x" }));
  await assertFails(updateDoc(doc(as("alice"), "slots", DATE), { capacity: 9999 }));
});

test("受付枠は削除できない", async () => {
  await assertFails(deleteDoc(doc(as("admin"), "slots", DATE)));
});

// ---------- 予約 ----------

test("正しい予約は成功し、枠が加算される", async () => {
  await assertSucceeds(reserve(as("alice"), "alice").commit());
  assert(await reservedCount() === 2);
});

test("未ログインでは予約できない", async () => {
  await assertFails(reserve(anon(), "alice").commit());
});

test("他人の名義で予約できない", async () => {
  await assertFails(reserve(as("alice"), "alice", { owner: "bob" }).commit());
});

test("枠を加算せずに予約だけ作れない", async () => {
  await assertFails(reserve(as("alice"), "alice", { withSlot: false }).commit());
});

test("予約枚数と枠の加算数が一致しないと失敗する", async () => {
  await assertFails(reserve(as("alice"), "alice", { tickets: 3, slotDelta: 1 }).commit());
});

test("枚数が範囲外・整数以外だと失敗する", async () => {
  await assertFails(reserve(as("alice"), "alice", { tickets: 0 }).commit());
  await assertFails(reserve(as("alice"), "alice", { tickets: 11 }).commit());
  await assertFails(reserve(as("alice"), "alice", { tickets: 1.5 }).commit());
});

test("定員を超える予約は失敗する", async () => {
  await assertSucceeds(reserve(as("alice"), "alice", { tickets: 4 }).commit());
  await assertFails(reserve(as("bob"), "bob", { tickets: 2 }).commit());
  assert(await reservedCount() === 4);
});

test("過去の日付は予約できない", async () => {
  await assertFails(reserve(as("alice"), "alice", { date: PAST }).commit());
});

test("予約は本人しか読めない", async () => {
  const r = reserve(as("alice"), "alice");
  await r.commit();
  await assertSucceeds(getDoc(doc(as("alice"), "reservations", r.id)));
  await assertFails(getDoc(doc(as("bob"), "reservations", r.id)));
  await assertFails(getDocs(collection(as("bob"), "reservations")));
  await assertSucceeds(getDocs(query(collection(as("bob"), "reservations"), where("uid", "==", "bob"))));
});

// ---------- 取消 ----------

test("本人は取り消せて、枠が戻る。二重取消はできない", async () => {
  const r = reserve(as("alice"), "alice", { tickets: 3 });
  await r.commit();
  await assertSucceeds(cancel(as("alice"), r.id, DATE, 3));
  assert(await reservedCount() === 0);
  await assertFails(cancel(as("alice"), r.id, DATE, 3));
});

test("他人の予約は取り消せない", async () => {
  const r = reserve(as("alice"), "alice");
  await r.commit();
  await assertFails(cancel(as("bob"), r.id, DATE, 2));
});

test("取消時に枠を多く戻すことはできない", async () => {
  const r = reserve(as("alice"), "alice", { tickets: 1 });
  await r.commit();
  await assertFails(cancel(as("alice"), r.id, DATE, 5));
});

test("予約は削除できない", async () => {
  const r = reserve(as("alice"), "alice");
  await r.commit();
  await assertFails(deleteDoc(doc(as("alice"), "reservations", r.id)));
});

function assert(cond) {
  if (!cond) throw new Error("assertion failed");
}
