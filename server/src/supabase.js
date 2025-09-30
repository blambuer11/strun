import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
dotenv.config();

const URL = process.env.SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!URL || !KEY) {
  console.warn("Supabase URL or SERVICE ROLE KEY is missing in env");
}

export const supabase = createClient(URL, KEY, {
  auth: { persistSession: false }
});