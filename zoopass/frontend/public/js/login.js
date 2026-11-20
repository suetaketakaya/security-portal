import { auth, signInWithEmailAndPassword, createUserWithEmailAndPassword } from "./firebase.js";
import { setupNav } from "./common.js";

setupNav();

const form = document.getElementById("auth-form");
const message = document.getElementById("message");

// エラー内容から「登録済みかどうか」を推測されないよう、メッセージは粗くする
function errorMessage(action, code) {
  if (code === "auth/too-many-requests") return "試行回数が多すぎます。しばらくしてから再度お試しください。";
  if (code === "auth/invalid-email") return "メールアドレスの形式が正しくありません。";
  if (action === "register") {
    if (code === "auth/weak-password" || code === "auth/password-does-not-meet-requirements") {
      return "パスワードの条件を満たしていません。";
    }
    return "登録できませんでした。入力内容を確認してください。";
  }
  return "メールアドレスまたはパスワードが正しくありません。";
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const action = event.submitter && event.submitter.value === "register" ? "register" : "login";
  const email = form.email.value.trim();
  const password = form.password.value;
  message.textContent = "";

  try {
    if (action === "register") {
      await createUserWithEmailAndPassword(auth, email, password);
    } else {
      await signInWithEmailAndPassword(auth, email, password);
    }
    location.assign("/mypage");
  } catch (e) {
    message.textContent = errorMessage(action, e.code);
  }
});
