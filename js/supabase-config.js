// ============================================================
// ZYKOS GAMER — Centralized Supabase Configuration
// Each deployment gets its own Supabase project.
// Change ONLY these two values to point to a different instance.
// The anon key is a PUBLIC key — security comes from RLS policies.
// ============================================================

const SUPABASE_URL = 'https://aypljitzifwjosjkqsuu.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF5cGxqaXR6aWZ3am9zamtxc3V1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM1NzA4MjksImV4cCI6MjA4OTE0NjgyOX0.uIKgKI0XrarWqHNtjDTPTUUbI15fxL-ptr0-xFcLz4Q';

function getSupabaseClient() {
  if (window._supabaseClient) return window._supabaseClient;
  if (!window.supabase || !window.supabase.createClient) {
    console.error('[supabase-config] Supabase JS SDK not loaded.');
    return null;
  }
  window._supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  return window._supabaseClient;
}
