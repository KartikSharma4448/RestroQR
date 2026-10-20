'use client';
import { CartProvider } from './CartContext';
import CartBar from './CartBar';
import MenuBrowser, { type MenuCategory } from './MenuBrowser';
export default function MenuContent({
  categories,
}: {
  categories: MenuCategory[];
}) {
  return (
    <CartProvider>
      <MenuBrowser categories={categories} />
      <CartBar />
    </CartProvider>
  );
}
