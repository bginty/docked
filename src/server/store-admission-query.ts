/** Shared by the hosted adapter and database acceptance tests. */
export const storeAdmissionQuery =
  "select credits_sandbox.member_store_test_admission() as admission";
