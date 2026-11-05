package au.com.docked.app;

/** Bounds provider diagnostic text before exposing it to an explicit caller.
 * Query evidence is not a receipt, account or general-purpose telemetry channel. */
final class BillingDiagnosticsText {
    private BillingDiagnosticsText() {}

    static String safeDebugMessage(String message) {
        if (message == null) return "";
        // Do not try to parse credential-bearing strings or keep partial values.
        if (java.util.regex.Pattern.compile("(?i)\\b(?:purchaseToken|offerToken|token|authorization|password|accountBinding|bearer)\\b").matcher(message).find())
            return "[REDACTED_PROVIDER_MESSAGE]";
        String safe = message.substring(0, Math.min(message.length(), 2048))
            .replaceAll("(?i)(?:https?://|mailto:)[^\\s]+", "[REDACTED]")
            .replaceAll("(?i)[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9.-]+\\.[a-z]{2,}", "[REDACTED]")
            .replaceAll("[A-Za-z0-9_./+=:-]{32,}", "[REDACTED]")
            .replaceAll("[\\p{Cntrl}\\p{Cf}]+", " ");
        return safe.substring(0, Math.min(safe.length(), 256));
    }

    static String unfetchedStatus(int status) {
        switch (status) {
            case 0: return "UNKNOWN";
            case 2: return "INVALID_PRODUCT_ID_FORMAT";
            case 3: return "PRODUCT_NOT_FOUND";
            case 4: return "NO_ELIGIBLE_OFFER";
            default: return "UNRECOGNISED_STATUS";
        }
    }
}
