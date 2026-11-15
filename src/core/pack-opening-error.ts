/** Only these reviewed messages may cross from a failed opening into the reveal UI.
 * Unknown server, database and network errors keep the generic recovery message. */
export const packOpeningMessages = {
  WEEKLY_POOL_UNAVAILABLE:
    "Your weekly pack is saved. Opening is temporarily unavailable for this card pool. Please try again later.",
  AUTH_REQUIRED: "Sign in again to open your saved pack.",
  MFA_REQUIRED: "Complete account verification to open your saved pack.",
} as const;

export type PackOpeningErrorCode = keyof typeof packOpeningMessages;

export class PackOpeningError extends Error {
  constructor(readonly code: PackOpeningErrorCode) {
    super(packOpeningMessages[code]);
  }
}

export function packOpeningError(code: unknown): PackOpeningError | null {
  return typeof code === "string" &&
    Object.prototype.hasOwnProperty.call(packOpeningMessages, code)
    ? new PackOpeningError(code as PackOpeningErrorCode)
    : null;
}
