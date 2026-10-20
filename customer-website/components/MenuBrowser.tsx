'use client';
import { useMemo, useState } from 'react';
import { BookOpen, RotateCcw, Search } from 'lucide-react';
import SearchBar from './SearchBar';
import FilterToggle from './FilterToggle';
import CategorySection from './CategorySection';
import CategoryNav from './CategoryNav';
import { filterMenuItems, type FilterableFoodItem } from '@/lib/menuFilter';

export interface MenuCategory {
  id: string;
  name: string;
  display_order: number;
  items: FilterableFoodItem[];
}
export default function MenuBrowser({
  categories,
}: {
  categories: MenuCategory[];
}) {
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [badgeFilter, setBadgeFilter] = useState<'veg' | 'non_veg' | null>(
    null,
  );
  const matchingCategories = useMemo(() => {
    if (!searchTerm && badgeFilter === null)
      return categories.filter((category) => category.items.length > 0);
    return categories
      .map((category) => ({
        ...category,
        items: filterMenuItems(category.items, searchTerm, badgeFilter),
      }))
      .filter((category) => category.items.length > 0);
  }, [categories, searchTerm, badgeFilter]);
  const filteredCategories = useMemo(
    () =>
      categoryId === null
        ? matchingCategories
        : matchingCategories.filter((category) => category.id === categoryId),
    [matchingCategories, categoryId],
  );
  const total = categories.reduce(
    (sum, category) => sum + category.items.length,
    0,
  );
  const matches = filteredCategories.reduce(
    (sum, category) => sum + category.items.length,
    0,
  );
  const active = !!searchTerm || badgeFilter !== null || categoryId !== null;
  const categoryCount = categories.filter(
    (category) => category.items.length > 0,
  ).length;
  const nav = useMemo(
    () =>
      categories
        .filter((c) => c.items.length > 0)
        .map((c) => ({
          id: c.id,
          name: c.name,
          count: c.items.length,
        })),
    [categories],
  );
  function reset() {
    setSearchTerm('');
    setBadgeFilter(null);
    setCategoryId(null);
  }
  return (
    <div className="menu-content" id="menu">
      <div className="cafe-menu-heading">
        <div>
          <p className="cafe-section-label">FOOD & DRINKS</p>
          <h2>
            Our menu<span aria-hidden="true">.</span>
          </h2>
        </div>
        <p>
          {total} {total === 1 ? 'dish' : 'dishes'}
          <span> / </span>
          {categoryCount} {categoryCount === 1 ? 'category' : 'categories'}
        </p>
      </div>
      <div className="menu-toolbar">
        <div className="menu-tools">
          <div className="menu-search-wrap">
            <SearchBar value={searchTerm} onChange={setSearchTerm} />
          </div>
          <FilterToggle activeFilter={badgeFilter} onChange={setBadgeFilter} />
        </div>
        {nav.length > 0 && (
          <div className="menu-nav-wrap">
            <CategoryNav
              categories={nav}
              selectedId={categoryId}
              onChange={setCategoryId}
              total={total}
            />
          </div>
        )}
        {active && (
          <div className="menu-filter-summary">
            <p role="status">
              {matches} of {total} items matching
            </p>
            {matches > 0 && (
              <button
                type="button"
                onClick={reset}
                title="Clear filters"
                aria-label="Clear filters"
              >
                <RotateCcw size={15} />
              </button>
            )}
          </div>
        )}
      </div>
      <div
        className="menu-sections"
        id="category-panel"
        role="tabpanel"
        aria-labelledby={categoryId ? `tab-${categoryId}` : 'tab-all'}
      >
        {filteredCategories.map((category, index) => (
          <CategorySection key={category.id} {...category} index={index + 1} />
        ))}
      </div>
      {active && matches === 0 && (
        <div className="menu-empty">
          <Search size={32} strokeWidth={1.5} />
          <h3>No dishes found</h3>
          <p>Try a different search or change filters</p>
          <button type="button" className="cafe-reset" onClick={reset}>
            <RotateCcw size={16} />
            Clear filters
          </button>
        </div>
      )}
      {!active && total === 0 && (
        <div className="menu-empty">
          <BookOpen size={32} strokeWidth={1.5} />
          <h3>Our menu is being prepared</h3>
          <p>We are setting things up, check back soon!</p>
        </div>
      )}
      <footer className="menu-footer">
        <BookOpen size={22} strokeWidth={1.3} aria-hidden="true" />
        <p>Thank you for stopping by.</p>
        <a
          href="https://restroqr.thekartiksharma.in"
          target="_blank"
          rel="noopener noreferrer"
        >
          Powered by <strong>RestroQR</strong>
        </a>
      </footer>
    </div>
  );
}
