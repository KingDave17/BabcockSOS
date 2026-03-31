import React, { useEffect, useState } from 'react';
import { 
  StyleSheet, Text, View, ScrollView, Platform, TouchableOpacity, Linking 
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore';
import { db } from '../../firebaseConfig';
import { useTheme } from '../../hooks/ThemeContext';
import { useAuth } from '../../hooks/AuthContext';

// --- HELPER FUNCTIONS ---
const getSafeDate = (timestamp: any) => {
  if (!timestamp) return new Date();
  if (typeof timestamp.toDate === 'function') return timestamp.toDate();
  if (timestamp.seconds) return new Date(timestamp.seconds * 1000);
  return new Date(timestamp);
};

const getTimeAgo = (timestamp: any) => {
  if (!timestamp) return '--';
  const date = getSafeDate(timestamp);
  const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000);
  if (seconds < 60) return 'Just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
};


const getAlertStyling = (type: string, isDarkMode: boolean) => {
  if (type.includes('Medical')) return { icon: 'medical-bag', color: '#DC2626', bg: isDarkMode ? '#1A0000' : '#FEE2E2', cardAccent: '#DC2626' };
  if (type.includes('Fire')) return { icon: 'fire', color: '#F59E0B', bg: isDarkMode ? '#1A1100' : '#FEF3C7', cardAccent: '#F59E0B' };
  if (type.includes('Security')) return { icon: 'shield-alert', color: '#3B82F6', bg: isDarkMode ? '#00081A' : '#DBEAFE', cardAccent: '#3B82F6' };
  if (type.includes('Accident')) return { icon: 'car-brake-alert', color: '#8B5CF6', bg: isDarkMode ? '#0D001A' : '#EDE9FE', cardAccent: '#8B5CF6' };
  return { icon: 'alert-octagram', color: '#DC2626', bg: isDarkMode ? '#1A0000' : '#FEE2E2', cardAccent: '#DC2626' }; 
};

