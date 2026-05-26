import { CommonModule } from '@angular/common';
import { Component, EventEmitter, inject, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MarketDashboardService } from '../../market-dashboard.service';
import { dialogBackdropAnimation, dialogPanelAnimation } from '../dialog.animations';

@Component({
  selector: 'app-login-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './login-dialog.component.html',
  animations: [dialogBackdropAnimation, dialogPanelAnimation],
})
export class LoginDialogComponent {
  protected readonly state = inject(MarketDashboardService);

  @Output() closeDialog = new EventEmitter<void>();
  @Output() submitDialog = new EventEmitter<void>();
}
