import { Component, input, output } from '@angular/core';
@Component({
  selector: 'app-activity-page-controls',
  standalone: true,
  template: `<nav [attr.aria-label]="label()">
    <button type="button" [disabled]="busy() || page() <= 1" (click)="changePage.emit(page() - 1)">
      Previous
    </button>
    <span>Page {{ page() }} · {{ total() }} results</span>
    <button
      type="button"
      [disabled]="busy() || page() * 20 >= total()"
      (click)="changePage.emit(page() + 1)"
    >
      Next
    </button>
  </nav>`,
  styles: `
    nav {
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      gap: 12px;
      margin-top: 16px;
      font-size: 12px;
    }
    button {
      min-height: 44px;
      padding: 8px 14px;
      border: 1px solid #dbe9f1;
      border-radius: 8px;
      background: white;
      color: #317a9d;
      cursor: pointer;
    }
    button:disabled {
      opacity: 0.5;
      cursor: default;
    }
    button:focus-visible {
      outline: 3px solid #167fac;
      outline-offset: 3px;
    }
  `,
})
export class ActivityPageControls {
  readonly page = input(1);
  readonly total = input(0);
  readonly busy = input(false);
  readonly label = input('Activity pages');
  readonly changePage = output<number>();
}
