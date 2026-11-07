import {
  cinemaPalettes,
  cinemaProfiles,
  cinemaV2Timing,
  type CinemaPhase,
  type CinemaTier,
} from "./pack-cinema-v2-model";

type Scene = { phase: CinemaPhase; tier: CinemaTier; reduced: boolean };
type Surface = {
  host: HTMLElement;
  back: HTMLCanvasElement;
  front: HTMLCanvasElement;
  card: HTMLElement;
};
const TAU = Math.PI * 2;
const clamp = (n: number) => Math.min(1, Math.max(0, n));
const ease = (n: number) => 1 - (1 - clamp(n)) ** 3;

function sprite(colour: string, hot: boolean) {
  const image = document.createElement("canvas");
  image.width = image.height = 128;
  const c = image.getContext("2d")!;
  const g = c.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, hot ? "#ffffff" : colour + "c0");
  g.addColorStop(0.08, colour + "ef");
  g.addColorStop(0.22, colour + "65");
  g.addColorStop(0.5, colour + "22");
  g.addColorStop(1, colour + "00");
  c.fillStyle = g;
  c.fillRect(0, 0, 128, 128);
  return image;
}

function beamSprite(colour: string) {
  const image = document.createElement("canvas");
  image.width = 96;
  image.height = 256;
  const c = image.getContext("2d")!;
  // Cache feathered edges and distance falloff instead of using hard polygons
  // or an expensive blur filter in the mobile animation loop.
  const width = c.createLinearGradient(0, 0, 96, 0);
  width.addColorStop(0, colour + "00");
  width.addColorStop(0.4, colour + "27");
  width.addColorStop(0.5, colour + "c0");
  width.addColorStop(0.6, colour + "27");
  width.addColorStop(1, colour + "00");
  c.fillStyle = width;
  c.fillRect(0, 0, 96, 256);
  c.globalCompositeOperation = "destination-in";
  const distance = c.createLinearGradient(0, 0, 0, 256);
  distance.addColorStop(0, "#ffffff00");
  distance.addColorStop(0.12, "#ffffffff");
  distance.addColorStop(0.55, "#ffffff7a");
  distance.addColorStop(1, "#ffffff00");
  c.fillStyle = distance;
  c.fillRect(0, 0, 96, 256);
  return image;
}

/** Two additive canvas planes surround the real DOM card. No issuance, network,
 * WebGL dependency, random award selection or React updates in the frame loop. */
