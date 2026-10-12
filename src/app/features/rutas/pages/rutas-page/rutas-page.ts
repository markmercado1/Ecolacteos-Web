import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Dialog } from '@angular/cdk/dialog';
import { toSignal } from '@angular/core/rxjs-interop';
import { AppError, mapHttpError } from '../../../../core/http/app-error';
import { ConfirmDialog } from '../../../../shared/ui/dialog/confirm-dialog';
import { EmptyStateComponent } from '../../../../shared/ui/state/empty-state';
import { ErrorStateComponent } from '../../../../shared/ui/state/error-state';
import { LoadingStateComponent } from '../../../../shared/ui/state/loading-state';
import { ToastService } from '../../../../shared/ui/toast/toast.service';
import { ZonaResponse } from '../../../catalogos/data-access/zona.models';
import { ZonasApi } from '../../../catalogos/data-access/zonas.api';
import { ProveedorPublicoResponse } from '../../../proveedores/data-access/proveedor.models';
import { ProveedoresApi } from '../../../proveedores/data-access/proveedores.api';
import { RutaProveedorOrdenResponse } from '../../data-access/ruta.models';
import { RutasApi } from '../../data-access/rutas.api';

interface ParadaLocal {
  proveedorId: string;
  proveedorNombre: string;
  horaEstimada: string | null;
}

@Component({
  selector: 'app-rutas-page',
  imports: [LoadingStateComponent, ErrorStateComponent, EmptyStateComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './rutas-page.html',
  styleUrl: './rutas-page.css'
})
export class RutasPage {
  private readonly zonasApi = inject(ZonasApi);
  private readonly rutasApi = inject(RutasApi);
  private readonly proveedoresApi = inject(ProveedoresApi);
  private readonly dialog = inject(Dialog);
  private readonly toast = inject(ToastService);

  protected readonly zonas = toSignal(this.zonasApi.listarOperativo(), { initialValue: [] as ZonaResponse[] });
  private readonly proveedoresOperativos = toSignal(this.proveedoresApi.listarOperativo(), {
    initialValue: [] as ProveedorPublicoResponse[]
  });

  protected readonly zonaSeleccionada = signal('');
  protected readonly cargando = signal(false);
  protected readonly error = signal<AppError | null>(null);
  protected readonly guardando = signal(false);

  protected readonly paradas = signal<ParadaLocal[]>([]);
  private readonly ultimaVersionGuardada = signal('[]');
  protected readonly proveedorParaAgregar = signal('');
  protected readonly horaParaAgregar = signal('');

  protected readonly hayCambiosSinGuardar = computed(
    () => JSON.stringify(this.paradas()) !== this.ultimaVersionGuardada()
  );

  protected readonly proveedoresDisponibles = computed(() => {
    const zona = this.zonaSeleccionada();
    const yaEnRuta = new Set(this.paradas().map((p) => p.proveedorId));
    return this.proveedoresOperativos().filter((p) => p.zonaActualId === zona && !yaEnRuta.has(p.id));
  });

  protected seleccionarZona(zonaId: string): void {
    if (zonaId === this.zonaSeleccionada()) return;
    if (this.hayCambiosSinGuardar()) {
      const ref = this.dialog.open<boolean>(ConfirmDialog, {
        ariaLabel: 'Descartar cambios',
        data: {
          titulo: 'Cambios sin guardar',
          mensaje: 'Tienes cambios en la ruta actual sin guardar. Si cambias de zona, se descartan.',
          etiquetaConfirmar: 'Descartar y cambiar',
          peligroso: true
        }
      });
      ref.closed.subscribe((confirmado) => { if (confirmado) this.cargarZona(zonaId); });
      return;
    }
    this.cargarZona(zonaId);
  }

  private cargarZona(zonaId: string): void {
    this.zonaSeleccionada.set(zonaId);
    this.proveedorParaAgregar.set('');
    this.horaParaAgregar.set('');
    if (!zonaId) {
      this.paradas.set([]);
      this.ultimaVersionGuardada.set('[]');
      return;
    }
    this.cargando.set(true);
    this.error.set(null);
    this.rutasApi.listar(zonaId).subscribe({
      next: (ruta) => {
        this.aplicarRutaCargada(ruta);
        this.cargando.set(false);
      },
      error: (error) => {
        this.error.set(mapHttpError(error));
        this.cargando.set(false);
      }
    });
  }

  private aplicarRutaCargada(ruta: RutaProveedorOrdenResponse[]): void {
    const paradas: ParadaLocal[] = [...ruta]
      .sort((a, b) => a.orden - b.orden)
      .map((r) => ({ proveedorId: r.proveedorId, proveedorNombre: r.proveedorNombre, horaEstimada: r.horaEstimada }));
    this.paradas.set(paradas);
    this.ultimaVersionGuardada.set(JSON.stringify(paradas));
  }

  protected agregarParada(): void {
    const proveedorId = this.proveedorParaAgregar();
    const proveedor = this.proveedoresDisponibles().find((p) => p.id === proveedorId);
    if (!proveedor) return;
    this.paradas.update((actual) => [
      ...actual,
      { proveedorId: proveedor.id, proveedorNombre: proveedor.nombre, horaEstimada: this.horaParaAgregar() || null }
    ]);
    this.proveedorParaAgregar.set('');
    this.horaParaAgregar.set('');
  }

  protected quitarParada(indice: number): void {
    this.paradas.update((actual) => actual.filter((_, i) => i !== indice));
  }

  protected moverParada(indice: number, direccion: -1 | 1): void {
    const siguiente = indice + direccion;
    const actual = this.paradas();
    if (siguiente < 0 || siguiente >= actual.length) return;
    const copia = [...actual];
    [copia[indice], copia[siguiente]] = [copia[siguiente], copia[indice]];
    this.paradas.set(copia);
  }

  protected guardarRuta(): void {
    const zonaId = this.zonaSeleccionada();
    const paradas = this.paradas();
    if (!zonaId || paradas.length === 0 || this.guardando()) return;

    this.guardando.set(true);
    this.rutasApi
      .definir(zonaId, {
        items: paradas.map((p, i) => ({ proveedorId: p.proveedorId, orden: i + 1, horaEstimada: p.horaEstimada }))
      })
      .subscribe({
        next: (ruta) => {
          this.aplicarRutaCargada(ruta);
          this.guardando.set(false);
          this.toast.exito('Ruta guardada.');
        },
        error: (error) => {
          this.guardando.set(false);
          this.toast.error(mapHttpError(error).mensaje);
        }
      });
  }
}
