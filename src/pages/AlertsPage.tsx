import { useState } from 'react';
import {
  Bell, AlertTriangle, TrendingDown, ShieldAlert, BarChart3,
  CheckCircle, ChevronDown, ChevronUp, Clock,
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

type AlertSeverity = 'warning' | 'critical' | 'fraud' | 'escalation';

interface AlertCard {
  id: string;
  severity: AlertSeverity;
  message: string;
  detail: string;
  timestamp: string;
  acknowledged: boolean;
  acknowledgedBy?: string;
  acknowledgedAt?: string;
  auditReason?: string;
}

// ─── Dummy seed data ──────────────────────────────────────────────────────────

const SEED_ALERTS: AlertCard[] = [
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
    message: 'Suspicious check-in attempt blocked for Brian Ochieng in Intro to CS.',
    detail: 'Device IMEI mismatch detected. Registered: iPhone 14 (A1). Attempt from: Samsung Galaxy S23. Flagged by Device Verification.',
    timestamp: new Date(Date.now() - 1000 * 60 * 90).toISOString(),
    acknowledged: false,
  },
  {
    id: 'a4',
    severity: 'escalation',
    message: 'Amina Hassan has missed 5 consecutive classes in Linear Algebra.',
    detail: 'Consecutive absence threshold hit. Last attendance recorded: 4 March 2026. Retention Risk Score: 44 (High Risk).',
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

// ─── Config ───────────────────────────────────────────────────────────────────

const severityConfig: Record<AlertSeverity, {
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

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

// ─── Main component ───────────────────────────────────────────────────────────

export function AlertsPage() {
  const [alerts, setAlerts] = useState<AlertCard[]>(SEED_ALERTS);
  const [showDismissed, setShowDismissed] = useState(false);

  const activeAlerts = alerts.filter((a) => !a.acknowledged);
  const dismissedAlerts = alerts.filter((a) => a.acknowledged);

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
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Alerts</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Action feed — every card requires a decision.
            {activeAlerts.length > 0 && (
              <span className="ml-2 text-red-500 font-medium">{activeAlerts.length} unacknowledged</span>
            )}
          </p>
        </div>
        {activeAlerts.length === 0 && (
          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-600 dark:text-emerald-400 px-3 py-1.5 rounded-full bg-emerald-50 dark:bg-emerald-500/10">
            <CheckCircle size={13} /> All clear
          </span>
        )}
      </div>

      {/* Active alerts */}
      <div className="space-y-3">
        {activeAlerts.length === 0 ? (
          <div className="glass-card p-12 text-center">
            <Bell size={40} className="mx-auto text-gray-300 dark:text-gray-600 mb-3" />
            <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-1">No active alerts</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">New anomalies will appear here immediately.</p>
          </div>
        ) : (
          activeAlerts.map((alert) => {
            const cfg = severityConfig[alert.severity];
            return (
              <div key={alert.id} className={`glass-card border-l-4 ${cfg.border} ${cfg.bg} p-4`}>
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 flex-shrink-0">{cfg.icon}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500">{cfg.label}</span>
                      <span className="text-[10px] text-gray-400 flex items-center gap-0.5">
                        <Clock size={9} /> {timeAgo(alert.timestamp)}
                      </span>
                    </div>
                    <p className="text-sm font-semibold text-gray-900 dark:text-white leading-snug">{alert.message}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 leading-relaxed">{alert.detail}</p>
                  </div>
                  <button
                    onClick={() => acknowledge(alert.id)}
                    className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-white dark:bg-white/10 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-white/10 hover:bg-gray-50 dark:hover:bg-white/15 hover:border-gray-300 transition-all cursor-pointer shadow-sm"
                  >
                    <CheckCircle size={13} /> Acknowledge
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Dismissed / Audit Log */}
      {dismissedAlerts.length > 0 && (
        <div>
          <button
            onClick={() => setShowDismissed((v) => !v)}
            className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 font-medium transition-colors cursor-pointer mb-3"
          >
            {showDismissed ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            View Dismissed ({dismissedAlerts.length})
          </button>

          {showDismissed && (
            <div className="space-y-2">
              <p className="text-xs text-gray-400 uppercase tracking-wider font-semibold mb-2">Audit Log — Read Only</p>
              {dismissedAlerts.map((alert) => {
                const cfg = severityConfig[alert.severity];
                return (
                  <div key={alert.id} className="glass-card p-4 opacity-60 hover:opacity-80 transition-opacity border-l-4 border-l-gray-300 dark:border-l-white/10">
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5 flex-shrink-0">{cfg.icon}</div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">{cfg.label}</span>
                          <span className="text-[10px] text-gray-400">
                            Flagged {timeAgo(alert.timestamp)}
                          </span>
                          {alert.acknowledgedAt && (
                            <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-0.5">
                              <CheckCircle size={9} /> Acknowledged {timeAgo(alert.acknowledgedAt)}
                              {alert.acknowledgedBy && ` by ${alert.acknowledgedBy}`}
                            </span>
                          )}
                        </div>
                        <p className="text-xs font-medium text-gray-700 dark:text-gray-400 leading-snug">{alert.message}</p>
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
