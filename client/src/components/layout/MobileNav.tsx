import { NavLink } from 'react-router-dom';
import { Home, Search, Library, Timer, BookMarked } from 'lucide-react';

const MOBILE_ITEMS = [
  { to: '/', label: 'Home', icon: Home, end: true },
  { to: '/search', label: 'Search', icon: Search },
  { to: '/library', label: 'Library', icon: Library },
  { to: '/focus-flow', label: 'Focus', icon: Timer },
  { to: '/memory-mix', label: 'Memory', icon: BookMarked },
];

export function MobileNav() {
  return (
    <nav
      aria-label="Mobile navigation"
      className="flex md:hidden shrink-0 items-center justify-around border-t border-[#1F242D] bg-[#0E1014] py-1.5"
    >
      {MOBILE_ITEMS.map((item) => {
        const Icon = item.icon;
        return (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) =>
              `flex flex-col items-center gap-1 px-2 py-1 text-[11px] font-medium ${
                isActive ? 'text-emerald-400' : 'text-zinc-400'
              }`
            }
          >
            <Icon className="h-4 w-4" />
            <span>{item.label}</span>
          </NavLink>
        );
      })}
    </nav>
  );
}

