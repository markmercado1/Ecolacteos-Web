import { ChangeDetectionStrategy, Component, OnInit, input, output, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subject, map, of, switchMap, timer } from 'rxjs';

/**
 * Buscador único de las tablas (mismo aspecto que el `.search` de los filtros). Emite `buscar` con el texto ya
 * recortado: al dejar de teclear (espera corta, para no pedir al servidor en cada letra), al pulsar Enter, y al
 * instante cuando se vacía o se pulsa «×» / Escape. Solo emite cuando el texto realmente cambió. Quien lo usa decide qué
 * hacer: pedir al servidor (tablas paginadas) o filtrar en el cliente (`ListaLocal`); siempre debe volver a la
 * página 0.
 */
@Component({
  selector: 'ui-buscador',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="buscador" role="search">
      <input
        type="search"
        autocomplete="off"
        [value]="texto()"
        [placeholder]="placeholder()"
        [attr.aria-label]="etiqueta() || placeholder()"
        (input)="alEscribir($any($event.target).value)"
        (keydown.enter)="confirmar()"
        (keydown.escape)="limpiar()"
      >
      @if (texto()) {
        <button type="button" class="limpiar" aria-label="Limpiar búsqueda" (click)="limpiar()">×</button>
      }
    </div>
  `,
  styles: `
    .buscador {
      border: 1px solid var(--color-border);
      background: var(--color-canvas);
      border-radius: var(--radius-control);
      padding: 0 var(--space-2) 0 var(--space-3);
      min-height: 2.375rem;
      display: flex;
      align-items: center;
      gap: var(--space-1);
    }
    .buscador:focus-within {
      border-color: var(--color-primary);
    }
    input {
      border: 0;
      background: transparent;
      outline: 0;
      font-size: var(--font-size-sm);
      min-width: 13rem;
      color: var(--color-text);
    }
    /* El navegador dibuja su propia «x» en type=search: se usa solo la nuestra, igual en todos. */
    input::-webkit-search-cancel-button { display: none; }
    .limpiar {
      border: 0;
      background: transparent;
      color: var(--color-text-muted);
      font-size: 1.1rem;
      line-height: 1;
      width: 1.5rem;
      height: 1.5rem;
      border-radius: 50%;
    }
    .limpiar:hover { background: var(--color-surface-soft); color: var(--color-text); }
  `
})
export class BuscadorComponent implements OnInit {
  readonly placeholder = input('Buscar…');
  /** Etiqueta accesible; por defecto, el placeholder. */
  readonly etiqueta = input('');
  /** Milisegundos de espera tras la última tecla antes de emitir. */
  readonly espera = input(350);
  /** Texto con el que arranca (p. ej. una búsqueda ya aplicada). */
  readonly valorInicial = input('');
  readonly buscar = output<string>();

  protected readonly texto = signal('');
  private aplicado = '';
  private readonly entrada$ = new Subject<string>();

  constructor() {
    this.entrada$
      .pipe(
        // Vaciar es inmediato; escribir espera a que el usuario pare.
        switchMap((valor) => (valor.trim() === '' ? of('') : timer(this.espera()).pipe(map(() => valor.trim())))),
        takeUntilDestroyed()
      )
      .subscribe((valor) => this.emitir(valor));
  }

  ngOnInit(): void {
    this.texto.set(this.valorInicial());
    this.aplicado = this.valorInicial().trim();
  }

  protected alEscribir(valor: string): void {
    this.texto.set(valor);
    this.entrada$.next(valor);
  }

  protected confirmar(): void {
    this.entrada$.next(this.texto()); // cancela la espera pendiente...
    this.emitir(this.texto().trim()); // ...y aplica ya
  }

  protected limpiar(): void {
    this.texto.set('');
    this.entrada$.next('');
  }

  private emitir(valor: string): void {
    if (valor === this.aplicado) return;
    this.aplicado = valor;
    this.buscar.emit(valor);
  }
}
