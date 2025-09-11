import { SuiClient, getFullnodeUrl } from '@mysten/sui.js/client';
import { Ed25519Keypair } from '@mysten/sui.js/keypairs/ed25519';
import { TransactionBlock } from '@mysten/sui.js/transactions';

// Sui Network Configuration
export const SUI_NETWORK = 'testnet'; // Change to 'mainnet' for production
export const SUI_RPC_URL = getFullnodeUrl(SUI_NETWORK);

// Initialize Sui Client
export const suiClient = new SuiClient({ url: SUI_RPC_URL });

// Smart Contract Details (Update after deployment)
export const PACKAGE_ID = '0x...'; // Will be updated after deployment
export const MODULE_NAME = 'territory';

// zkLogin Configuration
export const ZKLOGIN_PROVIDER = 'https://zklogin.sui.io';
export const CLIENT_ID = process.env.VITE_GOOGLE_CLIENT_ID || '';

// Territory claiming configuration
export const MIN_TERRITORY_SIZE = 100; // minimum 100 meters
export const XP_PER_METER = 1;
export const RENT_PERCENTAGE = 10;

// Helper function to format Sui address
export function formatAddress(address: string): string {
  if (!address) return '';
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

// Helper function to calculate polygon area (in square meters)
export function calculatePolygonArea(coordinates: Array<{ lat: number; lng: number }>): number {
  if (coordinates.length < 3) return 0;
  
  let area = 0;
  const n = coordinates.length;
  
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    area += coordinates[i].lat * coordinates[j].lng;
    area -= coordinates[j].lat * coordinates[i].lng;
  }
  
  area = Math.abs(area) / 2;
  // Convert to square meters (approximate)
  return area * 111000 * 111000; // 1 degree ≈ 111km
}

// Helper to check if polygon is closed (user returned to start)
export function isPolygonClosed(
  path: Array<{ lat: number; lng: number }>,
  threshold: number = 50 // meters
): boolean {
  if (path.length < 4) return false;
  
  const start = path[0];
  const current = path[path.length - 1];
  
  const distance = calculateDistance(start, current);
  return distance <= threshold;
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