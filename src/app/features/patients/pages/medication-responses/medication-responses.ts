import { DatePipe } from '@angular/common';
import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';

type Choice = 'Taken' | 'Skipped';
interface ResponseVersion {
  choice: Choice;
  reportedAt: string;
  enteredAt: string;
  reason: string;
}
interface Occurrence {
  id: number;
  medicine: string;
  dose: string;
  scheduled: string;
  versions: ResponseVersion[];
}

@Component({
  selector: 'app-medication-responses',
  standalone: true,
  imports: [FormsModule, DatePipe],
  templateUrl: './medication-responses.html',
  styleUrl: './medication-responses.scss',
})
export class MedicationResponses {
  state: 'loading' | 'ready' | 'empty' | 'error' = 'ready';
  view: 'schedule' | 'form' | 'history' = 'schedule';
  occurrences: Occurrence[] = [
    {
      id: 1,
      medicine: 'Amlodipine',
      dose: '5 mg · 1 tablet',
      scheduled: 'Today · 8:00 AM',
      versions: [],
    },
    {
      id: 2,
      medicine: 'Metformin',
      dose: '500 mg · 1 tablet',
      scheduled: 'Today · 8:00 PM',
      versions: [],
    },
  ];
  selected: Occurrence | null = null;
  choice: Choice | '' = '';
  reportedAt = '';
  reason = '';
  submitted = false;
  notice = '';

  get current(): ResponseVersion | undefined {
    return this.selected?.versions[0];
  }
  get reportedCount(): number {
    return this.occurrences.filter((item) => item.versions.length > 0).length;
  }
  start(item: Occurrence): void {
    this.selected = item;
    this.choice = item.versions[0]?.choice ?? '';
    this.reportedAt = item.versions[0]?.reportedAt ?? this.localNow();
    this.reason = '';
    this.submitted = false;
    this.notice = '';
    this.view = 'form';
  }
  history(item: Occurrence): void {
    this.selected = item;
    this.notice = '';
    this.view = 'history';
  }
  save(): void {
    this.submitted = true;
    if (
      !this.selected ||
      !this.choice ||
      !this.reportedAt ||
      Number.isNaN(new Date(this.reportedAt).getTime()) ||
      new Date(this.reportedAt).getTime() > Date.now() ||
      (this.current && !this.reason.trim())
    )
      return;
    this.selected.versions.unshift({
      choice: this.choice,
      reportedAt: this.reportedAt,
      enteredAt: new Date().toISOString(),
      reason: this.reason.trim(),
    });
    this.notice = 'Response recorded in this preview.';
    this.view = 'history';
  }
  back(): void {
    this.view = 'schedule';
    this.notice = '';
  }
  invalidDateMarker(): boolean {
    return (
      Number.isNaN(new Date(this.reportedAt).getTime()) ||
      new Date(this.reportedAt).getTime() > Date.now()
    );
  }
  private localNow(): string {
    const now = new Date();
    return new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  }
}
