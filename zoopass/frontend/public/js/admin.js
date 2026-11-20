// 受付枠の一括作成。権限の判定は Firestore ルール（admins コレクション）で行う。
import { auth, db, onAuthStateChanged, doc, getDoc, writeBatch } from "./firebase.js";
import { todayJst, setupNav } from "./common.js";

setupNav();

const status = document.getElementById("admin-status");
const form = document.getElementById("slot-form");
const message = document.getElementById("message");

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    location.replace("/login");
    return;
  }
  try {
    const admin = await getDoc(doc(db, "admins", user.uid));
    if (!admin.exists()) throw new Error("not admin");
    status.textContent = "";
    form.start.value = todayJst();
    form.hidden = false;
  } catch {
    status.textContent = "このページを利用する権限がありません。";
  }
});

/** "YYYY-MM-DD" に日数を足す */
function addDays(date, n) {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  message.textContent = "";
  const days = Number(form.days.value);
  const capacity = Number(form.capacity.value);
  const button = form.querySelector("button[type=submit]");
  button.disabled = true;

  try {
    const dates = Array.from({ length: days }, (_, i) => addDays(form.start.value, i));
    const snaps = await Promise.all(dates.map((d) => getDoc(doc(db, "slots", d))));
    const missing = dates.filter((_, i) => !snaps[i].exists());

    // ルールの参照回数制限（1バッチあたり20回）に収まるよう、10件ずつ書き込む
    for (let i = 0; i < missing.length; i += 10) {
      const batch = writeBatch(db);
      for (const date of missing.slice(i, i + 10)) {
        batch.set(doc(db, "slots", date), { date, capacity, reserved: 0 });
      }
      await batch.commit();
    }
    message.textContent = `${missing.length}日分を作成しました（既存 ${dates.length - missing.length}日分はスキップ）。`;
  } catch (e) {
    console.error(e);
    message.textContent = "作成できませんでした。";
  } finally {
    button.disabled = false;
  }
});
