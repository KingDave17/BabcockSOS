import React, { useState } from 'react';
import {
  StyleSheet, Text, View, TextInput, TouchableOpacity,
  KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator, Modal
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../firebaseConfig';
import { useTheme } from '../hooks/ThemeContext';

export default function AdminLoginScreen() {
  const { colors, isDarkMode } = useTheme();
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  const [alertConfig, setAlertConfig] = useState({
    visible: false,
    title: '',
    message: '',
    type: 'error' as 'error' | 'success',
  });

  const showAlert = (title: string, message: string, type: 'error' | 'success' = 'error') => {
    setAlertConfig({ visible: true, title, message, type });
  };

  const handleAdminLogin = async () => {
    if (!email.trim() || !password) {
      showAlert('Missing Fields', 'Please enter your admin email and password.');
      return;
    }

    setIsLoggingIn(true);
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email.trim().toLowerCase(), password);

      if (!userCredential.user.emailVerified) {
        await signOut(auth);
        showAlert('Email Not Verified', 'Please verify your email before accessing the admin panel.');
        return;
      }

      // Verify admin role in Firestore
      const docRef = doc(db, 'users', userCredential.user.uid);
      const docSnap = await getDoc(docRef);

      if (!docSnap.exists() || docSnap.data()?.role !== 'admin') {
        await signOut(auth);
        showAlert(
          'Access Denied',
          'This account does not have administrator privileges. Contact your system administrator.'
        );
        return;
      }

      // Admin verified — navigate to admin panel
      router.replace('/(admin)/dashboard' as never);
    } catch (error: any) {
      console.error('Admin Login Error:', error);
      showAlert('Login Failed', 'Invalid credentials. Please check your email and password.');
    } finally {
      setIsLoggingIn(false);
    }
  };

  const isError = alertConfig.type === 'error';

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: isDarkMode ? '#0F0F1A' : '#0F0F1A' }]}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Back to regular login */}
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
            <Ionicons name="chevron-back" size={20} color="#A78BFA" />
            <Text style={styles.backBtnText}>Back to App Login</Text>
          </TouchableOpacity>

          {/* Header */}
          <View style={styles.headerSection}>
            <View style={styles.logoContainer}>
              <View style={styles.logoRing}>
                <LinearGradientFallback />
                <MaterialCommunityIcons name="shield-crown" size={48} color="#A78BFA" />
              </View>
            </View>
            <Text style={styles.mainTitle}>Admin Portal</Text>
            <Text style={styles.subTitle}>BABCOCK EMERGENCY SYSTEM</Text>
            <View style={styles.warningBadge}>
              <Ionicons name="lock-closed" size={12} color="#F59E0B" />
              <Text style={styles.warningText}>RESTRICTED ACCESS</Text>
            </View>
          </View>

          {/* Form */}
          <View style={styles.formSection}>
            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>ADMIN EMAIL</Text>
              <View style={styles.inputWrapper}>
                <Ionicons name="mail" size={20} color="#6B7280" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="admin@babcock.edu.ng"
                  placeholderTextColor="#4B5563"
                  value={email}
                  onChangeText={setEmail}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  autoCorrect={false}
                />
              </View>
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>PASSWORD</Text>
              <View style={styles.inputWrapper}>
                <Ionicons name="lock-closed-outline" size={20} color="#6B7280" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="••••••••••••"
                  placeholderTextColor="#4B5563"
                  secureTextEntry={!showPassword}
                  value={password}
                  onChangeText={setPassword}
                />
                <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={{ padding: 5 }}>
                  <Ionicons
                    name={showPassword ? 'eye-outline' : 'eye-off-outline'}
                    size={20}
                    color="#6B7280"
                  />
                </TouchableOpacity>
              </View>
            </View>

            <TouchableOpacity
              style={[styles.loginButton, isLoggingIn && { opacity: 0.7 }]}
              onPress={handleAdminLogin}
              disabled={isLoggingIn}
              activeOpacity={0.85}
            >
              {isLoggingIn ? (
                <ActivityIndicator color="#FFF" />
              ) : (
                <>
                  <MaterialCommunityIcons name="shield-crown" size={20} color="#FFF" style={{ marginRight: 10 }} />
                  <Text style={styles.loginButtonText}>AUTHENTICATE</Text>
                </>
              )}
            </TouchableOpacity>
          </View>

          <Text style={styles.footerNote}>
            Administrator access is monitored and logged.{'\n'}Unauthorized access attempts are prohibited.
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Alert Modal */}
      <Modal visible={alertConfig.visible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <View style={[styles.modalIconContainer, { backgroundColor: isError ? '#2D0A0A' : '#0A2D1A' }]}>
              <Ionicons
                name={isError ? 'shield-outline' : 'checkmark-circle'}
                size={40}
                color={isError ? '#EF4444' : '#10B981'}
              />
            </View>
            <Text style={styles.modalTitle}>{alertConfig.title}</Text>
            <Text style={styles.modalMessage}>{alertConfig.message}</Text>
            <TouchableOpacity
              style={[styles.modalButton, { backgroundColor: isError ? '#7C3AED' : '#10B981' }]}
              onPress={() => setAlertConfig(prev => ({ ...prev, visible: false }))}
            >
              <Text style={styles.modalButtonText}>UNDERSTOOD</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

// Simple fallback since we don't want to add expo-linear-gradient dependency
function LinearGradientFallback() {
  return (
    <View style={StyleSheet.absoluteFill} />
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 28,
    paddingBottom: 40,
  },

  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 16,
    paddingBottom: 8,
    alignSelf: 'flex-start',
  },
  backBtnText: {
    color: '#A78BFA',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 4,
  },

  headerSection: {
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 48,
  },
  logoContainer: {
    marginBottom: 24,
  },
  logoRing: {
    width: 110,
    height: 110,
    borderRadius: 55,
    borderWidth: 2,
    borderColor: '#7C3AED',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#1A0A2E',
    shadowColor: '#7C3AED',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 20,
    elevation: 15,
  },
  mainTitle: {
    fontSize: 34,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: -0.5,
  },
  subTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: '#7C3AED',
    letterSpacing: 2.5,
    marginTop: 6,
  },
  warningBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1C1406',
    borderWidth: 1,
    borderColor: '#78350F',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 100,
    marginTop: 16,
    gap: 6,
  },
  warningText: {
    color: '#F59E0B',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.5,
  },

  formSection: { marginBottom: 24 },
  inputContainer: { marginBottom: 24 },
  inputLabel: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.5,
    color: '#6B7280',
    marginBottom: 10,
    marginLeft: 4,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 18,
    height: 60,
    backgroundColor: '#1A1A2E',
    borderColor: '#2D2D4A',
  },
  inputIcon: { marginRight: 14 },
  input: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },

  loginButton: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#7C3AED',
    borderRadius: 18,
    height: 62,
    marginTop: 8,
    elevation: 10,
    shadowColor: '#7C3AED',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.5,
    shadowRadius: 16,
  },
  loginButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: 2,
  },

  footerNote: {
    color: '#374151',
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 20,
    marginTop: 'auto',
    paddingTop: 20,
  },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.8)',
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
    backgroundColor: '#13131F',
    borderWidth: 1,
    borderColor: '#2D2D4A',
  },
  modalIconContainer: {
    width: 76,
    height: 76,
    borderRadius: 38,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 10,
    textAlign: 'center',
  },
  modalMessage: {
    fontSize: 14,
    lineHeight: 22,
    textAlign: 'center',
    color: '#9CA3AF',
    marginBottom: 24,
  },
  modalButton: {
    width: '100%',
    height: 50,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalButtonText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 1.5,
  },
});
