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

/** Quién puede comprar a ese tipo: cualquiera, un cliente habilitado para él o un proveedor del padrón. */
export type ReglaComprador = 'CUALQUIERA' | 'CLIENTE_HABILITADO' | 'PROVEEDOR_PADRON';

export const ETIQUETAS_REGLA: Record<ReglaComprador, string> = {
  CUALQUIERA: 'Cualquiera (cliente, proveedor o cliente varios)',
  CLIENTE_HABILITADO: 'Un cliente habilitado para este tipo',
  PROVEEDOR_PADRON: 'Un proveedor del padrón'
};

export interface CrearTipoPrecioRequest {
  nombre: string;
  codigo?: string;
  descripcion?: string;
  reglaComprador: ReglaComprador;
  motivo: string;
}

export interface EditarTipoPrecioRequest {
  nombre: string;
  descripcion?: string;
  motivo: string;
}

export interface TipoPrecioResponse {
  codigo: TipoClienteVenta;
  nombre: string;
  descripcion: string;
  activo: boolean;
  protegido: boolean;
  reglaComprador: ReglaComprador;
  ultimoCambio: UltimoCambioTipoPrecio | null;
}
