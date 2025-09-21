import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import '@/styles/map.css';
import { toast } from 'sonner';
import { calculateDistance, isPolygonClosed, calculatePolygonArea } from '@/lib/sui-config';

// Fix Leaflet default marker icon issue
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

interface OpenStreetMapProps {
  isRunning: boolean;
  onPathUpdate?: (path: Array<{ lat: number; lng: number }>) => void;
  onDistanceUpdate?: (distance: number) => void;
  onTerritoryComplete?: (area: number, path: Array<{ lat: number; lng: number }>) => void;
  onEnterExistingTerritory?: (territory: { id: string; name: string; owner: string; rentPrice: number }) => void;
  existingTerritories?: Array<{
    id: string;
    name: string;
    coordinates: Array<{ lat: number; lng: number }>;
    owner: string;
    rentPrice: number;
    isOwned?: boolean;
  }>;
}

export default function OpenStreetMap({
  isRunning,
  onPathUpdate,
  onDistanceUpdate,
  onTerritoryComplete,
  onEnterExistingTerritory,
  existingTerritories = []
}: OpenStreetMapProps) {
  const mapRef = useRef<L.Map | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const pathRef = useRef<Array<{ lat: number; lng: number }>>([]);
  const polylineRef = useRef<L.Polyline | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const polygonsRef = useRef<L.Polygon[]>([]);
  const watchIdRef = useRef<number | null>(null);
  const distanceRef = useRef(0);
  const lastPosRef = useRef<{ lat: number; lng: number } | null>(null);
  const currentPolygonRef = useRef<L.Polygon | null>(null);
  const enteredTerritoriesRef = useRef<Set<string>>(new Set());

  // Initialize map
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    // Create map
    const map = L.map(containerRef.current).setView([41.015137, 28.979530], 15);
    
    // Add OpenStreetMap tiles
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors',
      maxZoom: 19,
    }).addTo(map);

    mapRef.current = map;

    // Get user's current location
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          map.setView([latitude, longitude], 15);
          
          // Add current location marker
          const marker = L.marker([latitude, longitude]).addTo(map);
          marker.bindPopup('You are here').openPopup();
          markerRef.current = marker;
        },
        (error) => {
          console.error('Error getting location:', error);
          toast.error('Could not get your location');
        }
      );
    }

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Draw existing territories
  useEffect(() => {
    if (!mapRef.current) return;

    // Clear existing polygons
    polygonsRef.current.forEach(polygon => polygon.remove());
    polygonsRef.current = [];

    // Draw territories
    existingTerritories.forEach(territory => {
      const coords = territory.coordinates.map(c => [c.lat, c.lng] as L.LatLngExpression);
      // Red color for existing territories, teal for owned territories
      const isOwned = territory.isOwned || false;
      const polygon = L.polygon(coords, {
        color: isOwned ? '#00E3A7' : '#FF4757',
        fillColor: isOwned ? '#00E3A7' : '#FF4757',
        fillOpacity: 0.15,
        weight: 2
      }).addTo(mapRef.current!);
      
      polygon.bindPopup(`
        <strong>${territory.name}</strong><br>
        Owner: ${territory.owner.slice(0, 6)}...${territory.owner.slice(-4)}<br>
        ${isOwned ? 'Your territory' : `Rent: ${territory.rentPrice} XP`}
      `);
      
      // Store territory data on polygon for later reference
      (polygon as any).territoryData = territory;
      
      polygonsRef.current.push(polygon);
    });
  }, [existingTerritories]);

  // Handle running state
  useEffect(() => {
    if (!mapRef.current) return;

    if (isRunning) {
      // Reset tracking
      pathRef.current = [];
      distanceRef.current = 0;
      lastPosRef.current = null;
      
      // Clear existing polyline
      if (polylineRef.current) {
        polylineRef.current.remove();
        polylineRef.current = null;
      }

      // Start tracking
      if (navigator.geolocation) {
        // More aggressive tracking settings for real-time updates
        watchIdRef.current = navigator.geolocation.watchPosition(
          (position) => {
            const { latitude, longitude, accuracy } = position.coords;
            const newPos = { lat: latitude, lng: longitude };
            
            // Only add point if accuracy is reasonable (less than 50 meters)
            if (accuracy > 50) {
              console.log('Low accuracy position ignored:', accuracy);
              return;
            }
            
            // Filter out duplicate positions
            if (lastPosRef.current && 
                Math.abs(lastPosRef.current.lat - latitude) < 0.00001 && 
                Math.abs(lastPosRef.current.lng - longitude) < 0.00001) {
              return;
            }
            
            // Update path
            pathRef.current.push(newPos);
            
            // Calculate distance
            if (lastPosRef.current) {
              const dist = calculateDistance(lastPosRef.current, newPos);
              distanceRef.current += dist;
              onDistanceUpdate?.(distanceRef.current);
            }
            lastPosRef.current = newPos;
            
            // Update map view and marker with smooth panning
            if (mapRef.current) {
              // Smooth pan to new position instead of jumping
              mapRef.current.panTo([latitude, longitude], { animate: true, duration: 0.5 });
              
              // Update or create marker with custom icon
              if (markerRef.current) {
                markerRef.current.setLatLng([latitude, longitude]);
              } else {
                const pulsingIcon = L.divIcon({
                  className: 'pulsing-marker',
                  html: '<div class="pulse"></div><div class="marker-pin"></div>',
                  iconSize: [20, 20],
                  iconAnchor: [10, 10]
                });
                markerRef.current = L.marker([latitude, longitude], { icon: pulsingIcon }).addTo(mapRef.current);
              }
              
              // Update polyline with better styling
              if (polylineRef.current) {
                polylineRef.current.setLatLngs(pathRef.current.map(p => [p.lat, p.lng]));
              } else {
                polylineRef.current = L.polyline(
                  pathRef.current.map(p => [p.lat, p.lng]),
                  { 
                    color: '#00B4D8', 
                    weight: 6, 
                    opacity: 0.9,
                    smoothFactor: 1.0,
                    className: 'animated-path'
                  }
                ).addTo(mapRef.current);
              }
              
              // Update current polygon preview with better visibility
              if (currentPolygonRef.current) {
                currentPolygonRef.current.remove();
                currentPolygonRef.current = null;
              }
              
              if (pathRef.current.length >= 3) {
                // Create filled polygon like in the reference image
                currentPolygonRef.current = L.polygon(
                  pathRef.current.map(p => [p.lat, p.lng]),
                  { 
                    color: '#000000', 
                    fillColor: '#00E5FF',
                    fillOpacity: 0.35,
                    weight: 3,
                    dashArray: '10, 5',
                    className: 'capturing-area'
                  }
                ).addTo(mapRef.current);
                
                // Add area label
                const area = calculatePolygonArea(pathRef.current);
                if (area > 0) {
                  const bounds = currentPolygonRef.current.getBounds();
                  const center = bounds.getCenter();
                  
                  // Remove old label if exists
                  if ((currentPolygonRef.current as any).label) {
                    (currentPolygonRef.current as any).label.remove();
                  }
                  
                  // Add new label
                  const label = L.marker(center, {
                    icon: L.divIcon({
                      className: 'area-label',
                      html: `<div class="area-label-content">${area.toFixed(0)}m²</div>`,
                      iconSize: [100, 30],
                      iconAnchor: [50, 15]
                    })
                  }).addTo(mapRef.current);
                  
                  (currentPolygonRef.current as any).label = label;
                }
              }
              
              // Check for entering existing territories
              polygonsRef.current.forEach(polygon => {
                const territoryData = (polygon as any).territoryData;
                if (territoryData && !territoryData.isOwned) {
                  const point = L.latLng(latitude, longitude);
                  if (polygon.getBounds().contains(point)) {
                    if (!enteredTerritoriesRef.current.has(territoryData.id)) {
                      enteredTerritoriesRef.current.add(territoryData.id);
                      onEnterExistingTerritory?.(territoryData);
                    }
                  }
                }
              });
            }
            
            // Check if polygon is closed
            if (pathRef.current.length >= 4 && isPolygonClosed(pathRef.current)) {
              const area = calculatePolygonArea(pathRef.current);
              if (area >= 100) { // Minimum 100 square meters
                onTerritoryComplete?.(area, pathRef.current);
              }
            }
            
            onPathUpdate?.(pathRef.current);
          },
          (error) => {
            console.error('Tracking error:', error);
            toast.error('Error tracking location');
          },
          {
            enableHighAccuracy: true,
            timeout: 3000,  // Reduced timeout for faster updates
            maximumAge: 0  // Always get fresh position
          }
        );
      }
    } else {
      // Stop tracking
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      
      // Clear entered territories tracking
      enteredTerritoriesRef.current.clear();
      
      // Remove current polygon preview
      if (currentPolygonRef.current) {
        currentPolygonRef.current.remove();
        currentPolygonRef.current = null;
      }
    }

    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
    };
  }, [isRunning, onPathUpdate, onDistanceUpdate, onTerritoryComplete]);

  return (
    <div 
      ref={containerRef} 
      className="w-full h-full rounded-lg shadow-lg"
      style={{ minHeight: '400px' }}
    />
  );
}