export const toSlug = (str) =>
  str.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');

export const findGroupBySlug = (groupsOrBoards, slug) => {
  if (groupsOrBoards.length > 0 && groupsOrBoards[0]?.slug !== undefined) {
    return groupsOrBoards.find(g => g.slug === slug) || null;
  }
  const name = groupsOrBoards.find(b => b.group && toSlug(b.group) === slug)?.group ?? null;
  return name;
};

export const buildSlugChain = (group, allGroups) => {
  const chain = [];
  let current = group;
  while (current) {
    chain.unshift(current.slug || toSlug(current.name));
    if (!current.parentGroupId) break;
    current = allGroups.find(g => g.id === current.parentGroupId) || null;
  }
  return chain;
};

export const resolveSlugChain = (slugChain, allGroups) => {
  if (!slugChain || slugChain.length === 0) return null;
  let current = allGroups.find(g => g.slug === slugChain[0] && !g.parentGroupId) || null;
  for (let i = 1; i < slugChain.length; i++) {
    if (!current) return null;
    current = allGroups.find(g => g.slug === slugChain[i] && g.parentGroupId === current.id) || null;
  }
  return current;
};

export const isSlugTaken = (slug, parentGroupId, allGroups, excludeGroupId) => {
  return allGroups.some(g => {
    if (excludeGroupId && g.id === excludeGroupId) return false;
    if (g.slug !== slug) return false;
    if (parentGroupId) return g.parentGroupId === parentGroupId;
    return !g.parentGroupId;
  });
};
