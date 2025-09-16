/* src/services/zklogin.ts
 *
 * Robust zkLogin implementation with session state persistence
 * Fixes "Missing ephemeral login state" error
 */

import {
  generateNonce,
  generateRandomness,
  getExtendedEphemeralPublicKey,
  getZkLoginSignature as sdkGetZkLoginSignature,
  genAddressSeed,
  jwtToAddress,
} from "@mysten/zklogin";
import { Ed25519Keypair } from "@mysten/sui.js/keypairs/ed25519";
import { toB64, fromB64 } from "@mysten/sui.js/utils";
import { toast } from "sonner";
import { suiClient } from "./sui-config";

// Configuration
const GOOGLE_CLIENT_ID = "1089761021386-43lch5ha2bt1cqamdujbggdkh65jjvas.apps.googleusercontent.com";
const PROVER_URL = "https://prover-dev.mystenlabs.com/v1";
const MAX_EPOCH_OFFSET = 10;

// Get redirect URI
function getRedirectUri(): string {
  const origin = window.location.origin;
  if (origin.includes("localhost")) return "http://localhost:5173";
  if (origin.includes("lovableproject.com")) return origin;
  if (origin.includes("preview-strun.lovable.app")) return "https://preview-strun.lovable.app";
  return "https://app.strun.fun";
}

// Persistent storage keys
const STORAGE_KEYS = {
  // Use localStorage instead of sessionStorage to persist across redirects
  EPHEMERAL_PRIV: "strun_ephemeral_priv_b64",
  RANDOMNESS: "strun_randomness", 
  NONCE: "strun_nonce",
  MAX_EPOCH: "strun_max_epoch",
  ID_TOKEN: "strun_id_token",
  SUI_ADDRESS: "strun_sui_address",
  USER_SALT: "strun_user_salt",
  LOGIN_STATE: "strun_login_state", // Track login process
};

// Login state tracking
enum LoginState {
  IDLE = "idle",
  INITIALIZING = "initializing", 
  REDIRECTING = "redirecting",
  PROCESSING_CALLBACK = "processing_callback",
  AUTHENTICATED = "authenticated"
}

export interface ZkLoginData {
  ephemeralKeypair: Ed25519Keypair;
  randomness: string;
  nonce: string;
  maxEpoch: number;
  address?: string;
}

// Helper functions
function base64ToUint8Array(b64: string): Uint8Array {
  return fromB64(b64);
}

function uint8ArrayToBase64(u8: Uint8Array): string {
  return toB64(u8);
}

function setLoginState(state: LoginState): void {
  localStorage.setItem(STORAGE_KEYS.LOGIN_STATE, state);
  console.log(`Login state: ${state}`);
}

function getLoginState(): LoginState {
  return (localStorage.getItem(STORAGE_KEYS.LOGIN_STATE) as LoginState) || LoginState.IDLE;
}

// Deterministic salt generation from JWT
function generateDeterministicSalt(jwt: string): string {
  try {
    const parts = jwt.split(".");
    if (parts.length < 2) throw new Error("Invalid JWT");
    
    const payload = JSON.parse(atob(parts[1].replace(/-/g, "+").replace(/_/g, "/")));
    const input = `${payload.sub}-${payload.iss}-strun-v1`;
    
    // Simple but deterministic hash
    let hash = 0;
    for (let i = 0; i < input.length; i++) {
      const char = input.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit
    }
    
    return Math.abs(hash).toString() + "0123456789";
  } catch (error) {
    console.warn("Salt generation failed, using fallback");
    return "12345678901234567890";
  }
}

/**
 * Initialize zkLogin - Persistent storage
 */
