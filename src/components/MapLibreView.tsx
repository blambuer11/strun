import React, { useEffect, useRef, useState, useCallback } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import * as turf from "@turf/turf";
import { keccak256 } from "js-sha3";

// Types
type LatLng = [number, number]; // [lat, lon]

interface Territory {
  path: LatLng[];
  area: number;
}

interface MapLibreViewProps {
  isRunning?: boolean;
  onPathUpdate?: (path: LatLng[]) => void;
  onDistanceUpdate?: (distance: number) => void;
  onTerritoryComplete?: (territory: Territory) => void;
  onEnterExistingTerritory?: (territoryId: string) => void;
  existingTerritories?: Array<{
    id: string;
    name: string;
    coordinates: any;
    owner_id: string;
    rent_price: number;
  }>;
}

// Helper functions
function haversine(a: LatLng, b: LatLng) {
  const R = 6371000;
  const toRad = (v: number) => (v * Math.PI) / 180;
  const dLat = toRad(b[0] - a[0]);
  const dLon = toRad(b[1] - a[1]);
  const lat1 = toRad(a[0]);
  const lat2 = toRad(b[0]);
  const sinDlat = Math.sin(dLat / 2);
  const sinDlon = Math.sin(dLon / 2);
  const aa = sinDlat * sinDlat + Math.cos(lat1) * Math.cos(lat2) * sinDlon * sinDlon;
  return R * 2 * Math.atan2(Math.sqrt(aa), Math.sqrt(1 - aa));
}

function smoothPoints(points: LatLng[], windowSize = 3): LatLng[] {
  if (points.length <= windowSize) return points;
  const out: LatLng[] = [];
  for (let i = 0; i < points.length; i++) {
    const start = Math.max(0, i - (windowSize - 1));
    const slice = points.slice(start, i + 1);
    const avgLat = slice.reduce((s, p) => s + p[0], 0) / slice.length;
    const avgLon = slice.reduce((s, p) => s + p[1], 0) / slice.length;
    out.push([avgLat, avgLon]);
  }
  return out;
}

function isPointInPolygon(point: LatLng, polygon: LatLng[]): boolean {
  const pt = turf.point([point[1], point[0]]);
  const poly = turf.polygon([polygon.map(p => [p[1], p[0]])]);
  return turf.booleanPointInPolygon(pt, poly);
}

