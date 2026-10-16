/** Browser-only leases: nested panels share one scroll lock and one Back handler. */
type Panel = { node: HTMLDialogElement; dismiss: () => void };
const panels: Panel[] = [];
let previousOverflow = "";
function back() {
  panels.at(-1)?.dismiss();
}
export function topModal() {
  return panels.at(-1)?.node;
}
export function registerModal(node: HTMLDialogElement, dismiss: () => void) {
  if (!panels.length) {
    previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("popstate", back);
  }
  const panel = { node, dismiss };
  panels.push(panel);
  let released = false;
  return () => {
    if (released) return;
    released = true;
    const index = panels.indexOf(panel);
    if (index >= 0) panels.splice(index, 1);
    if (!panels.length) {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("popstate", back);
    }
  };
}
