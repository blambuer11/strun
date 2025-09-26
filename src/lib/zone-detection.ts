import { keccak256, toUtf8Bytes } from 'ethers';

export interface Zone {
  id: string;
  canonicalString: string;
  bbox: {
    latMin: number;
    lonMin: number;
    latMax: number;
    lonMax: number;
  };
  polygon?: Array<{ lat: number; lng: number }>;
  zoom: number;
  area: number;
  perimeter: number;
}

export interface RunTrace {
  points: Array<{
    lat: number;
    lng: number;
    accuracy: number;
    speed?: number;
    heading?: number;
    timestamp: number;
  }>;
  distance: number;
  duration: number;
  avgSpeed: number;
  maxSpeed: number;
}

// Anti-cheat thresholds
const MAX_RUNNING_SPEED = 14; // m/s (world record is ~10.4 m/s)
const MAX_ACCURACY_THRESHOLD = 50; // meters
const MIN_ZONE_AREA = 50; // m²
const MIN_ZONE_PERIMETER = 30; // meters
const POLYGON_CLOSE_RADIUS = 10; // meters

// Compute canonical zone ID from coordinates
export function computeZoneId(
  bbox: { latMin: number; lonMin: number; latMax: number; lonMax: number },
  zoom: number
): { zoneId: string; canonical: string } {
  // Fixed decimal precision for consistency
  const canonical = [
    `latMin:${bbox.latMin.toFixed(6)}`,
    `lonMin:${bbox.lonMin.toFixed(6)}`,
    `latMax:${bbox.latMax.toFixed(6)}`,
    `lonMax:${bbox.lonMax.toFixed(6)}`,
    `zoom:${zoom}`
  ].join('|');
  
  // Generate deterministic hash
  const zoneId = '0x' + keccak256(toUtf8Bytes(canonical)).slice(2);
  
  return { zoneId, canonical };
}

