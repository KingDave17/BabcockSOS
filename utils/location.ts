import * as Location from 'expo-location';
import Constants from 'expo-constants';

// Get API Key from app.json / Constants
const GOOGLE_MAPS_API_KEY = Constants.expoConfig?.android?.config?.googleMaps?.apiKey;

/**
 * Filter out Plus Codes and build a human-readable address from reverse geocoding.
 * Now prioritized by Google Geocoding for specific Hall/Building names.
 */
export const getRefinedAddress = async (latitude: number, longitude: number): Promise<string> => {
  try {
    // 💨 PRIORITY 1: Google Geocoding (Great for Halls, BUTH, Landmarks)
    if (GOOGLE_MAPS_API_KEY) {
      try {
        const response = await fetch(
          `https://maps.googleapis.com/maps/api/geocode/json?latlng=${latitude},${longitude}&key=${GOOGLE_MAPS_API_KEY}`
        );
        const data = await response.json();

        if (data.status === 'OK' && data.results.length > 0) {
          // 🧐 Look for the most specific POI across ALL results, not just the first one
          // We want something better than a generic road name.
          let bestResult = null;
          
          // Rank 1: Specific landmarks/establishments
          bestResult = data.results.find((r: any) => 
            r.types.includes('establishment') || 
            r.types.includes('point_of_interest') ||
            r.types.includes('university') ||
            r.types.includes('hospital') ||
            r.types.includes('school') ||
            r.types.includes('premise')
          );

          // Rank 2: If no POI, use the first result but only if it's not a generic route/plus_code
          if (!bestResult) {
            bestResult = data.results.find((r: any) => 
              !r.types.includes('route') && !r.types.includes('plus_code')
            );
          }

          // Final Fallback: Just take the first one
          const result = bestResult || data.results[0];

          // Try to find the specific "name" component if it exists
          const nameComp = result.address_components.find((c: any) => 
             c.types.includes('establishment') || c.types.includes('point_of_interest') || c.types.includes('premise')
          );
          
          let bestName = nameComp ? nameComp.long_name : result.formatted_address.split(',')[0];
          
          // 🚫 "Ikenne Isara" is a generic road name that often covers specific buildings
          if (bestName.includes('Ikenne Isara') && data.results.length > 1) {
             // Look for ANY other result that isn't just the road
             const betterMatch = data.results.find((r: any) => !r.formatted_address.includes('Ikenne Isara'));
             if (betterMatch) bestName = betterMatch.formatted_address.split(',')[0];
          }

          if (!bestName.toLowerCase().includes('babcock')) {
             return `Babcock University, ${bestName}`;
          }
          return bestName;
        }
      } catch (googleError) {
        console.warn('Google Geocoding failed, falling back to Native:', googleError);
      }
    }

    // 📱 PRIORITY 2: Native OS Geocoding (Reliable fallback)
    const reverse = await Location.reverseGeocodeAsync({ latitude, longitude });
    if (reverse && reverse.length > 0) {
      const place = reverse[0];
      
      // 1. Identify "bad" names: Plus Codes (contain +) or coordinate strings
      const isPlusCode = (str: string) => str.includes('+');
      const isCoordinateLike = (str: string) => /^-?\d+\.\d+/.test(str);

      // 2. Build from components with high specificity first
      const parts = [
        place.name && !isPlusCode(place.name) && !isCoordinateLike(place.name) ? place.name : null,
        place.street,
        place.district,
        place.subregion,
        place.city
      ].filter(Boolean);

      // Unique parts while preserving order
      const uniqueParts: string[] = [];
      parts.forEach(p => {
        if (p && !uniqueParts.some(up => up.toLowerCase() === p.toLowerCase())) {
          uniqueParts.push(p);
        }
      });
      
      let builtName = uniqueParts.length > 0 ? uniqueParts.join(', ') : 'Babcock University Campus';

      // 3. Plus Code Cleanup: If the built name still contains a plus code (from street etc), strip it
      if (builtName.includes('+')) {
         builtName = builtName.split(',').filter(p => !p.includes('+')).join(', ').trim();
      }

      // 4. Contextual branding: Ensure Babcock is mentioned if we're on campus
      const lowName = builtName.toLowerCase();
      if (!lowName.includes('babcock') && !lowName.includes('university')) {
        return `Babcock University, ${builtName}`;
      }
      
      return builtName || 'Babcock University Campus';
    }
  } catch (e) {
    console.error('Refined geocode failed:', e);
  }
  return 'Babcock University Campus';
};

/**
 * Get current position with fallback to last known position for speed.
 */
export const getFastAndAccurateLocation = async () => {
    try {
        // Start with last known for speed
        const lastKnown = await Location.getLastKnownPositionAsync({});
        
        // Fetch fresh one with high accuracy
        const current = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.BestForNavigation,
        });

        return current || lastKnown;
    } catch (e) {
        console.error('Location acquisition failed:', e);
        return await Location.getLastKnownPositionAsync({});
    }
};
