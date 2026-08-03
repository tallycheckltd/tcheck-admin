import { Search } from 'lucide-react';
import { Input } from './Input';
import type { ComponentProps } from 'react';

type SearchInputProps = Omit<ComponentProps<typeof Input>, 'icon'>;

export function SearchInput(props: SearchInputProps) {
  return <Input icon={Search} placeholder="Search…" {...props} />;
}
