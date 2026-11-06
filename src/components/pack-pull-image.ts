import { fantasyAssets } from "@/brand/fantasy-assets";
import { rarityLabel } from "@/core/card-rarity";
import {
  collectiblePresentation,
  type JerseyMetadata,
} from "@/core/card-presentation";
import type { AwardedCard } from "@/core/pack-opening";
import { rarityPresentation } from "@/core/rarity-theme";

const width = 1080;
const height = 1920;
const centre = width / 2;
const fontFamily = "'Arial Black', Arial, sans-serif";

export function pullImageDetails(card: AwardedCard) {
  const colour = (value?: string) =>
    value && /^#[\da-f]{6}$/i.test(value) ? value : undefined;
  const jersey: JerseyMetadata = {
    sport: card.sport,
    team: card.team,
    colour: colour(card.colour),
    accentColour: colour(card.accentColour),
    verifiedJerseyNumber: card.verifiedJerseyNumber,
    preserveArtwork: card.preserveArtwork,
  };
  const tier = card.tier;
  const label = rarityLabel(tier);
  const { name, location } = collectiblePresentation({
    ...jersey,
    name: card.name,
    tier,
  });
  const sport = card.sport.toUpperCase();
  return {
    jersey,
    tier,
    label,
    name,
    location,
    sport,
    position: card.position,
    filename:
      "docked-" +
      sport.toLowerCase() +
      "-" +
      tier.toLowerCase().replaceAll("_", "-") +
      "-pull.png",
  };
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Artwork could not be loaded"));
    image.src = src;
  });
}

function vectorImage(
  source: SVGElement,
  size: readonly [number, number],
  accent: string,
) {
  const svg = source.cloneNode(true) as SVGElement;
  svg.setAttribute("width", String(size[0]));
  svg.setAttribute("height", String(size[1]));
  svg.style.setProperty("--tier", accent);
  svg.style.setProperty("--metal-highlight", "#e9f3ff");
  const xml = new XMLSerializer().serializeToString(svg);
  return loadImage(
    "data:image/svg+xml;charset=utf-8," + encodeURIComponent(xml),
  );
}

function text(
  ctx: CanvasRenderingContext2D,
  value: string,
  x: number,
  y: number,
  size: number,
  color: string | CanvasGradient,
  maxWidth = 960,
) {
  ctx.font = "900 " + size + "px " + fontFamily;
  ctx.fillStyle = color;
  ctx.fillText(value, x, y, maxWidth);
}

function rounded(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  radius: number,
) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

