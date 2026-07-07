'use client';

import { useEffect, useRef, useState } from 'react';

interface Category {
  id: string;
  name: string;
}

interface CategoryNavProps {
  categories: Category[];
}

export default function CategoryNav({ categories }: CategoryNavProps) {
  const [activeId, setActiveId] = useState<string>('');
  const navRef = useRef<HTMLDivElement>(null);

  // IntersectionObserver to set active category on scroll
  useEffect(() => {
    if (categories.length === 0) return;
    setActiveId(categories[0].id);

    const observerOptions = {
      root: null,
      rootMargin: '-110px 0px -60% 0px', // Matches the header/nav offset
      threshold: 0,
    };

    const handleIntersection = (entries: IntersectionObserverEntry[]) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          setActiveId(entry.target.id);
        }
      });
    };

    const observer = new IntersectionObserver(handleIntersection, observerOptions);

    categories.forEach((cat) => {
      const el = document.getElementById(cat.id);
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, [categories]);

  // Scroll active tab into view in the horizontal nav bar
  useEffect(() => {
    if (!activeId) return;
    const activeTab = document.getElementById(`tab-${activeId}`);
    const container = navRef.current;
    if (activeTab && container) {
      const containerWidth = container.offsetWidth;
      const tabOffsetLeft = activeTab.offsetLeft;
      const tabWidth = activeTab.offsetWidth;
      container.scrollTo({
        left: tabOffsetLeft - containerWidth / 2 + tabWidth / 2,
        behavior: 'smooth',
      });
    }
  }, [activeId]);

  const scrollToCategory = (id: string) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      setActiveId(id);
    }
  };

  if (categories.length === 0) return null;

  return (
    <div
      ref={navRef}
      className="no-scrollbar flex gap-2.5 overflow-x-auto px-4 py-1.5 scrollbar-none"
      style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
    >
      {categories.map((cat) => {
        const isActive = cat.id === activeId;
        return (
          <button
            key={cat.id}
            id={`tab-${cat.id}`}
            type="button"
            onClick={() => scrollToCategory(cat.id)}
            className={`whitespace-nowrap rounded-xl px-4 py-2.5 text-xs font-black tracking-tight transition-all duration-300 active:scale-95 ${
              isActive
                ? 'bg-slate-900 text-white shadow-md shadow-slate-900/10'
                : 'bg-slate-50 text-slate-500 hover:bg-slate-100 hover:text-slate-700 border border-slate-200/40'
            }`}
          >
            {cat.name}
          </button>
        );
      })}
    </div>
  );
}
