'use client';

interface FilterToggleProps {
  activeFilter: 'veg' | 'non_veg' | null;
  onChange: (filter: 'veg' | 'non_veg' | null) => void;
}

export default function FilterToggle({ activeFilter, onChange }: FilterToggleProps) {
  const handleClick = (filter: 'veg' | 'non_veg') => {
    onChange(activeFilter === filter ? null : filter);
  };

  return (
    <div className="flex gap-2.5" role="group" aria-label="Filter by food type">
      <button
        type="button"
        onClick={() => handleClick('veg')}
        className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold transition-all duration-300 active:scale-95 ${
          activeFilter === 'veg'
            ? 'bg-emerald-50 text-emerald-700 ring-2 ring-emerald-500/80 shadow-md shadow-emerald-500/10'
            : 'bg-slate-50 text-slate-600 hover:bg-emerald-50/50 hover:text-emerald-700 border border-slate-200/60'
        }`}
        aria-pressed={activeFilter === 'veg'}
        aria-label="Filter vegetarian items"
      >
        <span
          className={`inline-flex h-4 w-4 items-center justify-center rounded-md border-2 ${
            activeFilter === 'veg' ? 'border-emerald-600 bg-emerald-100/50' : 'border-emerald-500'
          }`}
        >
          <span className="h-2 w-2 rounded-full bg-emerald-600" />
        </span>
        Veg
      </button>

      <button
        type="button"
        onClick={() => handleClick('non_veg')}
        className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold transition-all duration-300 active:scale-95 ${
          activeFilter === 'non_veg'
            ? 'bg-rose-50 text-rose-700 ring-2 ring-rose-500/80 shadow-md shadow-rose-500/10'
            : 'bg-slate-50 text-slate-600 hover:bg-rose-50/50 hover:text-rose-700 border border-slate-200/60'
        }`}
        aria-pressed={activeFilter === 'non_veg'}
        aria-label="Filter non-vegetarian items"
      >
        <span
          className={`inline-flex h-4 w-4 items-center justify-center rounded-md border-2 ${
            activeFilter === 'non_veg' ? 'border-rose-600 bg-rose-100/50' : 'border-rose-500'
          }`}
        >
          <span className="h-2 w-2 rounded-full bg-rose-600" />
        </span>
        Non-Veg
      </button>
    </div>
  );
}
