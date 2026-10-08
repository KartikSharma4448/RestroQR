'use client';
interface FilterToggleProps { activeFilter: 'veg' | 'non_veg' | null; onChange: (filter: 'veg' | 'non_veg' | null) => void; }
export default function FilterToggle({ activeFilter, onChange }: FilterToggleProps) {
  return <div className="diet-filters" role="group" aria-label="Filter by food type">{(['veg', 'non_veg'] as const).map(filter => <button key={filter} type="button" aria-pressed={activeFilter === filter} aria-label={filter === 'veg' ? 'Filter vegetarian items' : 'Filter non-vegetarian items'} onClick={() => onChange(activeFilter === filter ? null : filter)}><span className={`diet-mark ${filter === 'veg' ? 'veg' : 'non-veg'}`} aria-hidden="true"><span /></span>{filter === 'veg' ? 'Veg' : 'Non-Veg'}</button>)}</div>;
}
