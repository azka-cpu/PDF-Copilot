"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabaseClient";

export default function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);

    const { error } =
      mode === "signin"
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signUp({ email, password });

    if (error) {
      setError(error.message);
    } else if (mode === "signup") {
      setMessage("Check your email to confirm your account.");
    }
    setLoading(false);
  }

  return (
    <div className="min-h-screen bg-ink flex items-center justify-center px-4">
      <div className="w-full max-w-sm bg-paper rounded-2xl shadow-xl p-8">
        <div className="flex items-center gap-2 mb-1">
          <div className="w-8 h-8 rounded-lg bg-teal flex items-center justify-center text-white font-display font-bold">
            P
          </div>
          <h1 className="text-xl font-display font-bold text-ink">PDF Copilot</h1>
        </div>
        <p className="text-sm text-slate-muted mb-6">
          {mode === "signin" ? "Sign in to continue" : "Create your account"}
        </p>

        <form onSubmit={handleSubmit} className="space-y-3">
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal focus:border-transparent"
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
            className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal focus:border-transparent"
          />

          {error && (
            <p className="text-sm text-rose bg-rose-light rounded-lg px-3 py-2">{error}</p>
          )}
          {message && (
            <p className="text-sm text-teal-dark bg-teal-light rounded-lg px-3 py-2">
              {message}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-teal text-white rounded-lg py-2.5 text-sm font-semibold hover:bg-teal-dark transition-colors disabled:opacity-50"
          >
            {loading ? "Please wait…" : mode === "signin" ? "Sign In" : "Sign Up"}
          </button>
        </form>

        <button
          onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
          className="mt-4 text-sm text-teal hover:text-teal-dark transition-colors"
        >
          {mode === "signin" ? "Need an account? Sign up" : "Already have an account? Sign in"}
        </button>
      </div>
    </div>
  );
}
