import { redirect } from 'next/navigation';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { fetchMenu } from '@/lib/api';
import MenuHeader from '@/components/MenuHeader';
import TableMenuContent from '@/components/TableMenuContent';
import MenuContent from '@/components/MenuContent';
import LiveOrderBoard from '@/components/LiveOrderBoard';

// Always fetch fresh menu data, never serve stale cache
export const revalidate = 0;
export const dynamic = 'force-dynamic';

interface TableMenuPageProps {
  params: Promise<{ token: string; tableToken: string }>;
}

export async function generateMetadata({ params }: TableMenuPageProps): Promise<Metadata> {
  const { token } = await params;

  try {
    const response = await fetchMenu(token);
    const { restaurant } = response.data;
    return {
      title: `${restaurant.name} — Order`,
      description: `Order from ${restaurant.name}. Browse the menu and place your order directly from your table.`,
      openGraph: {
        title: `${restaurant.name} — Place Your Order`,
        description: `Scan QR to order from ${restaurant.name}. Powered by RestroQR.`,
        images: restaurant.cover_image_url ? [restaurant.cover_image_url] : undefined,
      },
    };
  } catch {
    return {
      title: 'Order | RestroQR',
    };
  }
}

export default async function TableMenuPage({ params }: TableMenuPageProps) {
  const { token, tableToken } = await params;

  let data;
  try {
    const response = await fetchMenu(token);
    data = response.data;
  } catch {
    redirect(`/error?retry=${encodeURIComponent(`/r/${encodeURIComponent(token)}/t/${encodeURIComponent(tableToken)}`)}`);
  }

  const { restaurant, categories } = data;

  // If restaurant is in single mode, table-specific URLs are not valid
  if (restaurant.qr_mode === 'single') {
    notFound();
  }

  // Sort categories by display_order
  const sortedCategories = [...categories].sort(
    (a, b) => a.display_order - b.display_order,
  );

  return (
    <main className="customer-menu">
      <MenuHeader
        name={restaurant.name}
        restaurantToken={token}
        logo_url={restaurant.logo_url}
        cover_image_url={restaurant.cover_image_url}
        ordering={restaurant.ordering_enabled !== false}
        welcome={restaurant.customer_email_required}
        ownerPhotoUrl={restaurant.owner_photo_url}
        address={restaurant.address}
      />

      {restaurant.ordering_enabled === false ? <>
        <p role="status" className="px-6 py-4 text-center">This restaurant is not accepting new orders yet.</p>
        <MenuContent categories={sortedCategories} />
        {!restaurant.customer_email_required&&<LiveOrderBoard restaurantToken={token}/>}
      </> : <TableMenuContent
        categories={sortedCategories}
        tableToken={tableToken}
        restaurantToken={token}
        customerEmailRequired={restaurant.customer_email_required}
        waiterCallingEnabled={restaurant.waiter_calling_enabled}
      />}
    </main>
  );
}
