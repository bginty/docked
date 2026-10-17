"use client";
import { useEffect, useRef, type ReactNode } from "react";
import { registerModal, topModal } from "@/core/modal-lifecycle";
export function FantasySheet({
  title,
  onClose,
  children,
  className = "",
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  className?: string;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const close = useRef(onClose);
  useEffect(() => {
    close.current = onClose;
  }, [onClose]);
  useEffect(() => {
    const node = dialog.current,
      active = document.activeElement as HTMLElement | null;
    if (!node) return;
    node.showModal();
    const release = registerModal(node, () => close.current());
    node.addEventListener("close", release);
    const containFocus = (event: KeyboardEvent) => {
      if (event.key !== "Tab" || topModal() !== node) return;
      const targets = [
        ...node.querySelectorAll<HTMLElement>(
          'button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), summary, [tabindex="0"]',
        ),
      ].filter(
        (el) => el.getClientRects().length > 0 && !el.closest("[inert]"),
      );
      const first = targets[0],
        last = targets.at(-1);
      if (!first) {
        event.preventDefault();
        node.focus();
        return;
      }
      if (
        event.shiftKey &&
        (document.activeElement === first ||
          !node.contains(document.activeElement))
      ) {
        event.preventDefault();
        last?.focus();
      } else if (
        !event.shiftKey &&
        (document.activeElement === last ||
          !node.contains(document.activeElement))
      ) {
        event.preventDefault();
        first.focus();
      }
    };
    node?.addEventListener("keydown", containFocus);
    return () => {
      node?.removeEventListener("keydown", containFocus);
      node.removeEventListener("close", release);
      node?.close();
      release();
      if (active?.isConnected && (!topModal() || topModal()?.contains(active)))
        active.focus({ preventScroll: true });
    };
  }, []);
  return (
    <dialog
      ref={dialog}
      className={`fantasy-sheet ${className}`}
      aria-label={title}
      onCancel={(e) => {
        e.preventDefault();
        // React propagates cancel through the component tree even though the
        // native dialog event does not bubble. Close only the active sheet.
        e.stopPropagation();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="sheet-inner">
        <header>
          <h2>{title}</h2>
          <button type="button" onClick={onClose} aria-label="Close panel">
            ✕
          </button>
        </header>
        {children}
      </div>
    </dialog>
  );
}
