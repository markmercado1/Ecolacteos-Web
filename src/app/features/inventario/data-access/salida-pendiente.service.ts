import { Injectable, inject } from '@angular/core';
import { TokenStoreService } from '../../../core/auth/token-store.service';
import { SalidaInventarioRequest } from './inventario.models';

/** Conserva la misma operación al cerrar/reabrir el diálogo o recargar esta pestaña. */
@Injectable({ providedIn: 'root' })
export class SalidaPendienteService {
  private readonly sesion = inject(TokenStoreService);

  private clave(tipo: string, id: string): string {
    return `ecolacteos.salida.v1:${this.sesion.usuario()?.id}:${tipo}:${id}`;
  }

  leer(tipo: string, id: string): SalidaInventarioRequest | null {
    const valor = sessionStorage.getItem(this.clave(tipo, id));
    return valor ? JSON.parse(valor) as SalidaInventarioRequest : null;
  }

  guardar(tipo: string, id: string, solicitud: SalidaInventarioRequest): void {
    // Si el navegador no permite conservar el identificador, no se envía la operación.
    sessionStorage.setItem(this.clave(tipo, id), JSON.stringify(solicitud));
  }

  resolver(tipo: string, id: string): void {
    sessionStorage.removeItem(this.clave(tipo, id));
  }
}
