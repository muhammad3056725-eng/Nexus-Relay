/**
 * NEXUS RELAY — 12 domain silhouettes as smooth vector glyphs.
 * Each domain is drawn with clean canvas paths (arcs, rounded forms
 * and strokes) inside the box at (x, y) sized 16 * scale — used for
 * the revealed entity in the signal core and on Relic Cards.
 */

type Ctx = CanvasRenderingContext2D;

function path(ctx: Ctx, draw: () => void, color: string, fill = true): void {
  ctx.beginPath();
  draw();
  if (fill) {
    ctx.fillStyle = color;
    ctx.fill();
  } else {
    ctx.strokeStyle = color;
    ctx.stroke();
  }
}

/** Draw the smooth vector glyph for domain `dom` in a 16*scale box. */
export function drawGlyph(
  ctx: Ctx,
  dom: number,
  x: number,
  y: number,
  scale: number,
  color: string
): void {
  const u = scale; // one glyph unit
  const cx = x + 8 * u;
  const cy = y + 8 * u;
  ctx.save();
  ctx.lineWidth = Math.max(1, 1.4 * u);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  switch (dom) {
    case 1: // History — column
      path(ctx, () => { ctx.moveTo(x + 3 * u, y + 2.5 * u); ctx.lineTo(x + 13 * u, y + 2.5 * u); ctx.lineTo(x + 11 * u, y + 5 * u); ctx.lineTo(x + 5 * u, y + 5 * u); ctx.closePath(); }, color);
      ctx.fillStyle = color;
      for (const px of [5.2, 7.6, 10]) ctx.fillRect(x + px * u, y + 5.8 * u, 1.2 * u, 5 * u);
      path(ctx, () => { ctx.moveTo(x + 3 * u, y + 13.5 * u); ctx.lineTo(x + 13 * u, y + 13.5 * u); ctx.lineTo(x + 11 * u, y + 11 * u); ctx.lineTo(x + 5 * u, y + 11 * u); ctx.closePath(); }, color);
      break;
    case 2: // Geography — mountain & flag
      path(ctx, () => { ctx.moveTo(x + 1 * u, y + 14 * u); ctx.lineTo(x + 6.5 * u, y + 5 * u); ctx.lineTo(x + 9.5 * u, y + 9.5 * u); ctx.lineTo(x + 11.5 * u, y + 6.5 * u); ctx.lineTo(x + 15 * u, y + 14 * u); ctx.closePath(); }, color);
      path(ctx, () => { ctx.moveTo(x + 8 * u, y + 1.5 * u); ctx.lineTo(x + 8 * u, y + 6 * u); }, color, false);
      path(ctx, () => { ctx.moveTo(x + 8 * u, y + 1.5 * u); ctx.lineTo(x + 12 * u, y + 3 * u); ctx.lineTo(x + 8 * u, y + 4.5 * u); ctx.closePath(); }, color);
      break;
    case 3: // Science & Tech — atom
      for (const rot of [0, Math.PI / 3, (2 * Math.PI) / 3]) {
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(rot);
        path(ctx, () => ctx.ellipse(0, 0, 7 * u, 2.8 * u, 0, 0, Math.PI * 2), color, false);
        ctx.restore();
      }
      path(ctx, () => ctx.arc(cx, cy, 1.6 * u, 0, Math.PI * 2), color);
      break;
    case 4: // Cinema — play screen
      ctx.beginPath(); ctx.roundRect(x + 2 * u, y + 3 * u, 12 * u, 10 * u, 2 * u); ctx.strokeStyle = color; ctx.stroke();
      path(ctx, () => { ctx.moveTo(x + 6.8 * u, y + 5.8 * u); ctx.lineTo(x + 11 * u, y + 8 * u); ctx.lineTo(x + 6.8 * u, y + 10.2 * u); ctx.closePath(); }, color);
      break;
    case 5: // Biology — leaf
      path(ctx, () => { ctx.moveTo(x + 3 * u, y + 13 * u); ctx.quadraticCurveTo(x + 2 * u, y + 4 * u, x + 13 * u, y + 2.5 * u); ctx.quadraticCurveTo(x + 14 * u, y + 12 * u, x + 3 * u, y + 13 * u); }, color);
      path(ctx, () => { ctx.moveTo(x + 4.5 * u, y + 11.5 * u); ctx.quadraticCurveTo(x + 8 * u, y + 7 * u, x + 12 * u, y + 4 * u); }, "#0B1226", false);
      break;
    case 6: // Music — note
      path(ctx, () => ctx.ellipse(x + 5.5 * u, y + 12 * u, 2.6 * u, 2 * u, -0.3, 0, Math.PI * 2), color);
      path(ctx, () => { ctx.moveTo(x + 8 * u, y + 12 * u); ctx.lineTo(x + 8 * u, y + 3 * u); ctx.quadraticCurveTo(x + 12 * u, y + 3.6 * u, x + 13.5 * u, y + 6 * u); ctx.lineTo(x + 8 * u, y + 5 * u); }, color, false);
      break;
    case 7: // Literature — open book
      path(ctx, () => { ctx.moveTo(cx, y + 4 * u); ctx.quadraticCurveTo(x + 4.5 * u, y + 2 * u, x + 2 * u, y + 3.5 * u); ctx.lineTo(x + 2 * u, y + 12.5 * u); ctx.quadraticCurveTo(x + 4.8 * u, y + 11 * u, cx, y + 12.8 * u); ctx.quadraticCurveTo(x + 11.2 * u, y + 11 * u, x + 14 * u, y + 12.5 * u); ctx.lineTo(x + 14 * u, y + 3.5 * u); ctx.quadraticCurveTo(x + 11.5 * u, y + 2 * u, cx, y + 4 * u); }, color, false);
      path(ctx, () => { ctx.moveTo(cx, y + 4 * u); ctx.lineTo(cx, y + 12.8 * u); }, color, false);
      break;
    case 8: // Sports — trophy
      path(ctx, () => { ctx.moveTo(x + 4.5 * u, y + 2.5 * u); ctx.lineTo(x + 11.5 * u, y + 2.5 * u); ctx.quadraticCurveTo(x + 11.5 * u, y + 8.5 * u, cx, y + 9 * u); ctx.quadraticCurveTo(x + 4.5 * u, y + 8.5 * u, x + 4.5 * u, y + 2.5 * u); }, color);
      path(ctx, () => ctx.arc(x + 3.6 * u, y + 4.5 * u, 1.9 * u, Math.PI * 0.4, Math.PI * 1.5), color, false);
      path(ctx, () => ctx.arc(x + 12.4 * u, y + 4.5 * u, 1.9 * u, -Math.PI * 0.5, Math.PI * 0.6), color, false);
      ctx.fillStyle = color; ctx.fillRect(cx - 0.7 * u, y + 9 * u, 1.4 * u, 2.4 * u); ctx.fillRect(x + 4.8 * u, y + 11.6 * u, 6.4 * u, 1.6 * u);
      break;
    case 9: // Art — palette arch
      path(ctx, () => ctx.arc(cx, cy, 6.4 * u, 0, Math.PI * 2), color, false);
      for (const [dx, dy] of [[-2.8, -2.2], [2.6, -2.8], [0.4, 2.6]] as const)
        path(ctx, () => ctx.arc(cx + dx * u, cy + dy * u, 1.25 * u, 0, Math.PI * 2), color);
      break;
    case 10: // Mythology & Philosophy — omega
      path(ctx, () => ctx.arc(cx, cy - 0.6 * u, 5.4 * u, Math.PI * 0.75, Math.PI * 2.25), color, false);
      path(ctx, () => { ctx.moveTo(x + 3.4 * u, y + 10.6 * u); ctx.lineTo(x + 2.2 * u, y + 13.6 * u); ctx.lineTo(x + 6.4 * u, y + 13.6 * u); }, color, false);
      path(ctx, () => { ctx.moveTo(x + 12.6 * u, y + 10.6 * u); ctx.lineTo(x + 13.8 * u, y + 13.6 * u); ctx.lineTo(x + 9.6 * u, y + 13.6 * u); }, color, false);
      break;
    case 11: // Space — rocket
      path(ctx, () => { ctx.moveTo(cx, y + 1.8 * u); ctx.quadraticCurveTo(x + 11 * u, y + 5 * u, x + 10.6 * u, y + 10.5 * u); ctx.lineTo(x + 5.4 * u, y + 10.5 * u); ctx.quadraticCurveTo(x + 5 * u, y + 5 * u, cx, y + 1.8 * u); }, color);
      path(ctx, () => ctx.arc(cx, y + 6.6 * u, 1.5 * u, 0, Math.PI * 2), "#0B1226");
      path(ctx, () => { ctx.moveTo(x + 6.8 * u, y + 12 * u); ctx.quadraticCurveTo(cx, y + 15 * u, x + 9.2 * u, y + 12 * u); }, color);
      break;
    case 12: // Cultural Inventions — gear / orbit cog
      path(ctx, () => ctx.arc(cx, cy, 3 * u, 0, Math.PI * 2), color, false);
      for (let k = 0; k < 8; k++) {
        const a = (k * Math.PI) / 4;
        path(ctx, () => { ctx.moveTo(cx + Math.cos(a) * 4.4 * u, cy + Math.sin(a) * 4.4 * u); ctx.lineTo(cx + Math.cos(a) * 6.6 * u, cy + Math.sin(a) * 6.6 * u); }, color, false);
      }
      path(ctx, () => ctx.arc(cx, cy, 1.3 * u, 0, Math.PI * 2), color);
      break;
    default:
      path(ctx, () => ctx.arc(cx, cy, 5.5 * u, 0, Math.PI * 2), color, false);
      path(ctx, () => ctx.arc(cx, cy, 1.6 * u, 0, Math.PI * 2), color);
  }
  ctx.restore();
}
