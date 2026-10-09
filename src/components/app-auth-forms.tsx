"use client";
import Link from "next/link";
import {
  useEffect,
  useState,
  type FormEvent,
  type InputHTMLAttributes,
} from "react";
import { useRouter } from "next/navigation";
import { appSports } from "@/core/app-auth";
import { useEnvironmentPresentation } from "./environment-context";

export function AppAuthField({
  label,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  return (
    <label className="app-auth-field">
      <span>{label}</span>
      <input {...props} />
    </label>
  );
}

function Consent({
  name,
  children,
  required = false,
}: {
  name: string;
  children: React.ReactNode;
  required?: boolean;
}) {
  return (
    <label className="app-auth-check">
      <input type="checkbox" name={name} required={required} />
      <span>{children}</span>
    </label>
  );
}

export function AppAuthForm({
  mode,
}: {
  mode: "login" | "signup" | "recover" | "reset" | "resend" | "complete";
}) {
  const router = useRouter();
  const environment = useEnvironmentPresentation();
  const unavailable =
    environment.reviewOnly ||
    (environment.production &&
      (!environment.accountConfigured ||
        (mode === "signup" && !environment.registrationAvailable) ||
        (["recover", "resend", "complete"].includes(mode) &&
          !environment.emailAvailable)));
  const setup = mode === "signup" || mode === "complete";
  const [ready, setReady] = useState(false),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  const [invited, setInvited] = useState(false);
  useEffect(() => setReady(true), []);
  const password = ["login", "signup", "reset"].includes(mode);
  const label = {
    login: "Log in",
    signup: "Create account",
    recover: "Send reset link",
    reset: "Update password",
    resend: "Resend verification",
    complete: "Complete account setup",
  }[mode];
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!ready || busy || unavailable) return;
    const form = event.currentTarget;
    const data = new FormData(form);
    const body: Record<string, unknown> = {
      ...Object.fromEntries(data),
      action: mode,
      app: true,
    };
    for (const field of form.querySelectorAll<HTMLInputElement>(
      "input[type=checkbox]",
    ))
      body[field.name] = field.checked;
    if (
      (mode === "signup" || mode === "reset") &&
      body.password !== body.confirmPassword
    ) {
      setMessage("Passwords do not match.");
      form.querySelector<HTMLInputElement>("[name=confirmPassword]")?.focus();
      return;
    }
    if (!invited || !environment.invitationAllowed || environment.production)
      delete body.invitationCode;
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch(
        mode === "complete" ? "/api/auth/invitation-setup" : "/api/auth",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
      );
      const result = await response.json();
      if (!response.ok || result.error) {
        setMessage(
          result.error ??
            "We could not complete that request. Please try again.",
        );
        return;
      }
      if (result.redirect) {
        router.replace(result.redirect);
        router.refresh();
      } else if (["signup", "recover", "resend"].includes(mode))
        router.replace(
          `/app/check-email?type=${mode === "recover" ? "recovery" : "verification"}`,
        );
      else setMessage(result.message ?? "Saved.");
    } catch {
      setMessage("Docked cannot connect right now. Reconnect and try again.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <form
      className="app-auth-form"
      method="post"
      action={mode === "complete" ? "/api/auth/invitation-setup" : "/api/auth"}
      onSubmit={submit}
      data-api-ready={String(ready)}
    >
      {setup && (
        <AppAuthField
          label="Username"
          name="username"
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          minLength={3}
          maxLength={24}
          pattern="[A-Za-z][A-Za-z0-9_]{2,23}"
          title="3–24 letters, numbers or underscores; start with a letter"
          required
        />
      )}
      {mode !== "reset" && mode !== "complete" && (
        <AppAuthField
          label="Email"
          name="email"
          type="email"
          autoComplete={mode === "login" ? "username" : "email"}
          autoCapitalize="none"
          spellCheck={false}
          inputMode="email"
          maxLength={254}
          required
        />
      )}
      {password && (
        <AppAuthField
          label="Password"
          name="password"
          type="password"
          autoComplete={mode === "login" ? "current-password" : "new-password"}
          minLength={12}
          maxLength={128}
          required
        />
      )}
      {(mode === "signup" || mode === "reset") && (
        <>
          <p className="app-auth-hint">Use at least 12 characters.</p>
          <AppAuthField
            label="Confirm password"
            name="confirmPassword"
            type="password"
            autoComplete="new-password"
            minLength={12}
            maxLength={128}
            required
          />
        </>
      )}
      {setup && (
        <>
          {mode === "complete" && environment.liveBeta && (
            <>
              <AppAuthField
                label="Private beta admission code"
                name="betaAdmissionCode"
                type="password"
                autoComplete="off"
                pattern="[a-f0-9]{64}"
                minLength={64}
                maxLength={64}
                required
              />
              <Consent name="betaRules" required>
                I accept the{" "}
                <Link href="/beta-policies" target="_blank">
                  approved beta participation, community, fantasy, competition
                  and responsible gambling rules
                </Link>
                .
              </Consent>
            </>
          )}
          <div className="app-auth-region">
            <AppAuthField
              label="Country code"
              name="country"
              placeholder="AU"
              autoComplete="country"
              pattern="[A-Z]{2}"
              maxLength={2}
              required
            />
            <AppAuthField
              label="State / region"
              name="state"
              placeholder="VIC"
              autoComplete="address-level1"
              maxLength={50}
              required
            />
          </div>
          <Consent name="age" required>
            I am 18 or older and meet the legal age for my region.
          </Consent>
          <Consent name="terms" required>
            I accept the{" "}
            <Link
              href={environment.liveBeta ? "/beta-policies#terms" : "/terms"}
              target="_blank"
            >
              Terms
            </Link>
            .
          </Consent>
          <Consent name="privacy" required>
            I accept the{" "}
            <Link
              href={
                environment.liveBeta ? "/beta-policies#privacy" : "/privacy"
              }
              target="_blank"
            >
              Privacy Policy
            </Link>
            .
          </Consent>
          <Consent name="marketing">
            Optional: send me Docked marketing updates. I can unsubscribe.
          </Consent>
          {!environment.production && environment.invitationAllowed && (
            <label className="app-auth-check">
              <input
                type="checkbox"
                checked={invited}
                onChange={(e) => setInvited(e.target.checked)}
              />
              <span>I have a Preview invitation</span>
            </label>
          )}
          {!environment.production &&
            environment.invitationAllowed &&
            invited && (
              <>
                <AppAuthField
                  label="Private invitation code"
                  name="invitationCode"
                  autoComplete="off"
                  spellCheck={false}
                  autoCapitalize="none"
                  required
                />
                <p className="app-auth-hint">
                  Your invitation confirms test access, not email ownership. No
                  email is sent. Keep the code private.
                </p>
              </>
            )}
        </>
      )}
      {mode === "login" && (
        <Link className="app-auth-secondary" href="/app/forgot-password">
          Forgot password?
        </Link>
      )}
      {unavailable && (
        <p className="app-auth-hint" role="status">
          {mode === "signup"
            ? (environment.reason ?? "Public registration is not open yet.")
            : !environment.accountConfigured
              ? "Account services are unavailable."
              : "Account email is not enabled. No message will be sent."}
        </p>
      )}
      <button
        className="button app-auth-submit"
        disabled={!ready || busy || unavailable}
      >
        {busy ? "Please wait…" : label}
      </button>
      <p className="app-auth-message" role="status" aria-live="polite">
        {message}
      </p>
      <noscript>
        Enable JavaScript to securely use your Docked account.
      </noscript>
    </form>
  );
}

