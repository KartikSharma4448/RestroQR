'use client';

import FoodItemCard from './FoodItemCard';

interface FoodItem {
  id: string;
  name: string;
  description: string | null;
  price: number;
  image_url: string | null;
  badge: 'veg' | 'non_veg';
  is_available: boolean;
}

interface CategorySectionProps {
  id: string;
  name: string;
  items: FoodItem[];
}

export default function CategorySection({ id, name, items }: CategorySectionProps) {
  if (items.length === 0) return null;

  return (
    <section id={id} className="menu-category">
      {/* Category header */}
      <div className="category-heading">
        <h2>
          {name}
        </h2>
        <span>
          {items.length}
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
            badge={item.badge}
            is_available={item.is_available}
          />
        ))}
      </div>
    </section>
  );
}
