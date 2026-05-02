import { useState, useEffect } from 'react';

/** YYYY-MM-DD in UTC (`toISOString`), ticking every minute so the calendar day can advance without a reload. Matches existing `/classes?date=` usage in the app. */
export function useTodayIsoDateUtc(): string {
  const [day, setDay] = useState(() => new Date().toISOString().slice(0, 10));
  useEffect(() => {
    const id = window.setInterval(() => {
      const next = new Date().toISOString().slice(0, 10);
      setDay((prev) => (prev !== next ? next : prev));
    }, 60_000);
    return () => window.clearInterval(id);
  }, []);
  return day;
}
