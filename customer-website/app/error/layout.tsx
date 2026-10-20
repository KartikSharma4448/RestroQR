import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Menu Unavailable', robots: { index: false, follow: true } };
export default function ErrorLayout({ children }: { children: React.ReactNode }) { return children; }
