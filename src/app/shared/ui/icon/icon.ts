import { ChangeDetectionStrategy, Component, input } from '@angular/core';

export type NombreIcono =
  | 'panel' | 'acopios' | 'calidad' | 'jornadas' | 'recepcion' | 'proveedores' | 'pagos' | 'rutas' | 'comunicados'
  | 'usuarios' | 'acopiadores' | 'unidades' | 'catalogos' | 'precios' | 'ventas' | 'produccion' | 'inventario' | 'reservas'
  | 'flecha' | 'chevron' | 'candado' | 'salir' | 'menu' | 'cerrar' | 'alerta';

@Component({
  selector: 'ui-icon',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"
         stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      @switch (name()) {
        @case ('panel') {
          <rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/>
          <rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>
        }
        @case ('acopios') {
          <path d="M9 3h6l1 3v13a2 2 0 0 1-2 2h-4a2 2 0 0 1-2-2V6l1-3Z"/><path d="M8 9h8"/>
        }
        @case ('calidad') {
          <path d="M9 2v6L4 18a2 2 0 0 0 2 3h12a2 2 0 0 0 2-3L15 8V2"/><path d="M9 2h6M8 14h8"/>
        }
        @case ('jornadas') {
          <circle cx="12" cy="13" r="8"/><path d="M12 9v4l3 2M9 2h6"/>
        }
        @case ('recepcion') {
          <path d="M4 12h4l2 3h4l2-3h4"/><path d="M4 12V6a1 1 0 0 1 1-1h14a1 1 0 0 1 1 1v6"/>
          <path d="M4 12v6a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-6"/>
        }
        @case ('proveedores') {
          <path d="M3 21V10l9-6 9 6v11"/><path d="M9 21v-6h6v6"/>
        }
        @case ('pagos') {
          <rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20M16 15h3"/>
        }
        @case ('rutas') {
          <circle cx="6" cy="18" r="2"/><circle cx="18" cy="6" r="2"/>
          <path d="M6 16V7a3 3 0 0 1 3-3h5M8 18h7a3 3 0 0 0 3-3v-5"/>
        }
        @case ('comunicados') {
          <path d="M3 11v4l4 2 1 4h3l-1-5 10-5V4L10 9H6a3 3 0 0 0-3 2Z"/>
        }
        @case ('usuarios') {
          <circle cx="9" cy="8" r="3"/><path d="M3 20a6 6 0 0 1 12 0M17 8h4M19 6v4"/>
        }
        @case ('acopiadores') {
          <rect x="5" y="3" width="14" height="18" rx="2"/><circle cx="12" cy="10" r="3"/>
          <path d="M8 17c0-2 2-3 4-3s4 1 4 3"/>
        }
        @case ('unidades') {
          <rect x="1" y="7" width="13" height="9" rx="1"/><path d="M14 10h4l3 3v3h-3"/>
          <circle cx="6" cy="18" r="1.6"/><circle cx="17" cy="18" r="1.6"/>
        }
        @case ('catalogos') {
          <rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 8h8M8 12h8M8 16h5"/>
        }
        @case ('precios') {
          <path d="m3 10 7-7h10v10l-7 8-10-11Z"/><circle cx="16" cy="7" r="1"/>
        }
        @case ('ventas') {
          <path d="M9 2h6l3 3v14l-3 3H9l-3-3V5l3-3Z"/><path d="M9 8h6M9 12h6M9 16h3"/>
        }
        @case ('produccion') {
          <path d="M3 18h18L12 4Z"/><circle cx="12" cy="13" r="1" fill="currentColor" stroke="none"/>
          <circle cx="9" cy="16" r="1" fill="currentColor" stroke="none"/><circle cx="15" cy="16" r="1" fill="currentColor" stroke="none"/>
        }
        @case ('reservas') {
          <rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4M9 15l2 2 4-4"/>
        }
        @case ('inventario') {
          <path d="M3 7l9-4 9 4-9 4-9-4Z"/><path d="M3 7v10l9 4 9-4V7M12 11v10"/>
        }
        @case ('flecha') {
          <path d="M5 12h14m-6-6 6 6-6 6"/>
        }
        @case ('chevron') {
          <path d="m9 6 6 6-6 6"/>
        }
        @case ('candado') {
          <rect x="4" y="10" width="16" height="10" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>
        }
        @case ('salir') {
          <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="M16 17l5-5-5-5M21 12H9"/>
        }
        @case ('menu') {
          <path d="M4 7h16M4 12h16M4 17h16"/>
        }
        @case ('cerrar') {
          <path d="M6 6l12 12M18 6 6 18"/>
        }
        @case ('alerta') {
          <circle cx="12" cy="12" r="9"/><path d="M12 7v5m0 4h.01"/>
        }
      }
    </svg>
  `
})
export class IconComponent {
  readonly name = input.required<NombreIcono>();
}
