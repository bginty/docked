// Read projections need a consistent snapshot, but the admission functions take
// shared row locks to coordinate revocation. PostgreSQL READ ONLY forbids those
// locks. This transaction performs no writes and takes no global settlement lock.
export const memberReadIsolation = "isolation level repeatable read";
