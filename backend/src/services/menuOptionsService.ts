import { randomUUID } from 'crypto';
import type { PoolClient } from 'pg';
import pool from '../config/database';
import { AppError, ConflictError, NotFoundError, ValidationError } from '../errors';

export interface MenuOption { id: string; name: string; price: string; isAvailable: boolean }
export interface MenuOptions { variants: MenuOption[]; addOns: MenuOption[] }
export interface OptionSelection { itemId: string; quantity: number; variantId?: string; addOnIds?: string[] }
export interface OptionSnapshot { variant: MenuOption | null; addOns: MenuOption[] }
export const menuOptionsEnabled = () => process.env.MENU_OPTIONS_ENABLED === 'true';
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const emptyOptions = (): MenuOptions => ({ variants: [], addOns: [] });

export function moneyCents(value: unknown, allowZero = false): number {
  if ((typeof value !== 'number' && typeof value !== 'string') ||
      !/^\d{1,6}(?:\.\d{1,2})?$/.test(String(value))) throw new ValidationError('Enter a price with at most two decimal places');
  const cents = Math.round(Number(value) * 100);
  if (!Number.isSafeInteger(cents) || cents < (allowZero ? 0 : 1) || cents > 99999999) {
    throw new ValidationError('Option price is outside the supported range');
  }
  return cents;
}

export function validateMenuOptions(input: unknown): MenuOptions {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new ValidationError('Provide variants and add-ons');
  const data = input as Record<string, unknown>;
  const ids = new Set<string>();
  function validate(value: unknown, max: number, allowZero: boolean): MenuOption[] {
    if (!Array.isArray(value) || value.length > max) throw new ValidationError(`Choose at most ${max} options`);
    const names = new Set<string>();
    return value.map(raw => {
      if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new ValidationError('Invalid option');
      if (typeof raw.name !== 'string' || !raw.name.trim() || raw.name.trim().length > 60 || /[\u0000-\u001f]/.test(raw.name)) {
        throw new ValidationError('Option name must contain 1 to 60 characters');
      }
      const name = raw.name.trim();
      if (names.has(name.toLowerCase())) throw new ValidationError('Option names must be unique');
      names.add(name.toLowerCase());
      const id = raw.id === undefined ? randomUUID() : typeof raw.id === 'string' ? raw.id.toLowerCase() : '';
      if (!uuid.test(id) || ids.has(id)) throw new ValidationError('Option IDs must be valid and unique');
      ids.add(id);
      if (raw.isAvailable !== undefined && typeof raw.isAvailable !== 'boolean') throw new ValidationError('Option availability must be true or false');
      return { id, name, price: (moneyCents(raw.price, allowZero) / 100).toFixed(2), isAvailable: raw.isAvailable !== false };
    });
  }
  return { variants: validate(data.variants, 12, false), addOns: validate(data.addOns, 20, true) };
}

export async function saveMenuOptions(itemId: string, restaurantId: string, input: unknown) {
  if (!menuOptionsEnabled()) throw new AppError('Menu options are not enabled yet', 503, 'MENU_OPTIONS_UNAVAILABLE');
  if (!uuid.test(itemId)) throw new NotFoundError('Food item not found');
  const options = validateMenuOptions(input);
  const result = await pool.query(`UPDATE food_items SET menu_options=$1::jsonb,updated_at=NOW()
    WHERE id=$2 AND restaurant_id=$3 RETURNING id,menu_options AS options`, [JSON.stringify(options), itemId, restaurantId]);
  if (!result.rows.length) throw new NotFoundError('Food item not found');
  return result.rows[0];
}

export function selectionKey(item: OptionSelection) {
  return JSON.stringify([item.itemId.toLowerCase(), item.variantId?.toLowerCase() || '',
    [...(item.addOnIds || [])].map(id => id.toLowerCase()).sort()]);
}

export function validateOptionSelections(items: OptionSelection[]) {
  const enabled = menuOptionsEnabled();
  for (const item of items) {
    if (!enabled && (item.variantId !== undefined || item.addOnIds !== undefined)) {
      throw new ValidationError('Menu options are not enabled');
    }
    if (item.variantId !== undefined && (typeof item.variantId !== 'string' || !uuid.test(item.variantId))) {
      throw new ValidationError('Invalid size selection');
    }
    if (item.addOnIds !== undefined && (!Array.isArray(item.addOnIds) || item.addOnIds.length > 20 ||
        item.addOnIds.some(id => typeof id !== 'string' || !uuid.test(id)) ||
        new Set(item.addOnIds.map(id => id.toLowerCase())).size !== item.addOnIds.length)) {
      throw new ValidationError('Choose valid, distinct add-ons');
    }
  }
  const keys = items.map(item => enabled ? selectionKey(item) : item.itemId);
  if (new Set(keys).size !== keys.length) throw new ValidationError('Duplicate item selections are not allowed');
}

export function priceSelection(basePrice: string, options: MenuOptions, selection: OptionSelection) {
  const variant = selection.variantId ? options.variants.find(option => option.id === selection.variantId!.toLowerCase()) : null;
  if ((options.variants.length > 0 && !variant) || (selection.variantId && !variant)) throw new ConflictError('Choose an available size. Refresh the menu.');
  if (variant && !variant.isAvailable) throw new ConflictError('This size is unavailable. Refresh the menu.');
  const addOns = (selection.addOnIds || []).map(id => {
    const addon = options.addOns.find(option => option.id === id.toLowerCase());
    if (!addon || !addon.isAvailable) throw new ConflictError('An add-on is unavailable. Refresh the menu.');
    return addon;
  }).sort((a, b) => a.id.localeCompare(b.id));
  const cents = moneyCents(variant ? variant.price : basePrice) + addOns.reduce((sum, option) => sum + moneyCents(option.price, true), 0);
  if (cents > 99999999) throw new ValidationError('Configured dish price exceeds the supported limit');
  return { cents, price: (cents / 100).toFixed(2), snapshot: { variant: variant || null, addOns } as OptionSnapshot };
}

export function optionSummary(snapshot?: OptionSnapshot | null): string {
  return [snapshot?.variant?.name, ...(snapshot?.addOns || []).map(option => `+ ${option.name}`)].filter(Boolean).join(', ');
}

export async function priceLockedSelections(client: Pick<PoolClient, 'query'>, restaurantId: string, items: OptionSelection[]) {
  const result = await client.query(`SELECT id,name,price,is_available,restaurant_id,menu_options FROM food_items
    WHERE id=ANY($1::uuid[]) AND restaurant_id=$2 ORDER BY id FOR SHARE`, [[...new Set(items.map(item => item.itemId))], restaurantId]);
  const rows = new Map(result.rows.map(row => [row.id as string, row]));
  return items.map(item => {
    const row = rows.get(item.itemId.toLowerCase());
    if (!row) throw new ValidationError('A selected dish is not on this menu');
    if (!row.is_available) throw new ConflictError('A selected dish is unavailable. Refresh the menu.');
    return { name: row.name as string, ...priceSelection(row.price as string, row.menu_options || emptyOptions(), item) };
  });
}
