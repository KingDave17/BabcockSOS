import React, { useState } from 'react';
import { 
  StyleSheet, Text, View, TextInput, TouchableOpacity, 
  KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator, Modal 
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../hooks/ThemeContext';
import { useRouter } from 'expo-router';
import { createUserWithEmailAndPassword, sendEmailVerification, signOut } from 'firebase/auth';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../firebaseConfig';

export default function RegisterScreen() {
  const { colors } = useTheme(); 
  const router = useRouter();
  
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);
  const [emailError, setEmailError] = useState('');

  // NEW: Custom Alert State
  const [alertConfig, setAlertConfig] = useState({
    visible: false,
    title: '',
    message: '',
    type: 'error' as 'error' | 'success',
    onConfirm: () => {}
  });

  // NEW: Function to trigger the custom modal
  const showAlert = (title: string, message: string, type: 'error' | 'success' = 'error', onConfirm?: () => void) => {
    setAlertConfig({
      visible: true,
      title,
      message,
      type,
      onConfirm: onConfirm || (() => setAlertConfig(prev => ({ ...prev, visible: false })))
    });
  };

  const handleRegister = async () => {
    setEmailError('');

    if (!firstName || !lastName || !email || !password || !confirmPassword) {
      showAlert("Missing Fields", "Please fill in all the details to register.", "error");
      return;
    }

    const cleanEmail = email.trim().toLowerCase();
    
    const isStudent = cleanEmail.endsWith('@student.babcock.edu.ng');
    const isStaff = cleanEmail.endsWith('@babcock.edu.ng') && !isStudent;

    if (!isStudent && !isStaff) {
      // Keep inline error for email domain as it's great UX
      setEmailError("Please use your official Babcock student or staff email.");
      return;
    }

    if (password !== confirmPassword) {
      showAlert("Password Mismatch", "Your passwords do not match. Please try again.", "error");
      return;
    }

    if (password.length < 6) {
      showAlert("Weak Password", "Password should be at least 6 characters long.", "error");
      return;
    }

    setIsRegistering(true);
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, cleanEmail, password);
      const user = userCredential.user;

      await setDoc(doc(db, 'users', user.uid), {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: cleanEmail,
        role: isStaff ? 'staff' : 'student', 
        createdAt: serverTimestamp(),
      });

      await sendEmailVerification(user);
      await signOut(auth); 

      // Trigger success modal and route to login upon clicking OK
      showAlert(
        "Registration Successful", 
        "A verification link has been sent to your Babcock email. Please verify your inbox before logging in.",
        "success",
        () => {
          setAlertConfig(prev => ({ ...prev, visible: false }));
          router.replace('/login' as never);
        }
      );
      
    } catch (error: any) {
      console.error("Registration Error: ", error);
      if (error.code === 'auth/email-already-in-use') {
        showAlert("Account Exists", "This email is already registered. If you haven't verified your email, please Log In to resend the link.", "error");
      } else {
        showAlert("Registration Failed", error.message, "error");
      }
    } finally {
      setIsRegistering(false);
    }
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]}>
      <KeyboardAvoidingView 
        style={{ flex: 1 }} 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView 
          contentContainerStyle={styles.scrollContent} 
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          
          <TouchableOpacity style={styles.backButton} onPress={() => router.replace('/login' as never)}>
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>

          <View style={styles.headerSection}>
            <Text style={[styles.mainTitle, { color: colors.text }]}>Create Account</Text>
            <Text style={[styles.subTitle, { color: colors.accent }]}>BABCOCK EMERGENCY</Text>
          </View>

          <View style={styles.formSection}>
            <View style={styles.inputContainer}>
              <Text style={[styles.inputLabel, { color: colors.textSub }]}>FIRST NAME</Text>
              <View style={[styles.inputWrapper, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <Ionicons name="person-outline" size={20} color={colors.textSub} style={styles.inputIcon} />
                <TextInput
                  style={[styles.input, { color: colors.text }]}
                  placeholder="e.g. David"
                  placeholderTextColor={colors.textSub}
                  value={firstName}
                  onChangeText={setFirstName}
                  autoCapitalize="words"
                />
              </View>
            </View>

            <View style={styles.inputContainer}>
              <Text style={[styles.inputLabel, { color: colors.textSub }]}>SURNAME</Text>
              <View style={[styles.inputWrapper, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <Ionicons name="people-outline" size={20} color={colors.textSub} style={styles.inputIcon} />
                <TextInput
                  style={[styles.input, { color: colors.text }]}
                  placeholder="e.g. Adeleke"
                  placeholderTextColor={colors.textSub}
                  value={lastName}
                  onChangeText={setLastName}
                  autoCapitalize="words"
                />
              </View>
            </View>

            <View style={styles.inputContainer}>
              <Text style={[styles.inputLabel, { color: colors.textSub }]}>BABCOCK EMAIL</Text>
              <View style={[styles.inputWrapper, { backgroundColor: colors.surface, borderColor: emailError ? '#DC2626' : colors.border }]}>
                <Ionicons name="mail-outline" size={20} color={emailError ? '#DC2626' : colors.textSub} style={styles.inputIcon} />
                <TextInput
                  style={[styles.input, { color: colors.text }]}
                  placeholder="name@student.babcock.edu.ng" 
                  placeholderTextColor={colors.textSub}
                  value={email}
                  onChangeText={(text) => {
                    setEmail(text);
                    if (emailError) setEmailError('');
                  }}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  autoCorrect={false}
                />
              </View>
              {emailError ? (
                <View style={styles.errorContainer}>
                  <Ionicons name="alert-circle" size={14} color="#DC2626" />
                  <Text style={styles.errorText}>{emailError}</Text>
                </View>
              ) : null}
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
            </View>

            <View style={styles.inputContainer}>
              <Text style={[styles.inputLabel, { color: colors.textSub }]}>CONFIRM PASSWORD</Text>
              <View style={[styles.inputWrapper, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <Ionicons name="shield-checkmark-outline" size={20} color={colors.textSub} style={styles.inputIcon} />
                <TextInput
                  style={[styles.input, { color: colors.text }]}
                  placeholder="••••••••••••"
                  placeholderTextColor={colors.textSub}
                  secureTextEntry={!showPassword}
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                />
              </View>
            </View>

            <TouchableOpacity style={[styles.loginButton, { backgroundColor: colors.accent }]} onPress={handleRegister} disabled={isRegistering} activeOpacity={0.8}>
              {isRegistering ? (
                <ActivityIndicator color="#FFF" />
              ) : (
                <>
                  <Text style={styles.loginButtonText}>SECURE REGISTRATION</Text>
                  <Ionicons name="shield-half" size={20} color="#FFF" style={{ marginLeft: 8 }} />
                </>
              )}
            </TouchableOpacity>
          </View>

        </ScrollView>
      </KeyboardAvoidingView>

      {/* NEW: Custom Animated Modal Overlay */}
      <Modal visible={alertConfig.visible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalBox, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            
            {/* Dynamic Icon Box */}
            <View style={[styles.modalIconContainer, { backgroundColor: alertConfig.type === 'success' ? '#DEF7EC' : '#FDE8E8' }]}>
              <Ionicons 
                name={alertConfig.type === 'success' ? "checkmark-circle" : "alert-circle"} 
                size={40} 
                color={alertConfig.type === 'success' ? '#059669' : '#DC2626'} 
              />
            </View>

            <Text style={[styles.modalTitle, { color: colors.text }]}>{alertConfig.title}</Text>
            <Text style={[styles.modalMessage, { color: colors.textSub }]}>{alertConfig.message}</Text>

            <TouchableOpacity 
              style={[styles.modalButton, { backgroundColor: alertConfig.type === 'success' ? '#059669' : colors.accent }]} 
              onPress={alertConfig.onConfirm}
              activeOpacity={0.8}
            >
              <Text style={styles.modalButtonText}>OK</Text>
            </TouchableOpacity>

          </View>
        </View>
      </Modal>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  scrollContent: { flexGrow: 1, paddingHorizontal: 30, paddingTop: 20, paddingBottom: 100 },
  backButton: { marginBottom: 20, alignSelf: 'flex-start', padding: 5 },
  headerSection: { alignItems: 'flex-start', marginBottom: 40 },
  mainTitle: { fontSize: 30, fontWeight: '900', letterSpacing: -0.5 },
  subTitle: { fontSize: 14, fontWeight: '800', letterSpacing: 2, marginTop: 5 },
  formSection: { marginBottom: 20 },
  inputContainer: { marginBottom: 20 },
  inputLabel: { fontSize: 11, fontWeight: '800', letterSpacing: 1.5, marginBottom: 8, marginLeft: 5 },
  inputWrapper: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 16, paddingHorizontal: 18, height: 60 },
  inputIcon: { marginRight: 15 },
  input: { flex: 1, fontSize: 16, fontWeight: '600' },
  loginButton: { flexDirection: 'row', borderRadius: 18, height: 60, justifyContent: 'center', alignItems: 'center', elevation: 8, shadowColor: '#000', shadowOpacity: 0.2, marginTop: 10 },
  loginButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: 'bold', letterSpacing: 1 },
  errorContainer: { flexDirection: 'row', alignItems: 'center', marginTop: 8, marginLeft: 5 },
  errorText: { color: '#DC2626', fontSize: 12, fontWeight: '600', marginLeft: 5 },
  
  // Custom Modal Styles
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  modalBox: { width: '100%', maxWidth: 340, borderRadius: 24, padding: 25, alignItems: 'center', elevation: 10, shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 15, borderWidth: 1 },
  modalIconContainer: { width: 70, height: 70, borderRadius: 35, justifyContent: 'center', alignItems: 'center', marginBottom: 20 },
  modalTitle: { fontSize: 20, fontWeight: 'bold', marginBottom: 10, textAlign: 'center' },
  modalMessage: { fontSize: 14, lineHeight: 22, textAlign: 'center', marginBottom: 25 },
  modalButton: { width: '100%', height: 50, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
  modalButtonText: { color: '#FFF', fontSize: 16, fontWeight: 'bold', letterSpacing: 1 }
});