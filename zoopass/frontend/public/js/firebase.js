// Firebase SDK の読み込みと初期化。SDKのバージョンはこのファイルでだけ管理する。
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-app.js";
import {
  getAuth, connectAuthEmulator, onAuthStateChanged, signOut,
  signInWithEmailAndPassword, createUserWithEmailAndPassword,
} from "https://www.gstatic.com/firebasejs/11.0.2/firebase-auth.js";
import {
  getFirestore, connectFirestoreEmulator,
  collection, doc, query, where, orderBy, limit, getDocs, getDoc,
  writeBatch, increment, serverTimestamp,
} from "https://www.gstatic.com/firebasejs/11.0.2/firebase-firestore.js";

// Firebase Hosting が自動で提供する設定を使う（設定値をソースに書かない）
const config = await (await fetch("/__/firebase/init.json")).json();

export const app = initializeApp(config);
export const auth = getAuth(app);
export const db = getFirestore(app);

if (location.hostname === "localhost" || location.hostname === "127.0.0.1") {
  connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
  connectFirestoreEmulator(db, "127.0.0.1", 8080);
}

export {
  onAuthStateChanged, signOut, signInWithEmailAndPassword, createUserWithEmailAndPassword,
  collection, doc, query, where, orderBy, limit, getDocs, getDoc,
  writeBatch, increment, serverTimestamp,
};