export async function initializeZkLogin(): Promise<ZkLoginData> {
  try {
    console.log("Initializing zkLogin...");
    setLoginState(LoginState.INITIALIZING);

    // Create ephemeral keypair
    const ephemeralKeypair = new Ed25519Keypair();
    const secretKey = ephemeralKeypair.getSecretKey();
    const privB64 = typeof secretKey === 'string' ? secretKey : uint8ArrayToBase64(secretKey as Uint8Array);
    
    // Generate randomness
    const randomness = generateRandomness();
    
    // Get current epoch for nonce generation
    const { epoch } = await suiClient.getLatestSuiSystemState();
    const maxEpoch = Number(epoch) + MAX_EPOCH_OFFSET;
    
    // Generate nonce
    const ephemeralPublicKey = ephemeralKeypair.getPublicKey();
    const ephemeralPublicKeyB64 = ephemeralPublicKey.toBase64();
    const nonce = generateNonce(ephemeralPublicKeyB64 as any, maxEpoch, randomness);

    // Store everything in localStorage (persists across redirects)
    localStorage.setItem(STORAGE_KEYS.EPHEMERAL_PRIV, privB64);
    localStorage.setItem(STORAGE_KEYS.RANDOMNESS, randomness.toString());
    localStorage.setItem(STORAGE_KEYS.NONCE, nonce);
    localStorage.setItem(STORAGE_KEYS.MAX_EPOCH, String(maxEpoch));
    
    console.log("zkLogin initialized successfully");
    
    return {
      ephemeralKeypair,
      randomness,
      nonce,
      maxEpoch
    };

  } catch (error) {
    console.error("zkLogin initialization failed:", error);
    setLoginState(LoginState.IDLE);
    throw new Error(`Failed to initialize zkLogin: ${error}`);
  }
}

/**
 * Start Google OAuth login
 */
export async function loginWithGoogle(): Promise<void> {
  try {
    console.log("Starting Google OAuth login...");
    
    // Clear any existing auth data
    clearAuthData();
    
    // Initialize ephemeral state
    const { nonce } = await initializeZkLogin();
    
    setLoginState(LoginState.REDIRECTING);
    
    // Build OAuth URL
    const redirectUri = getRedirectUri();
    const params = new URLSearchParams({
      client_id: GOOGLE_CLIENT_ID,
      redirect_uri: redirectUri,
      response_type: "id_token",
      scope: "openid email profile",
      nonce: nonce,
      prompt: "select_account",
    });

    const loginUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
    
    console.log("Redirecting to Google OAuth:", loginUrl);
    window.location.href = loginUrl;

  } catch (error) {
    console.error("Google login failed:", error);
    setLoginState(LoginState.IDLE);
    toast.error("Google girişi başarısız oldu. Lütfen tekrar deneyin.");
    throw error;
  }
}

/**
 * Handle OAuth callback - Robust token extraction and processing
 */
