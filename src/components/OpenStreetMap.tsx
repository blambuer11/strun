import { useEffect, useRef, useState } from 'react';
import { MapContainer } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Geolocation } from '@capacitor/geolocation';
import { toast } from 'sonner';
import { calculateDistance, isPolygonClosed, calculatePolygonArea } from '@/lib/sui-config';
import { MapComponents } from './MapComponents';

// Fix Leaflet default marker icons
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

interface MapProps {
  isRunning: boolean;
  onTerritoryComplete: (area: number, path: Array<{ lat: number; lng: number }>) => void;
  territories: Array<{
    id: string;
    coordinates: Array<{ lat: number; lng: number }>;
    owner: string;
    name: string;
  }>;
}

export function OpenStreetMap({ isRunning, onTerritoryComplete, territories }: MapProps) {
  const [currentPosition, setCurrentPosition] = useState<[number, number] | null>(null);
  const [runPath, setRunPath] = useState<Array<{ lat: number; lng: number }>>([]);
  const [watchId, setWatchId] = useState<string | null>(null);
  const [totalDistance, setTotalDistance] = useState(0);
  const pathRef = useRef<Array<{ lat: number; lng: number }>>([]);

  // Initialize geolocation
  useEffect(() => {
    const initLocation = async () => {
      try {
        // Request permission
        const permission = await Geolocation.checkPermissions();
        if (permission.location === 'prompt' || permission.location === 'prompt-with-rationale') {
          await Geolocation.requestPermissions();
        }

        // Get initial position
        const position = await Geolocation.getCurrentPosition({
          enableHighAccuracy: true,
        });
        
        setCurrentPosition([position.coords.latitude, position.coords.longitude]);
      } catch (error) {
        console.error('Error getting location:', error);
        toast.error('Location access is required for Strun');
        // Fallback to Istanbul coordinates for demo
        setCurrentPosition([41.0082, 28.9784]);
      }
    };

    initLocation();
  }, []);

  // Start/stop tracking based on running state
  useEffect(() => {
    const startTracking = async () => {
      if (isRunning && !watchId) {
        pathRef.current = [];
        setRunPath([]);
        setTotalDistance(0);

        try {
          const id = await Geolocation.watchPosition(
            {
              enableHighAccuracy: true,
              timeout: 10000,
              maximumAge: 0,
            },
            (position) => {
              if (position) {
                const newPoint = {
                  lat: position.coords.latitude,
                  lng: position.coords.longitude,
                };

                // Update current position
                setCurrentPosition([newPoint.lat, newPoint.lng]);

                // Add to path if running
                if (pathRef.current.length > 0) {
                  const lastPoint = pathRef.current[pathRef.current.length - 1];
                  const distance = calculateDistance(lastPoint, newPoint);
                  
                  // Only add point if moved more than 5 meters (reduce noise)
                  if (distance > 5) {
                    pathRef.current.push(newPoint);
                    setRunPath([...pathRef.current]);
                    setTotalDistance(prev => prev + distance);

                    // Check if territory is complete (closed polygon)
                    if (pathRef.current.length > 3 && isPolygonClosed(pathRef.current, 30)) {
                      const area = calculatePolygonArea(pathRef.current);
                      if (area >= 10000) { // Minimum 10,000 m² (100m x 100m)
                        toast.success('Territory complete! You can claim it now.');
                        onTerritoryComplete(area, pathRef.current);
                      }
                    }
                  }
                } else {
                  // First point
                  pathRef.current.push(newPoint);
                  setRunPath([newPoint]);
                }
              }
            }
          );
          
          setWatchId(id);
        } catch (error) {
          console.error('Error watching position:', error);
          toast.error('Failed to track location');
        }
      } else if (!isRunning && watchId) {
        // Stop tracking
        await Geolocation.clearWatch({ id: watchId });
        setWatchId(null);
      }
    };

    startTracking();

    return () => {
      if (watchId) {
        Geolocation.clearWatch({ id: watchId });
      }
    };
  }, [isRunning, watchId, onTerritoryComplete]);

  if (!currentPosition) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-background/50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Getting your location...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-full h-full">
      <MapContainer
        center={currentPosition}
        zoom={16}
        className="w-full h-full"
        zoomControl={false}
      >
        <MapComponents 
          currentPosition={currentPosition}
          runPath={runPath}
          territories={territories}
        />
      </MapContainer>

      {isRunning && totalDistance > 0 && (
        <div className="absolute top-4 left-4 z-[1000] bg-background/95 backdrop-blur-sm rounded-lg px-4 py-2 shadow-lg">
          <p className="text-sm text-muted-foreground">Distance</p>
          <p className="text-lg font-bold text-primary">{(totalDistance / 1000).toFixed(2)} km</p>
        </div>
      )}
    </div>
  );
}