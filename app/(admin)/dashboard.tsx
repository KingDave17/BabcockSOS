import React, { useState, useEffect } from 'react';
import {
  StyleSheet, Text, View, ScrollView, TouchableOpacity,
  Platform, ActivityIndicator, Modal, TextInput
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { 
  collection, query, orderBy, limit, onSnapshot, getCountFromServer, 
  addDoc, serverTimestamp 
} from 'firebase/firestore';
import { signOut } from 'firebase/auth';
import { auth, db } from '../../firebaseConfig';
import { useTheme } from '../../hooks/ThemeContext';
import { useAuth } from '../../hooks/AuthContext';
import { formatDistanceToNow } from 'date-fns';

const ADMIN_ACCENT = '#7C3AED';
const STATS_PALETTE = ['#7C3AED', '#DC2626', '#10B981', '#3B82F6'];

interface StatCard {
  label: string;
  value: string | number;
  icon: string;
  color: string;
  sub?: string;
}

function StatCardComponent({ label, value, icon, color, sub }: StatCard) {
  const { colors, isDarkMode } = useTheme();
  return (
    <View style={[styles.statCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={[styles.statIconRing, { backgroundColor: color + '18' }]}>
        <MaterialCommunityIcons name={icon as any} size={22} color={color} />
      </View>
      <Text style={[styles.statValue, { color: colors.text }]}>{value}</Text>
      <Text style={[styles.statLabel, { color: colors.textSub }]}>{label}</Text>
      {sub && <Text style={[styles.statSub, { color: color }]}>{sub}</Text>}
    </View>
  );
}

export default function AdminDashboard() {
  const { colors, isDarkMode } = useTheme();
  const { profile, user } = useAuth();

  const [recentAlerts, setRecentAlerts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [showBroadcastModal, setShowBroadcastModal] = useState(false);

  // Broadcast state
  const [broadcastData, setBroadcastData] = useState({
    title: '',
    message: '',
    type: 'Emergency' as 'Emergency' | 'General' | 'Security Update'
  });
  const [sending, setSending] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);

  const [stats, setStats] = useState({
    totalAlerts: 0,
    activeAlerts: 0,
    resolvedAlerts: 0,
    totalUsers: 0,
  });

  useEffect(() => {
    // Real-time listener for all alerts
    const alertsQuery = query(collection(db, 'alerts'), orderBy('timestamp', 'desc'));
    const unsubAlerts = onSnapshot(alertsQuery, (snapshot) => {
      const allAlerts = snapshot.docs.map(d => ({ id: d.id, ...d.data() })) as any[];
      const active = (allAlerts || []).filter(a => (a?.status || 'Active') === 'Active').length;
      const resolved = (allAlerts || []).filter(a => (a?.status || 'Active') !== 'Active').length;

      setStats(prev => ({
        ...prev,
        totalAlerts: (allAlerts || []).length,
        activeAlerts: active,
        resolvedAlerts: resolved,
      }));

      setRecentAlerts((allAlerts || []).slice(0, 6));
      setLoading(false);
    }, () => setLoading(false));

    // One-time count for users
    const fetchUserCount = async () => {
      try {
        const usersCol = collection(db, 'users');
        const snap = await getCountFromServer(usersCol);
        setStats(prev => ({ ...prev, totalUsers: snap.data().count }));
      } catch {
        // getCountFromServer may not be available in older SDKs
        const unsubUsers = onSnapshot(collection(db, 'users'), (snap) => {
          setStats(prev => ({ ...prev, totalUsers: (snap.docs || []).length }));
        });
        return unsubUsers;
      }
    };
    fetchUserCount();

    return () => unsubAlerts();
  }, []);

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (e) {
      console.error('Logout error:', e);
    }
  };

  const handleSendBroadcast = async () => {
    if (!broadcastData.title || !broadcastData.message) return;
    setSending(true);
    try {
      await addDoc(collection(db, 'broadcasts'), {
        ...broadcastData,
        senderId: user?.uid,
        senderName: displayName,
        timestamp: serverTimestamp(),
      });
      setShowBroadcastModal(false);
      setBroadcastData({ title: '', message: '', type: 'Emergency' });
      setShowSuccessModal(true);
    } catch (e) {
      console.error('Broadcast error:', e);
    } finally {
      setSending(false);
    }
  };

  const formatTime = (timestamp: any) => {
    if (!timestamp) return 'Just now';
    try {
      return formatDistanceToNow(timestamp.toDate(), { addSuffix: true });
    } catch {
      return 'Just now';
    }
  };

  const getAlertColor = (type?: string) => {
    if (type?.includes('Medical')) return '#DC2626';
    if (type?.includes('Fire')) return '#F59E0B';
    if (type?.includes('Security')) return '#3B82F6';
    if (type?.includes('Accident')) return '#8B5CF6';
    return '#EF4444';
  };

  const displayName = profile?.firstName
    ? `${profile.firstName} ${profile.lastName || ''}`
    : user?.email || 'Administrator';

  const statCards: StatCard[] = [
    { label: 'Total Alerts', value: stats.totalAlerts, icon: 'bell-ring', color: STATS_PALETTE[0] },
    { label: 'Active Now', value: stats.activeAlerts, icon: 'alert-octagram', color: STATS_PALETTE[1], sub: stats.activeAlerts > 0 ? 'LIVE' : 'CLEAR' },
    { label: 'Resolved', value: stats.resolvedAlerts, icon: 'check-circle', color: STATS_PALETTE[2] },
    { label: 'Total Users', value: stats.totalUsers, icon: 'account-group', color: STATS_PALETTE[3] },
  ];

  return (
    <View style={[styles.container, { backgroundColor: isDarkMode ? '#0F0F1A' : '#F0F0FF' }]}>
      {/* Decorative top gradient-like bar */}
      <View style={styles.headerGradientBar} />

      <SafeAreaView style={styles.safeArea} edges={['top']}>
        {/* Top Header */}
        <View style={[styles.header, { backgroundColor: 'transparent' }]}>
          <View>
            <Text style={[styles.headerSub, { color: ADMIN_ACCENT }]}>ADMIN CONTROL CENTER</Text>
            <Text style={[styles.headerName, { color: isDarkMode ? '#FFF' : '#0F0F1A' }]}>
              {displayName.split(' ')?.[0]}
            </Text>
          </View>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <TouchableOpacity
              style={[styles.logoutBtn, { backgroundColor: isDarkMode ? '#1A1A2E' : '#FFF', borderColor: isDarkMode ? '#2D2D4A' : '#E5E7EB' }]}
              onPress={() => setShowBroadcastModal(true)}
            >
              <MaterialCommunityIcons name="bullhorn-outline" size={22} color={ADMIN_ACCENT} />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.logoutBtn, { backgroundColor: isDarkMode ? '#1A1A2E' : '#FFF', borderColor: isDarkMode ? '#2D2D4A' : '#E5E7EB' }]}
              onPress={() => setShowLogoutModal(true)}
            >
              <Ionicons name="log-out-outline" size={22} color="#EF4444" />
            </TouchableOpacity>
          </View>
        </View>

        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {/* Welcome Card */}
          <View style={[styles.welcomeCard, { backgroundColor: isDarkMode ? '#1A0A2E' : '#7C3AED' }]}>
            <View>
              <Text style={styles.welcomeTitle}>System Overview</Text>
              <Text style={styles.welcomeSub}>All units monitored • Real-time data</Text>
            </View>
            <View style={styles.welcomeIconContainer}>
              <MaterialCommunityIcons name="shield-crown" size={52} color="rgba(255,255,255,0.2)" />
            </View>
          </View>

          {/* Stat Cards Grid */}
          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={ADMIN_ACCENT} />
            </View>
          ) : (
            <View style={styles.statsGrid}>
              {statCards.map((card, i) => (
                <StatCardComponent key={i} {...card} />
              ))}
            </View>
          )}

          {/* Recent Activity */}
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: isDarkMode ? '#FFF' : '#0F0F1A' }]}>Recent Activity</Text>
            <View style={[styles.livePill, { backgroundColor: stats.activeAlerts > 0 ? '#FEE2E2' : '#D1FAE5' }]}>
              <View style={[styles.liveDot, { backgroundColor: stats.activeAlerts > 0 ? '#DC2626' : '#10B981' }]} />
              <Text style={[styles.liveText, { color: stats.activeAlerts > 0 ? '#DC2626' : '#10B981' }]}>
                {stats.activeAlerts > 0 ? 'ACTIVE' : 'ALL CLEAR'}
              </Text>
            </View>
          </View>

          {(recentAlerts || []).length === 0 ? (
            <View style={[styles.emptyCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <MaterialCommunityIcons name="shield-check" size={48} color={colors.textSub} style={{ opacity: 0.3 }} />
              <Text style={[styles.emptyText, { color: colors.textSub }]}>No alerts recorded yet</Text>
            </View>
          ) : (
            recentAlerts.map((alert) => {
              const isResolved = (alert.status || 'Active') !== 'Active';
              const alertColor = isResolved ? '#9CA3AF' : getAlertColor(alert.type);
              return (
                <View key={alert.id} style={[styles.activityCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                  <View style={[styles.activityAccent, { backgroundColor: alertColor }]} />
                  <View style={styles.activityContent}>
                    <View style={styles.activityRow}>
                      <Text style={[styles.activityType, { color: alertColor }]} numberOfLines={1}>
                        {alert.type || 'Unknown'}
                      </Text>
                      <View style={[styles.statusBadge, { backgroundColor: isResolved ? '#D1FAE5' : '#FEE2E2' }]}>
                        <Text style={[styles.statusText, { color: isResolved ? '#10B981' : '#DC2626' }]}>
                          {isResolved ? 'RESOLVED' : 'ACTIVE'}
                        </Text>
                      </View>
                    </View>
                    <Text style={[styles.activityLocation, { color: isDarkMode ? '#E5E7EB' : '#1F2937' }]} numberOfLines={1}>
                      {alert.locationName || 'Unknown Location'}
                    </Text>
                    <View style={styles.activityMeta}>
                      <Text style={[styles.activityMetaText, { color: colors.textSub }]}>
                        {alert.senderName || 'Anonymous'} · {formatTime(alert.timestamp)}
                      </Text>
                    </View>
                  </View>
                </View>
              );
            })
          )}

          {/* System Status Card */}
          <View style={[styles.systemCard, { backgroundColor: isDarkMode ? '#0A0A1A' : '#FFF', borderColor: isDarkMode ? '#1A1A2E' : '#E5E7EB' }]}>
            <Text style={[styles.systemCardTitle, { color: isDarkMode ? '#A78BFA' : ADMIN_ACCENT }]}>
              SYSTEM STATUS
            </Text>
            {[
              { label: 'Firebase Auth', status: 'Operational', ok: true },
              { label: 'Firestore DB', status: 'Operational', ok: true },
              { label: 'Push Notifications', status: 'Operational', ok: true },
              { label: 'Alert Broadcast', status: 'Active', ok: stats.activeAlerts > 0 },
            ].map((item, i) => (
              <View key={i} style={[styles.systemRow, { borderBottomColor: colors.border }]}>
                <Text style={[styles.systemLabel, { color: colors.textSub }]}>{item.label}</Text>
                <View style={styles.systemStatusRight}>
                  <View style={[styles.systemDot, { backgroundColor: item.ok ? '#10B981' : '#F59E0B' }]} />
                  <Text style={[styles.systemStatus, { color: item.ok ? '#10B981' : '#F59E0B' }]}>{item.status}</Text>
                </View>
              </View>
            ))}
          </View>

        </ScrollView>
      </SafeAreaView>

      {/* Logout Confirm Modal */}
      <Modal visible={showLogoutModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalBox, { backgroundColor: isDarkMode ? '#13131F' : '#FFF', borderColor: isDarkMode ? '#2D2D4A' : '#E5E7EB' }]}>
            <View style={[styles.modalIconBg, { backgroundColor: '#2D0A0A' }]}>
              <Ionicons name="log-out-outline" size={36} color="#EF4444" />
            </View>
            <Text style={[styles.modalTitle, { color: isDarkMode ? '#FFF' : '#0F0F1A' }]}>Logout Admin?</Text>
            <Text style={[styles.modalMsg, { color: colors.textSub }]}>
              You will be signed out of the admin control center.
            </Text>
            <View style={styles.modalBtnRow}>
              <TouchableOpacity
                style={[styles.modalCancelBtn, { borderColor: colors.border }]}
                onPress={() => setShowLogoutModal(false)}
              >
                <Text style={[styles.modalCancelText, { color: colors.text }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalConfirmBtn} onPress={handleLogout}>
                <Text style={styles.modalConfirmText}>Logout</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Broadcast Modal */}
      <Modal visible={showBroadcastModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalBox, { backgroundColor: isDarkMode ? '#13131F' : '#FFF', borderColor: isDarkMode ? '#2D2D4A' : '#E5E7EB', maxWidth: 400 }]}>
            <View style={[styles.modalIconBg, { backgroundColor: ADMIN_ACCENT + '20' }]}>
              <MaterialCommunityIcons name="bullhorn" size={36} color={ADMIN_ACCENT} />
            </View>
            <Text style={[styles.modalTitle, { color: isDarkMode ? '#FFF' : '#0F0F1A' }]}>Send Campus Broadcast</Text>
            
            <View style={{ width: '100%', marginBottom: 20 }}>
              <Text style={{ color: colors.textSub, fontSize: 12, fontWeight: '700', marginBottom: 8 }}>BROADCAST TYPE</Text>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                {['Emergency', 'General', 'Security Update'].map((t) => (
                  <TouchableOpacity 
                    key={t}
                    onPress={() => setBroadcastData({ ...broadcastData, type: t as any })}
                    style={[
                      { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10, borderWidth: 1 },
                      broadcastData.type === t ? { backgroundColor: ADMIN_ACCENT, borderColor: ADMIN_ACCENT } : { borderColor: colors.border }
                    ]}
                  >
                    <Text style={{ fontSize: 10, fontWeight: '700', color: broadcastData.type === t ? '#FFF' : colors.textSub }}>{t.toUpperCase()}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={{ width: '100%', gap: 12 }}>
              <View>
                <Text style={{ color: colors.textSub, fontSize: 11, fontWeight: '700', marginBottom: 5 }}>TITLE</Text>
                <View style={{ backgroundColor: isDarkMode ? '#000' : '#F9FAFB', borderRadius: 10, borderWidth: 1, borderColor: colors.border }}>
                  <TextInput
                    placeholder="e.g., Mandatory Hall Meeting"
                    placeholderTextColor="#6B7280"
                    style={{ padding: 12, color: colors.text, fontWeight: '600' }}
                    value={broadcastData.title}
                    onChangeText={(t: string) => setBroadcastData({ ...broadcastData, title: t })}
                  />
                </View>
              </View>

              <View>
                <Text style={{ color: colors.textSub, fontSize: 11, fontWeight: '700', marginBottom: 5 }}>MESSAGE</Text>
                <View style={{ backgroundColor: isDarkMode ? '#000' : '#F9FAFB', borderRadius: 10, borderWidth: 1, borderColor: colors.border }}>
                  <TextInput
                    placeholder="Provide details of the announcement..."
                    placeholderTextColor="#6B7280"
                    multiline
                    numberOfLines={4}
                    style={{ padding: 12, color: colors.text, minHeight: 100, textAlignVertical: 'top' }}
                    value={broadcastData.message}
                    onChangeText={(t: string) => setBroadcastData({ ...broadcastData, message: t })}
                  />
                </View>
              </View>
            </View>

            <View style={[styles.modalBtnRow, { marginTop: 28 }]}>
              <TouchableOpacity
                style={[styles.modalCancelBtn, { borderColor: colors.border }]}
                onPress={() => setShowBroadcastModal(false)}
              >
                <Text style={[styles.modalCancelText, { color: colors.text }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.modalConfirmBtn, { backgroundColor: broadcastData.type === 'Emergency' ? '#DC2626' : ADMIN_ACCENT }]} 
                onPress={handleSendBroadcast}
                disabled={sending}
              >
                {sending ? <ActivityIndicator color="#FFF" size="small" /> : <Text style={styles.modalConfirmText}>Push Alert</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Success Modal */}
      <Modal visible={showSuccessModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalBox, { backgroundColor: isDarkMode ? '#13131F' : '#FFF', borderColor: isDarkMode ? '#2D2D4A' : '#E5E7EB' }]}>
            <View style={[styles.modalIconBg, { backgroundColor: '#10B98120' }]}>
              <Ionicons name="checkmark-circle" size={48} color="#10B981" />
            </View>
            <Text style={[styles.modalTitle, { color: isDarkMode ? '#FFF' : '#0F0F1A' }]}>Broadcast Sent!</Text>
            <Text style={[styles.modalMsg, { color: colors.textSub }]}>
              Your announcement has been pushed to all active devices on campus.
            </Text>
            <TouchableOpacity 
              style={[styles.modalConfirmBtn, { backgroundColor: '#10B981', width: '100%', flex: 0 }]} 
              onPress={() => setShowSuccessModal(false)}
            >
              <Text style={styles.modalConfirmText}>Great</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1 },
  headerGradientBar: {
    position: 'absolute',
    top: 0, left: 0, right: 0,
    height: 200,
    backgroundColor: '#7C3AED',
    opacity: 0.07,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  headerSub: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 2,
    marginBottom: 4,
  },
  headerName: {
    fontSize: 26,
    fontWeight: '900',
  },
  logoutBtn: {
    width: 46,
    height: 46,
    borderRadius: 23,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },

  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 100,
  },

  welcomeCard: {
    borderRadius: 20,
    padding: 22,
    marginBottom: 24,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    overflow: 'hidden',
  },
  welcomeTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#FFF',
    marginBottom: 6,
  },
  welcomeSub: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.65)',
    fontWeight: '500',
  },
  welcomeIconContainer: {
    opacity: 1,
  },

  loadingContainer: {
    paddingVertical: 40,
    alignItems: 'center',
  },

  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  statCard: {
    width: '48%',
    borderRadius: 16,
    padding: 18,
    marginBottom: 14,
    borderWidth: 1,
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
  },
  statIconRing: {
    width: 42,
    height: 42,
    borderRadius: 21,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  statValue: {
    fontSize: 30,
    fontWeight: '900',
    letterSpacing: -1,
  },
  statLabel: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  statSub: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.5,
    marginTop: 4,
  },

  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '800',
  },
  livePill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 100,
    gap: 6,
  },
  liveDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  liveText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
  },

  emptyCard: {
    borderRadius: 16,
    padding: 32,
    alignItems: 'center',
    borderWidth: 1,
    marginBottom: 16,
    gap: 12,
  },
  emptyText: { fontSize: 14, fontWeight: '500' },

  activityCard: {
    flexDirection: 'row',
    borderRadius: 14,
    marginBottom: 10,
    borderWidth: 1,
    overflow: 'hidden',
    elevation: 1,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 4,
  },
  activityAccent: {
    width: 4,
  },
  activityContent: {
    flex: 1,
    padding: 14,
  },
  activityRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  activityType: {
    fontSize: 13,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    flex: 1,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    marginLeft: 8,
  },
  statusText: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1,
  },
  activityLocation: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 4,
  },
  activityMeta: { flexDirection: 'row', alignItems: 'center' },
  activityMetaText: { fontSize: 12, fontWeight: '500' },

  systemCard: {
    borderRadius: 16,
    padding: 18,
    marginTop: 10,
    marginBottom: 16,
    borderWidth: 1,
  },
  systemCardTitle: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 2,
    marginBottom: 14,
  },
  systemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  systemLabel: { fontSize: 14, fontWeight: '500' },
  systemStatusRight: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  systemDot: { width: 8, height: 8, borderRadius: 4 },
  systemStatus: { fontSize: 13, fontWeight: '700' },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalBox: {
    width: '100%',
    maxWidth: 340,
    borderRadius: 24,
    padding: 28,
    alignItems: 'center',
    borderWidth: 1,
  },
  modalIconBg: {
    width: 72,
    height: 72,
    borderRadius: 36,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: { fontSize: 20, fontWeight: '800', marginBottom: 10 },
  modalMsg: { fontSize: 14, lineHeight: 22, textAlign: 'center', marginBottom: 28 },
  modalBtnRow: { flexDirection: 'row', width: '100%', gap: 12 },
  modalCancelBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    borderWidth: 1,
  },
  modalCancelText: { fontSize: 15, fontWeight: '600' },
  modalConfirmBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    backgroundColor: '#EF4444',
  },
  modalConfirmText: { color: '#FFF', fontSize: 15, fontWeight: '700' },
});
