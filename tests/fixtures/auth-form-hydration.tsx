import { hydrateRoot } from "react-dom/client";
import { AuthFormHydrationView } from "./auth-form-hydration-view";
hydrateRoot(
  document.getElementById("auth-form-fixture")!,
  <AuthFormHydrationView />,
);
