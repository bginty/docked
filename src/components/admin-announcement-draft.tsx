"use client";
import { useState } from "react";
export function AdminAnnouncementDraft() {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [preview, setPreview] = useState(false);
  return (
    <section className="admin-workspace-panel">
      <h2>Announcement draft</h2>
      <p>Preview only · delivery is not activated</p>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          setPreview(true);
        }}
      >
        <label>
          Audience
          <select
            aria-label="Announcement audience"
            value="admitted"
            onChange={() => undefined}
          >
            <option value="admitted">
              Admitted Docked members · proposed audience
            </option>
          </select>
        </label>
        <label>
          Title
          <input
            required
            maxLength={120}
            value={title}
            onChange={(event) => {
              setTitle(event.target.value);
              setPreview(false);
            }}
          />
        </label>
        <label>
          Message
          <textarea
            required
            maxLength={3000}
            rows={5}
            value={body}
            onChange={(event) => {
              setBody(event.target.value);
              setPreview(false);
            }}
          />
        </label>
        <div className="actions">
          <button className="button" type="submit">
            Preview announcement
          </button>
          <button
            className="button ghost"
            type="button"
            onClick={() => {
              setTitle("");
              setBody("");
              setPreview(false);
            }}
          >
            Clear draft
          </button>
        </div>
      </form>
      {preview && (
        <article
          aria-label="Announcement preview"
          className="admin-announcement-preview"
        >
          <p>Draft · not sent or saved</p>
          <h3>{title}</h3>
          <p style={{ whiteSpace: "pre-wrap" }}>{body}</p>
        </article>
      )}
    </section>
  );
}
