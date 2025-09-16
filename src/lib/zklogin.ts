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
const GOOGLE_CLIENT_ID =
  "1089761021386-43lch5ha2bt1cqamdujbggdkh65jjvas.apps.googleusercontent.com";
const PROVER_URL = "https://prover-dev.mystenlabs.com/v1";
const MAX_EPOCH_OFFSET = 10;

// Get redirect URI
function getRedirectUri(): string {
  const origin = window.location.origin;

  if (origin.includes("localhost")) return "http://localhost:5173/";
  if (origin.includes("preview-strun.lovable.app"))
    return "https://preview-strun.lovable.app/";
  return "https://app.strun.fun/"; // default prod domain
}

// Persistent storage keys
const STORAGE_KEYS = {
  EPHEMERAL_PRIV: "strun_ephemeral_priv_b64",
  RANDOMNESS: "strun_randomness",
  NONCE: "strun_nonce",
  MAX_EPOCH: "strun_max_epoch",
  ID_TOKEN: "strun_id_token",
  SUI_ADDRESS: "strun_sui_address",
  USER_SALT: "strun_user_salt",
  LOGIN_STATE: "strun_login_state",
};

// Login state tracking
enum LoginState {
  IDLE = "idle",
  INITIALIZING = "initializing",
  REDIRECTING = "redirecting",
  PROCESSING_CALLBACK = "processing_callback",
  AUTHENTICATED = "authenticated",
}

export interface ZkLoginData {
  ephemeralKeypair: Ed25519Keypair;
  randomness: string;
  nonce: string;
  maxEpoch: number;
  address?: string;
}

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
  return (
    (localStorage.getItem(STORAGE_KEYS.LOGIN_STATE) as LoginState) ||
    LoginState.IDLE
  );
}

// Deterministic salt generation from JWT
function generateDeterministicSalt(jwt: string): string {
  try {
    const parts = jwt.split(".");
    if (parts.length < 2) throw new Error("Invalid JWT");

    const payload = JSON.parse(
      atob(parts[1].replace(/-/g, "+").replace(/_/g, "/"))
    );
    const input = `${payload.sub}-${payload.iss}-strun-v1`;

    let hash = 0;
    for (let i = 0; i < input.length; i++) {
      const char = input.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash;
    }

    return Math.abs(hash).toString() + "0123456789";
  } catch (error) {
    console.warn("Salt generation failed, using fallback");
    return "12345678901234567890";
  }
}

/**
 * Initialize zkLogin
 */
export async function initializeZkLogin(): Promise<ZkLoginData> {
  try {
    console.log("Initializing zkLogin...");
    setLoginState(LoginState.INITIALIZING);

    const ephemeralKeypair = new Ed25519Keypair();
    const secretKey = ephemeralKeypair.getSecretKey();
    const privB64 =
      typeof secretKey === "string"
        ? secretKey
        : uint8ArrayToBase64(secretKey as Uint8Array);

    const randomness = generateRandomness();

    const { epoch } = await suiClient.getLatestSuiSystemState();
    const maxEpoch = Number(epoch) + MAX_EPOCH_OFFSET;

    const ephemeralPublicKeyB64 = ephemeralKeypair.getPublicKey().toBase64();
    const nonce = generateNonce(ephemeralPublicKeyB64 as any, maxEpoch, randomness);

    localStorage.setItem(STORAGE_KEYS.EPHEMERAL_PRIV, privB64);
    localStorage.setItem(STORAGE_KEYS.RANDOMNESS, randomness.toString());
    localStorage.setItem(STORAGE_KEYS.NONCE, nonce);
    localStorage.setItem(STORAGE_KEYS.MAX_EPOCH, String(maxEpoch));

    return { ephemeralKeypair, randomness, nonce, maxEpoch };
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
    clearAuthData();
    const { nonce } = await initializeZkLogin();
    setLoginState(LoginState.REDIRECTING);

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
    window.location.href = loginUrl;
  } catch (error) {
    console.error("Google login failed:", error);
    setLoginState(LoginState.IDLE);
    toast.error("Google girişi başarısız oldu. Lütfen tekrar deneyin.");
    throw error;
  }
}

/**
 * Handle OAuth callback
 */
