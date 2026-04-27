import { initializeApp } from "firebase/app";
import { getFirestore, doc, getDoc } from "firebase/firestore";

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
  const snap = await getDoc(doc(db, 'queueApp/mainState'));
  console.log(JSON.stringify(snap.data(), null, 2));
  process.exit(0);
}

test();
