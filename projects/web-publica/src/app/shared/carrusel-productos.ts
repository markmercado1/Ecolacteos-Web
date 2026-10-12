import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, afterNextRender, computed, inject, input, signal, viewChild } from '@angular/core';
import { ProductoCatalogo } from '../core/api/catalogo.models';
import { ProductoCardComponent } from './producto-card';

const INTERVALO_MS = 5000;

/**
 * Carrusel de las mismas tarjetas de producto del catálogo. Muestra tarjetas COMPLETAS, de a 3, de a 2 o de a 1 según el ancho
 * disponible (nunca una tarjeta cortada), y avanza por páginas. Avanza solo, pero se detiene al pasar el cursor, al enfocar algo
 * dentro, al tocarlo y con el botón «Pausar»; no avanza solo si el visitante pidió menos movimiento. Se desliza con el dedo y tiene
 * flechas y puntos. Si todas las tarjetas caben a la vez, no hay controles.
 */
@Component({
  selector: 'pub-carrusel-productos',
  imports: [ProductoCardComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="carrusel" aria-roledescription="carrusel" aria-label="Productos destacados"
             (mouseenter)="pausaTemporal.set(true)" (mouseleave)="pausaTemporal.set(false)"
             (focusin)="pausaTemporal.set(true)" (focusout)="pausaTemporal.set(false)" (touchstart)="pausaTemporal.set(true)">
      <div class="ventana">
        @if (paginas() > 1) { <button type="button" class="flecha anterior" aria-label="Productos anteriores" (click)="ir(activo() - 1)">‹</button> }
        <ul class="pista" #pista (scroll)="alDesplazar()" tabindex="-1">
          @for (p of productos(); track p.id; let i = $index) {
            <li class="slide" role="group" aria-roledescription="diapositiva" [attr.aria-label]="(i + 1) + ' de ' + productos().length">
              <pub-producto-card [producto]="p" />
            </li>
          }
        </ul>
        @if (paginas() > 1) { <button type="button" class="flecha siguiente" aria-label="Productos siguientes" (click)="ir(activo() + 1)">›</button> }
      </div>

      @if (paginas() > 1) {
        <div class="controles">
          <ol class="puntos">
            @for (n of indices(); track n) {
              <li><button type="button" [class.activo]="n === activo()" [attr.aria-label]="'Ir a la página ' + (n + 1) + ' de ' + paginas()" [attr.aria-current]="n === activo() ? 'true' : null" (click)="ir(n)"></button></li>
            }
          </ol>
          @if (autoplayPosible) {
            <button type="button" class="pausa" [attr.aria-pressed]="pausaUsuario()" (click)="pausaUsuario.set(!pausaUsuario())">{{ pausaUsuario() ? 'Reanudar' : 'Pausar' }}</button>
          }
        </div>
      }
    </section>
  `,
  styles: `
    :host { display: block; min-width: 0; }
    .carrusel { display: grid; gap: 0.9rem; container-type: inline-size; --separacion: 1.25rem; }
    .pista {
      --por-pagina: 3; display: flex; gap: var(--separacion); list-style: none; margin: 0; padding: 0.25rem 0.25rem 0.6rem;
      overflow-x: auto; scroll-snap-type: x mandatory; scroll-behavior: smooth; scrollbar-width: none; overscroll-behavior-x: contain;
    }
    .pista::-webkit-scrollbar { display: none; }
    @container (max-width: 959px) { .pista { --por-pagina: 2; } }
    @container (max-width: 599px) { .pista { --por-pagina: 1; } }
    /* Cada tarjeta ocupa exactamente 1/N del ancho visible: caben N completas, sin cortes. */
    /* Todas las tarjetas del mismo alto (la más alta manda); el contenido se reparte dentro de cada una. */
    .slide { display: grid; flex: 0 0 calc((100% - 0.5rem - (var(--por-pagina) - 1) * var(--separacion)) / var(--por-pagina)); scroll-snap-align: start; min-width: 0; }
    .ventana { position: relative; }
    .controles { display: flex; align-items: center; justify-content: center; gap: 0.75rem; flex-wrap: wrap; }
    /* Flechas a los lados de las tarjetas, centradas en vertical. */
    .flecha {
      position: absolute; top: 50%; transform: translateY(-50%); z-index: 2; width: 2.75rem; height: 2.75rem; border-radius: 50%;
      border: 1.5px solid var(--color-brand); background: #fff; color: var(--color-brand); font-size: 1.6rem; line-height: 1; box-shadow: var(--shadow);
    }
    .anterior { left: -1.4rem; }
    .siguiente { right: -1.4rem; }
    .flecha:hover { background: var(--color-brand); color: #fff; }
    @media (max-width: 700px) { .anterior { left: 0.3rem; } .siguiente { right: 0.3rem; } }
    .puntos { display: flex; gap: 0.4rem; list-style: none; margin: 0; padding: 0; }
    .puntos button { width: 0.7rem; height: 0.7rem; padding: 0; border-radius: 50%; border: 0; background: #b9c4b6; }
    .puntos button.activo { background: var(--color-brand); width: 1.5rem; border-radius: 999px; }
    .pausa { background: none; border: 0; color: var(--color-brand); font-weight: 600; font-size: 0.85rem; text-decoration: underline; text-underline-offset: 3px; }
    @media (prefers-reduced-motion: reduce) { .pista { scroll-behavior: auto; } }
  `
})
export class CarruselProductosComponent {
  readonly productos = input.required<ProductoCatalogo[]>();

  protected readonly activo = signal(0);
  protected readonly porPagina = signal(1);
  protected readonly pausaTemporal = signal(false);
  protected readonly pausaUsuario = signal(false);
  protected readonly autoplayPosible = typeof matchMedia === 'function' && !matchMedia('(prefers-reduced-motion: reduce)').matches;
  protected readonly paginas = computed(() => Math.max(1, Math.ceil(this.productos().length / this.porPagina())));
  protected readonly indices = computed(() => Array.from({ length: this.paginas() }, (_, i) => i));
  private readonly pista = viewChild.required<ElementRef<HTMLUListElement>>('pista');

  constructor() {
    afterNextRender(() => {
      const el = this.pista().nativeElement;
      this.medir();
      if (typeof ResizeObserver === 'function') {
        const observador = new ResizeObserver(() => this.medir());
        observador.observe(el);
        inject(DestroyRef).onDestroy(() => observador.disconnect());
      }
      if (!this.autoplayPosible) return;
      const temporizador = setInterval(() => {
        if (this.paginas() < 2 || this.pausaTemporal() || this.pausaUsuario() || document.hidden) return;
        this.ir(this.activo() + 1);
      }, INTERVALO_MS);
      inject(DestroyRef).onDestroy(() => clearInterval(temporizador));
    });
  }

  /** Cuántas tarjetas completas caben a la vez (la CSS reparte el ancho en 3, 2 o 1 columnas). */
  private medir(): void {
    const pista = this.pista().nativeElement;
    const primera = pista.children[0] as HTMLElement | undefined;
    if (!primera || !primera.offsetWidth) return;
    const separacion = parseFloat(getComputedStyle(pista).columnGap) || 0;
    const n = Math.max(1, Math.round((pista.clientWidth + separacion) / (primera.offsetWidth + separacion)));
    if (n !== this.porPagina()) this.porPagina.set(n);
    if (this.activo() >= this.paginas()) this.activo.set(this.paginas() - 1);
  }

  protected ir(pagina: number): void {
    const total = this.paginas();
    const destino = (pagina + total) % total;
    const pista = this.pista().nativeElement;
    this.activo.set(destino);
    const slide = pista.children[Math.min(destino * this.porPagina(), this.productos().length - 1)] as HTMLElement | undefined;
    if (slide && typeof pista.scrollTo === 'function') pista.scrollTo({ left: slide.offsetLeft - pista.offsetLeft });
  }

  protected alDesplazar(): void {
    const pista = this.pista().nativeElement;
    const alFinal = pista.scrollLeft + pista.clientWidth >= pista.scrollWidth - 2;
    if (alFinal) {
      this.activo.set(this.paginas() - 1);
      return;
    }
    const primera = pista.children[0] as HTMLElement | undefined;
    if (!primera) return;
    const ancho = primera.offsetWidth + (parseFloat(getComputedStyle(pista).columnGap) || 0);
    this.activo.set(Math.min(this.paginas() - 1, Math.round(pista.scrollLeft / (ancho * this.porPagina()))));
  }
}
