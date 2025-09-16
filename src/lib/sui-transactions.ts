import { TransactionBlock } from '@mysten/sui.js/transactions';
import { suiClient, PACKAGE_ID, MODULE_NAME, calculatePolygonArea } from './sui-config';
import { getZkLoginSignature, getCurrentUserAddress } from './zklogin';
import { toast } from 'sonner';
import { Ed25519Keypair } from '@mysten/sui.js/keypairs/ed25519';

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
    
    // Find the created object ID from the transaction result
    if (result.objectChanges) {
      for (const change of result.objectChanges) {
        if ('objectType' in change && change.objectType?.includes('UserProfile')) {
          return change.objectId;
        }
      }
    }
    
    throw new Error('Failed to create profile');
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
  
  // Find the created session object
  if (result.objectChanges) {
    for (const change of result.objectChanges) {
      if ('objectType' in change && change.objectType?.includes('RunSession')) {
        return change.objectId;
      }
    }
  }
  
  return null;
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
    
    // Build the transaction
    const bytes = await tx.build({ client: suiClient });
    
    // Get zkLogin signature
    const zkLoginSig = await getZkLoginSignature(new Uint8Array(bytes));

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

    return data.map((obj: any) => {
      if (obj.data?.content?.dataType === 'moveObject') {
        const fields = obj.data.content.fields;
        return {
          id: obj.data?.objectId,
          name: fields?.name,
          area: fields?.area,
          rentPrice: fields?.rent_price,
          coordinates: fields?.coordinates,
        };
      }
      return null;
    }).filter(Boolean);
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

    if (data?.content?.dataType === 'moveObject') {
      return (data.content as any).fields?.xp_balance?.fields?.amount || 0;
    }
    return 0;
  } catch (error) {
    console.error('Error fetching XP:', error);
    return 0;
  }
}

// Complete a run session
export async function completeRunSession(
  sessionId: string,
  distance: number,
  xpEarned: number
): Promise<void> {
  const tx = new TransactionBlock();
  
  tx.moveCall({
    target: `${PACKAGE_ID}::${MODULE_NAME}::complete_run`,
    arguments: [
      tx.pure(sessionId),
      tx.pure(distance),
      tx.pure(xpEarned),
      tx.object('0x6'), // Clock object
    ],
  });

  await executeTransaction(tx);
}