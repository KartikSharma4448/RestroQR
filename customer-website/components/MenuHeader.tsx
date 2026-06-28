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
    <header className="relative mb-6">
      {/* Cover image */}
      <div className="relative h-48 w-full overflow-hidden bg-gray-200 sm:h-56">
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
              className="h-16 w-16 text-white/30"
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
        {/* Bottom gradient */}
        <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/40 to-transparent" />
      </div>

      {/* Logo + Name overlay */}
      <div className="absolute inset-x-0 bottom-0 flex items-end gap-3 px-4 pb-4">
        <div className="h-16 w-16 flex-shrink-0 overflow-hidden rounded-xl border-2 border-white bg-white shadow-lg sm:h-18 sm:w-18">
          {logo_url ? (
            <Image
              src={logo_url}
              alt={`${name} logo`}
              width={72}
              height={72}
              className="h-full w-full object-cover"
              loading="eager"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-orange-400 to-orange-600">
              <span className="text-xl font-bold text-white sm:text-2xl">
                {name.charAt(0).toUpperCase()}
              </span>
            </div>
          )}
        </div>
        <div className="pb-0.5">
          <h1 className="text-xl font-bold text-white drop-shadow-lg sm:text-2xl">
            {name}
          </h1>
          <p className="text-xs text-white/80 drop-shadow">Digital Menu</p>
        </div>
      </div>
    </header>
  );
}
