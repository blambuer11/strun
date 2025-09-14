import { Ed25519Keypair } from '@mysten/sui.js/keypairs/ed25519';
import { SuiClient } from '@mysten/sui.js/client';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

const SUI_NETWORK = 'testnet'; // Use testnet for development
const SUI_RPC_URL = `https://fullnode.${SUI_NETWORK}.sui.io:443`;

export interface WalletInfo {
  address: string;
  publicKey: string;
  privateKey: string; // Encrypted
  createdAt: number;
  network: string;
}

/**
 * Generate a new Sui wallet for a user
 */
export async function generateSuiWallet(): Promise<WalletInfo | null> {
  try {
    // Generate new keypair
    const keypair = new Ed25519Keypair();
    const address = keypair.getPublicKey().toSuiAddress();
    const publicKey = keypair.getPublicKey().toBase64();
    
    // Get the private key (in production, this should be encrypted)
    const privateKeyArray = keypair.export().privateKey;
    const privateKey = Buffer.from(privateKeyArray).toString('base64');

    const walletInfo: WalletInfo = {
      address,
      publicKey,
      privateKey, // In production, encrypt this before storing
      createdAt: Date.now(),
      network: SUI_NETWORK,
    };

    return walletInfo;
  } catch (error) {
    console.error("Error generating Sui wallet:", error);
    return null;
  }
}

/**
 * Store wallet info securely (encrypted) in user's profile
 */
async function storeWalletInfo(userId: string, walletInfo: WalletInfo): Promise<boolean> {
  try {
    // In production, encrypt the private key before storing
    // For now, we'll store it in localStorage (NOT recommended for production)
    const encryptedWallet = {
      ...walletInfo,
      privateKey: btoa(walletInfo.privateKey), // Basic encoding (use proper encryption in production)
    };

    // Store in localStorage (consider using secure storage in production)
    localStorage.setItem(`sui_wallet_${userId}`, JSON.stringify(encryptedWallet));

    // Also update the user's profile with the wallet address
    const { error } = await supabase
      .from('profiles')
      .update({ 
        wallet_address: walletInfo.address,
      })
      .eq('id', userId);

    if (error) {
      console.error("Error updating profile with wallet info:", error);
      return false;
    }

    return true;
  } catch (error) {
    console.error("Error storing wallet info:", error);
    return false;
  }
}

/**
 * Get or create wallet for email-authenticated user
 */
export async function getOrCreateWalletForUser(userId: string): Promise<WalletInfo | null> {
  try {
    // Check if wallet already exists
    const storedWallet = localStorage.getItem(`sui_wallet_${userId}`);
    if (storedWallet) {
      const wallet = JSON.parse(storedWallet);
      // Decrypt the private key
      wallet.privateKey = atob(wallet.privateKey);
      return wallet;
    }

    // Generate new wallet
    const newWallet = await generateSuiWallet();
    if (!newWallet) {
      toast.error("Failed to generate Sui wallet");
      return null;
    }

    // Store wallet info
    const stored = await storeWalletInfo(userId, newWallet);
    if (!stored) {
      toast.error("Failed to store wallet information");
      return null;
    }

    toast.success(`Sui wallet created: ${newWallet.address.slice(0, 6)}...${newWallet.address.slice(-4)}`);
    return newWallet;
  } catch (error) {
    console.error("Error getting or creating wallet:", error);
    toast.error("Failed to setup Sui wallet");
    return null;
  }
}

/**
 * Get wallet balance
 */
export async function getWalletBalance(address: string): Promise<{ sui: number; wal: number }> {
  try {
    const client = new SuiClient({ url: SUI_RPC_URL });
    
    // Get all coins for the address
    const coins = await client.getCoins({ owner: address });
    
    let suiBalance = 0;
    let walBalance = 0;

    for (const coin of coins.data) {
      if (coin.coinType === '0x2::sui::SUI') {
        suiBalance += parseInt(coin.balance);
      } else if (coin.coinType.includes('wal') || coin.coinType.includes('WAL')) {
        walBalance += parseInt(coin.balance);
      }
    }

    // Convert from MIST/FROST to SUI/WAL (1 SUI = 1,000,000,000 MIST)
    return {
      sui: suiBalance / 1_000_000_000,
      wal: walBalance / 1_000_000_000,
    };
  } catch (error) {
    console.error("Error getting wallet balance:", error);
    return { sui: 0, wal: 0 };
  }
}

/**
 * Request test tokens from faucet (testnet only)
 */
export async function requestTestTokens(address: string): Promise<boolean> {
  if (SUI_NETWORK !== 'testnet') {
    toast.error("Faucet is only available on testnet");
    return false;
  }

  try {
    const response = await fetch('https://faucet.testnet.sui.io/gas', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        FixedAmountRequest: {
          recipient: address,
        },
      }),
    });

    if (!response.ok) {
      throw new Error('Failed to request tokens from faucet');
    }

    toast.success("Test SUI tokens received!");
    return true;
  } catch (error) {
    console.error("Error requesting test tokens:", error);
    toast.error("Failed to get test tokens");
    return false;
  }
}

/**
 * Initialize wallet for authenticated email user
 */
export async function initializeUserWallet(session: any): Promise<WalletInfo | null> {
  if (!session?.user?.id) {
    return null;
  }

  // Check if user logged in with email
  if (session.user.email) {
    const wallet = await getOrCreateWalletForUser(session.user.id);
    
    if (wallet) {
      // Get initial balance
      const balance = await getWalletBalance(wallet.address);
      
      // If on testnet and no balance, request from faucet
      if (SUI_NETWORK === 'testnet' && balance.sui === 0) {
        await requestTestTokens(wallet.address);
      }
      
      return wallet;
    }
  }

  return null;
}