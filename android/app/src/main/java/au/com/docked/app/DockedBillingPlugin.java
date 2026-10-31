package au.com.docked.app;

import com.getcapacitor.*;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.android.billingclient.api.*;
import java.util.*;

/** Native receipt transport only. No balances/credits are accepted from JS.
 * The reviewed product allowlist is empty until classification and products are approved. */
@CapacitorPlugin(name = "DockedBilling")
public class DockedBillingPlugin extends Plugin implements PurchasesUpdatedListener {
    private BillingClient billing;
    private final Set<String> approvedProducts = Collections.emptySet();
    private final Map<String, ProductDetails> details = new HashMap<>();
    @Override public void load() {
        billing = BillingClient.newBuilder(getContext()).setListener(this)
            .enablePendingPurchases(PendingPurchasesParams.newBuilder().enableOneTimeProducts().build())
            .enableAutoServiceReconnection().build();
    }
    @PluginMethod public void capabilities(PluginCall call) {
        JSObject result = new JSObject(); result.put("enabled", !approvedProducts.isEmpty());
        result.put("products", new JSArray(new ArrayList<>(approvedProducts))); call.resolve(result);
    }
    private void connect(PluginCall call, Runnable action) {
        if (approvedProducts.isEmpty()) { call.reject("Store purchases are not enabled.", "BILLING_DISABLED"); return; }
        if (billing.isReady()) { action.run(); return; }
        billing.startConnection(new BillingClientStateListener() {
            @Override public void onBillingSetupFinished(BillingResult result) {
                if (result.getResponseCode() == BillingClient.BillingResponseCode.OK) action.run();
                else call.reject("Google Play is unavailable. Please retry.", "STORE_UNAVAILABLE");
            }
            @Override public void onBillingServiceDisconnected() { /* Automatic reconnection on next call. */ }
        });
    }
    @PluginMethod public void products(PluginCall call) {
        connect(call, () -> {
            List<QueryProductDetailsParams.Product> products = new ArrayList<>();
            for (String id : approvedProducts) products.add(QueryProductDetailsParams.Product.newBuilder()
                .setProductId(id).setProductType(BillingClient.ProductType.INAPP).build());
            billing.queryProductDetailsAsync(QueryProductDetailsParams.newBuilder().setProductList(products).build(), (result, found) -> {
                if (result.getResponseCode() != BillingClient.BillingResponseCode.OK) { call.reject("Products unavailable."); return; }
                JSArray rows = new JSArray(); details.clear();
                for (ProductDetails item : found.getProductDetailsList()) {
                    if (!approvedProducts.contains(item.getProductId())) continue;
                    details.put(item.getProductId(), item);
                    JSObject row = new JSObject(); row.put("id", item.getProductId()); row.put("name", item.getName());
                    JSArray offers = new JSArray();
                    if (item.getOneTimePurchaseOfferDetailsList() != null)
                        for (ProductDetails.OneTimePurchaseOfferDetails offer : item.getOneTimePurchaseOfferDetailsList()) {
                            JSObject o = new JSObject(); o.put("token", offer.getOfferToken());
                            o.put("price", offer.getFormattedPrice()); o.put("currency", offer.getPriceCurrencyCode()); offers.put(o);
                        }
                    row.put("offers", offers); rows.put(row);
                }
                JSObject response = new JSObject(); response.put("products", rows); call.resolve(response);
            });
        });
    }
    @PluginMethod public void purchase(PluginCall call) {
        String id = call.getString("productId"), account = call.getString("accountBinding"), offerToken = call.getString("offerToken");
        if (!approvedProducts.contains(id) || account == null || !account.matches("[a-f0-9]{64}")) {
            call.reject("Purchase is not approved.", "BILLING_DISABLED"); return;
        }
        connect(call, () -> {
            ProductDetails item = details.get(id);
            if (item == null || item.getOneTimePurchaseOfferDetailsList() == null ||
                item.getOneTimePurchaseOfferDetailsList().stream().noneMatch(o -> o.getOfferToken().equals(offerToken))) {
                call.reject("Refresh the current store price before confirming."); return;
            }
            getActivity().runOnUiThread(() -> {
                BillingFlowParams.ProductDetailsParams product = BillingFlowParams.ProductDetailsParams.newBuilder()
                    .setProductDetails(item).setOfferToken(offerToken).build();
                BillingResult result = billing.launchBillingFlow(getActivity(), BillingFlowParams.newBuilder()
                    .setProductDetailsParamsList(Collections.singletonList(product)).setObfuscatedAccountId(account).build());
                if (result.getResponseCode() != BillingClient.BillingResponseCode.OK) call.reject("Purchase could not start.");
                else { JSObject r = new JSObject(); r.put("started", true); call.resolve(r); }
            });
        });
    }
    @PluginMethod public void reconcile(PluginCall call) {
        connect(call, () -> billing.queryPurchasesAsync(QueryPurchasesParams.newBuilder().setProductType(BillingClient.ProductType.INAPP).build(),
            (result, purchases) -> { if (result.getResponseCode() != BillingClient.BillingResponseCode.OK) { call.reject("Reconciliation unavailable."); return; }
                JSObject r = new JSObject(); r.put("purchases", receipts(purchases)); call.resolve(r); }));
    }
    private JSArray receipts(List<Purchase> purchases) {
        JSArray result = new JSArray();
        for (Purchase purchase : purchases) {
            if (!approvedProducts.containsAll(purchase.getProducts()) || purchase.getProducts().isEmpty()) continue;
            JSObject r = new JSObject(); r.put("token", purchase.getPurchaseToken());
            r.put("state", purchase.getPurchaseState()); r.put("products", new JSArray(purchase.getProducts())); result.put(r);
        }
        return result;
    }
    @Override public void onPurchasesUpdated(BillingResult result, List<Purchase> purchases) {
        JSObject event = new JSObject(); event.put("responseCode", result.getResponseCode());
        event.put("purchases", purchases == null ? new JSArray() : receipts(purchases));
        notifyListeners("purchasesUpdated", event, true);
    }
    @Override protected void handleOnDestroy() { if (billing != null) billing.endConnection(); }
}
