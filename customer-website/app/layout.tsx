import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: {
    default: 'RestroQR — Free Digital QR Menu for Restaurants',
    template: '%s | RestroQR',
  },
  description:
    'Create a beautiful digital menu for your restaurant in minutes. Customers scan QR code, view menu instantly. Free forever, no app download needed for customers.',
  applicationName: 'RestroQR',
  keywords: [
    'RestroQR',
    'restaurant QR menu',
    'digital menu India',
    'free QR code menu',
    'online menu',
    'contactless menu',
    'restaurant menu app',
    'QR code restaurant',
  ],
  authors: [{ name: 'RestroQR' }],
  openGraph: {
    title: 'RestroQR — Free Digital QR Menu for Restaurants',
    description:
      'Create a beautiful digital menu. Customers scan QR, see your menu. Free forever.',
    type: 'website',
    siteName: 'RestroQR',
    locale: 'en_IN',
    url: 'https://restro-qr-peach.vercel.app',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'RestroQR — Free Digital QR Menu',
    description: 'Digital QR menu for restaurants. Free forever.',
  },
  robots: {
    index: true,
    follow: true,
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  themeColor: '#f97316',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-screen bg-gray-50 font-sans text-gray-900 antialiased">
        {children}
      </body>
    </html>
  );
}
