const { initializeApp } = require('firebase/app');
const { getFirestore, collection, addDoc, onSnapshot, serverTimestamp, query, orderBy, limit, deleteDoc, doc } = require('firebase/firestore');
require('dotenv').config();

const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_TEST_FIREBASE_API_KEY,
  authDomain: "babcock-emergency-app.firebaseapp.com",
  projectId: "babcock-emergency-app",
  storageBucket: "babcock-emergency-app.firebasestorage.app",
  messagingSenderId: "753302098218",
  appId: "1:753302098218:web:01067ff05fef15b362ce53"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function runTests() {
  console.log("--- BABCOCK SOS PERFORMANCE TEST ---");
  console.log("Testing environment: Node.js / Fiberbase JS SDK");
  
  const results = {
    submissionTimes: [],
    deliveryLatencies: []
  };

  const testCollection = collection(db, 'alerts');
  const testIds = [];

  // Setup Listener
  let resolveListener;
  let currentTestId = null;
  let startTime = 0;

  const unsubscribe = onSnapshot(testCollection, (snapshot) => {
    const now = Date.now();
    snapshot.docChanges().forEach((change) => {
      if (change.type === 'added' && change.doc.id === currentTestId) {
        const latency = now - startTime;
        results.deliveryLatencies.push(latency);
        if (resolveListener) resolveListener();
      }
    });
  });

  for (let i = 0; i < 5; i++) {
    console.log(`Running Test ${i + 1}...`);
    
    startTime = Date.now();
    const subStart = Date.now();
    
    const docRef = await addDoc(testCollection, {
      type: 'Performance Test',
      description: `Test iteration ${i + 1}`,
      timestamp: serverTimestamp(),
      status: 'Test'
    });
    
    const subEnd = Date.now();
    currentTestId = docRef.id;
    testIds.push(docRef.id);
    results.submissionTimes.push(subEnd - subStart);

    await new Promise((resolve) => {
      resolveListener = resolve;
      // Timeout if it takes too long
      setTimeout(resolve, 10000);
    });
    
    console.log(`- Submission: ${subEnd - subStart}ms`);
    console.log(`- Delivery Latency: ${results.deliveryLatencies[i] || 'Timeout'}ms`);
  }

  unsubscribe();

  // Cleanup
  console.log("\nCleaning up test documents...");
  for (const id of testIds) {
    await deleteDoc(doc(db, 'alerts', id));
  }

  // Summary
  const avgSub = results.submissionTimes.reduce((a, b) => a + b, 0) / results.submissionTimes.length;
  const avgLat = results.deliveryLatencies.reduce((a, b) => a + b, 0) / results.deliveryLatencies.length;

  console.log("\n--- TEST SUMMARY ---");
  console.log(`Average Submission Time: ${(avgSub / 1000).toFixed(2)}s`);
  console.log(`Average Alert Delivery Latency: ${(avgLat / 1000).toFixed(2)}s`);
  console.log(`Total Success Rate: ${(results.deliveryLatencies.length / 5 * 100)}%`);
}

runTests().catch(console.error);
