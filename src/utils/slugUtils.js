export const UNGROUPED_SLUG = '__ungrouped__';

export const toSlug = (str) =>
  str.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');

export const groupToSlug = (group) =>
  group ? toSlug(group) : UNGROUPED_SLUG;

export const findGroupBySlug = (allBoards, slug) => {
  if (slug === UNGROUPED_SLUG) return null;
  return allBoards.find(b => b.group && toSlug(b.group) === slug)?.group ?? null;
};
