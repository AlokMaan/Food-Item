/* ========================================================
   auth.js — Shared Authentication Module for FoodDash
   ======================================================== */

const SUPABASE_URL = "https://uoncepngmlcjmktqmsls.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVvbmNlcG5nbWxjam1rdHFtc2xzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIxMjI1ODQsImV4cCI6MjA4NzY5ODU4NH0.SSNUmEL4_-Sd1tCbEF7MIW4ygo5FrMaU0RvQHK77phA";

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

/* ── Admin credentials (hardcoded as requested) ─────── */
const ADMIN_USERNAME = "Admin";
const ADMIN_PASSWORD = "Al0k!9812897289";

/* ── Admin Login ────────────────────────────────────── */
function adminLogin(username, password) {
    if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
        localStorage.setItem("fooddash_role", "admin");
        localStorage.setItem("fooddash_admin_user", username);
        return { success: true };
    }
    return { success: false, error: "Invalid username or password." };
}

/* ── Customer — Send Magic Link ────────────────────── */
async function sendMagicLink(email) {
    const { data, error } = await supabaseClient.auth.signInWithOtp({
        email: email,
        options: {
            shouldCreateUser: true,
            emailRedirectTo: window.location.origin + "/index.html"
        }
    });
    if (error) return { success: false, error: error.message };
    return { success: true, data };
}

/* ── Customer — Google OAuth ────────────────────────── */
async function googleLogin() {
    const { data, error } = await supabaseClient.auth.signInWithOAuth({
        provider: "google",
        options: {
            redirectTo: window.location.origin + "/index.html"
        }
    });
    if (error) return { success: false, error: error.message };
    localStorage.setItem("fooddash_role", "customer");
    return { success: true, data };
}

/* ── Session Check ──────────────────────────────────── */
async function checkSession() {
    // Admin check
    const role = localStorage.getItem("fooddash_role");
    if (role === "admin") {
        return { authenticated: true, role: "admin", user: { name: "Admin" } };
    }

    // Supabase session check
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (session) {
        localStorage.setItem("fooddash_role", "customer");
        return {
            authenticated: true,
            role: "customer",
            user: {
                email: session.user.email,
                name: session.user.user_metadata?.full_name || session.user.email || "Customer"
            }
        };
    }

    return { authenticated: false };
}

/* ── Logout ─────────────────────────────────────────── */
async function logout() {
    const role = localStorage.getItem("fooddash_role");
    if (role === "customer") {
        await supabaseClient.auth.signOut();
    }
    localStorage.removeItem("fooddash_role");
    localStorage.removeItem("fooddash_admin_user");
    window.location.href = "login.html";
}
