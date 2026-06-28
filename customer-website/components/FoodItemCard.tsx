'use client';

import Image from 'next/image';
import { useCart } from './CartContext';

interface FoodItemCardProps {
  id: string;
  name: string;
  description: string | null;
  price: number;
  image_url: string | null;
  badge: 'veg' | 'non_veg';
  is_available: boolean;
}

export default function FoodItemCard({
  id,
  name,
  description,
  price,
  image_url,
  badge,
  is_available,
}: FoodItemCardProps) {
  const { addItem, removeItem, getQuantity } = useCart();
  const quantity = getQuantity(id);

  return (
    <div
      className={`relative flex gap-3 rounded-xl border border-gray-100 bg-white p-4 transition-all duration-200 ${
        !is_available
          ? 'opacity-50 grayscale'
          : 'hover:border-orange-100 hover:shadow-md'
      }`}
    >
      {/* Item details */}
      <div className="flex min-w-0 flex-1 flex-col justify-between">
        <div>
          {/* Badge */}
          <span
            className={`inline-flex h-4 w-4 items-center justify-center rounded-sm border-2 ${
              badge === 'veg' ? 'border-green-600' : 'border-red-600'
            }`}
            aria-label={badge === 'veg' ? 'Vegetarian' : 'Non-vegetarian'}
          >
            <span
              className={`h-2 w-2 rounded-full ${
                badge === 'veg' ? 'bg-green-600' : 'bg-red-600'
              }`}
            />
          </span>

          {/* Name */}
          <h3 className="mt-1.5 text-base font-semibold leading-tight text-gray-900">
            {name}
          </h3>

          {/* Price */}
          <p className="mt-1.5 text-sm font-bold text-gray-800">
            ₹{typeof price === 'number' ? price.toFixed(0) : price}
          </p>

          {/* Description */}
          {description && (
            <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-gray-500">
              {description}
            </p>
          )}
        </div>
      </div>

      {/* Image + Add button column */}
      <div className="relative flex flex-shrink-0 flex-col items-center">
        {/* Image */}
        {image_url ? (
          <div className="relative h-[100px] w-[118px] overflow-hidden rounded-xl bg-gray-100">
            <Image
              src={image_url}
              alt={`Photo of ${name}`}
              fill
              className="object-cover"
              sizes="118px"
              loading="lazy"
            />
          </div>
        ) : (
          <div className="flex h-[100px] w-[118px] items-center justify-center rounded-xl bg-gradient-to-br from-orange-50 to-orange-100">
            <svg className="h-8 w-8 text-orange-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M12 8.25v-1.5m0 1.5c-1.355 0-2.697.056-4.024.166C6.845 8.51 6 9.473 6 10.608v2.513m6-4.87c1.355 0 2.697.055 4.024.165C17.155 8.51 18 9.473 18 10.608v2.513M12 8.25a2.25 2.25 0 002.25-2.25V5.625A2.25 2.25 0 0012 3.375a2.25 2.25 0 00-2.25 2.25V6a2.25 2.25 0 002.25 2.25z"
              />
            </svg>
          </div>
        )}

        {/* Add/Quantity button */}
        {is_available && (
          <div className="absolute -bottom-3">
            {quantity === 0 ? (
              <button
                type="button"
                onClick={() => addItem({ id, name, price, badge })}
                className="rounded-lg border border-gray-200 bg-white px-6 py-1.5 text-sm font-bold text-green-600 shadow-md transition-all duration-150 hover:bg-green-50 hover:shadow-lg active:scale-95"
              >
                ADD
              </button>
            ) : (
              <div className="flex items-center gap-0 overflow-hidden rounded-lg border border-green-600 bg-green-600 shadow-md">
                <button
                  type="button"
                  onClick={() => removeItem(id)}
                  className="flex h-8 w-8 items-center justify-center text-white transition hover:bg-green-700 active:scale-90"
                  aria-label={`Decrease quantity of ${name}`}
                >
                  <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M20 12H4" />
                  </svg>
                </button>
                <span className="flex h-8 w-8 items-center justify-center bg-white text-sm font-bold text-green-600">
                  {quantity}
                </span>
                <button
                  type="button"
                  onClick={() => addItem({ id, name, price, badge })}
                  className="flex h-8 w-8 items-center justify-center text-white transition hover:bg-green-700 active:scale-90"
                  aria-label={`Increase quantity of ${name}`}
                >
                  <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 4v16m8-8H4" />
                  </svg>
                </button>
              </div>
            )}
          </div>
        )}

        {/* Unavailable label */}
        {!is_available && (
          <span className="absolute -bottom-2 rounded bg-gray-200 px-2 py-0.5 text-[10px] font-medium text-gray-600">
            Unavailable
          </span>
        )}
      </div>
    </div>
  );
}
