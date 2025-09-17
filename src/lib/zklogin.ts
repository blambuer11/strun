// src/services/zklogin.ts
/**
 * Robust zkLogin client helpers for SrRun
 * - initializeZkLogin()
 * - loginWithGoogle()
 * - handleOAuthCallback()
 * - getZkLoginSignature(txBytes)
 * - auth helpers: isAuthenticated, getCurrentUserAddress, logout, initService
 *
 * This file is written defensively to handle small SDK differences.
 * You may need to adapt a couple of lines to match exact SDK surface in your package versions
 * (notably: how to export/import private keys and signing method names).
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
import { suiClient } from "./sui-config"; // your Sui client instance

// ---- CONFIG ----
const GOOGLE_CLIENT_ID =
  "1089761021386-43lch5ha2bt1cqamdujbggdkh65jjvas.apps.googleusercontent.com";
const PROVER_URL = "https://prover-dev.mystenlabs.com/v1"; // dev prover (use backend proxy for prod)
const MAX_EPOCH_OFFSET = 10;

// ---- STORAGE KEYS ----
const STORAGE_KEYS = {
  EPHEMERAL_PRIV: "strun_ephemeral_priv_b64",
  RANDOMNESS: "strun_randomness",
  NONCE: "strun_nonce",
  MAX_EPOCH: "strun_max_epoch",
  ID_TOKEN: "strun_id_token",
  SUI_ADDRESS: "strun_sui_address",
  USER_SALT: "strun_user_salt",
  LOGIN_STATE: "strun_login_state",
} as const;

// ---- LOGIN STATE ----
enum LoginState {
  IDLE = "idle",
  INITIALIZING = "initializing",
  REDIRECTING = "redirecting",
  PROCESSING_CALLBACK = "processing_callback",
  AUTHENTICATED = "authenticated",
}

// ---- HELPERS ----
function getRedirectUri(): string {
  const origin = window.location.origin;
  // IMPORTANT: return strings include trailing slash to exactly match Google Console redirect URIs
  if (origin.includes("localhost")) return "http://localhost:5173/";
  if (origin.includes("preview-strun.lovable.app"))
    return "https://preview-strun.lovable.app/";
  return "https://app.strun.fun/";
}

function setLoginState(state: LoginState): void {
  localStorage.setItem(STORAGE_KEYS.LOGIN_STATE, state);
  console.log("[zklogin] loginState:", state);
}
function getLoginState(): LoginState {
  return (localStorage.getItem(STORAGE_KEYS.LOGIN_STATE) as LoginState) || LoginState.IDLE;
}

function base64ToUint8Array(b64: string): Uint8Array {
  return fromB64(b64);
}
function uint8ArrayToBase64(u8: Uint8Array): string {
  return toB64(u8);
}

// Safe atob wrapper (browser context)
function safeAtob(input: string): string {
  // fix padding + urlsafe base64
  const s = input.replace(/-/g, "+").replace(/_/g, "/");
  try {
    return atob(s);
  } catch (e) {
    // fallback for environments without atob (rare in browser)
    return Buffer.from(s, "base64").toString("binary");
  }
}

function decodeJwtPayload(token: string): any | null {
  try {
    const parts = token.split(".");
    if (parts.length < 2) return null;
    const payload = JSON.parse(safeAtob(parts[1]));
    return payload;
  } catch {
    return null;
  }
}

// Deterministic lightweight salt fallback (only used when you don't want remote salt service)
function generateDeterministicSalt(jwt: string): string {
  try {
    const payload = decodeJwtPayload(jwt);
    if (!payload || !payload.sub || !payload.iss) throw new Error("bad jwt");
    const input = `${payload.sub}:${payload.iss}:srun`;
    // simple hash -> decimal string (not cryptographically strong, but deterministic)
    let h = 0;
    for (let i = 0; i < input.length; i++) {
      h = (h << 5) - h + input.charCodeAt(i);
      h |= 0;
    }
    const positive = Math.abs(h);
    // append digits to ensure length
    return String(positive) + "0000000000";
  } catch {
    return "12345678901234567890";
  }
}

// Try to extract private key Uint8Array from Ed25519Keypair instance
function extractPrivUint8(ephemeral: Ed25519Keypair): Uint8Array {
  // Try common SDK exports
  // 1) ephemeral.export()?.privateKey
  // 2) ephemeral.getSecretKey?.() or ephemeral.secretKey
  // 3) ephemeral.toBytes? etc.
  // We'll probe these possibilities
  // @ts-ignore
  try {
    // some SDKs have export() returning { privateKey: Uint8Array }
    const maybe = (ephemeral as any).export?.();
    if (maybe && maybe.privateKey) {
      return maybe.privateKey as Uint8Array;
    }
  } catch {}
  // @ts-ignore
  if (typeof (ephemeral as any).getSecretKey === "function") {
    // @ts-ignore
    const sk = (ephemeral as any).getSecretKey();
    if (sk instanceof Uint8Array) return sk;
    if (typeof sk === "string") return base64ToUint8Array(sk);
  }
  // @ts-ignore
  if ((ephemeral as any).secretKey instanceof Uint8Array) {
    // @ts-ignore
    return (ephemeral as any).secretKey as Uint8Array;
  }
  // Fallback: try toJSON / toRaw
  // @ts-ignore
  if (typeof (ephemeral as any).toJSON === "function") {
    try {
      // some representations include secretKey base64
      const j = (ephemeral as any).toJSON();
      if (j && j.secretKey) {
        if (typeof j.secretKey === "string") {
          return base64ToUint8Array(j.secretKey);
        }
        if (j.secretKey instanceof Uint8Array) return j.secretKey;
      }
    } catch {}
  }
  throw new Error("Cannot extract ephemeral private key from Ed25519Keypair - adjust for SDK");
}

// Try to reconstruct Ed25519Keypair from private key bytes
function reconstructKeypairFromSecret(secretU8: Uint8Array): Ed25519Keypair {
  // Many SDKs provide Ed25519Keypair.fromSecretKey(u8)
  // Try common possibilities:
  //  - Ed25519Keypair.fromSecretKey(u8)
  //  - new Ed25519Keypair(u8)
  // If none work, user must adapt.
  // @ts-ignore
  if (typeof (Ed25519Keypair as any).fromSecretKey === "function") {
    // @ts-ignore
    return (Ed25519Keypair as any).fromSecretKey(secretU8);
  }
  try {
    // @ts-ignore
    return new (Ed25519Keypair as any)(secretU8);
  } catch (e) {
    throw new Error("Cannot reconstruct Ed25519Keypair from secret - adapt to SDK");
  }
}

// ---- MAIN API ----
export interface ZkLoginData {
  ephemeralKeypair: Ed25519Keypair;
  randomness: string;
  nonce: string;
  maxEpoch: number;
}

/**
 * initializeZkLogin
 * - create ephemeral keypair, randomness, nonce
 * - persist ephemeral private key (base64) + randomness + nonce + maxEpoch into localStorage
 *   (we persist so state survives full redirect flow; clear on logout)
 */
