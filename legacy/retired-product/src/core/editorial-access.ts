/** Fail closed without disclosing backend details or reporting a temporary failure as a missing article. */
export async function editorialRead<T>(load: () => Promise<T>): Promise<T> {
  try {
    return await load();
  } catch {
    throw new Error(
      "Editorial service temporarily unavailable. Please try again later.",
    );
  }
}
