import React, { useEffect, useState } from 'react';
import { 
  StyleSheet, Text, View, FlatList, TouchableOpacity, ActivityIndicator 
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as Location from 'expo-location';
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore';

import { db } from '../firebaseConfig'; 
import { useTheme } from '../hooks/ThemeContext'; 
import { useLocation } from '../hooks/LocationContext';
import { formatDistanceToNow } from 'date-fns';

const getDistanceInMeters = (lat1?: number, lon1?: number, lat2?: number, lon2?: number) => {
  if (!lat1 || !lon1 || !lat2 || !lon2) return '--';
  const R = 6371e3; 
  const rad = Math.PI / 180;
  const dLat = (lat2 - lat1) * rad;
  const dLon = (lon2 - lon1) * rad;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c);
};

// --- HELPER FUNCTIONS ---
const getSafeDate = (timestamp: any) => {
  if (!timestamp) return new Date();
  if (typeof timestamp.toDate === 'function') return timestamp.toDate();
  if (timestamp.seconds) return new Date(timestamp.seconds * 1000);
  return new Date(timestamp);
};

const getTimeAgo = (timestamp: any) => {
  if (!timestamp) return 'Just now';
  try {
    const date = getSafeDate(timestamp);
    const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000);
    if (seconds < 60) return 'Just now';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  } catch (e) {
    return 'Just now';
  }
};


const getAlertStyling = (type: string) => {
  if (type.includes('Medical')) return { icon: 'medical-bag', color: '#DC2626', bg: '#FEE2E2' };
  if (type.includes('Fire')) return { icon: 'fire', color: '#F59E0B', bg: '#FEF3C7' };
  if (type.includes('Security')) return { icon: 'shield-alert', color: '#3B82F6', bg: '#DBEAFE' };
  if (type.includes('Accident')) return { icon: 'car-brake-alert', color: '#8B5CF6', bg: '#EDE9FE' };
  return { icon: 'alert-octagram', color: '#DC2626', bg: '#FEE2E2' }; 
};

export default function AlertsModalScreen() {
  const { colors } = useTheme();
  const router = useRouter();

  const [alerts, setAlerts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const { userLocation } = useLocation();

  useEffect(() => {
    const q = query(collection(db, 'alerts'), orderBy('timestamp', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedAlerts = snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() }))
        // Filter out history, ONLY show currently active emergencies
        .filter((alert: any) => alert.status === 'Active'); 
        
      setAlerts(fetchedAlerts);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const renderAlertCard = ({ item }: { item: any }) => {
    const style = getAlertStyling(item.type);
    const distance = getDistanceInMeters(
      userLocation?.coords?.latitude, 
      userLocation?.coords?.longitude, 
      item.location?.latitude, 
      item.location?.longitude
    );
    const timeAgo = getTimeAgo(item.timestamp);

    return (
      <View style={[styles.alertCard, { backgroundColor: colors.surface }]}>
        <View style={[styles.alertIndicator, { backgroundColor: style.color }]} />
        <View style={[styles.alertIconBg, { backgroundColor: style.bg }]}>
          <MaterialCommunityIcons 
            name={style.icon as any} 
            size={24} 
            color={style.color} 
          />
        </View>
        <View style={styles.alertContent}>
          <Text style={[styles.alertTitle, { color: colors.text }]}>{item.type}</Text>
          <Text style={styles.alertSubtitle}>{`Reported by ${item.senderRole}`}</Text>
          <Text style={styles.alertTime}>{`🕒 ${timeAgo}${distance !== '--' ? ` • ${distance}m away` : ''}`}</Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: '#FEE2E2' }]}>
          <Text style={[styles.statusBadgeText, { color: '#DC2626' }]}>
            {'ACTIVE'}
          </Text>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-down" size={26} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>{'Active Campus Alerts'}</Text>
        <View style={styles.spacer} />
      </View>

      {loading ? (
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" color="#DC2626" />
          <Text style={{ color: colors.textSub, marginTop: 10 }}>{'Fetching active alerts...'}</Text>
        </View>
      ) : (alerts || []).length === 0 ? (
        <View style={styles.centerContent}>
          <Ionicons name="shield-checkmark-outline" size={60} color={colors.border} />
          <Text style={[styles.emptyTitle, { color: colors.text }]}>{'All Clear'}</Text>
          <Text style={{ color: colors.textSub, textAlign: 'center', marginTop: 10 }}>
            {'No active emergencies on record.'}
          </Text>
        </View>
      ) : (
        <FlatList
          data={alerts || []}
          keyExtractor={(item) => item.id}
          renderItem={renderAlertCard}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingBottom: 15, borderBottomWidth: 1, borderBottomColor: 'rgba(0,0,0,0.05)' },
  backButton: { width: 40, height: 40, justifyContent: 'center', alignItems: 'flex-start' },
  headerTitle: { fontSize: 18, fontWeight: 'bold' },
  spacer: { width: 40 },
  listContent: { paddingHorizontal: 20, paddingTop: 15, paddingBottom: 40 },
  centerContent: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 40 },
  emptyTitle: { fontSize: 20, fontWeight: 'bold', marginTop: 15 },
  alertCard: { flexDirection: 'row', alignItems: 'center', padding: 15, borderRadius: 20, marginBottom: 15, elevation: 2, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 5 },
  alertIndicator: { position: 'absolute', left: 0, top: 15, bottom: 15, width: 4, borderTopRightRadius: 2, borderBottomRightRadius: 2 },
  alertIconBg: { width: 45, height: 45, borderRadius: 22.5, justifyContent: 'center', alignItems: 'center', marginRight: 15, marginLeft: 5 },
  alertContent: { flex: 1 },
  alertTitle: { fontSize: 15, fontWeight: 'bold', marginBottom: 3 },
  alertSubtitle: { fontSize: 13, color: '#6B7280', marginBottom: 5, textTransform: 'capitalize' },
  alertTime: { fontSize: 11, color: '#9CA3AF' },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
  statusBadgeText: { fontSize: 9, fontWeight: 'bold', letterSpacing: 0.5 }
});