export const MapLibreView: React.FC<MapLibreViewProps> = ({
  isRunning = false,
  onPathUpdate,
  onDistanceUpdate,
  onTerritoryComplete,
  onEnterExistingTerritory,
  existingTerritories = []
}) => {
  const mapContainer = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markerRef = useRef<maplibregl.Marker | null>(null);
  const watchIdRef = useRef<number | null>(null);

  const [currentPath, setCurrentPath] = useState<LatLng[]>([]);
  const [smoothedPath, setSmoothedPath] = useState<LatLng[]>([]);
  const [totalDistance, setTotalDistance] = useState(0);
  const [lastPosition, setLastPosition] = useState<LatLng | null>(null);
  const [hasEnteredTerritory, setHasEnteredTerritory] = useState<Set<string>>(new Set());

  const MAX_ACCEPTABLE_ACCURACY = 50;
  const MIN_AREA_FOR_TERRITORY = 100; // minimum 100 m² for territory

  // Initialize map
  useEffect(() => {
    if (!mapContainer.current) return;

    // Initialize MapLibre map with MapTiler
    const MAPTILER_KEY = "JNY9zsA8c4duUO7cPboB";
    mapRef.current = new maplibregl.Map({
      container: mapContainer.current,
      style: `https://api.maptiler.com/maps/streets-v2/style.json?key=${MAPTILER_KEY}`,
      center: [29.06, 41.0], // Istanbul default
      zoom: 14,
      pitch: 0,
      bearing: 0
    });

    mapRef.current.on("load", () => {
      // Add route source and layer
      mapRef.current?.addSource("route", {
        type: "geojson",
        data: { type: "Feature", geometry: { type: "LineString", coordinates: [] }, properties: {} }
      });

      mapRef.current?.addLayer({
        id: "route-line",
        type: "line",
        source: "route",
        layout: { "line-join": "round", "line-cap": "round" },
        paint: { 
          "line-color": "#00D4FF", 
          "line-width": 5, 
          "line-opacity": 0.9,
          "line-blur": 0.5
        }
      });

      // Add current zone source and layers
      mapRef.current?.addSource("zone", {
        type: "geojson",
        data: { type: "Feature", geometry: { type: "Polygon", coordinates: [] }, properties: {} }
      });

      mapRef.current?.addLayer({
        id: "zone-fill",
        type: "fill",
        source: "zone",
        paint: { 
          "fill-color": "#39FF14", 
          "fill-opacity": 0.2,
          "fill-outline-color": "#39FF14"
        }
      });

      // Add existing territories source and layers
      mapRef.current?.addSource("existing-territories", {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] }
      });

      mapRef.current?.addLayer({
        id: "territories-fill",
        type: "fill",
        source: "existing-territories",
        paint: { 
          "fill-color": "#FF6B6B", 
          "fill-opacity": 0.15
        }
      });

      mapRef.current?.addLayer({
        id: "territories-outline",
        type: "line",
        source: "existing-territories",
        paint: { 
          "line-color": "#FF6B6B", 
          "line-width": 2,
          "line-dasharray": [2, 2]
        }
      });
    });

    // Create user marker
    const marker = new maplibregl.Marker({ 
      color: "#8A2BE2",
      scale: 0.8
    });
    markerRef.current = marker;

    // Get initial position
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const lng = pos.coords.longitude;
          const lat = pos.coords.latitude;
          mapRef.current?.setCenter([lng, lat]);
          marker.setLngLat([lng, lat]).addTo(mapRef.current!);
        },
        (err) => console.error("Initial location error:", err),
        { enableHighAccuracy: true }
      );
    }

    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
      if (mapRef.current) {
        mapRef.current.remove();
      }
      mapRef.current = null;
      markerRef.current = null;
    };
  }, []);

  // Update existing territories on map
  useEffect(() => {
    if (!mapRef.current || !mapRef.current.getSource("existing-territories")) return;

    const features = existingTerritories.map(territory => ({
      type: "Feature" as const,
      geometry: territory.coordinates || { type: "Polygon" as const, coordinates: [] },
      properties: {
        id: territory.id,
        name: territory.name,
        owner_id: territory.owner_id,
        rent_price: territory.rent_price
      }
    }));

    const source = mapRef.current.getSource("existing-territories") as maplibregl.GeoJSONSource;
    source?.setData({
      type: "FeatureCollection",
      features
    });
  }, [existingTerritories]);

  // Update path on map
  useEffect(() => {
    if (!mapRef.current || !mapRef.current.getSource("route")) return;

    const coords = smoothedPath.map(p => [p[1], p[0]]); // Convert to [lon, lat]
    const source = mapRef.current.getSource("route") as maplibregl.GeoJSONSource;
    source?.setData({
      type: "Feature",
      geometry: { type: "LineString", coordinates: coords },
      properties: {}
    });

    // Update marker position if we have a path
    if (coords.length > 0) {
      const last = coords[coords.length - 1] as [number, number];
      markerRef.current?.setLngLat(last);
      
      // Smoothly pan to current position
      mapRef.current?.easeTo({
        center: last,
        duration: 1000
      });
    }
  }, [smoothedPath]);

  // Handle tracking
  useEffect(() => {
    if (!navigator.geolocation) return;

    if (isRunning) {
      // Start tracking
      setCurrentPath([]);
      setSmoothedPath([]);
      setTotalDistance(0);
      setLastPosition(null);
      setHasEnteredTerritory(new Set());

      const id = navigator.geolocation.watchPosition(
        (pos) => {
          const lat = pos.coords.latitude;
          const lon = pos.coords.longitude;
          const acc = pos.coords.accuracy ?? 999;

          // Accuracy filter
          if (acc > MAX_ACCEPTABLE_ACCURACY) {
            console.debug("Dropping noisy GPS sample, accuracy:", acc);
            return;
          }

          const newPoint: LatLng = [lat, lon];

          // Update distance
          if (lastPosition) {
            const segmentDistance = haversine(lastPosition, newPoint);
            if (segmentDistance < 0.5) {
              // Ignore if movement is less than 0.5m
              return;
            }
            const newTotalDistance = totalDistance + segmentDistance;
            setTotalDistance(newTotalDistance);
            onDistanceUpdate?.(newTotalDistance);
          }
          setLastPosition(newPoint);

          // Update path
          setCurrentPath(prev => {
            const newPath = [...prev, newPoint];
            if (newPath.length > 10000) {
              newPath.shift(); // Prevent memory issues
            }
            
            // Smooth the path
            const smoothed = smoothPoints(newPath, 3);
            setSmoothedPath(smoothed);
            onPathUpdate?.(smoothed);

            // Check for territory completion
            if (smoothed.length >= 3) {
              const distToStart = haversine(smoothed[0], smoothed[smoothed.length - 1]);
              if (distToStart < 20 && smoothed.length > 10) {
                // Path forms a closed loop
                computeTerritory(smoothed);
              }
            }

            // Check if entering existing territories
            if (existingTerritories.length > 0) {
              for (const territory of existingTerritories) {
                if (!hasEnteredTerritory.has(territory.id) && territory.coordinates?.coordinates?.[0]) {
                  const coords = territory.coordinates.coordinates[0];
                  const polygonPoints: LatLng[] = coords.map((c: number[]) => [c[1], c[0]]);
                  if (isPointInPolygon(newPoint, polygonPoints)) {
                    setHasEnteredTerritory(prev => new Set(prev).add(territory.id));
                    onEnterExistingTerritory?.(territory.id);
                  }
                }
              }
            }

            return newPath;
          });
        },
        (err) => {
          console.error("Geolocation error:", err);
        },
        { 
          enableHighAccuracy: true, 
          maximumAge: 500, 
          timeout: 10000 
        }
      );

      watchIdRef.current = id;
    } else {
      // Stop tracking
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
    }

    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
    };
  }, [isRunning, lastPosition, totalDistance, existingTerritories, hasEnteredTerritory, onDistanceUpdate, onPathUpdate, onEnterExistingTerritory]);

  const computeTerritory = useCallback((points: LatLng[]) => {
    if (points.length < 3) return;

    try {
      // Create a polygon from the path
      const line = turf.lineString(points.map(p => [p[1], p[0]]));
      const buffered = turf.buffer(line, 5, { units: "meters" }); // 5m buffer

      if (!buffered || !buffered.geometry) return;

      // Calculate area
      const area = turf.area(buffered);
      
      if (area >= MIN_AREA_FOR_TERRITORY) {
        // Update zone visualization
        const source = mapRef.current?.getSource("zone") as maplibregl.GeoJSONSource;
        source?.setData(buffered);

        // Notify parent component
        onTerritoryComplete?.({
          path: points,
          area: Math.round(area)
        });
      }
    } catch (error) {
      console.error("Error computing territory:", error);
    }
  }, [onTerritoryComplete]);

  return (
    <div className="relative w-full h-full" style={{ minHeight: '100vh' }}>
      <div ref={mapContainer} className="absolute inset-0" style={{ width: '100%', height: '100%' }} />
      
      {/* Map controls overlay */}
      <div className="absolute top-4 right-4 bg-background/90 backdrop-blur-sm rounded-lg p-2 shadow-lg">
        <button
          onClick={() => {
            if (mapRef.current && lastPosition) {
              mapRef.current.easeTo({
                center: [lastPosition[1], lastPosition[0]],
                zoom: 16,
                duration: 1000
              });
            }
          }}
          className="p-2 rounded hover:bg-muted transition-colors"
          title="Center on current location"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </button>
      </div>

      {/* Running stats overlay */}
      {isRunning && (
        <div className="absolute bottom-20 left-4 bg-background/90 backdrop-blur-sm rounded-lg p-3 shadow-lg">
          <div className="text-sm text-muted-foreground">Distance</div>
          <div className="text-lg font-bold">{(totalDistance / 1000).toFixed(2)} km</div>
        </div>
      )}
    </div>
  );
};