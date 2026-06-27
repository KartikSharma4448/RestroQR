import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'RestroQR - Digital Menu',
  description:
    'Scan a QR code to view the restaurant menu instantly. Browse food items, filter by veg or non-veg, and search the menu.',
  applicationName: 'RestroQR',
  keywords: ['restaurant', 'menu', 'QR code', 'digital menu', 'RestroQR'],
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  themeColor: '#ffffff',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-gray-50 font-sans text-gray-900 antialiased">
        {children}
      </body>
    </html>
  );
}
