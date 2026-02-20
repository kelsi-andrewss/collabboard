const SUBGROUP_CARD_HEIGHT = 200;
const BOARD_CARD_HEIGHT = 116;
const COLUMN_ITEM_GAP = 16;

export function formatDate(ts) {
  if (!ts) return '';
  const ms = ts.toMillis?.() ?? (ts.seconds ? ts.seconds * 1000 : null);
  if (!ms) return '';
  const d = new Date(ms);
  const now = Date.now();
  const diff = now - ms;
  if (diff < 60 * 1000) return 'just now';
  if (diff < 60 * 60 * 1000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 24 * 60 * 60 * 1000) return `${Math.floor(diff / 3600000)}h ago`;
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export function estimateItemHeight(item) {
  if (item.type === 'subgroup') return SUBGROUP_CARD_HEIGHT;
  return BOARD_CARD_HEIGHT;
}

export function distributeToColumns(items, columnCount) {
  const columns = Array.from({ length: columnCount }, () => ({ items: [], height: 0 }));
  for (const item of items) {
    const shortest = columns.reduce((min, col) => col.height < min.height ? col : min, columns[0]);
    shortest.items.push(item);
    shortest.height += estimateItemHeight(item) + COLUMN_ITEM_GAP;
  }
  return columns.map(c => c.items);
}

export const isAncestor = (candidateAncestorId, targetGroupId, allGroups) => {
  const visited = new Set();
  let current = allGroups.find(g => g.id === targetGroupId);
  while (current?.parentGroupId) {
    if (current.parentGroupId === candidateAncestorId) return true;
    if (visited.has(current.id)) return false;
    visited.add(current.id);
    current = allGroups.find(g => g.id === current.parentGroupId);
  }
  return false;
};
