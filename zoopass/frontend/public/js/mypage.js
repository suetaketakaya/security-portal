import {
  auth, db, onAuthStateChanged,
  collection, doc, query, where, orderBy, getDocs, getDoc,
  writeBatch, increment, serverTimestamp,
} from "./firebase.js";
import { todayJst, setupNav, cell } from "./common.js";

setupNav();

const MAX_TICKETS = 10;

const form = document.getElementById("reserve-form");
const message = document.getElementById("message");
const tbody = document.getElementById("reservations");
const listStatus = document.getElementById("list-status");

form.date.min = todayJst();
form.date.value = todayJst();

let currentUid = null;

onAuthStateChanged(auth, (user) => {
  if (!user) {
    location.replace("/login");
    return;
  }
  currentUid = user.uid;
  document.getElementById("user-email").textContent = user.email;
  loadReservations();
});

// ---------- 予約 ----------

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  message.textContent = "";
  const date = form.date.value;
  const tickets = Number(form.tickets.value);

  // 画面側のチェックは利便性のため。本当の検証は Firestore ルールで行う。
  if (!Number.isInteger(tickets) || tickets < 1 || tickets > MAX_TICKETS) {
    message.textContent = `枚数は1〜${MAX_TICKETS}枚で指定してください。`;
    return;
  }

  const button = form.querySelector("button[type=submit]");
  button.disabled = true;
  try {
    const slotRef = doc(db, "slots", date);
    const slot = await getDoc(slotRef);
    if (!slot.exists()) {
      message.textContent = "この日は予約を受け付けていません。";
      return;
    }
    const { capacity, reserved } = slot.data();
    if (reserved + tickets > capacity) {
      message.textContent = "残りの枠が足りません。";
      return;
    }

    // 予約の作成と枠の加算を1回のバッチで行う（ルールが両方の整合性を確認する）
    const reservationRef = doc(collection(db, "reservations"));
    const batch = writeBatch(db);
    batch.set(reservationRef, {
      uid: currentUid,
      date,
      tickets,
      status: "active",
      createdAt: serverTimestamp(),
    });
    batch.update(slotRef, { reserved: increment(tickets), lastOp: reservationRef.id });
    await batch.commit();

    message.textContent = "予約しました。";
    await loadReservations();
  } catch (e) {
    console.error(e);
    message.textContent = "予約できませんでした。空き状況や入力内容を確認してください。";
  } finally {
    button.disabled = false;
  }
});

// ---------- 取消 ----------

async function cancel(id, reservation) {
  if (!confirm("この予約を取り消しますか？")) return;
  message.textContent = "";
  try {
    const batch = writeBatch(db);
    batch.update(doc(db, "reservations", id), {
      status: "cancelled",
      cancelledAt: serverTimestamp(),
    });
    batch.update(doc(db, "slots", reservation.date), {
      reserved: increment(-reservation.tickets),
      lastOp: id,
    });
    await batch.commit();

    message.textContent = "予約を取り消しました。";
    await loadReservations();
  } catch (e) {
    console.error(e);
    message.textContent = "取り消せませんでした。";
  }
}

// ---------- 一覧 ----------

async function loadReservations() {
  tbody.replaceChildren();
  listStatus.textContent = "読み込み中…";
  try {
    const snap = await getDocs(query(
      collection(db, "reservations"),
      where("uid", "==", currentUid),
      orderBy("createdAt", "desc"),
    ));
    listStatus.textContent = snap.empty ? "予約はまだありません。" : "";

    const today = todayJst();
    snap.forEach((d) => {
      const r = d.data();
      const active = r.status === "active";
      const tr = document.createElement("tr");
      tr.append(cell(r.date), cell(`${r.tickets} 枚`), cell(active ? "予約中" : "取消済"));

      const actionCell = document.createElement("td");
      if (active && r.date >= today) {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.textContent = "取消";
        btn.addEventListener("click", () => cancel(d.id, r));
        actionCell.append(btn);
      }
      tr.append(actionCell);
      tbody.append(tr);
    });
  } catch (e) {
    console.error(e);
    listStatus.textContent = "予約一覧を取得できませんでした。";
  }
}
