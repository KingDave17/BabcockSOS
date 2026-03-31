import React, { useEffect } from 'react';
import { View, Platform } from 'react-native';
import * as SplashScreen from 'expo-splash-screen';
import { Stack, useRouter, useSegments } from 'expo-router';
import { ThemeProvider } from '../hooks/ThemeContext';
import { AuthProvider, useAuth } from '../hooks/AuthContext';
import { LocationProvider } from '../hooks/LocationContext';

// 2. TELL EXPO TO HOLD THE NATIVE SPLASH SCREEN
SplashScreen.preventAutoHideAsync();

function AuthGuardLayout() {
  const { user, profile, isLoading } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  // 3. HIDE THE SPLASH SCREEN WHEN AUTH IS DONE LOADING
  useEffect(() => {
    if (!isLoading) {
      SplashScreen.hideAsync();
    }
  }, [isLoading]);

  useEffect(() => {
    if (isLoading) return;

    const currentSegment = (segments && segments.length > 0) ? String(segments[0]) : '';
    const isTabs = currentSegment === '(tabs)';
    const isAdmin = currentSegment === '(admin)';
    const isLogin = currentSegment === 'login';
    const isAdminLogin = currentSegment === 'admin-login';
    const isRegister = currentSegment === 'register';
    const isAlerts = currentSegment === 'alertsModal';
    const isPrivacy = currentSegment === 'privacy';

    const hasValidSession = user && user.emailVerified;
    const isAdminRole = profile?.role === 'admin';

    if (!hasValidSession && !isLogin && !isAdminLogin && !isRegister) {
      router.replace('/login' as never);
    } else if (hasValidSession && profile) {
      // Admin users go to /(admin)
      if (isAdminRole && !isAdmin) {
        router.replace('/(admin)/dashboard' as never);
      }
      // Regular users go to /(tabs), block them from admin
      else if (!isAdminRole && !isTabs && !isAlerts && !isPrivacy && !isAdminLogin) {
        router.replace('/(tabs)' as never);
      }
    }
  }, [user, profile, isLoading, segments, router]);


  // 4. RETURN NULL INSTEAD OF THE BLACK SCREEN/SPINNER
  // The native splash screen will continue showing over this empty space
  if (isLoading) {
    return null; 
  }

  return (
    <View style={Platform.OS === 'web' ? { width: 390, height: 750, alignSelf: 'center', marginTop: 30, borderRadius: 40, overflow: 'hidden', borderWidth: 14, borderColor: '#222', backgroundColor: '#fff', boxShadow: '0px 10px 30px rgba(0,0,0,0.2)' } : { flex: 1 }}>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="login" />
        <Stack.Screen name="admin-login" />
        <Stack.Screen name="register" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="(admin)" />
        <Stack.Screen name="alertsModal" options={{ presentation: 'modal' }} />
        <Stack.Screen name="privacy" options={{ presentation: 'modal' }} />
      </Stack>
    </View>
  );
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <LocationProvider>
        <ThemeProvider>
          <AuthGuardLayout />
        </ThemeProvider>
      </LocationProvider>
    </AuthProvider>
  );
}