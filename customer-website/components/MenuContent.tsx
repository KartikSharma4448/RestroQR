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
    if (searchTerm.length === 0 && badgeFilter === null) {
      return categories;
    }
    return categories
      .map((category) => ({
        ...category,
        items: filterMenuItems(category.items, searchTerm, badgeFilter),
      }))
      .filter((category) => category.items.length > 0);
  }, [categories, searchTerm, badgeFilter]);

  const hasActiveFilters = searchTerm.length > 0 || badgeFilter !== null;
  const noResults = hasActiveFilters && filteredCategories.length === 0;

  const totalItems = categories.reduce((acc, cat) => acc + cat.items.length, 0);

  return (
    <div className="px-4 pt-4">
      {/* Search and filter controls */}
      <div className="sticky top-0 z-10 -mx-4 mb-6 border-b border-gray-100 bg-gray-50/95 px-4 py-3 backdrop-blur-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
          <div className="flex-1">
            <SearchBar value={searchTerm} onChange={setSearchTerm} />
          </div>
          <FilterToggle activeFilter={badgeFilter} onChange={setBadgeFilter} />
        </div>
        {/* Item count */}
        <p className="mt-2 text-xs text-gray-400">
          {hasActiveFilters
            ? `${filteredCategories.reduce((acc, c) => acc + c.items.length, 0)} of ${totalItems} items`
            : `${totalItems} items • ${categories.length} categories`}
        </p>
      </div>

      {/* Menu items */}
      {filteredCategories.map((category) => (
        <CategorySection
          key={category.id}
          name={category.name}
          items={category.items}
        />
      ))}

      {/* No results message */}
      {noResults && (
        <div className="flex flex-col items-center py-16">
          <svg className="h-12 w-12 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
          </svg>
          <p className="mt-4 text-base font-medium text-gray-500">No items found</p>
          <p className="mt-1 text-sm text-gray-400">Try a different search or filter</p>
        </div>
      )}

      {/* Empty menu */}
      {!hasActiveFilters && categories.length === 0 && (
        <div className="flex flex-col items-center py-16">
          <svg className="h-12 w-12 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
          </svg>
          <p className="mt-4 text-base font-medium text-gray-500">Menu is being prepared</p>
          <p className="mt-1 text-sm text-gray-400">Check back soon!</p>
        </div>
      )}

      {/* Footer branding */}
      <div className="mt-8 border-t border-gray-100 py-6 text-center">
        <p className="text-xs text-gray-400">Powered by <span className="font-semibold text-orange-500">RestroQR</span></p>
      </div>
    </div>
  );
}
