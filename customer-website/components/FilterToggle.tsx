'use client';

interface FilterToggleProps {
  activeFilter: 'veg' | 'non_veg' | null;
  onChange: (filter: 'veg' | 'non_veg' | null) => void;
}

export default function FilterToggle({ activeFilter, onChange }: FilterToggleProps) {
  const handleClick = (filter: 'veg' | 'non_veg') => {
    // Toggle off if already active, otherwise set the filter
    onChange(activeFilter === filter ? null : filter);
  };

  return (
    <div className="flex gap-2" role="group" aria-label="Filter by food type">
      <button
        type="button"
        onClick={() => handleClick('veg')}
        className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
          activeFilter === 'veg'
            ? 'bg-green-100 text-green-800 ring-1 ring-green-600'
            : 'bg-gray-100 text-gray-600 hover:bg-green-50 hover:text-green-700'
        }`}
        aria-pressed={activeFilter === 'veg'}
        aria-label="Filter vegetarian items"
      >
        <span
          className={`inline-flex h-3.5 w-3.5 items-center justify-center rounded-sm border ${
            activeFilter === 'veg' ? 'border-green-600' : 'border-green-500'
          }`}
        >
          <span className="h-1.5 w-1.5 rounded-full bg-green-600" />
        </span>
        Veg
      </button>

      <button
        type="button"
        onClick={() => handleClick('non_veg')}
        className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
          activeFilter === 'non_veg'
            ? 'bg-red-100 text-red-800 ring-1 ring-red-600'
            : 'bg-gray-100 text-gray-600 hover:bg-red-50 hover:text-red-700'
        }`}
        aria-pressed={activeFilter === 'non_veg'}
        aria-label="Filter non-vegetarian items"
      >
        <span
          className={`inline-flex h-3.5 w-3.5 items-center justify-center rounded-sm border ${
            activeFilter === 'non_veg' ? 'border-red-600' : 'border-red-500'
          }`}
        >
          <span className="h-1.5 w-1.5 rounded-full bg-red-600" />
        </span>
        Non-Veg
      </button>
    </div>
  );
}