export type AppOnboardingPreferences = {
  sports: string[];
  interests: "edges" | "community" | "both";
  officialEdges: boolean;
  followedMembers: boolean;
  replies: boolean;
  timezone: string;
  country: string;
  state: string;
  username: string;
};
export function AppOnboardingForm({
  legalRequired,
  usernameRequired,
  minimumAge,
  preferences,
}: {
  legalRequired: boolean;
  usernameRequired: boolean;
  minimumAge: number | null;
  preferences: AppOnboardingPreferences;
}) {
  const router = useRouter();
  const {
    production,
    fantasyPreview: previewOnly,
    fantasyProduction,
  } = useEnvironmentPresentation();
  const fantasyPreview = previewOnly || fantasyProduction;
  const essentialsRequired = legalRequired || usernameRequired;
  const [step, setStep] = useState(essentialsRequired ? 0 : 1),
    [ready, setReady] = useState(false),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  const [username, setUsername] = useState(preferences.username);
  const [sports, setSports] = useState(preferences.sports),
    [interests, setInterests] = useState(preferences.interests);
  const [notices, setNotices] = useState({
    officialEdges: preferences.officialEdges,
    followedMembers: preferences.followedMembers,
    replies: preferences.replies,
  });
  const [legal, setLegal] = useState({
    country: preferences.country,
    state: preferences.state,
    age: false,
    terms: false,
    privacy: false,
  });
  useEffect(() => setReady(true), []);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!ready || busy) return;
    if (step < 3) {
      setStep(step + 1);
      return;
    }
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/member", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "app_onboarding",
          sports,
          interests,
          ...notices,
          timezone:
            Intl.DateTimeFormat().resolvedOptions().timeZone ||
            preferences.timezone,
          ...(usernameRequired ? { username } : {}),
          ...(legalRequired ? legal : {}),
        }),
      });
      const result = await response.json();
      if (!response.ok || result.error) {
        setMessage(result.error ?? "Unable to save your preferences.");
        return;
      }
      router.replace(fantasyPreview ? "/fantasy/play" : "/edges");
      router.refresh();
    } catch {
      setMessage(
        "Connection interrupted. Your preferences have not been confirmed. Please retry.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <form
      onSubmit={submit}
      className="app-auth-form app-onboarding"
      method="post"
      action="/api/member"
      data-api-ready={String(ready)}
    >
      <p className="app-auth-step">
        {step === 0 ? "Before you enter" : `Step ${step} of 3`}
      </p>
      <h1>
        {
          [
            "A few essentials",
            "Choose what you follow",
            "What interests you?",
            "Stay in the conversation",
          ][step]
        }
      </h1>
      {step === 0 && (
        <>
          {usernameRequired && (
            <AppAuthField
              label="Public username"
              name="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              autoCapitalize="none"
              spellCheck={false}
              minLength={3}
              maxLength={24}
              pattern="[A-Za-z][A-Za-z0-9_]{2,23}"
              title="3–24 letters, numbers or underscores; start with a letter"
              required
            />
          )}
          {legalRequired && (
            <>
              <p className="app-auth-hint">
                {production
                  ? "Your account does not grant access to features restricted in your region."
                  : "Preview access is for invited adults. It is not public regional approval."}
              </p>
              <AppAuthField
                label="Country code"
                value={legal.country}
                onChange={(e) =>
                  setLegal({ ...legal, country: e.target.value.toUpperCase() })
                }
                pattern="[A-Z]{2}"
                maxLength={2}
                autoComplete="country"
                required
              />
              <AppAuthField
                label="State / region"
                value={legal.state}
                onChange={(e) => setLegal({ ...legal, state: e.target.value })}
                maxLength={50}
                autoComplete="address-level1"
                required
              />
              {(
                [
                  [
                    "age",
                    `I am ${minimumAge ?? 18} or older and meet the legal age for my region.`,
                  ],
                  [
                    "terms",
                    <>
                      I accept the{" "}
                      <Link href="/terms" target="_blank">
                        Terms
                      </Link>
                      .
                    </>,
                  ],
                  [
                    "privacy",
                    <>
                      I accept the{" "}
                      <Link href="/privacy" target="_blank">
                        Privacy Policy
                      </Link>
                      .
                    </>,
                  ],
                ] as const
              ).map(([key, label]) => (
                <label key={key} className="app-auth-check">
                  <input
                    type="checkbox"
                    required
                    checked={legal[key]}
                    onChange={(e) =>
                      setLegal({ ...legal, [key]: e.target.checked })
                    }
                  />
                  <span>{label}</span>
                </label>
              ))}
            </>
          )}
        </>
      )}
      {step === 1 && (
        <>
          <p className="app-auth-hint">
            {fantasyPreview
              ? "Personalise your fantasy sports interests."
              : "Personalise your interests. Live Edge coverage is not yet enabled."}
          </p>
          <div className="app-sport-options">
            {appSports.map(([value, label]) => (
              <label
                key={value}
                className="app-choice"
                data-selected={sports.includes(value)}
              >
                <input
                  type="checkbox"
                  checked={sports.includes(value)}
                  onChange={(e) =>
                    setSports(
                      e.target.checked
                        ? [...sports, value]
                        : sports.filter((v) => v !== value),
                    )
                  }
                />
                <span>{label}</span>
              </label>
            ))}
          </div>
        </>
      )}
      {step === 2 && (
        <>
          <p className="app-auth-hint">
            You can explore everything. This only personalises your preferences.
          </p>
          {(
            [
              ["edges", "Docked Edges"],
              ["community", "Community"],
              ["both", "Both"],
            ] as const
          ).map(([value, label]) => (
            <label
              key={value}
              className="app-choice"
              data-selected={value === interests}
            >
              <input
                name="interests"
                type="radio"
                checked={value === interests}
                onChange={() => setInterests(value)}
              />
              <span>
                {fantasyPreview && value === "edges"
                  ? "Fantasy competitions"
                  : label}
              </span>
            </label>
          ))}
        </>
      )}
      {step === 3 && (
        <>
          <p className="app-auth-hint">
            Choose the updates you want. You can change these later.
          </p>
          {(
            [
              ["officialEdges", "Official Docked Edges"],
              ["followedMembers", "People I follow"],
              ["replies", "Replies & comments"],
            ] as const
          )
            .filter(([key]) => !fantasyPreview || key !== "officialEdges")
            .map(([key, label]) => (
              <label
                className="app-choice"
                key={key}
                data-selected={notices[key]}
              >
                <input
                  type="checkbox"
                  checked={notices[key]}
                  onChange={(e) =>
                    setNotices({ ...notices, [key]: e.target.checked })
                  }
                />
                <span>{label}</span>
              </label>
            ))}
          <p className="app-auth-hint">
            In-app preferences only. Android push is not configured, so no
            device permission is requested.
            {!fantasyPreview &&
              " Official Edge alerts remain off until validation."}
          </p>
        </>
      )}
      <div className="app-onboarding-actions">
        {step > (essentialsRequired ? 0 : 1) && (
          <button
            className="button ghost"
            type="button"
            onClick={() => setStep(step - 1)}
          >
            Back
          </button>
        )}
        <button className="button" disabled={!ready || busy}>
          {busy ? "Saving…" : step === 3 ? "Enter Docked" : "Continue"}
        </button>
      </div>
      {step > 0 && step < 3 && (
        <button
          className="app-auth-skip"
          type="button"
          onClick={() => setStep(step + 1)}
        >
          Skip this step
        </button>
      )}
      <p role="status" className="app-auth-message">
        {message}
      </p>
    </form>
  );
}
