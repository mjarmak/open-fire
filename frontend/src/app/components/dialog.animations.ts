import { animate, style, transition, trigger } from '@angular/animations';

export const dialogBackdropAnimation = trigger('dialogBackdrop', [
  transition(':enter', [
    style({ opacity: 0 }),
    animate('110ms linear', style({ opacity: 1 })),
  ]),
  transition(':leave', [
    animate('90ms linear', style({ opacity: 0 })),
  ]),
]);

export const dialogPanelAnimation = trigger('dialogPanel', [
  transition(':enter', [
    style({ opacity: 0, transform: 'translateY(6px) scale(0.995)' }),
    animate('120ms ease-out', style({ opacity: 1, transform: 'translateY(0) scale(1)' })),
  ]),
  transition(':leave', [
    animate('90ms ease-in', style({ opacity: 0, transform: 'translateY(4px) scale(0.995)' })),
  ]),
]);
