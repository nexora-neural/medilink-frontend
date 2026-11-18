import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';

@Component({
  selector: 'app-clinical-corrections',
  standalone: true,
  imports: [FormsModule, RouterLink],
  templateUrl: './clinical-corrections.html',
  styleUrl: './clinical-corrections.scss',
})
export class ClinicalCorrections {
  private readonly route = inject(ActivatedRoute);

  get mode(): 'request' | 'decision' | 'correction' | 'history' {
    return this.route.snapshot.data['mode'];
  }

  recordId = '';
  details = '';
  reason = '';
  decision = '';

  submitted = false;
  error = '';
  loading = false;

  get isValid(): boolean {
    if (!this.recordId.trim()) {
      return false;
    }

    if (this.mode === 'request' || this.mode === 'correction') {
      return !!this.details.trim() && !!this.reason.trim();
    }

    return this.mode === 'decision' && !!this.decision && !!this.reason.trim();
  }

  submit(): void {
    this.submitted = true;
    this.error = '';

    if (!this.isValid) {
      return;
    }

    this.error = 'This action is not available yet. Your changes have not been saved.';
  }
}
