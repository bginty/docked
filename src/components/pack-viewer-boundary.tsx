"use client";
import { Component, type ReactNode } from "react";
/** A failed effect chunk must not strand Cards or trigger another opening. */
export class PackViewerBoundary extends Component<
  { children: ReactNode; onClose: () => void },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? (
      <section className="fantasy-panel" role="alert">
        <h2>Pack viewer unavailable</h2>
        <p>
          Your confirmed cards remain saved. Close this view and refresh Cards
          to see your collection or resume the result.
        </p>
        <button onClick={this.props.onClose}>Back to Cards</button>
      </section>
    ) : (
      this.props.children
    );
  }
}
