'use client';

import Image from 'next/image';
import { useState } from 'react';
import { Minus, Plus, Utensils } from 'lucide-react';
import { MAX_CART_ITEMS, MAX_ITEM_QUANTITY, useCart } from './CartContext';
import DishOptionsDialog from './DishOptionsDialog';
import type { MenuOptions } from '@/lib/menuOptions';

interface FoodItemCardProps {
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

export default function FoodItemCard({ id, name, description, price, image_url, emoji, options, badge, is_available }: FoodItemCardProps) {
  const [failedImage, setFailedImage] = useState<string | null>(null);
  const [customizing, setCustomizing] = useState(false);
  const configurable = !!options && (options.variants.length > 0 || options.addOns.length > 0);
  const { items, addItem, removeItem, getQuantity } = useCart();
  const quantity = configurable ? items.filter(item => (item.foodItemId || item.id) === id).reduce((sum, item) => sum + item.quantity, 0) : getQuantity(id);
  const cartFull = items.length >= MAX_CART_ITEMS;
  const availablePrices = options?.variants.filter(option => option.isAvailable).map(option => option.price) || [];
  const displayPrice = availablePrices.length ? Math.min(...availablePrices) : price;
  const add = () => addItem({ id, name, price, badge });
  return (
    <><article className={`dish-card ${!image_url&&!emoji?'dish-without-photo':''} ${!is_available ? 'dish-unavailable' : ''} ${quantity > 0 ? 'dish-selected' : ''}`}>
      <div className="dish-details">
        <span className={`diet-mark ${badge === 'veg' ? 'veg' : 'non-veg'}`} aria-label={badge === 'veg' ? 'Vegetarian' : 'Non-vegetarian'}><span /></span>
        <h3>{name}</h3><p className="dish-price">{options?.variants.length ? <span>From </span> : ''}&#8377;{displayPrice.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</p>
        {description && <p className="dish-description">{description}</p>}
      </div>
      <div className="dish-media">
        <div className="dish-photo">{image_url && failedImage !== image_url ? <Image src={image_url} alt={`Photo of ${name}`} fill sizes="(max-width: 380px) 96px, 116px" className="object-cover" onError={() => setFailedImage(image_url)} /> : emoji ? <span role="img" aria-label={`${name} illustration`} style={{ fontSize: 42, lineHeight: 1 }}>{emoji}</span> : <Utensils size={25} strokeWidth={1.4} aria-hidden="true" />}</div>
        {!is_available ? <span className="sold-out">Sold out</span> : configurable ? <button type="button" className="dish-add" aria-label={`Customize ${name}`} onClick={() => setCustomizing(true)}>Customize{quantity > 0 ? ` (${quantity})` : ''}</button> : quantity === 0 ? (
          <button type="button" className="dish-add" onClick={add} disabled={cartFull}
            aria-label={`Add ${name}`} title={cartFull ? `Maximum ${MAX_CART_ITEMS} different dishes per order` : `Add ${name}`}>
            <Plus size={15} /> Add
          </button>
        ) : <div className="quantity-control"><button type="button" onClick={() => removeItem(id)} aria-label={`Decrease quantity of ${name}`} title="Decrease quantity"><Minus size={16} /></button><span aria-live="polite">{quantity}</span><button type="button" onClick={add} disabled={quantity >= MAX_ITEM_QUANTITY} aria-label={`Increase quantity of ${name}`} title={quantity >= MAX_ITEM_QUANTITY ? `Maximum quantity: ${MAX_ITEM_QUANTITY}` : 'Increase quantity'}><Plus size={16} /></button></div>}
      </div>
    </article>{customizing && options && <DishOptionsDialog itemId={id} name={name} price={price} badge={badge} options={options} onClose={() => setCustomizing(false)} />}</>
  );
}
