import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { Dialog } from '@angular/cdk/dialog';
import { AppError, mapHttpError } from '../../../../core/http/app-error';
import { ColumnaTabla, DataTableComponent } from '../../../../shared/ui/data-table/data-table';
import { ConfirmDialog } from '../../../../shared/ui/dialog/confirm-dialog';
import { ToastService } from '../../../../shared/ui/toast/toast.service';
import { ListaLocal } from '../../../../shared/util/lista-local';
import { ProveedoresCompraApi } from '../../data-access/proveedores-compra.api';
import { ProveedorCompraResponse } from '../../data-access/proveedor-compra.models';
import { ProveedorCompraFormDialog } from '../../ui/proveedor-compra-form-dialog/proveedor-compra-form-dialog';

/** Administración de proveedores de compra (solo ADMIN). La lista es pequeña: se busca y pagina en el cliente. */
@Component({
  selector: 'app-proveedores-compra-page',
  imports: [DataTableComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './proveedores-compra-page.html',
  styleUrl: './proveedores-compra-page.css'
})
export class ProveedoresCompraPage {
  private readonly api = inject(ProveedoresCompraApi);
  private readonly dialog = inject(Dialog);
  private readonly toast = inject(ToastService);

  protected readonly cargando = signal(true);
  protected readonly error = signal<AppError | null>(null);
  protected readonly proveedores = signal<ProveedorCompraResponse[]>([]);
  protected readonly lista = new ListaLocal(this.proveedores, {
    campos: (p) => [p.nombre, p.ruc, p.contacto ?? '', p.telefono ?? ''],
    id: (p) => p.id,
    destroyRef: inject(DestroyRef)
  });
  protected readonly columnas: ColumnaTabla[] = [
    { clave: 'nombre', etiqueta: 'Proveedor' },
    { clave: 'ruc', etiqueta: 'RUC' },
    { clave: 'categorias', etiqueta: 'Categorías' },
    { clave: 'contacto', etiqueta: 'Contacto' },
    { clave: 'acciones', etiqueta: '' }
  ];

  constructor() {
    this.cargar();
  }

  protected cargar(revelarId?: string): void {
    this.cargando.set(true);
    this.error.set(null);
    this.api.listar({ soloActivos: false }).subscribe({
      next: (lista) => {
        this.proveedores.set(lista);
        this.cargando.set(false);
        if (revelarId) this.lista.revelar(revelarId);
      },
      error: (e) => {
        this.error.set(mapHttpError(e));
        this.cargando.set(false);
      }
    });
  }

  protected nuevo(): void {
    const ref = this.dialog.open<ProveedorCompraResponse | undefined>(ProveedorCompraFormDialog, { ariaLabel: 'Nuevo proveedor de compra', data: {} });
    ref.closed.subscribe((r) => { if (r) { this.toast.exito(`Proveedor "${r.nombre}" creado.`); this.cargar(r.id); } });
  }

  protected editar(proveedor: ProveedorCompraResponse): void {
    const ref = this.dialog.open<ProveedorCompraResponse | undefined>(ProveedorCompraFormDialog, {
      ariaLabel: 'Editar proveedor de compra',
      data: { proveedor }
    });
    ref.closed.subscribe((r) => { if (r) { this.toast.exito(`Proveedor "${r.nombre}" actualizado.`); this.cargar(r.id); } });
  }

  protected desactivar(proveedor: ProveedorCompraResponse): void {
    const ref = this.dialog.open<boolean>(ConfirmDialog, {
      ariaLabel: 'Desactivar proveedor',
      data: {
        titulo: 'Desactivar proveedor',
        mensaje: `"${proveedor.nombre}" dejará de ofrecerse al registrar ingresos. Su historial se conserva y su RUC sigue reservado.`,
        etiquetaConfirmar: 'Desactivar',
        peligroso: true
      }
    });
    ref.closed.subscribe((confirmado) => {
      if (!confirmado) return;
      this.api.desactivar(proveedor.id).subscribe({
        next: () => { this.toast.exito('Proveedor desactivado.'); this.cargar(proveedor.id); },
        error: (e) => this.toast.error(mapHttpError(e).mensaje)
      });
    });
  }

  protected reactivar(proveedor: ProveedorCompraResponse): void {
    this.api.reactivar(proveedor.id).subscribe({
      next: () => { this.toast.exito('Proveedor reactivado.'); this.cargar(proveedor.id); },
      error: (e) => this.toast.error(mapHttpError(e).mensaje)
    });
  }
}
