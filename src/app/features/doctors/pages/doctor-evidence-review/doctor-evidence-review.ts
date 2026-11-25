import { Component } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';

type Outcome = 'Reviewed' | 'Needs clarification' | 'Unable to verify';
interface Review {
  reviewer: string;
  date: Date;
  outcome: Outcome;
  notes: string;
}

@Component({
  selector: 'app-doctor-evidence-review',
  imports: [DatePipe, FormsModule, RouterLink],
  templateUrl: './doctor-evidence-review.html',
  styleUrl: './doctor-evidence-review.scss',
})
export class DoctorEvidenceReview {
  state: 'loading' | 'ready' | 'empty' | 'error' = 'ready';
  outcome: Outcome | '' = '';
  notes = '';
  validation = '';
  message = '';
  reviews: Review[] = [];

  saveReview(): void {
    this.message = '';
    if (!this.outcome) {
      this.validation = 'Select a review outcome before saving.';
      return;
    }
    if (this.notes.trim().length > 1000) {
      this.validation = 'Review notes must be 1000 characters or fewer.';
      return;
    }
    this.reviews = [
      {
        reviewer: 'Sample doctor',
        date: new Date(),
        outcome: this.outcome,
        notes: this.notes.trim(),
      },
      ...this.reviews,
    ];
    this.outcome = '';
    this.notes = '';
    this.validation = '';
    this.message = 'Review added to this preview. It is not saved to the server.';
  }

  retry(): void {
    this.state = 'ready';
  }
}
