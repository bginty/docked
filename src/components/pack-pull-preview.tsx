"use client";

import { Capacitor, registerPlugin } from "@capacitor/core";
import { useEffect, useRef, useState } from "react";
import type { AwardedCard } from "@/core/pack-opening";
import { CollectibleFrame } from "./collectible-frame";
import { FantasySheet } from "./fantasy-sheet";
import { drawPackPullImage, pullImageDetails } from "./pack-pull-image";
import { PlayerJersey } from "./player-jersey";

type ImagePayload = { data: string; filename: string };

const NativePullImage = registerPlugin<{
  prepareShare(image: ImagePayload): Promise<{ uri: string }>;
  save(image: ImagePayload): Promise<{ saved: boolean }>;
}>("DockedPullImage");

function readImage(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") resolve(reader.result);
      else reject(new Error("Image data unavailable"));
    };
    reader.onerror = () => reject(new Error("Image could not be read"));
    reader.readAsDataURL(blob);
  });
}

function canShareFile(file: File) {
  try {
    return (
      !!navigator.share && navigator.canShare?.({ files: [file] }) === true
    );
  } catch {
    return false;
  }
}

export default function PullImagePreview({
  card,
  onClose,
}: {
  card: AwardedCard;
  onClose: () => void;
}) {
  const [details] = useState(() => pullImageDetails(card));
  const artwork = useRef<HTMLDivElement>(null);
  const [image, setImage] = useState<{ source: string; file: File } | null>(
    null,
  );
  const [message, setMessage] = useState("");
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  const operation = useRef(false);
  const native =
    Capacitor.isNativePlatform() &&
    Capacitor.isPluginAvailable("DockedPullImage");

  useEffect(() => {
    let active = true;
    const jersey = artwork.current?.querySelector<SVGElement>(".player-jersey");
    const frame =
      artwork.current?.querySelector<SVGElement>(".collectible-frame");
    if (!jersey || !frame) {
      setFailed(true);
      return;
    }
    void drawPackPullImage(details, jersey, frame)
      .then(async (blob) => {
        const source = await readImage(blob);
        if (active)
          setImage({
            source,
            file: new File([blob], details.filename, { type: "image/png" }),
          });
      })
      .catch(() => {
        if (active) setFailed(true);
      });
    return () => {
      active = false;
    };
  }, [details]);

  function download(source: string) {
    const link = document.createElement("a");
    link.href = source;
    link.download = details.filename;
    document.body.append(link);
    link.click();
    link.remove();
    setMessage("Your download has started.");
  }

  async function exportImage(action: "share" | "save") {
    if (!image || operation.current) return;
    operation.current = true;
    setBusy(true);
    setMessage("");
    try {
      if (native) {
        const payload = {
          data: image.source.slice("data:image/png;base64,".length),
          filename: image.file.name,
        };
        if (action === "save") {
          const result = await NativePullImage.save(payload);
          setMessage(result.saved ? "Image saved." : "Save cancelled.");
        } else {
          const { Share } = await import("@capacitor/share");
          const { uri } = await NativePullImage.prepareShare(payload);
          await Share.share({
            files: [uri],
            dialogTitle: "Share your Docked pull",
          });
        }
      } else if (action === "share" && canShareFile(image.file)) {
        await navigator.share({ files: [image.file] });
      } else {
        download(image.source);
      }
    } catch (error) {
      if (
        error instanceof Error &&
        (error.name === "AbortError" || /share cancel/i.test(error.message))
      ) {
        setMessage("Share cancelled.");
      } else {
        setMessage(
          action === "share"
            ? "Sharing is unavailable here. Try Save Image."
            : "The image could not be saved. Please try again.",
        );
      }
    } finally {
      operation.current = false;
      setBusy(false);
    }
  }

  return (
    <FantasySheet
      title="Share your pull"
      className="pack-pull-preview"
      onClose={onClose}
    >
      <div ref={artwork} hidden aria-hidden="true">
        <PlayerJersey card={details.jersey} />
        <CollectibleFrame />
      </div>
      <div className="pack-pull-preview-body">
        <div className="pack-pull-preview-image">
          {image ? (
            <img
              src={image.source}
              alt={
                details.name +
                ", " +
                details.label +
                " " +
                details.sport +
                " pull"
              }
              width={1080}
              height={1920}
            />
          ) : (
            <p role={failed ? "alert" : "status"}>
              {failed
                ? "The share image could not be created. Close this preview and try again."
                : "Preparing your pull image…"}
            </p>
          )}
        </div>
        <div className="pack-pull-preview-actions">
          <p>Story image · 1080 × 1920</p>
          <div>
            {image && (native || canShareFile(image.file)) && (
              <button
                type="button"
                className="pack-control pack-primary"
                disabled={busy}
                onClick={() => void exportImage("share")}
              >
                Share Image
              </button>
            )}
            <button
              type="button"
              className="pack-control secondary"
              disabled={!image || busy}
              onClick={() => void exportImage("save")}
            >
              Save Image
            </button>
          </div>
          {image && !native && !canShareFile(image.file) && (
            <p>Save the image to share it in your preferred app.</p>
          )}
          <p role="status">{message}</p>
        </div>
      </div>
    </FantasySheet>
  );
}
