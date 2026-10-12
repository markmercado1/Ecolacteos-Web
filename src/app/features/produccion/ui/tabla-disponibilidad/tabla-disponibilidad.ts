import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { DisponibilidadProduccion, LineaDisponibilidad } from '../../../catalogos/data-access/receta.models';

/**
 * Tabla "INSUMO · NECESARIO · DISPONIBLE · ESTADO" de una producción (leche + insumos) y aviso de
 * faltantes. Solo presenta lo que calculó el backend; el estado nunca se comunica solo con color (✓/✕ +
 * texto "Suficiente"/"Falta N").
 */
@Component({
  selector: 'app-tabla-disponibilidad',
  imports: [DecimalPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @let d = disponibilidad();
    <table class="tabla">
      <caption class="visually-hidden">Insumos necesarios frente al stock disponible</caption>
      <thead>
        <tr>
          <th scope="col">Insumo</th>
          <th scope="col" class="num">Necesario</th>
          <th scope="col" class="num">Disponible</th>
          <th scope="col">Estado</th>
        </tr>
      </thead>
      <tbody>
        @for (l of lineas(); track l.insumoId ?? 'leche') {
          <tr [class.falta]="!l.suficiente">
            <th scope="row">{{ l.nombre }}</th>
            <td class="num">{{ l.requerido | number: '1.0-2' }} {{ l.unidadMedida }}</td>
            <td class="num">{{ l.disponible | number: '1.0-2' }} {{ l.unidadMedida }}</td>
            <td>
              @if (l.suficiente) {
                <span class="ok"><span aria-hidden="true">✓</span> Suficiente</span>
              } @else {
                <span class="ko"><span aria-hidden="true">✕</span> Faltan {{ l.faltante | number: '1.0-2' }} {{ l.unidadMedida }}</span>
              }
            </td>
          </tr>
        }
      </tbody>
    </table>

    @if (d.todoDisponible) {
      <p class="aviso ok-box" role="status"><span aria-hidden="true">✓</span> Todos los insumos están disponibles.</p>
    } @else {
      <div class="aviso ko-box" role="alert">
        <strong><span aria-hidden="true">⚠️</span> Stock insuficiente: no se puede iniciar esta producción.</strong>
        @if (!d.leche.suficiente) {
          <p>
            Leche — solicitado: {{ d.leche.requerido | number: '1.0-2' }} L · disponible:
            {{ d.leche.disponible | number: '1.0-2' }} L · faltante: {{ d.leche.faltante | number: '1.0-2' }} L.
          </p>
        }
        @for (l of faltantesInsumos(); track l.insumoId) {
          <p>Faltan {{ l.faltante | number: '1.0-2' }} {{ l.unidadMedida }} de {{ l.nombre }}.</p>
        }
        <p>Repón el stock antes de continuar.</p>
      </div>
    }
  `,
  styles: `
    :host { display: block; }
    .tabla { width: 100%; border-collapse: collapse; font-size: var(--font-size-sm); }
    .tabla th, .tabla td { text-align: left; padding: 0.4rem 0.6rem; border-bottom: 1px solid var(--color-border); }
    .tabla thead th { color: var(--color-text-muted); font-size: 0.75rem; font-weight: 700; }
    .tabla tbody th { font-weight: 600; }
    .tabla .num { text-align: right; white-space: nowrap; }
    .tabla tr.falta { background: var(--color-danger-bg); }
    .ok { color: var(--color-success); font-weight: 700; white-space: nowrap; }
    .ko { color: var(--color-danger); font-weight: 700; }
    .aviso { border-radius: var(--radius-control); padding: var(--space-3); font-size: var(--font-size-sm); margin: var(--space-3) 0 0; }
    .aviso p { margin: 0.25rem 0 0; }
    .ok-box { background: var(--color-success-bg); color: var(--color-success); font-weight: 700; }
    .ko-box { background: var(--color-danger-bg); color: var(--color-danger); }
  `
})
export class TablaDisponibilidadComponent {
  readonly disponibilidad = input.required<DisponibilidadProduccion>();

  protected readonly lineas = computed<LineaDisponibilidad[]>(() => [
    this.disponibilidad().leche,
    ...this.disponibilidad().insumos
  ]);
  protected readonly faltantesInsumos = computed(() => this.disponibilidad().insumos.filter((l) => !l.suficiente));
}
