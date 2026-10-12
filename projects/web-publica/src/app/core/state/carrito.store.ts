import { Injectable, computed, signal } from '@angular/core';
import { LineaReservaRequest } from '../api/reservas.models';

const CLAVE = 'ecolacteos.publico.reserva.v1';
/** Tope de líneas que admite el backend por reserva. */
export const MAX_LINEAS = 10;

/**
 * Borrador de la reserva: las presentaciones elegidas y sus cantidades. Se conserva en sessionStorage para sobrevivir a una
 * recarga de la página (si el navegador lo bloquea, funciona igual en memoria). No guarda datos personales.
 */
@Injectable({ providedIn: 'root' })
export class CarritoStore {
  readonly lineas = signal<LineaReservaRequest[]>(this.leer());
  readonly cantidadLineas = computed(() => this.lineas().length);

  /**
   * Agrega una presentación. `tope` es el máximo de unidades que el catálogo informa como disponibles (solo cuando quedan pocas);
   * si se supera se limita a ese máximo ('limitada') o no se agrega nada si ya se tiene todo ('tope'). Es una ayuda de pantalla:
   * el servidor valida siempre al enviar.
   */
  agregar(presentacionId: string, cantidad = 1, tope: number | null = null): 'agregada' | 'sumada' | 'limitada' | 'tope' | 'llena' {
    const actuales = this.lineas();
    const existente = actuales.find((l) => l.presentacionId === presentacionId);
    const previa = existente?.cantidad ?? 0;
    let nueva = previa + cantidad;
    let limitada = false;
    if (tope !== null && nueva > tope) {
      nueva = tope;
      limitada = true;
    }
    if (nueva <= previa) return 'tope';
    if (existente) {
      this.fijar(actuales.map((l) => (l === existente ? { ...l, cantidad: nueva } : l)));
      return limitada ? 'limitada' : 'sumada';
    }
    if (actuales.length >= MAX_LINEAS) return 'llena';
    this.fijar([...actuales, { presentacionId, cantidad: nueva }]);
    return limitada ? 'limitada' : 'agregada';
  }

  cambiarCantidad(presentacionId: string, cantidad: number): void {
    const valida = Number.isFinite(cantidad) ? Math.max(1, Math.floor(cantidad)) : 1;
    this.fijar(this.lineas().map((l) => (l.presentacionId === presentacionId ? { ...l, cantidad: valida } : l)));
  }

  quitar(presentacionId: string): void {
    this.fijar(this.lineas().filter((l) => l.presentacionId !== presentacionId));
  }

  vaciar(): void {
    this.fijar([]);
  }

  private fijar(lineas: LineaReservaRequest[]): void {
    this.lineas.set(lineas);
    try {
      sessionStorage.setItem(CLAVE, JSON.stringify(lineas));
    } catch {
      /* almacenamiento bloqueado: el borrador sigue en memoria */
    }
  }

  private leer(): LineaReservaRequest[] {
    try {
      const crudo = sessionStorage.getItem(CLAVE);
      const datos: unknown = crudo ? JSON.parse(crudo) : [];
      if (!Array.isArray(datos)) return [];
      return datos
        .filter((l): l is LineaReservaRequest => typeof l?.presentacionId === 'string' && Number.isInteger(l?.cantidad) && l.cantidad >= 1)
        .slice(0, MAX_LINEAS);
    } catch {
      return [];
    }
  }
}
