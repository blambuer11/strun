// Sui Land NFT Contract Integration
import { SuiClient, getFullnodeUrl } from '@mysten/sui.js/client';
import { TransactionBlock } from '@mysten/sui.js/transactions';
import { isAuthenticated, getAddress } from './zklogin';
import { supabase } from '@/integrations/supabase/client';

// Contract configuration - Update after deploying on Sui
export const LAND_PACKAGE_ID = '0xSTRUN'; // Your deployed package address
export const LAND_MODULE_NAME = 'map_land';
export const REGISTRY_OBJECT_ID = '0xREGISTRY'; // Will be set after registry initialization

// Initialize Sui client
const suiClient = new SuiClient({ url: getFullnodeUrl('testnet') });

// Convert coordinates to zone ID (hex string)
export function generateZoneId(
  lat: number, 
  lng: number, 
  zoom: number
): string {
  // Create unique zone identifier
  const zoneKey = `${zoom}_${lat.toFixed(6)}_${lng.toFixed(6)}`;
  // Convert to hex string
  const encoder = new TextEncoder();
  const data = encoder.encode(zoneKey);
  return Array.from(data, byte => byte.toString(16).padStart(2, '0')).join('');
}

// Create coordinates JSON metadata
export function createCoordsJson(
  coordinates: Array<{ lat: number; lng: number }>
): string {
  return JSON.stringify({
    type: 'Polygon',
    coordinates: coordinates.map(c => [c.lng, c.lat]),
    bbox: calculateBBox(coordinates)
  });
}

// Calculate bounding box
function calculateBBox(coords: Array<{ lat: number; lng: number }>): number[] {
  const lats = coords.map(c => c.lat);
  const lngs = coords.map(c => c.lng);
  return [
    Math.min(...lngs), // west
    Math.min(...lats), // south
    Math.max(...lngs), // east
    Math.max(...lats)  // north
  ];
}

// Initialize land registry (called once by platform owner)
export async function initializeLandRegistry(): Promise<string> {
  if (!isAuthenticated()) {
    throw new Error('User not authenticated');
  }

  const tx = new TransactionBlock();
  
  tx.moveCall({
    target: `${LAND_PACKAGE_ID}::${LAND_MODULE_NAME}::init_registry`,
    arguments: []
  });

  try {
    const result = await executeTransaction(tx);
    const registryId = result.objectChanges?.find(
      obj => obj.type === 'created'
    )?.objectId;
    
    if (registryId) {
      console.log('Land registry initialized:', registryId);
      return registryId;
    }
    throw new Error('Failed to get registry ID');
  } catch (error) {
    console.error('Failed to initialize registry:', error);
    throw error;
  }
}

// Mint land NFT
export async function mintLandNFT(
  coordinates: Array<{ lat: number; lng: number }>,
  zoom: number,
  name: string,
  description?: string
): Promise<string> {
  if (!isAuthenticated()) {
    throw new Error('User not authenticated');
  }

  const zoneId = generateZoneId(
    coordinates[0].lat,
    coordinates[0].lng,
    zoom
  );
  
  const coordsJson = createCoordsJson(coordinates);
  const metadataUri = await uploadMetadataToIPFS({
    name,
    description,
    coordinates,
    zoom,
    timestamp: Date.now()
  });

  const tx = new TransactionBlock();
  
  tx.moveCall({
    target: `${LAND_PACKAGE_ID}::${LAND_MODULE_NAME}::mint_land`,
    arguments: [
      tx.object(REGISTRY_OBJECT_ID), // registry
      tx.pure(zoneId),
      tx.pure(zoom),
      tx.pure(coordsJson),
      tx.pure(metadataUri)
    ]
  });

  try {
    const result = await executeTransaction(tx);
    const landNFT = result.objectChanges?.find(
      obj => obj.type === 'created'
    )?.objectId;
    
    if (landNFT) {
      // Store NFT ID in database
      const { data: profile } = await supabase
        .from('profiles')
        .select('id')
        .eq('user_id', (await supabase.auth.getUser()).data.user?.id)
        .single();
      
      if (profile) {
        await supabase.from('regions').update({
          nft_id: landNFT,
          metadata: { zone_id: zoneId }
        }).eq('owner_id', profile.id);
      }
      
      return landNFT;
    }
    throw new Error('Failed to mint land NFT');
  } catch (error) {
    console.error('Failed to mint land:', error);
    throw error;
  }
}

