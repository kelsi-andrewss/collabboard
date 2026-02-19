export const UNGROUPED_SLUG = '__ungrouped__';

export const toSlug = (str) =>
  str.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');

export const groupToSlug = (group) => {
  if (!group) return UNGROUPED_SLUG;
  if (typeof group === 'string') return toSlug(group);
  return group.slug || toSlug(group.name);
};

export const findGroupBySlug = (groupsOrBoards, slug) => {
  if (slug === UNGROUPED_SLUG) return null;
  // If array of group objects with .slug field
  if (groupsOrBoards.length > 0 && groupsOrBoards[0]?.slug !== undefined) {
    return groupsOrBoards.find(g => g.slug === slug) || null;
  }
  // Legacy: array of boards with .group string field
  const name = groupsOrBoards.find(b => b.group && toSlug(b.group) === slug)?.group ?? null;
  return name;
};
