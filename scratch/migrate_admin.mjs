import { initializeApp } from "firebase/app";
import { getFirestore, doc, getDoc, setDoc } from "firebase/firestore";

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

async function migrate() {
  const d = doc(db, 'queueApp/mainState');
  const snap = await getDoc(d);
  if (snap.exists()) {
    let data = snap.data();
    let users = data['mq:users'] || [];
    
    // Find the admin user and update
    const adminIndex = users.findIndex(u => u.id === 'admin');
    if (adminIndex !== -1) {
      users[adminIndex].email = 'admin@powermech.net';
      users[adminIndex].password = 'admin@P0wer';
      console.log('Updated existing admin user credentials.');
    } else {
      console.log('Admin user not found. Seeding...');
      users.push({ id: 'admin', email: 'admin@powermech.net', password: 'admin@P0wer', name: 'Executive Assistant', role: 'EA', verified: true });
    }
    
    await setDoc(d, { 'mq:users': users }, { merge: true });
    console.log('Migration complete!');
  }
  process.exit(0);
}

migrate();