// Set land for sale
export async function setLandForSale(
  landNFTId: string,
  price: number,
  forSale: boolean
): Promise<void> {
  if (!isAuthenticated()) {
    throw new Error('User not authenticated');
  }

  const tx = new TransactionBlock();
  
  tx.moveCall({
    target: `${LAND_PACKAGE_ID}::${LAND_MODULE_NAME}::set_for_sale`,
    arguments: [
      tx.object(landNFTId),
      tx.pure(price),
      tx.pure(forSale)
    ]
  });

  await executeTransaction(tx);
}

// Set land for rent
export async function setLandForRent(
  landNFTId: string,
  rentPriceXP: number,
  forRent: boolean
): Promise<void> {
  if (!isAuthenticated()) {
    throw new Error('User not authenticated');
  }

  const tx = new TransactionBlock();
  
  tx.moveCall({
    target: `${LAND_PACKAGE_ID}::${LAND_MODULE_NAME}::set_for_rent`,
    arguments: [
      tx.object(landNFTId),
      tx.pure(rentPriceXP),
      tx.pure(forRent)
    ]
  });

  await executeTransaction(tx);
}

// Rent land
export async function rentLand(
  landNFTId: string,
  rentUntilEpoch: number
): Promise<void> {
  if (!isAuthenticated()) {
    throw new Error('User not authenticated');
  }

  const renterAddress = getAddress();
  if (!renterAddress) {
    throw new Error('No wallet address found');
  }

  const tx = new TransactionBlock();
  
  tx.moveCall({
    target: `${LAND_PACKAGE_ID}::${LAND_MODULE_NAME}::rent_land`,
    arguments: [
      tx.object(landNFTId),
      tx.pure(renterAddress),
      tx.pure(rentUntilEpoch)
    ]
  });

  await executeTransaction(tx);
}

// Transfer land ownership
export async function transferLand(
  landNFTId: string,
  toAddress: string
): Promise<void> {
  if (!isAuthenticated()) {
    throw new Error('User not authenticated');
  }

  const tx = new TransactionBlock();
  
  tx.moveCall({
    target: `${LAND_PACKAGE_ID}::${LAND_MODULE_NAME}::transfer_land`,
    arguments: [
      tx.object(landNFTId),
      tx.pure(toAddress)
    ]
  });

  await executeTransaction(tx);
}

// Update land metadata
export async function updateLandMetadata(
  landNFTId: string,
  coordsJson: string,
  metadataUri: string
): Promise<void> {
  if (!isAuthenticated()) {
    throw new Error('User not authenticated');
  }

  const tx = new TransactionBlock();
  
  tx.moveCall({
    target: `${LAND_PACKAGE_ID}::${LAND_MODULE_NAME}::update_metadata`,
    arguments: [
      tx.object(landNFTId),
      tx.pure(coordsJson),
      tx.pure(metadataUri)
    ]
  });

  await executeTransaction(tx);
}

// Helper function to execute transactions
async function executeTransaction(tx: TransactionBlock) {
  // This would be integrated with zkLogin for signing
  // For now, returning mock result
  console.log('Executing Sui transaction:', tx);
  
  // Mock implementation - replace with actual zkLogin signing when available
  return {
    objectChanges: [
      { type: 'created', objectId: '0x' + Math.random().toString(16).substr(2, 64) }
    ]
  };
}

// Upload metadata to IPFS (mock implementation)
async function uploadMetadataToIPFS(metadata: any): Promise<string> {
  // In production, use actual IPFS service or Walrus
  console.log('Uploading metadata to IPFS:', metadata);
  return 'ipfs://QmExample' + Math.random().toString(36).substr(2, 9);
}

// Check if zone is already minted
export async function isZoneMinted(
  lat: number,
  lng: number,
  zoom: number
): Promise<boolean> {
  const zoneId = generateZoneId(lat, lng, zoom);
  
  try {
    // Check in database if this zone is already minted
    const { data } = await supabase
      .from('regions')
      .select('id, metadata')
      .maybeSingle();
    
    if (data && data.metadata) {
      const metadata = data.metadata as any;
      return metadata.zone_id === zoneId;
    }
    return false;
  } catch {
    return false;
  }
}