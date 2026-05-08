import * as Location from 'expo-location';

export type CapturedLocation = {
  lat: number;
  lng: number;
  place_name: string | null;
};

export async function captureCurrentLocation(): Promise<CapturedLocation | null> {
  const { status } = await Location.requestForegroundPermissionsAsync();
  if (status !== 'granted') return null;

  const pos = await Location.getCurrentPositionAsync({
    accuracy: Location.Accuracy.Balanced,
  });

  let place_name: string | null = null;
  try {
    const places = await Location.reverseGeocodeAsync({
      latitude: pos.coords.latitude,
      longitude: pos.coords.longitude,
    });
    const first = places[0];
    if (first) {
      const parts = [first.name, first.street, first.district, first.city, first.region].filter(
        (p): p is string => Boolean(p),
      );
      place_name = parts.length > 0 ? parts.slice(0, 2).join(', ') : null;
    }
  } catch {
    // reverse geocode optional
  }

  return {
    lat: pos.coords.latitude,
    lng: pos.coords.longitude,
    place_name,
  };
}
