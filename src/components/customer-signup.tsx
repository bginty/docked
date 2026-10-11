"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AppAuthField } from "./app-auth-forms";
export function CustomerSignup() {
  const router = useRouter();
  const submitting = useRef(false);
  const [busy, setBusy] = useState(false),
    [linkReady, setLinkReady] = useState(false),
    [error, setError] = useState("");
  useEffect(() => {
    const token = new URLSearchParams(window.location.hash.slice(1)).get(
      "invite",
    );
    if (!token) {
      setLinkReady(true);
      return;
    }
    window.history.replaceState(null, "", window.location.pathname);
    fetch("/api/auth/customer-invitation", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    })
      .then(async (r) => {
        if (!r.ok) throw Error();
        setLinkReady(true);
      })
      .catch(() =>
        setError(
          "Your invitation could not be opened. Reopen the link when you’re connected.",
        ),
      );
  }, []);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (submitting.current || !linkReady) return;
    const form = new FormData(e.currentTarget);
    if (form.get("password") !== form.get("confirm")) {
      setError("Passwords do not match.");
      return;
    }
    submitting.current = true;
    setBusy(true);
    setError("");
    try {
      const r = await fetch("/api/auth/customer-signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: form.get("email"),
          password: form.get("password"),
        }),
      });
      const v = await r.json();
      if (!r.ok) throw Error(v.error);
      router.replace(v.redirect);
      router.refresh();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Connection interrupted. Please try again.",
      );
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  }
  return (
    <>
      <p className="app-auth-hint">
        Welcome to Docked. Use your invited email and choose your own password.
        We’ll verify your email before you choose your display name and open
        your free NFL pack.
      </p>
      <form className="app-auth-form" onSubmit={submit}>
        <AppAuthField
          label="Invited email"
          name="email"
          type="email"
          required
          autoComplete="email"
          maxLength={254}
        />
        <AppAuthField
          label="Choose a password"
          name="password"
          type="password"
          required
          minLength={12}
          maxLength={128}
          autoComplete="new-password"
        />
        <p className="app-auth-hint">Use at least 12 characters.</p>
        <AppAuthField
          label="Confirm password"
          name="confirm"
          type="password"
          required
          minLength={12}
          maxLength={128}
          autoComplete="new-password"
        />
        <button
          className="button app-auth-submit"
          disabled={busy || !linkReady}
        >
          {busy ? "Creating your account…" : "Create account"}
        </button>
        <p role="status" aria-live="polite">
          {error}
        </p>
      </form>
      <p className="app-auth-hint">
        Invite-only · Australian adults 18+ · Free test cards, no cash value.
        NFL available; EPL coming later. Scores are post-game and may remain
        pending.
      </p>
      <p className="app-auth-switch">
        Already joined? <Link href="/app/login">Sign in</Link>
      </p>
    </>
  );
}
