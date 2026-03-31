import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet, Text, View, FlatList, TouchableOpacity,
  Platform, ActivityIndicator, Modal, ScrollView, TextInput, Image
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons, FontAwesome5 } from '@expo/vector-icons';
import {
  collection, query, orderBy, onSnapshot, deleteDoc, doc, updateDoc, serverTimestamp
} from 'firebase/firestore';
import { db } from '../../firebaseConfig';
import { useTheme } from '../../hooks/ThemeContext';
import { formatDistanceToNow } from 'date-fns';

const ADMIN_ACCENT = '#7C3AED';
const FILTER_CATEGORIES = ['All', 'Medical', 'Fire', 'Security', 'Accident', 'Critical SOS'];
const STATUS_TABS = ['All', 'Active', 'Resolved'];

interface Alert {
  id: string;
  type?: string;
  description?: string;
  locationName?: string;
  location?: { latitude: number; longitude: number };
  mediaUri?: string;
  senderName?: string;
  senderRole?: string;
  status?: string;
  timestamp?: any;
}

const getAlertStyle = (type?: string) => {
  if (type?.includes('Medical')) return { color: '#DC2626', icon: 'heart-pulse', IconFamily: MaterialCommunityIcons };
  if (type?.includes('Fire')) return { color: '#F59E0B', icon: 'fire', IconFamily: MaterialCommunityIcons };
  if (type?.includes('Security')) return { color: '#3B82F6', icon: 'shield-half-full', IconFamily: MaterialCommunityIcons };
  if (type?.includes('Accident')) return { color: '#8B5CF6', icon: 'car-crash', IconFamily: FontAwesome5 };
  if (type?.includes('Critical')) return { color: '#991B1B', icon: 'alert-decagram', IconFamily: MaterialCommunityIcons };
  return { color: '#6B7280', icon: 'alert', IconFamily: Ionicons };
};

