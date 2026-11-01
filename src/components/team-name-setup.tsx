"use client";
import { useState } from "react";
/** One permanent, account-wide fantasy name, using the existing naming service. */
export function TeamNameSetup({
  name,
  busy,
  onSave,
  canChoose = true,
}: {
  name?: string | null;
  busy: boolean;
  canChoose?: boolean;
  onSave: (name: string) => Promise<boolean>;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState("");
  return (
    <div className="lineup-team-name">
      <small>Team name</small>
      <strong>{name || "Unnamed team"}</strong>
      {!name && canChoose && (
        <button
          className="play-support"
          aria-label="Choose team name"
          disabled={busy}
          onClick={() => setEditing(!editing)}
        >
          Choose name
        </button>
      )}
      {editing && !name && (
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            if (busy) return;
            if (await onSave(value.trim())) setEditing(false);
          }}
        >
          <label>
            Team name
            <input
              value={value}
              maxLength={40}
              minLength={2}
              onChange={(e) => setValue(e.target.value)}
              required
            />
          </label>
          <p className="small-note">
            Choose carefully. Your team name is permanent.
          </p>
          <button disabled={busy || value.trim().length < 2}>Save name</button>
        </form>
      )}
    </div>
  );
}
