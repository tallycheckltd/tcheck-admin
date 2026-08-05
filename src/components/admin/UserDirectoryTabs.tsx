import { NavLink } from 'react-router-dom';
import { clsx } from 'clsx';

const tabs = [
  { to: '/admin/users', label: 'All Users' },
  { to: '/admin/students', label: 'Students' },
  { to: '/admin/lecturers', label: 'Lecturers' },
  { to: '/admin/school-admins', label: 'School Admins' },
];

/**
 * Ties the four user-directory pages (previously disconnected routes) together as one cohesive
 * segmented directory instead of four separate sidebar links with no visual relationship.
 */
export function UserDirectoryTabs() {
  return (
    <div className="flex flex-wrap gap-1 bg-gray-100 dark:bg-white/5 rounded-xl p-1 w-fit">
      {tabs.map((tab) => (
        <NavLink
          key={tab.to}
          to={tab.to}
          end
          className={({ isActive }) =>
            clsx(
              'px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap',
              isActive
                ? 'bg-white dark:bg-white/10 text-slate-950 dark:text-white shadow-sm'
                : 'text-slate-600 hover:text-gray-700 dark:hover:text-gray-300',
            )
          }
        >
          {tab.label}
        </NavLink>
      ))}
    </div>
  );
}
