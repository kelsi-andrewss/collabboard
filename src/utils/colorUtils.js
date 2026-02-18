export function darkenHex(hex, amount = 0.3) {
  if (!hex || !hex.startsWith('#')) return hex;
  const r = Math.round(parseInt(hex.slice(1, 3), 16) * (1 - amount));
  const g = Math.round(parseInt(hex.slice(3, 5), 16) * (1 - amount));
  const b = Math.round(parseInt(hex.slice(5, 7), 16) * (1 - amount));
  const toHex = (n) => n.toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

export function hexToRgba(hex, alpha) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

export function parseColorForInput(colorStr) {
  if (!colorStr) return '#000000';
  if (colorStr.startsWith('#')) return colorStr.slice(0, 7);
  const match = colorStr.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  if (match) {
    const toHex = (n) => parseInt(n).toString(16).padStart(2, '0');
    return `#${toHex(match[1])}${toHex(match[2])}${toHex(match[3])}`;
  }
  return '#000000';
}

export function parseOpacity(colorStr) {
  if (!colorStr) return 1;
  const match = colorStr.match(/rgba?\(\d+,\s*\d+,\s*\d+,\s*([\d.]+)\)/);
  return match ? parseFloat(match[1]) : 1;
}

export const SUGGESTED_COLORS = [
  // Warm pastels
  '#fef08a', '#fde68a', '#fed7aa', '#fecaca', '#fbcfe8',
  // Cool pastels
  '#bfdbfe', '#c7d2fe', '#e9d5ff', '#a7f3d0', '#d9f99d',
  // Vivid accents
  '#ef4444', '#f97316', '#eab308', '#22c55e', '#3b82f6',
  // Deep tones
  '#7c3aed', '#db2777', '#0d9488', '#1d4ed8', '#374151',
];

export function getContrastColor(hex) {
  if (!hex || !hex.startsWith('#')) return '#000000';
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  // Relative luminance (WCAG formula)
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.5 ? '#000000' : '#ffffff';
}

function hashCode(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  return hash;
}

export function getUserColor(uid) {
  const colors = ['#f87171', '#fb923c', '#fbbf24', '#a3e635', '#4ade80', '#2dd4bf', '#38bdf8', '#818cf8', '#c084fc', '#f472b6'];
  return colors[Math.abs(hashCode(uid)) % colors.length];
}
