import { createClient } from "@supabase/supabase-js";

// These two values are PUBLIC and safe to expose in the browser.
// The anon key only ever acts within the RLS rules we set up in Phase 3 —
// it cannot read or change anything it isn't explicitly allowed to.
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  realtime: {
    params: {
      eventsPerSecond: 5,
    },
  },
});
