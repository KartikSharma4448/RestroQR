/**
 * Client-side menu filtering utility.
 * Filters food items by search term and/or badge filter.
 *
 * - Search: case-insensitive substring match on item name AND description
 * - Badge filter: matches exactly 'veg' or 'non_veg'
 * - Combined: intersection of search AND badge filter
 * - Clearing both (empty search + null badge) returns all items
 */

export interface FilterableFoodItem {
  id: string;
  name: string;
  description: string | null;
  price: number;
  image_url: string | null;
  badge: 'veg' | 'non_veg';
  is_available: boolean;
}

export function filterMenuItems(
  items: FilterableFoodItem[],
  searchTerm: string,
  badgeFilter: 'veg' | 'non_veg' | null,
): FilterableFoodItem[] {
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
