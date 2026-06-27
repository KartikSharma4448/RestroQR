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
    <section className="mb-6">
      <h2 className="mb-3 border-b border-gray-200 pb-2 text-base font-bold text-gray-800 sm:text-lg">
        {name}
      </h2>
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
