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
      className={`relative flex gap-4 rounded-xl border border-gray-100 bg-white p-4 shadow-sm transition-shadow hover:shadow-md ${
        !is_available ? 'opacity-50 grayscale' : ''
      }`}
    >
      {/* Item details */}
      <div className="flex min-w-0 flex-1 flex-col justify-between">
        <div>
          {/* Badge + Name row */}
          <div className="flex items-start gap-2">
            <span
              className={`mt-1 inline-flex h-4 w-4 flex-shrink-0 items-center justify-center rounded border-2 ${
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
            <div className="min-w-0 flex-1">
              <h3 className="text-base font-semibold leading-tight text-gray-900">
                {name}
              </h3>
              {description && (
                <p className="mt-1 line-clamp-2 text-sm leading-relaxed text-gray-500">
                  {description}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Price + Status */}
        <div className="mt-3 flex items-center gap-3">
          <span className="text-base font-bold text-orange-600">
            ₹{typeof price === 'number' ? price.toFixed(2) : price}
          </span>
          {!is_available && <UnavailableBadge />}
        </div>
      </div>

      {/* Item image */}
      {image_url && (
        <div className="relative h-24 w-24 flex-shrink-0 overflow-hidden rounded-lg bg-gray-100">
          <Image
            src={image_url}
            alt={`Photo of ${name}`}
            fill
            className="object-cover"
            sizes="96px"
            loading="lazy"
          />
        </div>
      )}
    </div>
  );
}
