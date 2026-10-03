"use client";
import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";
export function ApiForm({
  endpoint,
  action,
  children,
  submit = "Save",
  disabled = false,
  defaults = {},
}: {
  endpoint: string;
  action: string;
  children: ReactNode;
  submit?: string;
  disabled?: boolean;
  defaults?: Record<string, unknown>;
}) {
  const [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false),
    [ready, setReady] = useState(false);
  const router = useRouter();
  // Server-rendered forms stay inert until their JSON submission handler is ready.
  useEffect(() => setReady(true), []);
  async function send(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!ready || disabled || busy) return;
    setBusy(true);
    const form = e.currentTarget;
    const data = new FormData(form);
    const body: Record<string, unknown> = {
      ...defaults,
      ...Object.fromEntries(data),
      action,
    };
    if (
      endpoint === "/api/auth" &&
      document.documentElement.classList.contains("docked-native")
    )
      body.app = true;
    form
      .querySelectorAll<HTMLInputElement>("input[type=checkbox]")
      .forEach((x) => {
        body[x.name] = x.checked;
      });
    for (const k of ["sports", "leagues", "bookmakers"])
      if (typeof body[k] === "string")
        body[k] = (body[k] as string)
          .split(",")
          .map((x) => x.trim())
          .filter(Boolean);
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const result = await response.json();
      setMessage(
        result.error ??
          result.message ??
          (result.secret
            ? `Authenticator secret: ${result.secret}. Factor ID: ${result.factorId}`
            : "Saved."),
      );
      if (result.redirect) router.push(result.redirect);
      else if (result.ok) router.refresh();
    } catch {
      setMessage("Service unavailable. Your request has not been confirmed.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <form
      onSubmit={send}
      method="post"
      action={endpoint}
      data-api-ready={ready ? "true" : "false"}
      className="form-stack"
    >
      {children}
      <button className="button" disabled={!ready || disabled || busy}>
        {busy ? "Working…" : submit}
      </button>
      <noscript>Enable JavaScript to submit this form securely.</noscript>
      <p role="status" className="form-message">
        {message}
      </p>
    </form>
  );
}
export function Field({
  label,
  name,
  type = "text",
  required = false,
  value,
  placeholder,
}: {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
  value?: string;
  placeholder?: string;
}) {
  return (
    <label>
      {label}
      <input
        name={name}
        type={type}
        required={required}
        defaultValue={value}
        placeholder={placeholder}
        minLength={type === "password" ? 12 : undefined}
        autoComplete={
          type === "password"
            ? "current-password"
            : type === "email"
              ? "email"
              : undefined
        }
      />
    </label>
  );
}
export function Check({
  name,
  children,
  required = false,
  checked = false,
}: {
  name: string;
  children: ReactNode;
  required?: boolean;
  checked?: boolean;
}) {
  return (
    <label className="check">
      <input
        name={name}
        type="checkbox"
        required={required}
        defaultChecked={checked}
      />
      <span>{children}</span>
    </label>
  );
}
