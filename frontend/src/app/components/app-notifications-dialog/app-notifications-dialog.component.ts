import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AppNotificationsService } from '../../app-notifications.service';
import { dialogBackdropAnimation, dialogPanelAnimation } from '../dialog.animations';

@Component({
  selector: 'app-notifications-dialog', standalone: true, imports: [CommonModule, FormsModule],
  templateUrl: './app-notifications-dialog.component.html', styleUrl: './app-notifications-dialog.component.scss',
  animations: [dialogBackdropAnimation, dialogPanelAnimation],
})
export class AppNotificationsDialogComponent {
  readonly state = inject(AppNotificationsService);
}
