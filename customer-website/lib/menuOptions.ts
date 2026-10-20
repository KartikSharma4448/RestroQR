export interface MenuOption { id: string; name: string; price: number; isAvailable: boolean }
export interface MenuOptions { variants: MenuOption[]; addOns: MenuOption[] }
export function cartLineId(itemId: string, variantId?: string, addOnIds: string[] = []) {
  return variantId || addOnIds.length ? JSON.stringify([itemId, variantId || '', [...addOnIds].sort()]) : itemId;
}
