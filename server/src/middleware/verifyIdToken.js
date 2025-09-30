import { OAuth2Client } from "google-auth-library";
import dotenv from "dotenv";
dotenv.config();

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const client = new OAuth2Client(CLIENT_ID);

export async function verifyIdTokenMiddleware(req, res, next) {
  try {
    const auth = req.headers.authorization || "";
    if (!auth.startsWith("Bearer ")) return res.status(401).json({ error: "Missing authorization" });
    const idToken = auth.slice(7);
    const ticket = await client.verifyIdToken({ idToken, audience: CLIENT_ID });
    const payload = ticket.getPayload();
    // attach minimal user info
    req.authUser = {
      email: payload.email,
      name: payload.name,
      avatar: payload.picture,
      sub: payload.sub,
    };
    next();
  } catch (e) {
    console.error("verifyIdToken failed", e?.message || e);
    return res.status(401).json({ error: "Invalid id_token" });
  }
}