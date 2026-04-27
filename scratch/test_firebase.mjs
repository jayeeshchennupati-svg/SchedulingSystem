import { initializeApp } from "firebase/app";
import { getFirestore, doc, setDoc, getDoc } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyCeMUnQ-C1B6rac_okN-TIfuW1x6dUUd_Q",
  authDomain: "queue-8b63c.firebaseapp.com",
  projectId: "queue-8b63c",
  storageBucket: "queue-8b63c.firebasestorage.app",
  messagingSenderId: "28651533731",
  appId: "1:28651533731:web:64e188fb3a3f1adcd8d616"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function test() {
  console.log("Testing Firestore connection...");
  try {
    const d = doc(db, 'queueApp/mainState');
    console.log("Attempting to get document...");
    const snap = await getDoc(d);
    console.log("Get successful! Exists:", snap.exists());
    
    console.log("Attempting to write document...");
    await setDoc(d, { test: "success" }, { merge: true });
    console.log("Write successful!");
  } catch (e) {
    console.error("Firestore Error:", e);
  }
  process.exit(0);
}

test();
