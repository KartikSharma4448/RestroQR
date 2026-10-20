'use client';
import { useState } from 'react';
import { X } from 'lucide-react';
import type { MenuOptions } from '@/lib/menuOptions';
import { cartLineId } from '@/lib/menuOptions';
import { MAX_CART_ITEMS, MAX_ITEM_QUANTITY, useCart } from './CartContext';
import useDialog from './useDialog';

interface Props { itemId: string; name: string; price: number; badge: 'veg' | 'non_veg'; options: MenuOptions; onClose: () => void }
export default function DishOptionsDialog({ itemId, name, price, badge, options, onClose }: Props) {
  const [variantId, setVariantId] = useState(options.variants.find(option => option.isAvailable)?.id || '');
  const [addOnIds, setAddOnIds] = useState<string[]>([]);
  const { items, addItem, getQuantity } = useCart();
  const ref = useDialog(true, onClose);
  const variant = options.variants.find(option => option.id === variantId);
  const addons = options.addOns.filter(option => addOnIds.includes(option.id));
  const cents = Math.round((variant?.price ?? price) * 100) + addons.reduce((sum, option) => sum + Math.round(option.price * 100), 0);
  const id = cartLineId(itemId, variantId || undefined, addOnIds);
  const full = (!items.some(item => item.id === id) && items.length >= MAX_CART_ITEMS) || getQuantity(id) >= MAX_ITEM_QUANTITY;
  const unavailable = options.variants.length > 0 && (!variant || !variant.isAvailable);
  const summary = [variant?.name, ...addons.map(option => `+ ${option.name}`)].filter(Boolean).join(', ');
  return <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/50 p-3 sm:items-center" onClick={onClose}>
    <div ref={ref} role="dialog" aria-modal="true" aria-label={`Customize ${name}`} tabIndex={-1}
      className="max-h-[85svh] w-full max-w-md overflow-y-auto rounded-lg bg-white p-5 text-slate-900 shadow-xl" onClick={event => event.stopPropagation()}>
      <div className="flex items-start justify-between gap-3"><h2 className="min-w-0 break-words text-lg font-semibold">{name}</h2>
        <button type="button" onClick={onClose} aria-label="Close customization" title="Close" className="flex h-11 w-11 shrink-0 items-center justify-center"><X size={20} /></button></div>
      {options.variants.length > 0 && <fieldset className="mt-3"><legend className="mb-2 font-semibold">Size</legend>
        {options.variants.map(option => <label key={option.id} className={`flex min-h-12 items-center gap-3 border-b border-slate-100 py-2 ${!option.isAvailable ? 'text-slate-400' : ''}`}>
          <input type="radio" name={`size-${itemId}`} value={option.id} checked={variantId === option.id} disabled={!option.isAvailable} onChange={() => setVariantId(option.id)} />
          <span className="min-w-0 flex-1 break-words">{option.name}{!option.isAvailable && ' (Unavailable)'}</span><span className="shrink-0">INR {option.price.toLocaleString('en-IN')}</span>
        </label>)}</fieldset>}
      {options.addOns.length > 0 && <fieldset className="mt-5"><legend className="mb-2 font-semibold">Add-ons</legend>
        {options.addOns.map(option => <label key={option.id} className={`flex min-h-12 items-center gap-3 border-b border-slate-100 py-2 ${!option.isAvailable ? 'text-slate-400' : ''}`}>
          <input type="checkbox" checked={addOnIds.includes(option.id)} disabled={!option.isAvailable} onChange={event => setAddOnIds(current => event.target.checked ? [...current, option.id] : current.filter(id => id !== option.id))} />
          <span className="min-w-0 flex-1 break-words">{option.name}{!option.isAvailable && ' (Unavailable)'}</span><span className="shrink-0">+ INR {option.price.toLocaleString('en-IN')}</span>
        </label>)}</fieldset>}
      <button type="button" disabled={full || unavailable || cents > 99999999} className="mt-5 min-h-12 w-full rounded-md bg-teal-700 px-4 py-3 font-semibold text-white disabled:opacity-50"
        onClick={() => { addItem({ id, foodItemId: itemId, name, price: cents / 100, badge,
          ...(variantId ? { variantId } : {}), ...(addOnIds.length ? { addOnIds: [...addOnIds].sort() } : {}), optionSummary: summary }); onClose(); }}>
        {full ? 'Selection limit reached' : unavailable ? 'Currently unavailable' : `Add to selection - INR ${(cents / 100).toLocaleString('en-IN')}`}
      </button>
    </div>
  </div>;
}
