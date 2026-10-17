/** Browser-only leases: nested panels share one scroll lock and one Back handler. */
type Panel = { node: HTMLDialogElement; dismiss: () => void };
const panels: Panel[] = [];
let previousOverflow = "";
let pendingBacks = 0;
function back() {
  if (pendingBacks) {
    pendingBacks--;
    if (!panels.length && !pendingBacks)
      window.removeEventListener("popstate", back);
    return;
  }
  panels.at(-1)?.dismiss();
}
export function topModal() {
  return panels.at(-1)?.node;
}
export function registerModal(
  node: HTMLDialogElement,
  dismiss: () => void,
  historyEntry = false,
) {
  if (!panels.length) {
    previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("popstate", back);
  }
  const panel = { node, dismiss };
  panels.push(panel);
  const historyKey = historyEntry ? crypto.randomUUID() : null;
  if (historyKey)
    window.history.pushState(
      { ...window.history.state, dockedModal: historyKey },
      "",
      window.location.href,
    );
  let released = false;
  return () => {
    if (released) return;
    released = true;
    const index = panels.indexOf(panel);
    if (index >= 0) panels.splice(index, 1);
    // Browser Back already consumed our entry. Explicit close/native Back
    // consumes it here without letting the resulting popstate close a parent.
    if (historyKey && window.history.state?.dockedModal === historyKey) {
      pendingBacks++;
      window.history.back();
    }
    if (!panels.length) {
      document.body.style.overflow = previousOverflow;
      if (!pendingBacks) window.removeEventListener("popstate", back);
    }
  };
}
