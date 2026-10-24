/** Customer operations only. Historical trade engines and audit records remain intact. */
export function assertCreditSalesOnly(command: {
  kind: string;
  preference?: string;
}) {
  if (
    [
      "offer",
      "accept",
      "private-offer",
      "private-accept",
      "replace-listing",
    ].includes(command.kind) ||
    (command.kind === "list" &&
      command.preference !== undefined &&
      command.preference !== "sell")
  )
    throw Error("Only fixed-price marketplace sales are supported.");
}
