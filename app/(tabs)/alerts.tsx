import React, { useState, useEffect } from 'react';
import { 
  StyleSheet, 
  Text, 
  View, 
  FlatList, 
  TouchableOpacity, 
  SafeAreaView, 
  ActivityIndicator,
  Platform,
  Modal,
  Image,
  ScrollView
} from 'react-native';
import { Ionicons, MaterialCommunityIcons, FontAwesome5 } from '@expo/vector-icons';
import * as Location from 'expo-location';
let MapView: any = View;
let Marker: any = View;
let PROVIDER_GOOGLE: any = null;

if (Platform.OS !== 'web') {
  const maps = require('react-native-maps');
  MapView = maps.default;
  Marker = maps.Marker;
  PROVIDER_GOOGLE = maps.PROVIDER_GOOGLE;
}
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore';
import { db } from '../../firebaseConfig';
import { useTheme } from '../../hooks/ThemeContext';
import { useLocation } from '../../hooks/LocationContext';
import { formatDistanceToNow } from 'date-fns';

interface Alert {
  id: string;
  type?: string;
  description?: string;
  locationName?: string;
  location?: { latitude: number; longitude: number };
  mediaUri?: string;
  mediaType?: string;
  senderName?: string;
  senderRole?: string;
  status?: string;
  timestamp?: any;
}

// Styling Logic with isResolved check
const getCategoryStyles = (type?: string, isResolved?: boolean) => {
  let baseColor = '#6B7280';
  let icon = 'alert';
  let IconFamily: any = Ionicons;

  if (type?.includes('Medical')) { baseColor = '#DC2626'; icon = 'heart-pulse'; IconFamily = MaterialCommunityIcons; }
  else if (type?.includes('Fire')) { baseColor = '#EA580C'; icon = 'fire'; IconFamily = MaterialCommunityIcons; }
  else if (type?.includes('Security')) { baseColor = '#2563EB'; icon = 'shield-half-full'; IconFamily = MaterialCommunityIcons; }
  else if (type?.includes('Accident')) { baseColor = '#7C3AED'; icon = 'car-crash'; IconFamily = FontAwesome5; }
  else if (type?.includes('Critical SOS')) { baseColor = '#991B1B'; icon = 'alert-decagram'; IconFamily = MaterialCommunityIcons; }

  // Grey out if resolved
  if (isResolved) {
    baseColor = '#9CA3AF';
  }

  return { color: baseColor, icon, IconFamily };
};

// Distance Calculation Math with Drift Compensation
const getDistanceInMeters = (lat1?: number, lon1?: number, lat2?: number, lon2?: number) => {
  if (!lat1 || !lon1 || !lat2 || !lon2) return null;
  const R = 6371e3; 
  const rad = Math.PI / 180;
  const dLat = (lat2 - lat1) * rad;
  const dLon = (lon2 - lon1) * rad;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + 
            Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = Math.round(R * c);

  return distance < 30 ? 0 : distance;
};

const FILTER_CATEGORIES = ['All', 'Medical', 'Fire', 'Security', 'Accident', 'Critical SOS'];