// Calculate distance between two points (Haversine formula)
export function calculateDistance(
  point1: { lat: number; lng: number },
  point2: { lat: number; lng: number }
): number {
  const R = 6371000; // Earth's radius in meters
  const φ1 = (point1.lat * Math.PI) / 180;
  const φ2 = (point2.lat * Math.PI) / 180;
  const Δφ = ((point2.lat - point1.lat) * Math.PI) / 180;
  const Δλ = ((point2.lng - point1.lng) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

// Calculate polygon area using Shoelace formula
export function calculatePolygonArea(coordinates: Array<{ lat: number; lng: number }>): number {
  if (coordinates.length < 3) return 0;
  
  let area = 0;
  const n = coordinates.length;
  
  // Convert to projected coordinates (approximate)
  const projectedCoords = coordinates.map(coord => ({
    x: coord.lng * 111320 * Math.cos(coord.lat * Math.PI / 180),
    y: coord.lat * 110540
  }));
  
  // Shoelace formula
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    area += projectedCoords[i].x * projectedCoords[j].y;
    area -= projectedCoords[j].x * projectedCoords[i].y;
  }
  
  return Math.abs(area) / 2;
}

// Calculate polygon perimeter
export function calculatePerimeter(coordinates: Array<{ lat: number; lng: number }>): number {
  let perimeter = 0;
  
  for (let i = 0; i < coordinates.length; i++) {
    const j = (i + 1) % coordinates.length;
    perimeter += calculateDistance(coordinates[i], coordinates[j]);
  }
  
  return perimeter;
}

// Check if polygon is closed
export function isPolygonClosed(
  path: Array<{ lat: number; lng: number }>,
  threshold: number = POLYGON_CLOSE_RADIUS
): boolean {
  if (path.length < 4) return false;
  
  const start = path[0];
  const end = path[path.length - 1];
  
  const distance = calculateDistance(start, end);
  return distance <= threshold;
}

// Detect zone from run trace
export function detectZoneFromTrace(trace: RunTrace): Zone | null {
  const { points } = trace;
  
  if (points.length < 4) return null;
  
  // Check if trace forms a closed polygon
  const isClosed = isPolygonClosed(points.map(p => ({ lat: p.lat, lng: p.lng })));
  
  if (!isClosed) return null;
  
  // Calculate bbox
  const lats = points.map(p => p.lat);
  const lngs = points.map(p => p.lng);
  
  const bbox = {
    latMin: Math.min(...lats),
    latMax: Math.max(...lats),
    lonMin: Math.min(...lngs),
    lonMax: Math.max(...lngs)
  };
  
  // Calculate area and perimeter
  const polygon = points.map(p => ({ lat: p.lat, lng: p.lng }));
  const area = calculatePolygonArea(polygon);
  const perimeter = calculatePerimeter(polygon);
  
  // Check minimum requirements
  if (area < MIN_ZONE_AREA || perimeter < MIN_ZONE_PERIMETER) {
    return null;
  }
  
  // Generate zone ID
  const zoom = 12; // Default zoom level
  const { zoneId, canonical } = computeZoneId(bbox, zoom);
  
  return {
    id: zoneId,
    canonicalString: canonical,
    bbox,
    polygon,
    zoom,
    area,
    perimeter
  };
}

// Anti-cheat validation
export function validateRunTrace(trace: RunTrace): {
  valid: boolean;
  issues: string[];
} {
  const issues: string[] = [];
  
  // Check for impossible speeds
  const speedViolations = trace.points.filter(p => p.speed && p.speed > MAX_RUNNING_SPEED);
  if (speedViolations.length > 0) {
    issues.push(`Detected ${speedViolations.length} samples with impossible running speed`);
  }
  
  // Check GPS accuracy
  const poorAccuracy = trace.points.filter(p => p.accuracy > MAX_ACCURACY_THRESHOLD);
  const poorAccuracyRatio = poorAccuracy.length / trace.points.length;
  if (poorAccuracyRatio > 0.3) {
    issues.push(`Poor GPS accuracy in ${(poorAccuracyRatio * 100).toFixed(1)}% of samples`);
  }
  
  // Check for teleportation (sudden jumps)
  for (let i = 1; i < trace.points.length; i++) {
    const timeDiff = (trace.points[i].timestamp - trace.points[i-1].timestamp) / 1000; // seconds
    if (timeDiff > 0) {
      const distance = calculateDistance(
        { lat: trace.points[i-1].lat, lng: trace.points[i-1].lng },
        { lat: trace.points[i].lat, lng: trace.points[i].lng }
      );
      const speed = distance / timeDiff;
      
      if (speed > MAX_RUNNING_SPEED * 1.5) {
        issues.push(`Detected teleportation at sample ${i}: ${speed.toFixed(1)} m/s`);
      }
    }
  }
  
  // Check average speed
  if (trace.avgSpeed > MAX_RUNNING_SPEED) {
    issues.push(`Average speed ${trace.avgSpeed.toFixed(1)} m/s exceeds maximum`);
  }
  
  // Check max speed
  if (trace.maxSpeed > MAX_RUNNING_SPEED * 1.2) {
    issues.push(`Max speed ${trace.maxSpeed.toFixed(1)} m/s is impossible`);
  }
  
  return {
    valid: issues.length === 0,
    issues
  };
}

// Check if point is inside polygon
export function isPointInPolygon(
  point: { lat: number; lng: number },
  polygon: Array<{ lat: number; lng: number }>
): boolean {
  let inside = false;
  
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].lng;
    const yi = polygon[i].lat;
    const xj = polygon[j].lng;
    const yj = polygon[j].lat;
    
    const intersect = ((yi > point.lat) !== (yj > point.lat))
      && (point.lng < (xj - xi) * (point.lat - yi) / (yj - yi) + xi);
    
    if (intersect) inside = !inside;
  }
  
  return inside;
}

// Smooth GPS trace using simple moving average
export function smoothGPSTrace(
  points: Array<{ lat: number; lng: number; timestamp: number }>,
  windowSize: number = 3
): Array<{ lat: number; lng: number; timestamp: number }> {
  if (points.length <= windowSize) return points;
  
  const smoothed = [];
  
  for (let i = 0; i < points.length; i++) {
    const start = Math.max(0, i - Math.floor(windowSize / 2));
    const end = Math.min(points.length, i + Math.floor(windowSize / 2) + 1);
    const window = points.slice(start, end);
    
    const avgLat = window.reduce((sum, p) => sum + p.lat, 0) / window.length;
    const avgLng = window.reduce((sum, p) => sum + p.lng, 0) / window.length;
    
    smoothed.push({
      lat: avgLat,
      lng: avgLng,
      timestamp: points[i].timestamp
    });
  }
  
  return smoothed;
}

// Format zone metadata for IPFS
export function formatZoneMetadata(zone: Zone, owner: string, additionalData?: any) {
  return {
    version: '1.0',
    zoneId: zone.id,
    canonical: zone.canonicalString,
    bbox: zone.bbox,
    polygon: zone.polygon,
    zoom: zone.zoom,
    area: zone.area,
    perimeter: zone.perimeter,
    owner,
    createdAt: new Date().toISOString(),
    ...additionalData
  };
}