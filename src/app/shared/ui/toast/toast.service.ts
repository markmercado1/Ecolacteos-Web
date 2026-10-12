import { Injectable, signal } from '@angular/core';

export type TipoAviso = 'info' | 'exito' | 'error';

export interface Aviso {
  id: number;
  mensaje: string;
  tipo: TipoAviso;
}

@Injectable({ providedIn: 'root' })
export class ToastService {
  private siguienteId = 0;
  private readonly avisosSignal = signal<Aviso[]>([]);
  readonly avisos = this.avisosSignal.asReadonly();

  mostrar(mensaje: string, tipo: TipoAviso = 'info', duracionMs = 4000): void {
    const id = ++this.siguienteId;
    this.avisosSignal.update((actuales) => [...actuales, { id, mensaje, tipo }]);
    setTimeout(() => this.cerrar(id), duracionMs);
  }

  exito(mensaje: string): void {
    this.mostrar(mensaje, 'exito');
  }

  error(mensaje: string): void {
    this.mostrar(mensaje, 'error');
  }

  cerrar(id: number): void {
    this.avisosSignal.update((actuales) => actuales.filter((a) => a.id !== id));
  }
}
