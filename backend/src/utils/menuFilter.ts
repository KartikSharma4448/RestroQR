/**
 * Client-side menu filtering utility.
 * Used by the Customer Website to filter and search food items.
 */

export interface FilterableMenuItem {
  id: string;
  name: string;
  description: string | null;
  price: string;
  imageUrl: string | null;
  badge: 'veg' | 'non_veg';
  isAvailable: boolean;
}

/**
 * Filters menu items by search term and/or badge filter.
 *
 * - Search is case-insensitive substring matching against name and description.
 * - Badge filter matches exactly ('veg' or 'non_veg').
 * - Combining search + badge returns the intersection.
 * - Clearing both (empty search + null badge) returns all items.
 */
export function filterMenuItems(
  items: FilterableMenuItem[],
  searchTerm: string,
  badgeFilter: 'veg' | 'non_veg' | null
): FilterableMenuItem[] {
  return items.filter((item) => {
    // Badge filter check
    if (badgeFilter !== null && item.badge !== badgeFilter) {
      return false;
    }

    // Search term check (case-insensitive substring on name and description)
    if (searchTerm.length > 0) {
      const term = searchTerm.toLowerCase();
      const nameMatch = item.name.toLowerCase().includes(term);
      const descMatch = item.description
        ? item.description.toLowerCase().includes(term)
        : false;
      if (!nameMatch && !descMatch) {
        return false;
      }
    }

    return true;
  });
}
