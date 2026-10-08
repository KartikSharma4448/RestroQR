import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowDown, ArrowUpRight, Check, Download, LayoutList, QrCode, ReceiptText, Smartphone, Table2, TrendingUp } from 'lucide-react';

export const metadata: Metadata = {
  title: 'RestroQR - Digital QR Menus for Restaurants',
  description: 'Create a digital menu, share restaurant and table QR codes, and manage orders with the RestroQR Android owner app.',
};

const features = [
  { icon: QrCode, title: 'One scan. Your whole menu.', copy: 'Share a restaurant QR code with dishes, prices and dietary filters in one place.' },
  { icon: ReceiptText, title: 'Orders, without the paper trail.', copy: 'Receive table orders and keep pending, preparing and ready orders organized.' },
  { icon: Table2, title: 'Every table, connected.', copy: 'Create individual table QR codes and manage them from your owner app.' },
  { icon: LayoutList, title: 'A menu that stays up to date.', copy: 'Manage categories, prices and availability as your menu changes.' },
  { icon: TrendingUp, title: 'A clearer view of your business.', copy: 'Review revenue summaries and item sales by day, week or month.' },
  { icon: Smartphone, title: 'Built for the restaurant floor.', copy: 'Manage your restaurant on Android. Customers browse directly in their browser.' },
];
const screens = [
  { src: 'owner-overview.png', label: 'Restaurant overview' },
  { src: 'owner-orders.png', label: 'Order management' },
  { src: 'owner-menu.png', label: 'Menu categories' },
  { src: 'owner-qr.png', label: 'Restaurant QR' },
];
const apk = '/download/restroqr-owner.apk';

export default function HomePage() {
  return (
    <main className="intro-site">
      <a className="skip-link" href="#main-content">Skip to content</a>
      <nav className="intro-nav" aria-label="Main navigation">
        <div className="site-width nav-inner">
          <Link href="/" className="wordmark"><Image src="/logo-icon.png" alt="" width={34} height={34} /><span>Restro<span className="brand-accent">QR</span></span></Link>
          <div className="nav-links"><a href="#features">Features</a><a href="#screenshots">The app</a><a href="#pricing">Pricing</a></div>
          <a className="button button-dark nav-download" href={apk}><Download size={17} /> <span>Get the app</span></a>
        </div>
      </nav>
      <section id="main-content" className="intro-hero">
        <Image src="/screenshots/cafe-hero.png" alt="A cafe meal beside a tabletop QR menu" fill priority sizes="100vw" className="hero-photo" />
        <div className="site-width hero-content">
          <p className="eyebrow">For restaurants &amp; cafes</p>
          <h1>RestroQR</h1>
          <p className="hero-statement">Good food.<br />A simpler way to serve it.</p>
          <p className="hero-copy">Your menu, tables and orders. Connected with a QR code, managed from your phone.</p>
          <div className="hero-actions"><a className="button button-white" href={apk}><Download size={19} /> Download Android app</a><a className="hero-secondary" href="#screenshots">Explore the app <ArrowDown size={17} /></a></div>
          <p className="hero-footnote">Free to use <span aria-hidden="true">/</span> No customer app needed</p>
        </div>
      </section>
      <div className="intro-strip"><div className="site-width strip-inner"><span><QrCode size={20} /> Scan the QR</span><span><LayoutList size={20} /> Browse the menu</span><span><ReceiptText size={20} /> Order from the table</span></div></div>
      <section id="features" className="intro-section site-width">
        <div className="section-heading"><div><p className="eyebrow">The everyday essentials</p><h2>Less juggling.<br />More serving.</h2></div><p>Bring the restaurant&apos;s daily work together, from the first scan to the last order.</p></div>
        <div className="feature-grid">{features.map(({ icon: Icon, title, copy }) => <article key={title} className="feature-item"><Icon size={25} strokeWidth={1.7} /><h3>{title}</h3><p>{copy}</p></article>)}</div>
      </section>
      <section id="screenshots" className="screens-section">
        <div className="site-width intro-section"><div className="section-heading"><div><p className="eyebrow">Inside the owner app</p><h2>Your restaurant.<br />Always within reach.</h2></div><p>App previews shown with sample restaurant data.</p></div>
          <div className="screenshot-grid">{screens.map(({ src, label }, index) => <figure key={src}><div className="app-screenshot"><Image src={`/screenshots/${src}`} alt={label} width={390} height={844} sizes="(max-width: 600px) 70vw, (max-width: 900px) 40vw, 260px" /></div><figcaption><span>0{index + 1}</span>{label}</figcaption></figure>)}</div>
        </div>
      </section>
      <section id="pricing" className="site-width intro-section pricing-section"><div><p className="eyebrow">Simple pricing</p><h2>A digital menu.<br />Without a monthly bill.</h2><p className="section-copy">Start with the Android owner app.</p></div><div className="pricing-details"><p className="price">&#8377;0 <span>to use RestroQR</span></p><ul>{['Menu items and categories', 'Restaurant and table QR codes', 'Order management', 'Revenue and item analytics'].map(item => <li key={item}><Check size={18} />{item}</li>)}</ul><a href={apk} className="button button-dark"><Download size={18} /> Get the Android app <ArrowUpRight size={18} /></a><p className="download-note">APK download. Google Play availability is coming later.</p></div></section>
      <footer className="intro-footer"><div className="site-width footer-inner"><Link href="/" className="wordmark"><Image src="/logo-icon.png" alt="" width={30} height={30} />RestroQR</Link><p>&copy; {new Date().getFullYear()} RestroQR</p><Link href="/privacy-policy">Privacy policy <ArrowUpRight size={14} /></Link></div></footer>
    </main>
  );
}
