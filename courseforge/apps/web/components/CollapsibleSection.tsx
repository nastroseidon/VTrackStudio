"use client";

import { useState, type ReactNode } from "react";

type CollapsibleSectionProps = {
  autoOpenKey?: string;
  children: ReactNode;
  className?: string;
  defaultOpen?: boolean;
  summary?: string;
  title: string;
};

export function CollapsibleSection({
  autoOpenKey,
  children,
  className = "",
  defaultOpen = false,
  summary,
  title
}: CollapsibleSectionProps) {
  const stateKey = autoOpenKey ?? "static";
  const [manualState, setManualState] = useState({
    key: stateKey,
    open: defaultOpen
  });
  const isOpen = manualState.key === stateKey ? manualState.open : defaultOpen;

  return (
    <section className={`collapsible-section ${className} ${isOpen ? "is-open" : ""}`}>
      <button
        aria-expanded={isOpen}
        className="collapsible-summary"
        onClick={() =>
          setManualState({
            key: stateKey,
            open: !isOpen
          })
        }
        type="button"
      >
        <span className="collapsible-caret" aria-hidden="true">
          v
        </span>
        <span className="collapsible-text">
          <span className="collapsible-title">{title}</span>
          {summary ? <span className="collapsible-subtitle">{summary}</span> : null}
        </span>
      </button>
      {isOpen ? <div className="collapsible-content">{children}</div> : null}
    </section>
  );
}
