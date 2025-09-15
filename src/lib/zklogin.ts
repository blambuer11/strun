/* src/services/zklogin.ts
 *
 * zkLogin helper for SrRun frontend
 *
 * - initializeZkLogin() -> creates ephemeral keypair, randomness, nonce, saves to sessionStorage
 * - loginWithGoogle() -> redirects user to Google OAuth with nonce
 * - handleOAuthCallback() -> read id_token from URL fragment, fetch salt, compute zkLogin address and save auth data
 * - getZkLoginSig(txBytes) -> obtains proof from prover and returns zkLogin signature ready to pass to Sui client
 *
 * NOTE: small SDK API differences may require tiny edits:
 *  - Ed25519Keypair.export() may return Uint8Array fields; we base64 encode them via toB64
 *  - Ed25519Keypair.fromSecretKey expects a Uint8Array secret key
 *  - Signing method used here assumes `signMessage` or `signData` exists on the keypair; if your SDK exposes a different method (e.g., signTransactionBlock), replace accordingly.
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
import { toast } from "sonner"; // optional: replace with your toast lib
import { suiClient } from "./sui-config"; // your Sui client wrapper

// Config
const GOOGLE_CLIENT_ID =
  "1089761021386-43lch5ha2bt1cqamdujbggdkh65jjvas.apps.googleusercontent.com";
const PROVER_URL = "https://prover-dev.mystenlabs.com/v1"; // devnet prover (for dev)
const SALT_SERVICE_URL = "https://salt.api.mystenlabs.com/get_salt"; // Mysten salt service (example)

function getRedirectUri(): string {
  const origin = window.location.origin;
  if (origin.includes("localhost")) return "http://localhost:5173/";
  if (origin.includes("preview-strun.lovable.app"))
    return "https://preview-strun.lovable.app/";
  return "https://app.strun.fun/";
}

/** Helper: base64 -> Uint8Array */
function base64ToUint8Array(b64: string) {
  return fromB64(b64);
}

/** Helper: Uint8Array -> base64 */
function uint8ArrayToBase64(u8: Uint8Array) {
  return toB64(u8);
}

/** ZkLogin client-side state keys (session/local) */
const SESSION_KEYS = {
  EPHEMERAL_PRIV: "zk_ephemeral_priv_b64",
  RANDOMNESS: "zk_randomness",
  NONCE: "zk_nonce",
  MAX_EPOCH: "zk_max_epoch",
};
const LOCAL_KEYS = {
  ID_TOKEN: "zk_id_token",
  SUI_ADDRESS: "zk_sui_address",
  USER_SALT: "zk_user_salt",
};

/** Type */
export interface ZkLoginState {
  ephemeralKeypair: Ed25519Keypair;
  randomness: string;
  nonce: string;
  maxEpoch: number;
}

/**
 * initializeZkLogin
 * - Creates ephemeral keypair, randomness, nonce and stores them in sessionStorage
 */
export async function initializeZkLogin(): Promise<ZkLoginState> {
  try {
    // create ephemeral keypair
    const ephemeralKeypair = new Ed25519Keypair();

    // export private key as Uint8Array and base64-encode it for storage
    // NOTE: Ed25519Keypair.export() may return an object with privateKey Uint8Array
    // The following uses .export() if available, otherwise fallbacks to raw secret (SDK-specific).
    let privU8: Uint8Array | null = null;
    try {
      // @ts-ignore - export may exist
      const exported = ephemeralKeypair.export?.();
      if (exported && exported.privateKey) {
        privU8 = exported.privateKey as Uint8Array;
      }
    } catch (e) {
      // ignore - try alternative below
    }
    if (!privU8) {
      // Some SDKs expose toSecretKey or secretKey property
      // @ts-ignore
      if (ephemeralKeypair.secretKey) privU8 = ephemeralKeypair.secretKey as Uint8Array;
    }
    if (!privU8) {
      throw new Error("Cannot export ephemeral private key: check SDK API");
    }

    const privB64 = uint8ArrayToBase64(privU8);

    // randomness & nonce
    const randomness = generateRandomness();
    const { epoch } = await suiClient.getLatestSuiSystemState();
    const maxEpoch = Number(epoch) + 10; // ephemeral validity window; adjust as desired
    const nonce = generateNonce(ephemeralKeypair.getPublicKey() as any, maxEpoch, randomness);

    // persist ephemeral priv in sessionStorage (cleared on tab close)
    sessionStorage.setItem(SESSION_KEYS.EPHEMERAL_PRIV, privB64);
    sessionStorage.setItem(SESSION_KEYS.RANDOMNESS, randomness.toString());
    sessionStorage.setItem(SESSION_KEYS.NONCE, nonce);
    sessionStorage.setItem(SESSION_KEYS.MAX_EPOCH, String(maxEpoch));

    return { ephemeralKeypair, randomness, nonce, maxEpoch };
  } catch (e) {
    console.error("initializeZkLogin error", e);
    throw e;
  }
}

/**
 * loginWithGoogle
 * - Initialize ephemeral state and redirect to Google OIDC with nonce
 */
