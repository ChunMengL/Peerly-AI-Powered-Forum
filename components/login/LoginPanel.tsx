"use client";

import Image from "next/image";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

type AuthMode = "signin" | "signup";

export function LoginPanel() {
  const searchParams = useSearchParams();
  const [mode, setMode] = useState<AuthMode>("signin");
  const [isAnimating, setIsAnimating] = useState(false);
  const [formMessage, setFormMessage] = useState("");

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

  function submitEmailForm(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormMessage(
      isSignUp
        ? "Sign-up form is ready, but backend registration is not connected yet."
        : "Email/password sign-in is not connected yet. Use Google for now.",
    );
  }

  function startGoogleLogin() {
    window.location.href = "/auth/google/start";
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
                disabled
                title="Facebook is not available yet"
                type="button"
              >
                f
              </button>
              <button
                className="social"
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
                ? "or sign up quickly using Google"
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
                  name="password"
                  placeholder="Enter your password"
                  required
                  type="password"
                />
              </div>

              {!isSignUp ? (
                <button className="text-link" type="button">
                  Forgot your password?
                </button>
              ) : null}

              <div className="actions">
                <button className="btn-primary" type="submit">
                  {isSignUp ? "Sign Up" : "Sign In"}
                </button>
              </div>
            </form>

            {statusMessage ? (
              <p className="auth-status" data-state={status || "info"}>
                {statusMessage}
              </p>
            ) : null}
            {formMessage ? (
              <p className="auth-status" data-state="info">
                {formMessage}
              </p>
            ) : null}
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