export async function initializeZkLogin(): Promise<ZkLoginData> {
  try {
    setLoginState(LoginState.INITIALIZING);
    console.log("[zklogin] initializing ephemeral keypair...");

    const ephemeral = new Ed25519Keypair();

    // extract private key bytes and encode base64 for storage
    const privU8 = extractPrivUint8(ephemeral);
    const privB64 = uint8ArrayToBase64(privU8);

    const randomness = generateRandomness();
    const { epoch } = await suiClient.getLatestSuiSystemState();
    const maxEpoch = Number(epoch) + MAX_EPOCH_OFFSET;

    // generate nonce using the public key object (preferred)
    const pubKey = ephemeral.getPublicKey?.() ?? (ephemeral as any).publicKey;
    if (!pubKey) {
      throw new Error("Ephemeral public key not available - adjust SDK usage");
    }
    const nonce = generateNonce(pubKey as any, maxEpoch, randomness);

    // persist
    localStorage.setItem(STORAGE_KEYS.EPHEMERAL_PRIV, privB64);
    localStorage.setItem(STORAGE_KEYS.RANDOMNESS, String(randomness));
    localStorage.setItem(STORAGE_KEYS.NONCE, nonce);
    localStorage.setItem(STORAGE_KEYS.MAX_EPOCH, String(maxEpoch));
    console.log("[zklogin] stored ephemeral state");

    setLoginState(LoginState.IDLE);
    return { ephemeralKeypair: ephemeral, randomness, nonce, maxEpoch };
  } catch (err) {
    console.error("[zklogin] initialize error:", err);
    setLoginState(LoginState.IDLE);
    throw err;
  }
}

/**
 * loginWithGoogle
 * - initialize ephemeral state then redirect to Google OAuth (id_token implicit flow)
 */