export default function HistoryScreen() {
  const { colors, isDarkMode } = useTheme();
  const { profile } = useAuth();
  const [resolvedAlerts, setResolvedAlerts] = useState<any[]>([]);

  useEffect(() => {
    // Listen for RESOLVED emergencies, ordered by newest first
    const q = query(collection(db, 'alerts'), orderBy('timestamp', 'desc'));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      let alerts: any[] = snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() }))
        // Filter specifically for resolved status
        .filter((alert: any) => alert.status === 'Resolved' || alert.status === 'Resolved - User Canceled');

      // Strictly filter logs by role so each team only sees their own resolved cases
      if (profile?.role === 'medical') {
        alerts = alerts.filter((a: any) => a.type?.includes('Medical') || a.type?.includes('Accident'));
      } else if (profile?.role === 'security') {
        alerts = alerts.filter((a: any) => a.type?.includes('Security'));
      } else if (profile?.role === 'fire') {
        alerts = alerts.filter((a: any) => a.type?.includes('Fire'));
      }

      setResolvedAlerts(alerts);
    });

    return () => unsubscribe();
  }, [profile?.role]);

 
  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      
      {/* PREMIUM HEADER */}
      <View style={styles.premiumStaffHeader}>
        <View>
          <Text style={[styles.premiumRoleSub, { color: isDarkMode ? '#EFF6FF' : '#3B82F6' }]}>ARCHIVE</Text>
          <Text style={[styles.premiumOfficerName, { color: colors.text }]}>Incident Logs</Text>
        </View>
        <View style={[styles.premiumActionBtn, { backgroundColor: isDarkMode ? colors.surface : '#FFF', borderColor: colors.border, borderWidth: isDarkMode ? 1 : 0 }]}>
          <MaterialCommunityIcons name="clipboard-check-outline" size={24} color={isDarkMode ? '#10B981' : '#059669'} />
        </View>
      </View>

      <View style={styles.premiumSectionHeaderRow}>
        <Text style={[styles.premiumSectionTitle, { color: colors.text }]}>Resolved Cases</Text>
        <View style={[styles.premiumBadgePill, { backgroundColor: isDarkMode ? '#003A2D' : '#D1FAE5' }]}>
          <Text style={[styles.premiumBadgeText, { color: '#10B981' }]}>{(resolvedAlerts || []).length} CLOSED</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 100 }} showsVerticalScrollIndicator={false}>
        {(resolvedAlerts || []).length === 0 ? (
          <View style={[styles.premiumEmptyCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <MaterialCommunityIcons name="clipboard-text-off-outline" size={80} color={colors.textSub} style={{ opacity: 0.2, marginBottom: 20 }} />
            <Text style={{ color: colors.text, fontSize: 18, fontWeight: 'bold', marginBottom: 10 }}>No Records</Text>
            <Text style={{ color: colors.textSub, textAlign: 'center' }}>
              Your resolved incident history is currently empty.
            </Text>
          </View>
        ) : (
          resolvedAlerts.map((alert) => {
            const style = getAlertStyling(alert.type, isDarkMode);
            const timeAgo = getTimeAgo(alert.timestamp);

            return (
              <View key={alert.id} style={[styles.premiumIncidentCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                {/* Desaturated left accent to indicate it is resolved */}
<View style={[styles.premiumCardAccent, { backgroundColor: isDarkMode ? '#374151' : '#D1D5DB' }]} />
                
                <View style={styles.premiumCardContent}>
                  
                  <View style={styles.premiumIncidentMeta}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <View style={[styles.premiumAlertIconBg, { backgroundColor: isDarkMode ? '#1F2937' : '#F3F4F6' }]}>
                          <MaterialCommunityIcons name={style.icon as any} size={22} color={isDarkMode ? '#9CA3AF' : '#6B7280'} />
                        </View>
                        <View>
                          <Text style={[styles.premiumAlertLabel, { color: colors.text }]}>{alert.type}</Text>
                          <Text style={[styles.premiumAlertMetaText, { color: colors.textSub }]}>Occurred {timeAgo}</Text>
                        </View>
                      </View>
                      
                      {/* Green Resolved Badge */}
                      <View style={[styles.premiumUrgentBadge, { backgroundColor: isDarkMode ? '#064E3B' : '#D1FAE5' }]}>
                        <Text style={[styles.premiumUrgentBadgeText, { color: isDarkMode ? '#34D399' : '#059669' }]}>RESOLVED</Text>
                      </View>
                    </View>
                  </View>

                  <View style={styles.premiumstructuredDetails}>
                    <View style={{ flex: 1, marginRight: 15 }}>
                      <Text style={[styles.premiumGruppeTitle, { color: colors.textSub }]}>SENDER</Text>
                      <Text style={[styles.premiumGruppeContent, { color: colors.text }]}>{alert.senderName}</Text>
                      <Text style={[styles.premiumGruppeSub, { color: colors.textSub }]}>({alert.senderRole})</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.premiumGruppeTitle, { color: colors.textSub }]}>LOCATION</Text>
                      <Text style={[styles.premiumGruppeContent, { color: colors.text }]}>{alert.locationName}</Text>
                    </View>
                  </View>

                  {alert.description && (
                    <View style={[styles.premiumInternalDescriptionContainer, { backgroundColor: isDarkMode ? '#111827' : '#F9FAFB', borderColor: colors.border }]}>
                      <Text style={[styles.premiumDescriptionText, { color: colors.textSub }]}>
                        &quot;{alert.description}&quot;
                      </Text>
                    </View>
                  )}

                  {/* Historic Evidence links */}
                  {(alert.audioUrl || alert.mediaUrl) && (
                    <View style={styles.premiumEvidenceButtonRow}>
                      {alert.audioUrl && (
                        <TouchableOpacity 
                          style={[styles.premiumTactileBtn, { backgroundColor: isDarkMode ? '#1F2937' : '#FFF', borderColor: colors.border, borderWidth: 1 }]}
                          onPress={() => Linking.openURL(alert.audioUrl)}
                        >
                          <MaterialCommunityIcons name="waveform" size={18} color="#8B5CF6" />
                          <Text style={[styles.premiumTactileBtnText, { color: '#8B5CF6' }]}>Archive Audio</Text>
                        </TouchableOpacity>
                      )}
                      {alert.mediaUrl && (
                        <TouchableOpacity 
                          style={[styles.premiumTactileBtn, { backgroundColor: isDarkMode ? '#1F2937' : '#FFF', borderColor: colors.border, borderWidth: 1 }]}
                          onPress={() => Linking.openURL(alert.mediaUrl)}
                        >
                          <Ionicons name="image" size={18} color="#3B82F6" />
                          <Text style={[styles.premiumTactileBtnText, { color: '#3B82F6' }]}>Archive Photo</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  )}
                  
                </View>
              </View>
            );
          })
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  premiumStaffHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: Platform.OS === 'android' ? 10 : 0, paddingHorizontal: 20, marginBottom: 25 },
  premiumRoleSub: { fontSize: 11, fontWeight: '900', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 3 },
  premiumOfficerName: { fontSize: 26, fontWeight: '900' },
  premiumActionBtn: { width: 45, height: 45, borderRadius: 22.5, justifyContent: 'center', alignItems: 'center', elevation: 2, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 4 },
  premiumSectionHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, marginBottom: 15 },
  premiumSectionTitle: { fontSize: 18, fontWeight: 'bold' },
  premiumBadgePill: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20 },
  premiumBadgeText: { fontSize: 11, fontWeight: 'bold', letterSpacing: 0.5 },
  premiumEmptyCard: { padding: 40, borderRadius: 20, alignItems: 'center', borderWidth: 1, borderStyle: 'dashed' },
  
  premiumIncidentCard: { borderRadius: 20, marginBottom: 20, overflow: 'hidden', borderWidth: 1 },
  premiumCardAccent: { position: 'absolute', top: 0, left: 0, width: 6, bottom: 0, borderTopRightRadius: 3, borderBottomRightRadius: 3, zIndex: 10 },
  premiumCardContent: { padding: 20, paddingLeft: 24 },
  premiumIncidentMeta: { marginBottom: 15 },
  premiumAlertIconBg: { width: 36, height: 36, borderRadius: 10, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  premiumAlertLabel: { fontSize: 16, fontWeight: 'bold', marginBottom: 2 },
  premiumAlertMetaText: { fontSize: 12 },
  premiumUrgentBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6 },
  premiumUrgentBadgeText: { fontSize: 10, fontWeight: '900', letterSpacing: 0.5 },
  premiumstructuredDetails: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 },
  premiumGruppeTitle: { fontSize: 10, fontWeight: 'bold', letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 5 },
  premiumGruppeContent: { fontSize: 14, fontWeight: '700' },
  premiumGruppeSub: { fontSize: 12, fontStyle: 'italic', marginTop: 1 },
  premiumInternalDescriptionContainer: { borderRadius: 12, padding: 15, marginBottom: 20, borderWidth: 1 },
  premiumDescriptionText: { fontSize: 14, fontStyle: 'italic', lineHeight: 21 },
  premiumEvidenceButtonRow: { flexDirection: 'row', marginTop: 5, gap: 12 },
  premiumTactileBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 12, borderRadius: 12 },
  premiumTactileBtnText: { marginLeft: 8, fontSize: 13, fontWeight: 'bold' }
});