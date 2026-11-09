import { Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { DoctorPatient } from '../../models/doctor-dashboard.models';

@Component({
  selector: 'app-patient-queue',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './patient-queue.html',
  styleUrl: './patient-queue.scss',
})
export class PatientQueue {
  readonly patients = input.required<readonly DoctorPatient[]>();
  readonly loading = input(false);
}
