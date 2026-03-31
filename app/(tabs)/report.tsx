import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Platform,
  SafeAreaView,
  ActivityIndicator,
  Modal,
  Image,
  Animated,
  Easing,
  Keyboard,
  Switch
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { Ionicons, MaterialCommunityIcons, FontAwesome5 } from '@expo/vector-icons';
import * as Location from 'expo-location';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
let MapView: any = View;
let Marker: any = View;
let PROVIDER_GOOGLE: any = null;

if (Platform.OS !== 'web') {
  const maps = require('react-native-maps');
  MapView = maps.default;
  Marker = maps.Marker;
  PROVIDER_GOOGLE = maps.PROVIDER_GOOGLE;
}
import { Audio } from 'expo-av';
import * as SMS from 'expo-sms';
import * as Network from 'expo-network';

// FIRESTORE & UPLOAD IMPORTS
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../firebaseConfig';
import { uploadMediaToCloudinary } from '../../utils/cloudinary';

import { useTheme } from '../../hooks/ThemeContext';
import { useAuth } from '../../hooks/AuthContext';
import { getRefinedAddress } from '../../utils/location';
import { useLocation } from '../../hooks/LocationContext';

type EmergencyCategory = 'Medical' | 'Fire' | 'Security Threat' | 'Accident';

interface TypeCardProps {
  label: EmergencyCategory;
  icon: any;
  IconFamily: any;
  color: string;
  isSelected: boolean;
  onSelect: (category: EmergencyCategory) => void;
  colors: any;
}

const SectionHeader = ({ title, isRequired, label, themeColors }: any) => (
  <View style={styles.sectionHeaderRow}>
    <Text style={[styles.sectionTitle, { color: themeColors.text }]}>
      {title} {isRequired && <Text style={styles.requiredAsterisk}>{'*'}</Text>}
    </Text>
    {label && (
      <View style={[styles.optionalPill, { backgroundColor: themeColors.border }]}>
        <Text style={styles.optionalPillText}>{label}</Text>
      </View>
    )}
  </View>
);

const EmergencyTypeCard: React.FC<TypeCardProps> = ({ label, icon, IconFamily, color, isSelected, onSelect, colors }) => (
  <TouchableOpacity
    style={[
      styles.typeCard,
      {
        backgroundColor: colors.surface,
        borderColor: isSelected ? color : colors.border
      },
    ]}
    onPress={() => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      onSelect(label);
    }}
    activeOpacity={0.7}
  >
    {isSelected && <View style={[styles.selectedDot, { backgroundColor: color }]} />}
    <View style={[styles.typeIconBg, { backgroundColor: color + '15' }]}>
      <IconFamily name={icon} size={28} color={color} />
    </View>
    <Text style={[styles.typeCardLabel, { color: isSelected ? color : colors.text }]}>{label}</Text>
  </TouchableOpacity>
);

