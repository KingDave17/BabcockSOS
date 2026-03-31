import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  StyleSheet, Text, View, ScrollView, TouchableOpacity,
  PanResponder, Animated, Modal, Linking, Platform, AppState, ActivityIndicator, Dimensions
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import * as Haptics from 'expo-haptics';
let MapView: any = View;
let Marker: any = View;
if (Platform.OS !== 'web') {
  const maps = require('react-native-maps');
  MapView = maps.default;
  Marker = maps.Marker;
}
import { useRouter } from 'expo-router';
import { useIsFocused } from '@react-navigation/native';
import { Audio } from 'expo-av';
import * as SMS from 'expo-sms';
import * as Network from 'expo-network';
import AsyncStorage from '@react-native-async-storage/async-storage';

// FIRESTORE IMPORTS
import { collection, addDoc, updateDoc, doc, serverTimestamp, query, orderBy, limit, onSnapshot, where } from 'firebase/firestore';
import { db } from '../../firebaseConfig';

import { useTheme } from '../../hooks/ThemeContext';
import { useAuth } from '../../hooks/AuthContext';
import { useLocation } from '../../hooks/LocationContext';
import { getRefinedAddress } from '../../utils/location';
import { formatDistanceToNow } from 'date-fns';

// --- HELPER FUNCTIONS FOR NEARBY ALERTS ---
const getDistanceInMeters = (lat1?: number, lon1?: number, lat2?: number, lon2?: number) => {
  if (!lat1 || !lon1 || !lat2 || !lon2) return '--';
  const R = 6371e3;
  const rad = Math.PI / 180;
  const dLat = (lat2 - lat1) * rad;
  const dLon = (lon2 - lon1) * rad;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c);
};

// --- HELPER FUNCTIONS ---
const getSafeDate = (timestamp: any) => {
  if (!timestamp) return new Date();
  if (typeof timestamp.toDate === 'function') return timestamp.toDate();
  if (timestamp.seconds) return new Date(timestamp.seconds * 1000);
  return new Date(timestamp);
};

const formatTime = (timestamp: any) => {
  if (!timestamp) return 'Just now';
  try {
    return formatDistanceToNow(getSafeDate(timestamp), { addSuffix: true });
  } catch (e) {
    return 'Just now';
  }
};

const getTimeAgo = (timestamp: any) => formatTime(timestamp);

const getAlertStyling = (type: string, isDarkMode: boolean = false, isStaffView: boolean = false) => {
  if (isStaffView) {
    if (type.includes('Medical')) return { icon: 'medical-bag', color: '#DC2626', bg: isDarkMode ? '#1A0000' : '#FEE2E2', cardAccent: '#DC2626' };
    if (type.includes('Fire')) return { icon: 'fire', color: '#F59E0B', bg: isDarkMode ? '#1A1100' : '#FEF3C7', cardAccent: '#F59E0B' };
    if (type.includes('Security')) return { icon: 'shield-alert', color: '#3B82F6', bg: isDarkMode ? '#00081A' : '#DBEAFE', cardAccent: '#3B82F6' };
    if (type.includes('Accident')) return { icon: 'car-brake-alert', color: '#8B5CF6', bg: isDarkMode ? '#0D001A' : '#EDE9FE', cardAccent: '#8B5CF6' };
    return { icon: 'alert-octagram', color: '#DC2626', bg: isDarkMode ? '#1A0000' : '#FEE2E2', cardAccent: '#DC2626' };
  }

  if (type.includes('Medical')) return { icon: 'medical-bag', color: '#DC2626', bg: '#FEE2E2' };
  if (type.includes('Fire')) return { icon: 'fire', color: '#F59E0B', bg: '#FEF3C7' };
  if (type.includes('Security')) return { icon: 'shield-alert', color: '#3B82F6', bg: '#DBEAFE' };
  if (type.includes('Accident')) return { icon: 'car-brake-alert', color: '#8B5CF6', bg: '#EDE9FE' };
  return { icon: 'alert-octagram', color: '#DC2626', bg: '#FEE2E2' };
};

