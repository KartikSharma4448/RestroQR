'use client';
interface Props {
  activeFilter: 'veg' | 'non_veg' | null;
  onChange: (filter: 'veg' | 'non_veg' | null) => void;
}
const options = [
  { value: null, label: 'All', name: 'All food types' },
  { value: 'veg', label: 'Veg', name: 'Filter vegetarian items' },
  { value: 'non_veg', label: 'Non-Veg', name: 'Filter non-vegetarian items' },
] as const;
export default function FilterToggle({ activeFilter, onChange }: Props) {
  return (
    <div className="diet-filters" role="group" aria-label="Filter by food type">
      {options.map((option, index) => (
        <button
          key={option.label}
          type="button"
          aria-pressed={activeFilter === option.value}
          aria-label={option.name}
          onClick={() => onChange(option.value)}
          onKeyDown={(event) => {
            let next = index;
            if (event.key === 'ArrowRight') next = (index + 1) % options.length;
            else if (event.key === 'ArrowLeft')
              next = (index - 1 + options.length) % options.length;
            else if (event.key === 'Home') next = 0;
            else if (event.key === 'End') next = options.length - 1;
            else return;
            event.preventDefault();
            onChange(options[next].value);
            event.currentTarget.parentElement
              ?.querySelectorAll<HTMLButtonElement>('button')
              [next]?.focus();
          }}
        >
          {option.value && (
            <span
              className={`diet-mark ${option.value === 'veg' ? 'veg' : 'non-veg'}`}
              aria-hidden="true"
            >
              <span />
            </span>
          )}
          {option.label}
        </button>
      ))}
    </div>
  );
}
