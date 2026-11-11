import { Component, computed, effect, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  MeasurementDraft,
  MeasurementKind,
  MeasurementRecord,
  MeasurementReading,
  validateDraft,
} from '../../models/measurement.model';

function localDateTime(date: Date): string {
  const adjusted = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return adjusted.toISOString().slice(0, 16);
}

@Component({
  selector: 'app-measurement-form',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './measurement-form.html',
  styleUrl: './measurement-form.scss',
})
export class MeasurementForm {
  readonly correcting = input<MeasurementRecord | null>(null);
  readonly saved = output<{ draft: MeasurementDraft; reason: string }>();
  readonly cancelled = output<void>();

  kind: MeasurementKind = 'weight';
  value: number | null = null;
  systolic: number | null = null;
  diastolic: number | null = null;
  recordedAt = localDateTime(new Date());
  reason = '';
  readonly error = signal('');
  readonly today = computed(() => localDateTime(new Date()));

  constructor() {
    effect(() => this.configure(this.correcting()));
  }

  configure(record: MeasurementRecord | null): void {
    if (!record) return;
    this.kind = record.reading.kind;
    this.recordedAt = localDateTime(new Date(record.recordedAt));
    if (record.reading.kind === 'blood_pressure') {
      this.systolic = record.reading.systolic;
      this.diastolic = record.reading.diastolic;
    } else this.value = record.reading.value;
  }

  submit(): void {
    this.error.set('');
    let reading: MeasurementReading;
    if (this.kind === 'blood_pressure') {
      reading = {
        kind: 'blood_pressure',
        systolic: Number(this.systolic),
        diastolic: Number(this.diastolic),
        unit: 'mmHg',
      };
    } else if (this.kind === 'weight') {
      reading = { kind: 'weight', value: Number(this.value), unit: 'kg' };
    } else {
      reading = { kind: 'glucose', value: Number(this.value), unit: 'mg/dL' };
    }
    const millis = Date.parse(this.recordedAt);
    if (!Number.isFinite(millis)) {
      this.error.set('Enter a valid measurement time.');
      return;
    }
    const draft: MeasurementDraft = {
      reading,
      recordedAt: new Date(millis).toISOString(),
      source: 'patient',
    };
    const error = validateDraft(draft);
    if (error) {
      this.error.set(error);
      return;
    }
    if (this.correcting() && (!this.reason.trim() || this.reason.trim().length > 500)) {
      this.error.set('A correction reason (1–500 characters) is required.');
      return;
    }
    this.saved.emit({ draft, reason: this.reason.trim() });
  }
}
