import { TipoClienteVenta } from '../../ventas/data-access/venta.models';

/**
 * Fuente: docs/CONTRATOS.md, TipoPrecioDtos.java. Etapa 1: se activan y desactivan los tres tipos que ya existen. `protegido` = no se puede
 * desactivar (catálogo público y reservas dependen de él). Un tipo desactivado no se ofrece en operaciones nuevas; lo ya registrado no cambia.
 */
export interface UltimoCambioTipoPrecio {
  activo: boolean;
  motivo: string;
  usuarioNombre: string | null;
  creadoEn: string;
}

export interface TipoPrecioResponse {
  codigo: TipoClienteVenta;
  nombre: string;
  descripcion: string;
  activo: boolean;
  protegido: boolean;
  ultimoCambio: UltimoCambioTipoPrecio | null;
}
