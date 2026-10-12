import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, input, output, signal } from '@angular/core';
import {
  BYTES_MAXIMOS_FOTO,
  TIPOS_FOTO_PERMITIDOS,
  prepararFoto,
  urlFotoCatalogo,
  validarTipoFoto
} from '../../data-access/foto-catalogo';

export interface FotoCambio {
  /** Foto elegida y ya preparada, pendiente de subir; null si no se eligió ninguna. */
  archivo: File | null;
  /** true si el usuario pidió quitar la foto que ya estaba guardada (y no eligió una nueva). */
  quitar: boolean;
}

/**
 * Campo de foto para los diálogos de producto y presentación. No sube nada por sí mismo: elige y prepara el
 * archivo (valida tipo, reduce tamaño) y avisa el cambio al diálogo, que lo envía cuando guarda la ficha.
 */
@Component({
  selector: 'app-foto-campo',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="foto-campo">
      <span class="etiqueta">{{ etiqueta() }}</span>
      <div class="vista">
        @if (vista(); as src) {
          <img [src]="src" alt="Vista previa de la foto" />
        } @else {
          <span class="sin-foto">Sin foto</span>
        }
      </div>
      <div class="acciones">
        <label class="btn small">
          {{ vista() ? 'Cambiar foto' : 'Elegir foto' }}
          <input
            type="file"
            class="archivo"
            [accept]="aceptar"
            [disabled]="procesando()"
            (change)="elegir($event)"
          />
        </label>
        @if (vista() || archivo()) {
          <button type="button" class="btn small" (click)="quitarFoto()">
            {{ archivo() ? 'Descartar selección' : 'Quitar foto' }}
          </button>
        }
      </div>
      @if (procesando()) {
        <p class="hint">Preparando la foto…</p>
      }
      @if (ayuda(); as texto) {
        <p class="hint">{{ texto }}</p>
      }
      @if (error(); as mensaje) {
        <p class="error" role="alert">{{ mensaje }}</p>
      }
    </div>
  `,
  styles: `
    .foto-campo {
      margin-bottom: var(--space-4);
    }
    .etiqueta {
      display: block;
      font-size: var(--font-size-sm);
      font-weight: 600;
      margin-bottom: var(--space-1);
    }
    .vista {
      width: 8rem;
      height: 8rem;
      display: flex;
      align-items: center;
      justify-content: center;
      border: 1px dashed var(--color-border);
      border-radius: var(--radius-control);
      overflow: hidden;
      margin-bottom: var(--space-2);
    }
    .vista img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
    .sin-foto {
      color: var(--color-text-muted);
      font-size: var(--font-size-sm);
    }
    .acciones {
      display: flex;
      gap: var(--space-2);
      flex-wrap: wrap;
    }
    .archivo {
      display: none;
    }
    .hint {
      color: var(--color-text-muted);
      font-size: var(--font-size-sm);
      margin: var(--space-1) 0 0;
    }
    .error {
      color: var(--color-danger);
      font-size: var(--font-size-sm);
      margin: var(--space-1) 0 0;
    }
  `
})
export class FotoCampo {
  readonly fotoUrl = input<string | null | undefined>(null);
  readonly etiqueta = input('Foto');
  readonly ayuda = input<string | null>(null);
  readonly cambio = output<FotoCambio>();

  protected readonly aceptar = TIPOS_FOTO_PERMITIDOS.join(',');
  protected readonly archivo = signal<File | null>(null);
  protected readonly quitar = signal(false);
  protected readonly previa = signal<string | null>(null);
  protected readonly error = signal<string | null>(null);
  protected readonly procesando = signal(false);

  /** Lo que se muestra: la selección pendiente, o la foto guardada (salvo que se haya pedido quitarla). */
  protected readonly vista = computed(
    () => this.previa() ?? (this.quitar() ? null : urlFotoCatalogo(this.fotoUrl()))
  );

  constructor() {
    inject(DestroyRef).onDestroy(() => this.liberarPrevia());
  }

  protected async elegir(evento: Event): Promise<void> {
    const entrada = evento.target as HTMLInputElement;
    const elegido = entrada.files?.[0];
    entrada.value = ''; // permite volver a elegir el mismo archivo
    if (!elegido) return;

    this.error.set(null);
    const problema = validarTipoFoto(elegido);
    if (problema) {
      this.error.set(problema);
      return;
    }
    this.procesando.set(true);
    const listo = await prepararFoto(elegido);
    this.procesando.set(false);
    if (listo.size > BYTES_MAXIMOS_FOTO) {
      this.error.set('La foto pesa más de 5 MB. Elige una más liviana.');
      return;
    }
    this.liberarPrevia();
    this.archivo.set(listo);
    this.quitar.set(false);
    this.previa.set(typeof URL.createObjectURL === 'function' ? URL.createObjectURL(listo) : null);
    this.emitir();
  }

  protected quitarFoto(): void {
    this.error.set(null);
    if (this.archivo()) {
      this.liberarPrevia();
      this.archivo.set(null);
    } else {
      this.quitar.set(true);
    }
    this.emitir();
  }

  private emitir(): void {
    this.cambio.emit({ archivo: this.archivo(), quitar: this.quitar() });
  }

  private liberarPrevia(): void {
    const actual = this.previa();
    if (actual && typeof URL.revokeObjectURL === 'function') URL.revokeObjectURL(actual);
    this.previa.set(null);
  }
}
