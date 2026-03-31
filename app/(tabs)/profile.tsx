import React, { useState, useEffect } from 'react';
import { 
  StyleSheet, 
  Text, 
  View, 
  ScrollView, 
  TouchableOpacity, 
  Switch, 
  Platform,
  Modal,
  TextInput,
  ActivityIndicator,
  KeyboardAvoidingView,
  Linking
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { signOut } from 'firebase/auth';
import { doc, updateDoc } from 'firebase/firestore';
import { auth, db } from '../../firebaseConfig';
import { useTheme } from '../../hooks/ThemeContext';
import { useAuth } from '../../hooks/AuthContext'; 
import { useRouter } from 'expo-router';

export default function ProfileScreen() {
  const router = useRouter();
  const { isDarkMode, toggleTheme, colors } = useTheme();
  const { profile, user } = useAuth(); 

  const [alertsEnabled, setAlertsEnabled] = useState(true);
  const [pushEnabled, setPushEnabled] = useState(true);
  const [tipsEnabled, setTipsEnabled] = useState(false);
  
  // Modal States
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showSupportModal, setShowSupportModal] = useState(false);

  // Edit Profile States
  const [editFirstName, setEditFirstName] = useState('');
  const [editLastName, setEditLastName] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Local overrides so the UI updates instantly without requiring an app restart
  const [localFirstName, setLocalFirstName] = useState(profile?.firstName || '');
  const [localLastName, setLocalLastName] = useState(profile?.lastName || '');

  // Sync local state when the profile initially loads
  useEffect(() => {
    if (profile) {
      setLocalFirstName(profile.firstName || '');
      setLocalLastName(profile.lastName || '');
    }
  }, [profile]);

  const handleLogout = async () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    try {
      await signOut(auth);
    } catch (error) {
      console.error("Error logging out: ", error);
    }
  };

  const handleToggleEmergencyAlerts = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (alertsEnabled) {
      setShowConfirmModal(true);
    } else {
      setAlertsEnabled(true);
      if (user) {
        updateDoc(doc(db, 'users', user.uid), {
          'preferences.emergencyAlerts': true
        }).catch(e => console.error("Failed to update preferences", e));
      }
    }
  };

  const confirmDisableAlerts = async () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    setShowConfirmModal(false);
    setAlertsEnabled(false);
    if (user) {
      try {
        await updateDoc(doc(db, 'users', user.uid), {
          'preferences.emergencyAlerts': false
        });
      } catch (e) {
        console.error("Failed to update preferences", e);
      }
    }
  };

  // --- Edit Profile Functions ---
  const handleOpenEdit = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setEditFirstName(localFirstName);
    setEditLastName(localLastName);
    setShowEditModal(true);
  };

  const handleSaveProfile = async () => {
    if (!user || (!editFirstName.trim() && !editLastName.trim())) return;
    
    setIsSaving(true);
    try {
      const cleanFirst = editFirstName.trim();
      const cleanLast = editLastName.trim();

      await updateDoc(doc(db, 'users', user.uid), {
        firstName: cleanFirst,
        lastName: cleanLast,
      });

      setLocalFirstName(cleanFirst);
      setLocalLastName(cleanLast);
      
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setShowEditModal(false);
    } catch (error) {
      console.error("Error updating profile:", error);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setIsSaving(false);
    }
  };

  // --- App Support Actions ---
  const handleEmailSupport = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Linking.openURL('mailto:support@babcock.edu.ng?subject=Emergency App Support Request');
  };

  const handleReportBug = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Linking.openURL('mailto:tech@babcock.edu.ng?subject=Bug Report - Emergency App&body=Please describe the issue you are facing:');
  };

  const toggleSwitch = (setter: React.Dispatch<React.SetStateAction<boolean>>, value: boolean) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setter(!value);
  };

  const handleThemeToggle = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    toggleTheme();
  };

  // Use local state for immediate visual updates
  const displayFirstName = localFirstName || 'Babcock';
  const displayLastName = localLastName || 'User';

  const getInitials = () => {
    const first = displayFirstName.charAt(0);
    const last = displayLastName.charAt(0);
    return `${first}${last}`.toUpperCase();
  };

  const InfoRow = ({ icon, label, value, isVerified = false }: any) => (
    <View style={styles.infoRow}>
      <MaterialCommunityIcons name={icon} size={22} color={colors.textSub} style={styles.infoIcon} />
      <View style={styles.infoTextContainer}>
        <Text style={[styles.infoLabel, { color: colors.textSub }]}>{label}</Text>
        <Text 
          style={[styles.infoValue, { color: isVerified ? '#10B981' : colors.text }]}
          numberOfLines={1}
          adjustsFontSizeToFit
        >
          {value}
        </Text>
      </View>
    </View>
  );

  const SettingToggle = ({ icon, title, sub, value, onToggle }: any) => (
    <View style={styles.settingToggleRow}>
      <View style={styles.settingIconContainer}>
        <Ionicons name={icon} size={22} color={colors.textSub} />
      </View>
      <View style={styles.settingTextContainer}>
        <Text style={[styles.settingTitle, { color: colors.text }]}>{title}</Text>
        <Text style={[styles.settingSub, { color: colors.textSub }]}>{sub}</Text>
      </View>
      <Switch 
        value={value} 
        onValueChange={onToggle} 
        trackColor={{ false: '#D1D5DB', true: '#1E3A8A' }}
        thumbColor="#FFF"
      />
    </View>
  );

  const NavRow = ({ icon, title, onPress }: any) => (
    <TouchableOpacity 
      style={styles.navRow} 
      activeOpacity={0.7}
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        if (onPress) onPress();
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <Ionicons name={icon} size={20} color={colors.textSub} style={{ marginRight: 15 }} />
        <Text style={[styles.navTitle, { color: colors.text }]}>{title}</Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.textSub} />
    </TouchableOpacity>
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      
      <View style={[styles.absoluteHeaderBg, { backgroundColor: isDarkMode ? '#111827' : '#1E3A8A' }]} />

      <SafeAreaView style={styles.safeArea} edges={['top']}>
        
        <View style={styles.headerTitleContainer}>
          <Text style={styles.headerTitleText}>Profile</Text>
        </View>

        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          
          <View style={[styles.profileCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={styles.avatarHeaderRow}>
              <View style={[styles.avatarCircle, { backgroundColor: isDarkMode ? '#374151' : '#1E3A8A' }]}>
                <Text style={styles.avatarInitials}>{getInitials()}</Text>
              </View>
              <View style={styles.nameContainer}>
                <Text style={[styles.userName, { color: colors.text }]} numberOfLines={1} adjustsFontSizeToFit>
                  {`${displayFirstName} ${displayLastName}`}
                </Text>
                <Text style={[styles.userRole, { color: colors.textSub }]}>
                  {profile?.role ? profile.role.charAt(0).toUpperCase() + profile.role.slice(1) : 'Student'}
                </Text>
              </View>
            </View>

            <View style={[styles.divider, { backgroundColor: colors.border }]} />

            <InfoRow icon="email-outline" label="Email" value={profile?.email || "N/A"} />
            <InfoRow icon="shield-check-outline" label="Account Status" value="Verified" isVerified={true} />
          </View>

          <View style={[styles.settingsGroupCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.groupTitle, { color: colors.text }]}>Notification Settings</Text>
            
            <SettingToggle 
              icon="notifications-outline" 
              title="Emergency Alerts" 
              sub="Get notified of nearby emergencies" 
              value={alertsEnabled} 
              onToggle={handleToggleEmergencyAlerts} 
            />
            <SettingToggle 
              icon="phone-portrait-outline" 
              title="Push Notifications" 
              sub="Receive real-time updates" 
              value={pushEnabled} 
              onToggle={() => toggleSwitch(setPushEnabled, pushEnabled)} 
            />
            <SettingToggle 
              icon="bulb-outline" 
              title="Safety Tips" 
              sub="Receive safety reminders" 
              value={tipsEnabled} 
              onToggle={() => toggleSwitch(setTipsEnabled, tipsEnabled)} 
            />
          </View>

          <View style={[styles.settingsGroupCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.groupTitle, { color: colors.text }]}>Appearance</Text>
            
            <SettingToggle 
              icon="moon-outline" 
              title="Dark Mode" 
              sub="Reduce eye strain at night" 
              value={isDarkMode} 
              onToggle={handleThemeToggle} 
            />
          </View>

          <View style={[styles.settingsGroupCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <NavRow icon="person-outline" title="Edit Profile" onPress={handleOpenEdit} />
            <View style={[styles.navDivider, { backgroundColor: colors.border }]} />
            <NavRow icon="lock-closed-outline" title="Privacy & Security" onPress={() => router.push('/privacy')} />
            <View style={[styles.navDivider, { backgroundColor: colors.border }]} />
            <NavRow icon="help-circle-outline" title="Help & Support" onPress={() => setShowSupportModal(true)} />
          </View>

          <TouchableOpacity 
            style={[styles.logoutButton, { borderColor: '#DC2626', backgroundColor: colors.background }]} 
            onPress={handleLogout}
            activeOpacity={0.7}
          >
            <Ionicons name="log-out-outline" size={20} color="#DC2626" style={{ marginRight: 8 }} />
            <Text style={styles.logoutButtonText}>Logout</Text>
          </TouchableOpacity>

          <Text style={styles.versionText}>Version 2.4.1 • Babcock University</Text>

        </ScrollView>
      </SafeAreaView>

      {/* EDIT PROFILE MODAL */}
      <Modal visible={showEditModal} animationType="none" transparent={true} onRequestClose={() => setShowEditModal(false)}>
        <KeyboardAvoidingView 
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'} 
          style={styles.customModalOverlay}
        >
          <View style={[styles.customModalContent, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            
            <View style={styles.editModalHeader}>
              <Text style={[styles.customModalTitle, { color: colors.text, marginBottom: 0 }]}>Edit Profile</Text>
              <TouchableOpacity onPress={() => setShowEditModal(false)} style={{ padding: 5 }}>
                <Ionicons name="close" size={24} color={colors.textSub} />
              </TouchableOpacity>
            </View>
            
            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: colors.textSub }]}>First Name</Text>
              <TextInput
                style={[styles.textInput, { color: colors.text, borderColor: colors.border, backgroundColor: colors.background }]}
                value={editFirstName}
                onChangeText={setEditFirstName}
                placeholder="Enter your first name"
                placeholderTextColor={colors.textSub}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: colors.textSub }]}>Last Name</Text>
              <TextInput
                style={[styles.textInput, { color: colors.text, borderColor: colors.border, backgroundColor: colors.background }]}
                value={editLastName}
                onChangeText={setEditLastName}
                placeholder="Enter your last name"
                placeholderTextColor={colors.textSub}
              />
            </View>

            <TouchableOpacity 
              style={[
                styles.saveButton, 
                { backgroundColor: '#1E3A8A' },
                (!editFirstName.trim() || !editLastName.trim() || isSaving) && { opacity: 0.5 }
              ]} 
              onPress={handleSaveProfile}
              disabled={!editFirstName.trim() || !editLastName.trim() || isSaving}
            >
              {isSaving ? (
                <ActivityIndicator color="#FFF" />
              ) : (
                <Text style={styles.primaryButtonText}>Save Changes</Text>
              )}
            </TouchableOpacity>

          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* CUSTOM CONFIRMATION MODAL */}
      <Modal visible={showConfirmModal} animationType="none" transparent={true}>
        <View style={styles.customModalOverlay}>
          <View style={[styles.customModalContent, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={[styles.iconCircle, { backgroundColor: '#FEE2E2' }]}>
              <Ionicons name="warning" size={40} color="#DC2626" />
            </View>
            <Text style={[styles.customModalTitle, { color: colors.text }]}>Disable Alerts?</Text>
            <Text style={[styles.customModalText, { color: colors.textSub }]}>
              You will no longer receive immediate push notifications for critical campus emergencies.
            </Text>
            <View style={styles.modalButtonRow}>
              <TouchableOpacity 
                style={[styles.secondaryHalfButton, { borderColor: colors.border, borderWidth: 1 }]} 
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setShowConfirmModal(false);
                }}
              >
                <Text style={[styles.secondaryButtonText, { color: colors.text }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.primaryHalfButton, { backgroundColor: '#DC2626' }]} onPress={confirmDisableAlerts}>
                <Text style={styles.primaryButtonText}>Disable</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* HELP & SUPPORT MODAL */}
      <Modal visible={showSupportModal} animationType="none" transparent={true} onRequestClose={() => setShowSupportModal(false)}>
        <View style={styles.customModalOverlay}>
          <View style={[styles.customModalContent, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={[styles.iconCircle, { backgroundColor: isDarkMode ? '#1E3A8A44' : '#EFF6FF' }]}>
              <Ionicons name="help-buoy" size={40} color="#3B82F6" />
            </View>
            <Text style={[styles.customModalTitle, { color: colors.text }]}>App Support</Text>
            <Text style={[styles.customModalText, { color: colors.textSub, marginBottom: 25 }]}>
              Need assistance with your account or want to report a technical issue with the app?
            </Text>

            <TouchableOpacity 
              style={[styles.fullWidthButton, { backgroundColor: '#3B82F6', marginBottom: 12 }]} 
              onPress={handleEmailSupport}
            >
              <Ionicons name="mail" size={20} color="#FFF" style={{ marginRight: 10 }} />
              <Text style={styles.primaryButtonText}>Email Support</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.fullWidthButton, { backgroundColor: '#8B5CF6', marginBottom: 20 }]} 
              onPress={handleReportBug}
            >
              <Ionicons name="bug" size={20} color="#FFF" style={{ marginRight: 10 }} />
              <Text style={styles.primaryButtonText}>Report a Bug</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.secondaryFullButton, { borderColor: colors.border, borderWidth: 1 }]} 
              onPress={() => setShowSupportModal(false)}
            >
              <Text style={[styles.secondaryButtonText, { color: colors.text }]}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  absoluteHeaderBg: { position: 'absolute', top: 0, left: 0, right: 0, height: Platform.OS === 'ios' ? 220 : 180 },
  safeArea: { flex: 1 },
  headerTitleContainer: { paddingHorizontal: 20, paddingVertical: 20 },
  headerTitleText: { color: '#FFF', fontSize: 28, fontWeight: 'bold', letterSpacing: 0.5 },
  scrollContent: { paddingHorizontal: 20, paddingBottom: 100 },
  
  profileCard: { borderRadius: 20, padding: 20, marginBottom: 20, borderWidth: 1, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 4 },
  avatarHeaderRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
  avatarCircle: { width: 66, height: 66, borderRadius: 33, justifyContent: 'center', alignItems: 'center', marginRight: 15 },
  avatarInitials: { color: '#FFF', fontSize: 24, fontWeight: 'bold', letterSpacing: 1 },
  nameContainer: { flex: 1 },
  userName: { fontSize: 22, fontWeight: '800' },
  userRole: { fontSize: 14, marginTop: 2 },
  divider: { height: 1, width: '100%', marginBottom: 15 },
  infoRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 15 },
  infoIcon: { marginRight: 15 },
  infoTextContainer: { flex: 1 },
  infoLabel: { fontSize: 11, fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 },
  infoValue: { fontSize: 15, fontWeight: '600' },

  settingsGroupCard: { borderRadius: 20, padding: 20, marginBottom: 20, borderWidth: 1, shadowColor: '#000', shadowOpacity: 0.03, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
  groupTitle: { fontSize: 16, fontWeight: 'bold', marginBottom: 20 },
  settingToggleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 },
  settingIconContainer: { width: 24, alignItems: 'center', marginRight: 15 },
  settingTextContainer: { flex: 1, paddingRight: 10 },
  settingTitle: { fontSize: 15, fontWeight: '600' },
  settingSub: { fontSize: 12, marginTop: 2 },
  
  navRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 8 },
  navTitle: { fontSize: 15, fontWeight: '500' },
  navDivider: { height: 1, width: '100%', marginVertical: 12 },

  logoutButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 16, borderRadius: 16, borderWidth: 1.5, marginBottom: 25 },
  logoutButtonText: { color: '#DC2626', fontSize: 16, fontWeight: 'bold', letterSpacing: 0.5 },
  versionText: { textAlign: 'center', fontSize: 12, color: '#9CA3AF', marginBottom: 30 },

  // MODAL STYLES
  customModalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  customModalContent: { width: '100%', maxWidth: 350, borderRadius: 24, padding: 25, elevation: 10, shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 15, borderWidth: 1 },
  iconCircle: { width: 80, height: 80, borderRadius: 40, justifyContent: 'center', alignItems: 'center', marginBottom: 20, alignSelf: 'center' },
  customModalTitle: { fontSize: 22, fontWeight: 'bold', textAlign: 'center' },
  customModalText: { fontSize: 14, textAlign: 'center', lineHeight: 22, marginBottom: 30, marginTop: 12 },
  modalButtonRow: { flexDirection: 'row', width: '100%', justifyContent: 'space-between' },
  primaryHalfButton: { flex: 1, paddingVertical: 15, borderRadius: 14, alignItems: 'center', marginLeft: 10 },
  secondaryHalfButton: { flex: 1, paddingVertical: 15, borderRadius: 14, alignItems: 'center', marginRight: 10 },
  primaryButtonText: { color: '#FFF', fontSize: 16, fontWeight: 'bold', letterSpacing: 0.5 },
  secondaryButtonText: { fontSize: 16, fontWeight: '600' },
  
  // SUPPORT MODAL SPECIFIC STYLES
  fullWidthButton: { width: '100%', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 15, borderRadius: 14 },
  secondaryFullButton: { width: '100%', paddingVertical: 15, borderRadius: 14, alignItems: 'center' },

  // EDIT PROFILE SPECIFIC STYLES
  editModalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 25 },
  inputGroup: { marginBottom: 20 },
  inputLabel: { fontSize: 13, fontWeight: 'bold', marginBottom: 8, letterSpacing: 0.5 },
  textInput: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 15, paddingVertical: 14, fontSize: 16 },
  saveButton: { width: '100%', paddingVertical: 16, borderRadius: 14, alignItems: 'center', marginTop: 10 },
});