import { Component, input, output } from '@angular/core';
import { ViewState } from '../../operations-activity.models';
@Component({
  selector: 'app-activity-state',
  standalone: true,
  template: `
    @switch (state()) {
      @case ('loading') {
        <p class="state" role="status">Loading activity…</p>
      }
      @case ('empty') {
        <p class="state" role="status">{{ emptyText() }}</p>
      }
      @case ('error') {
        <div class="state">
          <p class="error" role="alert">Activity could not be loaded. Please try again.</p>
          <button type="button" (click)="retry.emit()">Try again</button>
        </div>
      }
    }
  `,
  styles: `
    :host {
      display: block;
    }
    .state {
      margin: 0;
      padding: 25px;
      color: #8195a6;
      font-size: 13px;
      line-height: 1.6;
      text-align: center;
    }
    .error {
      margin: 0 0 12px;
      color: #b74f53;
    }
    button {
      min-height: 44px;
      padding: 10px 16px;
      border: 1px solid #dbe9f1;
      border-radius: 10px;
      background: #fff;
      color: #317a9d;
      font: inherit;
      cursor: pointer;
    }
    button:focus-visible {
      outline: 3px solid #167fac;
      outline-offset: 3px;
    }
  `,
})
export class ActivityState {
  readonly state = input.required<ViewState>();
  readonly emptyText = input('No activity.');
  readonly retry = output<void>();
}
