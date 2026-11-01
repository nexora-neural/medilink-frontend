import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-home-value',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './value.html',
  styleUrl: './value.scss',
})
export class HomeValue {}
