import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { PublicHeader } from './components/public-header/public-header';
import { PublicFooter } from './components/public-footer/public-footer';
@Component({
  selector: 'app-public-shell',
  standalone: true,
  imports: [RouterOutlet, PublicHeader, PublicFooter],
  template: '<app-public-header /><router-outlet /><app-public-footer />',
  styles: [
    `
      :host {
        display: block;
        min-height: 100vh;
        background: #fff;
        color: #162e3a;
        font-family: Inter, system-ui, -apple-system, BlinkMacSystemFont, \"Segoe UI\", sans-serif;
      }
      :host ::ng-deep button {
        cursor: pointer;
      }
    `,
  ],
})
export class PublicShell {}
