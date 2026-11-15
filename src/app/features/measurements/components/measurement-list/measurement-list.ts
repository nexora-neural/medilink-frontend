import { DatePipe } from '@angular/common';
import { Component, input, output } from '@angular/core';

import { MeasurementRecord, measurementLabel, readingText } from '../../models/measurement.model';

@Component({
  selector: 'app-measurement-list',
  standalone: true,
  imports: [DatePipe],
  templateUrl: './measurement-list.html',
  styleUrl: './measurement-list.scss',
})
export class MeasurementList {
  readonly measurements = input.required<MeasurementRecord[]>();

  readonly correctionRequested = output<MeasurementRecord>();

  readonly label = measurementLabel;
  readonly reading = readingText;
}
