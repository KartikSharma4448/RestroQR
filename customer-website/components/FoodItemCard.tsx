import Image from 'next/image';
import UnavailableBadge from './UnavailableBadge';

interface FoodItemCardProps {
  name: string;
  description: string | null;
  price: number;
  image_url: string | null;
  badge: 'veg' | 'non_veg';
  is_available: boolean;
}

export default function FoodItemCard({
  name,
  description,
  price,
  image_url,
  badge,
  is_available,
}: FoodItemCardProps) {
  return (
    <div
      className={`relative flex gap-3 rounded-lg border border-gray-100 bg-white p-3 shadow-sm sm:gap-4 sm:p-4 ${
        !is_available ? 'opacity-60' : ''
      }`}
    >
      {/* Item details */}
      <div className="flex min-w-0 flex-1 flex-col justify-between">
        <div>
          <div className="flex items-center gap-2">
            {/* Veg / Non-veg badge */}
            <span
              className={`inline-flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-sm border ${
                badge === 'veg'
                  ? 'border-green-600'
                  : 'border-red-600'
              }`}
              aria-label={badge === 'veg' ? 'Vegetarian' : 'Non-vegetarian'}
            >
              <span
                className={`h-2 w-2 rounded-full ${
                  badge === 'veg' ? 'bg-green-600' : 'bg-red-600'
                }`}
              />
            </span>
            <h3 className="truncate text-sm font-semibold text-gray-900 sm:text-base">
              {name}
            </h3>
          </div>
          {description && (
            <p className="mt-1 line-clamp-2 text-xs text-gray-500 sm:text-sm">
              {description}
            </p>
          )}
        </div>
        <div className="mt-2 flex items-center gap-2">
          <span className="text-sm font-bold text-gray-900 sm:text-base">
            ₹{price.toFixed(2)}
          </span>
          {!is_available && <UnavailableBadge />}
        </div>
      </div>

      {/* Item image */}
      {image_url && (
        <div className="relative h-20 w-20 flex-shrink-0 overflow-hidden rounded-md bg-gray-100 sm:h-24 sm:w-24">
          <Image
            src={image_url}
            alt={`Photo of ${name}`}
            fill
            className="object-cover"
            sizes="(max-width: 640px) 80px, 96px"
            loading="lazy"
          />
        </div>
      )}
    </div>
  );
}
