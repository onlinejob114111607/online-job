// بديل "firebase/auth" فوق Supabase Auth (دخول الأدمن بالإيميل وكلمة السر)
import { supabase } from "./client.js";

const toUser = (u) => (u ? { uid: u.id, email: u.email, displayName: u.user_metadata?.name || null } : null);
const auth = { currentUser: null };

export const getAuth = () => auth;

export function onAuthStateChanged(_auth, cb) {
  supabase.auth.getSession().then(({ data }) => {
    auth.currentUser = toUser(data.session?.user);
    cb(auth.currentUser);
  });
  const { data } = supabase.auth.onAuthStateChange((_e, session) => {
    auth.currentUser = toUser(session?.user);
    cb(auth.currentUser);
  });
  return () => data.subscription.unsubscribe();
}

export async function signInWithEmailAndPassword(_auth, email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    const e = new Error(error.message);
    e.code = "auth/invalid-credential";
    throw e;
  }
  auth.currentUser = toUser(data.user);
  return { user: auth.currentUser };
}

export async function signOut() {
  await supabase.auth.signOut();
  auth.currentUser = null;
}
