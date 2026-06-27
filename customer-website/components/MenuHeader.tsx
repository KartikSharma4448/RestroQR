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
      <div className="relative h-40 w-full overflow-hidden rounded-b-xl bg-gray-200 sm:h-52 md:h-60">
        {cover_image_url ? (
          <Image
            src={cover_image_url}
            alt={`${name} restaurant cover image`}
            fill
            className="object-cover"
            sizes="(max-width: 768px) 100vw, 768px"
            priority
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-orange-100 to-orange-200">
            <svg
              className="h-12 w-12 text-orange-300"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0022.5 18.75V5.25A2.25 2.25 0 0020.25 3H3.75A2.25 2.25 0 001.5 5.25v13.5A2.25 2.25 0 003.75 21z"
              />
            </svg>
          </div>
        )}
      </div>

      {/* Logo */}
      <div className="absolute -bottom-8 left-1/2 -translate-x-1/2">
        <div className="h-16 w-16 overflow-hidden rounded-full border-4 border-white bg-white shadow-md sm:h-20 sm:w-20">
          {logo_url ? (
            <Image
              src={logo_url}
              alt={`${name} restaurant logo`}
              width={80}
              height={80}
              className="h-full w-full object-cover"
              loading="eager"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-orange-50">
              <span className="text-xl font-bold text-orange-400 sm:text-2xl">
                {name.charAt(0).toUpperCase()}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Restaurant name */}
      <div className="mt-12 text-center">
        <h1 className="text-xl font-bold text-gray-900 sm:text-2xl">
          {name}
        </h1>
      </div>
    </header>
  );
}