function drawAtmosphere(
  ctx: CanvasRenderingContext2D,
  accent: string,
  tier: string,
) {
  const metallic = tier === "LEGENDARY";
  const prism = tier === "ICON";
  const premium = metallic || prism;
  const background = ctx.createLinearGradient(0, 0, width, height);
  background.addColorStop(0, "#0c1630");
  background.addColorStop(0.62, "#070e20");
  background.addColorStop(1, "#030611");
  ctx.fillStyle = background;
  ctx.fillRect(0, 0, width, height);

  const glow = ctx.createRadialGradient(centre, 935, 140, centre, 935, 835);
  glow.addColorStop(0, accent + (premium ? "7f" : "51"));
  glow.addColorStop(0.47, accent + (premium ? "30" : "1f"));
  glow.addColorStop(1, accent + "00");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 180, width, 1510);

  ctx.save();
  ctx.translate(centre, 945);
  const rings = premium ? 4 : 2;
  for (let i = 0; i < rings; i++) {
    const spread = 310 + i * 72;
    ctx.lineWidth = i === 0 ? 4 : 2;
    ctx.strokeStyle = accent + (i === 0 ? "a0" : "48");
    ctx.beginPath();
    if (prism) {
      ctx.moveTo(0, -spread - 88);
      ctx.lineTo(spread + 37, 0);
      ctx.lineTo(0, spread + 88);
      ctx.lineTo(-spread - 37, 0);
      ctx.closePath();
    } else {
      ctx.ellipse(
        0,
        0,
        spread * 1.46,
        spread * 0.59,
        -0.53 + i * 0.19,
        0,
        Math.PI * 2,
      );
    }
    ctx.stroke();
  }
  if (premium) {
    for (let i = 0; i < 18; i++) {
      ctx.save();
      ctx.rotate((i * Math.PI) / 9 + 0.14);
      const ray = ctx.createLinearGradient(0, -110, 0, -805);
      ray.addColorStop(0, accent + "00");
      ray.addColorStop(0.41, accent + (prism ? "75" : "54"));
      ray.addColorStop(1, accent + "00");
      ctx.fillStyle = ray;
      ctx.beginPath();
      ctx.moveTo(0, -110);
      ctx.lineTo(-4 - (i % 4) * 4, -805);
      ctx.lineTo(5 + (i % 3) * 5, -805);
      ctx.fill();
      ctx.restore();
    }
  }
  const stars = premium ? 82 : 34;
  for (let i = 0; i < stars; i++) {
    const x = ((i * 223 + 43) % 1051) - 525;
    const y = ((i * 163 + 79) % 1361) - 680;
    const radius = 1 + ((i * 5) % 7) * (premium ? 0.75 : 0.37);
    ctx.fillStyle = i % 6 === 0 ? "#f7f6ffcb" : accent + "94";
    if (i % 5 === 0) {
      ctx.beginPath();
      ctx.moveTo(x, y - radius * 2.1);
      ctx.lineTo(x + radius * 0.72, y);
      ctx.lineTo(x, y + radius * 2.1);
      ctx.lineTo(x - radius * 0.72, y);
      ctx.fill();
    } else {
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
}

export async function drawPackPullImage(
  details: ReturnType<typeof pullImageDetails>,
  jerseySource: SVGElement,
  frameSource: SVGElement,
): Promise<Blob> {
  const { tier, label, name, location, sport, position } = details;
  const theme = rarityPresentation(tier);
  const accent = tier === "ULTRA_RARE" ? "#f57abf" : theme.accent;
  const [jersey, frame, logo] = await Promise.all([
    vectorImage(jerseySource, [540, 528], accent),
    vectorImage(frameSource, [680, 1020], theme.accent),
    loadImage(fantasyAssets.compactLarge),
  ]);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d", { alpha: false });
  if (!ctx) throw new Error("Image export is unavailable");

  drawAtmosphere(ctx, accent, tier);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const logoWidth = 350;
  const logoHeight = (logoWidth * logo.naturalHeight) / logo.naturalWidth;
  ctx.drawImage(logo, centre - logoWidth / 2, 148, logoWidth, logoHeight);
  text(ctx, sport + "  /  PACK REVEAL", centre, 326, 30, "#c4d1e6");
  const title =
    tier === "ICON" ? "ICON UNLOCKED!" : label.toUpperCase() + " PULL!";
  const headline = ctx.createLinearGradient(0, 365, 0, 472);
  headline.addColorStop(0, "#ffffff");
  headline.addColorStop(1, accent);
  text(
    ctx,
    title,
    centre,
    422,
    tier === "ICON" || tier === "LEGENDARY" ? 106 : 94,
    headline,
  );

  const card = { x: 250, y: 540, width: 580, height: 870 };
  const panel = ctx.createLinearGradient(
    card.x,
    card.y,
    card.x + card.width,
    card.y + card.height,
  );
  panel.addColorStop(0, "#1b2943");
  panel.addColorStop(0.55, "#091426");
  panel.addColorStop(1, "#101a2d");
  ctx.save();
  ctx.shadowColor = accent + "95";
  ctx.shadowBlur = 40;
  ctx.fillStyle = panel;
  rounded(ctx, card.x + 5, card.y + 5, card.width - 10, card.height - 10, 38);
  ctx.fill();
  ctx.restore();

  const interior = ctx.createRadialGradient(centre, 930, 25, centre, 930, 343);
  interior.addColorStop(0, theme.accent + "36");
  interior.addColorStop(1, theme.accent + "00");
  ctx.fillStyle = interior;
  ctx.fillRect(card.x + 20, card.y + 80, card.width - 40, card.height - 160);
  ctx.drawImage(frame, card.x, card.y, card.width, card.height);

  ctx.save();
  ctx.shadowColor = "#01040c";
  ctx.shadowBlur = 26;
  ctx.shadowOffsetY = 20;
  ctx.drawImage(jersey, centre - 218, 704, 436, 426.3);
  ctx.restore();

  text(ctx, position || sport, card.x + 79, 624, 29, "#ffffff", 96);
  text(
    ctx,
    label.toUpperCase(),
    card.x + card.width - 159,
    624,
    29,
    theme.accent,
    235,
  );
  text(ctx, name.toUpperCase(), centre, 1228, 59, "#f6f9ff", card.width - 98);
  if (location)
    text(
      ctx,
      location.toUpperCase(),
      centre,
      1305,
      27,
      "#c0cee7",
      card.width - 100,
    );

  text(
    ctx,
    label.toUpperCase() + "  ·  " + sport + "  ·  " + (position || "PLAYER"),
    centre,
    1542,
    33,
    "#e0e9fa",
  );
  ctx.strokeStyle = accent + "93";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(440, 1630);
  ctx.lineTo(640, 1630);
  ctx.stroke();
  text(ctx, "docked.com.au", centre, 1710, 39, "#f0f4ff");

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) =>
        blob ? resolve(blob) : reject(new Error("Image could not be saved")),
      "image/png",
    );
  });
}
