import type { Metadata } from 'next';
import Link from 'next/link';
import Image from 'next/image';

export const metadata: Metadata = {
  title: 'RestroQR — Free Digital QR Menu for Restaurants',
  description:
    'Create your restaurant\'s digital menu in minutes. Customers scan QR code, see your menu instantly. Free forever. No app download needed for customers.',
  keywords: [
    'RestroQR',
    'QR menu',
    'digital menu',
    'restaurant menu',
    'free QR code menu',
    'online menu',
    'contactless menu',
  ],
  openGraph: {
    title: 'RestroQR — Free Digital QR Menu for Restaurants',
    description:
      'Create your restaurant\'s digital menu in minutes. Customers scan, view, done. Free forever.',
    type: 'website',
    url: 'https://restro-qr-peach.vercel.app',
  },
};

export default function HomePage() {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: 'RestroQR',
    applicationCategory: 'BusinessApplication',
    operatingSystem: 'Android',
    offers: {
      '@type': 'Offer',
      price: '0',
      priceCurrency: 'INR',
    },
    description:
      'Free digital QR menu and table ordering system for restaurants. Customers scan QR code, view menu, and place orders instantly.',
    url: 'https://restro-qr-peach.vercel.app',
    aggregateRating: {
      '@type': 'AggregateRating',
      ratingValue: '4.8',
      ratingCount: '50',
    },
  };

  return (
    <main className="min-h-screen bg-white">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-br from-orange-50 via-white to-orange-50">
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute -top-40 -right-40 h-80 w-80 rounded-full bg-orange-100 opacity-50 blur-3xl" />
          <div className="absolute -bottom-40 -left-40 h-80 w-80 rounded-full bg-orange-200 opacity-30 blur-3xl" />
        </div>

        <nav className="relative mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
          <div className="flex items-center gap-2">
            <Image src="/logo-icon.png" alt="RestroQR" width={36} height={36} className="rounded-lg" />
            <span className="text-xl font-bold text-gray-900">RestroQR</span>
          </div>
          <a
            href="/download/restroqr-owner.apk"
            className="rounded-full bg-orange-500 px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-orange-600 hover:shadow-md"
          >
            Download App
          </a>
        </nav>

        <div className="relative mx-auto max-w-6xl px-6 pb-20 pt-16 text-center sm:pt-24">
          <div className="inline-flex items-center gap-2 rounded-full bg-orange-100 px-4 py-1.5 text-sm font-medium text-orange-700">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-orange-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-orange-500" />
            </span>
            100% Free Forever
          </div>

          <h1 className="mt-6 text-4xl font-extrabold tracking-tight text-gray-900 sm:text-5xl md:text-6xl">
            Your Restaurant Menu,
            <br />
            <span className="bg-gradient-to-r from-orange-500 to-red-500 bg-clip-text text-transparent">
              One QR Code Away
            </span>
          </h1>

          <p className="mx-auto mt-6 max-w-2xl text-lg text-gray-600 sm:text-xl">
            Create a beautiful digital menu in minutes. Customers scan the QR code and view your menu
            instantly — no app download needed.
          </p>

          <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <a
              href="/download/restroqr-owner.apk"
              className="inline-flex items-center gap-2 rounded-full bg-orange-500 px-8 py-3.5 text-base font-semibold text-white shadow-lg transition hover:bg-orange-600 hover:shadow-xl"
            >
              <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M17.523 2.146a.5.5 0 00-.857-.354L14.383 4.08a8.5 8.5 0 00-4.766 0L7.334 1.792a.5.5 0 00-.857.354v3.07A8.5 8.5 0 004 11.5V18a2 2 0 002 2h12a2 2 0 002-2v-6.5a8.5 8.5 0 00-2.477-6.284V2.146zM8.5 11a1.5 1.5 0 110-3 1.5 1.5 0 010 3zm7 0a1.5 1.5 0 110-3 1.5 1.5 0 010 3z" />
              </svg>
              Download Owner App (APK)
            </a>
            <Link
              href="#features"
              className="inline-flex items-center gap-2 rounded-full border border-gray-200 bg-white px-8 py-3.5 text-base font-semibold text-gray-700 shadow-sm transition hover:border-orange-200 hover:bg-orange-50"
            >
              See Features
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </Link>
          </div>

          {/* Phone Mockup */}
          <div className="mx-auto mt-16 max-w-sm">
            <div className="relative mx-auto aspect-[9/16] w-64 overflow-hidden rounded-[2.5rem] border-[8px] border-gray-900 bg-white shadow-2xl sm:w-72">
              <div className="absolute inset-x-0 top-0 z-10 flex h-8 items-center justify-center">
                <div className="h-3 w-20 rounded-full bg-gray-900" />
              </div>
              <div className="flex h-full flex-col bg-gray-50 pt-8">
                <div className="h-28 bg-gradient-to-br from-orange-400 to-red-500" />
                <div className="relative -mt-6 flex flex-col items-center px-4">
                  <div className="h-12 w-12 rounded-full border-2 border-white bg-orange-500 shadow" />
                  <p className="mt-2 text-xs font-bold text-gray-900">Desi Tadka</p>
                </div>
                <div className="mt-3 space-y-2 px-3">
                  {['Paneer Butter Masala', 'Chicken Biryani', 'Masala Dosa'].map((item) => (
                    <div key={item} className="flex items-center gap-2 rounded-lg bg-white p-2 shadow-sm">
                      <div className="h-8 w-8 rounded-md bg-orange-100" />
                      <div className="flex-1">
                        <p className="text-[10px] font-semibold text-gray-800">{item}</p>
                        <p className="text-[9px] text-orange-600">₹249</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="bg-white py-20">
        <div className="mx-auto max-w-6xl px-6">
          <div className="text-center">
            <h2 className="text-3xl font-bold text-gray-900 sm:text-4xl">
              Everything You Need, Nothing You Don&apos;t
            </h2>
            <p className="mt-4 text-lg text-gray-600">
              Simple, powerful tools to digitize your restaurant menu
            </p>
          </div>

          <div className="mt-16 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((feature) => (
              <div
                key={feature.title}
                className="group rounded-2xl border border-gray-100 bg-white p-6 shadow-sm transition hover:border-orange-100 hover:shadow-md"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-orange-100 text-orange-600 transition group-hover:bg-orange-500 group-hover:text-white">
                  {feature.icon}
                </div>
                <h3 className="mt-4 text-lg font-semibold text-gray-900">{feature.title}</h3>
                <p className="mt-2 text-sm text-gray-600 leading-relaxed">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="bg-gradient-to-b from-orange-50 to-white py-20">
        <div className="mx-auto max-w-6xl px-6">
          <div className="text-center">
            <h2 className="text-3xl font-bold text-gray-900 sm:text-4xl">
              3 Steps. That&apos;s It.
            </h2>
            <p className="mt-4 text-lg text-gray-600">Get your digital menu up and running in minutes</p>
          </div>

          <div className="mt-16 grid gap-8 sm:grid-cols-3">
            {steps.map((step, i) => (
              <div key={step.title} className="relative text-center">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-orange-500 text-xl font-bold text-white shadow-lg">
                  {i + 1}
                </div>
                <h3 className="mt-4 text-lg font-semibold text-gray-900">{step.title}</h3>
                <p className="mt-2 text-sm text-gray-600">{step.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section className="bg-white py-20">
        <div className="mx-auto max-w-6xl px-6">
          <div className="mx-auto max-w-lg text-center">
            <h2 className="text-3xl font-bold text-gray-900 sm:text-4xl">Free. Forever.</h2>
            <p className="mt-4 text-lg text-gray-600">
              No hidden charges. No premium tier. No trial that expires.
            </p>
          </div>

          <div className="mx-auto mt-12 max-w-md">
            <div className="overflow-hidden rounded-3xl border-2 border-orange-200 bg-white shadow-xl">
              <div className="bg-gradient-to-r from-orange-500 to-red-500 px-8 py-6 text-center text-white">
                <p className="text-sm font-medium opacity-90">RestroQR Plan</p>
                <div className="mt-2 flex items-baseline justify-center gap-1">
                  <span className="text-5xl font-extrabold">₹0</span>
                  <span className="text-lg opacity-80">/ forever</span>
                </div>
              </div>
              <div className="px-8 py-8">
                <ul className="space-y-4">
                  {pricingFeatures.map((item) => (
                    <li key={item} className="flex items-start gap-3">
                      <svg className="mt-0.5 h-5 w-5 flex-shrink-0 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                        <path
                          fillRule="evenodd"
                          d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                          clipRule="evenodd"
                        />
                      </svg>
                      <span className="text-sm text-gray-700">{item}</span>
                    </li>
                  ))}
                </ul>
                <a
                  href="/download/restroqr-owner.apk"
                  className="mt-8 block w-full rounded-full bg-orange-500 py-3 text-center text-base font-semibold text-white shadow transition hover:bg-orange-600 hover:shadow-lg"
                >
                  Get Started Free
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Future Updates */}
      <section className="bg-gray-50 py-20">
        <div className="mx-auto max-w-6xl px-6">
          <div className="text-center">
            <h2 className="text-3xl font-bold text-gray-900 sm:text-4xl">Coming Soon</h2>
            <p className="mt-4 text-lg text-gray-600">Features we&apos;re building next</p>
          </div>

          <div className="mx-auto mt-12 grid max-w-3xl gap-4 sm:grid-cols-2">
            {futureFeatures.map((item) => (
              <div
                key={item.title}
                className="flex items-start gap-3 rounded-xl border border-gray-200 bg-white px-5 py-4"
              >
                <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-orange-100 text-sm">
                  {item.emoji}
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-gray-900">{item.title}</h3>
                  <p className="mt-0.5 text-xs text-gray-500">{item.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Footer */}
      <section className="bg-gradient-to-r from-orange-500 to-red-500 py-16">
        <div className="mx-auto max-w-4xl px-6 text-center">
          <h2 className="text-3xl font-bold text-white sm:text-4xl">
            Ready to Go Digital?
          </h2>
          <p className="mt-4 text-lg text-orange-100">
            Download the app, set up your menu, print QR — done.
          </p>
          <a
            href="/download/restroqr-owner.apk"
            className="mt-8 inline-flex items-center gap-2 rounded-full bg-white px-8 py-3.5 text-base font-semibold text-orange-600 shadow-lg transition hover:bg-orange-50 hover:shadow-xl"
          >
            <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M13 7h-2v4H7v2h4v4h2v-4h4v-2h-4V7zm-1-5C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z" />
            </svg>
            Download Owner App
          </a>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-100 bg-white py-8">
        <div className="mx-auto max-w-6xl px-6 text-center">
          <div className="flex items-center justify-center gap-2">
            <Image src="/logo-icon.png" alt="RestroQR" width={28} height={28} className="rounded-md" />
            <span className="text-lg font-bold text-gray-900">RestroQR</span>
          </div>
          <p className="mt-3 text-sm text-gray-500">
            Made with ❤️ for Indian Restaurants
          </p>
          <p className="mt-1 text-xs text-gray-400">
            © {new Date().getFullYear()} RestroQR. Free and open source.
          </p>
        </div>
      </footer>
    </main>
  );
}

/* ---------- Data ---------- */

const features = [
  {
    title: 'Free QR Code Menu',
    description: 'Auto-generated permanent QR code for your restaurant. Print it once, never change it.',
    icon: (
      <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
      </svg>
    ),
  },
  {
    title: 'Menu Categories',
    description: 'Organize items into categories — Starters, Main Course, Beverages, etc. Drag to reorder.',
    icon: (
      <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
      </svg>
    ),
  },
  {
    title: 'Veg / Non-Veg Filter',
    description: 'Customers can filter items by veg or non-veg with one tap. Familiar green/red badges.',
    icon: (
      <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
      </svg>
    ),
  },
  {
    title: 'Beautiful Food Cards',
    description: 'Show food images, descriptions, and pricing in a clean, attractive layout.',
    icon: (
      <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    ),
  },
  {
    title: 'Instant Search',
    description: 'Real-time search across all menu items. Find Biryani in 300 items? Done.',
    icon: (
      <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
      </svg>
    ),
  },
  {
    title: 'Mobile First',
    description: 'Designed for phones. Fast loading on 4G. Works on every browser, no app needed.',
    icon: (
      <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
      </svg>
    ),
  },
];

const steps = [
  {
    title: 'Download App',
    description: 'Install the RestroQR Owner app on your Android phone',
  },
  {
    title: 'Add Your Menu',
    description: 'Add categories, items, photos, and prices',
  },
  {
    title: 'Print QR & Go!',
    description: 'Download your QR code, print it, and place on tables',
  },
];

const pricingFeatures = [
  'Unlimited menu items',
  'Unlimited categories',
  'Food item images',
  'Auto-generated QR code',
  'Real-time menu updates',
  'Veg/Non-veg badges',
  'Search & filter for customers',
  'Mobile-optimized menu page',
  'No ads on menu page',
];

const futureFeatures = [
  { emoji: '🛒', title: 'Online Ordering', description: 'Customers can place orders directly' },
  { emoji: '💳', title: 'UPI Payments', description: 'Accept payments via UPI/Razorpay' },
  { emoji: '📊', title: 'Analytics Dashboard', description: 'See which items are popular' },
  { emoji: '🌐', title: 'Multi-language Menus', description: 'Hindi, Tamil, Marathi & more' },
  { emoji: '⭐', title: 'Customer Reviews', description: 'Collect ratings on dishes' },
  { emoji: '📱', title: 'iOS Owner App', description: 'Coming to iPhone soon' },
];
