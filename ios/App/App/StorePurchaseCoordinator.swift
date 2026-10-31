import Foundation
import StoreKit

/// Native StoreKit transport. Product approval is deliberately empty.
/// A verified StoreKit callback is still not permission to credit a Docked wallet.
@MainActor final class StorePurchaseCoordinator {
    enum Failure: Error { case unavailable, unverified, serverNotFulfilled }
    private let approvedProducts: Set<String> = []
    private var updates: Task<Void, Never>?

    func products() async throws -> [Product] {
        guard !approvedProducts.isEmpty else { return [] }
        return try await Product.products(for: approvedProducts)
    }
    func purchase(_ product: Product, accountToken: UUID,
                  verifyAndFulfil: @escaping (String) async throws -> Bool) async throws {
        guard approvedProducts.contains(product.id) else { throw Failure.unavailable }
        switch try await product.purchase(options: [.appAccountToken(accountToken)]) {
        case .success(let result): try await reconcile(result, verifyAndFulfil: verifyAndFulfil)
        case .pending, .userCancelled: return
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
        for await result in Transaction.unfinished {
            try await reconcile(result, verifyAndFulfil: verifyAndFulfil)
        }
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
