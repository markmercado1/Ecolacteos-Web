import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { RouterLink } from '@angular/router';
import { urlFoto } from '../../core/api/api-url';
import { PresentacionCatalogo } from '../../core/api/catalogo.models';
import { CarritoStore, MAX_LINEAS } from '../../core/state/carrito.store';
import { CatalogoStore } from '../../core/state/catalogo.store';
import { EstadoCargaComponent } from '../../shared/estado-carga';
import { contenidoAparte, etiquetaDePresentacion, formatearPrecio, textoQuedan } from '../../shared/formato';

/** Detalle de un producto del catálogo real: foto, presentaciones, precio y disponibilidad por presentación, y acceso a reservar. */
@Component({
  selector: 'pub-producto',
  imports: [RouterLink, EstadoCargaComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="section">
      <div class="container">
        <nav class="migas" aria-label="Ruta de navegación"><a routerLink="/catalogo">← Volver al catálogo</a></nav>

        <pub-estado-carga [estado]="catalogo.estado()" [error]="catalogo.error()" mensaje="Cargando el producto…" (reintentar)="catalogo.cargar(true)">
          @if (producto(); as p) {
            <div class="detalle">
              <div class="media card">
                @if (foto(); as src) {
                  <img [src]="src" [alt]="p.nombre" (error)="fotoRota.set(true)">
                } @else {
                  <span class="sin-foto"><img src="/img/icono-vaca-192.png" alt="" width="96" height="96"></span>
                }
              </div>

              <div>
                <span class="eyebrow">{{ p.familia }}</span>
                <h1>{{ p.nombre }}</h1>
                <p class="lead">Elige la presentación y la cantidad que quieres reservar.</p>

                <ul class="presentaciones">
                  @for (pr of p.presentaciones; track pr.id) {
                    <li class="card card-pad fila">
                      <div class="info">
                        <h2>{{ pr.nombre }}</h2>
                        @if (contenidoAparte(pr)) { <p class="muted small">{{ contenidoAparte(pr) }}</p> }
                        <p class="precio">
                          @if (pr.precio !== null) { {{ precioTexto(pr.precio) }} }
                          @else { <span class="a-confirmar">Precio a confirmar</span> }
                        </p>
                        <span class="badge" [class.badge-warn]="pr.disponibilidad === 'POCAS_UNIDADES'" [class.badge-off]="pr.disponibilidad === 'AGOTADO'">
                          {{ etiqueta(pr) }}
                        </span>
                        @if (pr.precioAConfirmar) {
                          <p class="nota small">Podrás reservarla igual: el personal te confirmará el precio antes de confirmar tu reserva.</p>
                        }
                      </div>
                      <div class="compra">
                        <label [for]="'cant-' + pr.id" class="small">Cantidad</label>
                        <input [id]="'cant-' + pr.id" type="number" min="1" [attr.max]="pr.unidadesDisponibles" step="1" inputmode="numeric" class="input"
                               [value]="cantidadDe(pr.id)" (input)="fijarCantidad(pr.id, $any($event.target).value)"
                               [disabled]="pr.disponibilidad === 'AGOTADO'">
                        <button type="button" class="btn btn-sm" [disabled]="pr.disponibilidad === 'AGOTADO'" (click)="agregar(pr)">
                          {{ pr.disponibilidad === 'AGOTADO' ? 'Agotado' : 'Agregar a mi reserva' }}
                        </button>
                      </div>
                    </li>
                  }
                </ul>

                <p class="estado-agregado" role="status" aria-live="polite">
                  @if (mensaje(); as m) { {{ m }} <a routerLink="/reservar">Ir a mi reserva →</a> }
                </p>
              </div>
            </div>
          } @else {
            <div class="alert alert-warn">
              No encontramos ese producto en el catálogo actual. <a routerLink="/catalogo">Ver el catálogo completo</a>.
            </div>
          }
        </pub-estado-carga>
      </div>
    </section>
  `,
  styles: `
    .migas { margin-bottom: 1.25rem; font-weight: 600; }
    .detalle { display: grid; grid-template-columns: minmax(0, 5fr) minmax(0, 6fr); gap: clamp(1.5rem, 4vw, 3rem); align-items: start; }
    .media { background: var(--color-sage-soft); aspect-ratio: 1 / 1; display: grid; place-items: center; overflow: hidden; position: sticky; top: 6rem; }
    .media img { width: 100%; height: 100%; object-fit: contain; padding: 1.25rem; }
    .sin-foto { display: grid; place-items: center; }
    .sin-foto img { width: 6rem; height: 6rem; opacity: 0.35; padding: 0; }
    h1 { font-size: clamp(1.8rem, 4vw, 2.6rem); }
    .presentaciones { list-style: none; margin: 1.5rem 0 0; padding: 0; display: grid; gap: 1rem; }
    .fila { display: flex; gap: 1.25rem; justify-content: space-between; flex-wrap: wrap; }
    .info h2 { font-size: 1.15rem; margin: 0 0 0.1rem; }
    .info p { margin: 0.2rem 0; }
    .precio { font-weight: 800; font-size: 1.25rem; color: var(--color-navy); }
    .a-confirmar { font-size: 1rem; color: var(--color-warn-ink); }
    .nota { color: var(--color-muted); max-width: 20rem; }
    .compra { display: grid; gap: 0.4rem; align-content: start; min-width: 10rem; }
    .compra .input { max-width: 7rem; }
    .estado-agregado { min-height: 1.6rem; margin: 1rem 0 0; font-weight: 600; color: var(--color-brand-dark); }
    @media (max-width: 800px) { .detalle { grid-template-columns: 1fr; } .media { position: static; max-height: 22rem; aspect-ratio: 4 / 3; } }
  `
})
export class ProductoPage {
  /** Parámetro de ruta `:id` (enlazado con withComponentInputBinding). */
  readonly id = input.required<string>();

  protected readonly catalogo = inject(CatalogoStore);
  private readonly carrito = inject(CarritoStore);

  protected readonly fotoRota = signal(false);
  protected readonly mensaje = signal('');
  private readonly cantidades = signal<Record<string, number>>({});

  protected readonly producto = computed(() => this.catalogo.producto(this.id()));
  protected readonly foto = computed(() => (this.fotoRota() ? null : urlFoto(this.producto()?.fotoUrl)));

  private readonly titulo = inject(Title);

  constructor() {
    this.catalogo.cargar();
    // El título de la pestaña lleva el nombre del producto (útil para el historial y para compartir el enlace).
    effect(() => {
      const nombre = this.producto()?.nombre;
      if (nombre) this.titulo.setTitle(`${nombre} · EcoLácteos Huata`);
    });
  }

  protected contenidoAparte = contenidoAparte;
  protected precioTexto = formatearPrecio;
  protected etiqueta(p: PresentacionCatalogo): string {
    return etiquetaDePresentacion(p);
  }

  protected cantidadDe(presentacionId: string): number {
    return this.cantidades()[presentacionId] ?? 1;
  }

  protected fijarCantidad(presentacionId: string, valor: string): void {
    const n = Math.floor(Number(valor));
    this.cantidades.update((c) => ({ ...c, [presentacionId]: Number.isFinite(n) && n >= 1 ? n : 1 }));
  }

  protected agregar(p: PresentacionCatalogo): void {
    const resultado = this.carrito.agregar(p.id, this.cantidadDe(p.id), p.unidadesDisponibles);
    const nombre = `${this.producto()?.nombre} · ${p.nombre}`;
    this.mensaje.set(
      resultado === 'llena' ? `Tu reserva ya tiene el máximo de ${MAX_LINEAS} productos distintos.`
      : resultado === 'tope' ? `${nombre}: ya tienes en tu reserva todas las unidades disponibles.`
      : resultado === 'limitada' ? `${nombre}: ${textoQuedan(p.unidadesDisponibles)?.toLowerCase()}; dejamos esa cantidad en tu reserva.`
      : `${nombre}: ${resultado === 'sumada' ? 'cantidad actualizada en' : 'agregado a'} tu reserva.`
    );
  }
}
