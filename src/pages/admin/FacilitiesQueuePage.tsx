import { FacilitiesQueue } from '../../components/facilities/FacilitiesQueue';

export function FacilitiesQueuePage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-950 dark:text-white">Facilities</h1>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
            Room issues students raise mid-session — AC, AV, catering, and everything else.
          </p>
        </div>
      </div>
      <FacilitiesQueue />
    </div>
  );
}
