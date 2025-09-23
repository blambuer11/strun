import { useState, useEffect, useCallback, useRef } from 'react';
import { GoogleMap, LoadScript, Marker, Polyline, Polygon } from '@react-google-maps/api';
import { toast } from 'sonner';

interface Territory {
  id: string;
  name: string;
  owner_name?: string;
  area: number;
  path: Array<{ lat: number; lng: number }>;
  captured_at: string;
  is_owner: boolean;
}

interface GoogleMapViewProps {
  isRunning: boolean;
  onPathUpdate?: (path: Array<{ lat: number; lng: number }>) => void;
  onDistanceUpdate?: (distance: number) => void;
  onTerritoryComplete?: (territory: {
    path: Array<{ lat: number; lng: number }>;
    area: number;
  }) => void;
  onEnterExistingTerritory?: (territoryId: string) => void;
  existingTerritories?: Territory[];
}

const mapContainerStyle = {
  width: '100%',
  height: '100%'
};

const defaultCenter = {
  lat: 41.0082,
  lng: 28.9784
};

const mapOptions = {
  disableDefaultUI: false,
  zoomControl: true,
  mapTypeControl: false,
  scaleControl: true,
  streetViewControl: false,
  rotateControl: false,
  fullscreenControl: false,
  styles: [
    {
      featureType: "all",
      elementType: "geometry",
      stylers: [{ color: "#242f3e" }]
    },
    {
      featureType: "all",
      elementType: "labels.text.stroke",
      stylers: [{ color: "#242f3e" }]
    },
    {
      featureType: "all",
      elementType: "labels.text.fill",
      stylers: [{ color: "#746855" }]
    },
    {
      featureType: "water",
      elementType: "geometry",
      stylers: [{ color: "#17263c" }]
    },
    {
      featureType: "road",
      elementType: "geometry",
      stylers: [{ color: "#38414e" }]
    },
    {
      featureType: "road",
      elementType: "geometry.stroke",
      stylers: [{ color: "#212a37" }]
    },
    {
      featureType: "road",
      elementType: "labels.text.fill",
      stylers: [{ color: "#9ca5b3" }]
    }
  ]
};

// Google Maps API key
// Note: In production, this should be restricted to your domain for security
const GOOGLE_MAPS_API_KEY = 'AIzaSyBLxwAmL1BCnMp0cLJ3kYZEWDRdWENl5vA';

