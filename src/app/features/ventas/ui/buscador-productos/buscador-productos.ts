import { ChangeDetectionStrategy, Component, ElementRef, effect, inject, input, output, signal, untracked, viewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DecimalPipe } from '@angular/common';
import { Subject, catchError, debounceTime, of, switchMap, tap } from 'rxjs';
import { mapHttpError } from '../../../../core/http/app-error';
import { PresentacionVentaResultado } from '../../data-access/venta.models';
import { VentasApi } from '../../data-access/ventas.api';
import { ParteTexto, partesResaltadas } from '../../util/texto-resaltado';

export interface ProductoElegido {
  resultado: PresentacionVentaResultado;
  cantidad: number;
}

let contador = 0;

/**
 * Buscador con autocompletado de «Nueva venta»: se escribe «lec» y salen los productos que empiezan así (luego los que tienen una palabra
 * que empieza así y, al final, los que solo lo contienen), con su stock y su precio para el canal y la fecha de la venta. Un producto sin
 * stock o sin precio se ve, pero no se puede agregar, y dice por qué.
 *
 * Teclado: ↑ ↓ para moverse, Enter para agregar con la cantidad del campo «Cant.», Esc para cerrar. Tras agregar, el cursor vuelve al
 * buscador y la cantidad a 1, listo para el siguiente producto. Es solo una ayuda para elegir: el servidor vuelve a resolver precio y stock
 * al registrar la venta. Cada tecla cancela la búsqueda anterior (una respuesta tardía nunca pisa a la actual).
 */
