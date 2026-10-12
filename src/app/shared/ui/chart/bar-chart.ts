import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { DecimalPipe } from '@angular/common';

export interface BarraChart {
  etiqueta: string;
  /** `null` = sin cálculo disponible (nunca se dibuja como 0). */
  valor: number | null;
}

const COLORES = ['chart-1', 'chart-2', 'chart-3', 'chart-4'] as const;

/**
 * Barra horizontal accesible y reutilizable para los gráficos de Fase 4, Bloque 6. Colores desde
 * theme.css (`--chart-1..4`), nunca hardcodeados: cambiar esos tokens cambia también estos gráficos.
 * Nunca dibuja un valor `null` como una barra en 0: se rotula explícitamente "Sin cálculo". La
 * visualización (`role="img"`, decorativa) siempre va acompañada de una tabla real con los mismos datos,
 * que es la que efectivamente describen los lectores de pantalla.
 */
@Component({
  selector: 'ui-bar-chart',
  imports: [DecimalPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <figure class="ui-bar-chart">
      <figcaption>
        <h3>{{ titulo() }}</h3>
        @if (subtitulo()) {
          <p class="subtitulo">{{ subtitulo() }}</p>
        }
      </figcaption>

      @if (!hayDatos()) {
        <p class="vacio">{{ mensajeVacio() }}</p>
      } @else {
        @if (mostrarLeyenda()) {
          <ul class="leyenda">
            @for (fila of filas(); track fila.etiqueta) {
              <li><span class="swatch" [style.background]="'var(--' + fila.color + ')'"></span>{{ fila.etiqueta }}</li>
            }
          </ul>
        }

        <div class="barras" role="img" [attr.aria-label]="titulo() + ': ver la tabla de datos debajo para los valores exactos.'">
          @for (fila of filas(); track fila.etiqueta) {
            <div class="fila-barra">
              <span class="etiqueta-barra" [title]="fila.etiqueta">{{ fila.etiqueta }}</span>
              <span class="pista">
                @if (fila.valor !== null) {
                  <span class="relleno" [style.width.%]="fila.porcentaje" [style.background]="'var(--' + fila.color + ')'"></span>
                }
              </span>
              <span class="valor-barra">
                {{ fila.valor === null ? 'Sin cálculo' : (fila.valor | number: '1.0-' + decimales()) + (unidad() ? ' ' + unidad() : '') }}
              </span>
            </div>
          }
        </div>

        <details class="tabla-detalle">
          <summary>Ver tabla de datos</summary>
          <table class="tabla-accesible">
            <caption>Datos de "{{ titulo() }}"</caption>
            <thead>
              <tr>
                <th>Categoría</th>
                <th class="align-end">Valor{{ unidad() ? ' (' + unidad() + ')' : '' }}</th>
              </tr>
            </thead>
            <tbody>
              @for (fila of filas(); track fila.etiqueta) {
                <tr>
                  <td>{{ fila.etiqueta }}</td>
                  <td class="align-end">{{ fila.valor === null ? 'Sin cálculo' : (fila.valor | number: '1.0-' + decimales()) }}</td>
                </tr>
              }
            </tbody>
          </table>
        </details>
      }
    </figure>
  `,
  styles: `
    .ui-bar-chart {
      margin: 0;
    }
    figcaption h3 {
      font-size: var(--font-size-sm);
      font-weight: 800;
      margin: 0;
    }
    .subtitulo {
      margin: 0.15rem 0 0;
      color: var(--color-text-muted);
      font-size: 0.75rem;
    }
    .vacio {
      color: var(--color-text-muted);
      font-size: var(--font-size-sm);
      margin: var(--space-3) 0 0;
    }
    .leyenda {
      list-style: none;
      display: flex;
      flex-wrap: wrap;
      gap: var(--space-3);
      margin: var(--space-3) 0 0;
      padding: 0;
      font-size: 0.75rem;
      color: var(--color-text);
    }
    .leyenda li {
      display: flex;
      align-items: center;
      gap: 0.35rem;
    }
    .swatch {
      width: 0.65rem;
      height: 0.65rem;
      border-radius: 0.2rem;
      flex: none;
    }
    .barras {
      display: flex;
      flex-direction: column;
      gap: var(--space-2);
      margin-top: var(--space-3);
    }
    .fila-barra {
      display: grid;
      grid-template-columns: minmax(5rem, 10rem) 1fr auto;
      align-items: center;
      gap: var(--space-3);
    }
    .etiqueta-barra {
      font-size: 0.75rem;
      color: var(--color-text);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .pista {
      display: block;
      height: 0.9rem;
      background: var(--color-surface-soft);
      border-radius: 999px;
      overflow: hidden;
    }
    .relleno {
      display: block;
      height: 100%;
      border-radius: 999px;
      min-width: 2px;
    }
    .sin-calculo {
      color: var(--color-text-muted);
    }
    .valor-barra {
      font-size: 0.75rem;
      font-weight: 700;
      color: var(--color-text);
      white-space: nowrap;
      text-align: right;
      min-width: 4.5rem;
    }
    .tabla-detalle {
      margin-top: var(--space-3);
      font-size: 0.75rem;
    }
    .tabla-detalle summary {
      cursor: pointer;
      color: var(--color-primary);
      font-weight: 700;
    }
    .tabla-accesible {
      width: 100%;
      border-collapse: collapse;
      margin-top: var(--space-2);
    }
    .tabla-accesible caption {
      caption-side: top;
      text-align: left;
      color: var(--color-text-muted);
      padding-bottom: var(--space-1);
    }
    .tabla-accesible th,
    .tabla-accesible td {
      text-align: left;
      padding: 0.3rem 0.5rem;
      border-bottom: 1px solid var(--color-border);
    }
    .tabla-accesible th.align-end,
    .tabla-accesible td.align-end {
      text-align: right;
    }
    @media (max-width: 480px) {
      .fila-barra {
        grid-template-columns: minmax(4rem, 7rem) 1fr auto;
      }
    }
  `,
})
export class BarChartComponent {
  readonly titulo = input.required<string>();
  readonly subtitulo = input('');
  readonly unidad = input('');
  readonly datos = input.required<BarraChart[]>();
  /** true = una sola serie/magnitud (ej. litros por proveedor): un solo color, sin leyenda. */
  readonly serieUnica = input(false);
  readonly mensajeVacio = input('No hay datos para mostrar este gráfico.');
  readonly decimales = input(2);

  protected readonly hayDatos = computed(() => this.datos().length > 0);

  protected readonly maxValor = computed(() => {
    const valores = this.datos()
      .map((d) => d.valor)
      .filter((v): v is number => v !== null && v > 0);
    return valores.length ? Math.max(...valores) : 0;
  });

  protected readonly filas = computed(() => {
    const max = this.maxValor();
    return this.datos().map((d, i) => ({
      ...d,
      color: this.serieUnica() ? COLORES[0] : COLORES[i % COLORES.length],
      porcentaje: d.valor === null || max === 0 ? 0 : (d.valor / max) * 100,
    }));
  });

  protected readonly mostrarLeyenda = computed(() => !this.serieUnica() && this.datos().length >= 2);
}
