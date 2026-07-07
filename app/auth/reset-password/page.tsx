"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

const MIN_PASSWORD_LENGTH = 6;

export default function ResetPasswordPage() {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState<"success" | "error" | "info">("info");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    setStatus("info");

    const formData = new FormData(event.currentTarget);
    const password = String(formData.get("password") || "");
    const confirmPassword = String(formData.get("confirmPassword") || "");

    if (password.length < MIN_PASSWORD_LENGTH) {
      setStatus("error");
      setMessage(
        `Password must be at least ${MIN_PASSWORD_LENGTH} characters long.`,
      );
      return;
    }

    if (password !== confirmPassword) {
      setStatus("error");
      setMessage("Passwords do not match.");
      return;
    }

    setSubmitting(true);

    try {
      const supabase = createSupabaseBrowserClient();
      const { error } = await supabase.auth.updateUser({ password });

      if (error) {
        throw error;
      }

      setStatus("success");
      setMessage("Password updated. Taking you to your profile...");
      router.push("/profile?status=success&message=Password%20updated.");
      router.refresh();
    } catch (error) {
      setStatus("error");
      setMessage(
        error instanceof Error
          ? `${error.message}. If your reset link has expired, request a new one from the sign-in page.`
          : "Could not update the password. Please try again.",
      );
      setSubmitting(false);
    }
  }

  return (
    <main className="profile-page">
      <section className="profile-shell">
        <div className="profile-hero profile-settings-hero">
          <div className="profile-hero-head">
            <Link className="profile-back" href="/login">
              Back to sign in
            </Link>
            <Link className="profile-back" href="/">
              Home
            </Link>
          </div>
          <div className="profile-intro">
            <span className="eyebrow">Account recovery</span>
            <h1>Choose a New Password</h1>
            <p>Set a new password for your Peerly account.</p>
          </div>
        </div>

        <section className="profile-card profile-settings-card">
          <form onSubmit={handleSubmit} className="profile-form">
            <div className="field">
              <label htmlFor="password">New password</label>
              <input
                autoComplete="new-password"
                id="password"
                minLength={MIN_PASSWORD_LENGTH}
                name="password"
                placeholder="Enter a new password"
                required
                type="password"
              />
            </div>

            <div className="field">
              <label htmlFor="confirmPassword">Confirm new password</label>
              <input
                autoComplete="new-password"
                id="confirmPassword"
                minLength={MIN_PASSWORD_LENGTH}
                name="confirmPassword"
                placeholder="Repeat the new password"
                required
                type="password"
              />
            </div>

            <div className="profile-actions">
              <button className="btn primary" disabled={submitting} type="submit">
                {submitting ? "Please wait..." : "Update password"}
              </button>
            </div>
          </form>

          {message ? (
            <p className="auth-status" data-state={status}>
              {message}
            </p>
          ) : null}
        </section>
      </section>
    </main>
  );
}
