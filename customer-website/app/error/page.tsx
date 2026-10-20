import MenuError from '@/components/MenuError';

export default async function ErrorPage({ searchParams }: {
  searchParams: Promise<{ retry?: string | string[] }>;
}) {
  const { retry } = await searchParams;
  const retryPath = typeof retry === 'string' &&
    /^\/r\/[A-Za-z0-9_-]+(?:\/t\/[A-Za-z0-9_-]+)?$/.test(retry)
    ? retry : '/';
  return <MenuError retryPath={retryPath} />;
}
