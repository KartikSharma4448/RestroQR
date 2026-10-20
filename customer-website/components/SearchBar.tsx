'use client';
import { Search, X } from 'lucide-react';

interface SearchBarProps { value: string; onChange: (value: string) => void; }
export default function SearchBar({ value, onChange }: SearchBarProps) {
  return <div className="menu-search"><Search size={19} aria-hidden="true" /><label htmlFor="menu-search" className="sr-only">Search menu items</label><input id="menu-search" type="search" value={value} onChange={e => onChange(e.target.value)} placeholder="Search dishes, drinks, desserts..." />{value && <button type="button" onClick={() => onChange('')} aria-label="Clear search" title="Clear search"><X size={18} /></button>}</div>;
}