export default function HomeScreen() {
  const { colors, isDarkMode, toggleTheme } = useTheme();
  const { profile, user } = useAuth();
  const { userLocation, locationName, gpsStatus, requestPermission } = useLocation();
  const router = useRouter();
  const isFocused = useIsFocused();
  const appState = useRef(AppState.currentState);
  const firstName = profile?.firstName || user?.displayName?.split(' ')?.[0] || 'User';

  const [showNotifications, setShowNotifications] = useState(false);
  const [hasUnread, setHasUnread] = useState(false);
  const [broadcasts, setBroadcasts] = useState<any[]>([]);
  const [showLocationModal, setShowLocationModal] = useState(false);

  const [nearbyAlerts, setNearbyAlerts] = useState<any[]>([]);
  const [activeEmergencies, setActiveEmergencies] = useState<any[]>([]);
  const [customAlert, setCustomAlert] = useState({
    visible: false,
    title: '',
    message: '',
    type: 'success' as 'success' | 'error' | 'info'
  });
  const [confirmAlert, setConfirmAlert] = useState<{
    visible: boolean;
    type: string;
    icon: string;
    color: string;
  } | null>(null);

  const [isSOSActive, setIsSOSActive] = useState(false);
  const [activeAlertId, setActiveAlertId] = useState<string | null>(null);
  const [activeAlertData, setActiveAlertData] = useState<any>(null); // Store current alert data
  const [targetCoords, setTargetCoords] = useState<{ lat: number, lng: number } | null>(null);
  const [originCoords, setOriginCoords] = useState<{ lat: number, lng: number } | null>(null);
  const [respondingTo, setRespondingTo] = useState<string | null>(null);
  const [activeResponder, setActiveResponder] = useState<any>(null);
  const [isCancelling, setIsCancelling] = useState(false);
  const [showStatusModal, setShowStatusModal] = useState(false);

  const pulseAnim = useRef(new Animated.Value(1)).current;
  const pan = useRef(new Animated.ValueXY()).current;
  const cancelAnim = useRef(new Animated.Value(0)).current;
  const slideDistance = Dimensions.get('window').width - 105;
  const mapRef = useRef<any>(null);
  const triggerSOSRef = useRef<(() => void) | null>(null);
  const isFirstStaffLoad = useRef(true);
  const cancelledAlertId = useRef<string | null>(null);

  const playStaffAlarm = async () => {
    try {
      const { sound } = await Audio.Sound.createAsync(
        require('../../assets/alert.mp3')
      );
      await sound.playAsync();
      sound.setOnPlaybackStatusUpdate((status) => {
        if (status.isLoaded && status.didJustFinish) {
          sound.unloadAsync();
        }
      });
    } catch (error) {
      console.log("Could not play alarm sound:", error);
    }
  };

  useEffect(() => {
    pulseAnim.setValue(1);
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: isSOSActive ? 2.5 : 1.5, duration: isSOSActive ? 400 : 1000, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: isSOSActive ? 400 : 1000, useNativeDriver: true }),
      ])
    ).start();
  }, [pulseAnim, isSOSActive]);

  // --- LOCAL PERSISTENCE (AsyncStorage) ---
  const saveSOSState = async (active: boolean, id: string | null) => {
    try {
      if (active || id) {
        await AsyncStorage.setItem('sos_persistence_state', JSON.stringify({ isSOSActive: active, activeAlertId: id }));
      } else {
        await AsyncStorage.removeItem('sos_persistence_state');
      }
    } catch (e) {
      console.error("Save state error:", e);
    }
  };

  useEffect(() => {
    const loadState = async () => {
      try {
        const saved = await AsyncStorage.getItem('sos_persistence_state');
        if (saved) {
          const { isSOSActive: sActive, activeAlertId: sId } = JSON.parse(saved);
          if (sActive) {
            setIsSOSActive(true);
            Animated.spring(pan, { toValue: { x: slideDistance, y: 0 }, useNativeDriver: false }).start();
          }
          if (sId) setActiveAlertId(sId);
        }
      } catch (e) {
        console.error("Load state error:", e);
      }
    };
    loadState();
  }, []);

  // Save to storage whenever state changes
  useEffect(() => {
    if (!isCancelling) {
      saveSOSState(isSOSActive, activeAlertId);
    }
  }, [isSOSActive, activeAlertId, isCancelling]);

  useEffect(() => {
    if (isSOSActive && activeAlertId && userLocation) {
      const updateLiveLocation = async () => {
        try {
          await updateDoc(doc(db, 'alerts', activeAlertId), {
            'location.latitude': userLocation.coords.latitude,
            'location.longitude': userLocation.coords.longitude,
            lastUpdated: serverTimestamp()
          });
        } catch (error) {
          console.log("Live sync background error:", error);
        }
      };
      updateLiveLocation();
    }

    if (respondingTo && userLocation) {
      const syncResponderLocation = async () => {
        try {
          await updateDoc(doc(db, 'alerts', respondingTo), {
            responderLocation: {
              latitude: userLocation.coords.latitude,
              longitude: userLocation.coords.longitude
            },
            responderLastUpdated: serverTimestamp()
          });
        } catch (error) {
          console.error("Responder sync error:", error);
        }
      };
      syncResponderLocation();
    }
  }, [userLocation, isSOSActive, activeAlertId, respondingTo]);

  // --- SOS TRACKING (Monitor the current active alert for status changes) ---
  useEffect(() => {
    if (activeAlertId) {
      const unsubscribe = onSnapshot(doc(db, 'alerts', activeAlertId), (snapshot) => {
        if (snapshot.exists()) {
          const data = snapshot.data();
          // Update local data to reflect changes immediately
          setActiveAlertData({ id: snapshot.id, ...data });

          if (data.status === 'Responding') {
            setActiveResponder({
              name: data.responderName,
              role: data.responderRole,
              location: data.responderLocation
            });
          }
        } else {
          // Document was deleted
          setIsSOSActive(false);
          setActiveAlertId(null);
          setActiveAlertData(null);
          setActiveResponder(null);
          Animated.spring(pan, { toValue: { x: 0, y: 0 }, useNativeDriver: false }).start();
          saveSOSState(false, null);
        }
      });
      return () => unsubscribe();
    }
  }, [activeAlertId]);

  // --- AUTO-CLOSE LOGIC (Sign of Completion) ---
  // When an incident is marked as 'Resolved' by personnel, we show an affirmation and then auto-close.
  useEffect(() => {
    if (activeAlertData?.status === 'Resolved') {
      // 1. Immediately trigger success haptic
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      // 2. Set a timer to close the "View Incident Status" modal and reset all SOS states
      const timer = setTimeout(() => {
        setShowStatusModal(false);
        setIsSOSActive(false);
        setActiveAlertId(null);
        setActiveAlertData(null);
        setActiveResponder(null);

        // Reset the main screen slider and persistence
        Animated.spring(pan, { toValue: { x: 0, y: 0 }, useNativeDriver: false }).start();
        saveSOSState(false, null);
      }, 3500); // 3.5 seconds to show "COMPLETED" affirmation

      return () => clearTimeout(timer);
    }
  }, [activeAlertData?.status]);

  // --- INCIDENT PERSISTENCE (Resume state if app reloads/tabs switch) ---
  useEffect(() => {
    if (user && (profile?.role === 'student' || !profile?.role) && !isSOSActive && !isCancelling) {
      // 💡 REWRITTEN QUERY TO AVOID COMPOSITE INDEX
      // We query only by senderId and then filter/sort in memory.
      const q = query(
        collection(db, 'alerts'),
        where('senderId', '==', user.uid),
        limit(10) // Get recent ones to find the active SOS
      );
      
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const userAlerts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as any[];
        
        // Filter for active/responding alerts and sort by timestamp in JS
        const activeAlert = userAlerts
          .filter(a => ['Active', 'Responding'].includes(a.status))
          .sort((a, b) => {
             const tA = getSafeDate(a.timestamp).getTime();
             const tB = getSafeDate(b.timestamp).getTime();
             return tB - tA;
          })[0];

        if (activeAlert) {
          // Guard: Don't resume an alert we JUST manually cancelled
          if (activeAlert.id === cancelledAlertId.current) return;
          
          setActiveAlertId(activeAlert.id);
          setActiveAlertData(activeAlert);
          
          // 💡 ONLY trigger high-urgency blinking if it's a Critical SOS
          if (activeAlert.type === 'Critical SOS') {
            setIsSOSActive(true);
            // Snap slider to active position
            Animated.spring(pan, { toValue: { x: slideDistance, y: 0 }, useNativeDriver: false }).start();
          } else {
            setIsSOSActive(false);
            // Regular alerts just show the tracking bar
          }
          
          // Also sync to local storage for extra safety
          saveSOSState(activeAlert.type === 'Critical SOS', activeAlert.id);
        } else {
          // Only clear if we are NOT in the middle of a local SOS trigger
          if (!isSOSActive && !activeAlertId) {
            setIsSOSActive(false);
            setActiveAlertId(null);
            setActiveAlertData(null);
            saveSOSState(false, null);
          }
        }

      });
      return () => unsubscribe();
    }
  }, [user, profile?.role, isSOSActive, isCancelling]);

  useEffect(() => {
    if (profile?.role === 'student' || !profile?.role) {
      const q = query(collection(db, 'alerts'), orderBy('timestamp', 'desc'), limit(15));
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const activeAlerts = snapshot.docs
          .map(doc => ({ id: doc.id, ...doc.data() }))
          .filter((alert: any) => alert.status === 'Active')
          .slice(0, 3);
        setNearbyAlerts(activeAlerts);
      });
      return () => unsubscribe();
    }
  }, [profile?.role]);

  useEffect(() => {
    const q = query(collection(db, 'broadcasts'), orderBy('timestamp', 'desc'), limit(10));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setBroadcasts(data || []);
      
      // Check for unread notifications
      const unreadCount = (data || []).filter((n: any) => !n.read).length;
      setHasUnread(unreadCount > 0);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (profile?.role === 'medical' || profile?.role === 'security' || profile?.role === 'fire') {
      const q = query(collection(db, 'alerts'), orderBy('timestamp', 'desc'));
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const changes = snapshot.docChanges();
        
        // Find if any RELEVANT new alert was added
        const relevantNewAlert = changes.some(change => {
          if (change.type !== 'added') return false;
          const alert = change.doc.data();
          if (alert.status !== 'Active') return false;

          // Filter by role
          if (profile.role === 'medical') {
            return alert.type?.includes('Medical') || alert.type?.includes('Accident');
          } else if (profile.role === 'security') {
            return alert.type?.includes('Security') || alert.type === 'Critical SOS';
          } else if (profile.role === 'fire') {
            return alert.type?.includes('Fire');
          }
          return false;
        });

        const activeAlerts = snapshot.docs
          .map(doc => {
            const data = doc.data() as any;
            return { id: doc.id, ...data };
          })
          .filter((alert: any) => {
             // Show alerts that are Active OR that I am currently Responding to
             const isActive = alert.status === 'Active';
             const isMeResponding = alert.status === 'Responding' && alert.responderId === user?.uid;
             const isOthersResponding = alert.status === 'Responding' && alert.responderId !== user?.uid;

             if (!isActive && !isMeResponding && !isOthersResponding) return false;

             if (profile.role === 'medical') return alert.type?.includes('Medical') || alert.type?.includes('Accident');
             if (profile.role === 'security') return alert.type?.includes('Security') || alert.type === 'Critical SOS';
             if (profile.role === 'fire') return alert.type?.includes('Fire');
             return false;
          });

        const myActiveResponse = activeAlerts.find(a => a.status === 'Responding' && a.responderId === user?.uid);
        setRespondingTo(myActiveResponse ? myActiveResponse.id : null);
        if (!isFirstStaffLoad.current && relevantNewAlert) {
          playStaffAlarm();
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        }

        isFirstStaffLoad.current = false;
        setActiveEmergencies(activeAlerts);
      });
      return () => unsubscribe();
    }
  }, [profile?.role]);

  // All location logic is now managed globally in LocationContext
  // --- SOS SLIDER TRIGGER (Instant UI update, background upload) ---
  triggerSOSRef.current = async () => {
    if (!user || !userLocation) {
      setCustomAlert({
        visible: true,
        title: 'GPS Signal Required',
        message: 'Please wait for your GPS signal to stabilize before triggering an SOS.',
        type: 'info'
      });
      return;
    }

    const snapLocation = { ...userLocation.coords }; // snapshot before any await

    // 🔥 Background: network check + geocode + upload
    (async () => {
      try {
        const networkState = await Network.getNetworkStateAsync();
        const isOffline = networkState.isConnected === false || networkState.isInternetReachable === false;

        // OFFLINE: SMS fallback
        if (isOffline) {
          const isAvailable = await SMS.isAvailableAsync();
          if (isAvailable) {
            const mapsLink = `http://maps.google.com/?q=${snapLocation.latitude},${snapLocation.longitude}`;
            await SMS.sendSMSAsync(
              ['08000000000'],
              `URGENT SOS! I need security assistance.\n\nName: ${profile?.firstName} ${profile?.lastName || ''}\nRole: ${profile?.role || 'student'}\nLocation: Babcock University\n\nMap: ${mapsLink}`
            );
          } else {
            setCustomAlert({ visible: true, title: "Delivery Failed", message: "No internet and SMS is unavailable on this device.", type: 'error' });
          }
          setIsSOSActive(false);
          Animated.spring(pan, { toValue: { x: 0, y: 0 }, useNativeDriver: false }).start();
          return;
        }

        // Geocode in background — SOS UI is already active
        let locName = await getRefinedAddress(snapLocation.latitude, snapLocation.longitude);

        const docRef = await addDoc(collection(db, 'alerts'), {
          type: 'Critical SOS',
          description: 'Immediate SOS triggered via slider.',
          locationName: locName,
          senderId: user.uid,
          senderName: `${profile?.firstName} ${profile?.lastName || ''}`.trim(),
          senderRole: profile?.role || 'student',
          location: { latitude: snapLocation.latitude, longitude: snapLocation.longitude },
          status: 'Active',
          timestamp: serverTimestamp(),
        });
        setActiveAlertId(docRef.id);
      } catch (error) {
        console.error("SOS Trigger Error:", error);
        setCustomAlert({ visible: true, title: "Connection Error", message: "Failed to broadcast SOS.", type: 'error' });
        setIsSOSActive(false);
        Animated.spring(pan, { toValue: { x: 0, y: 0 }, useNativeDriver: false }).start();
      }
    })();
  };

  const cancelSOSAlertInDB = async () => {
    const alertIdToCancel = activeAlertId;
    if (alertIdToCancel) cancelledAlertId.current = alertIdToCancel;

    // 1. Instantly update local UI
    setIsCancelling(true);
    setIsSOSActive(false);
    setActiveAlertId(null);
    setActiveResponder(null);
    Animated.spring(pan, { toValue: { x: 0, y: 0 }, useNativeDriver: false }).start();
    cancelAnim.setValue(0);
    pulseAnim.setValue(1);
    await saveSOSState(false, null); // Clear local storage instantly

    if (alertIdToCancel) {
      try {
        // 2. Update Firestore
        await updateDoc(doc(db, 'alerts', alertIdToCancel), {
          status: 'Resolved - User Canceled',
          resolvedAt: serverTimestamp()
        });
      } catch (error) {
        console.error("Error canceling SOS in DB:", error);
      }
    }
    
    setCustomAlert({ visible: true, title: "SOS Canceled", message: "Your emergency alert has been safely resolved.", type: 'success' });
    
    // 3. Clear cancelling state after a delay to allow DB to propagate
    setTimeout(() => setIsCancelling(false), 5000);
  };

  // --- QUICK REPORT TRIGGER (Instant feedback, background upload) ---
  const handleQuickReportConfirm = async () => {
    if (!confirmAlert || !user || !userLocation) {
      setConfirmAlert(null);
      setCustomAlert({ visible: true, title: "Location Missing", message: "Cannot send report without active GPS signal.", type: 'error' });
      return;
    }
    const reportType = confirmAlert.type;
    const snapLocation = { ...userLocation.coords }; // snapshot now before any await

    // 🚀 INSTANT: Close confirm + show success immediately
    setConfirmAlert(null);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setCustomAlert({ visible: true, title: "Alert Sent", message: `Your ${reportType} report has been sent. Tracking is active.`, type: 'success' });

    // 🔥 Background: network check + geocode + upload (doesn't block UI)
    (async () => {
      try {
        const networkState = await Network.getNetworkStateAsync();
        const isOffline = networkState.isConnected === false || networkState.isInternetReachable === false;

        let docRef;
        if (!isOffline) {
          // Geocode in background — won't block the success modal
          let locName = await getRefinedAddress(snapLocation.latitude, snapLocation.longitude);

          docRef = await addDoc(collection(db, 'alerts'), {
            userId: user.uid,
            username: firstName,
            type: reportType === 'Security' ? 'Security Threat' : reportType, // Use 'Security Threat' for Security reports
            description: `Quick ${reportType} report dispatched from home screen.`,
            locationName: locName,
            senderId: user.uid,
            senderName: `${profile?.firstName} ${profile?.lastName || ''}`.trim(),
            senderRole: profile?.role || 'student',
            location: { latitude: snapLocation.latitude, longitude: snapLocation.longitude },
            status: 'Active',
            timestamp: serverTimestamp(),
          });
          
          // 💡 Set activeAlertId to enable tracking immediately
          setActiveAlertId(docRef.id);
        } else {
          const isAvailable = await SMS.isAvailableAsync();
          if (isAvailable) {
            const mapsLink = `http://maps.google.com/?q=${snapLocation.latitude},${snapLocation.longitude}`;
            const senderDisplay = `${profile?.firstName} ${profile?.lastName || ''}`.trim();
            await SMS.sendSMSAsync(
              ['08000000000'],
              `URGENT: ${reportType} Report.\n\nName: ${senderDisplay}\nLocation: Babcock University\n\nMap: ${mapsLink}`
            );
          }
          return;
        }
      } catch (error) {
        console.error("Quick Report Error:", error);
      }
    })();
  };

  const handleResolveAlert = async (id: string) => {
    try {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      await updateDoc(doc(db, 'alerts', id), {
        status: 'Resolved',
        resolvedAt: serverTimestamp(),
        resolvedBy: user?.uid
      });
      if (respondingTo === id) setRespondingTo(null);
      setCustomAlert({ visible: true, title: "Resolved", message: "Emergency marked as resolved.", type: 'success' });
    } catch (error) {
      console.error("Error resolving alert:", error);
      setCustomAlert({ visible: true, title: "Error", message: "Could not resolve the alert.", type: 'error' });
    }
  };

  const handleRespondToAlert = async (id: string) => {
    try {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      await updateDoc(doc(db, 'alerts', id), {
        status: 'Responding',
        responderId: user?.uid,
        responderName: `${profile?.firstName} ${profile?.lastName || ''}`.trim(),
        responderRole: profile?.role,
        respondedAt: serverTimestamp()
      });
      setRespondingTo(id);
      setCustomAlert({ visible: true, title: "Responding", message: "You are now responding to this alert. Your location is being shared with the reporter.", type: 'success' });
    } catch (error) {
      console.error("Error responding to alert:", error);
      setCustomAlert({ visible: true, title: "Error", message: "Could not respond to the alert.", type: 'error' });
    }
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderMove: Animated.event([null, { dx: pan.x }], { useNativeDriver: false }),
      onPanResponderRelease: (e, gesture) => {
        if (gesture.dx > slideDistance - 60) {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
          setIsSOSActive(true);
          Animated.spring(pan, { toValue: { x: slideDistance, y: 0 }, useNativeDriver: false }).start();
          if (triggerSOSRef.current) triggerSOSRef.current();
        } else {
          Animated.spring(pan, { toValue: { x: 0, y: 0 }, useNativeDriver: false }).start();
        }
      },
    })
  ).current;

  const handleHoldIn = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Animated.timing(cancelAnim, { toValue: 1, duration: 3000, useNativeDriver: false }).start(({ finished }) => {
      if (finished) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        cancelSOSAlertInDB();
      }
    });
  };

  const handleHoldOut = () => {
    Animated.timing(cancelAnim, { toValue: 0, duration: 300, useNativeDriver: false }).start();
  };


  const staffTitle = profile?.role === 'medical' ? 'Medic' : profile?.role === 'fire' ? 'Firefighter' : 'Officer';

  // ==========================================
  // 🛡️ THE STAFF DASHBOARD (Security / Medical / Fire)
  // ==========================================
  if (profile?.role === 'security' || profile?.role === 'medical' || profile?.role === 'fire') {
    let displayAlerts = activeEmergencies;
    // Note: displayAlerts is already filtered inside the useEffect listener above for staff

    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
        <View style={styles.premiumStaffHeader}>
          <View>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 2 }}>
              <View style={[styles.premiumLiveDot, { backgroundColor: displayAlerts.length > 0 ? '#DC2626' : '#10B981', width: 8, height: 8 }]} />
              <Text style={[styles.premiumRoleSub, { color: colors.textSub, marginLeft: 6 }]}>{profile?.role?.toUpperCase()} PORTAL</Text>
            </View>
            <Text style={[styles.premiumOfficerName, { color: colors.text }]}>{staffTitle} {firstName}</Text>
          </View>
          <View style={styles.premiumHeaderActions}>
            <TouchableOpacity
              style={[styles.premiumActionBtn, { backgroundColor: isDarkMode ? colors.surface : '#FFF', borderColor: colors.border, borderWidth: 1 }]}
              onPress={toggleTheme}
            >
              <Ionicons name={isDarkMode ? "sunny" : "moon"} size={20} color={colors.text} />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.premiumActionBtn, { backgroundColor: isDarkMode ? colors.surface : '#FFF', borderColor: colors.border, borderWidth: 1 }]}
              onPress={() => { setShowNotifications(true); setHasUnread(false); }}
            >
              <Ionicons name="notifications" size={20} color={colors.text} />
              {hasUnread && <View style={[styles.premiumNotificationDot, { backgroundColor: '#DC2626' }]} />}
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.premiumSectionHeaderRow}>
          <Text style={[styles.premiumSectionTitle, { color: colors.text }]}>Live Incidents</Text>
          <View style={[styles.premiumBadgePill, { backgroundColor: displayAlerts.length > 0 ? '#FEF2F2' : '#F0FDF4', borderColor: displayAlerts.length > 0 ? '#FEE2E2' : '#DCFCE7', borderWidth: 1 }]}>
            <Text style={[styles.premiumBadgeText, { color: displayAlerts.length > 0 ? '#DC2626' : '#10B981' }]}>{displayAlerts.length} ACTIVE</Text>
          </View>
        </View>

        <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 100 }} showsVerticalScrollIndicator={false}>
          {displayAlerts.length === 0 ? (
            <View style={[styles.premiumEmptyCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <View style={styles.emptyIconCircle}>
                 <MaterialCommunityIcons name="shield-check" size={50} color="#10B981" />
              </View>
              <Text style={{ color: colors.text, fontSize: 20, fontWeight: '900', marginBottom: 8 }}>All Systems Clear</Text>
              <Text style={{ color: colors.textSub, textAlign: 'center', fontSize: 14, lineHeight: 20 }}>
                No active {profile.role === 'medical' ? 'medical ' : ''}emergencies reported. Maintain vigilance in your patrol zone.
              </Text>
            </View>
          ) : (
            displayAlerts.map((alert) => {
              const style = getAlertStyling(alert.type, isDarkMode, true);
              const timeAgo = getTimeAgo(alert.timestamp);
              const distance = getDistanceInMeters(userLocation?.coords?.latitude, userLocation?.coords?.longitude, alert.location?.latitude, alert.location?.longitude);
              const isUserBusy = respondingTo !== null && respondingTo !== alert.id;

              return (
                <View key={alert.id} style={[styles.premiumIncidentCard, { backgroundColor: colors.surface, shadowColor: '#000' }]}>
                  <View style={[styles.premiumCardAccent, { backgroundColor: style.cardAccent }]} />

                  <View style={styles.premiumCardContent}>
                    <View style={styles.premiumIncidentMeta}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                          <View style={[styles.premiumAlertIconBg, { backgroundColor: style.bg }]}>
                            <MaterialCommunityIcons name={style.icon as any} size={20} color={style.color} />
                          </View>
                          <View>
                            <Text style={[styles.premiumAlertLabel, { color: colors.text }]}>{alert.type}</Text>
                            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 2 }}>
                               <Ionicons name="time-outline" size={12} color={colors.textSub} />
                               <Text style={[styles.premiumAlertMetaText, { color: colors.textSub, marginLeft: 4 }]}>{timeAgo}</Text>
                               <View style={[styles.premiumMetaSeparator, { backgroundColor: colors.border }]} />
                               <Ionicons name="navigate-outline" size={12} color={colors.textSub} />
                               <Text style={[styles.premiumAlertMetaText, { color: colors.textSub, marginLeft: 4 }]}>{distance}m</Text>
                            </View>
                          </View>
                        </View>
                        <View style={[styles.premiumUrgentBadge, { backgroundColor: style.cardAccent + '20', borderColor: style.cardAccent, borderWidth: 1 }]}>
                          <Text style={[styles.premiumUrgentBadgeText, { color: style.cardAccent }]}>URGENT</Text>
                        </View>
                      </View>
                    </View>

                    <View style={styles.premiumstructuredDetails}>
                      <View style={{ flex: 1, marginRight: 15 }}>
                        <Text style={[styles.premiumGruppeTitle, { color: colors.textSub }]}>REPORTER</Text>
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                          <Ionicons name="person-circle-outline" size={16} color={colors.text} style={{ marginRight: 6 }} />
                          <Text style={[styles.premiumGruppeContent, { color: colors.text }]} numberOfLines={1}>{alert.senderName}</Text>
                        </View>
                        <Text style={[styles.premiumGruppeSub, { color: colors.textSub, marginLeft: 22 }]}>{alert.senderRole}</Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.premiumGruppeTitle, { color: colors.textSub }]}>LOCATION</Text>
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                          <Ionicons name="location-outline" size={16} color={colors.text} style={{ marginRight: 6 }} />
                          <Text style={[styles.premiumGruppeContent, { color: colors.text }]} numberOfLines={1}>{alert.locationName}</Text>
                        </View>
                        <Text style={[styles.premiumGruppeSub, { color: colors.textSub, marginLeft: 22 }]}>{alert.buildingName || 'Campus area'}</Text>
                      </View>
                    </View>

                    {alert.description && (
                      <View style={[styles.premiumInternalDescriptionContainer, { backgroundColor: isDarkMode ? '#111827' : '#F9FAFB', borderLeftColor: style.cardAccent, borderLeftWidth: 4 }]}>
                        <Text style={[styles.premiumDescriptionText, { color: colors.text }]}>
                          {alert.description}
                        </Text>
                      </View>
                    )}

                    <View style={styles.premiumEvidenceButtonRow}>
                      <TouchableOpacity
                        style={[styles.premiumTactileBtn, { backgroundColor: isDarkMode ? '#1F2937' : '#F3F4F6' }]}
                        onPress={() => router.push({
                          pathname: '/map',
                          params: { focusLat: alert.location?.latitude, focusLng: alert.location?.longitude }
                        })}
                      >
                        <Ionicons name="map" size={18} color={isDarkMode ? '#34D399' : '#059669'} />
                        <Text style={[styles.premiumTactileBtnText, { color: isDarkMode ? '#34D399' : '#059669' }]}>Map</Text>
                      </TouchableOpacity>

                      {alert.audioUrl && (
                        <TouchableOpacity
                          style={[styles.premiumTactileBtn, { backgroundColor: isDarkMode ? '#1F2937' : '#F3F4F6' }]}
                          onPress={() => Linking.openURL(alert.audioUrl)}
                        >
                          <MaterialCommunityIcons name="waveform" size={18} color={isDarkMode ? '#A78BFA' : '#7C3AED'} />
                          <Text style={[styles.premiumTactileBtnText, { color: isDarkMode ? '#A78BFA' : '#7C3AED' }]}>Audio</Text>
                        </TouchableOpacity>
                      )}

                      {alert.mediaUrl && (
                        <TouchableOpacity
                          style={[styles.premiumTactileBtn, { backgroundColor: isDarkMode ? '#1F2937' : '#F3F4F6' }]}
                          onPress={() => Linking.openURL(alert.mediaUrl)}
                        >
                          <Ionicons name="image" size={18} color={isDarkMode ? '#60A5FA' : '#2563EB'} />
                          <Text style={[styles.premiumTactileBtnText, { color: isDarkMode ? '#60A5FA' : '#2563EB' }]}>Photo</Text>
                        </TouchableOpacity>
                      )}
                    </View>

                    {alert.status === 'Responding' && alert.responderId !== user?.uid ? (
                      <View style={[styles.premiumResolutionButton, { backgroundColor: '#6B7281', opacity: 0.8 }]}>
                        <Text style={styles.premiumResolutionBtnText}>Another Officer Responding</Text>
                      </View>
                    ) : isUserBusy ? (
                      <View style={[styles.premiumResolutionButton, { backgroundColor: colors.border, opacity: 0.5 }]}>
                         <Text style={[styles.premiumResolutionBtnText, { color: colors.textSub }]}>Finish current task first</Text>
                      </View>
                    ) : alert.status === 'Active' ? (
                      <TouchableOpacity
                        style={[styles.premiumResolutionButton, { backgroundColor: '#3B82F6' }]}
                        onPress={() => handleRespondToAlert(alert.id)}
                      >
                        <Ionicons name="megaphone-outline" size={22} color="#FFF" />
                        <Text style={styles.premiumResolutionBtnText}>Begin Response</Text>
                      </TouchableOpacity>
                    ) : alert.status === 'Responding' && alert.responderId === user?.uid ? (
                      <TouchableOpacity
                        style={[styles.premiumResolutionButton, { backgroundColor: '#10B981' }]}
                        onPress={() => handleResolveAlert(alert.id)}
                      >
                        <Ionicons name="checkmark-done-circle" size={22} color="#FFF" />
                        <Text style={styles.premiumResolutionBtnText}>Mark as Resolved</Text>
                      </TouchableOpacity>
                    ) : null}
                  </View>
                </View>
              );
            })
          )}
        </ScrollView>

        <NotificationModal visible={showNotifications} onClose={() => setShowNotifications(false)} colors={colors} />

        <Modal visible={customAlert.visible} animationType="fade" transparent={true}>
          <View style={styles.customModalOverlay}>
            <View style={[styles.customModalContent, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <View style={[styles.iconCircle, { backgroundColor: customAlert.type === 'success' ? '#D1FAE5' : '#FEE2E2' }]}>
                <Ionicons name={customAlert.type === 'success' ? 'checkmark-circle' : 'alert-circle'} size={45} color={customAlert.type === 'success' ? '#10B981' : '#DC2626'} />
              </View>
              <Text style={[styles.customModalTitle, { color: colors.text }]}>{customAlert.title}</Text>
              <Text style={[styles.customModalText, { color: colors.textSub }]}>{customAlert.message}</Text>
              <TouchableOpacity style={[styles.primaryButton, { backgroundColor: customAlert.type === 'success' ? '#10B981' : '#DC2626' }]} onPress={() => setCustomAlert({ ...customAlert, visible: false })}>
                <Text style={styles.primaryButtonText}>OK</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      </SafeAreaView>
    );
  }

  // ==========================================
  // 🎓 THE STUDENT DASHBOARD (Default)
  // ==========================================
  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>

        <View style={styles.header}>
          <View>
            <Text style={[styles.greeting, { color: colors.textSub }]}>Hello,</Text>
            <Text style={[styles.name, { color: colors.text }]}>{firstName}</Text>
          </View>
          <View style={styles.headerIcons}>
            <TouchableOpacity
              style={[styles.bellBtn, { backgroundColor: isDarkMode ? colors.surface : '#FFF', borderColor: colors.border, borderWidth: isDarkMode ? 1 : 0 }]}
              onPress={() => { setShowNotifications(true); setHasUnread(false); }}
            >
              <Ionicons name="notifications" size={24} color={isDarkMode ? '#FFF' : colors.text} />
              {hasUnread && <View style={styles.notificationDot} />}
            </TouchableOpacity>
            <TouchableOpacity style={styles.moonBtn} onPress={toggleTheme}>
              <Ionicons name="moon" size={20} color="#FFF" />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.liveMonitoringContainer}>
          <View style={[styles.liveMonitoringPill, isSOSActive && { backgroundColor: '#FEE2E2' }]}>
            <View style={[styles.liveDot, isSOSActive && { backgroundColor: '#DC2626' }]} />
            <Text style={[styles.liveMonitoringText, isSOSActive && { color: '#DC2626' }]}>
              {isSOSActive ? 'EMERGENCY BROADCASTING' : 'LIVE MONITORING ACTIVE'}
            </Text>
          </View>
        </View>

        <View style={[styles.mapCard, { backgroundColor: isDarkMode ? '#1A1D26' : '#E2E8F0', borderColor: isSOSActive ? '#DC2626' : 'transparent', borderWidth: isSOSActive ? 2 : 0 }]}>
          <MapView
            ref={mapRef}
            style={StyleSheet.absoluteFillObject}
            pitchEnabled={false} rotateEnabled={false} scrollEnabled={true} zoomEnabled={true}
            region={{
              latitude: targetCoords?.lat || userLocation?.coords?.latitude || 6.8912,
              longitude: targetCoords?.lng || userLocation?.coords?.longitude || 3.7197,
              latitudeDelta: 0.005, longitudeDelta: 0.005,
            }}
          >
            {activeResponder && activeResponder.location && (
              <Marker
                coordinate={{
                  latitude: activeResponder.location.latitude,
                  longitude: activeResponder.location.longitude
                }}
                title={`${activeResponder.role} Responder`}
                description={activeResponder.name}
              >
                <View style={[styles.responderMarker, { backgroundColor: activeResponder.role === 'medical' ? '#DC2626' : '#2563EB' }]}>
                  <MaterialCommunityIcons 
                    name={activeResponder.role === 'medical' ? 'medical-bag' : 'shield-check'} 
                    size={20} 
                    color="#FFF" 
                  />
                </View>
              </Marker>
            )}
          </MapView>
          <TouchableOpacity 
            style={[styles.miniLocateBtn, { backgroundColor: colors.surface }]} 
            onPress={() => {
              if (userLocation && mapRef.current) {
                mapRef.current.animateToRegion({
                  latitude: userLocation.coords.latitude,
                  longitude: userLocation.coords.longitude,
                  latitudeDelta: 0.005,
                  longitudeDelta: 0.005,
                }, 1000);
              }
            }}
          >
            <Ionicons name="locate" size={20} color={isSOSActive ? '#DC2626' : colors.text} />
          </TouchableOpacity>
          <View style={styles.mapTopRow}>
            <View style={styles.babcockPill}>
              <Ionicons name="locate" size={14} color="#DC2626" />
              <Text style={styles.babcockPillText}>Babcock University</Text>
            </View>
            <View style={[styles.gpsActivePill, { backgroundColor: activeAlertData?.status === 'Resolved' ? '#10B981' : (isSOSActive ? '#000' : (activeAlertId ? '#3B82F6' : (gpsStatus === 'GPS ACTIVE' ? '#DC2626' : (gpsStatus === 'LOCATING...' ? '#F59E0B' : '#6B7280')))) }]}>
              <Text style={styles.gpsActiveText}>{activeAlertData?.status === 'Resolved' ? 'COMPLETED' : (isSOSActive ? 'SOS ACTIVE' : (activeAlertId ? 'TRACKING ALERT' : gpsStatus))}</Text>
            </View>
          </View>
          <View style={styles.radarCenter} pointerEvents="none">
            <Animated.View style={[styles.pulseCircle, { transform: [{ scale: pulseAnim }], backgroundColor: isSOSActive ? 'rgba(220, 38, 38, 0.4)' : 'rgba(220, 38, 38, 0.15)' }]} />
            <View style={[styles.radarDot, isSOSActive && { backgroundColor: '#991B1B', borderColor: '#FCA5A5', borderWidth: 4 }]} />
          </View>
          <View style={styles.coordinatesPill}>
            <Text style={styles.coordinatesText}>
              LAT: {userLocation ? userLocation.coords.latitude.toFixed(4) : '--.----'} | LNG: {userLocation ? userLocation.coords.longitude.toFixed(4) : '--.----'}
            </Text>
          </View>
        </View>

        <View style={styles.sosContainer}>
          {(isSOSActive || activeAlertId) ? (
            <>
              {isSOSActive ? (
                /* 🛡️ CRITICAL SOS ACTIVE (High Urgency) */
                <>
                  <TouchableOpacity activeOpacity={0.9} onPressIn={handleHoldIn} onPressOut={handleHoldOut} style={[styles.sosTrack, { backgroundColor: activeAlertData?.status === 'Resolved' ? '#059669' : '#7F1D1D', overflow: 'hidden' }]}>
                    <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: '#10B981', width: cancelAnim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }) }]} />
                    <Text style={[styles.sosText, { zIndex: 10 }]}>
                      {activeAlertData?.status === 'Resolved' ? 'COMPLETED' : 'HOLD TO CANCEL'}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity 
                    onPress={() => setShowStatusModal(true)} 
                    style={{ marginTop: 15, backgroundColor: activeAlertData?.status === 'Resolved' ? '#ECFDF5' : '#FEF2F2', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 20, flexDirection: 'row', alignItems: 'center', borderColor: activeAlertData?.status === 'Resolved' ? '#10B981' : '#FCA5A5', borderWidth: 1 }}
                  >
                    <Ionicons name={activeAlertData?.status === 'Resolved' ? "checkmark-circle" : "location"} size={16} color={activeAlertData?.status === 'Resolved' ? "#10B981" : "#DC2626"} />
                    <Text style={{ color: activeAlertData?.status === 'Resolved' ? "#10B981" : "#DC2626", fontWeight: 'bold', fontSize: 12, marginLeft: 6 }}>
                      {activeAlertData?.status === 'Resolved' ? 'VIEW COMPLETION STATUS' : 'VIEW RESCUE STATUS'}
                    </Text>
                  </TouchableOpacity>
                </>
              ) : (
                /* 🕒 REGULAR INCIDENT ACTIVE (Tracking Mode) */
                <TouchableOpacity 
                   activeOpacity={0.9}
                   style={[styles.sosTrack, { backgroundColor: activeAlertData?.status === 'Resolved' ? '#059669' : '#1E40AF', flexDirection: 'row', paddingHorizontal: 20, elevation: 8, justifyContent: 'space-between', alignItems: 'center' }]}
                   onPress={() => setShowStatusModal(true)}
                >
                   <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                     <View style={[styles.trackLiveDot, { backgroundColor: activeAlertData?.status === 'Resolved' ? '#10B981' : '#60A5FA' }]} />
                     <Text style={{ color: '#FFF', fontWeight: '900', letterSpacing: 1, fontSize: 13, marginLeft: 8 }}>
                       {activeAlertData?.status === 'Resolved' ? 'INCIDENT RESOLVED' : `${activeAlertData?.type?.toUpperCase() || 'INCIDENT'} ACTIVE`}
                     </Text>
                   </View>
                   <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 16 }}>
                     <Text style={{ color: '#FFF', fontSize: 10, fontWeight: 'bold', marginRight: 4 }}>
                       {activeAlertData?.status === 'Resolved' ? 'COMPLETED' : 'VIEW STATUS'}
                     </Text>
                     <MaterialCommunityIcons name="chevron-right" size={16} color="#FFF" />
                   </View>
                </TouchableOpacity>
              )}
              
              {/* 🛡️ PERSISTENT HELP TEXT */}
              {!activeResponder && (
                <Text style={[styles.sosSubtext, { color: activeAlertData?.status === 'Resolved' ? '#059669' : (isSOSActive ? '#DC2626' : '#1E40AF'), fontWeight: 'bold', marginTop: 15 }]}>
                  {activeAlertData?.status === 'Resolved' ? 'EMERGENCY RESOLVED. YOU ARE SAFE.' : (isSOSActive ? 'SOS BROADCASTED. HELP IS ON THE WAY.' : 'REPORT RECEIVED. HELP IS ON THE WAY.')}
                </Text>
              )}

              {activeResponder && (
                <>
                  <Text style={[styles.sosSubtext, { color: '#059669', fontWeight: 'bold', marginTop: 15 }]}>
                    {activeAlertData?.status === 'Resolved' ? 'EMERGENCY RESOLVED. YOU ARE SAFE.' : 'RESPONDER EN ROUTE. STAY SAFE.'}
                  </Text>
                  <TouchableOpacity 
                    activeOpacity={0.9}
                    onPress={() => setShowStatusModal(true)}
                    style={[styles.responderComingCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
                  >
                    <View style={styles.responderInfoRow}>
                      <View style={[styles.responderInitialCircle, { backgroundColor: activeResponder.role === 'medical' ? '#DC2626' : '#3B82F6' }]}>
                        <Text style={styles.responderInitialText}>
                          {activeResponder.name?.charAt(0) || 'R'}
                        </Text>
                      </View>
                      <View style={{ flex: 1, marginLeft: 12 }}>
                        <Text style={[styles.responderStatusText, { color: '#059669' }]}>
                          {activeAlertData?.status === 'Resolved' ? 'RESCUE COMPLETED' : 'RESCUE IN PROGRESS'}
                        </Text>
                        <Text style={[styles.responderNameText, { color: colors.text }]} numberOfLines={1}>
                          {activeResponder.role === 'medical' ? 'Medic' : activeResponder.role === 'fire' ? 'Firefighter' : 'Officer'} {activeResponder.name}
                        </Text>
                      </View>
                      <View style={styles.distanceBadge}>
                        <Text style={styles.distanceBadgeText}>
                          {activeAlertData?.status === 'Resolved' ? 'ARRIVED' : `${getDistanceInMeters(userLocation?.coords?.latitude, userLocation?.coords?.longitude, activeResponder?.location?.latitude, activeResponder?.location?.longitude)}m`}
                        </Text>
                      </View>
                    </View>
                  </TouchableOpacity>
                </>
              )}
            </>
          ) : (
              <>
                {/* 🛡️ READY TO SOS SLIDER */}
                <View style={[styles.sosTrack, { backgroundColor: '#DC2626' }]}>
                  <Text style={styles.sosText}>SLIDE TO SOS »</Text>
                  <Animated.View 
                    style={[
                      styles.sosThumb, 
                      { 
                        transform: [{ 
                          translateX: pan.x.interpolate({ 
                            inputRange: [0, slideDistance], 
                            outputRange: [0, slideDistance - 10], 
                            extrapolate: 'clamp' 
                          }) 
                        }] 
                      }
                    ]} 
                    {...panResponder.panHandlers}
                  >
                    <Ionicons name="shield" size={24} color="#DC2626" />
                  </Animated.View>
                </View>
                <Text style={styles.sosSubtext}>Swipe right to alert campus security instantly</Text>
              </>
            )}
        </View>



        <View style={styles.sectionHeader}>
          <View style={styles.verticalIndicatorBlue} />
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Quick Report</Text>
        </View>
        <View style={styles.quickReportGrid}>
          {[
            { label: 'Medical', icon: 'medical-bag', color: '#DC2626' },
            { label: 'Fire', icon: 'fire', color: '#F59E0B' },
            { label: 'Security', icon: 'shield', color: '#3B82F6' },
            { label: 'Accident', icon: 'car-brake-alert', color: '#8B5CF6' },
          ].map((item, i) => (
            <TouchableOpacity
              key={i} style={styles.quickReportItem}
              onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setConfirmAlert({ visible: true, type: item.label, icon: item.icon, color: item.color }); }}
            >
              <View style={[styles.circleIconBg, { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: isDarkMode ? 1 : 0 }]}>
                <MaterialCommunityIcons name={item.icon as any} size={28} color={item.color} />
              </View>
              <Text style={[styles.quickReportLabel, { color: colors.textSub }]}>{item.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.sectionHeaderBetween}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <View style={styles.verticalIndicatorOrange} />
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Nearby Alerts</Text>
          </View>
          <TouchableOpacity
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              router.push('/alertsModal');
            }}
          >
            <Text style={styles.viewAllText}>View All</Text>
          </TouchableOpacity>
        </View>

        {((nearbyAlerts || []).length === 0) ? (
          <View style={[styles.emptyAlertsCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Ionicons name="shield-checkmark-outline" size={32} color={colors.textSub} />
            <Text style={[styles.emptyAlertsText, { color: colors.textSub }]}>All clear. No active emergencies nearby.</Text>
          </View>
        ) : (
          (nearbyAlerts || []).map((alert) => {
            const style = getAlertStyling(alert?.type || 'Emergency');
            const distance = getDistanceInMeters(userLocation?.coords?.latitude, userLocation?.coords?.longitude, alert?.location?.latitude, alert?.location?.longitude);
            const timeAgo = getTimeAgo(alert?.timestamp);

            return (
              <TouchableOpacity
                key={alert.id}
                style={[styles.alertCard, { backgroundColor: colors.surface }]}
                onPress={() => {
                  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                  setTargetCoords({
                    lat: alert?.location?.latitude || 0,
                    lng: alert?.location?.longitude || 0
                  });
                  if (userLocation) {
                    setOriginCoords({
                      lat: userLocation.coords.latitude,
                      lng: userLocation.coords.longitude
                    });
                  }
                }}
              >
                <View style={[styles.alertIndicator, { backgroundColor: style.color }]} />
                <View style={[styles.alertIconBg, { backgroundColor: style.bg }]}>
                  <MaterialCommunityIcons name={style.icon as any} size={24} color={style.color} />
                </View>
                <View style={styles.alertContent}>
                  <Text style={[styles.alertTitle, { color: colors.text }]}>{alert.type}</Text>
                  <Text style={styles.alertSubtitle}>Reported by {alert.senderRole}</Text>
                  <Text style={styles.alertTime}>🕒 {timeAgo} • {distance}m away</Text>
                </View>
                <View style={styles.activeBadge}>
                  <Text style={styles.activeBadgeText}>ACTIVE</Text>
                </View>
              </TouchableOpacity>
            );
          })
        )}

      </ScrollView>

      <NotificationModal visible={showNotifications} onClose={() => setShowNotifications(false)} colors={colors} broadcasts={broadcasts} />

      <Modal visible={showLocationModal} animationType="fade" transparent={true}>
        <View style={styles.customModalOverlay}>
          <View style={[styles.customModalContent, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={styles.iconCircle}>
              <Ionicons name="location" size={40} color="#DC2626" />
            </View>
            <Text style={[styles.customModalTitle, { color: colors.text }]}>Enable Live Radar</Text>
            <Text style={[styles.customModalText, { color: colors.textSub }]}>The Babcock Emergency System requires your location to dispatch security directly to you.</Text>
            <TouchableOpacity 
               style={styles.primaryButton} 
               onPress={async () => {
                 await requestPermission();
                 setShowLocationModal(false);
               }}
            >
              <Text style={styles.primaryButtonText}>Enable GPS</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.secondaryButton} onPress={() => setShowLocationModal(false)}>
              <Text style={styles.secondaryButtonText}>Not Now</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={confirmAlert?.visible || false} animationType="fade" transparent={true}>
        <View style={styles.customModalOverlay}>
          <View style={[styles.customModalContent, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={[styles.iconCircle, { backgroundColor: confirmAlert?.color ? `${confirmAlert.color}20` : '#FEE2E2' }]}>
              <MaterialCommunityIcons name={confirmAlert?.icon as any} size={45} color={confirmAlert?.color} />
            </View>
            <Text style={[styles.customModalTitle, { color: colors.text }]}>Report {confirmAlert?.type}?</Text>
            <Text style={[styles.customModalText, { color: colors.textSub }]}>This will immediately dispatch responders to your current GPS location.</Text>

            <View style={{ flexDirection: 'row', width: '100%', justifyContent: 'space-between', marginTop: 10 }}>
              <TouchableOpacity
                style={[styles.secondaryHalfButton, { borderColor: colors.border, borderWidth: 1 }]}
                onPress={() => {
                  setConfirmAlert(null);
                }}
              >
                <Text style={[styles.secondaryButtonText, { color: colors.text }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.primaryHalfButton, { backgroundColor: confirmAlert?.color || '#DC2626' }]}
                onPress={() => {
                  handleQuickReportConfirm();
                }}
              >
                <Text style={styles.primaryButtonText}>Confirm</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* 🏥 RESCUE STATUS MODAL (New Tracking Page) */}
      <Modal
        visible={showStatusModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowStatusModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
            <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
               <View>
                 <Text style={[styles.premiumRoleSub, { color: activeAlertData?.type === 'Critical SOS' ? '#DC2626' : '#3B82F6', fontWeight: 'bold' }]}>RESCUE TRACKING</Text>
                 <Text style={[styles.modalTitle, { color: colors.text }]}>{activeAlertData?.type || 'Emergency'}</Text>
               </View>
              <TouchableOpacity onPress={() => setShowStatusModal(false)} style={styles.closeBtn}>
                <Ionicons name="close-circle" size={32} color={colors.textSub} />
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={{ paddingVertical: 20 }} showsVerticalScrollIndicator={false}>
              
              {/* Status Stepper */}
              <View style={styles.statusStepper}>
                {[
                  { label: 'Sent', done: true, current: false },
                  { label: 'Accepted', done: !!activeResponder || activeAlertData?.status === 'Resolved', current: (!!activeResponder && activeAlertData?.status === 'Responding') },
                  { label: 'En Route', done: !!activeResponder || activeAlertData?.status === 'Resolved', current: !!activeResponder && activeAlertData?.status !== 'Resolved' },
                  { label: 'Resolved', done: activeAlertData?.status === 'Resolved', current: activeAlertData?.status === 'Resolved' },
                ].map((step, i) => (
                  <View key={i} style={styles.stepItem}>
                    <View style={[styles.stepDot, { backgroundColor: step.done ? '#10B981' : colors.border }]}>
                       {step.done && <Ionicons name="checkmark" size={12} color="#FFF" />}
                    </View>
                    <Text style={[styles.stepLabel, { color: step.done ? colors.text : colors.textSub, fontWeight: step.current ? 'bold' : '400' }]}>{step.label}</Text>
                    {i < 3 && <View style={[styles.stepLine, { backgroundColor: step.done ? '#10B981' : colors.border }]} />}
                  </View>
                ))}
              </View>

              {activeAlertData?.status === 'Resolved' ? (
                <View style={[styles.statusInfoCard, { backgroundColor: isDarkMode ? '#064E3B' : '#D1FAE5', borderColor: '#10B981', borderWidth: 1, alignItems: 'center', padding: 35 }]}>
                   <View style={{ backgroundColor: '#10B981', width: 64, height: 64, borderRadius: 32, justifyContent: 'center', alignItems: 'center', marginBottom: 20 }}>
                     <Ionicons name="checkmark-done" size={36} color="#FFF" />
                   </View>
                   <Text style={[styles.statusWaitingText, { color: isDarkMode ? '#FFF' : '#065F46', marginBottom: 8 }]}>CASE COMPLETED</Text>
                   <Text style={[styles.statusWaitingSub, { color: isDarkMode ? '#D1FAE5' : '#065F46', opacity: 0.8 }]}>
                     Your emergency has been marked as resolved by the responder. This view will close automatically.
                   </Text>
                </View>
              ) : activeResponder ? (
                <View style={[styles.statusInfoCard, { backgroundColor: colors.background, borderColor: colors.border, borderWidth: 1 }]}>
                  <Text style={[styles.statusInfoTitle, { color: colors.text }]}>Responder Assigned</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 20 }}>
                    <View style={[styles.responderInitialCircleLarge, { backgroundColor: activeResponder.role === 'medical' ? '#DC2626' : '#3B82F6' }]}>
                      <Text style={styles.responderInitialTextLarge}>{activeResponder.name?.charAt(0)}</Text>
                    </View>
                    <View style={{ flex: 1, marginLeft: 16 }}>
                      <Text style={[styles.responderNameTextLarge, { color: colors.text }]}>{activeResponder.name}</Text>
                      <Text style={[styles.responderRoleText, { color: colors.textSub }]}>{activeResponder.role?.toUpperCase()} TEAM</Text>
                    </View>
                  </View>
                  <View style={[styles.trackingMetricRow, { borderTopColor: colors.border }]}>
                    <View style={styles.metricItem}>
                      <Ionicons name="navigate" size={18} color="#3B82F6" />
                      <Text style={[styles.metricText, { color: colors.text }]}>
                        {getDistanceInMeters(userLocation?.coords?.latitude, userLocation?.coords?.longitude, activeResponder?.location?.latitude, activeResponder?.location?.longitude)}m away
                      </Text>
                    </View>
                    <View style={styles.metricItem}>
                      <Ionicons name="time" size={18} color="#F59E0B" />
                      <Text style={[styles.metricText, { color: colors.text }]}>~2 mins</Text>
                    </View>
                  </View>
                </View>
              ) : (
                <View style={[styles.statusInfoCard, { backgroundColor: colors.background, borderColor: colors.border, borderWidth: 1, alignItems: 'center', padding: 30 }]}>
                   <ActivityIndicator color="#3B82F6" size="large" />
                   <Text style={[styles.statusWaitingText, { color: colors.text }]}>Awaiting Responder...</Text>
                   <Text style={[styles.statusWaitingSub, { color: colors.textSub }]}>Your coordinates are being shared with the emergency team.</Text>
                </View>
              )}

              {activeAlertData?.status !== 'Resolved' && (
                <TouchableOpacity 
                  style={[styles.cancelEmergencyBtn, { borderColor: '#DC2626' }]} 
                  onPress={() => {
                    setShowStatusModal(false);
                    cancelSOSAlertInDB();
                  }}
                >
                  <Text style={styles.cancelEmergencyBtnText}>CANCEL REQUEST</Text>
                </TouchableOpacity>
              )}
              
              <Text style={[styles.trackingHint, { color: colors.textSub }]}>
                Stay where you are. The responder is navigating to your live location.
              </Text>

            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal visible={customAlert.visible} animationType="none" transparent={true}>

        <View style={styles.customModalOverlay}>
          <View style={[styles.customModalContent, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={[styles.iconCircle, { backgroundColor: customAlert.type === 'success' ? '#D1FAE5' : customAlert.type === 'info' ? '#DBEAFE' : '#FEE2E2' }]}>
              <Ionicons name={customAlert.type === 'success' ? 'checkmark-circle' : customAlert.type === 'info' ? 'information-circle' : 'alert-circle'} size={45} color={customAlert.type === 'success' ? '#10B981' : customAlert.type === 'info' ? '#3B82F6' : '#DC2626'} />
            </View>
            <Text style={[styles.customModalTitle, { color: colors.text }]}>{customAlert.title}</Text>
            <Text style={[styles.customModalText, { color: colors.textSub }]}>{customAlert.message}</Text>
            <TouchableOpacity style={[styles.primaryButton, { backgroundColor: customAlert.type === 'success' ? '#10B981' : customAlert.type === 'info' ? '#3B82F6' : '#DC2626' }]} onPress={() => setCustomAlert({ ...customAlert, visible: false })}>
              <Text style={styles.primaryButtonText}>OK</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

    </SafeAreaView>
  );
}

function NotificationModal({ visible, onClose, colors, broadcasts }: any) {
  const isDarkMode = colors.background === '#1A1A2E'; // Simple check for dark mode
  
  const getIcon = (type: string) => {
    if (type === 'Emergency') return { name: 'alert-decagram', color: '#DC2626' };
    if (type === 'Security Update') return { name: 'shield-alert', color: '#3B82F6' };
    return { name: 'information-variant', color: '#7C3AED' };
  };

  return (
    <Modal visible={visible} animationType="slide" transparent={true} onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={[styles.modalContent, { backgroundColor: colors.background }]}>
          <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>Broadcast Alerts</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={28} color={colors.text} />
            </TouchableOpacity>
          </View>
          
          <ScrollView contentContainerStyle={{ paddingVertical: 15 }}>
            {((broadcasts || []).length === 0) ? (
              <View style={styles.emptyContainer}>
                <Ionicons name="notifications-off-outline" size={60} color={colors.border} />
                <Text style={[styles.emptyText, { color: colors.textSub }]}>No broadcasts yet</Text>
              </View>
            ) : (
              (broadcasts || []).map((item: any) => {
                const { name, color } = getIcon(item.type);
                return (
                  <View key={item.id} style={[styles.broadcastItem, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                    <View style={styles.broadcastHeader}>
                      <View style={[styles.broadcastIconBox, { backgroundColor: color + '15' }]}>
                        <MaterialCommunityIcons name={name as any} size={20} color={color} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.broadcastType, { color: color }]}>{item.type?.toUpperCase()}</Text>
                        <Text style={[styles.broadcastTitle, { color: colors.text }]}>{item.title}</Text>
                      </View>
                      <Text style={[styles.broadcastTime, { color: colors.textSub }]}>{formatTime(item.timestamp)}</Text>
                    </View>
                    <Text style={[styles.broadcastMessage, { color: colors.textSub }]}>{item.message}</Text>
                    <Text style={[styles.broadcastSender, { color: colors.textSub }]}>— Sent by {item.senderName}</Text>
                  </View>
                );
              })
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { padding: 20, paddingBottom: 120 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  greeting: { fontSize: 16, fontWeight: '600' },
  name: { fontSize: 26, fontWeight: '900', textTransform: 'capitalize' },
  headerIcons: { flexDirection: 'row', alignItems: 'center' },
  bellBtn: { width: 45, height: 45, borderRadius: 22.5, justifyContent: 'center', alignItems: 'center', elevation: 2, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 4, marginRight: 15 },
  notificationDot: { position: 'absolute', top: 10, right: 12, width: 8, height: 8, borderRadius: 4, backgroundColor: '#DC2626', borderWidth: 1, borderColor: '#FFF' },
  moonBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#6B7280', justifyContent: 'center', alignItems: 'center' },
  liveMonitoringContainer: { alignItems: 'center', marginBottom: 20 },
  liveMonitoringPill: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#EFF6FF', paddingHorizontal: 20, paddingVertical: 8, borderRadius: 20 },
  liveDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#3B82F6', marginRight: 10 },
  liveMonitoringText: { color: '#3B82F6', fontWeight: 'bold', fontSize: 12, letterSpacing: 0.5 },
  mapCard: { height: 200, borderRadius: 24, padding: 15, marginBottom: 30, overflow: 'hidden', justifyContent: 'space-between' },
  mapTopRow: { flexDirection: 'row', justifyContent: 'space-between', zIndex: 10 },
  babcockPill: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 15 },
  babcockPillText: { fontSize: 12, fontWeight: 'bold', marginLeft: 6, color: '#111827' },
  gpsActivePill: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 15 },
  gpsActiveText: { color: '#FFF', fontSize: 10, fontWeight: 'bold', letterSpacing: 0.5 },
  radarCenter: { ...StyleSheet.absoluteFillObject, justifyContent: 'center', alignItems: 'center', zIndex: 5 },
  pulseCircle: { position: 'absolute', width: 80, height: 80, borderRadius: 40, backgroundColor: 'rgba(220, 38, 38, 0.15)' },
  radarDot: { width: 16, height: 16, borderRadius: 8, backgroundColor: '#DC2626', borderWidth: 3, borderColor: '#FFF' },
  coordinatesPill: { alignSelf: 'flex-end', backgroundColor: '#374151', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12, zIndex: 10 },
  coordinatesText: { color: '#FFF', fontSize: 10, fontWeight: 'bold', letterSpacing: 0.5 },
  sosContainer: { alignItems: 'center', marginBottom: 35 },
  sosTrack: { width: '100%', height: 65, borderRadius: 32.5, justifyContent: 'center', padding: 5, elevation: 5, shadowColor: '#DC2626', shadowOpacity: 0.4, shadowRadius: 10, shadowOffset: { width: 0, height: 4 } },
  sosThumb: { width: 55, height: 55, borderRadius: 27.5, backgroundColor: '#FFF', justifyContent: 'center', alignItems: 'center', zIndex: 10 },
  trackLiveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#60A5FA', marginRight: 10 },
  sosText: { position: 'absolute', width: '100%', textAlign: 'center', color: '#FFF', fontWeight: '900', letterSpacing: 1.5, fontSize: 16 },
  sosSubtext: { color: '#6B7280', fontSize: 12, marginTop: 10, marginBottom: 5 },


  sectionHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 15 },
  sectionHeaderBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 },
  verticalIndicatorBlue: { width: 4, height: 20, backgroundColor: '#3B82F6', borderRadius: 2, marginRight: 10 },
  verticalIndicatorOrange: { width: 4, height: 20, backgroundColor: '#F59E0B', borderRadius: 2, marginRight: 10 },
  sectionTitle: { fontSize: 18, fontWeight: 'bold' },
  viewAllText: { color: '#3B82F6', fontWeight: 'bold', fontSize: 14 },
  quickReportGrid: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 35 },
  quickReportItem: { alignItems: 'center', flex: 1 },
  circleIconBg: { width: 65, height: 65, borderRadius: 32.5, justifyContent: 'center', alignItems: 'center', elevation: 2, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 5 },
  quickReportLabel: { marginTop: 10, fontSize: 12, fontWeight: '600' },

  alertCard: { flexDirection: 'row', alignItems: 'center', padding: 15, borderRadius: 20, marginBottom: 15, elevation: 1, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 3 },
  alertIndicator: { position: 'absolute', left: 0, top: 15, bottom: 15, width: 4, borderTopRightRadius: 2, borderBottomRightRadius: 2 },
  alertIconBg: { width: 45, height: 45, borderRadius: 22.5, justifyContent: 'center', alignItems: 'center', marginRight: 15, marginLeft: 5 },
  alertContent: { flex: 1 },
  alertTitle: { fontSize: 15, fontWeight: 'bold', marginBottom: 3 },
  alertSubtitle: { fontSize: 13, color: '#6B7280', marginBottom: 5, textTransform: 'capitalize' },
  alertTime: { fontSize: 11, color: '#9CA3AF' },
  activeBadge: { backgroundColor: '#FEE2E2', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
  activeBadgeText: { color: '#DC2626', fontSize: 9, fontWeight: 'bold', letterSpacing: 0.5 },
  emptyAlertsCard: { padding: 30, borderRadius: 20, alignItems: 'center', borderWidth: 1, borderStyle: 'dashed', marginBottom: 20 },
  emptyAlertsText: { marginTop: 12, fontSize: 14, fontWeight: '500', textAlign: 'center' },

  premiumStaffHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: Platform.OS === 'android' ? 40 : 10, paddingHorizontal: 20, marginBottom: 20 },
  premiumRoleSub: { fontSize: 10, fontWeight: '900', letterSpacing: 1.5, textTransform: 'uppercase' },
  premiumOfficerName: { fontSize: 28, fontWeight: '900', letterSpacing: -0.5 },
  premiumHeaderActions: { flexDirection: 'row', alignItems: 'center' },
  premiumActionBtn: { width: 42, height: 42, borderRadius: 14, justifyContent: 'center', alignItems: 'center', marginLeft: 10, elevation: 1, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 2 },
  premiumNotificationDot: { position: 'absolute', top: 12, right: 12, width: 6, height: 6, borderRadius: 3, borderWidth: 1, borderColor: '#FFF' },
  premiumLiveDot: { borderRadius: 4, marginRight: 0 },

  premiumSectionHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, marginBottom: 15 },
  premiumSectionTitle: { fontSize: 18, fontWeight: '900', letterSpacing: -0.2 },
  premiumBadgePill: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12 },
  premiumBadgeText: { fontSize: 10, fontWeight: '900', letterSpacing: 0.5 },

  premiumIncidentCard: { borderRadius: 24, marginBottom: 20, overflow: 'hidden', elevation: 8, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 10, borderWidth: 1, borderColor: 'transparent' },
  premiumCardAccent: { position: 'absolute', top: 0, left: 0, width: 4, bottom: 0, zIndex: 10 },
  premiumCardContent: { padding: 20 },
  premiumIncidentMeta: { marginBottom: 18 },
  premiumAlertIconBg: { width: 44, height: 44, borderRadius: 15, justifyContent: 'center', alignItems: 'center', marginRight: 15 },
  premiumAlertLabel: { fontSize: 18, fontWeight: '900', marginBottom: 0 },
  premiumAlertMetaText: { fontSize: 11, fontWeight: '600' },
  premiumMetaSeparator: { width: 3, height: 3, borderRadius: 1.5, marginHorizontal: 8 },
  premiumUrgentBadge: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10 },
  premiumUrgentBadgeText: { fontSize: 9, fontWeight: '900', letterSpacing: 0.5 },
  premiumstructuredDetails: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20, backgroundColor: 'rgba(0,0,0,0.02)', padding: 12, borderRadius: 16 },
  premiumGruppeTitle: { fontSize: 9, fontWeight: '900', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 6, opacity: 0.6 },
  premiumGruppeContent: { fontSize: 14, fontWeight: '800' },
  premiumGruppeSub: { fontSize: 11, fontWeight: '600', marginTop: 2 },

  premiumInternalDescriptionContainer: { borderRadius: 16, padding: 16, marginBottom: 20 },
  premiumDescriptionText: { fontSize: 14, fontWeight: '500', lineHeight: 22 },

  premiumEvidenceButtonRow: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 20, gap: 10 },
  premiumTactileBtn: { flexGrow: 1, minWidth: '30%', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 14, borderRadius: 16, elevation: 1, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 2 },
  premiumTactileBtnText: { marginLeft: 6, fontSize: 13, fontWeight: 'bold' },

  premiumResolutionButton: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', width: '100%', paddingVertical: 18, borderRadius: 20, elevation: 6, shadowColor: '#10B981', shadowOpacity: 0.4, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, overflow: 'hidden' },
  premiumResolutionBtnText: { color: '#FFF', fontSize: 16, fontWeight: '900', marginLeft: 8, letterSpacing: 0.5 },
  resolutionPulse: { ...StyleSheet.absoluteFillObject, backgroundColor: 'white', opacity: 0.1 },

  premiumEmptyCard: { padding: 40, borderRadius: 32, alignItems: 'center', borderWidth: 1, borderStyle: 'dashed' },
  emptyIconCircle: { width: 100, height: 100, borderRadius: 50, backgroundColor: '#ECFDF5', justifyContent: 'center', alignItems: 'center', marginBottom: 20 },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { height: '80%', borderTopLeftRadius: 30, borderTopRightRadius: 30, padding: 20 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 15, borderBottomWidth: 1 },
  modalTitle: { fontSize: 20, fontWeight: 'bold' },
  closeBtn: { padding: 5 },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', opacity: 0.5 },
  emptyText: { marginTop: 10, fontSize: 16 },

  customModalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  customModalContent: { width: '100%', maxWidth: 340, borderRadius: 24, padding: 25, alignItems: 'center', elevation: 10, shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 15, borderWidth: 1 },
  iconCircle: { width: 80, height: 80, borderRadius: 40, backgroundColor: '#FEE2E2', justifyContent: 'center', alignItems: 'center', marginBottom: 20 },
  customModalTitle: { fontSize: 22, fontWeight: 'bold', marginBottom: 12, textAlign: 'center' },
  customModalText: { fontSize: 14, textAlign: 'center', lineHeight: 22, marginBottom: 30 },
  statusStepper: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 10, marginBottom: 30 },
  stepItem: { alignItems: 'center', flex: 1 },
  stepDot: { width: 24, height: 24, borderRadius: 12, justifyContent: 'center', alignItems: 'center', zIndex: 10 },
  stepLabel: { fontSize: 10, marginTop: 8, textTransform: 'uppercase', letterSpacing: 0.5 },
  stepLine: { position: 'absolute', top: 12, left: '50%', right: '-50%', height: 2, zIndex: 5 },
  statusInfoCard: { borderRadius: 24, padding: 20, marginBottom: 25 },
  statusInfoTitle: { fontSize: 14, fontWeight: '900', marginBottom: 15, textTransform: 'uppercase', letterSpacing: 1 },
  responderMainRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
  responderInitialCircleLarge: { width: 60, height: 60, borderRadius: 30, justifyContent: 'center', alignItems: 'center' },
  responderInitialTextLarge: { color: '#FFF', fontSize: 24, fontWeight: '900' },
  responderNameTextLarge: { fontSize: 18, fontWeight: '900' },
  responderRoleText: { fontSize: 12, fontWeight: '700', letterSpacing: 1, marginTop: 2 },
  trackingMetricRow: { flexDirection: 'row', borderTopWidth: 1, paddingTop: 15, gap: 20 },
  metricItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  metricText: { fontSize: 14, fontWeight: '700' },
  statusWaitingText: { fontSize: 18, fontWeight: '900', marginTop: 20 },
  statusWaitingSub: { fontSize: 13, textAlign: 'center', marginTop: 10, lineHeight: 20 },
  cancelEmergencyBtn: { width: '100%', paddingVertical: 18, borderRadius: 20, borderWidth: 2, alignItems: 'center', marginBottom: 20 },
  cancelEmergencyBtnText: { color: '#DC2626', fontSize: 14, fontWeight: '900', letterSpacing: 1 },
  trackingHint: { fontSize: 12, textAlign: 'center', fontStyle: 'italic', marginBottom: 40 },
  broadcastItem: { padding: 18, borderRadius: 20, marginBottom: 12, borderWidth: 1, elevation: 1, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 3 },
  broadcastHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  broadcastIconBox: { width: 36, height: 36, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  broadcastType: { fontSize: 10, fontWeight: '900', letterSpacing: 0.5, marginBottom: 2 },
  broadcastTitle: { fontSize: 16, fontWeight: '800' },
  broadcastTime: { fontSize: 11, fontWeight: '600' },
  broadcastMessage: { fontSize: 14, lineHeight: 22, marginBottom: 10 },
  broadcastSender: { fontSize: 11, fontWeight: '600', fontStyle: 'italic' },
  primaryButton: { width: '100%', backgroundColor: '#DC2626', paddingVertical: 15, borderRadius: 14, alignItems: 'center', marginBottom: 10 },
  primaryButtonText: { color: '#FFF', fontSize: 16, fontWeight: 'bold', letterSpacing: 0.5 },
  secondaryButton: { width: '100%', paddingVertical: 15, borderRadius: 14, alignItems: 'center' },
  secondaryButtonText: { color: '#6B7280', fontSize: 16, fontWeight: '600' },
  primaryHalfButton: { flex: 1, paddingVertical: 15, borderRadius: 14, alignItems: 'center', marginLeft: 10 },
  secondaryHalfButton: { flex: 1, paddingVertical: 15, borderRadius: 14, alignItems: 'center', marginRight: 10 },
  miniLocateBtn: {
    position: 'absolute',
    bottom: 60,
    right: 12,
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    zIndex: 10,
  },
  responderMarker: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#FFF',
    elevation: 8,
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 5,
  },
  responderComingCard: {
    width: '100%',
    padding: 16,
    borderRadius: 24,
    borderWidth: 1,
    marginTop: 15,
    elevation: 4,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 10,
  },
  responderInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  responderInitialCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#3B82F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  responderInitialText: {
    color: '#FFF',
    fontSize: 20,
    fontWeight: '900',
  },
  responderStatusText: {
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1,
    marginBottom: 2,
  },
  responderNameText: {
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 20,
  },
  distanceBadge: {
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
  },
  distanceBadgeText: {
    fontSize: 12,
    fontWeight: '900',
    color: '#3B82F6',
  },
});