@Component({
  selector: 'app-buscador-productos',
  imports: [DecimalPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="barra" (focusout)="alPerderFoco($event)" #barra>
      <div class="campo-busqueda">
        <svg class="lupa" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
          <circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" />
        </svg>
        <input
          #buscador
          type="text"
          role="combobox"
          autocomplete="off"
          [value]="texto()"
          [disabled]="deshabilitado()"
          placeholder="Busca un producto por nombre o código…"
          aria-label="Buscar producto por nombre o código"
          aria-autocomplete="list"
          [attr.aria-expanded]="listaVisible()"
          [attr.aria-controls]="idLista"
          [attr.aria-activedescendant]="activo() >= 0 ? idOpcion(activo()) : null"
          (input)="escribir($any($event.target).value)"
          (focus)="abrir()"
          (keydown)="teclado($event)"
        >
      </div>
      <label class="cantidad">
        <span>Cant.</span>
        <input
          #cantidadEl
          type="number" min="1" step="1" inputmode="numeric"
          [value]="cantidad()"
          [disabled]="deshabilitado()"
          aria-label="Cantidad a agregar"
          (input)="cambiarCantidad($any($event.target).value)"
          (keydown.enter)="$event.preventDefault(); elegirActivo()"
        >
      </label>
    </div>

    @if (listaVisible()) {
      <ul class="lista" role="listbox" [id]="idLista" aria-label="Productos encontrados">
        @if (cargando() && resultados().length === 0) {
          <li class="estado" role="status">Buscando…</li>
        } @else if (error()) {
          <li class="estado error" role="alert">{{ error() }}</li>
        } @else if (resultados().length === 0) {
          <li class="estado" role="status">No hay productos que empiecen con «{{ texto().trim() }}» ni lo contengan.</li>
        }
        @for (r of resultados(); track r.presentacionId; let i = $index) {
          <li
            role="option"
            [id]="idOpcion(i)"
            [class.activa]="i === activo()"
            [class.deshabilitada]="!r.disponible"
            [attr.aria-selected]="i === activo()"
            [attr.aria-disabled]="!r.disponible"
            (mousedown)="$event.preventDefault()"
            (mousemove)="r.disponible && activo.set(i)"
            (click)="elegir(r)"
          >
            <span class="icono" aria-hidden="true">
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8">
                <path d="M21 8 12 3 3 8v8l9 5 9-5V8Z" /><path d="m3 8 9 5 9-5M12 13v8" />
              </svg>
            </span>
            <span class="datos">
              <span class="nombre">
                @for (p of partes(r); track $index) {
                  @if (p.resaltada) {
                    <mark>{{ p.texto }}</mark>
                  } @else {
                    <span>{{ p.texto }}</span>
                  }
                }
              </span>
              <span class="meta">{{ r.codigo }} · Stock {{ r.stockVendible }}</span>
            </span>
            <span class="precio">
              @if (r.motivo === 'SIN_STOCK') { <span class="chip">Agotado</span> }
              @else if (r.motivo === 'SIN_PRECIO') { <span class="chip">Sin precio para este canal</span> }
              @else { S/ {{ r.precio | number: '1.2-2' }} }
            </span>
          </li>
        }
      </ul>
    }
  `,
  styles: `
    :host { display: block; position: relative; }
    .barra { display: flex; gap: var(--space-3); align-items: center; }
    .campo-busqueda { position: relative; flex: 1; min-width: 0; }
    .campo-busqueda input {
      width: 100%; min-height: 2.75rem; padding: var(--space-2) var(--space-3) var(--space-2) 2.5rem;
      border: 1px solid var(--color-border); border-radius: var(--radius-control); background: var(--color-surface);
    }
    .campo-busqueda input:focus { border-color: var(--brand-500); outline: 3px solid var(--color-focus); outline-offset: 1px; }
    .lupa { position: absolute; left: 0.8rem; top: 50%; transform: translateY(-50%); color: var(--color-text-muted); pointer-events: none; }
    .cantidad { display: flex; align-items: center; gap: var(--space-2); font-weight: 700; font-size: var(--font-size-sm); }
    .cantidad input {
      width: 5rem; min-height: 2.75rem; padding: var(--space-2) var(--space-3);
      border: 1px solid var(--color-border); border-radius: var(--radius-control); background: var(--color-surface);
    }
    .lista {
      position: absolute; left: 0; right: 0; top: calc(100% + var(--space-1)); z-index: var(--z-overlay);
      margin: 0; padding: var(--space-1); list-style: none; max-height: 21rem; overflow-y: auto; overflow-x: hidden;
      background: var(--color-surface); border: 1px solid var(--color-border); border-radius: var(--radius-card); box-shadow: var(--shadow-overlay);
    }
    .lista li { display: flex; align-items: center; gap: var(--space-3); padding: var(--space-2) var(--space-3); border-radius: var(--radius-control); cursor: pointer; }
    .lista li.activa { background: var(--color-surface-soft); }
    .lista li.deshabilitada { cursor: not-allowed; opacity: 0.6; }
    .lista li.estado { cursor: default; color: var(--color-text-muted); font-size: var(--font-size-sm); }
    .lista li.estado.error { color: var(--color-danger); }
    .icono { display: grid; place-items: center; flex: none; width: 2.25rem; height: 2.25rem; border-radius: var(--radius-control); background: var(--color-canvas); color: var(--brand-500); }
    .datos { display: flex; flex-direction: column; min-width: 0; flex: 1; }
    .nombre { font-weight: 600; overflow-wrap: anywhere; }
    .nombre mark { background: transparent; color: var(--color-focus); font-weight: 800; }
    .meta { font-size: 0.75rem; color: var(--color-text-muted); }
    .precio { flex: none; font-weight: 800; white-space: nowrap; text-align: right; }
    .chip { display: inline-block; padding: 0.15rem 0.5rem; border-radius: 999px; font-size: 0.6875rem; font-weight: 700; color: var(--color-warning); background: var(--color-warning-bg); white-space: normal; }
    @media (max-width: 520px) { .cantidad span { display: none; } .cantidad input { width: 4rem; } }
  `
})
export class BuscadorProductosComponent {
  private readonly api = inject(VentasApi);
  private readonly buscador = viewChild.required<ElementRef<HTMLInputElement>>('buscador');
  private readonly barra = viewChild.required<ElementRef<HTMLElement>>('barra');
  private readonly campoCantidad = viewChild.required<ElementRef<HTMLInputElement>>('cantidadEl');

  /** Canal (código de tipo de precio) y fecha de la venta: el precio mostrado depende de ambos. */
  readonly canal = input.required<string>();
  readonly fecha = input.required<string>();
  readonly deshabilitado = input(false);
  readonly agregar = output<ProductoElegido>();

  protected readonly idLista = `bp-lista-${++contador}`;
  protected readonly texto = signal('');
  protected readonly cantidad = signal(1);
  protected readonly resultados = signal<PresentacionVentaResultado[]>([]);
  protected readonly activo = signal(-1);
  protected readonly abierto = signal(false);
  protected readonly cargando = signal(false);
  protected readonly error = signal<string | null>(null);

  private readonly consultas = new Subject<string>();

  constructor() {
    this.consultas
      .pipe(
        debounceTime(150),
        tap(() => this.error.set(null)),
        switchMap((q) => {
          if (!q.trim()) return of<PresentacionVentaResultado[]>([]);
          this.cargando.set(true);
          return this.api.buscarPresentaciones(q, this.canal(), this.fecha()).pipe(
            catchError((e) => {
              this.error.set(mapHttpError(e).mensaje);
              return of<PresentacionVentaResultado[]>([]);
            })
          );
        }),
        takeUntilDestroyed()
      )
      .subscribe((resultados) => {
        this.cargando.set(false);
        this.resultados.set(resultados);
        this.activo.set(resultados.findIndex((r) => r.disponible));
      });

    // Cambiar el canal o la fecha cambia el precio de lo ya mostrado: se vuelve a buscar con el mismo texto.
    effect(() => {
      this.canal();
      this.fecha();
      untracked(() => {
        if (this.texto().trim()) this.consultas.next(this.texto());
      });
    });
  }

  protected listaVisible(): boolean {
    return this.abierto() && this.texto().trim().length > 0;
  }

  protected idOpcion(indice: number): string {
    return `${this.idLista}-op-${indice}`;
  }

  protected partes(r: PresentacionVentaResultado): ParteTexto[] {
    return partesResaltadas(`${r.productoNombre} · ${r.presentacionNombre}`, this.texto());
  }

  protected abrir(): void {
    this.abierto.set(true);
  }

  protected escribir(valor: string): void {
    this.texto.set(valor);
    this.abierto.set(true);
    if (!valor.trim()) {
      this.resultados.set([]);
      this.activo.set(-1);
    }
    this.consultas.next(valor);
  }

  protected cambiarCantidad(valor: string): void {
    const n = Math.floor(Number(valor));
    this.cantidad.set(Number.isFinite(n) && n >= 1 ? n : 1);
  }

  protected teclado(e: KeyboardEvent): void {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        this.abierto.set(true);
        this.mover(1);
        break;
      case 'ArrowUp':
        e.preventDefault();
        this.mover(-1);
        break;
      case 'Enter':
        e.preventDefault();
        this.elegirActivo();
        break;
      case 'Escape':
        if (this.abierto()) {
          e.preventDefault();
          this.abierto.set(false);
        }
        break;
    }
  }

  /** Se mueve al siguiente (o anterior) resultado que se pueda agregar, dando la vuelta al llegar al final. */
  private mover(paso: 1 | -1): void {
    const lista = this.resultados();
    if (lista.length === 0) return;
    let i = this.activo();
    for (let n = 0; n < lista.length; n++) {
      i = (i + paso + lista.length) % lista.length;
      if (lista[i].disponible) {
        this.activo.set(i);
        return;
      }
    }
  }

  protected elegirActivo(): void {
    const r = this.resultados()[this.activo()];
    if (r) this.elegir(r);
  }

  protected elegir(r: PresentacionVentaResultado): void {
    if (!r.disponible || this.deshabilitado()) return;
    this.agregar.emit({ resultado: r, cantidad: this.cantidad() });
    this.texto.set('');
    this.resultados.set([]);
    this.activo.set(-1);
    this.abierto.set(false);
    this.cantidad.set(1);
    // El campo puede mostrar algo que la señal no guardó (por ejemplo texto no numérico): se deja en 1 directamente.
    this.campoCantidad().nativeElement.value = '1';
    this.buscador().nativeElement.focus();
  }

  /** Cierra la lista solo cuando el foco sale de TODO el componente (no al pasar del buscador a «Cant.»). */
  protected alPerderFoco(e: FocusEvent): void {
    const destino = e.relatedTarget as Node | null;
    if (!destino || !this.barra().nativeElement.contains(destino)) this.abierto.set(false);
  }

  /** Lleva el cursor al buscador (la pantalla lo usa al empezar una venta nueva). */
  enfocar(): void {
    this.buscador().nativeElement.focus();
  }
}