export async function loginWithGoogle(): Promise<void> {
  try {
    clearAuthData(); // ensure clean
    setLoginState(LoginState.REDIRECTING);

    const { nonce } = await initializeZkLogin();
    const redirectUri = getRedirectUri();

    const params = new URLSearchParams({
      client_id: GOOGLE_CLIENT_ID,
      redirect_uri: redirectUri,
      response_type: "id_token",
      scope: "openid email profile",
      nonce,
      prompt: "select_account",
    });

    const url = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
    console.log("[zklogin] redirecting to", url);
    window.location.href = url;
  } catch (err) {
    console.error("[zklogin] loginWithGoogle error:", err);
    setLoginState(LoginState.IDLE);
    toast.error?.("Failed to start Google login");
    throw err;
  }
}

/**
 * handleOAuthCallback
 * - parse id_token from fragment or query, reconstruct ephemeral key state, compute salt (deterministic fallback),
 *   derive zkLogin address and persist auth state
 */
export async function handleOAuthCallback(): Promise<string | null> {
  try {
    setLoginState(LoginState.PROCESSING_CALLBACK);

    // parse id_token from fragment (#id_token=...) or query
    let idToken: string | null = null;
    const hash = window.location.hash || "";
    if (hash.includes("id_token=")) {
      const frag = hash.startsWith("#") ? hash.substring(1) : hash;
      const fragParams = new URLSearchParams(frag);
      idToken = fragParams.get("id_token");
    }
    if (!idToken) {
      const qp = new URLSearchParams(window.location.search);
      idToken = qp.get("id_token");
    }

    if (!idToken) {
      console.error("[zklogin] No id_token found in callback");
      setLoginState(LoginState.IDLE);
      toast.error?.("Login token not found. Please try again.");
      return null;
    }
    
    console.log("[zklogin] Processing OAuth callback with id_token");

    // ensure ephemeral stored state is present
    const privB64 = localStorage.getItem(STORAGE_KEYS.EPHEMERAL_PRIV);
    const randomness = localStorage.getItem(STORAGE_KEYS.RANDOMNESS);
    const maxEpochStr = localStorage.getItem(STORAGE_KEYS.MAX_EPOCH);
    if (!privB64 || !randomness || !maxEpochStr) {
      setLoginState(LoginState.IDLE);
      toast.error?.("Login state missing. Please try again.");
      return null;
    }

    // reconstruct ephemeral key (we may not need full key here, but keep for completeness)
    const privU8 = base64ToUint8Array(privB64);
    const ephemeral = reconstructKeypairFromSecret(privU8);

    // compute salt - deterministic fallback (you can replace with remote salt service if desired)
    const salt = generateDeterministicSalt(idToken);

    // derive zkLogin address
    const zkAddress = jwtToAddress(idToken, salt);

    // persist auth
    localStorage.setItem(STORAGE_KEYS.ID_TOKEN, idToken);
    localStorage.setItem(STORAGE_KEYS.SUI_ADDRESS, zkAddress);
    localStorage.setItem(STORAGE_KEYS.USER_SALT, String(salt));
    setLoginState(LoginState.AUTHENTICATED);

    // cleanup URL (remove token fragment/query)
    const clean = window.location.pathname;
    window.history.replaceState(null, "", clean);

    toast.success?.("Signed in successfully");
    return zkAddress;
  } catch (err) {
    console.error("[zklogin] handleOAuthCallback error:", err);
    setLoginState(LoginState.IDLE);
    toast.error?.("Authentication failed");
    return null;
  }
}

/**
 * getZkLoginSignature
 * - Given raw tx bytes (Uint8Array) returns zkLogin signature object to pass to Sui client
 * - NOTE: prefer to run prover on backend to avoid CORS / rate limits
 */
