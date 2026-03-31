import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import * as Location from 'expo-location';
import { getRefinedAddress } from '../utils/location';

interface LocationContextType {
  userLocation: Location.LocationObject | null;
  locationName: string;
  errorMsg: string | null;
  gpsStatus: 'LOCATING...' | 'GPS ACTIVE' | 'PERMISSION DENIED' | 'OFFLINE';
  refreshLocation: () => Promise<void>;
  requestPermission: () => Promise<void>;
  isLoading: boolean;
}

const LocationContext = createContext<LocationContextType | undefined>(undefined);

export const LocationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [userLocation, setUserLocation] = useState<Location.LocationObject | null>(null);
  const [locationName, setLocationName] = useState('Locating...');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [gpsStatus, setGpsStatus] = useState<'LOCATING...' | 'GPS ACTIVE' | 'PERMISSION DENIED' | 'OFFLINE'>('LOCATING...');
  const [isLoading, setIsLoading] = useState(true);
  
  const subscription = useRef<Location.LocationSubscription | null>(null);

  const startWatching = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setErrorMsg('Permission to access location was denied');
        setGpsStatus('PERMISSION DENIED');
        setIsLoading(false);
        return;
      }

      // Initial fast fetch
      const lastKnown = await Location.getLastKnownPositionAsync({});
      if (lastKnown) {
        setUserLocation(lastKnown);
        const name = await getRefinedAddress(lastKnown.coords.latitude, lastKnown.coords.longitude);
        setLocationName(name);
      }

      // Persistent high-accuracy watch
      subscription.current = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.BestForNavigation,
          distanceInterval: 5, 
        },
        async (newLocation) => {
          setUserLocation(newLocation);
          setGpsStatus('GPS ACTIVE');
          
          const name = await getRefinedAddress(newLocation.coords.latitude, newLocation.coords.longitude);
          
          setLocationName(prev => {
             const isGeneric = (n: string | null | undefined) => (n || '').includes('Road') || (n || '').includes('Isara') || (n || '').includes('Street') || (n || '').includes('Way');
             const isSpecific = (n: string | null | undefined) => n && !isGeneric(n) && n.length > 5;
             if (isSpecific(prev) && isGeneric(name)) return prev;
             return name || 'Babcock University';
          });
          
          setIsLoading(false);
        }
      );
    } catch (err: any) {
      setErrorMsg(err.message);
      setGpsStatus('OFFLINE');
      setIsLoading(false);
    }
  };

  const refreshLocation = async () => {
     setGpsStatus('LOCATING...');
     const fresh = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Highest });
     setUserLocation(fresh);
     const name = await getRefinedAddress(fresh.coords.latitude, fresh.coords.longitude);
     setLocationName(name);
     setGpsStatus('GPS ACTIVE');
  };

  useEffect(() => {
    startWatching();
    return () => {
      if (subscription.current) {
        subscription.current.remove();
      }
    };
  }, []);

  return (
    <LocationContext.Provider value={{ userLocation, locationName, errorMsg, gpsStatus, refreshLocation, requestPermission: startWatching, isLoading }}>
      {children}
    </LocationContext.Provider>
  );
};

export const useLocation = () => {
  const context = useContext(LocationContext);
  if (context === undefined) {
    throw new Error('useLocation must be used within a LocationProvider');
  }
  return context;
};
