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
    <header className="relative mb-8 overflow-hidden rounded-b-[2rem] bg-slate-900 shadow-xl shadow-slate-950/10">
      {/* Cover image area */}
      <div className="relative h-56 w-full overflow-hidden bg-slate-950 sm:h-64">
        {cover_image_url ? (
          <Image
            src={cover_image_url}
            alt={`${name} restaurant cover`}
            fill
            className="object-cover opacity-80 transition-transform duration-700 hover:scale-105"
            sizes="(max-width: 768px) 100vw, 768px"
            priority
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-tr from-amber-600 via-orange-600 to-rose-600 opacity-80" />
        )}
        
        {/* Modern decorative mesh background pattern */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.06)_0%,transparent_60%)]" />
        
        {/* Soft, rich gradient overlay for typography readability */}
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-900/40 to-transparent" />
      </div>

      {/* Floating Info Card */}
      <div className="relative -mt-14 px-4 pb-6">
        <div className="flex flex-col gap-4 rounded-2xl border border-white/10 bg-slate-900/90 p-5 shadow-2xl backdrop-blur-xl sm:flex-row sm:items-center">
          {/* Logo container with ambient glow */}
          <div className="relative -mt-12 h-20 w-20 flex-shrink-0 self-start overflow-hidden rounded-2xl border-4 border-slate-900 bg-slate-900 shadow-xl sm:mt-0 sm:self-center">
            {logo_url ? (
              <Image
                src={logo_url}
                alt={`${name} logo`}
                width={80}
                height={80}
                className="h-full w-full object-cover"
                loading="eager"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-amber-400 to-orange-500 font-extrabold text-white">
                <span className="text-3xl tracking-tight">
                  {name.charAt(0).toUpperCase()}
                </span>
              </div>
            )}
          </div>

          {/* Restaurant details */}
          <div className="flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-black tracking-tight text-white sm:text-3xl">
                {name}
              </h1>
              <span className="inline-flex items-center rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-semibold text-emerald-400 border border-emerald-500/25">
                <span className="mr-1.5 h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Table Ordering Enabled
              </span>
            </div>
            
            <div className="mt-2 flex flex-wrap gap-4 text-xs font-medium text-slate-400">
              <span className="flex items-center gap-1">
                <span>📍</span> Fast contactless service
              </span>
              <span className="flex items-center gap-1">
                <span>⭐</span> Premium Dining
              </span>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
