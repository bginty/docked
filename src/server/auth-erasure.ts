/** Auth's irreversible soft-delete erases credentials and identifying metadata,
 * while keeping the opaque primary key referenced by permanent ownership and
 * historical entries. This is not merely an application-level disabled flag. */
export async function eraseAuthRetainingReferences(
  admin: {
    deleteUser(
      id: string,
      soft: boolean,
    ): Promise<{
      data: { user: { id: string; deleted_at?: string } | null };
      error: { code?: string } | null;
    }>;
    getUserById(id: string): Promise<{
      data: { user: { id: string; deleted_at?: string } | null };
      error: { code?: string } | null;
    }>;
  },
  userId: string,
) {
  const { error } = await admin.deleteUser(userId, true);
  if (error?.code === "user_not_found") return;
  if (error) throw new Error("Remote Auth erasure pending; retry safely");
  // Hosted Auth's DELETE response can omit the updated user representation.
  // Confirm the provider state, including after a response timeout/retry.
  const { data, error: readError } = await admin.getUserById(userId);
  if (readError?.code === "user_not_found") return;
  if (
    readError ||
    data.user?.id !== userId ||
    !data.user.deleted_at ||
    !Number.isFinite(Date.parse(data.user.deleted_at))
  )
    throw new Error("Remote Auth erasure pending; retry safely");
}
