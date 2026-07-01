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
    'table ordering',
    'restaurant management',
    'order management',
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

      {/* ===== NAVBAR ===== */}
      <nav className="sticky top-0 z-50 border-b border-gray-100 bg-white/80 backdrop-blur-lg">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <Image src="/logo-icon.png" alt="RestroQR" width={38} height={38} className="rounded-lg" />
            <span className="text-xl font-bold text-gray-900">RestroQR</span>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="#features"
              className="hidden text-sm font-medium text-gray-600 transition hover:text-orange-600 sm:inline-block"
            >
              Features
            </Link>
            <Link
              href="#screenshots"
              className="hidden text-sm font-medium text-gray-600 transition hover:text-orange-600 sm:inline-block"
            >
              Screenshots
            </Link>
            <Link
              href="#pricing"
              className="hidden text-sm font-medium text-gray-600 transition hover:text-orange-600 sm:inline-block"
            >
              Pricing
            </Link>
            <a
              href="/download/restroqr-owner.apk"
              className="rounded-full bg-orange-500 px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-orange-600 hover:shadow-md"
            >
              Download App
            </a>
          </div>
        </div>
      </nav>

      {/* ===== HERO SECTION ===== */}
      <section className="relative min-h-[600px] overflow-hidden sm:min-h-[700px]">
        {/* Full Background Image */}
        <Image
          src="/screenshots/banner.png"
          alt="RestroQR - Digital Menu, Smarter Dining"
          fill
          className="object-cover object-center"
          priority
        />
        {/* Dark gradient overlay for text readability */}
        <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/60 to-black/30" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-black/20" />

        <div className="relative mx-auto flex min-h-[600px] max-w-6xl items-center px-6 py-16 sm:min-h-[700px] sm:py-24">
          <div className="max-w-2xl text-left">
              <div className="inline-flex items-center gap-2 rounded-full bg-white/15 px-4 py-1.5 text-sm font-medium text-orange-300 backdrop-blur-sm">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-orange-400 opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-orange-400" />
                </span>
                100% Free Forever
              </div>

              <h1 className="mt-6 text-4xl font-extrabold tracking-tight text-white sm:text-5xl lg:text-6xl">
                Complete{' '}
                <span className="bg-gradient-to-r from-orange-400 to-yellow-300 bg-clip-text text-transparent">
                  Restaurant &amp; Cafe
                </span>
                <br />
                Management
              </h1>

              <p className="mt-6 max-w-xl text-lg text-gray-200 sm:text-xl">
                Digital Menu with QR Code. Manage Orders, Tables, Earnings &amp; Analytics — all from one app. Customers scan &amp; order instantly.
              </p>

              {/* CTA Buttons */}
              <div className="mt-8 flex flex-col items-start gap-4 sm:flex-row">
                <a
                  href="/download/restroqr-owner.apk"
                  className="inline-flex items-center gap-2.5 rounded-2xl bg-orange-500 px-7 py-3.5 text-base font-semibold text-white shadow-lg shadow-orange-900/30 transition hover:bg-orange-600 hover:shadow-xl"
                >
                  <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M17.523 2.146a.5.5 0 00-.857-.354L14.383 4.08a8.5 8.5 0 00-4.766 0L7.334 1.792a.5.5 0 00-.857.354v3.07A8.5 8.5 0 004 11.5V18a2 2 0 002 2h12a2 2 0 002-2v-6.5a8.5 8.5 0 00-2.477-6.284V2.146zM8.5 11a1.5 1.5 0 110-3 1.5 1.5 0 010 3zm7 0a1.5 1.5 0 110-3 1.5 1.5 0 010 3z" />
                  </svg>
                  Download APK
                </a>

                {/* Google Play Store Coming Soon Button */}
                <div
                  className="group relative inline-flex cursor-default items-center gap-3 rounded-2xl border-2 border-white/20 bg-white/10 px-6 py-3 backdrop-blur-sm transition hover:border-orange-400/40 hover:bg-white/20"
                >
                  <svg className="h-7 w-7 text-white/70 transition group-hover:text-orange-400" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M3.609 1.814L13.792 12 3.61 22.186a.996.996 0 01-.61-.92V2.734a1 1 0 01.609-.92zm10.89 10.893l2.302 2.302-10.937 6.333 8.635-8.635zm3.199-1.6l2.651 1.535c.539.312.539 1.086 0 1.398l-2.651 1.535-2.537-2.537 2.537-2.537v.606zm-3.906-1.601L5.157 1.87l10.937 6.334-2.302 2.302z" />
                  </svg>
                  <div className="text-left">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-orange-400">Coming Soon on</p>
                    <p className="text-base font-bold text-white">Google Play</p>
                  </div>
                  <span className="absolute -top-2.5 -right-2.5 rounded-full bg-orange-500 px-2.5 py-0.5 text-[10px] font-bold text-white shadow">
                    SOON
                  </span>
                </div>
              </div>

              {/* Floating Stats */}
              <div className="mt-10 flex flex-wrap gap-6">
                <div className="flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-green-500/20 backdrop-blur-sm">
                    <svg className="h-4 w-4 text-green-400" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <span className="text-sm font-medium text-gray-300">No Hidden Charges</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-500/20 backdrop-blur-sm">
                    <span className="text-sm">☁️</span>
                  </div>
                  <span className="text-sm font-medium text-gray-300">Cloud Synced</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-orange-500/20 backdrop-blur-sm">
                    <span className="text-sm">🔒</span>
                  </div>
                  <span className="text-sm font-medium text-gray-300">Secure &amp; Reliable</span>
                </div>
              </div>
          </div>
        </div>
      </section>

      {/* ===== TRUSTED STRIP ===== */}
      <section className="border-y border-gray-100 bg-gray-50 py-6">
        <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-center gap-8 px-6 text-center">
          {[
            { icon: '🚀', text: 'Easy to Use' },
            { icon: '☁️', text: 'Cloud Sync' },
            { icon: '🔒', text: 'Secure & Reliable' },
            { icon: '💬', text: '24/7 Support' },
            { icon: '🎁', text: '100% Free Forever' },
          ].map((item) => (
            <div key={item.text} className="flex items-center gap-2 text-sm font-medium text-gray-600">
              <span className="text-lg">{item.icon}</span>
              {item.text}
            </div>
          ))}
        </div>
      </section>

      {/* ===== HERO POSTER (Full Width) ===== */}
      <section className="bg-gradient-to-b from-white to-orange-50 py-16">
        <div className="mx-auto max-w-6xl px-6">
          <div className="overflow-hidden rounded-3xl shadow-2xl shadow-orange-200/30">
            <Image
              src="/screenshots/hero-poster.png"
              alt="RestroQR - Complete Restaurant & Cafe Management App"
              width={1600}
              height={900}
              className="h-auto w-full object-cover"
              priority
            />
          </div>
        </div>
      </section>

      {/* ===== ALL FEATURES SECTION ===== */}
      <section id="features" className="bg-white py-20">
        <div className="mx-auto max-w-6xl px-6">
          <div className="text-center">
            <div className="inline-flex items-center gap-2 rounded-full bg-orange-100 px-4 py-1.5 text-sm font-medium text-orange-700">
              ✨ Powerful Features
            </div>
            <h2 className="mt-4 text-3xl font-bold text-gray-900 sm:text-4xl">
              Everything Your Restaurant Needs
            </h2>
            <p className="mt-4 text-lg text-gray-600">
              Complete restaurant management solution — from digital menu to order tracking
            </p>
          </div>

          <div className="mt-16 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {allFeatures.map((feature) => (
              <div
                key={feature.title}
                className="group relative overflow-hidden rounded-2xl border border-gray-100 bg-white p-6 shadow-sm transition-all duration-300 hover:border-orange-200 hover:shadow-lg hover:-translate-y-1"
              >
                <div className="absolute inset-0 bg-gradient-to-br from-orange-50 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
                <div className="relative">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-orange-100 text-2xl transition-colors group-hover:bg-orange-500 group-hover:text-white">
                    {feature.emoji}
                  </div>
                  <h3 className="mt-4 text-lg font-semibold text-gray-900">{feature.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-gray-600">{feature.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== APP SCREENSHOTS SECTION ===== */}
      <section id="screenshots" className="bg-gradient-to-b from-orange-50 to-white py-20">
        <div className="mx-auto max-w-6xl px-6">
          <div className="text-center">
            <div className="inline-flex items-center gap-2 rounded-full bg-orange-100 px-4 py-1.5 text-sm font-medium text-orange-700">
              📱 App Preview
            </div>
            <h2 className="mt-4 text-3xl font-bold text-gray-900 sm:text-4xl">
              See It In Action
            </h2>
            <p className="mt-4 text-lg text-gray-600">
              Real screenshots from the RestroQR Owner App
            </p>
          </div>

          <div className="mt-14 grid gap-8 sm:grid-cols-2 lg:grid-cols-5">
            {screenshots.map((ss) => (
              <div key={ss.label} className="group text-center">
                <div className="relative mx-auto aspect-[9/16] w-full max-w-[220px] overflow-hidden rounded-[2rem] border-[6px] border-gray-900 bg-gray-900 shadow-2xl transition-transform duration-300 group-hover:scale-105">
                  {/* Phone notch */}
                  <div className="absolute inset-x-0 top-0 z-10 flex h-6 items-center justify-center bg-gray-900">
                    <div className="h-2.5 w-16 rounded-full bg-gray-800" />
                  </div>
                  <Image
                    src={ss.src}
                    alt={ss.label}
                    width={300}
                    height={600}
                    className="h-full w-full object-cover object-top"
                  />
                </div>
                <p className="mt-4 text-sm font-semibold text-gray-800">{ss.label}</p>
                <p className="mt-1 text-xs text-gray-500">{ss.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== HOW IT WORKS ===== */}
      <section className="bg-white py-20">
        <div className="mx-auto max-w-6xl px-6">
          <div className="text-center">
            <div className="inline-flex items-center gap-2 rounded-full bg-orange-100 px-4 py-1.5 text-sm font-medium text-orange-700">
              🎯 Simple Steps
            </div>
            <h2 className="mt-4 text-3xl font-bold text-gray-900 sm:text-4xl">
              How It Works
            </h2>
            <p className="mt-4 text-lg text-gray-600">Get your digital menu up and running in minutes</p>
          </div>

          <div className="mt-16 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {howItWorks.map((step, i) => (
              <div key={step.title} className="relative text-center">
                {/* Connector line */}
                {i < howItWorks.length - 1 && (
                  <div className="absolute right-0 top-7 hidden h-0.5 w-full translate-x-1/2 bg-gradient-to-r from-orange-300 to-orange-100 lg:block" />
                )}
                <div className="relative z-10 mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-orange-500 to-red-500 text-2xl font-bold text-white shadow-lg shadow-orange-200">
                  {step.emoji}
                </div>
                <h3 className="mt-4 text-lg font-semibold text-gray-900">{step.title}</h3>
                <p className="mt-2 text-sm text-gray-600">{step.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== FOR CUSTOMERS SECTION ===== */}
      <section className="bg-gradient-to-b from-orange-50 to-white py-20">
        <div className="mx-auto max-w-6xl px-6">
          <div className="text-center">
            <div className="inline-flex items-center gap-2 rounded-full bg-green-100 px-4 py-1.5 text-sm font-medium text-green-700">
              👥 For Customers
            </div>
            <h2 className="mt-4 text-3xl font-bold text-gray-900 sm:text-4xl">
              Scan. View. Order. Enjoy!
            </h2>
            <p className="mt-4 text-lg text-gray-600">
              Your customers don&apos;t need to download any app
            </p>
          </div>

          <div className="mt-14 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {customerFeatures.map((cf) => (
              <div key={cf.title} className="rounded-2xl border border-gray-100 bg-white p-6 text-center shadow-sm transition hover:shadow-md">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-orange-100 to-red-50 text-2xl">
                  {cf.emoji}
                </div>
                <h3 className="mt-4 text-base font-semibold text-gray-900">{cf.title}</h3>
                <p className="mt-2 text-sm text-gray-600">{cf.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== PRICING SECTION ===== */}
      <section id="pricing" className="bg-white py-20">
        <div className="mx-auto max-w-6xl px-6">
          <div className="mx-auto max-w-lg text-center">
            <h2 className="text-3xl font-bold text-gray-900 sm:text-4xl">Free. Forever.</h2>
            <p className="mt-4 text-lg text-gray-600">
              No hidden charges. No premium tier. No trial that expires.
            </p>
          </div>

          <div className="mx-auto mt-12 max-w-md">
            <div className="overflow-hidden rounded-3xl border-2 border-orange-200 bg-white shadow-xl">
              <div className="bg-gradient-to-r from-orange-500 to-red-500 px-8 py-8 text-center text-white">
                <p className="text-sm font-medium opacity-90">RestroQR Plan</p>
                <div className="mt-2 flex items-baseline justify-center gap-1">
                  <span className="text-5xl font-extrabold">₹0</span>
                  <span className="text-lg opacity-80">/ forever</span>
                </div>
                <p className="mt-2 text-sm opacity-80">All features included, no limits</p>
              </div>
              <div className="px-8 py-8">
                <ul className="space-y-3">
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

      {/* ===== COMING SOON FEATURES ===== */}
      <section className="bg-gray-50 py-20">
        <div className="mx-auto max-w-6xl px-6">
          <div className="text-center">
            <div className="inline-flex items-center gap-2 rounded-full bg-purple-100 px-4 py-1.5 text-sm font-medium text-purple-700">
              🚀 Roadmap
            </div>
            <h2 className="mt-4 text-3xl font-bold text-gray-900 sm:text-4xl">Coming Soon</h2>
            <p className="mt-4 text-lg text-gray-600">Features we&apos;re building next</p>
          </div>

          <div className="mx-auto mt-12 grid max-w-3xl gap-4 sm:grid-cols-2">
            {futureFeatures.map((item) => (
              <div
                key={item.title}
                className="flex items-start gap-3 rounded-xl border border-gray-200 bg-white px-5 py-4 transition hover:border-purple-200 hover:shadow-sm"
              >
                <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-purple-100 text-sm">
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

      {/* ===== CTA FOOTER ===== */}
      <section className="relative overflow-hidden bg-gradient-to-r from-orange-500 via-orange-600 to-red-500 py-20">
        <div className="absolute inset-0">
          <div className="absolute -top-20 -left-20 h-60 w-60 rounded-full bg-white opacity-5 blur-3xl" />
          <div className="absolute -bottom-20 -right-20 h-60 w-60 rounded-full bg-white opacity-5 blur-3xl" />
        </div>
        <div className="relative mx-auto max-w-4xl px-6 text-center">
          <h2 className="text-3xl font-bold text-white sm:text-4xl lg:text-5xl">
            Ready to Go Digital?
          </h2>
          <p className="mt-4 text-lg text-orange-100">
            Download the app, set up your menu, print QR — done. It&apos;s that simple.
          </p>
          <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <a
              href="/download/restroqr-owner.apk"
              className="inline-flex items-center gap-2 rounded-full bg-white px-8 py-3.5 text-base font-semibold text-orange-600 shadow-lg transition hover:bg-orange-50 hover:shadow-xl"
            >
              <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M17.523 2.146a.5.5 0 00-.857-.354L14.383 4.08a8.5 8.5 0 00-4.766 0L7.334 1.792a.5.5 0 00-.857.354v3.07A8.5 8.5 0 004 11.5V18a2 2 0 002 2h12a2 2 0 002-2v-6.5a8.5 8.5 0 00-2.477-6.284V2.146zM8.5 11a1.5 1.5 0 110-3 1.5 1.5 0 010 3zm7 0a1.5 1.5 0 110-3 1.5 1.5 0 010 3z" />
              </svg>
              Download Owner App (APK)
            </a>
            {/* Google Play Coming Soon */}
            <div className="group inline-flex cursor-default items-center gap-3 rounded-full border-2 border-white/30 bg-white/10 px-7 py-3 backdrop-blur-sm transition hover:bg-white/20">
              <svg className="h-6 w-6 text-white" viewBox="0 0 24 24" fill="currentColor">
                <path d="M3.609 1.814L13.792 12 3.61 22.186a.996.996 0 01-.61-.92V2.734a1 1 0 01.609-.92zm10.89 10.893l2.302 2.302-10.937 6.333 8.635-8.635zm3.199-1.6l2.651 1.535c.539.312.539 1.086 0 1.398l-2.651 1.535-2.537-2.537 2.537-2.537v.606zm-3.906-1.601L5.157 1.87l10.937 6.334-2.302 2.302z" />
              </svg>
              <div className="text-left">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-orange-200">Coming Soon</p>
                <p className="text-sm font-bold text-white">Google Play Store</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ===== FOOTER ===== */}
      <footer className="border-t border-gray-100 bg-white py-10">
        <div className="mx-auto max-w-6xl px-6">
          <div className="flex flex-col items-center gap-6 sm:flex-row sm:justify-between">
            <div className="flex items-center gap-2">
              <Image src="/logo-icon.png" alt="RestroQR" width={32} height={32} className="rounded-md" />
              <span className="text-lg font-bold text-gray-900">RestroQR</span>
              <span className="ml-2 text-xs text-gray-400">Scan • View • Enjoy</span>
            </div>
            <div className="flex items-center gap-6">
              <Link href="/privacy-policy" className="text-sm text-gray-500 transition hover:text-orange-600">
                Privacy Policy
              </Link>
              <a href="mailto:support@restroqr.com" className="text-sm text-gray-500 transition hover:text-orange-600">
                Contact
              </a>
            </div>
          </div>
          <div className="mt-6 text-center">
            <p className="text-sm text-gray-500">
              Made with ❤️ for Indian Restaurants
            </p>
            <p className="mt-1 text-xs text-gray-400">
              © {new Date().getFullYear()} RestroQR. Free and open source.
            </p>
          </div>
        </div>
      </footer>
    </main>
  );
}

/* ---------- Data ---------- */

const allFeatures = [
  {
    emoji: '📱',
    title: 'Digital QR Code Menu',
    description: 'Auto-generated permanent QR code for your restaurant. Print it once, customers scan and view your menu instantly on their phones.',
  },
  {
    emoji: '🪑',
    title: 'Table Management',
    description: 'Create and manage multiple tables. Each table gets its own unique QR code. Customers scan the table QR to place orders directly.',
  },
  {
    emoji: '📝',
    title: 'Order Management',
    description: 'Receive and manage orders in real-time. Track order status — Pending, Preparing, Ready. Complete order history with timestamps.',
  },
  {
    emoji: '💰',
    title: 'Earnings Dashboard',
    description: 'Track your total revenue with monthly summaries. See daily, weekly, and monthly earnings breakdown at a glance.',
  },
  {
    emoji: '📊',
    title: 'Item Analytics',
    description: 'See which items are selling the most. Per-item sales analytics with daily, weekly, and monthly breakdowns. Know your bestsellers.',
  },
  {
    emoji: '🗂️',
    title: 'Menu Categories',
    description: 'Organize items into categories — Starters, Main Course, Beverages, Desserts. Drag to reorder categories as you like.',
  },
  {
    emoji: '🍽️',
    title: 'Food Item Management',
    description: 'Add unlimited food items with name, description, price, and photo. Edit or remove items anytime. Changes reflect instantly.',
  },
  {
    emoji: '🟢',
    title: 'Veg / Non-Veg Filter',
    description: 'Familiar green and red badges for veg and non-veg items. Customers can filter items with one tap to find what they want.',
  },
  {
    emoji: '🔍',
    title: 'Instant Search',
    description: 'Real-time search across all menu items. Customers find any dish in seconds, even in a menu with hundreds of items.',
  },
  {
    emoji: '📸',
    title: 'Food Item Photos',
    description: 'Upload beautiful food images for each item. Photos are stored on the cloud and load lightning fast on customer devices.',
  },
  {
    emoji: '🏪',
    title: 'Restaurant Profile',
    description: 'Set up your restaurant name, address, phone number, and branding. Your profile is displayed on the customer menu page.',
  },
  {
    emoji: '🔄',
    title: 'Multi-Table QR Mode',
    description: 'Enable multi-table mode to generate individual QR codes for each table. Customers scan their table QR and order from their seat.',
  },
  {
    emoji: '⚡',
    title: 'Real-Time Updates',
    description: 'Any changes to your menu are reflected instantly. Update prices, add items, or mark items unavailable — customers see it right away.',
  },
  {
    emoji: '📲',
    title: 'Mobile First Design',
    description: 'Customer menu is designed for phones. Super fast loading on 4G/5G. Works on every browser, no app download needed for customers.',
  },
  {
    emoji: '☁️',
    title: 'Cloud Synced',
    description: 'All your data is securely stored in the cloud. Access your restaurant dashboard from anywhere, anytime. Never lose your data.',
  },
];

const screenshots = [
  {
    src: '/screenshots/qr-code.jpg',
    label: 'QR Code',
    desc: 'Auto-generated QR for your restaurant',
  },
  {
    src: '/screenshots/tables.jpg',
    label: 'Table Management',
    desc: 'Manage tables with individual QR codes',
  },
  {
    src: '/screenshots/earnings.jpg',
    label: 'Earnings Dashboard',
    desc: 'Track revenue & order summary',
  },
  {
    src: '/screenshots/analytics.jpg',
    label: 'Item Analytics',
    desc: 'See your top-selling items',
  },
  {
    src: '/screenshots/qr-settings.jpg',
    label: 'QR Mode Settings',
    desc: 'Multi-table QR configuration',
  },
];

const howItWorks = [
  {
    emoji: '📥',
    title: 'Download App',
    description: 'Install the RestroQR Owner app on your Android phone',
  },
  {
    emoji: '🍔',
    title: 'Add Your Menu',
    description: 'Add categories, food items with photos, prices and descriptions',
  },
  {
    emoji: '🖨️',
    title: 'Print QR Code',
    description: 'Download your auto-generated QR code and print it for tables',
  },
  {
    emoji: '✅',
    title: 'Start Receiving Orders!',
    description: 'Customers scan, browse menu, and place orders. You manage everything from the app',
  },
];

const customerFeatures = [
  {
    emoji: '📷',
    title: 'Scan QR Code',
    description: 'Just point camera at the QR code on the table. No app download required.',
  },
  {
    emoji: '📖',
    title: 'View Menu',
    description: 'Beautiful digital menu with food images, prices, and descriptions. Filter by veg/non-veg.',
  },
  {
    emoji: '🛒',
    title: 'Place Order',
    description: 'Add items to cart and place order directly from the table. No waiting for a waiter.',
  },
  {
    emoji: '🍽️',
    title: 'Enjoy Meal',
    description: 'Sit back and relax. Your order is sent directly to the restaurant kitchen.',
  },
];

const pricingFeatures = [
  'Unlimited menu items & categories',
  'Food item images with cloud storage',
  'Auto-generated QR code',
  'Multi-table QR mode',
  'Real-time order management',
  'Earnings & revenue dashboard',
  'Per-item sales analytics',
  'Veg/Non-veg badges & filters',
  'Search & filter for customers',
  'Mobile-optimized customer menu',
  'Cloud sync & data backup',
  'No ads on menu page',
];

const futureFeatures = [
  { emoji: '💳', title: 'UPI Payments', description: 'Accept payments via UPI/Razorpay directly' },
  { emoji: '🌐', title: 'Multi-language Menus', description: 'Hindi, Tamil, Marathi & more language support' },
  { emoji: '⭐', title: 'Customer Reviews', description: 'Collect ratings and feedback on dishes' },
  { emoji: '📱', title: 'iOS Owner App', description: 'Coming to iPhone soon' },
  { emoji: '🖥️', title: 'Web Dashboard', description: 'Manage your restaurant from a desktop browser' },
  { emoji: '🔔', title: 'Push Notifications', description: 'Get notified instantly when orders come in' },
];
