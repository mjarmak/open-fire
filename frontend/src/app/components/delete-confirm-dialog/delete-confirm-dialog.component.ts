import { CommonModule } from '@angular/common';
import { Component, EventEmitter, inject, Output } from '@angular/core';
import { MarketDashboardService } from '../../market-dashboard.service';
import { dialogBackdropAnimation, dialogPanelAnimation } from '../dialog.animations';

@Component({
  selector: 'app-delete-confirm-dialog',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './delete-confirm-dialog.component.html',
  animations: [dialogBackdropAnimation, dialogPanelAnimation],
})
export class DeleteConfirmDialogComponent {
  protected readonly state = inject(MarketDashboardService);

  @Output() cancel = new EventEmitter<void>();
  @Output() confirm = new EventEmitter<void>();
}
