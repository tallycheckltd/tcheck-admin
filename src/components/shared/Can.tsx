import type { ReactNode } from 'react';
import { useCan } from '../../hooks/useCan';
import type { Permission } from '../../types';

/** Renders its children only if the signed-in user may perform `perm` — mirrors the server's rules (lib/permissions.ts)
 * so nobody is shown a button that will just come back "you don't have permission". */
export function Can({ perm, newForLecturer, children }: { perm: Permission | Permission[]; newForLecturer?: boolean; children: ReactNode }) {
  return useCan(perm, { newForLecturer }) ? <>{children}</> : null;
}
