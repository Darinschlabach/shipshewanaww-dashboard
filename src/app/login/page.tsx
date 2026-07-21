"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import PasswordInput from "@/components/PasswordInput";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [resetSent, setResetSent] = useState(false);

  async function handleSignIn(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const supabase = createClient();
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (signInError) {
      setError(signInError.message);
      setLoading(false);
      return;
    }
    window.location.href = "/dashboard";
  }

  async function handleForgotPassword(e: React.MouseEvent) {
    e.preventDefault();
    if (!email) {
      setError("Enter your email first, then click forgot password.");
      return;
    }
    const supabase = createClient();
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(
      email,
      {
        redirectTo: `${window.location.origin}/auth/callback?next=/reset-password`,
      },
    );
    if (resetError) {
      setError(resetError.message);
    } else {
      setResetSent(true);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-cream px-4">
      <div className="w-full max-w-sm rounded-lg bg-white p-8 shadow-md">
        <div className="mb-8 text-center">
          <p className="text-lg font-bold text-burgundy">Shipshewana Woodworks</p>
          <p className="text-xs uppercase tracking-wider text-gray-400">
            Management
          </p>
        </div>

        <form onSubmit={handleSignIn} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-burgundy focus:outline-none focus:ring-1 focus:ring-burgundy"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Password
            </label>
            <PasswordInput
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}
          {resetSent && (
            <p className="text-sm text-green-600">
              Password reset email sent. Check your inbox.
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-md bg-burgundy py-2.5 text-sm font-medium text-white hover:bg-burgundy/90 disabled:opacity-50"
          >
            {loading ? "Signing in…" : "Sign in"}
          </button>
        </form>

        <button
          onClick={handleForgotPassword}
          className="mt-4 w-full text-center text-sm text-gray-500 hover:text-burgundy"
        >
          Forgot password?
        </button>
      </div>
    </div>
  );
}
