import { db, collection, query, where, orderBy, limit, getDocs } from "./firebase.js";
import { todayJst, setupNav, cell } from "./common.js";

setupNav();

const tbody = document.getElementById("slots");
const status = document.getElementById("slots-status");

try {
  const snap = await getDocs(query(
    collection(db, "slots"),
    where("date", ">=", todayJst()),
    orderBy("date"),
    limit(14),
  ));

  status.textContent = snap.empty ? "現在、予約受付中の日程はありません。" : "";

  snap.forEach((doc) => {
    const { date, capacity, reserved } = doc.data();
    const remain = Math.max(0, capacity - reserved);
    const tr = document.createElement("tr");
    tr.append(cell(date), cell(remain > 0 ? `残り ${remain} 枚` : "満員"));
    tbody.append(tr);
  });
} catch (e) {
  console.error(e);
  status.textContent = "空き状況を取得できませんでした。";
}
