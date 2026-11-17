// عميل Supabase للمتصفح (رابط المشروع + المفتاح العام من src/config.js)
import { createClient } from "@supabase/supabase-js";
import { SUPABASE } from "../config";

export const supabase = createClient(SUPABASE.url, SUPABASE.anonKey, {
  auth: { persistSession: true, autoRefreshToken: true, storageKey: "oj-auth" },
});
