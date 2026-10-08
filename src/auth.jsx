import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { createClient } from "@supabase/supabase-js";

const URL_ = import.meta.env.VITE_SUPABASE_URL;
const KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;
export const supabase = URL_ && KEY ? createClient(URL_, KEY) : null;

const Ctx = createContext({ session: null, token: null, enabled: false });

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => data.subscription.unsubscribe();
  }, []);
  const value = useMemo(() => ({ session, token: session?.access_token || null, enabled: !!supabase, user: session?.user || null }), [session]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
export const useAuth = () => useContext(Ctx);
