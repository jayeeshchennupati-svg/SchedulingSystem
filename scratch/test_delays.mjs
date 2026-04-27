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

async function testDelay() {
  const d = doc(db, 'queueApp/mainState');
  const snap = await getDoc(d);
  if (snap.exists()) {
    let data = snap.data();
    let queue = data['mq:queue'] || [];
    
    // Add two test entries
    const pastDelay = new Date(Date.now() - 1000 * 60).toISOString(); // 1 minute ago
    const futureDelay = new Date(Date.now() + 1000 * 60).toISOString(); // 1 minute future
    
    queue.push({
      id: 'test_1',
      userId: 'pres',
      userName: 'Test User Past',
      email: 'pres@test.com',
      topic: 'Past Delay',
      purpose: 'Testing',
      duration: 15,
      requestedAt: new Date(Date.now() - 100000).toISOString(),
      delayed: true,
      delayUntil: pastDelay
    });
    
    queue.push({
      id: 'test_2',
      userId: 'admin',
      userName: 'Test User Future',
      email: 'admin@test.com',
      topic: 'Future Delay',
      purpose: 'Testing',
      duration: 15,
      requestedAt: new Date(Date.now() - 50000).toISOString(),
      delayed: true,
      delayUntil: futureDelay
    });
    
    await setDoc(d, { 'mq:queue': queue }, { merge: true });
    console.log('Added test entries. Check the UI!');
  }
  process.exit(0);
}

testDelay();
