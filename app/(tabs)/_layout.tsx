import { Tabs } from 'expo-router';
import React, { useState, useEffect } from 'react';
import { Platform, View, StyleSheet, Text, TouchableOpacity } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as LocalAuthentication from 'expo-local-authentication'; // NEW: Biometric Import

import { useTheme } from '../../hooks/ThemeContext'; 
import { useAuth } from '../../hooks/AuthContext'; 

export default function TabLayout() {
  const insets = useSafeAreaInsets();
  const { colors, isDarkMode } = useTheme(); 
  const { profile } = useAuth(); 

  const isStaff = profile?.role === 'medical' || profile?.role === 'security' || profile?.role === 'fire';

  // NEW: Biometric Security States
  const [isAuthenticated, setIsAuthenticated] = useState(!isStaff); // Students start as true, Staff start as false
  const [authFailed, setAuthFailed] = useState(false);

  // NEW: The Biometric Trigger
  const authenticateStaff = async () => {
    try {
      // 1. Check if the device has a fingerprint/FaceID scanner
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      // 2. Check if the user has actually set up a fingerprint/FaceID on their phone
      const isEnrolled = await LocalAuthentication.isEnrolledAsync();

      // If no hardware or no fingerprints are enrolled, allow access (Failsafe for emulators/testing)
      if (!hasHardware || !isEnrolled) {
        setIsAuthenticated(true);
        return;
      }

      // 3. Prompt the scanner!
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Verify Identity for Dispatch Access',
        fallbackLabel: 'Use Passcode',
        cancelLabel: 'Cancel',
        disableDeviceFallback: false, // Allows them to use their phone PIN if the fingerprint fails
      });

      if (result.success) {
        setIsAuthenticated(true);
        setAuthFailed(false);
      } else {
        setAuthFailed(true);
      }
    } catch (error) {
      console.error("Biometric error:", error);
      setIsAuthenticated(true); // Ultimate failsafe so you don't get locked out during your defense if it bugs out
    }
  };

  // Run the check as soon as the layout loads
  useEffect(() => {
    if (isStaff) {
      authenticateStaff();
    } else {
      setIsAuthenticated(true);
    }
  }, [isStaff]);

  // ==========================================
  // 🔒 THE LOCKED SCREEN (Only shows if Staff fails Biometrics)
  // ==========================================
  if (isStaff && !isAuthenticated) {
    return (
      <View style={[styles.lockedContainer, { backgroundColor: colors.background }]}>
        <MaterialCommunityIcons name="shield-lock" size={90} color={colors.textSub} style={{ marginBottom: 20, opacity: 0.5 }} />
        <Text style={[styles.lockedTitle, { color: colors.text }]}>Dispatch Locked</Text>
        <Text style={[styles.lockedSub, { color: colors.textSub }]}>
          Biometric verification is required to access secure student data and live campus telemetry.
        </Text>
        
        {authFailed && (
          <TouchableOpacity 
            style={styles.retryBtn} 
            onPress={authenticateStaff}
            activeOpacity={0.8}
          >
            <Ionicons name="lock-closed" size={24} color="#FFF" style={{ marginRight: 10 }} />
            <Text style={styles.retryBtnText}>Verify Identity</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  }

  // ==========================================
  // 📱 THE TABS (Shows if Student, or if Staff passed Biometrics)
  // ==========================================
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: profile?.role === 'fire' ? '#F59E0B' : isStaff ? '#3B82F6' : '#DC2626', // Orange for fire, Blue for other staff, Red for students
        tabBarInactiveTintColor: colors.textSub, 
        tabBarStyle: {
          position: 'absolute',
          backgroundColor: colors.surface, 
          borderTopWidth: 1,
          borderTopColor: colors.border, 
          elevation: 10,
          shadowColor: '#000',
          shadowOpacity: isDarkMode ? 0.3 : 0.1,
          shadowOffset: { width: 0, height: -2 },
          shadowRadius: 10,
          height: Platform.OS === 'ios' ? 90 : 70 + (insets?.bottom || 0),
          paddingBottom: Platform.OS === 'ios' ? 25 : (insets?.bottom || 0) + 5,
          paddingTop: 10,
        },
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: '600',
          marginTop: -5,
        },
      }}>
      
      {/* 1. DISPATCH / HOME TAB */}
      <Tabs.Screen
        name="index"
        options={{
          title: isStaff ? 'Dispatch' : 'Home',
          tabBarIcon: ({ color, focused }) => (
            isStaff ? (
              <Ionicons name={focused ? 'shield-checkmark' : 'shield-checkmark-outline'} size={24} color={color} />
            ) : (
              <Ionicons name={focused ? 'home' : 'home-outline'} size={24} color={color} />
            )
          ),
        }}
      />

      {/* 2. STAFF MAP TAB (Hidden for Students) */}
      <Tabs.Screen
        name="map"
        options={{
          href: isStaff ? undefined : null, 
          title: 'Live Map',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'map' : 'map-outline'} size={24} color={color} />
          ),
        }}
      />

      {/* 3. STAFF HISTORY TAB (Hidden for Students) */}
      <Tabs.Screen
        name="history"
        options={{
          href: isStaff ? undefined : null, 
          title: 'Logs',
          tabBarIcon: ({ color }) => (
            <MaterialCommunityIcons name="clipboard-text-clock" size={24} color={color} />
          ),
        }}
      />
      
      {/* 4. STUDENT REPORT TAB (Hidden for Staff) */}
      <Tabs.Screen
        name="report"
        options={{
          href: isStaff ? null : undefined, 
          title: 'Report',
          tabBarIcon: ({ color }) => (
            <MaterialCommunityIcons name="history" size={26} color={color} />
          ),
        }}
      />
      
      {/* 5. STUDENT ALERTS TAB (Hidden for Staff) */}
      <Tabs.Screen
        name="alerts"
        options={{
          href: isStaff ? null : undefined, 
          title: 'Alerts',
          tabBarLabelStyle: {
              color: '#DC2626', 
              fontSize: 10,
              fontWeight: 'bold',
              marginTop: 5, 
          },
          tabBarIcon: () => (
            <View style={styles.floatingButton}>
              <Ionicons name="notifications" size={28} color="#FFFFFF" />
            </View>
          ),
        }}
      />
      
      {/* 6. STUDENT SAFETY TAB (Hidden for Staff) */}
      <Tabs.Screen
        name="safety"
        options={{
          href: isStaff ? null : undefined, 
          title: 'Safety',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'book' : 'book-outline'} size={24} color={color} />
          ),
        }}
      />
      
      {/* 7. PROFILE TAB (Visible to Everyone) */}
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'person' : 'person-outline'} size={24} color={color} />
          ),
        }}
      />
      
    </Tabs>
  );
}

const styles = StyleSheet.create({
  floatingButton: {
    backgroundColor: '#DC2626',
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 30, 
    shadowColor: '#DC2626',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  // NEW: Styles for the Lock Screen
  lockedContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 30,
  },
  lockedTitle: {
    fontSize: 28,
    fontWeight: '900',
    marginBottom: 10,
  },
  lockedSub: {
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 40,
  },
  retryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#3B82F6',
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderRadius: 30,
    elevation: 5,
    shadowColor: '#3B82F6',
    shadowOpacity: 0.4,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 8,
  },
  retryBtnText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  }
});