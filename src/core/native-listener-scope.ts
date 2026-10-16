export type NativeListenerHandle = { remove(): Promise<void> };

/** Own each registration immediately, including late results after unmount.
 * A rejected sibling registration must not orphan already registered listeners. */
export function nativeListenerScope() {
  let closed = false;
  const handles = new Set<NativeListenerHandle>();
  const remove = (handle: NativeListenerHandle) => {
    // Plugin teardown failures must not prevent the other handles being removed.
    void Promise.resolve()
      .then(() => handle.remove())
      .catch(() => {});
  };
  return {
    async track(registration: Promise<NativeListenerHandle>) {
      const handle = await registration;
      if (closed) remove(handle);
      else handles.add(handle);
    },
    close() {
      closed = true;
      for (const handle of handles) remove(handle);
      handles.clear();
    },
  };
}
