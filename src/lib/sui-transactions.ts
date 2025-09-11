import { TransactionBlock } from '@mysten/sui.js/transactions';
import { suiClient, PACKAGE_ID, MODULE_NAME, calculatePolygonArea } from './sui-config';
import { getZkLoginSig, getCurrentUserAddress } from './zklogin';
import { toast } from 'sonner';

// Get or create user profile
export async function getOrCreateProfile() {
  const address = getCurrentUserAddress();
  if (!address) throw new Error('Not authenticated');

  try {
    // Check if profile exists
    const { data } = await suiClient.getOwnedObjects({
      owner: address,
      filter: {
        StructType: `${PACKAGE_ID}::${MODULE_NAME}::UserProfile`,
      },
    });

    if (data.length > 0) {
      return data[0].data?.objectId;
    }

    // Create new profile
    const tx = new TransactionBlock();
    const username = address.slice(0, 8); // Use address prefix as username
    
    tx.moveCall({
      target: `${PACKAGE_ID}::${MODULE_NAME}::create_profile`,
      arguments: [
        tx.pure(Array.from(new TextEncoder().encode(username))),
        tx.object('0x6'), // Clock object
      ],
    });

    const result = await executeTransaction(tx);
    return result.objectChanges?.[0]?.objectId;
  } catch (error) {
    console.error('Error with profile:', error);
    throw error;
  }
}

// Start a run session
export async function startRunSession() {
  const tx = new TransactionBlock();
  
  tx.moveCall({
    target: `${PACKAGE_ID}::${MODULE_NAME}::start_run`,
    arguments: [
      tx.object('0x6'), // Clock object
    ],
  });

  const result = await executeTransaction(tx);
  return result.objectChanges?.[0]?.objectId;
}

// Claim territory
export async function claimTerritory(territoryData: {
  name: string;
  coordinates: Array<{ lat: number; lng: number }>;
  area: number;
  rentPrice: number;
}) {
  const address = getCurrentUserAddress();
  if (!address) throw new Error('Not authenticated');

  const profileId = await getOrCreateProfile();
  const gameStateId = await getGameStateId();

  const tx = new TransactionBlock();

  // Convert coordinates to Move format
  const moveCoordinates = territoryData.coordinates.map(coord => ({
    lat: Math.floor(coord.lat * 1000000), // Convert to integers
    lng: Math.floor(coord.lng * 1000000),
  }));

  // Calculate distance (perimeter)
  let distance = 0;
  for (let i = 0; i < territoryData.coordinates.length; i++) {
    const j = (i + 1) % territoryData.coordinates.length;
    const lat1 = territoryData.coordinates[i].lat;
    const lng1 = territoryData.coordinates[i].lng;
    const lat2 = territoryData.coordinates[j].lat;
    const lng2 = territoryData.coordinates[j].lng;
    
    distance += Math.sqrt(Math.pow(lat2 - lat1, 2) + Math.pow(lng2 - lng1, 2)) * 111000;
  }

  tx.moveCall({
    target: `${PACKAGE_ID}::${MODULE_NAME}::claim_territory`,
    arguments: [
      tx.object(gameStateId),
      tx.object(profileId),
      tx.pure(Array.from(new TextEncoder().encode(territoryData.name))),
      tx.pure(moveCoordinates),
      tx.pure(Math.floor(distance)),
      tx.pure(territoryData.rentPrice),
      tx.object('0x6'), // Clock object
    ],
  });

  return await executeTransaction(tx);
}

// Pay rent for territory entry
export async function payTerritoryRent(
  territoryId: string,
  ownerId: string,
  amount: number
) {
  const profileId = await getOrCreateProfile();
  const gameStateId = await getGameStateId();

  const tx = new TransactionBlock();

  tx.moveCall({
    target: `${PACKAGE_ID}::${MODULE_NAME}::pay_rent`,
    arguments: [
      tx.object(gameStateId),
      tx.object(territoryId),
      tx.object(profileId),
      tx.object(ownerId), // Owner's profile
    ],
  });

  return await executeTransaction(tx);
}

// Get game state object ID (should be stored after deployment)
async function getGameStateId(): Promise<string> {
  // In production, this should be fetched from your backend or stored after deployment
  // For now, you'll need to update this after deploying the contract
  const GAME_STATE_ID = '0x...'; // Update after deployment
  return GAME_STATE_ID;
}

// Execute transaction with zkLogin signature
async function executeTransaction(tx: TransactionBlock) {
  const address = getCurrentUserAddress();
  if (!address) throw new Error('Not authenticated');

  try {
    tx.setSender(address);
    
    const { bytes, signature: userSig } = await tx.sign({
      client: suiClient,
    });

    const zkLoginSig = await getZkLoginSig(bytes);

    const result = await suiClient.executeTransactionBlock({
      transactionBlock: bytes,
      signature: zkLoginSig,
      options: {
        showEffects: true,
        showObjectChanges: true,
      },
    });

    if (result.effects?.status?.status === 'success') {
      return result;
    } else {
      throw new Error('Transaction failed');
    }
  } catch (error) {
    console.error('Transaction error:', error);
    throw error;
  }
}

// Get user's territories
export async function getUserTerritories() {
  const address = getCurrentUserAddress();
  if (!address) return [];

  try {
    const { data } = await suiClient.getOwnedObjects({
      owner: address,
      filter: {
        StructType: `${PACKAGE_ID}::${MODULE_NAME}::Territory`,
      },
      options: {
        showContent: true,
      },
    });

    return data.map((obj: any) => ({
      id: obj.data?.objectId,
      name: obj.data?.content?.fields?.name,
      area: obj.data?.content?.fields?.area,
      rentPrice: obj.data?.content?.fields?.rent_price,
      coordinates: obj.data?.content?.fields?.coordinates,
    }));
  } catch (error) {
    console.error('Error fetching territories:', error);
    return [];
  }
}

// Get user's XP balance
export async function getUserXP() {
  const address = getCurrentUserAddress();
  if (!address) return 0;

  try {
    const profileId = await getOrCreateProfile();
    const { data } = await suiClient.getObject({
      id: profileId,
      options: {
        showContent: true,
      },
    });

    return data?.content?.fields?.xp_balance?.fields?.amount || 0;
  } catch (error) {
    console.error('Error fetching XP:', error);
    return 0;
  }
}