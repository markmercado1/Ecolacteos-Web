import { Injectable, computed, inject, signal } from '@angular/core';
import { CatalogoApi } from '../api/catalogo.api';
import { PresentacionCatalogo, ProductoCatalogo } from '../api/catalogo.models';
import { errorAmigable } from '../api/http-error';

export type EstadoCarga = 'inicial' | 'cargando' | 'listo' | 'error';

/** El servidor guarda el catálogo en caché ~30 s; no tiene sentido pedirlo más seguido que eso. */
const VIGENCIA_MS = 30_000;

/**
 * Catálogo público compartido por todas las páginas. Nunca inventa productos: si falla la petición queda en estado
 * «error» con posibilidad de reintento y la lista vacía.
 */
@Injectable({ providedIn: 'root' })
export class CatalogoStore {
  private readonly api = inject(CatalogoApi);
  private cargadoEn = 0;

  readonly productos = signal<ProductoCatalogo[]>([]);
  readonly estado = signal<EstadoCarga>('inicial');
  readonly error = signal<string | null>(null);

  readonly presentaciones = computed(() => {
    const mapa = new Map<string, { producto: ProductoCatalogo; presentacion: PresentacionCatalogo }>();
    for (const producto of this.productos()) {
      for (const presentacion of producto.presentaciones) mapa.set(presentacion.id, { producto, presentacion });
    }
    return mapa;
  });

  /** Carga el catálogo si aún no está o si ya pasó su vigencia. `forzar` ignora la vigencia (botón «Reintentar»). */
  cargar(forzar = false): void {
    if (this.estado() === 'cargando') return;
    const vigente = this.estado() === 'listo' && Date.now() - this.cargadoEn < VIGENCIA_MS;
    if (vigente && !forzar) return;
    this.estado.set('cargando');
    this.error.set(null);
    this.api.listar().subscribe({
      next: (respuesta) => {
        this.productos.set(respuesta.productos);
        this.cargadoEn = Date.now();
        this.estado.set('listo');
      },
      error: (e) => {
        this.error.set(errorAmigable(e).mensaje);
        this.estado.set('error');
      }
    });
  }

  producto(id: string): ProductoCatalogo | undefined {
    return this.productos().find((p) => p.id === id);
  }
}
