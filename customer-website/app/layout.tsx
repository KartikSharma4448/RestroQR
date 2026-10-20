import type { Metadata, Viewport } from 'next';
import './globals.css';
import './cafe-menu.css';
import { SITE_URL, SITE_NAME, HOME_TITLE, HOME_DESCRIPTION, SOCIAL_IMAGE } from '@/lib/seo';

export const metadata: Metadata = {
  title: {
    default: HOME_TITLE,
    template: '%s | RestroQR',
  },
  description:
    HOME_DESCRIPTION,
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
    'table ordering system',
    'restaurant order management',
    'QR code ordering',
    'digital restaurant menu free',
    'scan and order food',
    'free restaurant management app',
    'free cafe management app',
    'restaurant management app Android',
  ],
  authors: [{ name: 'RestroQR' }],
  metadataBase: new URL(SITE_URL),
  verification: {
    google: '1VojfIFEMi41CWLVS_8B9dxQWwz7Qy1dOFsXa8UzOmc',
  },
  openGraph: {
    title: HOME_TITLE,
    description:
      HOME_DESCRIPTION,
    type: 'website',
    siteName: SITE_NAME,
    locale: 'en_IN',
    images: [
      {
        url: SOCIAL_IMAGE,
        width: 1774,
        height: 887,
        alt: 'RestroQR digital menus and live orders with the Android owner app',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: HOME_TITLE,
    description: HOME_DESCRIPTION,
    images: [SOCIAL_IMAGE],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
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
        <link rel="icon" href="/favicon.png" type="image/png" />
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
