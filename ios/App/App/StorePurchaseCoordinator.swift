import Foundation
import StoreKit

/// Native StoreKit transport. The bundled product allowlist is disabled by default.
/// A verified StoreKit callback is still not permission to credit a Docked wallet.
@MainActor final class StorePurchaseCoordinator {
    enum Failure: Error { case unavailable, unverified, serverNotFulfilled }
    private let approvedProducts: Set<String>
    private var updates: Task<Void, Never>?
    private var purchasing = false

    init(approvedProducts: Set<String>) { self.approvedProducts = approvedProducts }

    func products() async throws -> [Product] {
        guard !approvedProducts.isEmpty else { return [] }
        return try await Product.products(for: approvedProducts)
    }
    func purchase(_ product: Product, accountToken: UUID,
                  verifyAndFulfil: @escaping (String) async throws -> Bool) async throws -> String {
        guard approvedProducts.contains(product.id), product.type == .consumable, !purchasing else { throw Failure.unavailable }
        purchasing = true
        defer { purchasing = false }
        switch try await product.purchase(options: [.appAccountToken(accountToken)]) {
        case .success(let result):
            try await reconcile(result, verifyAndFulfil: verifyAndFulfil)
            return "verified"
        case .pending: return "pending"
        case .userCancelled: return "cancelled"
        @unknown default: throw Failure.unavailable
        }
    }
    func observe(verifyAndFulfil: @escaping (String) async throws -> Bool) {
        updates?.cancel()
        updates = Task { [weak self] in
            for await result in Transaction.updates {
                guard !Task.isCancelled else { return }
                // Failed network/server acknowledgement remains unfinished for reconciliation.
                try? await self?.reconcile(result, verifyAndFulfil: verifyAndFulfil)
            }
        }
    }
    func recover(verifyAndFulfil: @escaping (String) async throws -> Bool) async throws {
        var failed = false
        for await result in Transaction.unfinished {
            do { try await reconcile(result, verifyAndFulfil: verifyAndFulfil) }
            catch { failed = true } // Another signed-in member's receipt must not block the whole sweep.
        }
        if failed { throw Failure.serverNotFulfilled }
    }
    private func reconcile(_ result: VerificationResult<Transaction>,
                           verifyAndFulfil: (String) async throws -> Bool) async throws {
        guard case .verified(let transaction) = result,
              approvedProducts.contains(transaction.productID) else { throw Failure.unverified }
        guard try await verifyAndFulfil(result.jwsRepresentation) else { throw Failure.serverNotFulfilled }
        await transaction.finish()
    }
    deinit { updates?.cancel() }
}
