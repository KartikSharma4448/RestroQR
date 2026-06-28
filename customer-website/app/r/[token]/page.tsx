import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { fetchMenu, ApiError } from '@/lib/api';
import MenuHeader from '@/components/MenuHeader';
import MenuContent from '@/components/MenuContent';

interface MenuPageProps {
  params: Promise<{ token: string }>;
}

export async function generateMetadata({ params }: MenuPageProps): Promise<Metadata> {
  const { token } = await params;

  try {
    const response = await fetchMenu(token);
    const { restaurant } = response.data;
    return {
      title: `${restaurant.name} — Menu`,
      description: `View the full menu of ${restaurant.name}. Browse categories, filter by veg/non-veg, search items.`,
      openGraph: {
        title: `${restaurant.name} — Digital Menu`,
        description: `Scan QR to view ${restaurant.name}'s menu. Powered by RestroQR.`,
        images: restaurant.cover_image_url ? [restaurant.cover_image_url] : undefined,
      },
    };
  } catch {
    return {
      title: 'Menu | RestroQR',
    };
  }
}

export default async function MenuPage({ params }: MenuPageProps) {
  const { token } = await params;

  let data;
  try {
    const response = await fetchMenu(token);
    data = response.data;
  } catch (error) {
    if (error instanceof ApiError) {
      redirect('/error');
    }
    redirect('/error');
  }

  const { restaurant, categories } = data;

  // Sort categories by display_order
  const sortedCategories = [...categories].sort(
    (a, b) => a.display_order - b.display_order,
  );

  return (
    <main className="mx-auto min-h-screen max-w-3xl overflow-x-hidden bg-white shadow-sm">
      <MenuHeader
        name={restaurant.name}
        logo_url={restaurant.logo_url}
        cover_image_url={restaurant.cover_image_url}
      />

      <MenuContent categories={sortedCategories} />
    </main>
  );
}