export async function loginWithGoogle(): Promise<void> {
  try {
    const { nonce } = await initializeZkLogin();
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
  } catch (e) {
    console.error("loginWithGoogle error", e);
    toast.error?.("Failed to start Google login");
    throw e;
  }
}

/**
 * handleOAuthCallback
 * - Call this on your callback route (e.g., /callback/) after Google redirects back.
 * - It reads the id_token from URL fragment (hash) and exchanges for salt and computes zkLogin address.
 */
export async function handleOAuthCallback(): Promise<string | null> {
  try {
    // Read token from fragment (#id_token=...)
    const hash = window.location.hash || "";
    const fragment = hash.startsWith("#") ? hash.substring(1) : hash;
    const params = new URLSearchParams(fragment);
    const idToken = params.get("id_token");

    if (!idToken) {
      // No token in fragment — maybe provider used query param; check search too
      const qParams = new URLSearchParams(window.location.search);
      const qToken = qParams.get("id_token");
      if (qToken) {
        // optionally remove query param from URL below
        // continue using qToken
      } else {
        return null;
      }
    }

    const token = idToken || "";

    // Retrieve ephemeral state from session
    const privB64 = sessionStorage.getItem(SESSION_KEYS.EPHEMERAL_PRIV);
    const randomness = sessionStorage.getItem(SESSION_KEYS.RANDOMNESS);
    const maxEpochStr = sessionStorage.getItem(SESSION_KEYS.MAX_EPOCH);

    if (!privB64 || !randomness || !maxEpochStr) {
      console.error("Missing ephemeral state in sessionStorage");
      toast.error?.("Missing ephemeral login state — try login again");
      return null;
    }

    // Build ephemeral keypair from stored private key
    const privU8 = base64ToUint8Array(privB64);
    const ephemeralKeypair = Ed25519Keypair.fromSecretKey?.(privU8);
    if (!ephemeralKeypair) {
      // Some SDKs use different constructor; try alternative:
      try {
        // @ts-ignore
        const alt = new Ed25519Keypair(privU8);
        // @ts-ignore assign if created
        // ephemeralKeypair = alt;
      } catch (err) {
        console.error("Could not reconstruct ephemeral keypair - adjust for your SDK", err);
        toast.error?.("Internal error: ephemeral key reconstruction failed");
        return null;
      }
    }

    // Get salt from salt service - many salt services accept JWT directly
    const saltResp = await fetch(SALT_SERVICE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }), // some services expect { token: idToken } or { jwt: idToken }
    });
    if (!saltResp.ok) {
      console.error("Salt service responded", saltResp.status, await saltResp.text());
      toast.error?.("Unable to get user salt");
      return null;
    }
    const saltJson = await saltResp.json();
    // salt may be nested or named differently; handle common shapes:
    const salt = saltJson?.salt ?? saltJson?.userSalt ?? saltJson?.data?.salt;
    if (!salt) {
      console.error("Salt not found in response", saltJson);
      toast.error?.("Invalid salt response");
      return null;
    }

    // Compute zkLogin address from JWT + salt (jwtToAddress helper)
    const zkAddress = jwtToAddress(token, salt);

    // Persist auth data
    localStorage.setItem(LOCAL_KEYS.ID_TOKEN, token);
    localStorage.setItem(LOCAL_KEYS.SUI_ADDRESS, zkAddress);
    localStorage.setItem(LOCAL_KEYS.USER_SALT, String(salt));

    // Clear fragment from URL for cleanliness
    window.history.replaceState(null, "", window.location.pathname + window.location.search);

    toast.success?.("Signed in");
    return zkAddress;
  } catch (err) {
    console.error("handleOAuthCallback error", err);
    toast.error?.("Failed to handle OAuth callback");
    return null;
  }
}

/**
 * getZkLoginSig
 * - Given `txBytes` (Uint8Array), obtains ZK proof from PROVER_URL and returns the zkLogin signature blob
 * - Caller should pass txBytes (TransactionBlock bytes) as Uint8Array
 */