export async function handleOAuthCallback(): Promise<string | null> {
  try {
    setLoginState(LoginState.PROCESSING_CALLBACK);

    let idToken: string | null = null;
    const hash = window.location.hash;
    if (hash && hash.includes("id_token=")) {
      const fragment = hash.startsWith("#") ? hash.substring(1) : hash;
      const hashParams = new URLSearchParams(fragment);
      idToken = hashParams.get("id_token");
    }

    if (!idToken) {
      const queryParams = new URLSearchParams(window.location.search);
      idToken = queryParams.get("id_token");
    }

    if (!idToken) {
      setLoginState(LoginState.IDLE);
      return null;
    }

    const storedPriv = localStorage.getItem(STORAGE_KEYS.EPHEMERAL_PRIV);
    const storedRandomness = localStorage.getItem(STORAGE_KEYS.RANDOMNESS);
    const storedMaxEpoch = localStorage.getItem(STORAGE_KEYS.MAX_EPOCH);
    if (!storedPriv || !storedRandomness || !storedMaxEpoch) {
      toast.error("Login state expired. Please try again.");
      setLoginState(LoginState.IDLE);
      return null;
    }

    const salt = generateDeterministicSalt(idToken);
    const zkAddress = jwtToAddress(idToken, salt);

    localStorage.setItem(STORAGE_KEYS.ID_TOKEN, idToken);
    localStorage.setItem(STORAGE_KEYS.SUI_ADDRESS, zkAddress);
    localStorage.setItem(STORAGE_KEYS.USER_SALT, salt);

    setLoginState(LoginState.AUTHENTICATED);

    const cleanUrl = window.location.pathname;
    window.history.replaceState(null, "", cleanUrl);

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
export async function getZkLoginSignature(
  txBytes: Uint8Array
): Promise<any> {
  try {
    const idToken = localStorage.getItem(STORAGE_KEYS.ID_TOKEN);
    const salt = localStorage.getItem(STORAGE_KEYS.USER_SALT);
    const privB64 = localStorage.getItem(STORAGE_KEYS.EPHEMERAL_PRIV);
    const randomness = localStorage.getItem(STORAGE_KEYS.RANDOMNESS);
    const maxEpochStr = localStorage.getItem(STORAGE_KEYS.MAX_EPOCH);

    if (!idToken || !salt || !privB64 || !randomness || !maxEpochStr) {
      throw new Error("Missing authentication data. Please sign in again.");
    }

    const maxEpoch = Number(maxEpochStr);
    const privU8 = base64ToUint8Array(privB64);
    const ephemeralKeypair = Ed25519Keypair.fromSecretKey(privU8);

    const ephemeralPublicKeyB64 = ephemeralKeypair.getPublicKey().toBase64();
    const extEphPub = getExtendedEphemeralPublicKey(ephemeralPublicKeyB64 as any);

    const proverResponse = await fetch(PROVER_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        jwt: idToken,
        extendedEphemeralPublicKey: extEphPub,
        maxEpoch: maxEpoch,
        jwtRandomness: randomness,
        salt: salt,
        keyClaimName: "sub",
      }),
    });

    const proof = await proverResponse.json();
    const signature = await ephemeralKeypair.sign(txBytes);
    const userSignatureBytes =
      signature instanceof Uint8Array ? signature : (signature as any).signature;

    const jwtParts = idToken.split(".");
    const payload = JSON.parse(
      atob(jwtParts[1].replace(/-/g, "+").replace(/_/g, "/"))
    );

    const saltBigInt = BigInt(salt);
    const addressSeed = genAddressSeed(
      saltBigInt,
      "sub",
      String(payload.sub),
      payload.aud
    ).toString();

    return sdkGetZkLoginSignature({
      inputs: { ...proof, addressSeed },
      maxEpoch,
      userSignature: userSignatureBytes,
    });
  } catch (error) {
    console.error("zkLogin signature generation failed:", error);
    throw error;
  }
}

/**
 * Utilities
 */
export function isAuthenticated(): boolean {
  const address = localStorage.getItem(STORAGE_KEYS.SUI_ADDRESS);
  const token = localStorage.getItem(STORAGE_KEYS.ID_TOKEN);
  return !!(address && token && getLoginState() === LoginState.AUTHENTICATED);
}

export function getCurrentUserAddress(): string | null {
  return localStorage.getItem(STORAGE_KEYS.SUI_ADDRESS);
}

export function getCurrentUserInfo(): any {
  try {
    const idToken = localStorage.getItem(STORAGE_KEYS.ID_TOKEN);
    if (!idToken) return null;
    const parts = idToken.split(".");
    return JSON.parse(atob(parts[1].replace(/-/g, "+").replace(/_/g, "/")));
  } catch {
    return null;
  }
}

function clearAuthData(): void {
  Object.values(STORAGE_KEYS).forEach((key) => {
    localStorage.removeItem(key);
  });
}

export function logout(): void {
  clearAuthData();
  setLoginState(LoginState.IDLE);
  toast.success("Logged out successfully");
}

export async function autoHandleCallback(): Promise<string | null> {
  const currentUrl = window.location.href;
  const hasIdToken =
    currentUrl.includes("id_token=") || currentUrl.includes("#id_token");
  const hasState = getLoginState() === LoginState.REDIRECTING;
  if (hasIdToken || hasState) {
    return await handleOAuthCallback();
  }
  return null;
}

export function initService(): void {
  autoHandleCallback().catch(console.error);
}
