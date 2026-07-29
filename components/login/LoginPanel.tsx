"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

type AuthMode = "signin" | "signup";
type MessageState = "success" | "error" | "info";
type FieldTarget = "email" | "password" | "form";
type Feedback = Partial<
  Record<FieldTarget, { state: MessageState; text: string }>
>;

const MIN_PASSWORD_LENGTH = 6;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Decide which field an auth/reset error should sit under.
function authErrorTarget(text: string): FieldTarget {
  if (text.includes("Incorrect email or password")) {
    return "password";
  }
  if (text.includes("confirm your email")) {
    return "email";
  }
  return "form";
}

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
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<Feedback>({});

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

  // A URL status (e.g. Google OAuth errors) shows as a form-level message unless
  // a field-specific message from the current submit takes its place.
  const active: Feedback = {
    ...(statusMessage
      ? { form: { state: (status as MessageState) || "info", text: statusMessage } }
      : {}),
    ...feedback,
  };

  function fieldMessage(target: FieldTarget) {
    const msg = active[target];
    if (!msg) {
      return null;
    }

    return (
      <p className="field-message" data-state={msg.state} role="status">
        {msg.text}
      </p>
    );
  }

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
    setFeedback({});

    const formData = new FormData(event.currentTarget);
    const email = String(formData.get("email") || "").trim();
    const password = String(formData.get("password") || "");
    const fullName = String(formData.get("fullName") || "").trim();

    const validation: Feedback = {};
    if (!email) {
      validation.email = { state: "error", text: "Email is required." };
    } else if (!EMAIL_PATTERN.test(email)) {
      validation.email = {
        state: "error",
        text: "Enter a valid email address.",
      };
    }
    if (!password) {
      validation.password = { state: "error", text: "Password is required." };
    } else if (password.length < MIN_PASSWORD_LENGTH) {
      validation.password = {
        state: "error",
        text: `Password must be at least ${MIN_PASSWORD_LENGTH} characters long.`,
      };
    }

    if (validation.email || validation.password) {
      setFeedback(validation);
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
          setFeedback({
            email: {
              state: "error",
              text: "This email is already registered. Try signing in instead.",
            },
          });
          return;
        }

        setFeedback({
          email: {
            state: "success",
            text: "Account created. Check your email to confirm your account before signing in.",
          },
        });
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
      const text = friendlyAuthError(
        error,
        "Authentication failed. Please try again.",
      );
      setFeedback({ [authErrorTarget(text)]: { state: "error", text } });
    } finally {
      setSubmitting(false);
    }
  }

  async function handleForgotPassword(
    event: React.MouseEvent<HTMLButtonElement>,
  ) {
    setFeedback({});

    const form = event.currentTarget.form;
    const email = String(
      (form ? new FormData(form) : new FormData()).get("email") || "",
    ).trim();

    if (!email) {
      setFeedback({
        email: {
          state: "error",
          text: "Enter your email address first, then click “Forgot your password?” again.",
        },
      });
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

      setFeedback({
        email: {
          state: "success",
          text: "Password reset email sent. Open the link in it to choose a new password.",
        },
      });
    } catch (error) {
      const text = friendlyAuthError(
        error,
        "Could not send the reset email. Please try again.",
      );
      setFeedback({ [authErrorTarget(text)]: { state: "error", text } });
    } finally {
      setSubmitting(false);
    }
  }

  function startSsoLogin(provider: "google" | "github" | "discord") {
    setFeedback({});
    setSubmitting(true);
    window.location.href = `/auth/sso/start?provider=${provider}`;
  }

  return (
    <main className={`auth-page ${isSignUp ? "is-signup" : ""}`}>
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
                disabled={submitting}
                onClick={() => startSsoLogin("google")}
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
                <span>Continue with Google</span>
              </button>
              <button
                className="social"
                disabled={submitting}
                onClick={() => startSsoLogin("github")}
                title="Continue with GitHub"
                type="button"
              >
                <Image
                  alt=""
                  className="social-icon"
                  height={22}
                  src="/Images/github.svg"
                  width={22}
                />
                <span>Continue with GitHub</span>
              </button>
              <button
                className="social"
                disabled={submitting}
                onClick={() => startSsoLogin("discord")}
                title="Continue with Discord"
                type="button"
              >
                <Image
                  alt=""
                  className="social-icon"
                  height={22}
                  src="/Images/discord.svg"
                  width={22}
                />
                <span>Continue with Discord</span>
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
                {fieldMessage("email")}
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
                {fieldMessage("password")}
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

              {fieldMessage("form")}

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
