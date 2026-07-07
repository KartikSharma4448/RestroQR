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
    <section id={id} className="mb-10 scroll-mt-28">
      {/* Category header */}
      <div className="mb-5 flex items-center gap-3">
        <h2 className="text-xl font-black tracking-tight text-slate-800">
          {name}
        </h2>
        <div className="h-0.5 flex-1 bg-gradient-to-r from-slate-200 to-transparent" />
        <span className="rounded-xl bg-slate-100 px-3 py-1 text-xs font-bold text-slate-500">
          {items.length}
        </span>
      </div>

      {/* Items grid */}
      <div className="flex flex-col gap-5">
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
