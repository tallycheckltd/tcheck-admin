import type { AttendanceMode, SchoolFeatures } from '../../types';

/** A tenant's settings as the platform edits them (UAT §2) — shared by the tenant page and the wizard. */
export const defaultFeatures: Required<SchoolFeatures> = {
  anonymousChat: true,
  biometricStrictMode: false,
  broadcasts: true,
  faceIdCheckIn: true,
  dwellTimeTracking: true,
  messaging: true,
  execEdSuite: false,
  onboardingJourney: false,
  profileCompletionPrompt: true,
};

export interface SchoolSettingsValue {
  allowManualLecturerOverride: boolean;
  features: Required<SchoolFeatures>;
  lateThresholdMinutes: number;
  extremelyLateThresholdMinutes: number;
  attendanceMode: AttendanceMode;
  // Empty string means unset (sent to the API as null). Set only for schools on isolated,
  // separately-provisioned backend infrastructure — e.g. a pilot with its own Railway project.
  apiBaseUrl: string;
}

export const defaultSettings: SchoolSettingsValue = {
  allowManualLecturerOverride: true,
  features: defaultFeatures,
  lateThresholdMinutes: 10,
  extremelyLateThresholdMinutes: 20,
  attendanceMode: 'CALENDAR_BASED',
  apiBaseUrl: '',
};
