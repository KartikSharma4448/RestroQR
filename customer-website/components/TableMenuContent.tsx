'use client';
import { CartProvider } from './CartContext';
import LiveOrderBoard from './LiveOrderBoard';
import WaiterCall from './WaiterCall';
import OrderCartBar from './OrderCartBar';
import MenuBrowser, { type MenuCategory } from './MenuBrowser';
interface Props {
  categories: MenuCategory[];
  tableToken: string;
  restaurantToken: string;
  customerEmailRequired?: boolean;
  waiterCallingEnabled?: boolean;
}
export default function TableMenuContent({
  categories,
  tableToken,
  restaurantToken,
  customerEmailRequired = false,
  waiterCallingEnabled = false,
}: Props) {
  return (
    <CartProvider>
      {waiterCallingEnabled && <WaiterCall tableToken={tableToken} />}
      <MenuBrowser categories={categories} />
      {!customerEmailRequired && (
        <LiveOrderBoard restaurantToken={restaurantToken} />
      )}
      <OrderCartBar
        tableToken={tableToken}
        restaurantToken={restaurantToken}
        customerEmailRequired={customerEmailRequired}
      />
    </CartProvider>
  );
}
