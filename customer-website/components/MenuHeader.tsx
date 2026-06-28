import Image from 'next/image';

interface MenuHeaderProps {
  name: string;
  logo_url: string | null;
  cover_image_url: string | null;
}

export default function MenuHeader({
  name,
  logo_url,
  cover_image_url,
}: MenuHeaderProps) {
  return (
    <header className="relative mb-8">
      {/* Cover image */}
      <div className="relative h-44 w-full overflow-hidden bg-gray-200 sm:h-56 md:h-64">
        {cover_image_url ? (
          <Image
            src={cover_image_url}
            alt={`${name} restaurant cover`}
            fill
            className="object-cover"
            sizes="(max-width: 768px) 100vw, 768px"
            priority
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-orange-400 via-orange-500 to-red-500">
            <svg
              className="h-16 w-16 text-white/40"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M12 8.25v-1.5m0 1.5c-1.355 0-2.697.056-4.024.166C6.845 8.51 6 9.473 6 10.608v2.513m6-4.87c1.355 0 2.697.055 4.024.165C17.155 8.51 18 9.473 18 10.608v2.513m-3-4.87v-1.5m-6 1.5v-1.5m12 9.75l-1.5.75a3.354 3.354 0 01-3 0 3.354 3.354 0 00-3 0 3.354 3.354 0 01-3 0 3.354 3.354 0 00-3 0 3.354 3.354 0 01-3 0L3 16.5m15-3.38a48.474 48.474 0 00-6-.37c-2.032 0-4.034.125-6 .37m12 0c.39.049.777.102 1.163.16 1.07.16 1.837 1.094 1.837 2.175v5.17c0 .62-.504 1.124-1.125 1.124H4.125A1.125 1.125 0 013 20.625v-5.17c0-1.08.768-2.014 1.837-2.174A47.78 47.78 0 016 13.12M12.265 3.11a.375.375 0 11-.53 0L12 2.845l.265.265zm-3 0a.375.375 0 11-.53 0L9 2.845l.265.265zm6 0a.375.375 0 11-.53 0L15 2.845l.265.265z"
              />
            </svg>
          </div>
        )}
        {/* Gradient overlay at bottom for text readability */}
        <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-black/30 to-transparent" />
      </div>

      {/* Logo */}
      <div className="absolute -bottom-10 left-1/2 -translate-x-1/2">
        <div className="h-20 w-20 overflow-hidden rounded-full border-4 border-white bg-white shadow-lg sm:h-24 sm:w-24">
          {logo_url ? (
            <Image
              src={logo_url}
              alt={`${name} restaurant logo`}
              width={96}
              height={96}
              className="h-full w-full object-cover"
              loading="eager"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-orange-400 to-orange-600">
              <span className="text-2xl font-bold text-white sm:text-3xl">
                {name.charAt(0).toUpperCase()}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Restaurant name */}
      <div className="mt-14 text-center">
        <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl">
          {name}
        </h1>
        <p className="mt-1 text-sm text-gray-500">Digital Menu</p>
      </div>
    </header>
  );
}
