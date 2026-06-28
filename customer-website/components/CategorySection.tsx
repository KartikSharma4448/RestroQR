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
        <h2 className="text-lg font-bold text-gray-900 sm:text-xl">
          {name}
        </h2>
        <div className="h-px flex-1 bg-gradient-to-r from-orange-200 to-transparent" />
        <span className="text-xs font-medium text-gray-400">
          {items.length} {items.length === 1 ? 'item' : 'items'}
        </span>
      </div>

      {/* Items list */}
      <div className="flex flex-col gap-3">
        {items.map((item) => (
          <FoodItemCard
            key={item.id}
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
