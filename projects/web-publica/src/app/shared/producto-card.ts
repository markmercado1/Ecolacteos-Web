import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { PresentacionCatalogo, ProductoCatalogo } from '../core/api/catalogo.models';
import { urlFoto } from '../core/api/api-url';
import { CarritoStore } from '../core/state/carrito.store';
import { contenidoDe, etiquetaDePresentacion, formatearPrecio } from './formato';

/**
 * Tarjeta de producto (una por producto, como en una tienda real). Las presentaciones se eligen dentro de la tarjeta con etiquetas
 * (como las tallas de una zapatilla): la elegida decide el precio, la disponibilidad, la foto —la de la presentación o, si no
 * tiene, la del producto— y a qué presentación se agrega la reserva. Todo sale del catálogo real. Sin foto, un recuadro neutro con
 * el emblema de la marca (nunca una imagen genérica que simule ser el producto).
 */
@Component({
  selector: 'pub-producto-card',
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <article class="card producto">
      <a class="media" [routerLink]="['/producto', producto().id]" [attr.aria-label]="'Ver ' + producto().nombre" tabindex="-1">
        @if (foto(); as src) {
          <img [src]="src" [alt]="producto().nombre + ' · ' + seleccionada().nombre" loading="lazy" (error)="fotoRota.set(src)">
        } @else {
          <span class="sin-foto"><img src="/img/icono-vaca-192.png" alt="" width="72" height="72"></span>
        }
      </a>
      <div class="cuerpo">
        <span class="familia">{{ producto().familia }}</span>
        <h3><a [routerLink]="['/producto', producto().id]">{{ producto().nombre }}</a></h3>

        @if (producto().presentaciones.length > 1) {
          <div class="etiquetas" role="group" [attr.aria-label]="'Presentaciones de ' + producto().nombre">
            @for (p of producto().presentaciones; track p.id) {
              <button type="button" class="etiqueta" [class.activa]="p.id === seleccionada().id" [class.agotada]="p.disponibilidad === 'AGOTADO'"
                      [attr.aria-pressed]="p.id === seleccionada().id" (click)="elegir(p.id)">
                {{ p.nombre }}@if (p.disponibilidad === 'AGOTADO') { <span class="visually-hidden"> (agotada)</span> }
              </button>
            }
          </div>
        } @else {
          <p class="contenidos">{{ contenido(seleccionada()) }}</p>
        }

        <div class="fila">
          <span class="precio">
            @if (seleccionada().precio !== null) { {{ precioTexto() }} } @else { <span class="a-confirmar">Precio a confirmar</span> }
          </span>
          <span class="badge" [class.badge-warn]="seleccionada().disponibilidad === 'POCAS_UNIDADES'" [class.badge-off]="seleccionada().disponibilidad === 'AGOTADO'">
            {{ etiqueta() }}
          </span>
        </div>
        <div class="acciones">
          <button type="button" class="btn btn-sm" [disabled]="seleccionada().disponibilidad === 'AGOTADO'" (click)="agregar()">
            {{ agregado() ? 'Agregado ✓' : sinMas() ? 'Ya tienes todas' : 'Agregar a mi reserva' }}
          </button>
          <a class="btn btn-sm btn-outline" [routerLink]="['/producto', producto().id]">Ver detalle</a>
        </div>
        <span class="visually-hidden" role="status" aria-live="polite">{{ agregado() ? producto().nombre + ' · ' + seleccionada().nombre + ' agregado a tu reserva' : '' }}</span>
      </div>
    </article>
  `,
  styles: `
    :host { display: block; }
    .producto { height: 100%; display: flex; flex-direction: column; overflow: hidden; }
    /* Caja de foto del MISMO tamaño en todas las tarjetas: la imagen se ajusta dentro (completa) y nunca agranda la tarjeta. */
    .media { position: relative; display: block; aspect-ratio: 4 / 3; overflow: hidden; background: var(--color-sage-soft); }
    .media img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: contain; padding: 0.75rem; }
    .sin-foto { position: absolute; inset: 0; display: grid; place-items: center; }
    .sin-foto img { position: static; width: 4.5rem; height: 4.5rem; opacity: 0.35; padding: 0; }
    .cuerpo { display: flex; flex-direction: column; gap: 0.35rem; padding: 1rem 1.1rem 1.15rem; flex: 1; }
    .familia { font-size: 0.75rem; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: var(--color-muted); }
    h3 { margin: 0; font-size: 1.2rem; }
    h3 a { color: var(--color-navy); text-decoration: none; }
    h3 a:hover { text-decoration: underline; }
    .contenidos { margin: 0; font-size: 0.9rem; color: var(--color-muted); min-height: 2.1rem; }
    .etiquetas { display: flex; flex-wrap: wrap; gap: 0.4rem; margin: 0.15rem 0 0.1rem; min-height: 2.1rem; }
    .etiqueta { padding: 0.25rem 0.7rem; border: 1.5px solid #aeb8ab; border-radius: 999px; background: #fff; font-size: 0.82rem; font-weight: 600; color: var(--color-ink); }
    .etiqueta:hover { border-color: var(--color-brand); }
    .etiqueta.activa { background: var(--color-brand); border-color: var(--color-brand); color: #fff; }
    .etiqueta.agotada:not(.activa) { color: #6b6f66; text-decoration: line-through; }
    .fila { display: flex; align-items: center; justify-content: space-between; gap: 0.5rem; flex-wrap: wrap; margin-top: auto; padding-top: 0.5rem; }
    .precio { font-weight: 800; font-size: 1.1rem; color: var(--color-navy); }
    .a-confirmar { font-weight: 700; font-size: 0.9rem; color: var(--color-warn-ink); }
    .acciones { display: flex; gap: 0.5rem; flex-wrap: wrap; margin-top: 0.5rem; }
  `
})
export class ProductoCardComponent {
  readonly producto = input.required<ProductoCatalogo>();
  private readonly carrito = inject(CarritoStore);

  /** Presentación elegida por el visitante; por defecto la primera que no esté agotada (o la primera). */
  private readonly elegida = signal<string | null>(null);
  protected readonly fotoRota = signal<string | null>(null);
  protected readonly agregado = signal(false);
  protected readonly sinMas = signal(false);

  protected readonly seleccionada = computed<PresentacionCatalogo>(() => {
    const todas = this.producto().presentaciones;
    return todas.find((p) => p.id === this.elegida()) ?? todas.find((p) => p.disponibilidad !== 'AGOTADO') ?? todas[0];
  });
  protected readonly foto = computed(() => {
    const url = urlFoto(this.seleccionada().fotoUrl ?? this.producto().fotoUrl);
    return url && url !== this.fotoRota() ? url : null;
  });
  protected readonly etiqueta = computed(() => etiquetaDePresentacion(this.seleccionada()));
  protected readonly precioTexto = computed(() => formatearPrecio(this.seleccionada().precio ?? 0));
  protected contenido = contenidoDe;

  protected elegir(id: string): void {
    this.elegida.set(id);
    this.agregado.set(false);
    this.sinMas.set(false);
  }

  protected agregar(): void {
    const p = this.seleccionada();
    const resultado = this.carrito.agregar(p.id, 1, p.unidadesDisponibles);
    this.agregado.set(resultado !== 'tope');
    this.sinMas.set(resultado === 'tope');
    setTimeout(() => {
      this.agregado.set(false);
      this.sinMas.set(false);
    }, 2500);
  }
}
