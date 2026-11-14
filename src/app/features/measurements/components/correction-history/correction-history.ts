import { DatePipe } from '@angular/common';
import { Component, input, output } from '@angular/core';
import { MeasurementRecord, readingText } from '../../models/measurement.model';

@Component({
  selector: 'app-correction-history',
  standalone: true,
  imports: [DatePipe],
  templateUrl: './correction-history.html',
  styleUrl: './correction-history.scss',
})
export class CorrectionHistory {
  readonly records = input.required<MeasurementRecord[]>();
  readonly closeRequested = output<void>();
  readonly reading = readingText;
}
