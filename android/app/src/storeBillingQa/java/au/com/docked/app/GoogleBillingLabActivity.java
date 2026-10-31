package au.com.docked.app;

import android.app.Activity;
import android.app.AlertDialog;
import android.os.Bundle;
import android.graphics.Color;
import android.text.InputType;
import android.widget.*;
import com.android.billingclient.api.*;
import org.json.*;
import java.io.*;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.security.KeyStore;
import java.security.cert.CertificateFactory;
import java.util.*;
import java.util.concurrent.Executors;
import java.util.concurrent.ExecutorService;
import javax.net.ssl.*;

/** USB-paired internal QA only. Compiled exclusively into storeBillingQa.
 * No production wallet/API, no credential persistence, no arbitrary endpoints.
 * Google checkout must visibly identify a test instrument before confirmation. */
public class GoogleBillingLabActivity extends Activity implements PurchasesUpdatedListener {
    private final ExecutorService worker = Executors.newSingleThreadExecutor();
    private BillingClient billing;
    private SSLSocketFactory tls;
    private volatile String pairing = "", account = "", lastKey = "";
    private volatile long expiresAt;
    private TextView status;
    private EditText pairingInput;
    private LinearLayout productRows;
    private LinearLayout packRows;
    private String pendingPackRequest = "", pendingPackBody = "";
    private CheckBox testOnly;
    private volatile Map<String, Long> allowed = Collections.emptyMap();
    private volatile boolean busy;

    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        // Receipt tokens are never rendered. Mask pairing input and suppress recents.
        if (android.os.Build.VERSION.SDK_INT >= 33) setRecentsScreenshotEnabled(false);
        ScrollView scroll = new ScrollView(this);
        LinearLayout column = new LinearLayout(this); column.setOrientation(LinearLayout.VERTICAL);
        column.setPadding(28, 56, 28, 48); column.setBackgroundColor(Color.rgb(6, 15, 32)); scroll.addView(column); setContentView(scroll);
        TextView heading = text("Docked · Google Billing Test", 24); column.addView(heading);
        column.addView(text("Internal USB test only. Hosted isolated member wallet and synthetic cards; never your customer account. Use only Google's clearly labelled test payment methods. Cancel if a real payment method is shown.", 16));
        pairingInput = new EditText(this); pairingInput.setHint("Local lab pairing key"); pairingInput.setTextColor(Color.WHITE); pairingInput.setHintTextColor(Color.LTGRAY);
        pairingInput.setInputType(InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_VARIATION_PASSWORD);
        pairingInput.setImportantForAutofill(android.view.View.IMPORTANT_FOR_AUTOFILL_NO_EXCLUDE_DESCENDANTS); pairingInput.setSaveEnabled(false); column.addView(pairingInput);
        Button pair = button("Pair USB test lab"); column.addView(pair); pair.setOnClickListener(v -> pair());
        testOnly = new CheckBox(this); testOnly.setText("I am using the approved Google license tester and will confirm only a test payment."); testOnly.setTextColor(Color.WHITE); column.addView(testOnly);
        status = text("Not paired. Checkout disabled.", 16); column.addView(status);
        productRows = new LinearLayout(this); productRows.setOrientation(LinearLayout.VERTICAL); column.addView(productRows);
        Button reconcile = button("Reconcile test purchases"); column.addView(reconcile); reconcile.setOnClickListener(v -> reconcile());
        Button refund = button("Refund latest verified test receipt"); column.addView(refund); refund.setOnClickListener(v -> refund());
        packRows = new LinearLayout(this); packRows.setOrientation(LinearLayout.VERTICAL); column.addView(packRows);
        Button retryPack = button("Retry unconfirmed pack action"); column.addView(retryPack); retryPack.setOnClickListener(v -> submitPack());
        Button close = button("Return to Docked"); column.addView(close); close.setOnClickListener(v -> finish());
        try {
            KeyStore store = KeyStore.getInstance(KeyStore.getDefaultType()); store.load(null);
            try (InputStream cert = getResources().openRawResource(R.raw.google_lab_ca)) {
                store.setCertificateEntry("loopback-lab", CertificateFactory.getInstance("X.509").generateCertificate(cert));
            }
            TrustManagerFactory trust = TrustManagerFactory.getInstance(TrustManagerFactory.getDefaultAlgorithm()); trust.init(store);
            SSLContext context = SSLContext.getInstance("TLS"); context.init(null, trust.getTrustManagers(), null); tls = context.getSocketFactory();
        } catch (Exception e) { message("Local TLS trust unavailable. Checkout disabled."); }
        billing = BillingClient.newBuilder(this).setListener(this).enablePendingPurchases(PendingPurchasesParams.newBuilder().enableOneTimeProducts().build()).enableAutoServiceReconnection().build();
    }
    private TextView text(String value, int size) { TextView view = new TextView(this); view.setText(value); view.setTextSize(size); view.setTextColor(Color.WHITE); view.setPadding(0,12,0,12); return view; }
    private Button button(String title) { Button b = new Button(this); b.setText(title); b.setAllCaps(false); return b; }
    private void message(String value) { runOnUiThread(() -> status.setText(value)); }
    private boolean paired() { return tls != null && pairing.matches("[a-f0-9]{64}") && System.currentTimeMillis() < expiresAt && account.matches("[a-f0-9]{64}"); }
    private JSONObject request(String path, JSONObject body) throws Exception {
        HttpsURLConnection connection = (HttpsURLConnection) new URL("https://127.0.0.1:48591" + path).openConnection();
        connection.setSSLSocketFactory(tls); // Default hostname verifier remains enabled; certificate SAN is 127.0.0.1.
        connection.setInstanceFollowRedirects(false); connection.setConnectTimeout(8000); connection.setReadTimeout(45000);
        connection.setRequestProperty("Authorization", "Bearer " + pairing); connection.setRequestProperty("Content-Type", "application/json");
        try {
            if (body != null) { connection.setRequestMethod("POST"); connection.setDoOutput(true); try (OutputStream out = connection.getOutputStream()) { out.write(body.toString().getBytes(StandardCharsets.UTF_8)); } }
            if (connection.getResponseCode() != 200) throw new IOException("Lab operation not confirmed");
            try (InputStream in = connection.getInputStream(); ByteArrayOutputStream out = new ByteArrayOutputStream()) {
                byte[] chunk = new byte[4096]; int n;
                while ((n = in.read(chunk)) != -1) { if (out.size() + n > 65536) throw new IOException(); out.write(chunk,0,n); }
                return new JSONObject(out.toString("UTF-8"));
            }
        } finally { connection.disconnect(); }
    }
    private void pair() {
        if (busy || tls == null) return;
        String value = pairingInput.getText().toString().trim();
        if (!value.matches("[a-f0-9]{64}")) { message("Enter the current protected local pairing key."); return; }
        pairing = value; pairingInput.setText(""); busy = true; productRows.removeAllViews();
        worker.execute(() -> { try { JSONObject data = request("/session", null); render(data); runOnUiThread(this::loadProducts); } catch (Exception e) { account = ""; message("Pairing failed. Check USB forwarding, TLS and the unexpired local session."); } finally { busy = false; } });
    }
    private void render(JSONObject data) throws JSONException {
        if (!"isolated-google-license-test".equals(data.getString("mode"))) throw new JSONException("Wrong lab");
        account = data.getString("accountBinding"); expiresAt = data.getLong("expiresAt");
        JSONArray products = data.getJSONArray("products"); Map<String,Long> nextAllowed = new HashMap<>();
        for (int i=0;i<products.length();i++) {
            JSONObject p=products.getJSONObject(i); String id=p.getString("id"); long cents=p.getLong("priceCents");
            // Defence in depth: approved contents only; never infer allocations from Play or JS.
            if (!"AUD".equals(p.getString("currency")) || !(id.equals("docked_credits_4900_v1") && cents==4900 && p.getLong("credits")==4900 || id.equals("docked_credits_9900_v1") && cents==9900 && p.getLong("credits")==9900)) throw new JSONException("Unapproved product");
            nextAllowed.put(id,cents);
        }
        allowed = Collections.unmodifiableMap(nextAllowed);
        JSONArray receipts=data.getJSONArray("receipts"); lastKey=""; StringBuilder rows=new StringBuilder();
        for(int i=0;i<receipts.length();i++){ JSONObject r=receipts.getJSONObject(i); String key=r.getString("key"), state=r.getString("state"); rows.append("\n").append(key.substring(0,8)).append(": ").append(state); if(state.equals("PURCHASED")) lastKey=key; }
        message("Paired · synthetic ledger: " + data.getLong("balance") + " credits\nVerified receipts: " + receipts.length() + rows + "\nProduction payments remain disabled.");
        runOnUiThread(() -> renderPacks(data));
    }
    private void renderPacks(JSONObject data) {
        packRows.removeAllViews();
        try {
            packRows.addView(text("Hosted test member · " + data.optString("member") + "\nSpendable: " + data.optLong("spendable") + " test credits", 16));
            JSONArray packs = data.optJSONArray("packs"), products = data.optJSONArray("packProducts"), cards = data.optJSONArray("collection");
            if (products != null) for(int i=0;i<products.length();i++) {
                JSONObject p=products.getJSONObject(i);
                // Keep this acceptance screen compact; all 18 products stay in server catalogue.
                if(p.getInt("cards")!=9) continue;
                String title=p.getString("sport").toUpperCase()+" "+p.getString("name")+" · "+p.getLong("priceCredits")+" test credits";
                Button buy=button(title); packRows.addView(buy);
                buy.setOnClickListener(v -> {
                    if(!paired() || busy || !pendingPackRequest.isEmpty()) {message("Finish or retry the pending operation first.");return;}
                    new AlertDialog.Builder(this).setTitle("Confirm isolated test pack").setMessage(title+"\nSynthetic non-permanent cards only. The shared test wallet will be debited on confirmation.").setNegativeButton("Cancel",null).setPositiveButton("Confirm test purchase",(d,w)->{
                        try {
                            JSONObject command=new JSONObject().put("kind","buy-pack").put("product",p.getString("id")).put("configuration",p.getString("version")).put("expectedPrice",p.getLong("priceCredits")).put("confirmed",true).put("policy",data.getString("policy"));
                            queuePack(command);
                        } catch(Exception e) {message("Pack configuration unavailable. Reconcile to refresh.");}
                    }).show();
                });
            }
            if(packs != null) for(int i=0;i<packs.length();i++) {
                JSONObject p=packs.getJSONObject(i);
                packRows.addView(text(p.getString("sport").toUpperCase()+" · "+p.getString("name")+" · "+p.getString("status"),14));
                if(!p.getBoolean("opened") && "SEALED".equals(p.getString("status"))) {
                    Button open=button("Open "+p.getString("name")); packRows.addView(open);
                    open.setOnClickListener(v->{try{queuePack(new JSONObject().put("kind","open-pack").put("entitlement",p.getString("id")));}catch(Exception e){message("Opening not started.");}});
                }
            }
            if(cards!=null) {
                packRows.addView(text("Owned isolated cards: "+cards.length(),18));
                for(int i=0;i<cards.length();i++) {
                    JSONObject c=cards.getJSONObject(i);
                    packRows.addView(text(c.getString("sport").toUpperCase()+" · "+c.getString("name")+" · "+c.getString("tier")+" · #"+c.getLong("serial"),14));
                }
            }
        } catch(Exception e) {message("Pack summary unavailable. Reconcile to refresh.");}
    }
    private void queuePack(JSONObject command) {
        if(!paired() || busy || !pendingPackRequest.isEmpty()) {message("Finish or retry the pending operation first.");return;}
        pendingPackRequest=UUID.randomUUID().toString(); pendingPackBody=command.toString(); submitPack();
    }
    private void submitPack() {
        if(!paired() || busy || pendingPackRequest.isEmpty()) return;
        busy=true;
        worker.execute(()->{try{
            JSONObject data=request("/pack",new JSONObject().put("request",pendingPackRequest).put("command",new JSONObject(pendingPackBody)));
            pendingPackRequest="";pendingPackBody="";render(data);
        }catch(Exception e){message("Pack action not confirmed. Use Retry unconfirmed pack action; the same operation ID is retained.");}finally{busy=false;}});
    }
    private void loadProducts() {
        if (!paired()) { message("Pairing expired. Checkout disabled."); return; }
        Runnable query=()-> {
            List<QueryProductDetailsParams.Product> products=new ArrayList<>();
            for(String id:allowed.keySet()) products.add(QueryProductDetailsParams.Product.newBuilder().setProductId(id).setProductType(BillingClient.ProductType.INAPP).build());
            billing.queryProductDetailsAsync(QueryProductDetailsParams.newBuilder().setProductList(products).build(), (result, found)->runOnUiThread(()->{
                productRows.removeAllViews();
                if(result.getResponseCode()!=BillingClient.BillingResponseCode.OK || found.getProductDetailsList().isEmpty()){ message("Google returned no available test products. Draft/unpublished products cannot be purchased. No payment was started."); return; }
                for(ProductDetails item:found.getProductDetailsList()) {
                    Long expected=allowed.get(item.getProductId()); if(expected==null || item.getOneTimePurchaseOfferDetailsList()==null) continue;
                    for(ProductDetails.OneTimePurchaseOfferDetails offer:item.getOneTimePurchaseOfferDetailsList()) {
                        if(!offer.getPriceCurrencyCode().equals("AUD") || offer.getPriceAmountMicros()!=expected*10000L) continue;
                        Button buy=button("Test " + item.getName() + " · " + offer.getFormattedPrice()); productRows.addView(buy);
                        buy.setOnClickListener(v->confirm(item,offer)); break;
                    }
                }
            }));
        };
        if(billing.isReady()) query.run(); else billing.startConnection(new BillingClientStateListener(){ public void onBillingSetupFinished(BillingResult r){ if(r.getResponseCode()==BillingClient.BillingResponseCode.OK) query.run(); else message("Google Play connection unavailable."); } public void onBillingServiceDisconnected(){ message("Google Play disconnected. Re-pair to refresh."); } });
    }
    private void confirm(ProductDetails item, ProductDetails.OneTimePurchaseOfferDetails offer) {
        if(!paired() || busy || !testOnly.isChecked()){ message("Pair the USB lab and confirm license-test mode first."); return; }
        new AlertDialog.Builder(this).setTitle("Google test checkout").setMessage(item.getName()+" · "+offer.getFormattedPrice()+"\nOnly continue if Google shows a TEST payment instrument. This lab cannot prevent Google charging a real method. Cancel any real payment screen.").setNegativeButton("Cancel",null).setPositiveButton("Open Google test checkout",(d,w)->{
            if(!paired()) return; busy=true;
            BillingFlowParams.ProductDetailsParams p=BillingFlowParams.ProductDetailsParams.newBuilder().setProductDetails(item).setOfferToken(offer.getOfferToken()).build();
            BillingResult r=billing.launchBillingFlow(this,BillingFlowParams.newBuilder().setProductDetailsParamsList(Collections.singletonList(p)).setObfuscatedAccountId(account).build());
            if(r.getResponseCode()!=BillingClient.BillingResponseCode.OK){busy=false;message("Checkout did not start. No ledger change.");}
        }).show();
    }
    @Override public void onPurchasesUpdated(BillingResult result, List<Purchase> purchases){
        busy=false;
        if(result.getResponseCode()==BillingClient.BillingResponseCode.USER_CANCELED){message("Google checkout cancelled. No ledger grant from this callback.");return;}
        if(result.getResponseCode()!=BillingClient.BillingResponseCode.OK){message("Google checkout not confirmed. Reconcile before retrying.");return;}
        submit(purchases);
    }
    private void submit(List<Purchase> purchases){
        if(!paired())return; worker.execute(()->{try{
            if(purchases!=null)for(Purchase p:purchases){ if(p.getProducts().size()!=1 || !allowed.containsKey(p.getProducts().get(0)))continue; request("/receipt",new JSONObject().put("token",p.getPurchaseToken())); }
            render(request("/reconcile",new JSONObject()));
        }catch(Exception e){message("Server verification pending or rejected. No production account is connected. Use Reconcile.");}});
    }
    private void reconcile(){ if(!paired() || !billing.isReady()){message("Pair USB lab first.");return;} billing.queryPurchasesAsync(QueryPurchasesParams.newBuilder().setProductType(BillingClient.ProductType.INAPP).build(),(r,p)->{if(r.getResponseCode()==BillingClient.BillingResponseCode.OK)submit(p);else message("Google reconciliation unavailable.");}); }
    private void refund(){
        if(!paired() || busy || lastKey.isEmpty()){message("No purchased test receipt available to refund.");return;}
        final String key=lastKey;
        new AlertDialog.Builder(this).setTitle("Refund TEST receipt "+key.substring(0,8)).setMessage("Google will be asked to revoke only this server-verified test purchase. Your production Docked balance is not connected.").setNegativeButton("Cancel",null).setPositiveButton("Refund test purchase",(d,w)->{
            busy=true;worker.execute(()->{try{render(request("/refund",new JSONObject().put("key",key)));}catch(Exception e){message("Test refund not confirmed. Reconcile before retrying.");}finally{busy=false;}});
        }).show();
    }
    @Override protected void onDestroy(){ pairing="";account=""; if(billing!=null)billing.endConnection();worker.shutdownNow();super.onDestroy(); }
}