export async function getZkLoginSignature(txBytes: Uint8Array): Promise<any> {
  try {
    const idToken = localStorage.getItem(STORAGE_KEYS.ID_TOKEN);
    const salt = localStorage.getItem(STORAGE_KEYS.USER_SALT);
    const privB64 = localStorage.getItem(STORAGE_KEYS.EPHEMERAL_PRIV);
    const randomness = localStorage.getItem(STORAGE_KEYS.RANDOMNESS);
    const maxEpochStr = localStorage.getItem(STORAGE_KEYS.MAX_EPOCH);

    if (!idToken || !salt || !privB64 || !randomness || !maxEpochStr) {
      throw new Error("Missing auth or ephemeral state. Please login again.");
    }
    const maxEpoch = Number(maxEpochStr);

    // reconstruct ephemeral keypair
    const privU8 = base64ToUint8Array(privB64);
    const ephemeral = reconstructKeypairFromSecret(privU8);

    // build extended ephemeral public key for prover
    const extEphPub = getExtendedEphemeralPublicKey(ephemeral.getPublicKey() as any);

    // call prover (consider proxying this call through your backend)
    const resp = await fetch(PROVER_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        jwt: idToken,
        extendedEphemeralPublicKey: extEphPub,
        maxEpoch,
        jwtRandomness: randomness,
        salt,
        keyClaimName: "sub",
      }),
    });
    if (!resp.ok) {
      const text = await resp.text().catch(() => "");
      throw new Error(`Prover error ${resp.status}: ${text}`);
    }
    const proof = await resp.json();

    // sign txBytes with ephemeral key
    // Try common sign methods (signMessage / sign / signData)
    let userSignatureBytes: Uint8Array | null = null;
    // @ts-ignore
    if (typeof ephemeral.signMessage === "function") {
      // @ts-ignore
      userSignatureBytes = await ephemeral.signMessage(txBytes);
    } else if (typeof ephemeral.sign === "function") {
      // @ts-ignore
      const s: any = await ephemeral.sign(txBytes);
      // Check if s is already a Uint8Array or has a signature property
      if (s instanceof Uint8Array) {
        userSignatureBytes = s;
      } else if (s && typeof s === 'object' && 'signature' in s) {
        userSignatureBytes = s.signature;
      } else {
        userSignatureBytes = s;
      }
    } else {
      throw new Error("Ephemeral key signing method not found - adapt to SDK");
    }

    if (!userSignatureBytes) throw new Error("Failed to create ephemeral signature");

    // decode jwt payload to read sub/aud
    const payload = decodeJwtPayload(idToken);
    if (!payload) throw new Error("Invalid id_token payload");

    // ensure salt is interpretable as bigint
    let saltBigInt: bigint;
    try {
      saltBigInt = BigInt(String(salt));
    } catch {
      // If salt is base64, convert to bigint
      try {
        const saltU8 = base64ToUint8Array(String(salt));
        const hex = Array.from(saltU8)
          .map((b) => b.toString(16).padStart(2, "0"))
          .join("");
        saltBigInt = BigInt("0x" + hex);
      } catch {
        throw new Error("Cannot convert salt to bigint - check salt format");
      }
    }

    // aud may be string or array
    const audValue =
      typeof payload.aud === "string" ? payload.aud : Array.isArray(payload.aud) ? payload.aud[0] : String(payload.aud);

    const addressSeed = genAddressSeed(
      saltBigInt,
      "sub",
      String(payload.sub),
      audValue
    ).toString();

    const zkLoginSignature = sdkGetZkLoginSignature({
      inputs: { ...proof, addressSeed } as any,
      maxEpoch,
      userSignature: userSignatureBytes,
    });

    return zkLoginSignature;
  } catch (err) {
    console.error("[zklogin] getZkLoginSignature error:", err);
    throw err;
  }
}

// ---- utilities ----
export function isAuthenticated(): boolean {
  const addr = localStorage.getItem(STORAGE_KEYS.SUI_ADDRESS);
  const token = localStorage.getItem(STORAGE_KEYS.ID_TOKEN);
  return !!(addr && token && getLoginState() === LoginState.AUTHENTICATED);
}
export function getCurrentUserAddress(): string | null {
  return localStorage.getItem(STORAGE_KEYS.SUI_ADDRESS);
}
export function getCurrentUserInfo(): any | null {
  const idToken = localStorage.getItem(STORAGE_KEYS.ID_TOKEN);
  if (!idToken) return null;
  return decodeJwtPayload(idToken);
}
function clearAuthData(): void {
  Object.values(STORAGE_KEYS).forEach((k) => localStorage.removeItem(k));
}
export function logout(): void {
  clearAuthData();
  setLoginState(LoginState.IDLE);
  toast.success?.("Logged out");
}

/**
 * autoHandleCallback
 * - detect whether current URL is OAuth callback and handle it
 */
export async function autoHandleCallback(): Promise<string | null> {
  const url = window.location.href;
  const hasIdToken = url.includes("id_token=") || url.includes("#id_token");
  const wasRedirecting = getLoginState() === LoginState.REDIRECTING;
  if (hasIdToken || wasRedirecting) {
    return await handleOAuthCallback();
  }
  return null;
}

/**
 * initService - call on app start
 */
export function initService(): void {
  // run auto handler but don't block
  autoHandleCallback().catch((e) => console.error("[zklogin] auto callback error", e));
}
