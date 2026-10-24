"use client";

import { AnimatePresence, motion } from "framer-motion";
import { ArrowUpRight, Github, LoaderCircle, Mail, X } from "lucide-react";
import { useState, type FormEvent } from "react";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/config";

type AuthModalProps = {
  open: boolean;
  onClose: () => void;
  onAuthenticated: (user: User) => void;
};

export function AuthModal({ open, onClose, onAuthenticated }: AuthModalProps) {
  const [mode, setMode] = useState<"login" | "signup">("signup");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setNotice("");
    setBusy(true);

    try {
      const supabase = createClient();
      const result =
        mode === "signup"
          ? await supabase.auth.signUp({ email, password })
          : await supabase.auth.signInWithPassword({ email, password });

      if (result.error) throw result.error;
      if (!result.data.user) {
        setNotice("Check your inbox to confirm your email, then come back to sign in.");
        return;
      }

      if (mode === "signup" && !result.data.session) {
        setNotice("Check your inbox to confirm your email, then come back to sign in.");
        return;
      }

      onAuthenticated(result.data.user);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "We couldn't complete that request. Please try again.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function signInWithGithub() {
    setError("");
    setBusy(true);

    try {
      const supabase = createClient();
      const { error: authError } = await supabase.auth.signInWithOAuth({
        provider: "github",
        options: {
          redirectTo: `${window.location.origin}/auth/callback?next=/`,
        },
      });
      if (authError) throw authError;
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "GitHub sign-in could not be started.",
      );
      setBusy(false);
    }
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="modal-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) onClose();
          }}
        >
          <motion.section
            aria-labelledby="auth-title"
            aria-modal="true"
            className="auth-card"
            initial={{ opacity: 0, y: 18, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.98 }}
            role="dialog"
            transition={{ duration: 0.2 }}
          >
            <button
              aria-label="Close sign in dialog"
              className="icon-button auth-close"
              onClick={onClose}
              type="button"
            >
              <X size={18} />
            </button>
            <span className="auth-mark"><span className="brand-mark">n</span></span>
            <p className="eyebrow">YOUR IDEAS, KEPT</p>
            <h2 id="auth-title">
              {mode === "signup" ? "Make it yours." : "Welcome back."}
            </h2>
            <p className="auth-copy">
              Sign in to save projects, share a live link, and take your code with you.
            </p>

            {!isSupabaseConfigured() && (
              <p className="auth-message auth-error">
                Add your Supabase URL and anon key to enable accounts.
              </p>
            )}
            {error && <p className="auth-message auth-error">{error}</p>}
            {notice && <p className="auth-message auth-notice">{notice}</p>}

            <button
              className="oauth-button"
              disabled={busy || !isSupabaseConfigured()}
              onClick={signInWithGithub}
              type="button"
            >
              <Github size={17} />
              Continue with GitHub
              <ArrowUpRight className="button-trailing" size={16} />
            </button>

            <div className="auth-divider"><span>or with email</span></div>

            <form className="auth-form" onSubmit={submit}>
              <label htmlFor="auth-email">Email address</label>
              <div className="input-with-icon">
                <Mail aria-hidden="true" size={16} />
                <input
                  autoComplete="email"
                  id="auth-email"
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="you@example.com"
                  required
                  type="email"
                  value={email}
                />
              </div>
              <label htmlFor="auth-password">Password</label>
              <input
                autoComplete={mode === "signup" ? "new-password" : "current-password"}
                id="auth-password"
                minLength={8}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="At least 8 characters"
                required
                type="password"
                value={password}
              />
              <button
                className="button button-primary auth-submit"
                disabled={busy || !isSupabaseConfigured()}
                type="submit"
              >
                {busy ? <LoaderCircle className="spin" size={17} /> : null}
                {mode === "signup" ? "Create free account" : "Sign in"}
                {!busy ? <ArrowUpRight size={16} /> : null}
              </button>
            </form>

            <p className="auth-switch">
              {mode === "signup" ? "Already have an account?" : "New around here?"}{" "}
              <button
                onClick={() => {
                  setMode(mode === "signup" ? "login" : "signup");
                  setError("");
                  setNotice("");
                }}
                type="button"
              >
                {mode === "signup" ? "Sign in" : "Create an account"}
              </button>
            </p>
          </motion.section>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
