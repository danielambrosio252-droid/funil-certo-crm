import { supabase } from "@/integrations/supabase/client";

// Re-export the supabase client
export { supabase };

// Helper function to get current session
export async function getCurrentSession() {
  const { data: { session }, error } = await supabase.auth.getSession();
  if (error) throw error;
  return session;
}

// Helper function to get current user profile with company
export async function getCurrentProfile() {
  const session = await getCurrentSession();
  if (!session?.user) return null;

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("*, companies(*)")
    .eq("user_id", session.user.id)
    .single();

  if (error && error.code !== "PGRST116") throw error;
  return profile;
}
