import { Injectable } from '@angular/core';

/**
 * Entrega un archivo recibido (Blob) al usuario como descarga del navegador. Vive en un servicio para que las pruebas lo
 * reemplacen: el entorno de pruebas no tiene `URL.createObjectURL` ni descargas reales.
 */
@Injectable({ providedIn: 'root' })
export class DescargaArchivos {
  guardar(archivo: Blob, nombre: string): void {
    const url = URL.createObjectURL(archivo);
    const enlace = document.createElement('a');
    enlace.href = url;
    enlace.download = nombre;
    enlace.rel = 'noopener';
    enlace.style.display = 'none';
    document.body.appendChild(enlace);
    enlace.click();
    enlace.remove();
    // El navegador ya inició la descarga; se libera el objeto un poco después.
    setTimeout(() => URL.revokeObjectURL(url), 30_000);
  }
}
