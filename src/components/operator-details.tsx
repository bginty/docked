import { operatorPresentation } from "@/core/operator-presentation";

export function OperatorDetails() {
  const facts = operatorPresentation();
  return (
    <section aria-label="Operator and support">
      <h2>Operator and support</h2>
      <p>
        {facts.legalName ??
          "The operating entity for the research service has not yet been confirmed."}
        {facts.abn ? ` · ABN ${facts.abn}` : ""}
      </p>
      {facts.supportEmail || facts.supportUrl ? (
        <p>
          {facts.supportEmail && (
            <a href={`mailto:${facts.supportEmail}`}>{facts.supportEmail}</a>
          )}
          {facts.supportEmail && facts.supportUrl && " · "}
          {facts.supportUrl && <a href={facts.supportUrl}>Contact support</a>}
        </p>
      ) : (
        <p>A public support contact has not yet been confirmed.</p>
      )}
    </section>
  );
}
