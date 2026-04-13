import { useState } from 'react';
import {
  Bell, AlertTriangle, TrendingDown, ShieldAlert, BarChart3,
  CheckCircle, ChevronDown, ChevronUp, Clock,
  WifiOff, CreditCard, Lock, Cpu,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

// ─── Shared types ─────────────────────────────────────────────────────────────

interface AlertCard {
  id: string;
  severity: string;
  message: string;
  detail: string;
  timestamp: string;
  acknowledged: boolean;
  acknowledgedBy?: string;
  acknowledgedAt?: string;
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

// ─── SUPER ADMIN — Infrastructure Alerts ─────────────────────────────────────

type InfraSeverity = 'hardware' | 'billing' | 'security' | 'fraud_spike';

const INFRA_CONFIG: Record<InfraSeverity, {
  icon: React.ReactNode;
  border: string;
  bg: string;
  label: string;
}> = {
  hardware: {
    icon: <WifiOff size={18} className="text-red-500" />,
    border: 'border-l-red-500',
    bg: 'bg-red-50/60 dark:bg-red-500/5',
    label: 'Hardware Failure',
  },
  billing: {
    icon: <CreditCard size={18} className="text-amber-500" />,
    border: 'border-l-amber-500',
    bg: 'bg-amber-50/60 dark:bg-amber-500/5',
    label: 'Billing / License',
  },
  security: {
    icon: <Lock size={18} className="text-purple-500" />,
    border: 'border-l-purple-500',
    bg: 'bg-purple-50/60 dark:bg-purple-500/5',
    label: 'System Security',
  },
  fraud_spike: {
    icon: <ShieldAlert size={18} className="text-orange-500" />,
    border: 'border-l-orange-500',
    bg: 'bg-orange-50/60 dark:bg-orange-500/5',
    label: 'Global Fraud Spike',
  },
};

const SEED_INFRA_ALERTS: (AlertCard & { severity: InfraSeverity })[] = [
  {
    id: 'i1',
    severity: 'hardware',
    message: 'Critical: 3 BLE Beacons went offline in Strathmore — Lab Block C.',
    detail: 'Beacons SU-LBC-04, SU-LBC-07, SU-LBC-09 stopped broadcasting. Last seen 14 minutes ago. Affected rooms: C204, C207, C209.',
    timestamp: new Date(Date.now() - 1000 * 60 * 14).toISOString(),
    acknowledged: false,
  },
  {
    id: 'i2',
    severity: 'billing',
    message: 'Notice: Daystar University\'s annual license expires in 15 days.',
    detail: 'License ID: LIC-DAY-2025. Renewal amount: $12,800. Contact: admin@daystar.ac.ke. Auto-renewal is OFF.',
    timestamp: new Date(Date.now() - 1000 * 60 * 90).toISOString(),
    acknowledged: false,
  },
  {
    id: 'i3',
    severity: 'security',
    message: 'Alert: Unusual API request volume from IP range 197.136.xx.xx.',
    detail: '2,340 requests in 5 minutes against /attendance/check-in. Rate limiter engaged at 09:41 UTC. Possible credential stuffing. IP range geolocated to Nairobi, KE.',
    timestamp: new Date(Date.now() - 1000 * 60 * 180).toISOString(),
    acknowledged: false,
  },
  {
    id: 'i4',
    severity: 'fraud_spike',
    message: 'Warning: 50+ device spoofing attempts blocked across 3 schools in the last hour.',
    detail: 'USIU: 24 attempts, Strathmore: 18 attempts, KCA: 11 attempts. All blocked by Device Verification layer. No successful bypasses. Pattern: repeated IMEI rotation.',
    timestamp: new Date(Date.now() - 1000 * 60 * 55).toISOString(),
    acknowledged: false,
  },
];

function InfraAlertsView() {
  const [alerts, setAlerts] = useState(SEED_INFRA_ALERTS);
  const [showDismissed, setShowDismissed] = useState(false);

  const active    = alerts.filter((a) => !a.acknowledged);
  const dismissed = alerts.filter((a) => a.acknowledged);

  const acknowledge = (id: string) => {
    setAlerts((prev) =>
      prev.map((a) =>
        a.id === id
          ? { ...a, acknowledged: true, acknowledgedBy: 'Super Admin', acknowledgedAt: new Date().toISOString() }
          : a,
      ),
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-950 dark:text-white">Infrastructure Alerts</h1>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
            Platform-wide system events only. Academic alerts route to school admins separately.
            {active.length > 0 && (
              <span className="ml-2 text-red-500 font-medium">{active.length} unacknowledged</span>
            )}
          </p>
        </div>
        {active.length === 0 && (
          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-600 dark:text-emerald-400 px-3 py-1.5 rounded-full bg-emerald-50 dark:bg-emerald-500/10">
            <CheckCircle size={13} /> All systems nominal
          </span>
        )}
      </div>

      <div className="space-y-3">
        {active.length === 0 ? (
          <div className="glass-card p-12 text-center">
            <Cpu size={40} className="mx-auto text-slate-400 dark:text-gray-600 mb-3" />
            <h3 className="text-base font-semibold text-slate-950 dark:text-white mb-1">No active infrastructure alerts</h3>
            <p className="text-sm text-slate-600 dark:text-slate-400">Hardware failures, billing events, and security anomalies will appear here.</p>
          </div>
        ) : (
          active.map((alert) => {
            const cfg = INFRA_CONFIG[alert.severity];
            return (
              <div key={alert.id} className={`glass-card border-l-4 ${cfg.border} ${cfg.bg} p-4`}>
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 flex-shrink-0">{cfg.icon}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-600">{cfg.label}</span>
                      <span className="text-[10px] text-slate-600 dark:text-slate-400 flex items-center gap-0.5">
                        <Clock size={9} /> {timeAgo(alert.timestamp)}
                      </span>
                    </div>
                    <p className="text-sm font-semibold text-slate-950 dark:text-white leading-snug">{alert.message}</p>
                    <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 leading-relaxed">{alert.detail}</p>
                  </div>
                  <button
                    onClick={() => acknowledge(alert.id)}
                    className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-white dark:bg-white/10 text-slate-800 dark:text-gray-300 border border-gray-200 dark:border-white/10 hover:bg-gray-50 dark:hover:bg-white/15 transition-all cursor-pointer shadow-sm"
                  >
                    <CheckCircle size={13} /> Acknowledge
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {dismissed.length > 0 && (
        <div>
          <button
            onClick={() => setShowDismissed((v) => !v)}
            className="flex items-center gap-2 text-sm text-slate-600 hover:text-gray-700 dark:hover:text-gray-300 font-medium transition-colors cursor-pointer mb-3"
          >
            {showDismissed ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            View Dismissed ({dismissed.length})
          </button>
          {showDismissed && (
            <div className="space-y-2">
              <p className="text-xs text-slate-600 dark:text-slate-400 uppercase tracking-wider font-semibold mb-2">Audit Log — Read Only</p>
              {dismissed.map((alert) => {
                const cfg = INFRA_CONFIG[alert.severity];
                return (
                  <div key={alert.id} className="glass-card p-4 opacity-60 hover:opacity-80 transition-opacity border-l-4 border-l-gray-300 dark:border-l-white/10">
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5 flex-shrink-0">{cfg.icon}</div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">{cfg.label}</span>
                          <span className="text-[10px] text-slate-600 dark:text-slate-400">Flagged {timeAgo(alert.timestamp)}</span>
                          {alert.acknowledgedAt && (
                            <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-0.5">
                              <CheckCircle size={9} /> Acknowledged {timeAgo(alert.acknowledgedAt)}
                              {alert.acknowledgedBy && ` by ${alert.acknowledgedBy}`}
                            </span>
                          )}
                        </div>
                        <p className="text-xs font-medium text-gray-700 dark:text-slate-500 leading-snug">{alert.message}</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── HOD — Academic Action Feed ───────────────────────────────────────────────

type AcademicSeverity = 'warning' | 'critical' | 'fraud' | 'escalation';

const ACADEMIC_CONFIG: Record<AcademicSeverity, {
  icon: React.ReactNode;
  border: string;
  bg: string;
  label: string;
}> = {
  warning: {
    icon: <AlertTriangle size={18} className="text-amber-500" />,
    border: 'border-l-amber-500',
    bg: 'bg-amber-50/60 dark:bg-amber-500/5',
    label: 'Lecturer Missing',
  },
  critical: {
    icon: <TrendingDown size={18} className="text-red-500" />,
    border: 'border-l-red-500',
    bg: 'bg-red-50/60 dark:bg-red-500/5',
    label: 'Mass Absence',
  },
  fraud: {
    icon: <ShieldAlert size={18} className="text-purple-500" />,
    border: 'border-l-purple-500',
    bg: 'bg-purple-50/60 dark:bg-purple-500/5',
    label: 'Fraud / Spoofing',
  },
  escalation: {
    icon: <BarChart3 size={18} className="text-blue-500" />,
    border: 'border-l-blue-500',
    bg: 'bg-blue-50/60 dark:bg-blue-500/5',
    label: 'At-Risk Escalation',
  },
};

const SEED_ACADEMIC_ALERTS: (AlertCard & { severity: AcademicSeverity })[] = [
  {
    id: 'a1',
    severity: 'warning',
    message: 'Lecturer Dr. James Mwangi has not started Database Systems in Room B204.',
    detail: 'Class was scheduled at 09:00. Triggered at 09:15 — 15 minutes overdue.',
    timestamp: new Date(Date.now() - 1000 * 60 * 12).toISOString(),
    acknowledged: false,
  },
  {
    id: 'a2',
    severity: 'critical',
    message: 'Networks I concluded with only 38% attendance.',
    detail: 'Only 15 of 39 enrolled students checked in before session end. Threshold: 50%.',
    timestamp: new Date(Date.now() - 1000 * 60 * 45).toISOString(),
    acknowledged: false,
  },
  {
    id: 'a3',
    severity: 'fraud',
    message: 'Suspicious check-in attempt blocked — device IMEI mismatch in Intro to CS.',
    detail: 'Registered device: iPhone 14 (A1). Attempt from: Samsung Galaxy S23. Flagged by Device Verification. Student ID withheld per policy.',
    timestamp: new Date(Date.now() - 1000 * 60 * 90).toISOString(),
    acknowledged: false,
  },
  {
    id: 'a4',
    severity: 'escalation',
    message: 'A student has missed 5 consecutive classes in Linear Algebra.',
    detail: 'Consecutive absence threshold hit. Retention Risk Score: 44 (High Risk). Refer to academic counsellor.',
    timestamp: new Date(Date.now() - 1000 * 60 * 120).toISOString(),
    acknowledged: false,
  },
  {
    id: 'a5',
    severity: 'warning',
    message: 'Lecturer Prof. Aisha Omondi has not started Software Engineering in Lab A1.',
    detail: 'Class scheduled at 11:00. Triggered at 11:15. No beacon activity detected in room.',
    timestamp: new Date(Date.now() - 1000 * 60 * 180).toISOString(),
    acknowledged: false,
  },
];

function AcademicAlertsView() {
  const [alerts, setAlerts] = useState(SEED_ACADEMIC_ALERTS);
  const [showDismissed, setShowDismissed] = useState(false);

  const active    = alerts.filter((a) => !a.acknowledged);
  const dismissed = alerts.filter((a) => a.acknowledged);

  const acknowledge = (id: string) => {
    setAlerts((prev) =>
      prev.map((a) =>
        a.id === id
          ? { ...a, acknowledged: true, acknowledgedBy: 'HOD', acknowledgedAt: new Date().toISOString() }
          : a,
      ),
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-950 dark:text-white">Alerts</h1>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
            Action feed — every card requires a decision.
            {active.length > 0 && (
              <span className="ml-2 text-red-500 font-medium">{active.length} unacknowledged</span>
            )}
          </p>
        </div>
        {active.length === 0 && (
          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-600 dark:text-emerald-400 px-3 py-1.5 rounded-full bg-emerald-50 dark:bg-emerald-500/10">
            <CheckCircle size={13} /> All clear
          </span>
        )}
      </div>

      <div className="space-y-3">
        {active.length === 0 ? (
          <div className="glass-card p-12 text-center">
            <Bell size={40} className="mx-auto text-slate-400 dark:text-gray-600 mb-3" />
            <h3 className="text-base font-semibold text-slate-950 dark:text-white mb-1">No active alerts</h3>
            <p className="text-sm text-slate-600 dark:text-slate-400">New anomalies will appear here immediately.</p>
          </div>
        ) : (
          active.map((alert) => {
            const cfg = ACADEMIC_CONFIG[alert.severity];
            return (
              <div key={alert.id} className={`glass-card border-l-4 ${cfg.border} ${cfg.bg} p-4`}>
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 flex-shrink-0">{cfg.icon}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-600">{cfg.label}</span>
                      <span className="text-[10px] text-slate-600 dark:text-slate-400 flex items-center gap-0.5">
                        <Clock size={9} /> {timeAgo(alert.timestamp)}
                      </span>
                    </div>
                    <p className="text-sm font-semibold text-slate-950 dark:text-white leading-snug">{alert.message}</p>
                    <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 leading-relaxed">{alert.detail}</p>
                  </div>
                  <button
                    onClick={() => acknowledge(alert.id)}
                    className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-white dark:bg-white/10 text-slate-800 dark:text-gray-300 border border-gray-200 dark:border-white/10 hover:bg-gray-50 dark:hover:bg-white/15 transition-all cursor-pointer shadow-sm"
                  >
                    <CheckCircle size={13} /> Acknowledge
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {dismissed.length > 0 && (
        <div>
          <button
            onClick={() => setShowDismissed((v) => !v)}
            className="flex items-center gap-2 text-sm text-slate-600 hover:text-gray-700 dark:hover:text-gray-300 font-medium transition-colors cursor-pointer mb-3"
          >
            {showDismissed ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            View Dismissed ({dismissed.length})
          </button>
          {showDismissed && (
            <div className="space-y-2">
              <p className="text-xs text-slate-600 dark:text-slate-400 uppercase tracking-wider font-semibold mb-2">Audit Log — Read Only</p>
              {dismissed.map((alert) => {
                const cfg = ACADEMIC_CONFIG[alert.severity];
                return (
                  <div key={alert.id} className="glass-card p-4 opacity-60 hover:opacity-80 transition-opacity border-l-4 border-l-gray-300 dark:border-l-white/10">
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5 flex-shrink-0">{cfg.icon}</div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">{cfg.label}</span>
                          <span className="text-[10px] text-slate-600 dark:text-slate-400">Flagged {timeAgo(alert.timestamp)}</span>
                          {alert.acknowledgedAt && (
                            <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-0.5">
                              <CheckCircle size={9} /> Acknowledged {timeAgo(alert.acknowledgedAt)}
                              {alert.acknowledgedBy && ` by ${alert.acknowledgedBy}`}
                            </span>
                          )}
                        </div>
                        <p className="text-xs font-medium text-gray-700 dark:text-slate-500 leading-snug">{alert.message}</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Root export ──────────────────────────────────────────────────────────────

export function AlertsPage() {
  const { user } = useAuth();
  return user?.role === 'SUPER_ADMIN' ? <InfraAlertsView /> : <AcademicAlertsView />;
}
