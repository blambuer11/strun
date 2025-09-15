import { 
  generateNonce, 
  generateRandomness,
  getExtendedEphemeralPublicKey,
  getZkLoginSignature,
  genAddressSeed,
} from '@mysten/zklogin';
import { Ed25519Keypair } from '@mysten/sui.js/keypairs/ed25519';
import { jwtToAddress } from '@mysten/zklogin';
import { suiClient } from './sui-config';
import { toast } from 'sonner';
import { toB64 } from '@mysten/sui.js/utils';

const REDIRECT_URI = window.location.origin.includes('localhost') 
  ? 'http://localhost:5173/'
  : `${window.location.origin}/`;
const PROVER_URL = 'https://prover-dev.mystenlabs.com/v1';
const SALT_SERVICE_URL = 'https://salt.api.mystenlabs.com/get_salt';

export interface ZkLoginState {
  ephemeralKeypair: Ed25519Keypair;
  randomness: string;
  nonce: string;
  maxEpoch: number;
}

// Generate ephemeral keypair and randomness for zkLogin
export async function initializeZkLogin(): Promise<ZkLoginState> {
  const ephemeralKeypair = new Ed25519Keypair();
  const randomness = generateRandomness();
  const { epoch } = await suiClient.getLatestSuiSystemState();
  const maxEpoch = Number(epoch) + 10; // Valid for 10 epochs
  
  const nonce = generateNonce(
    ephemeralKeypair.getPublicKey() as any,
    maxEpoch,
    randomness
  );
  
  // Store in session storage
  sessionStorage.setItem('zklogin_ephemeral_keypair', ephemeralKeypair.export().privateKey);
  sessionStorage.setItem('zklogin_randomness', randomness);
  sessionStorage.setItem('zklogin_nonce', nonce);
  sessionStorage.setItem('zklogin_max_epoch', maxEpoch.toString());
  
  return {
    ephemeralKeypair,
    randomness,
    nonce,
    maxEpoch
  };
}

// Login with Google OAuth
export async function loginWithGoogle(): Promise<void> {
  try {
    const zkLoginState = await initializeZkLogin();
    
    // Determine the correct redirect URI based on the current origin
    let redirectUri = REDIRECT_URI;
    const currentOrigin = window.location.origin;
    
    if (currentOrigin.includes('app.strun.fun')) {
      redirectUri = 'https://app.strun.fun/';
    } else if (currentOrigin.includes('preview-strun.lovable.app')) {
      redirectUri = 'https://preview-strun.lovable.app/';
    } else if (currentOrigin.includes('localhost')) {
      redirectUri = 'http://localhost:5173/';
    }
    
    // Google OAuth URL
    const params = new URLSearchParams({
      client_id: '1089761021386-43lch5ha2bt1cqamdujbggdkh65jjvas.apps.googleusercontent.com',
      redirect_uri: redirectUri,
      response_type: 'id_token',
      scope: 'openid email profile',
      nonce: zkLoginState.nonce,
    });
    
    const loginUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
    window.location.href = loginUrl;
  } catch (error) {
    console.error('Error initializing zkLogin:', error);
    toast.error('Failed to initialize login');
  }
}

// Handle OAuth callback
export async function handleOAuthCallback(): Promise<string | null> {
  const fragment = window.location.hash.substring(1);
  const params = new URLSearchParams(fragment);
  const idToken = params.get('id_token');
  
  if (!idToken) {
    return null;
  }
  
  try {
    // Get stored zkLogin state
    const ephemeralPrivateKey = sessionStorage.getItem('zklogin_ephemeral_keypair');
    const randomness = sessionStorage.getItem('zklogin_randomness');
    const maxEpoch = sessionStorage.getItem('zklogin_max_epoch');
    
    if (!ephemeralPrivateKey || !randomness || !maxEpoch) {
      throw new Error('Missing zkLogin state');
    }
    
    const ephemeralKeypair = Ed25519Keypair.fromSecretKey(
      Buffer.from(ephemeralPrivateKey, 'base64')
    );
    
    // Get salt from service
    const saltResponse = await fetch(SALT_SERVICE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jwt: idToken })
    });
    
    const { salt } = await saltResponse.json();
    
    // Generate zkLogin address using jwtToAddress
    const zkLoginAddress = jwtToAddress(idToken, salt);
    
    // Store auth data
    localStorage.setItem('sui_address', zkLoginAddress);
    localStorage.setItem('id_token', idToken);
    localStorage.setItem('zklogin_salt', salt);
    
    // Clear URL fragment
    window.history.replaceState(null, '', window.location.pathname);
    
    return zkLoginAddress;
  } catch (error) {
    console.error('Error handling OAuth callback:', error);
    toast.error('Failed to complete login');
    return null;
  }
}

// Get zkLogin signature for transaction
export async function getZkLoginSig(txBytes: Uint8Array): Promise<string> {
  const idToken = localStorage.getItem('id_token');
  const salt = localStorage.getItem('zklogin_salt');
  const ephemeralPrivateKey = sessionStorage.getItem('zklogin_ephemeral_keypair');
  const randomness = sessionStorage.getItem('zklogin_randomness');
  const maxEpoch = sessionStorage.getItem('zklogin_max_epoch');
  
  if (!idToken || !salt || !ephemeralPrivateKey || !randomness || !maxEpoch) {
    throw new Error('Missing zkLogin credentials');
  }
  
  const ephemeralKeypair = Ed25519Keypair.fromSecretKey(
    Buffer.from(ephemeralPrivateKey, 'base64')
  );
  
  // Get proof from prover service
  const proofResponse = await fetch(PROVER_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jwt: idToken,
      extendedEphemeralPublicKey: getExtendedEphemeralPublicKey(
        ephemeralKeypair.getPublicKey() as any
      ),
      maxEpoch: Number(maxEpoch),
      jwtRandomness: randomness,
      salt,
    })
  });
  
  const proof = await proofResponse.json();
  
  // Sign the transaction bytes
  const userSignature = await ephemeralKeypair.signPersonalMessage(txBytes);
  
  // Generate zkLogin signature
  const signature = getZkLoginSignature({
    inputs: proof,
    maxEpoch: Number(maxEpoch),
    userSignature: userSignature.signature,
  });
  
  return signature;
}

// Check if user is authenticated
export function isAuthenticated(): boolean {
  return !!localStorage.getItem('sui_address');
}

// Get current user address
export function getCurrentUserAddress(): string | null {
  return localStorage.getItem('sui_address');
}

// Logout
export function logout(): void {
  localStorage.removeItem('sui_address');
  localStorage.removeItem('id_token');
  localStorage.removeItem('zklogin_salt');
  sessionStorage.clear();
}