export default function AlertsScreen() {
  const { colors } = useTheme();
  
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'Active' | 'Resolved'>('Active');
  
  // Filter States
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [activeFilter, setActiveFilter] = useState('All');

  const { userLocation } = useLocation();
  const [selectedAlert, setSelectedAlert] = useState<Alert | null>(null);

  useEffect(() => {
    const q = query(collection(db, 'alerts'), orderBy('timestamp', 'desc'));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedAlerts: Alert[] = [];
      snapshot.forEach((doc) => {
        fetchedAlerts.push({ id: doc.id, ...doc.data() } as Alert);
      });
      setAlerts(fetchedAlerts);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching alerts: ", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Apply Tab and Filter logic
  const filteredAlerts = alerts.filter(alert => {
    const alertStatus = alert.status || 'Active';
    const isResolved = alertStatus !== 'Active';
    
    // Check Tab
    const matchesTab = activeTab === 'Active' ? !isResolved : isResolved;
    
    // Check Filter
    const matchesFilter = activeFilter === 'All' ? true : alert.type?.includes(activeFilter);

    return matchesTab && matchesFilter;
  });

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

  const renderAlertCard = ({ item }: { item: Alert }) => {
    const isResolved = (item.status || 'Active') !== 'Active';
    const { color, icon, IconFamily } = getCategoryStyles(item.type, isResolved);
    
    const displayType = item.type || 'Unknown Alert';
    const displayLocation = item.locationName || 'Unknown Location';
    
    const dist = getDistanceInMeters(
      userLocation?.coords?.latitude, 
      userLocation?.coords?.longitude, 
      item.location?.latitude, 
      item.location?.longitude
    );

    return (
      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        
        <View style={styles.cardHeader}>
          <View style={[styles.badge, { backgroundColor: color + '15', borderColor: color + '30', borderWidth: 1 }]}>
            <IconFamily name={icon} size={12} color={color} />
            <Text style={[styles.badgeText, { color: color }]}>{displayType.toUpperCase()}</Text>
          </View>
          
          <Text style={[styles.timeText, { color: colors.textSub }]}>{formatTime(item.timestamp)}</Text>
        </View>

        <Text style={[styles.locationText, { color: isResolved ? colors.textSub : colors.text }]} numberOfLines={1}>
          {displayLocation.toUpperCase()}
        </Text>
        <Text style={[styles.descriptionText, { color: colors.textSub }]} numberOfLines={2}>
          {item.description || 'No description provided.'}
        </Text>

        <View style={[styles.cardFooter, { borderTopColor: colors.border }]}>
          <View style={styles.distanceContainer}>
            <Ionicons name="navigate-outline" size={14} color={colors.textSub} style={{ marginRight: 4 }} />
            <Text style={[styles.distanceText, { color: colors.textSub }]} numberOfLines={1}>
              {dist !== null ? (dist === 0 ? 'Here' : `${dist}m away`) : 'Locating...'}
            </Text>
          </View>
          
          <TouchableOpacity 
            style={[styles.detailsBtn, { backgroundColor: color }]}
            onPress={() => setSelectedAlert(item)}
            activeOpacity={0.8}
          >
            <Text style={styles.detailsBtnText}>DETAILS</Text>
          </TouchableOpacity>
        </View>

      </View>
    );
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]}>
      
      <View style={[styles.headerContainer, { backgroundColor: colors.headerBg }]}>
        <View style={styles.headerRow}>
          <View>
            <Text style={[styles.headerTitle, { color: colors.headerText }]}>EMERGENCY ALERTS</Text>
            <Text style={[styles.headerSubtitle, { color: colors.headerText + '99' }]}>
              {(filteredAlerts || []).length} {activeFilter !== 'All' ? activeFilter.toLowerCase() : ''} {activeTab.toLowerCase()} alerts
            </Text>
          </View>
          <TouchableOpacity 
            style={[styles.filterBtn, { backgroundColor: activeFilter !== 'All' ? '#DC2626' : colors.headerText + '15' }]}
            onPress={() => setShowFilterModal(true)}
          >
            <Ionicons name="options-outline" size={24} color={activeFilter !== 'All' ? '#FFF' : colors.headerText} />
          </TouchableOpacity>
        </View>

        <View style={[styles.tabContainer, { backgroundColor: colors.headerText + '15' }]}>
          <TouchableOpacity 
            style={[styles.tabBtn, activeTab === 'Active' && [styles.tabBtnActive, { backgroundColor: colors.surface }]]}
            onPress={() => setActiveTab('Active')}
          >
            <Text style={[styles.tabText, activeTab === 'Active' ? { color: colors.text } : { color: colors.headerText } ]}>
              Active ({(alerts || []).filter(a => (a?.status || 'Active') === 'Active').length})
            </Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.tabBtn, activeTab === 'Resolved' && [styles.tabBtnActive, { backgroundColor: colors.surface }]]}
            onPress={() => setActiveTab('Resolved')}
          >
            <Text style={[styles.tabText, activeTab === 'Resolved' ? { color: colors.text } : { color: colors.headerText } ]}>
              Resolved ({(alerts || []).filter(a => (a?.status || 'Active') !== 'Active').length})
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#DC2626" />
          <Text style={[styles.emptyText, { color: colors.textSub, marginTop: 12 }]}>Loading alerts...</Text>
        </View>
      ) : (filteredAlerts || []).length === 0 ? (
        <View style={styles.centerContainer}>
          <Ionicons name={activeFilter !== 'All' ? "filter-outline" : "shield-checkmark-outline"} size={60} color={activeFilter !== 'All' ? colors.textSub : "#10B981"} />
          <Text style={[styles.emptyText, { color: colors.text, marginTop: 16 }]}>All Clear</Text>
          <Text style={[styles.emptySubText, { color: colors.textSub }]}>No {activeTab.toLowerCase()} {activeFilter !== 'All' ? activeFilter.toLowerCase() + ' ' : ''}emergencies found.</Text>
        </View>
      ) : (
        <FlatList
          data={filteredAlerts || []}
          keyExtractor={(item) => item.id}
          renderItem={renderAlertCard}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ListFooterComponent={() => (
            <Text style={[styles.endOfListText, { color: colors.textSub }]}>END OF ALERTS</Text>
          )}
        />
      )}

      {/* FILTER MODAL */}
      <Modal visible={showFilterModal} animationType="fade" transparent={true} onRequestClose={() => setShowFilterModal(false)}>
        <View style={styles.filterModalOverlay}>
          <View style={[styles.filterModalContent, { backgroundColor: colors.surface }]}>
            <View style={styles.filterModalHeader}>
              <Text style={[styles.filterModalTitle, { color: colors.text }]}>Filter by Category</Text>
              <TouchableOpacity onPress={() => setShowFilterModal(false)}>
                <Ionicons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>
            
            {FILTER_CATEGORIES.map((category) => {
              const isActive = activeFilter === category;
              return (
                <TouchableOpacity 
                  key={category}
                  style={[styles.filterOptionBtn, { borderBottomColor: colors.border }]}
                  onPress={() => {
                    setActiveFilter(category);
                    setShowFilterModal(false);
                  }}
                >
                  <Text style={[styles.filterOptionText, { color: isActive ? '#DC2626' : colors.text, fontWeight: isActive ? 'bold' : 'normal' }]}>
                    {category}
                  </Text>
                  {isActive && <Ionicons name="checkmark-circle" size={20} color="#DC2626" />}
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      </Modal>

      {/* ALERT DETAILS MODAL */}
      <Modal visible={!!selectedAlert} animationType="slide" transparent={false} onRequestClose={() => setSelectedAlert(null)}>
        {selectedAlert && (
          <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
            <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
              <TouchableOpacity onPress={() => setSelectedAlert(null)} style={styles.closeBtn}>
                <Ionicons name="chevron-down" size={28} color={colors.text} />
              </TouchableOpacity>
              <Text style={[styles.modalTitle, { color: colors.text }]}>Incident Details</Text>
              <View style={{ width: 28 }} />
            </View>

            <ScrollView contentContainerStyle={{ paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
              
              <View style={[styles.modalMapContainer, { borderBottomColor: colors.border }]}>
                {selectedAlert.location ? (
                  <MapView
                    provider={PROVIDER_GOOGLE}
                    style={StyleSheet.absoluteFillObject}
                    initialRegion={{
                      latitude: selectedAlert.location.latitude,
                      longitude: selectedAlert.location.longitude,
                      latitudeDelta: 0.005,
                      longitudeDelta: 0.005,
                    }}
                    pitchEnabled={false}
                  >
                    <Marker coordinate={selectedAlert.location}>
                      <View style={styles.mapMarkerPulse}>
                        <View style={[styles.mapMarkerCore, { backgroundColor: getCategoryStyles(selectedAlert.type, (selectedAlert.status || 'Active') !== 'Active').color }]} />
                      </View>
                    </Marker>
                  </MapView>
                ) : (
                  <View style={styles.centerContainer}>
                    <Ionicons name="location-outline" size={40} color={colors.textSub} />
                    <Text style={{ color: colors.textSub, marginTop: 10 }}>No GPS coordinates provided</Text>
                  </View>
                )}
              </View>

              <View style={styles.modalContentPane}>
                <View style={styles.modalBadgeRow}>
                  <View style={[styles.badge, { backgroundColor: getCategoryStyles(selectedAlert.type, (selectedAlert.status || 'Active') !== 'Active').color + '15' }]}>
                    <Text style={[styles.badgeText, { color: getCategoryStyles(selectedAlert.type, (selectedAlert.status || 'Active') !== 'Active').color }]}>
                      {selectedAlert.type?.toUpperCase() || 'ALERT'}
                    </Text>
                  </View>
                  <Text style={[styles.timeText, { color: colors.textSub }]}>{formatTime(selectedAlert.timestamp)}</Text>
                </View>

                <Text style={[styles.modalLocationName, { color: colors.text }]}>{selectedAlert.locationName?.toUpperCase() || 'UNKNOWN LOCATION'}</Text>
                
                <Text style={[styles.modalSectionTitle, { color: colors.text }]}>Description</Text>
                <Text style={[styles.modalDescription, { color: colors.textSub }]}>{selectedAlert.description || 'No additional details provided.'}</Text>

                <View style={[styles.senderBox, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                  <Text style={[styles.senderLabel, { color: colors.textSub }]}>REPORTED BY</Text>
                  <Text style={[styles.senderValue, { color: colors.text }]}>{selectedAlert.senderName || 'Anonymous'}</Text>
                  <Text style={[styles.senderRole, { color: colors.textSub }]}>{selectedAlert.senderRole?.toUpperCase() || 'USER'}</Text>
                </View>

                {selectedAlert.mediaUri && (
                  <View style={styles.modalMediaSection}>
                    <Text style={[styles.modalSectionTitle, { color: colors.text }]}>Attached Media</Text>
                    <Image source={{ uri: selectedAlert.mediaUri }} style={styles.modalImage} />
                  </View>
                )}

              </View>

            </ScrollView>
          </SafeAreaView>
        )}
      </Modal>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  headerContainer: {
    paddingTop: Platform.OS === 'android' ? 40 : 10,
    paddingHorizontal: 20,
    paddingBottom: 20,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 5,
    zIndex: 10,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  headerSubtitle: {
    fontSize: 13,
    marginTop: 4,
    fontWeight: '500',
    textTransform: 'capitalize',
  },
  filterBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tabContainer: {
    flexDirection: 'row',
    borderRadius: 12,
    padding: 4,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  tabBtnActive: {
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '700',
  },
  listContent: {
    padding: 20,
    paddingBottom: 100, 
  },
  
  card: {
    borderRadius: 16,
    marginBottom: 16,
    borderWidth: 1,
    padding: 16,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: 'bold',
    marginLeft: 6,
    letterSpacing: 0.5,
  },
  timeText: {
    fontSize: 12,
    fontWeight: '500',
  },
  locationText: {
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 6,
  },
  descriptionText: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 16,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    paddingTop: 12,
  },
  distanceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1, 
    marginRight: 10,
  },
  distanceText: {
    fontSize: 13,
    fontWeight: '600',
    flexShrink: 1, 
  },
  detailsBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  detailsBtnText: {
    color: '#FFF',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
  },

  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  emptySubText: {
    fontSize: 14,
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 20,
  },
  endOfListText: {
    textAlign: 'center',
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 1,
    marginTop: 10,
    marginBottom: 30,
  },

  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 15,
    paddingVertical: 15,
    borderBottomWidth: 1,
  },
  closeBtn: {
    padding: 5,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  modalMapContainer: {
    width: '100%',
    height: 250,
    backgroundColor: '#E5E7EB',
    borderBottomWidth: 1,
  },
  mapMarkerPulse: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(220, 38, 38, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  mapMarkerCore: {
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: '#FFF',
  },
  modalContentPane: {
    padding: 20,
  },
  modalBadgeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  modalLocationName: {
    fontSize: 22,
    fontWeight: '900',
    marginBottom: 25,
  },
  modalSectionTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    letterSpacing: 1,
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  modalDescription: {
    fontSize: 16,
    lineHeight: 24,
    marginBottom: 25,
  },
  senderBox: {
    padding: 15,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 25,
  },
  senderLabel: {
    fontSize: 11,
    fontWeight: 'bold',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  senderValue: {
    fontSize: 16,
    fontWeight: '700',
  },
  senderRole: {
    fontSize: 12,
    marginTop: 2,
  },
  modalMediaSection: {
    marginTop: 10,
    marginBottom: 25,
  },
  modalImage: {
    width: '100%',
    height: 200,
    borderRadius: 16,
    marginTop: 10,
    backgroundColor: '#E5E7EB',
  },

  // FILTER MODAL STYLES
  filterModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: 20,
  },
  filterModalContent: {
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 10,
  },
  filterModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
    paddingBottom: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#D1D5DB',
  },
  filterModalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  filterOptionBtn: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 15,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  filterOptionText: {
    fontSize: 16,
  }
});