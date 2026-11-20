import { Component, input } from '@angular/core';

@Component({
  selector: 'app-dashboard-stat',
  template: `<div class="stat" [class.accent]="accent()">
    <span>{{ label() }}</span
    ><strong [class.verified]="status()">{{ value() }}</strong
    ><small>{{ caption() }}</small>
  </div>`,
  styles: `
    :host {
      display: block;
      min-width: 0;
    }
    .stat {
      box-sizing: border-box;
      height: 100%;
      min-height: 140px;
      padding: 22px;
      display: flex;
      flex-direction: column;
      background: white;
      border: 1px solid #e7eef4;
      border-radius: 16px;
    }
    .stat span {
      font-size: 12px;
      color: #71879a;
      font-weight: 650;
    }
    .stat strong {
      font-size: 34px;
      letter-spacing: -1px;
      margin-top: 16px;
    }
    .stat strong.verified {
      font-size: 18px;
      letter-spacing: 0;
      color: #2b936e;
    }
    .stat small {
      font-size: 11px;
      color: #9babb8;
      margin-top: auto;
    }
    .stat.accent {
      background: linear-gradient(135deg, #dff4ff, #b9e6f9);
      border-color: transparent;
    }
    @media (max-width: 500px) {
      .stat {
        min-height: 125px;
        padding: 17px;
      }
      .stat strong {
        font-size: 29px;
      }
    }
  `,
})
export class DashboardStat {
  readonly label = input.required<string>();
  readonly value = input.required<string | number>();
  readonly caption = input.required<string>();
  readonly accent = input(false);
  readonly status = input(false);
}
