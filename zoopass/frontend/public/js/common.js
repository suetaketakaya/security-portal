import { auth, onAuthStateChanged, signOut } from "./firebase.js";

/** 日本時間の今日を "YYYY-MM-DD" で返す */
export function todayJst() {
  return new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

/** テキストだけを持つセルを作る（innerHTML は使わない：XSS対策） */
export function cell(text) {
  const td = document.createElement("td");
  td.textContent = text;
  return td;
}

/** ログイン状態に応じてナビゲーションを切り替える */
export function setupNav() {
  const login = document.getElementById("nav-login");
  const mypage = document.getElementById("nav-mypage");
  const logout = document.getElementById("nav-logout");

  onAuthStateChanged(auth, (user) => {
    login.hidden = Boolean(user);
    mypage.hidden = !user;
    logout.hidden = !user;
  });

  logout.addEventListener("click", async () => {
    await signOut(auth);
    location.assign("/");
  });
}
