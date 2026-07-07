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

  const isVeg = badge === 'veg';

  return (
    <div
      className={`relative flex gap-4 rounded-3xl border p-4 transition-all duration-300 ${
        !is_available
          ? 'opacity-40 grayscale border-slate-100 bg-slate-50/30'
          : quantity > 0
          ? 'border-emerald-500/40 bg-emerald-50/5 shadow-md shadow-emerald-500/5'
          : 'border-slate-100 bg-white hover:border-slate-200 hover:shadow-lg hover:shadow-slate-100/80'
      }`}
    >
      {/* Item details */}
      <div className="flex min-w-0 flex-1 flex-col justify-between">
        <div>
          {/* Veg/Non-Veg Badge with custom icon styles */}
          <span
            className={`inline-flex h-5 w-5 items-center justify-center rounded-lg border-2 ${
              isVeg ? 'border-emerald-600 bg-emerald-50/50' : 'border-rose-600 bg-rose-50/50'
            }`}
            aria-label={isVeg ? 'Vegetarian' : 'Non-vegetarian'}
          >
            <span
              className={`h-2.5 w-2.5 rounded-full ${
                isVeg ? 'bg-emerald-600' : 'bg-rose-600'
              }`}
            />
          </span>

          {/* Name */}
          <h3 className="mt-2 text-base font-extrabold tracking-tight text-slate-800 leading-snug">
            {name}
          </h3>

          {/* Price */}
          <p className="mt-1 text-base font-black text-slate-900">
            ₹{typeof price === 'number' ? price.toFixed(0) : price}
          </p>

          {/* Description */}
          {description && (
            <p className="mt-1.5 line-clamp-2 text-xs leading-relaxed text-slate-500 font-medium">
              {description}
            </p>
          )}
        </div>
      </div>

      {/* Image + Add button column */}
      <div className="relative flex flex-shrink-0 flex-col items-center justify-center">
        {/* Image */}
        {image_url ? (
          <div className="relative h-[110px] w-[120px] overflow-hidden rounded-2xl bg-slate-100 shadow-md">
            <Image
              src={image_url}
              alt={`Photo of ${name}`}
              fill
              className="object-cover transition-transform duration-500 hover:scale-105"
              sizes="120px"
              loading="lazy"
            />
          </div>
        ) : (
          <div className="flex h-[110px] w-[120px] items-center justify-center rounded-2xl bg-gradient-to-br from-slate-50 to-slate-100/80 border border-slate-200/40">
            <svg className="h-9 w-9 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
                className="rounded-xl border border-slate-200 bg-white px-7 py-2 text-xs font-black tracking-wider text-emerald-600 shadow-lg shadow-slate-200/80 transition-all duration-200 hover:bg-emerald-50 hover:border-emerald-200 hover:shadow-xl active:scale-95"
              >
                ADD
              </button>
            ) : (
              <div className="flex items-center gap-0 overflow-hidden rounded-xl border border-emerald-600 bg-emerald-600 shadow-lg shadow-emerald-600/20">
                <button
                  type="button"
                  onClick={() => removeItem(id)}
                  className="flex h-8 w-8 items-center justify-center text-white transition hover:bg-emerald-700 active:scale-90"
                  aria-label={`Decrease quantity of ${name}`}
                >
                  <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3.5} d="M20 12H4" />
                  </svg>
                </button>
                <span className="flex h-8 w-8 items-center justify-center bg-white text-xs font-black text-emerald-600">
                  {quantity}
                </span>
                <button
                  type="button"
                  onClick={() => addItem({ id, name, price, badge })}
                  className="flex h-8 w-8 items-center justify-center text-white transition hover:bg-emerald-700 active:scale-90"
                  aria-label={`Increase quantity of ${name}`}
                >
                  <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3.5} d="M12 4v16m8-8H4" />
                  </svg>
                </button>
              </div>
            )}
          </div>
        )}

        {/* Unavailable label */}
        {!is_available && (
          <span className="absolute -bottom-2 rounded-lg bg-slate-200 px-2.5 py-1 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
            Sold Out
          </span>
        )}
      </div>
    </div>
  );
}
