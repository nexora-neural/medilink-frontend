import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-home-introduction',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './introduction.html',
  styleUrl: './introduction.scss',
})
export class HomeIntroduction {}
