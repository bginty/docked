"use client";
import { useEffect, useState } from "react";
import { isDockedNative } from "./native-bridge";
/** Fills the existing form's file input; normal authenticated quarantine upload remains unchanged. */
export function NativeImagePicker() {
  const [native, setNative] = useState(false),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  useEffect(() => {
    setNative(isDockedNative());
  }, []);
  if (!native) return null;
  async function pick(button: HTMLButtonElement, source: "camera" | "photos") {
    setBusy(true);
    setMessage("");
    try {
      const { Camera, CameraResultType, CameraSource } =
        await import("@capacitor/camera");
      const photo = await Camera.getPhoto({
        source: source === "camera" ? CameraSource.Camera : CameraSource.Photos,
        resultType: CameraResultType.Uri,
        quality: 80,
        width: 2048,
        height: 2048,
        allowEditing: false,
        saveToGallery: false,
        correctOrientation: true,
      });
      if (!photo.webPath) throw new Error("unavailable");
      const response = await fetch(photo.webPath),
        blob = await response.blob();
      if (
        !response.ok ||
        blob.size > 5 * 1024 * 1024 ||
        !["image/jpeg", "image/png", "image/webp"].includes(blob.type)
      )
        throw new Error("unsupported");
      const input = button
        .closest("form")
        ?.querySelector<HTMLInputElement>('input[type="file"]');
      if (!input) throw new Error("unavailable");
      const transfer = new DataTransfer();
      transfer.items.add(
        new File([blob], `docked-social.${blob.type.split("/")[1]}`, {
          type: blob.type,
        }),
      );
      input.files = transfer.files;
      input.dispatchEvent(new Event("change", { bubbles: true }));
      setMessage(
        "Image selected. Add a description and submit for quarantine review. It cannot verify a price or result.",
      );
    } catch {
      setMessage(
        "Image selection was cancelled, denied or unavailable. You can still use the file chooser.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <div>
      <div className="actions">
        <button
          type="button"
          className="button ghost small"
          disabled={busy}
          onClick={(e) => void pick(e.currentTarget, "photos")}
        >
          Choose photo
        </button>
        <button
          type="button"
          className="button ghost small"
          disabled={busy}
          onClick={(e) => void pick(e.currentTarget, "camera")}
        >
          Take photo
        </button>
      </div>
      <p role="status">{message}</p>
    </div>
  );
}
