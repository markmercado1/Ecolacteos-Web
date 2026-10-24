/**
 * Fuente: PagoProveedorController.java (docs/ENDPOINTS.md, «Pagos efectivos»). Es el dinero realmente entregado al proveedor; el pago/liquidación
 * (PagoResponse) sigue siendo la deuda. Los saldos los calcula el servidor: el panel no los recalcula.
 */

export type ModalidadPagoProveedor = 'EFECTIVO' | 'TRANSFERENCIA' | 'DEPOSITO';
export type EstadoPagoProveedor = 'REGISTRADO' | 'ANULADO';
/** PENDIENTE (nada aplicado) | PARCIAL | PAGADO (saldo 0) | SALDO_A_FAVOR (saldo negativo). */
export type EstadoSaldoPago = 'PENDIENTE' | 'PARCIAL' | 'PAGADO' | 'SALDO_A_FAVOR';

export const MODALIDADES: { valor: ModalidadPagoProveedor; etiqueta: string }[] = [
  { valor: 'EFECTIVO', etiqueta: 'Efectivo' },
  { valor: 'TRANSFERENCIA', etiqueta: 'Transferencia' },
  { valor: 'DEPOSITO', etiqueta: 'Depósito' }
];

export interface AplicacionPagoResponse {
  id: string;
  pagoId: string;
  semanaInicio: string;
  semanaFin: string;
  monto: number;
  usuarioNombre: string;
  creadoEn: string;
}

export interface PagoProveedorResponse {
  id: string;
  uuidCliente: string;
  proveedorId: string;
  proveedorNombre: string;
  fechaHora: string;
  modalidad: ModalidadPagoProveedor;
  monto: number;
  concepto: string | null;
  banco: string | null;
  nroOperacion: string | null;
  nroRecibo: string | null;
  observacion: string | null;
  usuarioNombre: string;
  estado: EstadoPagoProveedor;
  anuladoMotivo: string | null;
  anuladoPorNombre: string | null;
  anuladoEn: string | null;
  /** Suma de sus aplicaciones. */
  aplicado: number;
  /** Lo que aún puede aplicarse (0 si está anulado). */
  sinAplicar: number;
  aplicaciones: AplicacionPagoResponse[];
}

export interface AplicacionPagoRequest {
  pagoId: string;
  monto: number;
}

export interface PagoProveedorRequest {
  /** Lo genera quien registra: reenviar la misma solicitud devuelve el pago ya registrado (200), no crea otro. */
  uuidCliente: string;
  proveedorId: string;
  modalidad: ModalidadPagoProveedor;
  monto: number;
  concepto?: string;
  banco?: string;
  nroOperacion?: string;
  nroRecibo?: string;
  observacion?: string;
  aplicaciones?: AplicacionPagoRequest[];
}

export interface SaldoPagoResponse {
  pagoId: string;
  proveedorId: string;
  semanaInicio: string;
  semanaFin: string;
  totalAPagar: number;
  ajustesLitros: number;
  totalConAjustes: number;
  aplicado: number;
  /** Negativo = a favor del proveedor. */
  saldo: number;
  estado: EstadoSaldoPago;
}

export interface SaldoProveedorResponse {
  proveedorId: string;
  proveedorNombre: string;
  liquidaciones: SaldoPagoResponse[];
  saldoLiquidaciones: number;
  adelantosSinAplicar: number;
  saldoNeto: number;
}

export function etiquetaModalidad(modalidad: string): string {
  return MODALIDADES.find((m) => m.valor === modalidad)?.etiqueta ?? modalidad;
}

export function etiquetaEstadoSaldo(estado: string): string {
  switch (estado) {
    case 'PENDIENTE':
      return 'Pendiente';
    case 'PARCIAL':
      return 'Pago parcial';
    case 'PAGADO':
      return 'Pagado';
    case 'SALDO_A_FAVOR':
      return 'Saldo a favor';
    default:
      return estado;
  }
}

/** Transferencia y depósito exigen banco y número de operación (el servidor también lo exige); el efectivo no. */
export function exigeDatosBancarios(modalidad: string): boolean {
  return modalidad !== 'EFECTIVO';
}
