import { createRoot } from "react-dom/client";
import { NotificationCentre } from "../../src/components/notification-centre";

createRoot(document.getElementById("fixture-root")!).render(
  <NotificationCentre
    data={{
      status: "unavailable",
      message: "Your notifications could not be loaded.",
      viewer: null,
      items: [],
      unread: 0,
      preferences: null,
    }}
  />,
);