export async function handleOAuthCallback(): Promise<string | null> {
  try {
    console.log("Processing OAuth callback...");
    setLoginState(LoginState.PROCESSING_CALLBACK);
    
    // Extract ID token from URL
    let idToken: string | null = null;
    
    // Try URL fragment first (#id_token=...)
    const hash = window.location.hash;
    if (hash && hash.includes("id_token=")) {
      const fragment = hash.startsWith("#") ? hash.substring(1) : hash;
      const hashParams = new URLSearchParams(fragment);
      idToken = hashParams.get("id_token");
      console.log("Token found in URL fragment");
    }
    
    // Try query parameters (?id_token=...)
    if (!idToken) {
      const queryParams = new URLSearchParams(window.location.search);
      idToken = queryParams.get("id_token");
      if (idToken) console.log("Token found in query parameters");
    }

    // Check for error in callback
    const error = new URLSearchParams(window.location.search).get("error");
    if (error) {
      console.error("OAuth error:", error);
      toast.error(`Authentication error: ${error}`);
      setLoginState(LoginState.IDLE);
      return null;
    }

    if (!idToken) {
      console.error("No ID token in callback URL");
      toast.error("No authentication token received");
      setLoginState(LoginState.IDLE);
      return null;
    }

    // Verify we have stored ephemeral state
    const storedPriv = localStorage.getItem(STORAGE_KEYS.EPHEMERAL_PRIV);
    const storedRandomness = localStorage.getItem(STORAGE_KEYS.RANDOMNESS);
    const storedMaxEpoch = localStorage.getItem(STORAGE_KEYS.MAX_EPOCH);

    if (!storedPriv || !storedRandomness || !storedMaxEpoch) {
      console.error("Missing stored ephemeral state");
      console.log("Stored keys:", {
        priv: !!storedPriv,
        randomness: !!storedRandomness, 
        maxEpoch: !!storedMaxEpoch
      });
      
      // Try to re-initialize if we're missing state
      toast.error("Login state expired. Please try again.");
      setLoginState(LoginState.IDLE);
      return null;
    }

    // Generate deterministic salt (no external service needed)
    const salt = generateDeterministicSalt(idToken);
    console.log("Generated deterministic salt");
    
    // Compute zkLogin address
    const zkAddress = jwtToAddress(idToken, salt);
    console.log("Computed zkLogin address:", zkAddress);

    // Store authentication data
    localStorage.setItem(STORAGE_KEYS.ID_TOKEN, idToken);
    localStorage.setItem(STORAGE_KEYS.SUI_ADDRESS, zkAddress);
    localStorage.setItem(STORAGE_KEYS.USER_SALT, salt);
    
    setLoginState(LoginState.AUTHENTICATED);

    // Clean up URL
    const cleanUrl = window.location.pathname + window.location.search.split('&').filter(param => 
      !param.includes('id_token') && !param.includes('access_token') && !param.includes('state')
    ).join('&').replace('?&', '?').replace(/\?$/, '');
    
    window.history.replaceState(null, "", cleanUrl || window.location.pathname);

    console.log("OAuth callback processed successfully");
    toast.success("Signed in successfully!");
    
    return zkAddress;

  } catch (error) {
    console.error("OAuth callback processing failed:", error);
    setLoginState(LoginState.IDLE);
    toast.error("Authentication failed. Please try again.");
    return null;
  }
}

/**
 * Get zkLogin signature for transaction
 */
export async function getZkLoginSignature(txBytes: Uint8Array): Promise<any> {
  try {
    console.log("Generating zkLogin signature...");
    
    // Get stored auth data
    const idToken = localStorage.getItem(STORAGE_KEYS.ID_TOKEN);
    const salt = localStorage.getItem(STORAGE_KEYS.USER_SALT);
    const privB64 = localStorage.getItem(STORAGE_KEYS.EPHEMERAL_PRIV);
    const randomness = localStorage.getItem(STORAGE_KEYS.RANDOMNESS);
    const maxEpochStr = localStorage.getItem(STORAGE_KEYS.MAX_EPOCH);

    if (!idToken || !salt || !privB64 || !randomness || !maxEpochStr) {
      throw new Error("Missing authentication data. Please sign in again.");
    }

    const maxEpoch = Number(maxEpochStr);
    
    // Reconstruct ephemeral keypair
    const privU8 = base64ToUint8Array(privB64);
    const ephemeralKeypair = Ed25519Keypair.fromSecretKey(privU8);
    
    // Get extended ephemeral public key
    const ephemeralPublicKeyB64 = ephemeralKeypair.getPublicKey().toBase64();
    const extEphPub = getExtendedEphemeralPublicKey(ephemeralPublicKeyB64 as any);

    // Request proof from prover
    console.log("Requesting zero-knowledge proof...");
    
    const proverResponse = await fetch(PROVER_URL, {
      method: "POST",
      headers: { 
        "Content-Type": "application/json",
        "Accept": "application/json"
      },
      body: JSON.stringify({
        jwt: idToken,
        extendedEphemeralPublicKey: extEphPub,
        maxEpoch: maxEpoch,
        jwtRandomness: randomness,
        salt: salt,
        keyClaimName: "sub",
      }),
    });

    if (!proverResponse.ok) {
      const errorText = await proverResponse.text();
      console.error("Prover service error:", proverResponse.status, errorText);
      throw new Error(`Proof generation failed: ${proverResponse.status}`);
    }

    const proof = await proverResponse.json();
    console.log("Zero-knowledge proof received");

    // Sign transaction with ephemeral key
    const signature = await ephemeralKeypair.sign(txBytes);
    const userSignatureBytes = signature instanceof Uint8Array ? signature : (signature as any).signature;

    if (!userSignatureBytes) {
      throw new Error("Failed to create ephemeral signature");
    }

    // Decode JWT payload
    const jwtParts = idToken.split(".");
    const payload = JSON.parse(atob(jwtParts[1].replace(/-/g, "+").replace(/_/g, "/")));
    
    // Generate address seed
    const saltBigInt = BigInt(salt);
    const addressSeed = genAddressSeed(
      saltBigInt,
      "sub",
      String(payload.sub),
      payload.aud
    ).toString();

    // Create zkLogin signature
    const zkLoginSig = sdkGetZkLoginSignature({
      inputs: {
        ...proof,
        addressSeed,
      },
      maxEpoch,
      userSignature: userSignatureBytes,
    });

    console.log("zkLogin signature generated successfully");
    return zkLoginSig;

  } catch (error) {
    console.error("zkLogin signature generation failed:", error);
    throw error;
  }
}

