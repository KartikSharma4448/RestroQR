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
  name: string;
  items: FoodItem[];
}

export default function CategorySection({ name, items }: CategorySectionProps) {
  if (items.length === 0) return null;

  return (
    <section className="mb-8">
      {/* Category header */}
      <div className="mb-4 flex items-center gap-3">
        <h2 className="text-lg font-bold text-gray-900">
          {name}
        </h2>
        <div className="h-px flex-1 bg-gradient-to-r from-gray-200 to-transparent" />
        <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-500">
          {items.length}
        </span>
      </div>

      {/* Items grid */}
      <div className="flex flex-col gap-4">
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
