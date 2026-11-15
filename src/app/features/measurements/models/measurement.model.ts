export type MeasurementKind = 'weight' | 'blood_pressure' | 'glucose';
export type MeasurementSource = 'patient';

export type MeasurementReading =
  | { kind: 'weight'; value: number; unit: 'kg' }
  | { kind: 'blood_pressure'; systolic: number; diastolic: number; unit: 'mmHg' }
  | { kind: 'glucose'; value: number; unit: 'mg/dL' };

export interface MeasurementRecord {
  id: string;
  rootId: string;
  correctsId: string | null;
  recordedAt: string;
  createdAt: string;
  source: MeasurementSource;
  reading: MeasurementReading;
  correctionReason: string | null;
}

export type MeasurementDraft = Pick<MeasurementRecord, 'recordedAt' | 'source' | 'reading'>;

export const measurementLabel = (kind: MeasurementKind): string =>
  kind === 'blood_pressure' ? 'Blood pressure' : kind === 'glucose' ? 'Blood glucose' : 'Weight';

export function readingText(reading: MeasurementReading): string {
  return reading.kind === 'blood_pressure'
    ? `${reading.systolic}/${reading.diastolic} ${reading.unit}`
    : `${reading.value} ${reading.unit}`;
}

export function validateDraft(draft: MeasurementDraft): string | null {
  const timestamp = Date.parse(draft.recordedAt);
  if (!draft.recordedAt || !Number.isFinite(timestamp) || timestamp > Date.now()) {
    return 'Enter a valid measurement time that is not in the future.';
  }
  if (draft.source !== 'patient') return 'Select a valid measurement source.';
  const r = draft.reading;
  if (r.kind === 'blood_pressure') {
    if (
      !Number.isInteger(r.systolic) ||
      !Number.isInteger(r.diastolic) ||
      r.systolic <= 0 ||
      r.diastolic <= 0 ||
      r.systolic > 400 ||
      r.diastolic > 400
    ) {
      return 'Enter positive whole-number blood pressure values up to 400.';
    }
    if (r.unit !== 'mmHg') return 'Blood pressure must use mmHg.';
  } else if (!Number.isFinite(r.value) || r.value <= 0 || r.value > 10000) {
    return 'Enter a positive measurement value (maximum 10000).';
  } else if (r.kind === 'weight' ? r.unit !== 'kg' : r.unit !== 'mg/dL') {
    return 'Invalid unit for this measurement.';
  }
  return null;
}
