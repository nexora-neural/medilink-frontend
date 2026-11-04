import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { PublicHeader } from './components/public-header/public-header';
import { PublicFooter } from './components/public-footer/public-footer';
@Component({
  selector: 'app-public-shell',
  standalone: true,
  imports: [RouterOutlet, PublicHeader, PublicFooter],
  templateUrl: './public-shell.html',
  styleUrl: './public-shell.scss',
})
export class PublicShell {}
