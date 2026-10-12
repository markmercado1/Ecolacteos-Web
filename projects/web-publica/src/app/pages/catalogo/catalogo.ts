import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CatalogoStore } from '../../core/state/catalogo.store';
import { EstadoCargaComponent } from '../../shared/estado-carga';
import { disponibilidadDe } from '../../shared/formato';
import { ProductoCardComponent } from '../../shared/producto-card';

const sinTildes = (texto: string) => texto.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();

/** Catálogo real (GET /api/catalogo/productos). Búsqueda y filtros se aplican sobre lo que informa el servidor; no se inventa nada. */
@Component({
  selector: 'pub-catalogo',
  imports: [RouterLink, EstadoCargaComponent, ProductoCardComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="page-title">
      <div class="container">
        <h1>Catálogo de productos</h1>
        <p>Disponibilidad y precios actualizados. Elige un producto para ver sus presentaciones y agregarlo a tu reserva.</p>
      </div>
    </section>

    <section class="section">
      <div class="container">
        <pub-estado-carga [estado]="catalogo.estado()" [error]="catalogo.error()" mensaje="Cargando el catálogo…" (reintentar)="catalogo.cargar(true)">
          @if (catalogo.productos().length === 0) {
            <div class="alert alert-warn">
              Por ahora no hay productos publicados para reservar en línea. Vuelve a visitarnos pronto.
            </div>
          } @else {
            <form class="filtros" role="search" (submit)="$event.preventDefault()">
              <div class="field buscador">
                <label for="buscar">Buscar producto</label>
                <input id="buscar" type="search" [value]="texto()" (input)="texto.set($any($event.target).value)" placeholder="Nombre del producto o presentación" autocomplete="off">
              </div>
              @if (familias().length > 1) {
                <div class="field">
                  <label for="familia">Categoría</label>
                  <select id="familia" [value]="familia()" (change)="familia.set($any($event.target).value)">
                    <option value="">Todas</option>
                    @for (f of familias(); track f) { <option [value]="f">{{ f }}</option> }
                  </select>
                </div>
              }
              <label class="solo">
                <input type="checkbox" [checked]="soloDisponibles()" (change)="soloDisponibles.set($any($event.target).checked)">
                Solo disponibles
              </label>
            </form>

            <p class="resumen" role="status" aria-live="polite">
              {{ filtrados().length }} {{ filtrados().length === 1 ? 'producto' : 'productos' }}
              @if (hayFiltros()) { · <button type="button" class="link-btn" (click)="limpiar()">Quitar filtros</button> }
            </p>

            @if (filtrados().length) {
              <div class="grid lista">
                @for (p of filtrados(); track p.id) { <pub-producto-card [producto]="p" /> }
              </div>
            } @else {
              <div class="alert alert-warn">
                Ningún producto coincide con tu búsqueda.
                <button type="button" class="link-btn" (click)="limpiar()">Quitar filtros</button>
              </div>
            }
          }
        </pub-estado-carga>
        <p class="pie-catalogo">
          ¿Ya elegiste? <a routerLink="/reservar">Ir a mi reserva</a>
        </p>
      </div>
    </section>
  `,
  styles: `
    .filtros { display: flex; flex-wrap: wrap; align-items: flex-end; gap: 1rem 1.25rem; margin-bottom: 0.5rem; }
    .filtros .field { margin: 0; }
    .buscador { flex: 1 1 18rem; }
    .filtros select { min-width: 12rem; }
    .solo { display: inline-flex; align-items: center; gap: 0.5rem; min-height: 2.75rem; font-weight: 600; }
    .solo input { width: 1.2rem; height: 1.2rem; accent-color: var(--color-brand); }
    .resumen { color: var(--color-muted); margin: 0.5rem 0 1.25rem; font-size: 0.95rem; }
    .lista { grid-template-columns: repeat(auto-fill, minmax(15rem, 1fr)); }
    .pie-catalogo { text-align: center; margin: 2.5rem 0 0; }
  `
})
export class CatalogoPage {
  protected readonly catalogo = inject(CatalogoStore);

  protected readonly texto = signal('');
  protected readonly familia = signal('');
  protected readonly soloDisponibles = signal(false);

  protected readonly familias = computed(() => [...new Set(this.catalogo.productos().map((p) => p.familia))].sort((a, b) => a.localeCompare(b, 'es')));

  protected readonly filtrados = computed(() => {
    const q = sinTildes(this.texto().trim());
    return this.catalogo.productos().filter((p) => {
      if (this.familia() && p.familia !== this.familia()) return false;
      if (this.soloDisponibles() && disponibilidadDe(p) === 'AGOTADO') return false;
      if (!q) return true;
      return sinTildes(`${p.nombre} ${p.familia} ${p.presentaciones.map((x) => x.nombre).join(' ')}`).includes(q);
    });
  });

  protected readonly hayFiltros = computed(() => !!(this.texto().trim() || this.familia() || this.soloDisponibles()));

  constructor() {
    this.catalogo.cargar();
  }

  protected limpiar(): void {
    this.texto.set('');
    this.familia.set('');
    this.soloDisponibles.set(false);
  }
}
