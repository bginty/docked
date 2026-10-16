import { createRoot } from "react-dom/client";
import { AdminAnnouncementDraft } from "../../src/components/admin-announcement-draft";
createRoot(document.getElementById("root")!).render(
  <div className="admin-reference" style={{ paddingLeft: 0 }}>
    <main className="admin-workspace">
      <p>Isolated synthetic announcement acceptance fixture</p>
      <AdminAnnouncementDraft />
    </main>
  </div>,
);
