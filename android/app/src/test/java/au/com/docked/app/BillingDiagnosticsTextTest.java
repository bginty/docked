package au.com.docked.app;

import org.junit.Test;
import static org.junit.Assert.*;

public class BillingDiagnosticsTextTest {
    @Test public void retainsUsefulProviderReasonAndProductId() {
        String reason = "Product docked_credits_4900_v1 has no eligible offer.";
        assertEquals(reason, BillingDiagnosticsText.safeDebugMessage(reason));
        assertEquals("", BillingDiagnosticsText.safeDebugMessage(null));
        assertEquals("NO_ELIGIBLE_OFFER", BillingDiagnosticsText.unfetchedStatus(4));
        assertEquals("UNRECOGNISED_STATUS", BillingDiagnosticsText.unfetchedStatus(99));
    }

    @Test public void redactsCredentialsAddressesUrlsAndOpaqueValues() {
        String reason = "token=short-secret offerToken=\"sensitive offer\" accountBinding=abc "
            + "password='secret password' customer@example.test https://example.test/?secret=value "
            + "abc123_abcdefghijklmnopqrstuvwxyz0123456789";
        String safe = BillingDiagnosticsText.safeDebugMessage(reason);
        for (String secret : new String[]{"short-secret", "sensitive offer", "accountBinding", "secret password", "customer@", "https://", "abc123_"})
            assertFalse(secret, safe.contains(secret));
        assertEquals("[REDACTED_PROVIDER_MESSAGE]", BillingDiagnosticsText.safeDebugMessage("{\"purchaseToken\":\"short-secret\"}"));
        String contact = BillingDiagnosticsText.safeDebugMessage("customer@example.test https://example.test/?secret=value abc123_abcdefghijklmnopqrstuvwxyz0123456789");
        assertFalse(contact.contains("customer@"));
        assertFalse(contact.contains("https://"));
        assertFalse(contact.contains("abc123_"));
    }

    @Test public void boundsAndRemovesControlCharacters() {
        String safe = BillingDiagnosticsText.safeDebugMessage("Unavailable\n\u202E product " + "x ".repeat(2048));
        assertTrue(safe.length() <= 256);
        assertFalse(safe.contains("\n"));
        assertFalse(safe.contains("\u202E"));
        assertTrue(safe.startsWith("Unavailable"));
    }
}