export default function AdminAlertsScreen() {
  const { colors, isDarkMode } = useTheme();

  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('All');
  const [activeStatus, setActiveStatus] = useState('All');

  const [deleteTarget, setDeleteTarget] = useState<Alert | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [selectedAlert, setSelectedAlert] = useState<Alert | null>(null);
  const [resolveTarget, setResolveTarget] = useState<Alert | null>(null);
  const [isResolving, setIsResolving] = useState(false);

  const [toastMsg, setToastMsg] = useState('');
  const [showToast, setShowToast] = useState(false);

  useEffect(() => {
    const q = query(collection(db, 'alerts'), orderBy('timestamp', 'desc'));
    const unsub = onSnapshot(q, (snap) => {
      setAlerts(snap.docs.map(d => ({ id: d.id, ...d.data() })) as Alert[]);
      setLoading(false);
    }, () => setLoading(false));
    return () => unsub();
  }, []);

  const showToastMessage = useCallback((msg: string) => {
    setToastMsg(msg);
    setShowToast(true);
    setTimeout(() => setShowToast(false), 2500);
  }, []);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      await deleteDoc(doc(db, 'alerts', deleteTarget.id));
      showToastMessage('Alert deleted successfully.');
    } catch (e) {
      showToastMessage('Failed to delete alert.');
    } finally {
      setIsDeleting(false);
      setDeleteTarget(null);
    }
  };

  const handleResolve = async () => {
    if (!resolveTarget) return;
    setIsResolving(true);
    try {
      await updateDoc(doc(db, 'alerts', resolveTarget.id), {
        status: 'Resolved',
        resolvedAt: serverTimestamp(),
        resolvedBy: 'admin',
      });
      showToastMessage('Alert marked as resolved.');
    } catch (e) {
      showToastMessage('Failed to resolve alert.');
    } finally {
      setIsResolving(false);
      setResolveTarget(null);
    }
  };

  const filteredAlerts = alerts.filter(alert => {
    const status = alert.status || 'Active';
    const isResolved = status !== 'Active';

    const matchesStatus =
      activeStatus === 'All' ? true :
      activeStatus === 'Active' ? !isResolved :
      isResolved;

    const matchesCategory = activeCategory === 'All' ? true : alert.type?.includes(activeCategory);

    const q = searchQuery.toLowerCase();
    const matchesSearch = !q ||
      alert.locationName?.toLowerCase().includes(q) ||
      alert.senderName?.toLowerCase().includes(q) ||
      alert.type?.toLowerCase().includes(q);

    return matchesStatus && matchesCategory && matchesSearch;
  });

  const formatTime = (ts: any) => {
    if (!ts) return 'Just now';
    try { return formatDistanceToNow(ts.toDate(), { addSuffix: true }); } catch { return 'Just now'; }
  };

  const renderAlert = ({ item }: { item: Alert }) => {
    const isResolved = (item.status || 'Active') !== 'Active';
    const { color, icon, IconFamily } = getAlertStyle(item.type);
    const displayColor = isResolved ? '#9CA3AF' : color;

    return (
      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={[styles.cardAccent, { backgroundColor: displayColor }]} />
        <View style={styles.cardBody}>
          {/* Top row */}
          <View style={styles.cardTopRow}>
            <View style={[styles.typeBadge, { backgroundColor: displayColor + '18' }]}>
              <IconFamily name={icon as any} size={11} color={displayColor} style={{ marginRight: 4 }} />
              <Text style={[styles.typeBadgeText, { color: displayColor }]}>
                {item.type?.toUpperCase() || 'UNKNOWN'}
              </Text>
            </View>
            <Text style={[styles.timeText, { color: colors.textSub }]}>{formatTime(item.timestamp)}</Text>
          </View>

          {/* Location & description */}
          <Text style={[styles.locationText, { color: isResolved ? colors.textSub : colors.text }]} numberOfLines={1}>
            {item.locationName?.toUpperCase() || 'UNKNOWN LOCATION'}
          </Text>
          <Text style={[styles.descText, { color: colors.textSub }]} numberOfLines={2}>
            {item.description || 'No description.'}
          </Text>

          {/* Sender */}
          <Text style={[styles.senderText, { color: colors.textSub }]}>
            By: <Text style={{ fontWeight: '700', color: colors.text }}>{item.senderName || 'Anonymous'}</Text>
            {' · '}{item.senderRole?.toUpperCase()}
          </Text>

          {/* Actions */}
          <View style={[styles.cardActions, { borderTopColor: colors.border }]}>
            {/* Status badge */}
            <View style={[styles.statusPill, { backgroundColor: isResolved ? '#D1FAE5' : '#FEE2E2' }]}>
              <View style={[styles.statusDot, { backgroundColor: isResolved ? '#10B981' : '#DC2626' }]} />
              <Text style={[styles.statusPillText, { color: isResolved ? '#10B981' : '#DC2626' }]}>
                {isResolved ? 'RESOLVED' : 'ACTIVE'}
              </Text>
            </View>

            <View style={styles.actionBtns}>
              <TouchableOpacity
                style={styles.actionBtn}
                onPress={() => setSelectedAlert(item)}
              >
                <Ionicons name="eye-outline" size={18} color={ADMIN_ACCENT} />
              </TouchableOpacity>

              {!isResolved && (
                <TouchableOpacity
                  style={[styles.actionBtn, { backgroundColor: '#D1FAE5' }]}
                  onPress={() => setResolveTarget(item)}
                >
                  <Ionicons name="checkmark-circle-outline" size={18} color="#10B981" />
                </TouchableOpacity>
              )}

              <TouchableOpacity
                style={[styles.actionBtn, { backgroundColor: '#FEE2E2' }]}
                onPress={() => setDeleteTarget(item)}
              >
                <Ionicons name="trash-outline" size={18} color="#EF4444" />
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: isDarkMode ? '#0F0F1A' : '#7C3AED' }]}>
        <Text style={styles.headerTitle}>ALERT MANAGER</Text>
        <Text style={styles.headerSub}>{filteredAlerts.length} alerts · Admin View</Text>
      </View>

      {/* Search */}
      <View style={[styles.searchContainer, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Ionicons name="search" size={18} color={colors.textSub} style={{ marginRight: 10 }} />
        <TextInput
          style={[styles.searchInput, { color: colors.text }]}
          placeholder="Search by location, sender, type..."
          placeholderTextColor={colors.textSub}
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => setSearchQuery('')}>
            <Ionicons name="close-circle" size={18} color={colors.textSub} />
          </TouchableOpacity>
        )}
      </View>

      {/* Status Tabs */}
      <View style={[styles.tabRow, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        {STATUS_TABS.map(tab => (
          <TouchableOpacity
            key={tab}
            style={[styles.tabBtn, activeStatus === tab && { borderBottomColor: ADMIN_ACCENT, borderBottomWidth: 2 }]}
            onPress={() => setActiveStatus(tab)}
          >
            <Text style={[styles.tabText, { color: activeStatus === tab ? ADMIN_ACCENT : colors.textSub }]}>
              {tab}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Category Filter Scroll */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll} contentContainerStyle={styles.filterScrollContent}>
        {FILTER_CATEGORIES.map(cat => (
          <TouchableOpacity
            key={cat}
            style={[styles.filterChip, { backgroundColor: activeCategory === cat ? ADMIN_ACCENT : colors.surface, borderColor: activeCategory === cat ? ADMIN_ACCENT : colors.border }]}
            onPress={() => setActiveCategory(cat)}
          >
            <Text style={[styles.filterChipText, { color: activeCategory === cat ? '#FFF' : colors.textSub }]}>
              {cat}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* List */}
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={ADMIN_ACCENT} />
        </View>
      ) : filteredAlerts.length === 0 ? (
        <View style={styles.center}>
          <MaterialCommunityIcons name="bell-off-outline" size={60} color={colors.textSub} style={{ opacity: 0.4 }} />
          <Text style={[styles.emptyText, { color: colors.textSub, marginTop: 12 }]}>No alerts found</Text>
        </View>
      ) : (
        <FlatList
          data={filteredAlerts}
          keyExtractor={item => item.id}
          renderItem={renderAlert}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* Toast */}
      {showToast && (
        <View style={styles.toast}>
          <Ionicons name="checkmark-circle" size={16} color="#FFF" style={{ marginRight: 8 }} />
          <Text style={styles.toastText}>{toastMsg}</Text>
        </View>
      )}

      {/* Delete Confirm Modal */}
      <Modal visible={!!deleteTarget} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalBox, { backgroundColor: isDarkMode ? '#13131F' : '#FFF', borderColor: isDarkMode ? '#2D2D4A' : '#E5E7EB' }]}>
            <View style={[styles.modalIconBg, { backgroundColor: '#2D0A0A' }]}>
              <Ionicons name="trash" size={36} color="#EF4444" />
            </View>
            <Text style={[styles.modalTitle, { color: isDarkMode ? '#FFF' : '#0F0F1A' }]}>Delete Alert?</Text>
            <Text style={[styles.modalMsg, { color: colors.textSub }]}>
              This will permanently remove the <Text style={{ fontWeight: '700', color: isDarkMode ? '#FFF' : '#1F2937' }}>
                {deleteTarget?.type}
              </Text> alert from Firestore. This action cannot be undone.
            </Text>
            <View style={styles.modalBtnRow}>
              <TouchableOpacity
                style={[styles.cancelBtn, { borderColor: colors.border }]}
                onPress={() => setDeleteTarget(null)}
                disabled={isDeleting}
              >
                <Text style={[styles.cancelBtnText, { color: colors.text }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.deleteBtn} onPress={handleDelete} disabled={isDeleting}>
                {isDeleting ? <ActivityIndicator color="#FFF" size="small" /> : <Text style={styles.deleteBtnText}>Delete</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Resolve Confirm Modal */}
      <Modal visible={!!resolveTarget} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalBox, { backgroundColor: isDarkMode ? '#13131F' : '#FFF', borderColor: isDarkMode ? '#2D2D4A' : '#E5E7EB' }]}>
            <View style={[styles.modalIconBg, { backgroundColor: '#0A2D1A' }]}>
              <Ionicons name="checkmark-circle" size={36} color="#10B981" />
            </View>
            <Text style={[styles.modalTitle, { color: isDarkMode ? '#FFF' : '#0F0F1A' }]}>Resolve Alert?</Text>
            <Text style={[styles.modalMsg, { color: colors.textSub }]}>
              Mark this alert as resolved. It will move to the resolved history.
            </Text>
            <View style={styles.modalBtnRow}>
              <TouchableOpacity
                style={[styles.cancelBtn, { borderColor: colors.border }]}
                onPress={() => setResolveTarget(null)}
                disabled={isResolving}
              >
                <Text style={[styles.cancelBtnText, { color: colors.text }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.deleteBtn, { backgroundColor: '#10B981' }]} onPress={handleResolve} disabled={isResolving}>
                {isResolving ? <ActivityIndicator color="#FFF" size="small" /> : <Text style={styles.deleteBtnText}>Confirm</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Details Modal */}
      <Modal visible={!!selectedAlert} animationType="slide" transparent={false} onRequestClose={() => setSelectedAlert(null)}>
        {selectedAlert && (
          <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
            <View style={[styles.detailHeader, { borderBottomColor: colors.border }]}>
              <TouchableOpacity onPress={() => setSelectedAlert(null)}>
                <Ionicons name="chevron-down" size={28} color={colors.text} />
              </TouchableOpacity>
              <Text style={[styles.detailHeaderTitle, { color: colors.text }]}>Alert Details</Text>
              <TouchableOpacity
                style={[styles.detailDeleteBtn]}
                onPress={() => { setSelectedAlert(null); setTimeout(() => setDeleteTarget(selectedAlert), 200); }}
              >
                <Ionicons name="trash-outline" size={20} color="#EF4444" />
              </TouchableOpacity>
            </View>
            <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
              <View style={[styles.detailBadgeRow]}>
                <View style={[styles.typeBadge, { backgroundColor: getAlertStyle(selectedAlert.type).color + '18' }]}>
                  <Text style={[styles.typeBadgeText, { color: getAlertStyle(selectedAlert.type).color }]}>
                    {selectedAlert.type?.toUpperCase() || 'ALERT'}
                  </Text>
                </View>
                <View style={[styles.statusPill, { backgroundColor: (selectedAlert.status || 'Active') !== 'Active' ? '#D1FAE5' : '#FEE2E2' }]}>
                  <Text style={[styles.statusPillText, { color: (selectedAlert.status || 'Active') !== 'Active' ? '#10B981' : '#DC2626' }]}>
                    {(selectedAlert.status || 'ACTIVE').toUpperCase()}
                  </Text>
                </View>
              </View>

              <Text style={[styles.detailLocation, { color: colors.text }]}>
                {selectedAlert.locationName?.toUpperCase() || 'UNKNOWN LOCATION'}
              </Text>

              <Text style={[styles.detailSectionLabel, { color: colors.textSub }]}>DESCRIPTION</Text>
              <Text style={[styles.detailDesc, { color: colors.text }]}>
                {selectedAlert.description || 'No description provided.'}
              </Text>

              <View style={[styles.detailInfoCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                {[
                  { label: 'SENDER', value: selectedAlert.senderName || 'Anonymous' },
                  { label: 'ROLE', value: selectedAlert.senderRole?.toUpperCase() || 'USER' },
                  { label: 'ALERT ID', value: selectedAlert.id },
                  { label: 'GPS', value: selectedAlert.location ? `${selectedAlert.location.latitude.toFixed(5)}, ${selectedAlert.location.longitude.toFixed(5)}` : 'N/A' },
                ].map((row, i) => (
                  <View key={i} style={[styles.detailInfoRow, i < 3 && { borderBottomColor: colors.border, borderBottomWidth: 1 }]}>
                    <Text style={[styles.detailInfoLabel, { color: colors.textSub }]}>{row.label}</Text>
                    <Text style={[styles.detailInfoValue, { color: colors.text }]} numberOfLines={1}>{row.value}</Text>
                  </View>
                ))}
              </View>

              {selectedAlert.mediaUri && (
                <Image source={{ uri: selectedAlert.mediaUri }} style={styles.detailImage} resizeMode="cover" />
              )}
            </ScrollView>
          </SafeAreaView>
        )}
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  header: {
    paddingTop: Platform.OS === 'android' ? 16 : 8,
    paddingHorizontal: 20,
    paddingBottom: 18,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: '#FFF',
    letterSpacing: 1,
  },
  headerSub: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.65)',
    marginTop: 4,
    fontWeight: '500',
  },

  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginTop: 14,
    marginBottom: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1,
  },
  searchInput: { flex: 1, fontSize: 15, fontWeight: '500' },

  tabRow: {
    flexDirection: 'row',
    marginHorizontal: 16,
    borderRadius: 12,
    borderBottomWidth: 1,
    marginBottom: 8,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
  },
  tabText: { fontSize: 13, fontWeight: '700' },

  filterScroll: { maxHeight: 48 },
  filterScrollContent: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    gap: 8,
    flexDirection: 'row',
  },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 100,
    borderWidth: 1,
  },
  filterChipText: { fontSize: 12, fontWeight: '700' },

  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyText: { fontSize: 15, fontWeight: '600' },
  listContent: { padding: 16, paddingBottom: 100 },

  card: {
    flexDirection: 'row',
    borderRadius: 14,
    marginBottom: 12,
    borderWidth: 1,
    overflow: 'hidden',
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 6,
  },
  cardAccent: { width: 4 },
  cardBody: { flex: 1, padding: 14 },
  cardTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  typeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 100,
  },
  typeBadgeText: { fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },
  timeText: { fontSize: 11, fontWeight: '500' },
  locationText: { fontSize: 15, fontWeight: '800', marginBottom: 4 },
  descText: { fontSize: 13, lineHeight: 19, marginBottom: 8 },
  senderText: { fontSize: 12, marginBottom: 10 },

  cardActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 10,
    borderTopWidth: 1,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 100,
    gap: 5,
  },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusPillText: { fontSize: 9, fontWeight: '800', letterSpacing: 1 },
  actionBtns: { flexDirection: 'row', gap: 8 },
  actionBtn: {
    width: 34,
    height: 34,
    borderRadius: 9,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(124,58,237,0.1)',
  },

  toast: {
    position: 'absolute',
    bottom: 100,
    left: 24,
    right: 24,
    backgroundColor: '#1F2937',
    borderRadius: 14,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    elevation: 10,
  },
  toastText: { color: '#FFF', fontSize: 14, fontWeight: '600' },

  // Detail Modal
  detailHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
  },
  detailHeaderTitle: { fontSize: 18, fontWeight: '700' },
  detailDeleteBtn: { padding: 6 },
  detailBadgeRow: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  detailLocation: { fontSize: 22, fontWeight: '900', marginBottom: 20 },
  detailSectionLabel: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.5,
    marginBottom: 8,
  },
  detailDesc: { fontSize: 15, lineHeight: 24, marginBottom: 24 },
  detailInfoCard: {
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 20,
    overflow: 'hidden',
  },
  detailInfoRow: { flexDirection: 'row', justifyContent: 'space-between', padding: 14 },
  detailInfoLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 0.5 },
  detailInfoValue: { fontSize: 13, fontWeight: '600', maxWidth: '60%', textAlign: 'right' },
  detailImage: { width: '100%', height: 200, borderRadius: 14, marginTop: 8 },

  // Confirm Modal
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
  modalIconBg: { width: 72, height: 72, borderRadius: 36, justifyContent: 'center', alignItems: 'center', marginBottom: 20 },
  modalTitle: { fontSize: 20, fontWeight: '800', marginBottom: 10 },
  modalMsg: { fontSize: 14, lineHeight: 22, textAlign: 'center', marginBottom: 28 },
  modalBtnRow: { flexDirection: 'row', width: '100%', gap: 12 },
  cancelBtn: { flex: 1, paddingVertical: 14, borderRadius: 14, alignItems: 'center', borderWidth: 1 },
  cancelBtnText: { fontSize: 15, fontWeight: '600' },
  deleteBtn: { flex: 1, paddingVertical: 14, borderRadius: 14, alignItems: 'center', backgroundColor: '#EF4444' },
  deleteBtnText: { color: '#FFF', fontSize: 15, fontWeight: '700' },
});
