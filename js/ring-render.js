// Kamya DP ring — composites the user's photo inside the two real brand ring
// overlays (Classic = thin curved title text, Bold = thick uppercase band).
// The overlay PNGs have a genuinely transparent inner disc, so the photo shows
// through it; everything outside the ring is white.
export const STYLE_ORDER = [
  { key: 'classic', label: 'Classic' },
  { key: 'bold', label: 'Bold' },
];

// Ring overlay artwork + the radius (as a fraction of the square) at which each
// overlay's transparent inner disc ends. Must match how the assets were cut so
// the photo fills the hole exactly with no gap or overlap.
const RING = {
  classic: { src: 'assets/classic-ring.png', inner: 0.404 },
  bold: { src: 'assets/bold-ring.png', inner: 0.384 },
};

const ringCache = {};
function getRingImage(key) {
  if (!ringCache[key]) {
    const img = new Image();
    img.src = (RING[key] || RING.classic).src;
    ringCache[key] = img;
  }
  return ringCache[key];
}
// Kick off loading both overlays immediately so first render is instant.
Object.keys(RING).forEach(getRingImage);

function coverFit(iw, ih, boxSize) {
  return iw / ih > 1 ? { dw: boxSize * iw / ih, dh: boxSize } : { dw: boxSize, dh: boxSize * ih / iw };
}

export function drawInnerImage(ctx, img, { cx, cy, innerR }) {
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, innerR, 0, Math.PI * 2);
  ctx.closePath();
  ctx.clip();
  const iw = img.naturalWidth || img.width, ih = img.naturalHeight || img.height;
  const { dw, dh } = coverFit(iw, ih, innerR * 2);
  ctx.drawImage(img, cx - dw / 2, cy - dh / 2, dw, dh);
  ctx.restore();
}

// Placeholder shown in the inner disc when there is no photo yet (e.g. the
// style swatches). Neutral silhouette on a soft cream fill.
export function drawSilhouette(ctx, { cx, cy, innerR, bg = '#F3E7DD', fg = '#DCB492', bust = 0 }) {
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, innerR, 0, Math.PI * 2);
  ctx.closePath();
  ctx.clip();
  ctx.fillStyle = bg;
  ctx.fillRect(cx - innerR, cy - innerR, innerR * 2, innerR * 2);
  ctx.fillStyle = fg;
  const headR = innerR * (0.30 + bust * 0.02);
  const headY = cy - innerR * (0.22 - bust * 0.03);
  ctx.beginPath();
  ctx.arc(cx, headY, headR, 0, Math.PI * 2);
  ctx.fill();
  const shW = innerR * (0.56 + bust * 0.08);
  const shTop = cy + innerR * (0.18 + bust * 0.02);
  ctx.beginPath();
  ctx.moveTo(cx - shW, cy + innerR * 1.1);
  ctx.quadraticCurveTo(cx - shW, shTop, cx, shTop - innerR * 0.05);
  ctx.quadraticCurveTo(cx + shW, shTop, cx + shW, cy + innerR * 1.1);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

// transform: { ox, oy, scale, rot } — pan offset as a fraction of the square,
// zoom scale (>=1), and rotation in radians. Applied to the photo inside the
// inner disc so the user can frame their shot live within the ring.
export function renderKamyaRing(canvas, { size, styleKey = 'classic', img, transform, silhouette }) {
  const ctx = canvas.getContext('2d');
  canvas.width = size;
  canvas.height = size;
  const key = RING[styleKey] ? styleKey : 'classic';
  const cx = size / 2, cy = size / 2;
  const innerR = RING[key].inner * size;
  const hasPhoto = img && (img.complete !== false) && ((img.naturalWidth || img.width) > 0);

  const paint = () => {
    ctx.clearRect(0, 0, size, size);
    // White everywhere first → the area outside the ring stays white.
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, size, size);
    // Fill the inner disc with the photo (the DP) or a placeholder silhouette.
    if (hasPhoto) {
      const t = transform || {};
      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, innerR, 0, Math.PI * 2);
      ctx.closePath();
      ctx.clip();
      ctx.translate(cx + (t.ox || 0) * size, cy + (t.oy || 0) * size);
      ctx.rotate(t.rot || 0);
      const sc = t.scale || 1;
      ctx.scale(sc, sc);
      const iw = img.naturalWidth || img.width, ih = img.naturalHeight || img.height;
      // cover-fit to the inner diameter → min side = 2*innerR, which keeps the
      // circle fully covered at any rotation while scale >= 1.
      const { dw, dh } = coverFit(iw, ih, innerR * 2);
      ctx.drawImage(img, -dw / 2, -dh / 2, dw, dh);
      ctx.restore();
    } else {
      drawSilhouette(ctx, { cx, cy, innerR, bg: (silhouette && silhouette.bg), fg: (silhouette && silhouette.fg), bust: (silhouette && silhouette.bust) || 0 });
    }
    // Ring overlay ON TOP — the ring/logo always overlaps the photo, never the
    // other way around. Its transparent inner disc lets the photo show through.
    const ring = getRingImage(key);
    if (ring.complete && ring.naturalWidth) ctx.drawImage(ring, 0, 0, size, size);
    else ring.addEventListener('load', () => ctx.drawImage(ring, 0, 0, size, size), { once: true });
  };

  paint();
  return canvas;
}