export function GoogleMapView({
  isRunning,
  onPathUpdate,
  onDistanceUpdate,
  onTerritoryComplete,
  onEnterExistingTerritory,
  existingTerritories = []
}: GoogleMapViewProps) {
  const [map, setMap] = useState<google.maps.Map | null>(null);
  const [userPosition, setUserPosition] = useState<{ lat: number; lng: number } | null>(null);
  const [path, setPath] = useState<Array<{ lat: number; lng: number }>>([]);
  const [distance, setDistance] = useState(0);
  const watchIdRef = useRef<number | null>(null);
  const lastPositionRef = useRef<{ lat: number; lng: number } | null>(null);

  // Get user's current location on mount
  useEffect(() => {
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const pos = {
            lat: position.coords.latitude,
            lng: position.coords.longitude
          };
          setUserPosition(pos);
          if (map) {
            map.setCenter(pos);
            map.setZoom(16);
          }
        },
        (error) => {
          console.error('Error getting location:', error);
          toast.error('Could not get your location');
        },
        {
          enableHighAccuracy: true,
          timeout: 5000,
          maximumAge: 0
        }
      );
    }
  }, [map]);

  // Handle tracking when running
  useEffect(() => {
    if (isRunning && 'geolocation' in navigator) {
      setPath([]);
      setDistance(0);
      lastPositionRef.current = null;

      watchIdRef.current = navigator.geolocation.watchPosition(
        (position) => {
          const newPos = {
            lat: position.coords.latitude,
            lng: position.coords.longitude
          };

          setUserPosition(newPos);
          
          if (map) {
            map.panTo(newPos);
          }

          setPath((prevPath) => {
            const updatedPath = [...prevPath, newPos];
            
            // Calculate distance
            if (lastPositionRef.current) {
              const dist = calculateDistance(lastPositionRef.current, newPos);
              setDistance((prevDist) => {
                const newDist = prevDist + dist;
                onDistanceUpdate?.(newDist);
                return newDist;
              });
            }
            
            lastPositionRef.current = newPos;
            onPathUpdate?.(updatedPath);

            // Check for territory completion (closed polygon)
            if (updatedPath.length >= 4) {
              const startPoint = updatedPath[0];
              const distanceToStart = calculateDistance(newPos, startPoint);
              
              if (distanceToStart < 0.02) { // ~20 meters
                const area = calculatePolygonArea(updatedPath);
                if (area > 1000) { // Minimum 1000 square meters
                  onTerritoryComplete?.({
                    path: updatedPath,
                    area: area
                  });
                }
              }
            }

            // Check if entering existing territory
            existingTerritories.forEach((territory) => {
              if (isPointInPolygon(newPos, territory.path)) {
                onEnterExistingTerritory?.(territory.id);
              }
            });

            return updatedPath;
          });
        },
        (error) => {
          console.error('Error tracking location:', error);
          toast.error('Lost GPS signal');
        },
        {
          enableHighAccuracy: true,
          timeout: 3000,
          maximumAge: 0
        }
      );
    } else if (watchIdRef.current) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }

    return () => {
      if (watchIdRef.current) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
    };
  }, [isRunning, map, onPathUpdate, onDistanceUpdate, onTerritoryComplete, onEnterExistingTerritory, existingTerritories]);

  const onLoad = useCallback((map: google.maps.Map) => {
    setMap(map);
  }, []);

  const onUnmount = useCallback(() => {
    setMap(null);
  }, []);

  // Helper functions
  const calculateDistance = (point1: { lat: number; lng: number }, point2: { lat: number; lng: number }) => {
    const R = 6371; // Earth's radius in km
    const dLat = (point2.lat - point1.lat) * Math.PI / 180;
    const dLng = (point2.lng - point1.lng) * Math.PI / 180;
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(point1.lat * Math.PI / 180) * Math.cos(point2.lat * Math.PI / 180) *
      Math.sin(dLng/2) * Math.sin(dLng/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  };

  const calculatePolygonArea = (points: Array<{ lat: number; lng: number }>) => {
    if (points.length < 3) return 0;
    
    let area = 0;
    for (let i = 0; i < points.length; i++) {
      const j = (i + 1) % points.length;
      area += points[i].lng * points[j].lat;
      area -= points[j].lng * points[i].lat;
    }
    
    area = Math.abs(area / 2);
    // Convert to square meters (approximate)
    return area * 111000 * 111000 * Math.cos(points[0].lat * Math.PI / 180);
  };

  const isPointInPolygon = (point: { lat: number; lng: number }, polygon: Array<{ lat: number; lng: number }>) => {
    let inside = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      const xi = polygon[i].lng, yi = polygon[i].lat;
      const xj = polygon[j].lng, yj = polygon[j].lat;
      
      const intersect = ((yi > point.lat) !== (yj > point.lat))
          && (point.lng < (xj - xi) * (point.lat - yi) / (yj - yi) + xi);
      if (intersect) inside = !inside;
    }
    return inside;
  };

  // Check if API key is configured
  // No need to check since we have a valid key

  return (
    <LoadScript googleMapsApiKey={GOOGLE_MAPS_API_KEY}>
      <GoogleMap
        mapContainerStyle={mapContainerStyle}
        center={userPosition || defaultCenter}
        zoom={16}
        onLoad={onLoad}
        onUnmount={onUnmount}
        options={mapOptions}
      >
        {/* User marker */}
        {userPosition && map && (
          <Marker
            position={userPosition}
            icon={{
              path: window.google?.maps?.SymbolPath?.CIRCLE || 0,
              scale: 8,
              fillColor: '#3B82F6',
              fillOpacity: 1,
              strokeColor: '#FFFFFF',
              strokeWeight: 2,
            }}
          />
        )}

        {/* Running path */}
        {path.length > 1 && (
          <Polyline
            path={path}
            options={{
              strokeColor: '#10B981',
              strokeOpacity: 0.8,
              strokeWeight: 4,
            }}
          />
        )}

        {/* Current capturing area */}
        {path.length > 2 && (
          <Polygon
            paths={path}
            options={{
              fillColor: '#10B981',
              fillOpacity: 0.2,
              strokeColor: '#10B981',
              strokeOpacity: 0.5,
              strokeWeight: 2,
            }}
          />
        )}

        {/* Existing territories */}
        {existingTerritories.map((territory) => (
          <Polygon
            key={territory.id}
            paths={territory.path}
            options={{
              fillColor: territory.is_owner ? '#14B8A6' : '#EF4444',
              fillOpacity: 0.3,
              strokeColor: territory.is_owner ? '#14B8A6' : '#EF4444',
              strokeOpacity: 0.8,
              strokeWeight: 2,
            }}
          />
        ))}
      </GoogleMap>
    </LoadScript>
  );
}
