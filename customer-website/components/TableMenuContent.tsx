'use client';

import { useState, useMemo } from 'react';
import SearchBar from './SearchBar';
import FilterToggle from './FilterToggle';
import CategorySection from './CategorySection';
import CategoryNav from './CategoryNav';
import OrderCartBar from './OrderCartBar';
import { CartProvider } from './CartContext';
import { filterMenuItems, type FilterableFoodItem } from '@/lib/menuFilter';

import LoyaltyStarsCard from './LoyaltyStarsCard';
import LoyaltyPromptModal from './LoyaltyPromptModal';

interface Category {
  id: string;
  name: string;
  display_order: number;
  items: FilterableFoodItem[];
}

interface TableMenuContentProps {
  categories: Category[];
  tableToken: string;
  restaurantToken: string;
}

export default function TableMenuContent({ categories, tableToken, restaurantToken }: TableMenuContentProps) {
  return (
    <CartProvider>
      <TableMenuContentInner categories={categories} restaurantToken={restaurantToken} />
      <OrderCartBar tableToken={tableToken} restaurantToken={restaurantToken} />
    </CartProvider>
  );
}

function TableMenuContentInner({ categories, restaurantToken }: { categories: Category[]; restaurantToken: string }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [badgeFilter, setBadgeFilter] = useState<'veg' | 'non_veg' | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

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

  // Category navigation items (simplified for CategoryNav)
  const navCategories = useMemo(() => {
    return filteredCategories.map((c) => ({ id: c.id, name: c.name }));
  }, [filteredCategories]);

  return (
    <div className="px-4 pt-4 pb-28 bg-slate-50/30">
      {/* Search, Filter, and Category Nav — sticky */}
      <div className="sticky top-0 z-20 -mx-4 mb-8 border-b border-slate-100 bg-white/95 px-4 py-4 backdrop-blur-md shadow-md shadow-slate-100/50">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
          <div className="flex-1">
            <SearchBar value={searchTerm} onChange={setSearchTerm} />
          </div>
          <FilterToggle activeFilter={badgeFilter} onChange={setBadgeFilter} />
        </div>
        
        {/* Horizontal Category Nav */}
        {!noResults && navCategories.length > 0 && (
          <div className="mt-4 -mx-4 border-t border-slate-100/80 pt-3">
            <CategoryNav categories={navCategories} />
          </div>
        )}

        {/* Item count */}
        <p className="mt-2 text-[11px] font-bold text-slate-400">
          {hasActiveFilters
            ? `${filteredCategories.reduce((acc, c) => acc + c.items.length, 0)} of ${totalItems} items matching`
            : `${totalItems} items • ${categories.length} categories`}
        </p>
      </div>

      {/* Loyalty Stars Card */}
      <LoyaltyStarsCard key={refreshKey} restaurantToken={restaurantToken} />

      {/* Loyalty Registration Modal */}
      <LoyaltyPromptModal
        onJoin={() => setRefreshKey((prev) => prev + 1)}
        onSkip={() => {}}
      />

      {/* Menu items */}
      <div className="space-y-2">
        {filteredCategories.map((category) => (
          <CategorySection
            key={category.id}
            id={category.id}
            name={category.name}
            items={category.items}
          />
        ))}
      </div>

      {/* No results message */}
      {noResults && (
        <div className="flex flex-col items-center py-20 bg-white rounded-3xl border border-slate-100 p-8 shadow-sm">
          <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-slate-50">
            <svg className="h-10 w-10 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
            </svg>
          </div>
          <p className="mt-5 text-lg font-black text-slate-800">No dishes found</p>
          <p className="mt-1.5 text-sm text-slate-400 font-medium">Try a different search or change filters</p>
        </div>
      )}

      {/* Empty menu */}
      {!hasActiveFilters && categories.length === 0 && (
        <div className="flex flex-col items-center py-20 bg-white rounded-3xl border border-slate-100 p-8 shadow-sm">
          <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-amber-50">
            <svg className="h-10 w-10 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
            </svg>
          </div>
          <p className="mt-5 text-lg font-black text-slate-800">Our menu is being prepared</p>
          <p className="mt-1.5 text-sm text-slate-400 font-medium">We are setting things up, check back soon!</p>
        </div>
      )}

      {/* Footer branding */}
      <div className="mt-12 border-t border-slate-100 pt-8 text-center">
        <p className="text-xs text-slate-400 font-medium">
          Powered by <span className="font-extrabold text-orange-500 tracking-tight">RestroQR</span>
        </p>
      </div>
    </div>
  );
}
