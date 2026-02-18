"use client";

import { supabase } from "./supabaseClient";

export async function signUp(
  email: string,
  password: string,
  profile?: { zip?: string; county?: string }
) {
  return supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        zip: profile?.zip ?? null,
        county: profile?.county ?? null,
      },
    },
  });
}

export async function signIn(email: string, password: string) {
  return supabase.auth.signInWithPassword({ email, password });
}

export async function signOut() {
  return supabase.auth.signOut();
}

export async function getSession() {
  return supabase.auth.getSession();
}
