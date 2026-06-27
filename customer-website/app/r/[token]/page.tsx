import { redirect } from 'next/navigation';
import { fetchMenu, ApiError } from '@/lib/api';
import MenuHeader from '@/components/MenuHeader';
import MenuContent from '@/components/MenuContent';

interface MenuPageProps {
  params: Promise<{ token: string }>;
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
    <main className="mx-auto max-w-3xl overflow-x-hidden pb-8">
      <MenuHeader
        name={restaurant.name}
        logo_url={restaurant.logo_url}
        cover_image_url={restaurant.cover_image_url}
      />

      <MenuContent categories={sortedCategories} />
    </main>
  );
}
