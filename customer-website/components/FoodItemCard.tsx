'use client';

import Image from 'next/image';
import { Minus, Plus, Utensils } from 'lucide-react';
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

export default function FoodItemCard({ id, name, description, price, image_url, badge, is_available }: FoodItemCardProps) {
  const { addItem, removeItem, getQuantity } = useCart();
  const quantity = getQuantity(id);
  const add = () => addItem({ id, name, price, badge });
  return (
    <article className={`dish-card ${!is_available ? 'dish-unavailable' : ''} ${quantity > 0 ? 'dish-selected' : ''}`}>
      <div className="dish-details">
        <span className={`diet-mark ${badge === 'veg' ? 'veg' : 'non-veg'}`} aria-label={badge === 'veg' ? 'Vegetarian' : 'Non-vegetarian'}><span /></span>
        <h3>{name}</h3><p className="dish-price">&#8377;{price.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</p>
        {description && <p className="dish-description">{description}</p>}
      </div>
      <div className="dish-media">
        <div className="dish-photo">{image_url ? <Image src={image_url} alt={`Photo of ${name}`} fill sizes="(max-width: 380px) 96px, 116px" className="object-cover" /> : <Utensils size={25} strokeWidth={1.4} aria-hidden="true" />}</div>
        {!is_available ? <span className="sold-out">Sold out</span> : quantity === 0 ? <button type="button" className="dish-add" onClick={add} aria-label={`Add ${name}`}><Plus size={15} /> Add</button> : <div className="quantity-control"><button type="button" onClick={() => removeItem(id)} aria-label={`Decrease quantity of ${name}`} title="Decrease quantity"><Minus size={16} /></button><span aria-live="polite">{quantity}</span><button type="button" onClick={add} aria-label={`Increase quantity of ${name}`} title="Increase quantity"><Plus size={16} /></button></div>}
      </div>
    </article>
  );
}
