import { Injectable, inject } from '@angular/core';
import { Observable, map, tap } from 'rxjs';
import { DescargaArchivos } from '../../../shared/util/descarga-archivos';
import { VentasApi } from './ventas.api';

/**
 * Entrega el comprobante en PDF de una venta: imprimirlo directo, guardarlo o abrirlo en otra pestaña. El PDF lo arma el servidor
 * (GET /api/ventas/{id}/comprobante) y se descarga con la sesión como Blob. Vive en un servicio para que las pruebas lo reemplacen:
 * el entorno de pruebas no puede abrir ventanas ni imprimir.
 */
@Injectable({ providedIn: 'root' })
export class ComprobanteVentaService {
  private readonly api = inject(VentasApi);
  private readonly descarga = inject(DescargaArchivos);

  /** Nombre del archivo: el número del comprobante (NV01-00000041) o, sin él, «venta». */
  nombreArchivo(comprobante: string | null | undefined): string {
    return `${comprobante?.trim() || 'venta'}.pdf`;
  }

  /** Imprime el comprobante sin salir de la página: carga el PDF en un marco oculto y abre el diálogo de impresión. */
  imprimir(id: string): Observable<void> {
    return this.api.comprobante(id).pipe(
      tap((pdf) => this.imprimirPdf(pdf)),
      map(() => undefined)
    );
  }

  descargar(id: string, comprobante: string | null | undefined): Observable<void> {
    return this.api.comprobante(id).pipe(
      tap((pdf) => this.descarga.guardar(pdf, this.nombreArchivo(comprobante))),
      map(() => undefined)
    );
  }

  /** Imprime un PDF ya descargado. Si el navegador no deja imprimir desde el marco, lo abre en otra pestaña para imprimirlo desde ahí. */
  imprimirPdf(pdf: Blob): void {
    const url = URL.createObjectURL(pdf);
    const marco = document.createElement('iframe');
    marco.setAttribute('aria-hidden', 'true');
    marco.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden';
    const limpiar = () => {
      marco.remove();
      URL.revokeObjectURL(url);
    };
    marco.onload = () => {
      try {
        marco.contentWindow?.focus();
        marco.contentWindow?.print();
        setTimeout(limpiar, 60_000);
      } catch {
        limpiar();
        const nueva = URL.createObjectURL(pdf);
        window.open(nueva, '_blank', 'noopener');
        setTimeout(() => URL.revokeObjectURL(nueva), 60_000);
      }
    };
    marco.src = url;
    document.body.appendChild(marco);
  }
}
