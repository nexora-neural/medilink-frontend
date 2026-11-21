export type MeasurementKind = 'weight' | 'blood_pressure' | 'glucose';

export type MeasurementSource =
  'patient' | 'doctor' | 'pharmacist' | 'lab_staff' | 'approved_external_system' | 'admin';

export type MeasurementStatus = 'active' | 'superseded' | 'entered_in_error';

export type MeasurementReading =
  | {
      kind: 'weight';
      value: number;
      unit: 'kg' | 'lb';
    }
  | {
      kind: 'blood_pressure';
      systolic: number;
      diastolic: number;
      unit: 'mmHg';
    }
  | {
      kind: 'glucose';
      value: number;
      unit: 'mg/dL' | 'mmol/L';
    };

export interface MeasurementRecord {
  id: string;
  rootId: string;
  correctsId: string | null;
  recordedAt: string;
  createdAt: string;
  source: MeasurementSource;
  reading: MeasurementReading;
  correctionReason: string | null;
  status?: MeasurementStatus;
  recordedBy?: string;
  notes?: string | null;
}

export type MeasurementDraft = Pick<MeasurementRecord, 'recordedAt' | 'source' | 'reading'>;

export const measurementLabel = (kind: MeasurementKind): string =>
  kind === 'blood_pressure' ? 'Blood pressure' : kind === 'glucose' ? 'Blood glucose' : 'Weight';

export function readingText(reading: MeasurementReading): string {
  return reading.kind === 'blood_pressure'
    ? `${reading.systolic}/${reading.diastolic} ${reading.unit}`
    : `${reading.value} ${reading.unit}`;
}

const measurementQuantityError =
  'Enter a positive number with up to 8 digits before the decimal point and 4 after it.';

function isValidMeasurementQuantity(value: number): boolean {
  return Number.isFinite(value) && value > 0 && /^\d{1,8}(?:\.\d{1,4})?$/.test(String(value));
}

export function validateDraft(draft: MeasurementDraft): string | null {
  const timestamp = Date.parse(draft.recordedAt);

  if (!draft.recordedAt || !Number.isFinite(timestamp) || timestamp > Date.now()) {
    return 'Enter a valid measurement time that is not in the future.';
  }

  if (draft.source !== 'patient') {
    return 'Only patient entries can be added here.';
  }

  const reading = draft.reading;

  if (reading.kind === 'blood_pressure') {
    if (
      !isValidMeasurementQuantity(reading.systolic) ||
      !isValidMeasurementQuantity(reading.diastolic)
    ) {
      return measurementQuantityError;
    }

    if (reading.unit !== 'mmHg') {
      return 'Blood pressure must use mmHg.';
    }

    return null;
  }

  if (!isValidMeasurementQuantity(reading.value)) {
    return measurementQuantityError;
  }

  const validUnits = reading.kind === 'weight' ? ['kg', 'lb'] : ['mg/dL', 'mmol/L'];

  if (!validUnits.includes(reading.unit)) {
    return 'Invalid unit for this measurement.';
  }

  return null;
}
