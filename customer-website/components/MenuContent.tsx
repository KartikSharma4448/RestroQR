'use client';

import { useState, useMemo } from 'react';
import SearchBar from './SearchBar';
import FilterToggle from './FilterToggle';
import CategorySection from './CategorySection';
import { filterMenuItems, type FilterableFoodItem } from '@/lib/menuFilter';

interface Category {
  id: string;
  name: string;
  display_order: number;
  items: FilterableFoodItem[];
}

interface MenuContentProps {
  categories: Category[];
}

export default function MenuContent({ categories }: MenuContentProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [badgeFilter, setBadgeFilter] = useState<'veg' | 'non_veg' | null>(null);

  const filteredCategories = useMemo(() => {
    // If no filters active, return all categories as-is
    if (searchTerm.length === 0 && badgeFilter === null) {
      return categories;
    }

    // Apply filters to each category's items
    return categories
      .map((category) => ({
        ...category,
        items: filterMenuItems(category.items, searchTerm, badgeFilter),
      }))
      .filter((category) => category.items.length > 0);
  }, [categories, searchTerm, badgeFilter]);

  const hasActiveFilters = searchTerm.length > 0 || badgeFilter !== null;
  const noResults = hasActiveFilters && filteredCategories.length === 0;

  return (
    <div className="px-4 pt-2">
      {/* Search and filter controls */}
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
        <div className="flex-1">
          <SearchBar value={searchTerm} onChange={setSearchTerm} />
        </div>
        <FilterToggle activeFilter={badgeFilter} onChange={setBadgeFilter} />
      </div>

      {/* Filtered menu items */}
      {filteredCategories.map((category) => (
        <CategorySection
          key={category.id}
          name={category.name}
          items={category.items}
        />
      ))}

      {/* No results message */}
      {noResults && (
        <p className="py-12 text-center text-gray-400">
          No items match your current search or filter.
        </p>
      )}

      {/* Empty menu (no filters active, no categories) */}
      {!hasActiveFilters && categories.length === 0 && (
        <p className="py-12 text-center text-gray-400">
          This menu has no items yet.
        </p>
      )}
    </div>
  );
}
