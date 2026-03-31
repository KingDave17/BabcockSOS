import React, { useState } from 'react';
import { 
  StyleSheet, Text, View, TextInput, TouchableOpacity, 
  KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator, Modal 
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../hooks/ThemeContext';
import { useRouter } from 'expo-router';
// NEW: Added sendPasswordResetEmail
import { signInWithEmailAndPassword, signOut, sendPasswordResetEmail } from 'firebase/auth';
import { auth } from '../firebaseConfig';

export default function LoginScreen() {
  const { colors, isDarkMode } = useTheme();
  const router = useRouter();
  
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoggingIn, setIsLoggingIn] = useState(false); 

  // --- NEW: Reset Password States ---
  const [showResetModal, setShowResetModal] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [isResetting, setIsResetting] = useState(false);

  const [alertConfig, setAlertConfig] = useState({
    visible: false,
    title: '',
    message: '',
    type: 'error' as 'error' | 'success',
    onConfirm: () => {}
  });

  const showAlert = (title: string, message: string, type: 'error' | 'success' = 'error') => {
    setAlertConfig({
      visible: true,
      title,
      message,
      type,
      onConfirm: () => setAlertConfig(prev => ({ ...prev, visible: false }))
    });
  };

  const handleLogin = async () => {
    if (!identifier || !password) {
      showAlert("Missing Fields", "Please enter your Email and password.", "error");
      return;
    }

    setIsLoggingIn(true);
    try {
      const loginEmail = identifier.trim().toLowerCase();
      const userCredential = await signInWithEmailAndPassword(auth, loginEmail, password);
      
      if (!userCredential.user.emailVerified) {
        // We STAY logged in for a second to send the email if they want
        setAlertConfig({
          visible: true,
          title: "Email Not Verified",
          message: "Your account exists but your email hasn't been verified. Check your inbox or click below to resend the link.",
          type: 'error',
          onConfirm: () => setAlertConfig(prev => ({ ...prev, visible: false }))
        });
        setIsLoggingIn(false);
        return; 
      }
      
    } catch (error: any) {
      console.error("Login Error: ", error);
      showAlert("Login Failed", "Invalid credentials. Please try again.", "error");
    } finally {
      setIsLoggingIn(false);
    }
  };

  // --- NEW: Resend Verification ---
  const handleResendVerification = async () => {
    if (!auth.currentUser) return;
    try {
      const { sendEmailVerification } = require('firebase/auth');
      await sendEmailVerification(auth.currentUser);
      await signOut(auth);
      setAlertConfig(prev => ({ ...prev, visible: false }));
      showAlert("Email Sent", "A new verification link has been sent to your Babcock email.", "success");
    } catch (error: any) {
      console.error("Resend Error: ", error);
      showAlert("Error", "Could not resend email. Please try again later.", "error");
    }
  };

  // --- NEW: Firebase Reset Password Logic ---
  const handlePasswordReset = async () => {
    if (!resetEmail.trim()) {
      showAlert("Missing Email", "Please enter your Babcock email to reset your password.", "error");
      return;
    }

    setIsResetting(true);
    try {
      await sendPasswordResetEmail(auth, resetEmail.trim().toLowerCase());
      setShowResetModal(false);
      setResetEmail('');
      showAlert("Email Sent", "Check your inbox (and spam folder) for a link to reset your password.", "success");
    } catch (error: any) {
      console.error("Reset Error: ", error);
      showAlert("Reset Failed", "Could not send reset email. Ensure the email is registered.", "error");
    } finally {
      setIsResetting(false);
    }
  };

  // Dynamic values for the custom alert modal
  const isAlertSuccess = alertConfig.type === 'success';
  const alertIcon = isAlertSuccess ? "checkmark-circle" : "alert-circle";
  const alertColor = isAlertSuccess ? "#10B981" : "#DC2626";
  const alertBg = isAlertSuccess ? "#D1FAE5" : "#FDE8E8";

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]}>
      <KeyboardAvoidingView 
        style={{ flex: 1 }} 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        <ScrollView 
          contentContainerStyle={styles.scrollContent} 
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled" 
        >
          
          <View style={styles.headerSection}>
            <View style={[styles.logoContainer, isDarkMode && { shadowColor: colors.accent, shadowOpacity: 0.5 }]}>
              <View style={[styles.logoCircle, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <Ionicons name="shield-checkmark" size={45} color={colors.accent} />
              </View>
            </View>
            <Text style={[styles.mainTitle, { color: colors.text }]}>Emergency Response</Text>
            <Text style={[styles.subTitle, { color: colors.accent }]}>BABCOCK UNIVERSITY</Text>
          </View>

          <View style={styles.formSection}>
            <View style={styles.inputContainer}>
              <Text style={[styles.inputLabel, { color: colors.textSub }]}>BABCOCK EMAIL</Text>
              <View style={[styles.inputWrapper, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <Ionicons name="mail" size={20} color={colors.textSub} style={styles.inputIcon} />
                <TextInput
                  style={[styles.input, { color: colors.text }]}
                  placeholder="name@student.babcock.edu.ng"
                  placeholderTextColor={colors.textSub}
                  value={identifier}
                  onChangeText={setIdentifier}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  autoCorrect={false}
                />
              </View>
            </View>

            <View style={styles.inputContainer}>
              <Text style={[styles.inputLabel, { color: colors.textSub }]}>PASSWORD</Text>
              <View style={[styles.inputWrapper, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <Ionicons name="lock-closed-outline" size={20} color={colors.textSub} style={styles.inputIcon} />
                <TextInput
                  style={[styles.input, { color: colors.text }]}
                  placeholder="••••••••••••"
                  placeholderTextColor={colors.textSub}
                  secureTextEntry={!showPassword}
                  value={password}
                  onChangeText={setPassword}
                />
                <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={{ padding: 5 }}>
                  <Ionicons name={showPassword ? "eye-outline" : "eye-off-outline"} size={20} color={colors.textSub} />
                </TouchableOpacity>
              </View>
              
              {/* NEW: Forgot Password Link */}
              <TouchableOpacity 
                style={styles.forgotPasswordBtn}
                onPress={() => {
                  setResetEmail(identifier); // Pre-fill with whatever they typed
                  setShowResetModal(true);
                }}
              >
                <Text style={[styles.forgotPasswordText, { color: colors.accent }]}>Forgot Password?</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity style={[styles.loginButton, { backgroundColor: colors.accent }]} onPress={handleLogin} disabled={isLoggingIn} activeOpacity={0.8}>
              {isLoggingIn ? (
                <ActivityIndicator color="#FFF" />
              ) : (
                <>
                  <Text style={styles.loginButtonText}>SECURE LOGIN</Text>
                  <Ionicons name="arrow-forward" size={20} color="#FFF" style={{ marginLeft: 8 }} />
                </>
              )}
            </TouchableOpacity>
          </View>

          <View style={{ flexDirection: 'row', justifyContent: 'center', marginTop: 20 }}>
            <Text style={{ color: colors.textSub, fontWeight: '600' }}>Don&lsquo;t have an account? </Text>
            <TouchableOpacity onPress={() => router.replace('/register' as never)}>
              <Text style={{ color: colors.accent, fontWeight: 'bold' }}>Register Here</Text>
            </TouchableOpacity>
          </View>

          {/* Admin Portal Entry */}
          <TouchableOpacity
            style={styles.adminPortalLink}
            onPress={() => router.push('/admin-login' as never)}
            activeOpacity={0.7}
          >
            <Ionicons name="shield-half-outline" size={13} color="#7C3AED" style={{ marginRight: 5 }} />
            <Text style={[styles.adminPortalText, { color: '#7C3AED' }]}>Admin Portal</Text>
          </TouchableOpacity>

        </ScrollView>
      </KeyboardAvoidingView>

      {/* DYNAMIC ALERT MODAL */}
      <Modal visible={alertConfig.visible} transparent animationType="none">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalBox, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={[styles.modalIconContainer, { backgroundColor: alertBg }]}>
              <Ionicons name={alertIcon} size={40} color={alertColor} />
            </View>
            <Text style={[styles.modalTitle, { color: colors.text }]}>{alertConfig.title}</Text>
            <Text style={[styles.modalMessage, { color: colors.textSub }]}>{alertConfig.message}</Text>
            <TouchableOpacity 
              style={[styles.modalButton, { backgroundColor: isAlertSuccess ? '#10B981' : colors.accent }]} 
              onPress={alertConfig.onConfirm}
              activeOpacity={0.8}
            >
              <Text style={styles.modalButtonText}>OK</Text>
            </TouchableOpacity>

            {alertConfig.title === "Email Not Verified" && (
              <TouchableOpacity 
                style={[styles.resendBtn, { marginTop: 15 }]} 
                onPress={handleResendVerification}
              >
                <Text style={[styles.resendBtnText, { color: colors.accent }]}>Resend Verification Email</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </Modal>

      {/* NEW: FORGOT PASSWORD MODAL */}
      <Modal visible={showResetModal} transparent animationType="slide" onRequestClose={() => setShowResetModal(false)}>
        <KeyboardAvoidingView 
          style={styles.modalOverlay} 
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <View style={[styles.modalBox, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={[styles.modalIconContainer, { backgroundColor: isDarkMode ? '#1E3A8A44' : '#EFF6FF' }]}>
              <Ionicons name="key-outline" size={32} color={colors.accent} />
            </View>
            <Text style={[styles.modalTitle, { color: colors.text }]}>Reset Password</Text>
            <Text style={[styles.modalMessage, { color: colors.textSub }]}>
              Enter your registered Babcock email address below, and we&apos;ll send you a link to reset your password.
            </Text>

            <View style={[styles.inputWrapper, { backgroundColor: colors.background, borderColor: colors.border, marginBottom: 20, width: '100%' }]}>
              <Ionicons name="mail" size={20} color={colors.textSub} style={styles.inputIcon} />
              <TextInput
                style={[styles.input, { color: colors.text }]}
                placeholder="name@student.babcock.edu.ng"
                placeholderTextColor={colors.textSub}
                value={resetEmail}
                onChangeText={setResetEmail}
                autoCapitalize="none"
                keyboardType="email-address"
                autoCorrect={false}
              />
            </View>

            <View style={styles.modalButtonRow}>
              <TouchableOpacity 
                style={[styles.secondaryHalfButton, { borderColor: colors.border }]} 
                onPress={() => setShowResetModal(false)}
                disabled={isResetting}
              >
                <Text style={[styles.secondaryButtonText, { color: colors.text }]}>Cancel</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[styles.primaryHalfButton, { backgroundColor: colors.accent }]} 
                onPress={handlePasswordReset}
                disabled={isResetting}
              >
                {isResetting ? (
                  <ActivityIndicator color="#FFF" />
                ) : (
                  <Text style={styles.primaryButtonText}>Send Link</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  scrollContent: { flexGrow: 1, paddingHorizontal: 30, justifyContent: 'center', paddingBottom: 40 },
  headerSection: { alignItems: 'center', marginBottom: 50 },
  logoContainer: { marginBottom: 20, elevation: 15, shadowOffset: { width: 0, height: 10 }, shadowRadius: 20 },
  logoCircle: { width: 100, height: 100, borderRadius: 50, justifyContent: 'center', alignItems: 'center', borderWidth: 1.5 },
  mainTitle: { fontSize: 30, fontWeight: '900', letterSpacing: -0.5 },
  subTitle: { fontSize: 14, fontWeight: '800', letterSpacing: 2, marginTop: 5 },
  formSection: { marginBottom: 20 },
  inputContainer: { marginBottom: 25 },
  inputLabel: { fontSize: 11, fontWeight: '800', letterSpacing: 1.5, marginBottom: 10, marginLeft: 5 },
  inputWrapper: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 16, paddingHorizontal: 18, height: 60 },
  inputIcon: { marginRight: 15 },
  input: { flex: 1, fontSize: 16, fontWeight: '600' },
  
  forgotPasswordBtn: { alignSelf: 'flex-end', marginTop: 12, paddingVertical: 5 },
  forgotPasswordText: { fontSize: 13, fontWeight: '700' },
  
  loginButton: { flexDirection: 'row', borderRadius: 18, height: 60, justifyContent: 'center', alignItems: 'center', elevation: 8, shadowColor: '#000', shadowOpacity: 0.2 },
  loginButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: 'bold', letterSpacing: 1 },
  
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  modalBox: { width: '100%', maxWidth: 350, borderRadius: 24, padding: 25, alignItems: 'center', elevation: 10, shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 15, borderWidth: 1 },
  modalIconContainer: { width: 70, height: 70, borderRadius: 35, justifyContent: 'center', alignItems: 'center', marginBottom: 20 },
  modalTitle: { fontSize: 20, fontWeight: 'bold', marginBottom: 10, textAlign: 'center' },
  modalMessage: { fontSize: 14, lineHeight: 22, textAlign: 'center', marginBottom: 25 },
  modalButton: { width: '100%', height: 50, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
  modalButtonText: { color: '#FFF', fontSize: 16, fontWeight: 'bold', letterSpacing: 1 },
  
  // New Modal Button Layouts
  modalButtonRow: { flexDirection: 'row', width: '100%', justifyContent: 'space-between' },
  secondaryHalfButton: { flex: 1, paddingVertical: 14, borderRadius: 14, alignItems: 'center', marginRight: 10, borderWidth: 1 },
  primaryHalfButton: { flex: 1, paddingVertical: 14, borderRadius: 14, alignItems: 'center', marginLeft: 10 },
  primaryButtonText: { color: '#FFF', fontSize: 15, fontWeight: 'bold' },
  secondaryButtonText: { fontSize: 15, fontWeight: '600' },

  adminPortalLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 24,
    paddingVertical: 10,
    opacity: 0.75,
  },
  adminPortalText: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  resendBtn: {
    paddingVertical: 10,
    width: '100%',
    alignItems: 'center',
  },
  resendBtnText: {
    fontSize: 14,
    fontWeight: 'bold',
    textDecorationLine: 'underline',
  },
});