import type { ElementType, ReactNode } from 'react';

interface EmptyStateProps {
  icon: ElementType;
  title: string;
  description?: string;
  /** sm: inline table empty-rows. md: full-page/section empty states. */
  size?: 'sm' | 'md';
  action?: ReactNode;
}

export function EmptyState({ icon: Icon, title, description, size = 'md', action }: EmptyStateProps) {
  const iconSize = size === 'sm' ? 28 : 40;
  return (
    <div className={size === 'sm' ? 'py-8 text-center' : 'py-16 text-center'}>
      <Icon size={iconSize} className="mx-auto text-gray-200 dark:text-gray-700 mb-3" />
      <p className="text-sm text-gray-500 dark:text-gray-400">{title}</p>
      {description && <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
