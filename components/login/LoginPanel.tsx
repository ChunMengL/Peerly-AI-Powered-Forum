"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

type AuthMode = "signin" | "signup";
type MessageState = "success" | "error" | "info";

const MIN_PASSWORD_LENGTH = 6;

function friendlyAuthError(error: unknown, fallback: string): string {
  if (error instanceof TypeError) {
    return "Can't reach the server. Check your connection and try again.";
  }

  if (!(error instanceof Error)) {
    return fallback;
  }

  const raw = error.message;

  if (raw.includes("Failed to fetch")) {
    return "Can't reach the server. Check your connection and try again.";
  }

  if (raw.includes("Invalid login credentials")) {
    return "Incorrect email or password.";
  }

  if (raw.includes("Email not confirmed")) {
    return "Please confirm your email first — check your inbox for the confirmation link.";
  }

  return raw;
}

export function LoginPanel() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [mode, setMode] = useState<AuthMode>("signin");
  const [isAnimating, setIsAnimating] = useState(false);
  const [formMessage, setFormMessage] = useState("");
  const [formStatus, setFormStatus] = useState<MessageState>("info");
  const [submitting, setSubmitting] = useState(false);
  const [dismissedStatusKey, setDismissedStatusKey] = useState<string | null>(
    null,
  );

  const status = searchParams.get("status");
  const message = searchParams.get("message");
  const email = searchParams.get("email");
  const name = searchParams.get("name");

  const statusMessage = useMemo(() => {
    if (!status || !message) {
      return null;
    }

    if (status === "success" && email) {
      return `${message} ${name ? `${name} ` : ""}(${email})`;
    }

    return message;
  }, [email, message, name, status]);

  const isSignUp = mode === "signup";

  // A fresh URL status/message produces a new key, so it shows again even if a
  // previous one was dismissed (no reset effect needed).
  const statusKey = status && message ? `${status}::${message}` : null;
  const showStatusToast = Boolean(statusMessage) && statusKey !== dismissedStatusKey;

  const activeToast: { state: MessageState; text: string } | null = formMessage
    ? { state: formStatus, text: formMessage }
    : showStatusToast && statusMessage
      ? { state: (status as MessageState) || "info", text: statusMessage }
      : null;

  function dismissToast() {
    setFormMessage("");
    setDismissedStatusKey(statusKey);
  }

  // Auto-dismiss the popup after a few seconds so it behaves like a transient hint.
  const activeToastText = activeToast?.text;
  useEffect(() => {
    if (!activeToastText) {
      return;
    }

    const timer = window.setTimeout(() => {
      setFormMessage("");
      setDismissedStatusKey(statusKey);
    }, 8000);

    return () => window.clearTimeout(timer);
  }, [activeToastText, statusKey]);

  useEffect(() => {
    document.body.classList.add("is-page-entering");
    const timer = window.setTimeout(() => {
      document.body.classList.remove("is-page-entering");
    }, 240);

    return () => {
      window.clearTimeout(timer);
      document.body.classList.remove("is-page-entering", "is-page-leaving");
    };
  }, []);

  function switchMode() {
    if (isAnimating) {
      return;
    }

    const nextMode = isSignUp ? "signin" : "signup";
    setIsAnimating(true);
    setMode(nextMode);
    window.setTimeout(() => setIsAnimating(false), 800);
  }

  async function submitEmailForm(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormMessage("");
    setFormStatus("info");

    const formData = new FormData(event.currentTarget);
    const email = String(formData.get("email") || "").trim();
    const password = String(formData.get("password") || "");
    const fullName = String(formData.get("fullName") || "").trim();

    if (!email || !password) {
      setFormStatus("error");
      setFormMessage("Email and password are required.");
      return;
    }

    if (password.length < MIN_PASSWORD_LENGTH) {
      setFormStatus("error");
      setFormMessage(
        `Password must be at least ${MIN_PASSWORD_LENGTH} characters long.`,
      );
      return;
    }

    setSubmitting(true);

    try {
      const supabase = createSupabaseBrowserClient();

      if (isSignUp) {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              full_name: fullName || email.split("@")[0],
            },
            emailRedirectTo: `${window.location.origin}/auth/callback?next=/profile`,
          },
        });

        if (error) {
          throw error;
        }

        if (data.session) {
          router.push("/profile");
          router.refresh();
          return;
        }

        if (data.user?.identities?.length === 0) {
          setFormStatus("error");
          setFormMessage(
            "This email is already registered. Try signing in instead.",
          );
          return;
        }

        setFormStatus("success");
        setFormMessage(
          "Account created. Check your email to confirm your account before signing in.",
        );
        return;
      }

      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        throw error;
      }

      router.push("/profile");
      router.refresh();
    } catch (error) {
      setFormStatus("error");
      setFormMessage(
        friendlyAuthError(error, "Authentication failed. Please try again."),
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function handleForgotPassword(
    event: React.MouseEvent<HTMLButtonElement>,
  ) {
    setFormMessage("");
    setFormStatus("info");

    const form = event.currentTarget.form;
    const email = String(
      (form ? new FormData(form) : new FormData()).get("email") || "",
    ).trim();

    if (!email) {
      setFormStatus("error");
      setFormMessage(
        "Enter your email address first, then click “Forgot your password?” again.",
      );
      return;
    }

    setSubmitting(true);

    try {
      const supabase = createSupabaseBrowserClient();
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/callback?next=/auth/reset-password`,
      });

      if (error) {
        throw error;
      }

      setFormStatus("success");
      setFormMessage(
        "Password reset email sent. Open the link in it to choose a new password.",
      );
    } catch (error) {
      setFormStatus("error");
      setFormMessage(
        friendlyAuthError(
          error,
          "Could not send the reset email. Please try again.",
        ),
      );
    } finally {
      setSubmitting(false);
    }
  }

  function startGoogleLogin() {
    setFormMessage("");
    setSubmitting(true);
    window.location.href = "/auth/google/start";
  }

  return (
    <main className={`auth-page ${isSignUp ? "is-signup" : ""}`}>
      {activeToast ? (
        <div
          className="auth-toast"
          data-state={activeToast.state}
          role="status"
          aria-live="polite"
        >
          <p>{activeToast.text}</p>
          <button
            aria-label="Dismiss message"
            className="toast-close"
            onClick={dismissToast}
            type="button"
          >
            ×
          </button>
        </div>
      ) : null}
      <section
        className={`auth-card ${
          isAnimating ? `is-fading ${isSignUp ? "to-signup" : "to-signin"}` : ""
        }`}
      >
        <section className="form-side" aria-live="polite">
          <div className="form-content">
            <Link
              aria-label="Back to Peerly home"
              className="brand"
              href="/"
              title="Go to home"
            >
              <span className="mark" aria-hidden="true">
                <Image
                  alt=""
                  height={24}
                  src="/Images/Peerly_Logo_Icon.svg"
                  width={24}
                />
              </span>
              <span className="name">Peerly</span>
            </Link>

            <h1>{isSignUp ? "Create Account" : "Sign In"}</h1>
            {!isSignUp ? (
              <p className="hint">Use your account or continue with Google.</p>
            ) : null}

            <div className="social-row" aria-label="Social providers">
              <button
                className="social"
                disabled
                title="Facebook is not available yet"
                type="button"
              >
                f
              </button>
              <button
                className="social"
                disabled={submitting}
                onClick={startGoogleLogin}
                title="Continue with Google"
                type="button"
              >
                <Image
                  alt=""
                  className="social-icon"
                  height={22}
                  src="/Images/google.png"
                  width={22}
                />
              </button>
              <button
                className="social"
                disabled
                title="LinkedIn is not available yet"
                type="button"
              >
                <Image
                  alt=""
                  className="social-icon"
                  height={22}
                  src="/Images/LinkedIn_Logo.svg"
                  width={22}
                />
              </button>
            </div>

            <p className="subline">
              {isSignUp
                ? "or create an account with email"
                : "or use your email account"}
            </p>

            <form onSubmit={submitEmailForm} noValidate>
              {isSignUp ? (
                <div className="field">
                  <label htmlFor="fullName">Full Name</label>
                  <input
                    autoComplete="name"
                    id="fullName"
                    name="fullName"
                    placeholder="Full Name"
                    type="text"
                  />
                </div>
              ) : null}

              <div className="field">
                <label htmlFor="email">Email Address</label>
                <input
                  autoComplete="email"
                  id="email"
                  name="email"
                  placeholder="you@example.com"
                  required
                  type="email"
                />
              </div>

              <div className="field">
                <label htmlFor="password">Password</label>
                <input
                  autoComplete={isSignUp ? "new-password" : "current-password"}
                  id="password"
                  minLength={MIN_PASSWORD_LENGTH}
                  name="password"
                  placeholder="Enter your password"
                  required
                  type="password"
                />
              </div>

              {!isSignUp ? (
                <button
                  className="text-link"
                  disabled={submitting}
                  onClick={handleForgotPassword}
                  type="button"
                >
                  Forgot your password?
                </button>
              ) : null}

              <div className="actions">
                <button
                  className="btn-primary"
                  disabled={submitting}
                  type="submit"
                >
                  {submitting
                    ? "Please wait..."
                    : isSignUp
                      ? "Sign Up"
                      : "Sign In"}
                </button>
              </div>
            </form>
          </div>
        </section>

        <aside className="promo-side">
          <div className="promo-content">
            <h2>{isSignUp ? "Welcome Back!" : "Hey There!"}</h2>
            <p>
              {isSignUp
                ? "To stay connected, sign in with your personal details."
                : "Begin your learning journey by creating an account with Peerly today."}
            </p>
            <button className="btn-outline" onClick={switchMode} type="button">
              {isSignUp ? "Sign In" : "Sign Up"}
            </button>
          </div>
        </aside>
      </section>
    </main>
  );
}
