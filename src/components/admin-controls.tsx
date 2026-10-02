import { ApiForm, Field, Check } from "./forms";
export function AdminControls() {
  return (
    <div className="admin-grid">
      <section className="card">
        <h2>Edit schedule</h2>
        <ApiForm endpoint="/api/admin" action="schedule">
          <Field label="Schedule key" name="id" required />
          <Field
            label="IANA timezone"
            name="zone"
            value="Australia/Melbourne"
            required
          />
          <Field label="Hour · 0–23" name="hour" type="number" required />
          <Field label="Minute · 0–59" name="minute" type="number" required />
          <Check name="enabled">Enabled</Check>
          <Field label="Reason" name="reason" required />
        </ApiForm>
      </section>
      <section className="card">
        <h2>Region / provider suspension</h2>
        <ApiForm
          endpoint="/api/admin"
          action="suspend_region"
          submit="Suspend region"
        >
          <Field label="Region policy ID" name="id" required />
          <Field label="Reason" name="reason" required />
        </ApiForm>
        <ApiForm
          endpoint="/api/admin"
          action="suspend_provider"
          submit="Suspend provider"
        >
          <Field label="Provider ID" name="id" value="the-odds-api" required />
          <Field label="Reason" name="reason" required />
        </ApiForm>
      </section>
      <section className="card">
        <h2>Strategy governance</h2>
        <p>
          Use the audited lifecycle to register, validate, freeze and review
          strategy versions.
        </p>
        <a className="button ghost" href="/admin/strategies">
          Open strategy lifecycle
        </a>
      </section>
      <section className="card">
        <h2>Append settlement correction</h2>
        <ApiForm
          endpoint="/api/admin"
          action="correction"
          submit="Append visible correction"
        >
          <Field label="Publication ID" name="id" required />
          <label>
            Replacement result
            <select name="result">
              <option>won</option>
              <option>lost</option>
              <option>void</option>
              <option>disputed</option>
            </select>
          </label>
          <Field label="Authorised source" name="source" required />
          <Field label="Source event ID" name="sourceEventId" required />
          <Field label="Source revision" name="revision" required />
          <Field label="Evidence reference" name="evidence" required />
          <Field label="Public correction reason" name="reason" required />
        </ApiForm>
      </section>
    </div>
  );
}
