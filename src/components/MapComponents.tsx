import { useEffect } from 'react';
import { useMap, TileLayer, Marker, Polyline, Polygon } from 'react-leaflet';
import L from 'leaflet';
import { isPolygonClosed } from '@/lib/sui-config';

// Custom marker for user position
const userIcon = new L.Icon({
  iconUrl: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPGNpcmNsZSBjeD0iMTIiIGN5PSIxMiIgcj0iMTAiIGZpbGw9IiMwMEUzQTciIHN0cm9rZT0iI2ZmZiIgc3Ryb2tlLXdpZHRoPSIzIi8+CjxjaXJjbGUgY3g9IjEyIiBjeT0iMTIiIHI9IjQiIGZpbGw9IiNmZmYiLz4KPC9zdmc+',
  iconSize: [24, 24],
  iconAnchor: [12, 12],
});

interface MapComponentsProps {
  currentPosition: [number, number];
  runPath: Array<{ lat: number; lng: number }>;
  territories: Array<{
    id: string;
    coordinates: Array<{ lat: number; lng: number }>;
    owner: string;
    name: string;
  }>;
}

// Component to update map center
function MapCenterUpdater({ center }: { center: [number, number] }) {
  const map = useMap();
  
  useEffect(() => {
    map.setView(center, map.getZoom());
  }, [center, map]);
  
  return null;
}

// All map layers and components
export function MapComponents({ currentPosition, runPath, territories }: MapComponentsProps) {
  const showRunPath = runPath && runPath.length > 1;
  const showTerritory = runPath && runPath.length > 3 && isPolygonClosed(runPath, 50);
  
  return (
    <>
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
      />
      
      <MapCenterUpdater center={currentPosition} />
      
      <Marker position={currentPosition} icon={userIcon} />
      
      {showRunPath && (
        <Polyline
          positions={runPath.map(p => [p.lat, p.lng])}
          color="#6C5CE7"
          weight={4}
          opacity={0.8}
        />
      )}
      
      {showTerritory && (
        <Polygon
          positions={runPath.map(p => [p.lat, p.lng])}
          pathOptions={{
            color: '#00E3A7',
            weight: 2,
            fillColor: '#00E3A7',
            fillOpacity: 0.2,
          }}
        />
      )}
      
      {territories && territories.map((territory) => (
        <Polygon
          key={territory.id}
          positions={territory.coordinates.map(c => [c.lat, c.lng])}
          pathOptions={{
            color: '#6C5CE7',
            weight: 2,
            fillColor: '#6C5CE7',
            fillOpacity: 0.15,
          }}
        />
      ))}
    </>
  );
}