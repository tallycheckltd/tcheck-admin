import { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';

/**
 * F5 (10-22) — a student who was there but whose check-in failed. Corrected straight away, no
 * approval (owner, 10-22) — by whoever edits classes or the class's own lecturer, whose HOD is told.
 * The record is marked as a correction (never as a normal check-in), with who and why.
 */
export function CorrectionModal({ classId, student, kind, asLecturer, onClose, onDone }: {
  classId: string;
  student: { id: string; name: string } | null;
  /** ADD: no record at all; CHECK_OUT: checked in, never checked out. */
  kind: 'ADD' | 'CHECK_OUT';
  asLecturer: boolean;
  onClose: () => void;
  onDone: (message: string) => void;
}) {
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { setReason(''); setError(null); }, [student]);
  if (!student) return null;

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      await api.post(`/classes/${classId}/corrections`, { studentId: student.id, reason });
      onDone(`${student.name}'s attendance is corrected — they${asLecturer ? ' and your HOD' : ''} have been told.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open={!!student} onClose={onClose} title={kind === 'ADD' ? 'Correct attendance' : 'Fill in check-out'}>
      <div className="space-y-3">
        <p className="text-sm text-slate-700 dark:text-slate-300">
          {kind === 'ADD'
            ? <>Mark <strong>{student.name}</strong> as attended: checked in at the start and out at the end.</>
            : <>Record <strong>{student.name}</strong>&apos;s check-out at the end of the class.</>}
          {' '}It shows as a correction — never as a normal check-in.
        </p>
        <Input label={asLecturer ? 'Why (kept on the record; your HOD sees it)' : 'Why (kept on the record)'} value={reason} onChange={(e) => setReason(e.target.value)} maxLength={300} placeholder="e.g. Phone battery died; seen in class" />
        {error && <p role="alert" className="text-sm text-rose-600 dark:text-red-400">{error}</p>}
        <Button onClick={submit} disabled={busy || !reason.trim()}>Correct</Button>
      </div>
    </Modal>
  );
}
