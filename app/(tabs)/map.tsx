import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, View, Text, Platform, Linking, TouchableOpacity } from 'react-native';
let MapView: any = View;
let Marker: any = View;
let Callout: any = View;
let PROVIDER_GOOGLE: any = null;

if (Platform.OS !== 'web') {
  const maps = require('react-native-maps');
  MapView = maps.default;
  Marker = maps.Marker;
  Callout = maps.Callout;
  PROVIDER_GOOGLE = maps.PROVIDER_GOOGLE;
}
import * as Location from 'expo-location';
import { collection, query, onSnapshot, orderBy } from 'firebase/firestore';
import { db } from '../../firebaseConfig';
import { useTheme } from '../../hooks/ThemeContext';
import { useAuth } from '../../hooks/AuthContext';
import { useLocation } from '../../hooks/LocationContext';
import { MaterialCommunityIcons, Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams } from 'expo-router';

export default function StaffMapScreen() {
  const { colors, isDarkMode } = useTheme();
  const { profile } = useAuth();
  const { userLocation, gpsStatus } = useLocation();
  
  const [activeAlerts, setActiveAlerts] = useState<any[]>([]);
  
  // NEW: Track which coordinates the "Get Directions" button should use
  const [targetCoords, setTargetCoords] = useState<{lat: number, lng: number} | null>(null);

  const { focusLat, focusLng } = useLocalSearchParams<{ focusLat?: string, focusLng?: string }>();
  const mapRef = useRef<any>(null);

  const BABCOCK_REGION = {
    latitude: 6.8912,
    longitude: 3.7197,
    latitudeDelta: 0.015,
    longitudeDelta: 0.015,
  };

  useEffect(() => {
    const q = query(collection(db, 'alerts'), orderBy('timestamp', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      
      let alerts: any[] = snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() }))
        .filter((alert: any) => alert.status === 'Active' && alert.location); 

      // Strictly filter alerts by role
      if (profile?.role === 'medical') {
        alerts = alerts.filter((a: any) => a.type?.includes('Medical') || a.type?.includes('Accident'));
      } else if (profile?.role === 'security') {
        alerts = alerts.filter((a: any) => a.type?.includes('Security') || a.type === 'Critical SOS');
      } else if (profile?.role === 'fire') {
        alerts = alerts.filter((a: any) => a.type?.includes('Fire'));
      }

      setActiveAlerts(alerts);
    });

    return () => unsubscribe();
  }, [profile?.role]);

  // Handle incoming routing from the Dispatch Screen
  useEffect(() => {
    if (focusLat && focusLng && mapRef.current) {
      setTargetCoords({ lat: Number(focusLat), lng: Number(focusLng) });
      setTimeout(() => {
        mapRef.current?.animateToRegion({
          latitude: Number(focusLat),
          longitude: Number(focusLng),
          latitudeDelta: 0.002, 
          longitudeDelta: 0.002,
        }, 1000); 
      }, 500);
    }
  }, [focusLat, focusLng]);

  // NEW: Bulletproof custom function to center map on user
  const centerOnUser = async () => { // Location logic is now handled globally
    if (userLocation && userLocation.coords) {
      mapRef.current?.animateToRegion({
        latitude: userLocation.coords.latitude,
        longitude: userLocation.coords.longitude,
        latitudeDelta: 0.005,
        longitudeDelta: 0.005,
      }, 1000);
    } else {
      console.log("User location not available for centering.");
    }
  };

  const getMarkerStyle = (type: string) => {
    if (type.includes('Medical')) return { color: '#DC2626', icon: 'medical-bag' };
    if (type.includes('Fire')) return { color: '#F59E0B', icon: 'fire' };
    if (type.includes('Security')) return { color: '#3B82F6', icon: 'shield-alert' };
    if (type.includes('Accident')) return { color: '#8B5CF6', icon: 'car-brake-alert' };
    return { color: '#DC2626', icon: 'alert-octagram' };
  };

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef} 
        provider={PROVIDER_GOOGLE}
        style={styles.map}
        initialRegion={BABCOCK_REGION}
        showsUserLocation={true}
        showsMyLocationButton={false} // Hidden native button to use our custom one
        userInterfaceStyle={isDarkMode ? 'dark' : 'light'}
        // Hide the directions button if they tap empty map space
        onPress={() => setTargetCoords(null)} 
      >
        {(activeAlerts || []).map((alert) => {
          const style = getMarkerStyle(alert?.type || 'Emergency');
          return (
            <Marker
              key={alert.id}
              coordinate={{
                latitude: alert?.location?.latitude || 0,
                longitude: alert?.location?.longitude || 0,
              }}
              onPress={() => setTargetCoords({ 
                lat: alert?.location?.latitude || 0, 
                lng: alert?.location?.longitude || 0 
              })}
            >
              <View style={[styles.customMarker, { backgroundColor: style.color }]}>
                <MaterialCommunityIcons name={style.icon as any} size={16} color="#FFF" />
              </View>

              <Callout tooltip>
                <View style={[styles.calloutBox, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                  <Text style={[styles.calloutTitle, { color: colors.text }]}>{alert.type}</Text>
                  <Text style={[styles.calloutSub, { color: colors.textSub }]}>{alert.senderName}</Text>
                  <Text style={[styles.calloutLoc, { color: style.color }]}>{alert.locationName}</Text>
                </View>
              </Callout>
            </Marker>
          );
        })}
      </MapView>

      {/* Floating Status Pill at the Top */}
      <View style={[styles.statusPill, { backgroundColor: colors.surface, shadowColor: '#000' }]}>
        <View style={[styles.statusDot, { backgroundColor: (activeAlerts || []).length > 0 ? '#DC2626' : '#10B981' }]} />
        <Text style={[styles.statusText, { color: colors.text }]}>
          {(activeAlerts || []).length} Active {(activeAlerts || []).length === 1 ? 'Incident' : 'Incidents'}
        </Text>
      </View>

      {/* NEW: Custom "Locate Me" Button */}
      <TouchableOpacity 
        style={[styles.locateButton, { backgroundColor: colors.surface, shadowColor: '#000' }]} 
        onPress={centerOnUser}
      >
        <MaterialCommunityIcons name="crosshairs-gps" size={24} color={isDarkMode ? '#FFF' : '#111827'} />
      </TouchableOpacity>

      {/* Massive Floating Directions Button at the Bottom */}
      {targetCoords && (
        <TouchableOpacity 
          style={styles.floatingDirectionButton}
          onPress={() => {
            const url = Platform.select({
              ios: `http://maps.apple.com/?daddr=${targetCoords.lat},${targetCoords.lng}`,
              android: `google.navigation:q=${targetCoords.lat},${targetCoords.lng}`
            });
            if (url) Linking.openURL(url);
          }}
        >
          <Ionicons name="navigate" size={24} color="#FFF" />
          <Text style={styles.floatingDirectionText}>Get Directions</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  map: {
    ...StyleSheet.absoluteFillObject,
  },
  customMarker: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#FFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  calloutBox: {
    width: 200,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
  },
  calloutTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  calloutSub: {
    fontSize: 12,
    marginBottom: 4,
  },
  calloutLoc: {
    fontSize: 10,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  statusPill: {
    position: 'absolute',
    top: 60,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 25,
    elevation: 5,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 10,
  },
  statusText: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  locateButton: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? 180 : 160, // Sits comfortably above the Route button
    right: 20,
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 5,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 5,
  },
  floatingDirectionButton: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? 160 : 140, 
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#3B82F6', 
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderRadius: 30,
    elevation: 8,
    shadowColor: '#3B82F6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
  },
  floatingDirectionText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8,
    letterSpacing: 0.5,
  }
});