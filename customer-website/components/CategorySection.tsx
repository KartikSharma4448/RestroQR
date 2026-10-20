'use client';

import FoodItemCard from './FoodItemCard';
import type { MenuOptions } from '@/lib/menuOptions';

interface FoodItem {
  id: string;
  name: string;
  description: string | null;
  price: number;
  image_url: string | null;
  emoji?: string | null;
  options?: MenuOptions;
  badge: 'veg' | 'non_veg';
  is_available: boolean;
}

interface CategorySectionProps {
  id: string;
  name: string;
  items: FoodItem[];
  index?: number;
}

export default function CategorySection({ id, name, items, index }: CategorySectionProps) {
  if (items.length === 0) return null;

  return (
    <section id={id} className="menu-category">
      {/* Category header */}
      <div className="category-heading">
        {index!==undefined&&<span className="category-index" aria-hidden="true">{String(index).padStart(2,'0')}</span>}
        <h2>
          {name}
        </h2>
        <span className="category-item-count">
          {items.length} {items.length===1?'dish':'dishes'}
        </span>
      </div>

      {/* Items grid */}
      <div className="dish-grid">
        {items.map((item) => (
          <FoodItemCard
            key={item.id}
            id={item.id}
            name={item.name}
            description={item.description}
            price={item.price}
            image_url={item.image_url}
            emoji={item.emoji}
            options={item.options}
            badge={item.badge}
            is_available={item.is_available}
          />
        ))}
      </div>
    </section>
  );
}
