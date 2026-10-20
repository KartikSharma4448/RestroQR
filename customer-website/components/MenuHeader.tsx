'use client';

import Image from 'next/image';
import { useState } from 'react';
import { ArrowDown, MapPin, Radio, Utensils } from 'lucide-react';
import RestaurantEngagement from './RestaurantEngagement';

interface MenuHeaderProps {
  name: string;
  logo_url: string | null;
  cover_image_url: string | null;
  ordering?: boolean;
  welcome?: boolean;
  ownerPhotoUrl?: string | null;
  address?: string;
  restaurantToken?: string;
}
export default function MenuHeader({
  name,
  logo_url,
  cover_image_url,
  ordering = false,
  welcome = false,
  ownerPhotoUrl,
  address,
  restaurantToken,
}: MenuHeaderProps) {
  const [failedCover, setFailedCover] = useState<string | null>(null);
  const [failedPortrait, setFailedPortrait] = useState<string | null>(null);
  const cover =
    cover_image_url && failedCover !== cover_image_url ? cover_image_url : null;
  const portrait = ownerPhotoUrl || logo_url;
  return (
    <header className="restaurant-header">
      <div className="menu-brand">
        <span className="menu-platform">
          <Image
            src="/logo-icon.png"
            alt=""
            width={22}
            height={22}
            style={{ width: 22, height: 22, objectFit: 'contain' }}
          />
          RestroQR
        </span>
        {welcome && restaurantToken ? (
          <span className="menu-live-link">
            <Utensils size={15} aria-hidden="true" />
            {ordering ? 'Table menu' : 'Digital menu'}
          </span>
        ) : (
          <a href="#live-orders" className="menu-live-link">
            <Radio size={15} aria-hidden="true" />
            Live orders
          </a>
        )}
      </div>
      <div className={`cafe-masthead ${cover ? 'has-cover' : 'no-cover'}`}>
        {cover && (
          <Image
            src={cover}
            alt={`${name} restaurant cover`}
            fill
            sizes="(max-width: 1120px) 100vw, 1120px"
            priority
            className="cafe-cover-image"
            onError={() => setFailedCover(cover)}
          />
        )}
        <div className="cafe-identity">
          <p className="cafe-kicker">
            <Utensils size={14} aria-hidden="true" />
            {ordering
              ? 'Dine in. Make it yours.'
              : 'Food, drinks & good company'}
          </p>
          <h1>{name}</h1>
          <div className="cafe-details">
            {portrait && failedPortrait !== portrait && (
              <div className="cafe-owner">
                <Image
                  src={portrait}
                  alt={`${name} ${ownerPhotoUrl ? 'owner' : 'logo'}`}
                  width={36}
                  height={36}
                  onError={() => setFailedPortrait(portrait)}
                />
              </div>
            )}
            {address ? (
              <p>
                <MapPin size={15} aria-hidden="true" />
                <span>{address}</span>
              </p>
            ) : (
              <p>
                {ordering
                  ? 'Your table. Your favourites.'
                  : 'Welcome to our table.'}
              </p>
            )}
          </div>
        </div>
      </div>
      {welcome && restaurantToken ? (
        <RestaurantEngagement token={restaurantToken} ordering={ordering} />
      ) : (
        <div className="cafe-simple-action">
          <a href="#menu">
            <ArrowDown size={17} />
            {ordering ? 'Order food' : 'Explore the menu'}
          </a>
          <span>Fresh choices, one menu.</span>
        </div>
      )}
    </header>
  );
}