export function createCinemaVfx(surface: Surface, initial: Scene) {
  const back = surface.back.getContext("2d", { alpha: true });
  const front = surface.front.getContext("2d", { alpha: true });
  if (!back || !front) return { update: () => {}, destroy: () => {} };
  let scene = initial;
  let phaseAt = performance.now();
  const createdAt = phaseAt;
  let width = 0,
    height = 0,
    cardWidth = 0,
    cardHeight = 0,
    dpr = 1;
  let frame = 0,
    stopped = false,
    last = 0,
    frames = 0,
    slow = 0;
  let balanced = (navigator.hardwareConcurrency ?? 8) <= 4;
  let economy = (navigator.hardwareConcurrency ?? 8) <= 2;
  let lastDraw = 0;
  let renderTotal = 0;
  let overBudget = 0;
  let palette = cinemaPalettes[scene.tier];
  let glow = sprite(palette.main, false),
    star = sprite(palette.hot, true);
  const blue = sprite("#6dafff", false);
  let rayTexture = beamSprite(palette.main);
  const blueRay = beamSprite("#8ccfff");
  const fog = sprite(palette.haze, false);
  let seed = 572199;
  const random = () => {
    seed = (Math.imul(1664525, seed) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  // Seeded decoration, wholly independent of the receipt or pack randomness.
  const particles = Array.from({ length: 210 }, (_, i) => ({
    angle: random() * TAU,
    distance: random(),
    size: 0.6 + random() * 2.4,
    speed: 0.18 + random() * 0.38,
    phase: random(),
    depth: random(),
    index: i,
  }));
  const beams = Array.from({ length: 36 }, () => ({
    angle: random() * TAU,
    width: 0.007 + random() * 0.045,
    length: 0.4 + random() * 0.6,
  }));

  function resize() {
    width = surface.host.clientWidth;
    height = surface.host.clientHeight;
    cardWidth = surface.card.offsetWidth;
    cardHeight = surface.card.offsetHeight;
    // Canvas effects need less resolution than the crisp DOM/SVG card face.
    dpr = Math.min(devicePixelRatio || 1, economy ? 0.75 : balanced ? 1 : 1.5);
    for (const canvas of [surface.back, surface.front]) {
      canvas.width = Math.max(1, Math.round(width * dpr));
      canvas.height = Math.max(1, Math.round(height * dpr));
    }
    surface.host.dataset.vfxQuality = economy
      ? "economy"
      : balanced
        ? "balanced"
        : "high";
    if (scene.reduced) draw(performance.now());
  }
  function light(
    c: CanvasRenderingContext2D,
    texture: HTMLCanvasElement,
    x: number,
    y: number,
    w: number,
    h: number,
    alpha: number,
  ) {
    if (alpha <= 0.001) return;
    c.globalAlpha = clamp(alpha);
    c.drawImage(texture, x - w / 2, y - h / 2, w, h);
  }
  function stroke(
    c: CanvasRenderingContext2D,
    path: Path2D,
    alpha: number,
    line = 1,
  ) {
    c.lineCap = "round";
    for (const [size, opacity, colour] of [
      [15, 0.06, palette.main],
      [7, 0.18, palette.main],
      [2.5, 0.9, palette.main],
      [0.8, 1, palette.hot],
    ] as const) {
      // Keep the hot core and coloured halo; omit only the widest faint pass on
      // severely constrained devices. The crisp SVG frame is never degraded.
      if (economy && size === 15) continue;
      c.globalAlpha = clamp(alpha * opacity);
      c.strokeStyle = colour;
      c.lineWidth = size * line;
      c.stroke(path);
    }
  }
  function draw(now: number) {
    if (!width || !height || stopped || !back || !front) return;
    const start = performance.now();
    const t = scene.reduced ? 0 : (now - createdAt) / 1000;
    const elapsed = scene.reduced ? 0 : (now - phaseAt) / 1000;
    const mystery = scene.phase === "mystery";
    const flipping = scene.phase === "flipping";
    const revealed = scene.phase === "revealed";
    const icon = scene.tier === "ICON" && !mystery;
    const profile = cinemaProfiles[scene.tier];
    const intensity = mystery ? 1 : profile.light;
    const settled = revealed && elapsed > 3;
    const charge =
      intensity *
      (mystery
        ? 0.1
        : revealed
          ? 0.48 + 0.52 * Math.exp(-elapsed * 1.7)
          : ease(
              elapsed /
                Math.min(0.65, cinemaV2Timing(scene.tier).rarity / 1200),
            ));
    const turn = clamp((elapsed * 1000) / cinemaV2Timing(scene.tier).flip);
    // One eased reveal pulse, never a repeating strobe.
    const flash =
      intensity *
      (scene.reduced
        ? 0
        : flipping
          ? Math.exp(-(((turn - 0.53) / 0.14) ** 2))
          : revealed
            ? 0.65 * Math.exp(-elapsed * 3)
            : 0);
    const impact = revealed && !scene.reduced ? ease(elapsed / 1.25) : 0;
    const cx = width / 2;
    const cy = (height - 42) / 2;
    const floor = Math.min(height - 25, cy + cardHeight / 2 + 33);
    for (const c of [back, front]) {
      c.setTransform(dpr, 0, 0, dpr, 0, 0);
      c.globalAlpha = 1;
      c.globalCompositeOperation = "source-over";
      c.clearRect(0, 0, width, height);
      c.globalCompositeOperation = "lighter";
    }
    const colourGlow = mystery ? blue : glow;
    light(back, colourGlow, cx, cy, width * 1.65, height * 1.32, 0.6 * charge);
    light(
      back,
      colourGlow,
      cx,
      floor,
      width * 1.5,
      height * 0.48,
      0.65 * charge,
    );
    // Stadium floodlights: long, softly feathered cones in the dark environment.
    for (let i = 0; i < (economy ? 2 : 4); i++) {
      const x = width * (0.06 + i * 0.29);
      const sway = Math.sin(t * 0.24 + i) * width * 0.1;
      back.save();
      back.translate(x, -30);
      back.rotate(-Math.atan2(cx + sway - x, height * 0.75));
      back.globalAlpha = 0.15 * intensity + charge * 0.25;
      back.drawImage(
        mystery ? blueRay : rayTexture,
        -width * 0.2,
        0,
        width * 0.4,
        height * 1.1,
      );
      back.restore();
      light(back, star, x, 13, 90, 14, 0.24 * charge);
    }
    // Atmospheric haze uses cached low-frequency sprites, with no per-frame blur.
    for (let i = 0; i < (economy ? 1 : balanced ? 3 : 5); i++) {
      light(
        back,
        mystery ? blue : fog,
        cx + Math.sin(t * 0.15 + i * 2.1) * width * 0.42,
        cy + Math.cos(t * 0.11 + i) * height * 0.3,
        width * 0.95,
        height * 0.37,
        charge * 0.35,
      );
    }
    // Elliptical illuminated platform and reflected frame streaks.
    const platform = new Path2D();
    platform.ellipse(
      cx,
      floor,
      Math.min(width * 0.42, cardWidth * 0.71),
      Math.max(9, cardHeight * 0.047),
      0,
      0,
      TAU,
    );
    if (!mystery) stroke(back, platform, charge * 0.8, 0.7);
    light(
      back,
      colourGlow,
      cx,
      floor + 10,
      cardWidth * 1.25,
      95,
      charge * 0.65,
    );
    for (const side of [-1, 1])
      light(
        back,
        colourGlow,
        cx + side * cardWidth * 0.38,
        floor + 7,
        27,
        90,
        0.4 * charge,
      );
    // Rays radiate from behind the card, lengthening at the turn midpoint.
    if (!mystery && !settled) {
      const rayCount = Math.min(
        profile.rays,
        economy ? 8 : balanced ? 16 : profile.rays,
      );
      for (let i = 0; i < rayCount; i++) {
        const ray = beams[i];
        const a = ray.angle + t * (icon ? -0.025 : 0.035);
        const length =
          Math.max(width, height) * (0.5 + flash * 0.4) * ray.length;
        back.save();
        back.translate(cx, cy);
        back.rotate(a - Math.PI / 2);
        back.globalAlpha =
          (charge * 0.24 + flash * 0.6) *
          (revealed ? Math.max(0.15, 1 - elapsed / 2) : 1);
        back.drawImage(
          rayTexture,
          -length * ray.width * 3,
          20,
          length * ray.width * 6,
          length,
        );
        back.restore();
      }
    }
    // Orbit paths are projected in 3D and split by depth. Their foreground half
    // passes IN FRONT of the card instead of being hidden under the DOM plane.
    const rings = mystery
      ? 0
      : Math.min(
          profile.rings,
          economy || settled ? 2 : balanced ? 3 : profile.rings,
        );
    for (let ring = 0; ring < rings; ring++) {
      const r =
        Math.min(width * 0.455, cardWidth * 0.76) *
        profile.ringScale *
        (1 - ring * 0.025);
      const rotation =
        [-0.38, 0.42, -0.82, 0.88, 1.35][ring] +
        t * (ring % 2 ? 0.22 : -0.18) +
        Math.sin(t * 0.4 + ring) * 0.08;
      const cosine = Math.cos(rotation),
        sine = Math.sin(rotation);
      const offsetY = (ring % 2 ? -1 : 1) * cardHeight * 0.12;
      const ry = cardHeight * (0.16 + (ring % 3) * 0.045);
      const ringOpacity = revealed
        ? Math.max(0.15, 1 - elapsed * 0.38)
        : charge;
      for (const isFront of [false, true]) {
        const ctx = isFront ? front : back;
        const path = new Path2D();
        let continuing = false;
        const segments = economy ? 40 : balanced ? 56 : 90;
        for (let n = 0; n <= segments; n++) {
          const a = (n / segments) * TAU;
          const z = Math.sin(a);
          if (z >= 0 !== isFront) {
            continuing = false;
            continue;
          }
          const ripple = Math.sin(a * 13 + t * 4 + ring) * 1.2;
          const x = Math.cos(a) * (r + ripple);
          const y = Math.sin(a) * ry;
          const px = cx + x * cosine - y * sine;
          const py = cy + offsetY + x * sine + y * cosine;
          if (continuing) path.lineTo(px, py);
          else path.moveTo(px, py);
          continuing = true;
        }
        stroke(
          ctx,
          path,
          ringOpacity * (isFront ? 0.78 : 0.8),
          icon ? 0.95 : 1,
        );
      }
      // A bright comet runs along each orbit, with a glowing short wake.
      const a = t * (1.1 + ring * 0.22) + ring * 1.7;
      const x = Math.cos(a) * r,
        y = Math.sin(a) * ry;
      const px = cx + x * cosine - y * sine;
      const py = cy + offsetY + x * sine + y * cosine;
      light(Math.sin(a) >= 0 ? front : back, star, px, py, 45, 45, ringOpacity);
    }
    // Depth-scaled sparks/crystals. Each has a trail; hero particles cross the
    // lens while distant sparks stay behind the card. Counts fall on slow hosts.
    const count = mystery
      ? 18
      : settled
        ? Math.min(26, profile.particles)
        : Math.min(
            profile.particles,
            economy ? 35 : balanced ? 85 : profile.particles,
          );
    for (let i = 0; i < count; i++) {
      const p = particles[i];
      const loop = (p.phase + t * p.speed * 0.22) % 1;
      const spread = mystery ? 0.6 : 0.55 + charge * 0.3 + impact * 0.65;
      const radius = (cardWidth * 0.45 + p.distance * width * 0.42) * spread;
      const a = p.angle + t * (icon ? 0.045 : -0.025);
      const px = cx + Math.cos(a) * radius;
      const py = cy + Math.sin(a) * radius * 1.18 - loop * height * 0.2;
      const ctx = p.depth > 0.68 ? front : back;
      const alpha =
        Math.sin(loop * Math.PI) *
        (mystery ? 0.25 : charge) *
        (revealed ? Math.max(0.15, 1 - elapsed * 0.3) : 1);
      const size = p.size * (0.5 + p.depth) * (icon ? 1.15 : 1);
      const trail = (5 + p.depth * 17) * (flipping || revealed ? 1.6 : 1);
      ctx.globalAlpha = clamp(alpha * 0.65);
      ctx.strokeStyle = mystery
        ? "#83cfff"
        : i % 5 === 0
          ? palette.hot
          : palette.main;
      ctx.lineWidth = size * 0.4;
      ctx.beginPath();
      ctx.moveTo(px, py);
      ctx.lineTo(px - Math.cos(a) * trail, py - Math.sin(a) * trail);
      ctx.stroke();
      light(
        ctx,
        mystery ? blue : star,
        px,
        py,
        size * 9,
        size * 9,
        alpha * 0.7,
      );
      ctx.globalAlpha = clamp(alpha);
      ctx.fillStyle = mystery ? "#e3f3ff" : palette.hot;
      if (!mystery && profile.crystals && i % 4 === 0) {
        ctx.beginPath();
        ctx.moveTo(px, py - size * 2.3);
        ctx.lineTo(px + size, py);
        ctx.lineTo(px, py + size * 2.3);
        ctx.lineTo(px - size, py);
        ctx.closePath();
        ctx.fill();
      } else ctx.fillRect(px, py, size * 0.7, size * 1.5);
    }
    // Lens stars sit outside the shell; the bright perimeter itself is SVG and
    // moves with the actual 3D card, so light never floats on a flat rectangle.
    if (!mystery)
      for (const side of [-1, 1]) {
        const px = cx + side * cardWidth * 0.46;
        const py = cy - side * cardHeight * 0.43;
        light(front, star, px, py, 125, 13, charge * 0.65);
        light(front, star, px, py, 13, 70, charge * 0.8);
        light(back, glow, px, py, 100, 100, charge * 0.65);
      }
    if (flash > 0.01) {
      light(back, glow, cx, cy, width * 2.5, height * 1.6, flash);
      light(front, star, cx, cy, width * 1.65, width * 1.65, flash * 0.82);
      light(front, star, cx, cy, width * 2, 32, flash);
    }
    if (revealed && elapsed < 1.5 && !scene.reduced) {
      const shock = new Path2D();
      shock.ellipse(
        cx,
        cy,
        Math.max(1, width * impact),
        Math.max(1, height * 0.72 * impact),
        -0.2,
        0,
        TAU,
      );
      stroke(front, shock, 0.6 * (1 - impact), 0.7);
    }
    back.globalAlpha = front.globalAlpha = 1;
    frames++;
    const cost = performance.now() - start;
    renderTotal += cost;
    overBudget = cost > 7 ? overBudget + 1 : Math.max(0, overBudget - 0.5);
    if (frames % 30 === 0) {
      surface.host.dataset.vfxFrames = String(frames);
      surface.host.dataset.vfxRenderMs = (renderTotal / frames).toFixed(2);
    }
  }
  function tick(now: number) {
    if (stopped || document.hidden) {
      frame = 0;
      return;
    }
    if (last && now - last > 27 && now - last < 100) slow++;
    else slow = Math.max(0, slow - 0.25);
    last = now;
    if (!balanced && (slow >= 18 || overBudget >= 10)) {
      balanced = true;
      slow = overBudget = 0;
      resize();
    } else if (balanced && !economy && (slow >= 24 || overBudget >= 12)) {
      economy = true;
      resize();
    }
    // Preserve the DOM card's full-rate 3D movement while bounding expensive
    // atmospheric drawing to ~30fps on the fallback. No React/timeline changes.
    if (!economy || scene.reduced || !lastDraw || now - lastDraw >= 30) {
      draw(now);
      lastDraw = now;
    }
    if (!scene.reduced) frame = requestAnimationFrame(tick);
    else frame = 0;
  }
  function restart() {
    cancelAnimationFrame(frame);
    last = 0;
    lastDraw = 0;
    if (!document.hidden && !stopped) frame = requestAnimationFrame(tick);
  }
  const observer = new ResizeObserver(resize);
  observer.observe(surface.host);
  observer.observe(surface.card);
  document.addEventListener("visibilitychange", restart);
  resize();
  restart();
  return {
    update(next: Scene) {
      if (next.phase !== scene.phase) phaseAt = performance.now();
      if (next.tier !== scene.tier) {
        palette = cinemaPalettes[next.tier];
        glow = sprite(palette.main, false);
        star = sprite(palette.hot, true);
        rayTexture = beamSprite(palette.main);
      }
      const wasReduced = scene.reduced;
      scene = next;
      if (scene.reduced || wasReduced !== scene.reduced || !frame) restart();
    },
    destroy() {
      stopped = true;
      cancelAnimationFrame(frame);
      observer.disconnect();
      document.removeEventListener("visibilitychange", restart);
      // Release backing-store memory when the viewer closes.
      surface.back.width = surface.front.width = 1;
      surface.back.height = surface.front.height = 1;
    },
  };
}
