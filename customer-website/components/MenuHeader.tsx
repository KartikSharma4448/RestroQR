import Image from 'next/image';
import { BookOpen, QrCode } from 'lucide-react';

interface MenuHeaderProps {
  name: string;
  logo_url: string | null;
  cover_image_url: string | null;
  ordering?: boolean;
}

export default function MenuHeader({ name, logo_url, cover_image_url, ordering = false }: MenuHeaderProps) {
  return (
    <header className="restaurant-header">
      <div className="menu-brand"><Image src="/logo-icon.png" alt="" width={24} height={24} /><span>RestroQR</span><span className="menu-mode"><QrCode size={14} />{ordering ? 'Table menu' : 'Digital menu'}</span></div>
      {cover_image_url && <div className="restaurant-cover"><Image src={cover_image_url} alt={`${name} restaurant cover`} fill sizes="(max-width: 960px) 100vw, 960px" priority className="object-cover" /></div>}
      <div className="restaurant-identity">
        <div className="restaurant-logo">{logo_url ? <Image src={logo_url} alt={`${name} logo`} width={64} height={64} /> : <span aria-hidden="true">{name.charAt(0).toUpperCase()}</span>}</div>
        <div><p className="eyebrow">{ordering ? 'Order from your table' : 'Welcome to our menu'}</p><h1>{name}</h1></div>
        <span className="restaurant-menu-label"><BookOpen size={18} /> Menu</span>
      </div>
    </header>
  );
}