export default function ReportScreen() {
  const router = useRouter();
  const { colors, isDarkMode, toggleTheme } = useTheme();
  const { profile, user } = useAuth();
  const { userLocation, locationName: globalLocationName } = useLocation();

  const spinValue = useRef(new Animated.Value(0)).current;
  const pulseValue = useRef(new Animated.Value(1)).current;
  const spinAnimation = useRef<Animated.CompositeAnimation | null>(null);

  const [selectedType, setSelectedType] = useState<EmergencyCategory | null>(null);
  const [description, setDescription] = useState('');
  const [media, setMedia] = useState<{ uri: string, type: 'image' | 'video' } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isAnonymous, setIsAnonymous] = useState(false);

  // Audio Recording States
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [audioUri, setAudioUri] = useState<string | null>(null);

  // Location States
  const [coords, setCoords] = useState<{ latitude: number, longitude: number } | null>(null);
  const [locationName, setLocationName] = useState('Locating...');
  const [isFetchingLocation, setIsFetchingLocation] = useState(false);
  const [buildingName, setBuildingName] = useState('');

  const [kbHeight, setKbHeight] = useState(0);

  const [customAlert, setCustomAlert] = useState({
    visible: false,
    title: '',
    message: '',
    type: 'success' as 'success' | 'error' | 'info'
  });

  const isFormValid = selectedType !== null && (description || '').trim().length > 0;

  useEffect(() => {
    const showEvt = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvt = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const showSub = Keyboard.addListener(showEvt, (e) => {
      setKbHeight(e.endCoordinates.height);
    });
    const hideSub = Keyboard.addListener(hideEvt, () => {
      setKbHeight(0);
    });

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  const startSpin = useCallback(() => {
    spinValue.setValue(0);
    spinAnimation.current = Animated.loop(
      Animated.timing(spinValue, {
        toValue: 1,
        duration: 1000,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );
    spinAnimation.current.start();
  }, [spinValue]);

  const stopSpin = useCallback(() => {
    if (spinAnimation.current) {
      spinAnimation.current.stop();
      spinValue.setValue(0);
    }
  }, [spinValue]);

  const spin = spinValue.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg']
  });

  useEffect(() => {
    if (isRecording) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseValue, { toValue: 1.5, duration: 600, useNativeDriver: true }),
          Animated.timing(pulseValue, { toValue: 1, duration: 600, useNativeDriver: true }),
        ])
      ).start();
    } else {
      pulseValue.setValue(1);
    }
  }, [isRecording, pulseValue]);

  // Sync with global location on mount
  useEffect(() => {
    if (userLocation && !coords) {
      setCoords({ latitude: userLocation.coords.latitude, longitude: userLocation.coords.longitude });
      setLocationName(globalLocationName);
    }
  }, [userLocation, globalLocationName, coords]);

  const fetchLocation = useCallback(async () => {
    // Manual re-sync with global state if requested
    if (userLocation) {
      setCoords({ latitude: userLocation.coords.latitude, longitude: userLocation.coords.longitude });
      setLocationName(globalLocationName);
    }
  }, [userLocation, globalLocationName]);

  const onRegionChangeComplete = async (region: any) => {
    if (isSubmitting || isFetchingLocation) return;
    const { latitude, longitude } = region;
    setCoords({ latitude, longitude });

    const newName = await getRefinedAddress(latitude, longitude);
    
    // 💡 STICKINESS LOGIC: If we already have a specific name (like "Hall" or "Hospital") 
    // and the new geocode is a generic road name (like "Isara" or "Road"), 
    // we keep the specific name if the movement is small.
    setLocationName(prev => {
      const isGeneric = (n: string) => (n || '').includes('Road') || (n || '').includes('Isara') || (n || '').includes('Street') || (n || '').includes('Way');
      const isSpecific = (n: string | null | undefined) => n && !isGeneric(n) && n.length > 5;
      
      if (isSpecific(prev) && isGeneric(newName)) {
         // Keep the specific one if it feels better
         return prev;
      }
      return newName;
    });
  };

  const handleMediaUpload = async (useCamera: boolean) => {
    const permissionResult = useCamera
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (permissionResult.status !== 'granted') return;

    const options: ImagePicker.ImagePickerOptions = {
      mediaTypes: ImagePicker.MediaTypeOptions.All,
      allowsEditing: false,
      quality: 0.7,
    };

    let result = useCamera
      ? await ImagePicker.launchCameraAsync(options)
      : await ImagePicker.launchImageLibraryAsync(options);

    if (!result.canceled) {
      const asset = result.assets[0];
      setMedia({
        uri: asset.uri,
        type: asset.type === 'video' ? 'video' : 'image'
      });
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
  };

  const toggleRecording = async () => {
    if (isRecording) {
      try {
        setIsRecording(false);
        await recording?.stopAndUnloadAsync();
        const uri = recording?.getURI();
        setAudioUri(uri || null);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } catch (err) {
        console.error("Failed to stop recording:", err);
      }
    } else {
      try {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        const permission = await Audio.requestPermissionsAsync();
        if (permission.status !== 'granted') {
          setCustomAlert({ visible: true, title: 'Permission Denied', message: 'Microphone access is required for voice notes.', type: 'error' });
          return;
        }
        await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
        const { recording: newRecording } = await Audio.Recording.createAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
        setRecording(newRecording);
        setIsRecording(true);
      } catch (err) {
        console.error("Failed to start recording:", err);
        setCustomAlert({ visible: true, title: 'Error', message: 'Could not start audio recording.', type: 'error' });
      }
    }
  };

  // --- DETAILED REPORT SUBMISSION (Optimized for Speed) ---
  const handleSubmit = async () => {
    if (!isFormValid || isSubmitting) {
      if (!isFormValid) {
        setCustomAlert({
          visible: true,
          title: 'Information Required',
          message: 'Please select an emergency type and provide a description.',
          type: 'error'
        });
      }
      return;
    }

    setIsSubmitting(true);

    try {
      // 1. CHECK INTERNET CONNECTION
      const networkState = await Network.getNetworkStateAsync();
      const isOffline = networkState.isConnected === false || networkState.isInternetReachable === false;

      // 2. OFFLINE SMS FALLBACK (Instant)
      if (isOffline) {
        const isAvailable = await SMS.isAvailableAsync();
        if (isAvailable) {
          const mapsLink = coords ? `\n\nMap: https://maps.google.com/?q=${coords.latitude},${coords.longitude}` : '';
          const senderDisplay = isAnonymous ? 'Anonymous Reporter' : `${profile?.firstName || 'User'} ${profile?.lastName || ''}`.trim();

          await SMS.sendSMSAsync(
            ['08000000000'], // Replace with actual Babcock Security Phone Number
            `URGENT: ${selectedType} Report.\n\nDesc: ${description}\nName: ${senderDisplay}\nLocation: ${locationName}${mapsLink}`
          );
          // Removed the annoying popup here so SMS opens instantly
        } else {
          setCustomAlert({ visible: true, title: "Delivery Failed", message: "No internet and SMS is unavailable on this device.", type: 'error' });
        }
        setIsSubmitting(false);
        return;
      }

      // 3. ONLINE FIREBASE SUBMISSION
      let finalMediaUrl = null;
      let finalAudioUrl = null;

      if (media?.uri) {
        finalMediaUrl = await uploadMediaToCloudinary(media.uri, 'image');
      }

      if (audioUri) {
        finalAudioUrl = await uploadMediaToCloudinary(audioUri, 'audio');
      }

      await addDoc(collection(db, 'alerts'), {
        type: selectedType,
        description: description.trim(),
        locationName: locationName,
        buildingName: buildingName.trim(),
        location: coords,
        mediaUrl: finalMediaUrl,
        audioUrl: finalAudioUrl,
        mediaType: media?.type || null,
        senderId: user?.uid || 'anonymous',
        senderName: isAnonymous ? 'Anonymous Reporter' : `${profile?.firstName || 'User'} ${profile?.lastName || ''}`.trim(),
        senderRole: isAnonymous ? 'Hidden' : (profile?.role || 'student'),
        status: 'Active',
        timestamp: serverTimestamp(),
      });

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setIsSubmitting(false);
      setCustomAlert({
        visible: true,
        title: 'Alert Sent',
        message: 'Your emergency report and evidence have been broadcasted to campus security.',
        type: 'success'
      });

      setDescription('');
      setBuildingName('');
      setMedia(null);
      setAudioUri(null);
      setSelectedType(null);
      setIsAnonymous(false);
    } catch (err) {
      console.error('Submission error:', err);
      setIsSubmitting(false);
      setCustomAlert({
        visible: true,
        title: 'Upload Failed',
        message: 'Failed to upload evidence. Check your network connection.',
        type: 'error'
      });
    }
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.headerBg }]}>
      <Stack.Screen options={{ headerShown: false }} />

      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <View style={[styles.header, { backgroundColor: colors.headerBg }]}>
          <TouchableOpacity onPress={() => router.push('/(tabs)')} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={colors.headerText} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.headerText }]}>{'Report an Emergency'}</Text>
        </View>

        <ScrollView
          style={{ flex: 1, backgroundColor: colors.background }}
          contentContainerStyle={{ padding: 20 }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* 1. EMERGENCY TYPE SECTION */}
          <View style={styles.section}>
            <SectionHeader title="EMERGENCY TYPE" isRequired label="Required" themeColors={colors} />
            <View style={styles.grid}>
              <EmergencyTypeCard colors={colors} label="Medical" icon="heart-pulse" IconFamily={MaterialCommunityIcons} color="#E03131" isSelected={selectedType === 'Medical'} onSelect={setSelectedType} />
              <EmergencyTypeCard colors={colors} label="Fire" icon="fire" IconFamily={MaterialCommunityIcons} color="#F59E0B" isSelected={selectedType === 'Fire'} onSelect={setSelectedType} />
              <EmergencyTypeCard colors={colors} label="Security Threat" icon="shield-half-full" IconFamily={MaterialCommunityIcons} color="#3B82F6" isSelected={selectedType === 'Security Threat'} onSelect={setSelectedType} />
              <EmergencyTypeCard colors={colors} label="Accident" icon="car-crash" IconFamily={FontAwesome5} color="#8B5CF6" isSelected={selectedType === 'Accident'} onSelect={setSelectedType} />
            </View>
          </View>

          {/* 2. DESCRIPTION SECTION */}
          <View style={styles.section}>
            <SectionHeader title="DESCRIPTION" isRequired themeColors={colors} />
            <View style={[styles.textAreaContainer, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <TextInput
                style={[styles.textArea, { color: colors.text }]}
                placeholder="Briefly describe what is happening..."
                placeholderTextColor={colors.textSub}
                multiline
                numberOfLines={4}
                value={description}
                onChangeText={setDescription}
                textAlignVertical="top"
              />
            </View>
          </View>

          {/* 3. LOCATION SECTION */}
          <View style={styles.section}>
            <SectionHeader title="LOCATION" themeColors={colors} />
            <View style={[styles.locationCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <View style={styles.locationHeader}>
                <View style={[styles.locationIconBg, { backgroundColor: isDarkMode ? '#1E3A8A44' : '#EFF6FF' }]}>
                  <Ionicons name="location" size={20} color="#3B82F6" />
                </View>
                <View style={styles.locationDetails}>
                  <Text style={[styles.locationName, { color: colors.text }]} numberOfLines={2}>
                    {locationName}
                  </Text>
                  <Text style={[styles.locationCoords, { color: colors.textSub }]}>
                    {coords ? `GPS: ${coords.latitude?.toFixed(4)}°, ${coords.longitude?.toFixed(4)}°` : 'GPS: Fetching...'}
                  </Text>
                </View>
                <TouchableOpacity onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); fetchLocation(); }}>
                  <Animated.View style={{ transform: [{ rotate: spin }] }}>
                    <Ionicons name="refresh" size={20} color={isFetchingLocation ? "#3B82F6" : colors.textSub} />
                  </Animated.View>
                </TouchableOpacity>
              </View>

              <View style={[styles.buildingInputContainer, { borderTopColor: colors.border }]}>
                <Ionicons name="business" size={18} color={colors.textSub} style={{ marginRight: 10 }} />
                <TextInput
                  style={[styles.buildingInput, { color: colors.text }]}
                  placeholder="Hostel Name & Room (e.g. Bethel, 201)"
                  placeholderTextColor={colors.textSub}
                  value={buildingName}
                  onChangeText={setBuildingName}
                />
              </View>

              <View style={[styles.mapPlaceholder, { borderTopColor: colors.border, justifyContent: 'center', alignItems: 'center' }]}>
                {coords ? (
                  <View style={styles.map}>
                    <MapView
                      provider={PROVIDER_GOOGLE}
                      style={StyleSheet.absoluteFillObject}
                      initialRegion={{
                        latitude: coords.latitude,
                        longitude: coords.longitude,
                        latitudeDelta: 0.005,
                        longitudeDelta: 0.005,
                      }}
                      showsUserLocation={true}
                      onRegionChangeComplete={onRegionChangeComplete}
                    />
                    <View style={styles.mapCenterMarker} pointerEvents="none">
                      <Ionicons name="pin" size={36} color="#DC2626" />
                      <View style={styles.markerShadow} />
                    </View>
                  </View>
                ) : (
                  <ActivityIndicator size="small" color={colors.textSub} />
                )}
                <View style={[styles.adjustLocationPill, { backgroundColor: colors.surface }]}>
                  <Text style={[styles.adjustLocationText, { color: colors.text }]}>{'Drag Map to Pinpoint'}</Text>
                </View>
              </View>
            </View>
          </View>

          {/* 4. MEDIA & EVIDENCE SECTION */}
          <View style={styles.section}>
            <SectionHeader title="ATTACH EVIDENCE" label="(Optional)" themeColors={colors} />

            <View style={{ marginBottom: 15 }}>
              {audioUri ? (
                <View style={[styles.audioAttachedCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                  <View style={styles.audioIconBg}>
                    <Ionicons name="volume-high" size={24} color="#8B5CF6" />
                  </View>
                  <Text style={[styles.audioAttachedText, { color: colors.text }]}>Voice Note Attached</Text>
                  <TouchableOpacity onPress={() => setAudioUri(null)} style={styles.audioDeleteBtn}>
                    <Ionicons name="trash-outline" size={20} color="#DC2626" />
                  </TouchableOpacity>
                </View>
              ) : (
                <TouchableOpacity
                  style={[
                    styles.audioRecordBtn,
                    { backgroundColor: isRecording ? '#FEE2E2' : colors.surface, borderColor: isRecording ? '#DC2626' : colors.border }
                  ]}
                  onPress={toggleRecording}
                  activeOpacity={0.8}
                >
                  {isRecording ? (
                    <>
                      <Animated.View style={[styles.recordingPulse, { transform: [{ scale: pulseValue }] }]} />
                      <View style={styles.recordingDot} />
                      <Text style={[styles.audioBtnText, { color: '#DC2626', fontWeight: 'bold' }]}>RECORDING... TAP TO STOP</Text>
                    </>
                  ) : (
                    <>
                      <MaterialCommunityIcons name="microphone" size={24} color="#8B5CF6" />
                      <Text style={[styles.audioBtnText, { color: colors.text }]}>Record Voice Note</Text>
                    </>
                  )}
                </TouchableOpacity>
              )}
            </View>

            {media ? (
              <View style={[styles.mediaPreviewContainer, { borderColor: colors.border }]}>
                <Image source={{ uri: media.uri }} style={styles.mediaPreview} />
                <TouchableOpacity style={styles.removeMediaBtn} onPress={() => setMedia(null)}>
                  <Ionicons name="close-circle" size={30} color="#DC2626" />
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.mediaActionRow}>
                <TouchableOpacity
                  style={[styles.mediaHalfBox, { backgroundColor: colors.surface, borderColor: colors.border }]}
                  onPress={() => handleMediaUpload(true)}
                >
                  <Ionicons name="camera" size={28} color="#3B82F6" />
                  <Text style={[styles.mediaActionText, { color: colors.text }]}>{'Take Photo'}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.mediaHalfBox, { backgroundColor: colors.surface, borderColor: colors.border }]}
                  onPress={() => handleMediaUpload(false)}
                >
                  <Ionicons name="images" size={28} color="#8B5CF6" />
                  <Text style={[styles.mediaActionText, { color: colors.text }]}>{'Gallery'}</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>

          {/* 5. ANONYMOUS TOGGLE CARD */}
          <View style={[styles.anonymousContainer, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={styles.anonymousTextCol}>
              <Text style={[styles.anonymousTitle, { color: colors.text }]}>Report Anonymously</Text>
              <Text style={[styles.anonymousSub, { color: colors.textSub }]}>Hide your name and role from dispatchers.</Text>
            </View>
            <Switch
              value={isAnonymous}
              onValueChange={(val) => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setIsAnonymous(val);
              }}
              trackColor={{ false: '#D1D5DB', true: '#10B981' }}
              thumbColor={'#FFF'}
            />
          </View>

          {/* 6. FOOTER / SUBMIT SECTION */}
          <View style={styles.footer}>
            <TouchableOpacity
              style={[
                styles.submitButton,
                (!isFormValid || isSubmitting || isFetchingLocation) && { opacity: 0.5 }
              ]}
              onPress={handleSubmit}
              activeOpacity={0.8}
              disabled={!isFormValid || isSubmitting || isFetchingLocation}
            >
              {isSubmitting ? (
                <ActivityIndicator color="#FFF" />
              ) : (
                <>
                  <MaterialCommunityIcons name="bullhorn-variant" size={22} color="#FFF" style={{ marginRight: 8 }} />
                  <Text style={styles.submitButtonText}>
                    {media || audioUri ? 'UPLOAD & SEND ALERT' : 'SEND ALERT'}
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </View>

          <View style={{ height: kbHeight > 0 ? kbHeight + 80 : 120 }} />

        </ScrollView>
      </View>

      <Modal visible={customAlert.visible} animationType="fade" transparent={true}>
        <View style={styles.customModalOverlay}>
          <View style={[styles.customModalContent, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Ionicons name={customAlert.type === 'success' ? 'checkmark-circle' : 'alert-circle'} size={45} color={customAlert.type === 'success' ? '#10B981' : '#DC2626'} />
            <Text style={[styles.customModalTitle, { color: colors.text }]}>{customAlert.title}</Text>
            <Text style={[styles.customModalText, { color: colors.textSub }]}>{customAlert.message}</Text>
            <TouchableOpacity
              style={[styles.primaryButton, { backgroundColor: customAlert.type === 'success' ? '#10B981' : '#DC2626' }]}
              onPress={() => {
                setCustomAlert({ ...customAlert, visible: false });
                if (customAlert.type === 'success') router.push('/(tabs)');
              }}
            >
              <Text style={styles.primaryButtonText}>{'OK'}</Text>
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
  section: { marginBottom: 30 },
  sectionHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  sectionTitle: { fontSize: 14, fontWeight: 'bold', letterSpacing: 1 },
  requiredAsterisk: { color: '#DC2626' },
  optionalPill: { paddingVertical: 4, paddingHorizontal: 8, borderRadius: 12 },
  optionalPillText: { fontSize: 10, color: '#6B7280', fontWeight: '600' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  typeCard: { width: '48%', borderRadius: 16, padding: 15, alignItems: 'center', marginBottom: 15, borderWidth: 2 },
  selectedDot: { position: 'absolute', top: 10, right: 10, width: 10, height: 10, borderRadius: 5 },
  typeIconBg: { width: 56, height: 56, borderRadius: 28, justifyContent: 'center', alignItems: 'center', marginBottom: 10 },
  typeCardLabel: { fontSize: 14, fontWeight: '600', textAlign: 'center' },
  textAreaContainer: { borderRadius: 12, padding: 12, borderWidth: 1 },
  textArea: { height: 100, fontSize: 15 },

  audioRecordBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 18, borderRadius: 16, borderWidth: 1, borderStyle: 'dashed' },
  audioBtnText: { marginLeft: 10, fontSize: 15, fontWeight: '600' },
  recordingPulse: { position: 'absolute', width: 20, height: 20, borderRadius: 10, backgroundColor: 'rgba(220, 38, 38, 0.3)' },
  recordingDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: '#DC2626', marginRight: 10, zIndex: 1 },
  audioAttachedCard: { flexDirection: 'row', alignItems: 'center', padding: 15, borderRadius: 16, borderWidth: 1 },
  audioIconBg: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#EDE9FE', justifyContent: 'center', alignItems: 'center', marginRight: 15 },
  audioAttachedText: { flex: 1, fontSize: 15, fontWeight: '600' },
  audioDeleteBtn: { padding: 8, backgroundColor: '#FEE2E2', borderRadius: 20 },

  locationCard: { borderRadius: 16, overflow: 'hidden', borderWidth: 1 },
  locationHeader: { flexDirection: 'row', alignItems: 'center', padding: 15 },
  locationIconBg: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  locationDetails: { flex: 1, marginRight: 10 },
  locationName: { fontSize: 14, fontWeight: 'bold' },
  locationCoords: { fontSize: 12, marginTop: 2 },
  mapPlaceholder: { height: 180, borderTopWidth: 1 },
  map: { ...StyleSheet.absoluteFillObject },
  adjustLocationPill: { position: 'absolute', bottom: 10, left: 10, paddingVertical: 6, paddingHorizontal: 16, borderRadius: 20, elevation: 4, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 4 },
  adjustLocationText: { fontSize: 12, fontWeight: '600' },
  mediaActionRow: { flexDirection: 'row', justifyContent: 'space-between' },
  mediaHalfBox: { width: '48%', height: 100, borderRadius: 16, borderWidth: 2, borderStyle: 'dashed', justifyContent: 'center', alignItems: 'center' },
  mediaActionText: { marginTop: 8, fontSize: 13, fontWeight: '600' },
  mediaPreviewContainer: { width: '100%', height: 220, borderRadius: 16, borderWidth: 1, overflow: 'hidden' },
  mediaPreview: { width: '100%', height: '100%' },
  removeMediaBtn: { position: 'absolute', top: 10, right: 10, backgroundColor: 'white', borderRadius: 15 },
  footer: { marginTop: 10 },
  submitButton: { backgroundColor: '#DC2626', flexDirection: 'row', borderRadius: 16, paddingVertical: 18, justifyContent: 'center', alignItems: 'center', elevation: 4, shadowColor: '#DC2626', shadowOpacity: 0.3, shadowRadius: 8, shadowOffset: { width: 0, height: 4 } },
  submitButtonText: { color: '#FFF', fontSize: 16, fontWeight: 'bold', letterSpacing: 1 },
  customModalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  customModalContent: { width: '100%', maxWidth: 340, borderRadius: 24, padding: 25, alignItems: 'center', elevation: 10, shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 15, borderWidth: 1 },
  customModalTitle: { fontSize: 22, fontWeight: 'bold', marginBottom: 12, textAlign: 'center', marginTop: 10 },
  customModalText: { fontSize: 14, textAlign: 'center', lineHeight: 22, marginBottom: 30 },
  primaryButton: { width: '100%', paddingVertical: 15, borderRadius: 14, alignItems: 'center' },
  primaryButtonText: { color: '#FFF', fontSize: 16, fontWeight: 'bold', letterSpacing: 0.5 },

  anonymousContainer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 15, borderRadius: 16, borderWidth: 1, marginBottom: 20 },
  anonymousTextCol: { flex: 1, marginRight: 15 },
  anonymousTitle: { fontSize: 15, fontWeight: 'bold', marginBottom: 2 },
  anonymousSub: { fontSize: 12 },

  buildingInputContainer: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 15, paddingVertical: 12, borderTopWidth: 1 },
  buildingInput: { flex: 1, fontSize: 14, fontWeight: '500' },
  mapCenterMarker: { position: 'absolute', top: '50%', left: '50%', marginLeft: -18, marginTop: -36, alignItems: 'center', justifyContent: 'center' },
  markerShadow: { width: 4, height: 4, borderRadius: 2, backgroundColor: 'rgba(0,0,0,0.3)', marginTop: -2 }
});