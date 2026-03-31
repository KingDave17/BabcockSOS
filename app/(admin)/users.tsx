import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet, Text, View, FlatList, TouchableOpacity,
  ActivityIndicator, Modal, TextInput, Platform
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { collection, onSnapshot, doc, updateDoc } from 'firebase/firestore';
import { db } from '../../firebaseConfig';
import { useTheme } from '../../hooks/ThemeContext';
import { formatDistanceToNow } from 'date-fns';

const ADMIN_ACCENT = '#7C3AED';

const ROLES = ['student', 'medical', 'security', 'fire', 'admin'];
const ROLE_COLORS: Record<string, string> = {
  student: '#3B82F6',
  medical: '#DC2626',
  security: '#10B981',
  fire: '#F59E0B',
  admin: '#7C3AED',
};
const ROLE_ICONS: Record<string, string> = {
  student: 'school',
  medical: 'medical-bag',
  security: 'shield-check',
  fire: 'fire-truck',
  admin: 'shield-crown',
};

interface UserProfile {
  id: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  role?: string;
  lastActive?: any;
  studentId?: string;
}

export default function AdminUsersScreen() {
  const { colors, isDarkMode } = useTheme();

  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeRoleFilter, setActiveRoleFilter] = useState('All');

  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
  const [pendingRole, setPendingRole] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [showRoleModal, setShowRoleModal] = useState(false);

  const [toastMsg, setToastMsg] = useState('');
  const [showToast, setShowToast] = useState(false);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'users'), (snap) => {
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() })) as UserProfile[];
      // Sort: admins first, then by name
      data.sort((a, b) => {
        if (a.role === 'admin' && b.role !== 'admin') return -1;
        if (b.role === 'admin' && a.role !== 'admin') return 1;
        return (a.firstName || '').localeCompare(b.firstName || '');
      });
      setUsers(data);
      setLoading(false);
    }, () => setLoading(false));
    return () => unsub();
  }, []);

  const showToastMessage = useCallback((msg: string) => {
    setToastMsg(msg);
    setShowToast(true);
    setTimeout(() => setShowToast(false), 2500);
  }, []);

  const openRoleModal = (user: UserProfile) => {
    setSelectedUser(user);
    setPendingRole(user.role || 'student');
    setShowRoleModal(true);
  };

  const handleRoleChange = async () => {
    if (!selectedUser || pendingRole === selectedUser.role) {
      setShowRoleModal(false);
      return;
    }
    setIsSaving(true);
    try {
      await updateDoc(doc(db, 'users', selectedUser.id), { role: pendingRole });
      showToastMessage(`${selectedUser.firstName || 'User'}'s role updated to ${pendingRole}.`);
      setShowRoleModal(false);
    } catch (e) {
      showToastMessage('Failed to update role. Try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const getInitials = (user: UserProfile) => {
    const f = user.firstName?.charAt(0) || '';
    const l = user.lastName?.charAt(0) || user.email?.charAt(0) || '?';
    return `${f}${l}`.toUpperCase();
  };

  const formatLastActive = (ts: any) => {
    if (!ts) return 'Never';
    try {
      const date = ts instanceof Date ? ts : ts.toDate?.() || new Date(ts);
      return formatDistanceToNow(date, { addSuffix: true });
    } catch {
      return 'Unknown';
    }
  };

  const filteredUsers = users.filter(u => {
    const matchesRole = activeRoleFilter === 'All' || u.role === activeRoleFilter.toLowerCase();
    const q = searchQuery.toLowerCase();
    const matchesSearch = !q ||
      u.email?.toLowerCase().includes(q) ||
      u.firstName?.toLowerCase().includes(q) ||
      u.lastName?.toLowerCase().includes(q);
    return matchesRole && matchesSearch;
  });

  const renderUser = ({ item }: { item: UserProfile }) => {
    const role = item.role || 'student';
    const roleColor = ROLE_COLORS[role] || '#6B7280';
    const roleIcon = ROLE_ICONS[role] || 'account';
    const displayName = item.firstName
      ? `${item.firstName} ${item.lastName || ''}`.trim()
      : item.email?.split('@')?.[0] || 'Unknown';
    const isAdmin = role === 'admin';

    return (
      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: isAdmin ? ADMIN_ACCENT + '40' : colors.border }]}>
        {isAdmin && (
          <View style={styles.adminBanner}>
            <MaterialCommunityIcons name="shield-crown" size={11} color="#FFF" />
            <Text style={styles.adminBannerText}>ADMINISTRATOR</Text>
          </View>
        )}
        <View style={styles.cardContent}>
          {/* Avatar */}
          <View style={[styles.avatar, { backgroundColor: roleColor + '22', borderColor: roleColor }]}>
            <Text style={[styles.avatarText, { color: roleColor }]}>{getInitials(item)}</Text>
          </View>

          {/* Info */}
          <View style={styles.cardInfo}>
            <Text style={[styles.userName, { color: colors.text }]} numberOfLines={1}>
              {displayName}
            </Text>
            <Text style={[styles.userEmail, { color: colors.textSub }]} numberOfLines={1}>
              {item.email || 'No email'}
            </Text>
            <View style={styles.metaRow}>
              <View style={[styles.roleBadge, { backgroundColor: roleColor + '18' }]}>
                <MaterialCommunityIcons name={roleIcon as any} size={11} color={roleColor} style={{ marginRight: 4 }} />
                <Text style={[styles.roleBadgeText, { color: roleColor }]}>{role.toUpperCase()}</Text>
              </View>
              <Text style={[styles.lastActive, { color: colors.textSub }]}>
                Active {formatLastActive(item.lastActive)}
              </Text>
            </View>
          </View>

          {/* Change Role Button */}
          <TouchableOpacity
            style={[styles.changeRoleBtn, { backgroundColor: ADMIN_ACCENT + '18', borderColor: ADMIN_ACCENT + '40' }]}
            onPress={() => openRoleModal(item)}
          >
            <MaterialCommunityIcons name="account-edit-outline" size={20} color={ADMIN_ACCENT} />
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const allRoleFilters = ['All', 'Student', 'Medical', 'Security', 'Fire', 'Admin'];

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: isDarkMode ? '#0F0F1A' : '#7C3AED' }]}>
        <Text style={styles.headerTitle}>USER MANAGER</Text>
        <Text style={styles.headerSub}>{(filteredUsers || []).length} users · Edit Roles & Permissions</Text>
      </View>

      {/* Search */}
      <View style={[styles.searchBar, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Ionicons name="search" size={18} color={colors.textSub} style={{ marginRight: 10 }} />
        <TextInput
          style={[styles.searchInput, { color: colors.text }]}
          placeholder="Search by name or email..."
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

      {/* Role Filter Tabs */}
      <View style={[styles.filterRow, { borderBottomColor: colors.border }]}>
        {allRoleFilters.map(filter => {
          const isActive = activeRoleFilter === filter;
          const filterRole = filter.toLowerCase();
          const activeColor = ROLE_COLORS[filterRole] || ADMIN_ACCENT;
          return (
            <TouchableOpacity
              key={filter}
              style={[styles.filterTab, isActive && { borderBottomColor: activeColor, borderBottomWidth: 2 }]}
              onPress={() => setActiveRoleFilter(filter)}
            >
              <Text style={[styles.filterTabText, { color: isActive ? activeColor : colors.textSub }]}>
                {filter}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Stats Bar */}
      <View style={[styles.statsBar, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        {Object.entries(ROLE_COLORS).map(([role, color]) => {
          const count = (users || []).filter(u => u?.role === role).length;
          return (
            <View key={role} style={styles.statItem}>
              <Text style={[styles.statCount, { color: color }]}>{count}</Text>
              <Text style={[styles.statRole, { color: colors.textSub }]}>{role}s</Text>
            </View>
          );
        })}
      </View>

      {/* User List */}
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={ADMIN_ACCENT} />
        </View>
      ) : (filteredUsers || []).length === 0 ? (
        <View style={styles.center}>
          <Ionicons name="people-outline" size={60} color={colors.textSub} style={{ opacity: 0.4 }} />
          <Text style={[styles.emptyText, { color: colors.textSub, marginTop: 12 }]}>No users found</Text>
        </View>
      ) : (
        <FlatList
          data={filteredUsers}
          keyExtractor={item => item.id}
          renderItem={renderUser}
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

      {/* Role Change Modal */}
      <Modal visible={showRoleModal} transparent animationType="slide" onRequestClose={() => setShowRoleModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalSheet, { backgroundColor: isDarkMode ? '#13131F' : '#FFF', borderColor: isDarkMode ? '#2D2D4A' : '#E5E7EB' }]}>
            {/* Pull indicator */}
            <View style={[styles.sheetHandle, { backgroundColor: isDarkMode ? '#374151' : '#D1D5DB' }]} />

            {/* User info */}
            <View style={styles.sheetUserRow}>
              <View style={[styles.sheetAvatar, { backgroundColor: ROLE_COLORS[selectedUser?.role || 'student'] + '22' }]}>
                <Text style={[styles.sheetAvatarText, { color: ROLE_COLORS[selectedUser?.role || 'student'] }]}>
                  {selectedUser ? getInitials(selectedUser) : '?'}
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.sheetUserName, { color: isDarkMode ? '#FFF' : '#0F0F1A' }]} numberOfLines={1}>
                  {selectedUser?.firstName
                    ? `${selectedUser.firstName} ${selectedUser.lastName || ''}`.trim()
                    : selectedUser?.email?.split('@')[0]}
                </Text>
                <Text style={[styles.sheetUserEmail, { color: colors.textSub }]} numberOfLines={1}>
                  {selectedUser?.email}
                </Text>
              </View>
            </View>

            <Text style={[styles.sheetSectionLabel, { color: colors.textSub }]}>SELECT NEW ROLE</Text>

            {ROLES.map(role => {
              const isSelected = pendingRole === role;
              const roleColor = ROLE_COLORS[role];
              const roleIcon = ROLE_ICONS[role];
              return (
                <TouchableOpacity
                  key={role}
                  style={[
                    styles.roleOption,
                    {
                      backgroundColor: isSelected ? roleColor + '15' : 'transparent',
                      borderColor: isSelected ? roleColor : colors.border,
                    },
                  ]}
                  onPress={() => setPendingRole(role)}
                >
                  <View style={[styles.roleOptionIcon, { backgroundColor: roleColor + '20' }]}>
                    <MaterialCommunityIcons name={roleIcon as any} size={22} color={roleColor} />
                  </View>
                  <View style={{ flex: 1, marginLeft: 14 }}>
                    <Text style={[styles.roleOptionName, { color: isDarkMode ? '#FFF' : '#0F0F1A' }]}>
                      {role.charAt(0).toUpperCase() + role.slice(1)}
                    </Text>
                    <Text style={[styles.roleOptionSub, { color: colors.textSub }]}>
                      {role === 'student' ? 'Can report emergencies & view alerts' :
                       role === 'medical' ? 'Receives Medical & Accident dispatches' :
                       role === 'security' ? 'Receives Security threat alerts only' :
                       role === 'fire' ? 'Receives Fire emergency dispatches only' :
                       'Full system access & management'}
                    </Text>
                  </View>
                  {isSelected && <Ionicons name="checkmark-circle" size={22} color={roleColor} />}
                </TouchableOpacity>
              );
            })}

            <View style={styles.sheetBtnRow}>
              <TouchableOpacity
                style={[styles.sheetCancelBtn, { borderColor: colors.border }]}
                onPress={() => setShowRoleModal(false)}
                disabled={isSaving}
              >
                <Text style={[styles.sheetCancelText, { color: colors.text }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.sheetSaveBtn,
                  { backgroundColor: ROLE_COLORS[pendingRole] || ADMIN_ACCENT },
                  (isSaving || pendingRole === selectedUser?.role) && { opacity: 0.5 },
                ]}
                onPress={handleRoleChange}
                disabled={isSaving || pendingRole === selectedUser?.role}
              >
                {isSaving
                  ? <ActivityIndicator color="#FFF" size="small" />
                  : <Text style={styles.sheetSaveText}>Save Role</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
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
  headerTitle: { fontSize: 22, fontWeight: '900', color: '#FFF', letterSpacing: 1 },
  headerSub: { fontSize: 13, color: 'rgba(255,255,255,0.65)', marginTop: 4, fontWeight: '500' },

  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginTop: 14,
    marginBottom: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1,
  },
  searchInput: { flex: 1, fontSize: 15, fontWeight: '500' },

  filterRow: {
    flexDirection: 'row',
    marginHorizontal: 16,
    borderBottomWidth: 1,
    marginBottom: 0,
  },
  filterTab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
  },
  filterTabText: { fontSize: 11, fontWeight: '700' },

  statsBar: {
    flexDirection: 'row',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    justifyContent: 'space-around',
  },
  statItem: { alignItems: 'center' },
  statCount: { fontSize: 20, fontWeight: '800' },
  statRole: { fontSize: 10, fontWeight: '600', textTransform: 'capitalize' },

  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyText: { fontSize: 15, fontWeight: '600' },
  listContent: { padding: 16, paddingBottom: 100 },

  card: {
    borderRadius: 16,
    marginBottom: 12,
    borderWidth: 1,
    overflow: 'hidden',
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 6,
  },
  adminBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: ADMIN_ACCENT,
    paddingHorizontal: 12,
    paddingVertical: 5,
    gap: 6,
  },
  adminBannerText: { color: '#FFF', fontSize: 10, fontWeight: '800', letterSpacing: 1.5 },
  cardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  avatarText: { fontSize: 18, fontWeight: '800' },
  cardInfo: { flex: 1 },
  userName: { fontSize: 16, fontWeight: '700', marginBottom: 2 },
  userEmail: { fontSize: 12, marginBottom: 6 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  roleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 100,
  },
  roleBadgeText: { fontSize: 9, fontWeight: '800', letterSpacing: 1 },
  lastActive: { fontSize: 11, fontWeight: '500' },
  changeRoleBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 10,
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

  // Role Modal (bottom sheet)
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 24,
    paddingBottom: 40,
    borderWidth: 1,
    borderBottomWidth: 0,
  },
  sheetHandle: {
    width: 44,
    height: 5,
    borderRadius: 3,
    alignSelf: 'center',
    marginBottom: 20,
  },
  sheetUserRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
    gap: 14,
  },
  sheetAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sheetAvatarText: { fontSize: 18, fontWeight: '800' },
  sheetUserName: { fontSize: 17, fontWeight: '700', marginBottom: 2 },
  sheetUserEmail: { fontSize: 12 },
  sheetSectionLabel: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.5,
    marginBottom: 14,
  },
  roleOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 14,
    borderWidth: 1.5,
    marginBottom: 10,
  },
  roleOptionIcon: {
    width: 46,
    height: 46,
    borderRadius: 23,
    justifyContent: 'center',
    alignItems: 'center',
  },
  roleOptionName: { fontSize: 15, fontWeight: '700', marginBottom: 2 },
  roleOptionSub: { fontSize: 12, lineHeight: 17 },
  sheetBtnRow: { flexDirection: 'row', gap: 12, marginTop: 20 },
  sheetCancelBtn: { flex: 1, paddingVertical: 14, borderRadius: 14, alignItems: 'center', borderWidth: 1 },
  sheetCancelText: { fontSize: 15, fontWeight: '600' },
  sheetSaveBtn: { flex: 1, paddingVertical: 14, borderRadius: 14, alignItems: 'center' },
  sheetSaveText: { color: '#FFF', fontSize: 15, fontWeight: '700' },
});
