import React, { useState } from 'react';
import { 
  StyleSheet, Text, View, ScrollView, TouchableOpacity, 
  Platform, SafeAreaView, Modal, TextInput, ActivityIndicator, Linking
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { updatePassword, deleteUser, EmailAuthProvider, reauthenticateWithCredential } from 'firebase/auth';
import { doc, deleteDoc } from 'firebase/firestore';
import { auth, db } from '../firebaseConfig';
import { useTheme } from '../hooks/ThemeContext';

export default function PrivacySecurityScreen() {
  const router = useRouter();
  const { colors, isDarkMode } = useTheme();
  const user = auth.currentUser;

  // Custom Alert State
  const [alertConfig, setAlertConfig] = useState({
    visible: false,
    title: '',
    message: '',
    type: 'success' as 'success' | 'error'
  });

  const showAlert = (title: string, message: string, type: 'success' | 'error') => {
    setAlertConfig({ visible: true, title, message, type });
  };

  // Modals
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  
  // Password State
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false); // NEW: Eye toggle
  const [showNewPassword, setShowNewPassword] = useState(false);         // NEW: Eye toggle
  const [isUpdating, setIsUpdating] = useState(false);
  
  // Delete State
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  const openDeviceSettings = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Linking.openSettings().catch(() => {
      showAlert("Action Failed", "Unable to open settings. Please go to your phone's settings manually.", "error");
    });
  };

  const handleChangePassword = async () => {
    if (!user || !user.email) return;
    
    if (!currentPassword) {
      showAlert("Missing Field", "Please enter your current password to verify your identity.", "error");
      return;
    }

    if (newPassword.length < 6) {
      showAlert("Weak Password", "New password must be at least 6 characters long.", "error");
      return;
    }
    
    setIsUpdating(true);
    try {
      const credential = EmailAuthProvider.credential(user.email, currentPassword);
      await reauthenticateWithCredential(user, credential);

      await updatePassword(user, newPassword);
      
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setShowPasswordModal(false);
      setCurrentPassword('');
      setNewPassword('');
      setShowCurrentPassword(false);
      setShowNewPassword(false);
      showAlert("Success", "Your password has been securely updated.", "success");
      
    } catch (error: any) {
      console.error(error);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      
      if (error.code === 'auth/invalid-credential') {
        showAlert("Verification Failed", "The current password you entered is incorrect.", "error");
      } else {
        showAlert("Update Failed", "Could not update your password. Please try again later.", "error");
      }
    } finally {
      setIsUpdating(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (!user || deleteConfirmText !== 'DELETE') return;

    setIsDeleting(true);
    try {
      await deleteDoc(doc(db, 'users', user.uid));
      await deleteUser(user);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error: any) {
      console.error(error);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      
      if (error.code === 'auth/requires-recent-login') {
        setShowDeleteModal(false);
        showAlert("Security Verification", "For your protection, you must log out and log back in before permanently deleting your account.", "error");
      } else {
        showAlert("Deletion Failed", "Failed to delete account. Please contact support.", "error");
      }
      setIsDeleting(false);
    }
  };

  const PolicyRow = ({ icon, title, description }: any) => (
    <View style={styles.policyRow}>
      <View style={[styles.policyIconBg, { backgroundColor: isDarkMode ? '#1F2937' : '#F3F4F6' }]}>
        <Ionicons name={icon} size={22} color={colors.textSub} />
      </View>
      <View style={styles.policyTextContainer}>
        <Text style={[styles.policyTitle, { color: colors.text }]}>{title}</Text>
        <Text style={[styles.policyDesc, { color: colors.textSub }]}>{description}</Text>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.headerBg }]}>
      <Stack.Screen options={{ headerShown: false }} />
      
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        
        <View style={[styles.header, { backgroundColor: colors.headerBg }]}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={colors.headerText} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.headerText }]}>Privacy & Security</Text>
        </View>

        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          
          <Text style={[styles.sectionTitle, { color: colors.textSub }]}>DATA USAGE POLICY</Text>
          <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <PolicyRow 
              icon="location" 
              title="Location Tracking" 
              description="Your GPS location is strictly used only when you actively trigger an SOS or submit a report. We do not track you in the background." 
            />
            <View style={[styles.divider, { backgroundColor: colors.border }]} />
            <PolicyRow 
              icon="camera" 
              title="Media Access" 
              description="Camera and gallery access is only utilized when you choose to attach evidence to an emergency report." 
            />
            <View style={[styles.divider, { backgroundColor: colors.border }]} />
            <PolicyRow 
              icon="server" 
              title="Data Encryption" 
              description="All reports and personal data are securely encrypted and stored on Firebase servers, accessible only by authorized campus security." 
            />
          </View>

          <Text style={[styles.sectionTitle, { color: colors.textSub }]}>ACCOUNT SECURITY</Text>
          <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            
            <TouchableOpacity 
              style={styles.actionRow} 
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setShowPasswordModal(true);
              }}
            >
              <View style={styles.actionIconTitle}>
                <MaterialCommunityIcons name="lock-reset" size={22} color={colors.text} style={{ marginRight: 15 }} />
                <Text style={[styles.actionTitle, { color: colors.text }]}>Change Password</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.textSub} />
            </TouchableOpacity>
            
            <View style={[styles.divider, { backgroundColor: colors.border }]} />

            <TouchableOpacity style={styles.actionRow} onPress={openDeviceSettings}>
              <View style={styles.actionIconTitle}>
                <Ionicons name="settings-outline" size={22} color={colors.text} style={{ marginRight: 15 }} />
                <Text style={[styles.actionTitle, { color: colors.text }]}>Manage Device Permissions</Text>
              </View>
              <Ionicons name="open-outline" size={18} color={colors.textSub} />
            </TouchableOpacity>

          </View>

          <Text style={[styles.sectionTitle, { color: '#DC2626', marginTop: 10 }]}>DANGER ZONE</Text>
          <View style={[styles.card, { backgroundColor: isDarkMode ? '#450a0a' : '#FEF2F2', borderColor: '#DC262644' }]}>
            <Text style={[styles.policyDesc, { color: isDarkMode ? '#fca5a5' : '#991B1B', marginBottom: 15 }]}>
              Permanently deleting your account will erase all your personal data, preferences, and report history from the Babcock system. This action cannot be undone.
            </Text>
            <TouchableOpacity 
              style={styles.deleteButton} 
              onPress={() => {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
                setShowDeleteModal(true);
              }}
            >
              <Ionicons name="trash-outline" size={20} color="#DC2626" style={{ marginRight: 8 }} />
              <Text style={styles.deleteButtonText}>Delete Account</Text>
            </TouchableOpacity>
          </View>

        </ScrollView>
      </View>

      {/* CHANGE PASSWORD MODAL */}
      <Modal visible={showPasswordModal} animationType="fade" transparent={true} onRequestClose={() => setShowPasswordModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>Update Password</Text>
            <Text style={[styles.modalSub, { color: colors.textSub }]}>Verify your current password to set a new one.</Text>
            
            {/* Current Password Field with Eye Toggle */}
            <View style={[styles.passwordWrapper, { backgroundColor: colors.background, borderColor: colors.border }]}>
              <TextInput
                style={[styles.passwordInput, { color: colors.text }]}
                placeholder="Current Password"
                placeholderTextColor={colors.textSub}
                secureTextEntry={!showCurrentPassword}
                value={currentPassword}
                onChangeText={setCurrentPassword}
              />
              <TouchableOpacity onPress={() => setShowCurrentPassword(!showCurrentPassword)} style={{ padding: 5 }}>
                <Ionicons name={showCurrentPassword ? "eye-outline" : "eye-off-outline"} size={20} color={colors.textSub} />
              </TouchableOpacity>
            </View>

            {/* New Password Field with Eye Toggle */}
            <View style={[styles.passwordWrapper, { backgroundColor: colors.background, borderColor: colors.border }]}>
              <TextInput
                style={[styles.passwordInput, { color: colors.text }]}
                placeholder="New Password (min 6 chars)"
                placeholderTextColor={colors.textSub}
                secureTextEntry={!showNewPassword}
                value={newPassword}
                onChangeText={setNewPassword}
              />
              <TouchableOpacity onPress={() => setShowNewPassword(!showNewPassword)} style={{ padding: 5 }}>
                <Ionicons name={showNewPassword ? "eye-outline" : "eye-off-outline"} size={20} color={colors.textSub} />
              </TouchableOpacity>
            </View>

            <View style={styles.modalButtonRow}>
              <TouchableOpacity style={[styles.modalHalfButton, { borderColor: colors.border, borderWidth: 1 }]} onPress={() => {
                setShowPasswordModal(false);
                setCurrentPassword('');
                setNewPassword('');
                setShowCurrentPassword(false);
                setShowNewPassword(false);
              }}>
                <Text style={[styles.modalButtonText, { color: colors.text }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.modalHalfButton, { backgroundColor: colors.accent, marginLeft: 10 }, (!currentPassword || newPassword.length < 6) && { opacity: 0.5 }]} 
                onPress={handleChangePassword}
                disabled={isUpdating || !currentPassword || newPassword.length < 6}
              >
                {isUpdating ? <ActivityIndicator color="#FFF" /> : <Text style={[styles.modalButtonText, { color: '#FFF' }]}>Update</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* DELETE ACCOUNT MODAL */}
      <Modal visible={showDeleteModal} animationType="slide" transparent={true} onRequestClose={() => setShowDeleteModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.surface, borderColor: '#DC2626' }]}>
            <Ionicons name="warning" size={40} color="#DC2626" style={{ alignSelf: 'center', marginBottom: 10 }} />
            <Text style={[styles.modalTitle, { color: colors.text, textAlign: 'center' }]}>Delete Account?</Text>
            <Text style={[styles.modalSub, { color: colors.textSub, textAlign: 'center' }]}>
              Type <Text style={{ fontWeight: 'bold', color: '#DC2626' }}>DELETE</Text> below to confirm permanent deletion of your account.
            </Text>
            
            <TextInput
              style={[styles.input, { color: colors.text, borderColor: '#DC2626', backgroundColor: colors.background }]}
              placeholder="Type DELETE"
              placeholderTextColor={colors.textSub}
              autoCapitalize="characters"
              value={deleteConfirmText}
              onChangeText={setDeleteConfirmText}
            />

            <View style={styles.modalButtonRow}>
              <TouchableOpacity style={[styles.modalHalfButton, { borderColor: colors.border, borderWidth: 1 }]} onPress={() => {
                setShowDeleteModal(false);
                setDeleteConfirmText('');
              }}>
                <Text style={[styles.modalButtonText, { color: colors.text }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.modalHalfButton, { backgroundColor: '#DC2626', marginLeft: 10 }, deleteConfirmText !== 'DELETE' && { opacity: 0.5 }]} 
                onPress={handleDeleteAccount}
                disabled={deleteConfirmText !== 'DELETE' || isDeleting}
              >
                {isDeleting ? <ActivityIndicator color="#FFF" /> : <Text style={[styles.modalButtonText, { color: '#FFF' }]}>Confirm</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* CUSTOM ALERT MODAL */}
      <Modal visible={alertConfig.visible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.surface, borderColor: colors.border, padding: 25, alignItems: 'center' }]}>
            <View style={{ width: 60, height: 60, borderRadius: 30, justifyContent: 'center', alignItems: 'center', marginBottom: 15, backgroundColor: alertConfig.type === 'success' ? '#D1FAE5' : '#FDE8E8' }}>
              <Ionicons name={alertConfig.type === 'success' ? 'checkmark-circle' : 'alert-circle'} size={36} color={alertConfig.type === 'success' ? '#10B981' : '#DC2626'} />
            </View>
            <Text style={[styles.modalTitle, { color: colors.text, textAlign: 'center' }]}>{alertConfig.title}</Text>
            <Text style={[styles.modalSub, { color: colors.textSub, textAlign: 'center', marginBottom: 25 }]}>{alertConfig.message}</Text>
            <TouchableOpacity 
              style={[styles.alertButton, { backgroundColor: alertConfig.type === 'success' ? '#10B981' : colors.accent }]} 
              onPress={() => setAlertConfig(prev => ({ ...prev, visible: false }))}
            >
              <Text style={[styles.modalButtonText, { color: '#FFF' }]}>OK</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', paddingTop: Platform.OS === 'android' ? 40 : 10, paddingBottom: 20, paddingHorizontal: 20 },
  backButton: { marginRight: 15 },
  headerTitle: { fontSize: 20, fontWeight: 'bold' },
  scrollContent: { padding: 20, paddingBottom: 40 },
  sectionTitle: { fontSize: 12, fontWeight: '800', letterSpacing: 1.5, marginBottom: 10, marginLeft: 5 },
  card: { borderRadius: 16, padding: 20, marginBottom: 30, borderWidth: 1, shadowColor: '#000', shadowOpacity: 0.03, shadowRadius: 8, elevation: 2 },
  policyRow: { flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 5 },
  policyIconBg: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center', marginRight: 15 },
  policyTextContainer: { flex: 1 },
  policyTitle: { fontSize: 15, fontWeight: '700', marginBottom: 4 },
  policyDesc: { fontSize: 13, lineHeight: 20 },
  divider: { height: 1, marginVertical: 15 },
  actionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8 },
  actionIconTitle: { flexDirection: 'row', alignItems: 'center' },
  actionTitle: { fontSize: 15, fontWeight: '500' },
  deleteButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 12, borderRadius: 12, borderWidth: 1, borderColor: '#DC2626', backgroundColor: '#FEF2F2' },
  deleteButtonText: { color: '#DC2626', fontSize: 15, fontWeight: 'bold' },
  
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  modalContent: { width: '100%', maxWidth: 350, borderRadius: 24, padding: 20, elevation: 10, shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 15, borderWidth: 1 },
  modalTitle: { fontSize: 20, fontWeight: 'bold', marginBottom: 8 },
  modalSub: { fontSize: 14, lineHeight: 20, marginBottom: 20 },
  
  // Standard text input (used in Delete modal)
  input: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 15, paddingVertical: 14, fontSize: 16, marginBottom: 25 },
  
  // New styles for the password fields with the eye icon
  passwordWrapper: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 12, paddingHorizontal: 15, marginBottom: 15 },
  passwordInput: { flex: 1, paddingVertical: 14, fontSize: 16 },

  modalButtonRow: { flexDirection: 'row', justifyContent: 'space-between' },
  modalHalfButton: { flex: 1, paddingVertical: 14, borderRadius: 12, alignItems: 'center' },
  alertButton: { width: '100%', paddingVertical: 14, borderRadius: 12, alignItems: 'center' }, // Fixed OK Button
  modalButtonText: { fontSize: 15, fontWeight: 'bold' },
});