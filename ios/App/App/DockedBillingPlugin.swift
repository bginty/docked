import Foundation
import Capacitor
import StoreKit
import WebKit

// Native transport only. No production-money path. Build allowlist AND the
// authenticated server's expiring sandbox admission must both permit a purchase.
@objc(DockedAppleBillingPlugin)
public class DockedAppleBillingPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "DockedAppleBillingPlugin"
    public let jsName = "DockedAppleBilling"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "capabilities", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "products", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "purchase", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "reconcile", returnType: CAPPluginReturnPromise)
    ]
    private struct Configuration: Decodable {
        let enabled: Bool
        let origin: String
        let environment: String
        let products: [String]
    }
    private var config: Configuration?
    private var coordinator: StorePurchaseCoordinator?
    private let redirects = NoBillingRedirects()

    public override func load() {
        // A missing/invalid bundle file is unavailable, never a fallback product.
        guard let url = Bundle.main.url(forResource: "DockedStoreConfiguration", withExtension: "json"),
              let data = try? Data(contentsOf: url),
              let c = try? JSONDecoder().decode(Configuration.self, from: data),
              c.environment == "sandbox", c.origin == "https://docked.com.au" else { return }
        config = c
        Task { @MainActor in
            self.coordinator = StorePurchaseCoordinator(approvedProducts: c.enabled ? Set(c.products) : [])
            if c.enabled {
                self.coordinator?.observe { [weak self] signed in
                    guard let self = self else { return false }
                    return try await self.verify(signed)
                }
            }
        }
    }
    @MainActor private func request(_ body: [String: Any]? = nil) async throws -> [String: Any] {
        guard let c = config, c.enabled, !c.products.isEmpty,
              let web = bridge?.webView, let visible = web.url,
              visible.scheme == "https", visible.host == "docked.com.au", visible.port == nil,
              let url = URL(string: c.origin + "/api/store/apple/test") else { throw StorePurchaseCoordinator.Failure.unavailable }
        let cookies = await web.configuration.websiteDataStore.httpCookieStore.allCookies()
        // Copy only this origin's current cookies into one ephemeral request.
        // Never use shared cookie storage, persist receipts or log raw failures.
        let allowed = cookies.filter {
            let domain = $0.domain.hasPrefix(".") ? String($0.domain.dropFirst()) : $0.domain
            return domain == "docked.com.au" && url.path.hasPrefix($0.path)
        }
        var r = URLRequest(url: url, cachePolicy: .reloadIgnoringLocalAndRemoteCacheData, timeoutInterval: 20)
        for (key, value) in HTTPCookie.requestHeaderFields(with: allowed) { r.setValue(value, forHTTPHeaderField: key) }
        r.setValue(c.origin, forHTTPHeaderField: "Origin")
        r.setValue("application/json", forHTTPHeaderField: "Accept")
        if let body = body {
            r.httpMethod = "POST"
            r.setValue("application/json", forHTTPHeaderField: "Content-Type")
            r.httpBody = try JSONSerialization.data(withJSONObject: body)
        }
        let configuration = URLSessionConfiguration.ephemeral
        configuration.httpCookieStorage = nil
        configuration.urlCache = nil
        let session = URLSession(configuration: configuration, delegate: redirects, delegateQueue: nil)
        defer { session.invalidateAndCancel() }
        let (data, response) = try await session.data(for: r)
        guard let http = response as? HTTPURLResponse, http.statusCode == 200,
              http.url?.absoluteString == url.absoluteString, data.count <= 65536,
              let json = try JSONSerialization.jsonObject(with: data) as? [String: Any] else { throw StorePurchaseCoordinator.Failure.serverNotFulfilled }
        return json
    }
    @MainActor private func admitted() async throws -> [String: Any] {
        let s = try await request()
        guard s["environment"] as? String == "test", let token = s["accountBinding"] as? String,
              UUID(uuidString: token) != nil, s["member"] as? String != nil else { throw StorePurchaseCoordinator.Failure.unavailable }
        return s
    }
    @MainActor private func verify(_ signed: String) async throws -> Bool {
        // Server independently derives member identity from these cookies,
        // verifies Apple JWS/current status and commits its existing wallet once.
        let result = try await request(["token": signed])
        let verified = ["PURCHASED", "REVOKED"].contains(result["state"] as? String ?? "")
        if verified { notifyListeners("purchaseSettled", data: ["state": result["state"] as? String ?? ""]) }
        return verified
    }
    @objc func capabilities(_ call: CAPPluginCall) {
        Task { @MainActor in
            do {
                let s = try await admitted()
                call.resolve(["enabled": true, "environment": "test", "member": s["member"]!, "accountBinding": s["accountBinding"]!])
            } catch { call.resolve(["enabled": false, "environment": "test"]) }
        }
    }
    @objc func products(_ call: CAPPluginCall) {
        Task { @MainActor in
            do {
                let s = try await admitted()
                let approved = s["products"] as? [[String: Any]] ?? []
                let available = try await coordinator?.products() ?? []
                let items: [[String: Any]] = available.compactMap { p in
                    guard p.type == .consumable, p.priceFormatStyle.currencyCode == "AUD",
                          let match = approved.first(where: { $0["id"] as? String == p.id }),
                          let credits = match["credits"] as? Int else { return nil }
                    return ["id": p.id, "name": p.displayName, "price": p.displayPrice, "currency": "AUD", "credits": credits]
                }
                call.resolve(["products": items])
            } catch { call.reject("Apple sandbox products are unavailable.") }
        }
    }
    @objc func purchase(_ call: CAPPluginCall) {
        Task { @MainActor in
            do {
                let s = try await admitted()
                guard let id = call.getString("productId"), let binding = call.getString("accountBinding"),
                      s["accountBinding"] as? String == binding, let token = UUID(uuidString: binding),
                      let approved = s["products"] as? [[String: Any]], approved.contains(where: { $0["id"] as? String == id }),
                      let coordinator = coordinator,
                      let product = try await coordinator.products().first(where: { $0.id == id }),
                      product.priceFormatStyle.currencyCode == "AUD" else { throw StorePurchaseCoordinator.Failure.unavailable }
                let state = try await coordinator.purchase(product, accountToken: token) { [weak self] signed in
                    guard let self = self else { return false }
                    return try await self.verify(signed)
                }
                call.resolve(["state": state])
            } catch { call.reject("Purchase not confirmed. Check purchases before trying again.") }
        }
    }
    @objc func reconcile(_ call: CAPPluginCall) {
        Task { @MainActor in
            do {
                _ = try await admitted()
                guard let coordinator = coordinator else { throw StorePurchaseCoordinator.Failure.unavailable }
                try await coordinator.recover { [weak self] signed in
                    guard let self = self else { return false }
                    return try await self.verify(signed)
                }
                call.resolve(["checked": true])
            } catch { call.reject("Some purchases still need verification. No extra purchase is required.") }
        }
    }
}
private final class NoBillingRedirects: NSObject, URLSessionTaskDelegate {
    func urlSession(_ session: URLSession, task: URLSessionTask, willPerformHTTPRedirection response: HTTPURLResponse,
                    newRequest request: URLRequest, completionHandler: @escaping (URLRequest?) -> Void) {
        completionHandler(nil)
    }
}
