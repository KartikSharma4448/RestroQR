'use client';

import { useState, useMemo } from 'react';
import SearchBar from './SearchBar';
import LiveOrderBoard from './LiveOrderBoard';
import FilterToggle from './FilterToggle';
import CategorySection from './CategorySection';
import CategoryNav from './CategoryNav';
import OrderCartBar from './OrderCartBar';
import { CartProvider } from './CartContext';
import { filterMenuItems, type FilterableFoodItem } from '@/lib/menuFilter';


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
      <LiveOrderBoard restaurantToken={restaurantToken} />
      <TableMenuContentInner categories={categories} />
      <OrderCartBar tableToken={tableToken} restaurantToken={restaurantToken} />
    </CartProvider>
  );
}

function TableMenuContentInner({ categories }: { categories: Category[] }) {
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

  // Category navigation items (simplified for CategoryNav)
  const navCategories = useMemo(() => {
    return filteredCategories.map((c) => ({ id: c.id, name: c.name }));
  }, [filteredCategories]);

  return (
    <div className="menu-content">
      {/* Search, Filter, and Category Nav — sticky */}
      <div className="menu-toolbar">
        <div className="menu-tools">
          <div className="flex-1">
            <SearchBar value={searchTerm} onChange={setSearchTerm} />
          </div>
          <FilterToggle activeFilter={badgeFilter} onChange={setBadgeFilter} />
        </div>
        
        {/* Horizontal Category Nav */}
        {!noResults && navCategories.length > 0 && (
          <div className="menu-nav-wrap">
            <CategoryNav categories={navCategories} />
          </div>
        )}

        {/* Item count */}
        <p className="menu-count">
          {hasActiveFilters
            ? `${filteredCategories.reduce((acc, c) => acc + c.items.length, 0)} of ${totalItems} items matching`
            : `${totalItems} items • ${categories.length} categories`}
        </p>
      </div>

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
        <div className="menu-empty">
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
        <div className="menu-empty">
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
      <div className="menu-footer">
        <p className="text-xs text-slate-400 font-medium">
          Powered by <span className="brand-accent">RestroQR</span>
        </p>
      </div>
    </div>
  );
}
