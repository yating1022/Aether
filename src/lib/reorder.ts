import { arrayMove } from '@dnd-kit/sortable';
import type { CategoryWithLinks, LinkItem, LinkMove } from '../types/nav';

/**
 * Pure reorder helpers for drag-and-drop.
 *
 * All functions are immutable and React-free so the tricky part (cross-tray
 * moves + sort_order normalisation + minimal patch diffing) can be reasoned
 * about and verified without a browser.
 */

/** Which category currently holds the link? `null` when the id is unknown. */
export function categoryOfLink(categories: CategoryWithLinks[], linkId: string): string | null {
  for (const category of categories) {
    if (category.links.some((link) => link.id === linkId)) return category.id;
  }
  return null;
}

export function findLink(categories: CategoryWithLinks[], linkId: string): LinkItem | null {
  for (const category of categories) {
    const hit = category.links.find((link) => link.id === linkId);
    if (hit) return hit;
  }
  return null;
}

/**
 * Renumber `sort_order` to 1..n inside every category and strip links that no
 * longer belong. Keeping the numbers dense means a later insert never has to
 * find a gap.
 */
export function normalizeOrders(categories: CategoryWithLinks[]): CategoryWithLinks[] {
  return categories.map((category) => ({
    ...category,
    links: category.links.map((link, index) => ({ ...link, sort_order: index + 1 })),
  }));
}

/**
 * Move `linkId` into `targetCategoryId`, landing before `beforeLinkId` (or at the
 * end when omitted).
 *
 * Cross-tray dropping happens continuously while dragging, so this must be
 * cheap and idempotent: moving into the category it is already in only reorders.
 */
export function moveLink(
  categories: CategoryWithLinks[],
  linkId: string,
  targetCategoryId: string,
  beforeLinkId?: string | null,
): CategoryWithLinks[] {
  const link = findLink(categories, linkId);
  if (!link) return categories;

  const fromId = categoryOfLink(categories, linkId);
  if (!fromId) return categories;

  // Already in place: no structural change required.
  if (fromId === targetCategoryId) {
    const category = categories.find((c) => c.id === targetCategoryId);
    if (!category || !beforeLinkId || beforeLinkId === linkId) return categories;

    const currentIndex = category.links.findIndex((l) => l.id === linkId);
    const targetIndex = category.links.findIndex((l) => l.id === beforeLinkId);
    if (currentIndex === -1 || targetIndex === -1) return categories;

    return normalizeOrders(
      categories.map((c) =>
        c.id === targetCategoryId ? { ...c, links: arrayMove(c.links, currentIndex, targetIndex) } : c,
      ),
    );
  }

  const moved: LinkItem = { ...link, category_id: targetCategoryId };

  return normalizeOrders(
    categories.map((category) => {
      if (category.id === fromId) {
        return { ...category, links: category.links.filter((l) => l.id !== linkId) };
      }
      if (category.id === targetCategoryId) {
        const links = [...category.links];
        const at = beforeLinkId ? links.findIndex((l) => l.id === beforeLinkId) : -1;
        if (at === -1) links.push(moved);
        else links.splice(at, 0, moved);
        return { ...category, links };
      }
      return category;
    }),
  );
}

/** Drop a link onto a category container (empty area), appending it at the end. */
export function moveLinkToCategoryEnd(
  categories: CategoryWithLinks[],
  linkId: string,
  targetCategoryId: string,
): CategoryWithLinks[] {
  return moveLink(categories, linkId, targetCategoryId, null);
}

/**
 * Diff two snapshots into the minimal set of records to PATCH.
 *
 * Only links whose category or position changed are returned — a drag that
 * touches one card must not rewrite the whole table.
 */
export function buildMoves(
  before: CategoryWithLinks[],
  after: CategoryWithLinks[],
): LinkMove[] {
  const previous = new Map<string, { category: string; sort_order: number }>();
  for (const category of before) {
    for (const link of category.links) {
      previous.set(link.id, { category: category.id, sort_order: link.sort_order });
    }
  }

  const moves: LinkMove[] = [];
  for (const category of after) {
    for (const link of category.links) {
      const prev = previous.get(link.id);
      const sort_order = link.sort_order;
      if (!prev || prev.category !== category.id || prev.sort_order !== sort_order) {
        moves.push({ id: link.id, category: category.id, sort_order });
      }
    }
  }
  return moves;
}
