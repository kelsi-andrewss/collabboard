const CARD_WIDTH = 240;
const MAX_CARD_HEIGHT = 320;
const GAP = 16;
const COLUMNS = 3;
const START_X = 50;
const START_Y = 50;

function parseHue(hex) {
  if (!hex || typeof hex !== 'string') return 0;
  const raw = hex.replace('#', '');
  if (raw.length !== 6) return 0;
  const r = parseInt(raw.slice(0, 2), 16) / 255;
  const g = parseInt(raw.slice(2, 4), 16) / 255;
  const b = parseInt(raw.slice(4, 6), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  if (d === 0) return 0;
  let h;
  if (max === r) h = ((g - b) / d) % 6;
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  return ((h * 60) + 360) % 360;
}

function cardHeight(obj) {
  const w = obj.width || CARD_WIDTH;
  const h = obj.height || CARD_WIDTH;
  const aspectRatio = h / w;
  return Math.min(MAX_CARD_HEIGHT, Math.round(CARD_WIDTH * aspectRatio));
}

export function computeMoodboardLayout(objects) {
  const items = objects.filter(o => !o.frameId);
  if (items.length === 0) return [];

  const sorted = [...items].sort((a, b) => parseHue(a.color) - parseHue(b.color));

  const colHeights = new Array(COLUMNS).fill(START_Y);

  const patches = sorted.map(obj => {
    const h = cardHeight(obj);
    let shortestCol = 0;
    for (let c = 1; c < COLUMNS; c++) {
      if (colHeights[c] < colHeights[shortestCol]) shortestCol = c;
    }
    const x = START_X + shortestCol * (CARD_WIDTH + GAP);
    const y = colHeights[shortestCol];
    colHeights[shortestCol] += h + GAP;
    return { id: obj.id, x, y, width: CARD_WIDTH, height: h };
  });

  return patches;
}
