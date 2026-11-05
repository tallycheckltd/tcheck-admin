import { useAuth } from '../context/AuthContext';

/**
 * SBS (Hans, 2026-11-05) — the words Executive Education uses. A school with the exec-ed suite on
 * talks about delegates, faculty, modules and sessions; every other school keeps students,
 * lecturers, courses and classes. Labels only: data, routes and roles are unchanged.
 */
export interface Terms {
  execEd: boolean;
  student: string; students: string; Student: string; Students: string;
  lecturer: string; lecturers: string; Lecturer: string; Lecturers: string;
  course: string; courses: string; Course: string; Courses: string;
  class: string; classes: string; Class: string; Classes: string;
}

const EXEC_ED: Omit<Terms, 'execEd'> = {
  student: 'delegate', students: 'delegates', Student: 'Delegate', Students: 'Delegates',
  lecturer: 'faculty member', lecturers: 'faculty', Lecturer: 'Faculty', Lecturers: 'Faculty',
  course: 'module', courses: 'modules', Course: 'Module', Courses: 'Modules',
  class: 'session', classes: 'sessions', Class: 'Session', Classes: 'Sessions',
};
const DEFAULT: Omit<Terms, 'execEd'> = {
  student: 'student', students: 'students', Student: 'Student', Students: 'Students',
  lecturer: 'lecturer', lecturers: 'lecturers', Lecturer: 'Lecturer', Lecturers: 'Lecturers',
  course: 'course', courses: 'courses', Course: 'Course', Courses: 'Courses',
  class: 'class', classes: 'classes', Class: 'Class', Classes: 'Classes',
};

export function termsFor(execEd: boolean): Terms {
  return { execEd, ...(execEd ? EXEC_ED : DEFAULT) };
}

export function useTerms(): Terms {
  const { user } = useAuth();
  return termsFor(!!user?.school?.features?.execEdSuite);
}

/** Sidebar labels as an exec-ed school says them (applied at display time; the nav config keeps
 * its own labels, which other code matches on). */
export const EXEC_ED_NAV_LABEL: Record<string, string> = {
  'All Courses': 'All Modules',
  Courses: 'Modules',
  Classes: 'Sessions',
  'Class changes': 'Session changes',
  'Lecturer Presence': 'Faculty Presence',
  'All Students': 'All Delegates',
  Students: 'Delegates',
};
