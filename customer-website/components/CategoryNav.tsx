'use client';
import { useEffect, useRef } from 'react';

interface Category {
  id: string;
  name: string;
  count?: number;
}
interface Props {
  categories: Category[];
  selectedId: string | null;
  onChange: (id: string | null) => void;
  total: number;
}
export default function CategoryNav({
  categories,
  selectedId,
  onChange,
  total,
}: Props) {
  const navRef = useRef<HTMLDivElement>(null);
  const tabs = [{ id: null, name: 'All', count: total }, ...categories];
  useEffect(() => {
    const container = navRef.current,
      tab = container?.querySelector<HTMLElement>('[aria-selected="true"]');
    if (container && tab)
      container.scrollTo({
        left: tab.offsetLeft - container.clientWidth / 2 + tab.clientWidth / 2,
        behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches
          ? 'auto'
          : 'smooth',
      });
  }, [selectedId]);
  return (
    <div
      ref={navRef}
      className="category-tabs"
      role="tablist"
      aria-label="Menu categories"
    >
      {tabs.map((tab, index) => (
        <button
          key={tab.id || 'all'}
          id={tab.id ? `tab-${tab.id}` : 'tab-all'}
          type="button"
          role="tab"
          aria-controls="category-panel"
          aria-selected={selectedId === tab.id}
          tabIndex={selectedId === tab.id ? 0 : -1}
          className={selectedId === tab.id ? 'active' : ''}
          onClick={() => onChange(tab.id)}
          onKeyDown={(event) => {
            let next = index;
            if (event.key === 'ArrowRight') next = (index + 1) % tabs.length;
            else if (event.key === 'ArrowLeft')
              next = (index - 1 + tabs.length) % tabs.length;
            else if (event.key === 'Home') next = 0;
            else if (event.key === 'End') next = tabs.length - 1;
            else return;
            event.preventDefault();
            onChange(tabs[next].id);
            navRef.current
              ?.querySelectorAll<HTMLButtonElement>('[role="tab"]')
              [next]?.focus({ preventScroll: true });
          }}
        >
          <span>{tab.name}</span>
          <span className="category-tab-count" aria-hidden="true">
            {tab.count}
          </span>
        </button>
      ))}
    </div>
  );
}
