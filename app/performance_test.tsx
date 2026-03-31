import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { collection, addDoc, onSnapshot, serverTimestamp, deleteDoc, doc, query, where, limit } from 'firebase/firestore';
import { db } from '../firebaseConfig';

export default function PerformanceTestScreen() {
  const [results, setResults] = useState<{sub: number, lat: number}[]>([]);
  const [status, setStatus] = useState('Ready');
  const [finalSummary, setFinalSummary] = useState<any>(null);

  const runTest = async () => {
    setStatus('Initializing Test...');
    setResults([]);
    setFinalSummary(null);

    const testIterations = 5;
    const localResults: {sub: number, lat: number}[] = [];

    for (let i = 0; i < testIterations; i++) {
      setStatus(`Running Iteration ${i + 1}/${testIterations}...`);
      
      const startTime = Date.now();
      let deliveryTime = 0;

      // Setup one-time listener for THIS specific document
      // We use a temporary field to identify it
      const testTag = `perf_test_${Date.now()}_${i}`;
      
      const unsubscribe = onSnapshot(
        query(collection(db, 'alerts'), where('testTag', '==', testTag), limit(1)),
        (snapshot) => {
          if (!snapshot.empty) {
            deliveryTime = Date.now();
          }
        }
      );

      // Submission
      const subStart = Date.now();
      const docRef = await addDoc(collection(db, 'alerts'), {
        type: 'System Performance Test',
        testTag: testTag,
        timestamp: serverTimestamp(),
        status: 'Active'
      });
      const subEnd = Date.now();
      const submissionLatency = subEnd - subStart;

      // Wait for delivery (max 5s)
      let waitStart = Date.now();
      while (deliveryTime === 0 && Date.now() - waitStart < 5000) {
        await new Promise(r => setTimeout(r, 100));
      }
      
      unsubscribe();

      const deliveryLatency = deliveryTime > 0 ? (deliveryTime - subStart) : 5000;
      localResults.push({ sub: submissionLatency, lat: deliveryLatency });
      setResults([...localResults]);

      // Cleanup
      try {
        await deleteDoc(doc(db, 'alerts', docRef.id));
      } catch (e) {}
    }

    const avgSub = localResults.reduce((a, b) => a + b.sub, 0) / testIterations;
    const avgLat = localResults.reduce((a, b) => a + b.lat, 0) / testIterations;

    setFinalSummary({
      avgSub: (avgSub / 1000).toFixed(2),
      avgLat: (avgLat / 1000).toFixed(2),
    });
    setStatus('Test Complete');
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>BabcockSOS Performance Test</Text>
      <TouchableOpacity onPress={runTest} style={styles.button}>
        <Text style={styles.buttonText}>Start Live Validation</Text>
      </TouchableOpacity>
      
      <Text style={styles.status}>Status: {status}</Text>

      {results.map((res, idx) => (
        <View key={idx} style={styles.row}>
          <Text>Iter {idx + 1}: Sub: {res.sub}ms | Deliv: {res.lat}ms</Text>
        </View>
      ))}

      {finalSummary && (
        <View style={styles.summaryBox}>
          <Text style={styles.summaryTitle}>FINAL METRICS</Text>
          <Text>Avg Submission: {finalSummary.avgSub}s</Text>
          <Text>Avg Delivery: {finalSummary.avgLat}s</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 40, backgroundColor: '#f5f5f5' },
  title: { fontSize: 22, fontWeight: 'bold', marginBottom: 20 },
  button: { backgroundColor: '#007AFF', padding: 15, borderRadius: 8, alignItems: 'center', marginBottom: 20 },
  buttonText: { color: 'white', fontWeight: 'bold' },
  status: { fontSize: 16, marginBottom: 10, color: '#666' },
  row: { padding: 10, borderBottomWidth: 1, borderBottomColor: '#ddd' },
  summaryBox: { marginTop: 30, padding: 20, backgroundColor: '#e3f2fd', borderRadius: 8, borderWidth: 1, borderColor: '#2196f3' },
  summaryTitle: { fontWeight: 'bold', fontSize: 18, marginBottom: 10 }
});
