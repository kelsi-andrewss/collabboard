// Pure math helpers — no React, no Firebase

export function regularPolygonVertices(cx, cy, radius, sides) {
  const pts = [];
  for (let i = 0; i < sides; i++) {
    const angle = (2 * Math.PI * i / sides) - Math.PI / 2;
    pts.push({ x: cx + radius * Math.cos(angle), y: cy + radius * Math.sin(angle) });
  }
  return pts;
}

export function perpendicularBisector(x1, y1, x2, y2, length) {
  const mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
  const dx = x2 - x1, dy = y2 - y1;
  const len = Math.hypot(dx, dy) || 1;
  const px = -dy / len, py = dx / len;
  const half = length / 2;
  return { x1: mx - px * half, y1: my - py * half, x2: mx + px * half, y2: my + py * half };
}

export function angleBisector(vx, vy, ax, ay, bx, by, length) {
  const la = Math.hypot(ax - vx, ay - vy) || 1;
  const lb = Math.hypot(bx - vx, by - vy) || 1;
  const ux = (ax - vx) / la + (bx - vx) / lb;
  const uy = (ay - vy) / la + (by - vy) / lb;
  const ul = Math.hypot(ux, uy) || 1;
  return { x1: vx, y1: vy, x2: vx + (ux / ul) * length, y2: vy + (uy / ul) * length };
}

export function tangentLines(cx, cy, radius, px, py) {
  const dx = px - cx, dy = py - cy;
  const dist = Math.hypot(dx, dy);
  if (dist <= radius) return [];
  const a = Math.acos(radius / dist);
  const b = Math.atan2(dy, dx);
  return [
    { x1: px, y1: py, x2: cx + radius * Math.cos(b + a), y2: cy + radius * Math.sin(b + a) },
    { x1: px, y1: py, x2: cx + radius * Math.cos(b - a), y2: cy + radius * Math.sin(b - a) },
  ];
}