/**
 * Check if user is authenticated
 */
export function isAuthenticated(): boolean {
  const address = localStorage.getItem(STORAGE_KEYS.SUI_ADDRESS);
  const token = localStorage.getItem(STORAGE_KEYS.ID_TOKEN);
  const state = getLoginState();
  
  return !!(address && token && state === LoginState.AUTHENTICATED);
}

/**
 * Get current user's Sui address
 */
export function getCurrentUserAddress(): string | null {
  return localStorage.getItem(STORAGE_KEYS.SUI_ADDRESS);
}

/**
 * Get user info from stored JWT
 */
export function getCurrentUserInfo(): any {
  try {
    const idToken = localStorage.getItem(STORAGE_KEYS.ID_TOKEN);
    if (!idToken) return null;
    
    const parts = idToken.split(".");
    const payload = JSON.parse(atob(parts[1].replace(/-/g, "+").replace(/_/g, "/")));
    
    return {
      sub: payload.sub,
      email: payload.email,
      name: payload.name,
      picture: payload.picture,
    };
  } catch (error) {
    console.error("Failed to decode user info:", error);
    return null;
  }
}

/**
 * Clear all authentication data
 */
function clearAuthData(): void {
  Object.values(STORAGE_KEYS).forEach(key => {
    localStorage.removeItem(key);
  });
}

/**
 * Logout user
 */
export function logout(): void {
  console.log("Logging out user...");
  clearAuthData();
  setLoginState(LoginState.IDLE);
  toast.success("Logged out successfully");
}

/**
 * Auto-detect and handle OAuth callback
 * Call this on app startup
 */
export async function autoHandleCallback(): Promise<string | null> {
  const currentUrl = window.location.href;
  
  // Check if this looks like an OAuth callback
  const hasIdToken = currentUrl.includes("id_token=") || currentUrl.includes("#id_token");
  const hasState = getLoginState() === LoginState.REDIRECTING;
  
  if (hasIdToken || hasState) {
    console.log("Detected OAuth callback, processing...");
    return await handleOAuthCallback();
  }
  
  return null;
}

/**
 * Get debug information
 */
export function getDebugInfo(): any {
  return {
    isAuthenticated: isAuthenticated(),
    loginState: getLoginState(),
    currentUrl: window.location.href,
    address: getCurrentUserAddress(),
    userInfo: getCurrentUserInfo(),
    storedKeys: Object.entries(STORAGE_KEYS).reduce((acc, [key, storageKey]) => {
      acc[key] = !!localStorage.getItem(storageKey);
      return acc;
    }, {} as any),
  };
}

/**
 * Initialize zkLogin service
 * Call this when app starts
 */
export function initService(): void {
  console.log("Initializing zkLogin service...");
  
  // Auto-handle callback if present
  autoHandleCallback().catch(error => {
    console.error("Auto-callback handling failed:", error);
  });
  
  // Set up cleanup on page unload
  window.addEventListener('beforeunload', () => {
    const state = getLoginState();
    if (state === LoginState.REDIRECTING) {
      console.log("Preserving login state for redirect...");
    }
  });
  
  console.log("zkLogin service initialized");
}