export async function getZkLoginSig(txBytes: Uint8Array): Promise<any> {
  try {
    const idToken = localStorage.getItem(LOCAL_KEYS.ID_TOKEN);
    const salt = localStorage.getItem(LOCAL_KEYS.USER_SALT);
    const privB64 = sessionStorage.getItem(SESSION_KEYS.EPHEMERAL_PRIV);
    const randomness = sessionStorage.getItem(SESSION_KEYS.RANDOMNESS);
    const maxEpochStr = sessionStorage.getItem(SESSION_KEYS.MAX_EPOCH);

    if (!idToken || !salt || !privB64 || !randomness || !maxEpochStr) {
      throw new Error("Missing zkLogin credentials or ephemeral state");
    }
    const maxEpoch = Number(maxEpochStr);

    // reconstruct ephemeral keypair
    const privU8 = base64ToUint8Array(privB64);
    const ephemeralKeypair = Ed25519Keypair.fromSecretKey?.(privU8);
    if (!ephemeralKeypair) {
      // try alternative construction if SDK differs
      // @ts-ignore
      throw new Error("Cannot reconstruct ephemeral keypair - adjust to your SDK");
    }

    // build extended ephemeral public key representation required by prover
    const extEphPub = getExtendedEphemeralPublicKey(ephemeralKeypair.getPublicKey() as any);

    // call prover to get proof
    const proverResp = await fetch(PROVER_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jwt: idToken,
        extendedEphemeralPublicKey: extEphPub,
        maxEpoch: maxEpoch,
        jwtRandomness: randomness,
        salt: salt,
        keyClaimName: "sub",
      }),
    });

    if (!proverResp.ok) {
      const txt = await proverResp.text();
      console.error("Prover error", proverResp.status, txt);
      throw new Error("Prover service error: " + txt);
    }
    const proof = await proverResp.json();

    // Sign the tx bytes with ephemeral key
    // NOTE: SDK naming can differ: try signMessage or signData or signPersonalMessage
    // We'll try common method signMessage(txBytes) -> returns signature bytes
    // If your SDK expects a different call (e.g., client.signTransactionBlock with signer param),
    // replace accordingly.
    let userSignatureBytes: Uint8Array | null = null;
    // @ts-ignore
    if (typeof ephemeralKeypair.signMessage === "function") {
      // @ts-ignore
      const sig = await ephemeralKeypair.signMessage(txBytes);
      userSignatureBytes = sig;
    } else if (typeof ephemeralKeypair.sign === "function") {
      // some SDKs use sign / signData
      // @ts-ignore
      const sig = await ephemeralKeypair.sign(txBytes);
      // If sign returns object { signature } adapt as needed
      userSignatureBytes = sig?.signature ?? sig;
    } else {
      throw new Error(
        "Ephemeral keypair signing method not found on Ed25519Keypair. Adjust to SDK: use signMessage or signData"
      );
    }

    if (!userSignatureBytes) throw new Error("Could not create ephemeral signature");

    // Compose addressSeed - requires decoded JWT fields (sub and aud)
    // We need decoded JWT to get sub & aud; jwtToAddress already used earlier but here addressSeed creation uses genAddressSeed
    // If you have jwt decode helper, decode now:
    // Minimal decode (no signature verify) to read payload:
    function decodeJwtPayload(token: string) {
      const parts = token.split(".");
      if (parts.length < 2) return null;
      const payload = parts[1];
      try {
        const json = JSON.parse(atob(payload.replace(/-/g, "+").replace(/_/g, "/")));
        return json;
      } catch (e) {
        return null;
      }
    }
    const decoded = decodeJwtPayload(idToken);
    if (!decoded) throw new Error("Could not decode id_token payload");

    // genAddressSeed expects BigInt(salt) or numeric string; adapt if salt is base64
    let saltBigInt: bigint;
    // try parse as decimal or hex string
    try {
      saltBigInt = BigInt(salt.toString());
    } catch (e) {
      // if salt looks like base64, convert to bigint via hex
      try {
        const saltU8 = typeof salt === "string" ? base64ToUint8Array(salt) : new Uint8Array([]);
        // convert to hex then bigint
        let hex = Array.from(saltU8).map((b) => b.toString(16).padStart(2, "0")).join("");
        saltBigInt = BigInt("0x" + hex);
      } catch (ee) {
        throw new Error("Cannot interpret salt as bigint; check salt format");
      }
    }

    // genAddressSeed from zklogin SDK
    const addressSeed = genAddressSeed(
      saltBigInt,
      "sub",
      String(decoded.sub),
      decoded.aud
    ).toString();

    // create zkLogin signature using SDK helper (getZkLoginSignature)
    // sdkGetZkLoginSignature expects inputs: { inputs: partialProof, maxEpoch, userSignature }
    // partialProof must match shape returned by prover; adjust mapping if necessary.
    const zkLoginSig = sdkGetZkLoginSignature({
      inputs: {
        ...proof,
        addressSeed,
      } as any,
      maxEpoch,
      userSignature: userSignatureBytes,
    });

    return zkLoginSig;
  } catch (err) {
    console.error("getZkLoginSig error", err);
    throw err;
  }
}

/** Helper funcs for auth state */
export function isAuthenticated(): boolean {
  return !!localStorage.getItem(LOCAL_KEYS.SUI_ADDRESS);
}
export function getCurrentUserAddress(): string | null {
  return localStorage.getItem(LOCAL_KEYS.SUI_ADDRESS);
}
export function logout(): void {
  localStorage.removeItem(LOCAL_KEYS.SUI_ADDRESS);
  localStorage.removeItem(LOCAL_KEYS.ID_TOKEN);
  localStorage.removeItem(LOCAL_KEYS.USER_SALT);
  sessionStorage.removeItem(SESSION_KEYS.EPHEMERAL_PRIV);
  sessionStorage.removeItem(SESSION_KEYS.NONCE);
  sessionStorage.removeItem(SESSION_KEYS.RANDOMNESS);
  sessionStorage.removeItem(SESSION_KEYS.MAX_EPOCH);
}
