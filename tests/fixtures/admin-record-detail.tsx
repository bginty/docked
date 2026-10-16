import { createRoot } from "react-dom/client";
import { AdminShell } from "../../src/components/admin-shell";
import { AdminRecordDetail } from "../../src/components/admin-record-detail";
import type { AdminRecord } from "../../src/core/admin-record";

const page = Number(
  new URLSearchParams(location.search).get("historyPage") ?? 1,
);
const record: AdminRecord = {
  id: "isolated-fixture-member-record",
  category: "members",
  title: "Isolated fixture member · long display name",
  source: "Synthetic browser fixture using the actual record component",
  fields: {
    "Record ID": "22222222-2222-4222-8222-222222222222",
    Handle: "long_member_handle_for_responsive_review",
    "Created at": "2026-10-01T00:00:00+00:00",
    "Account status": "Enabled",
    "Social status": "Restricted",
    "Admission status": "Accepted",
    "Assigned staff role": null,
  },
  history: [
    {
      id: String(page),
      at: "2026-10-02T00:00:00+00:00",
      event: page === 1 ? "Admission: accepted" : "Moderation: restrict",
      detail: "Recorded administrative transition",
    },
  ],
  page,
  hasMore: page === 1,
};
createRoot(document.getElementById("fixture-root")!).render(
  <AdminShell role="owner" displayName="Isolated QA" active="users">
    <section className="admin-workspace owner-command-page">
      <h1>Users</h1>
      <AdminRecordDetail record={record} />
    </section>
  </AdminShell>,
);
