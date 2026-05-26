import { CommonModule } from '@angular/common';
import { Component, EventEmitter, inject, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MarketDashboardService } from '../../market-dashboard.service';
import { dialogBackdropAnimation, dialogPanelAnimation } from '../dialog.animations';

@Component({
  selector: 'app-telegram-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './telegram-dialog.component.html',
  animations: [dialogBackdropAnimation, dialogPanelAnimation],
})
export class TelegramDialogComponent {
  protected readonly state = inject(MarketDashboardService);

  @Output() closeDialog = new EventEmitter<void>();
  @Output() save = new EventEmitter<void>();
  @Output() test = new EventEmitter<void>();
}
