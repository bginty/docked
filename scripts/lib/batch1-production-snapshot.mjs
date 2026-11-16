/** Match the persisted JSON representation without omitting any snapshot field. */
export function persistedSnapshot(value) {
  return JSON.parse(JSON.stringify(value));
}
