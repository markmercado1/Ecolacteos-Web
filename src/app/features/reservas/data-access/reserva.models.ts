/** Fuente: EstadoReserva.java. `VENCIDA` no se escribe en la base: el servidor la calcula y siempre informa el estado efectivo. */
export type EstadoReserva = 'PENDIENTE' | 'CONFIRMADA' | 'RECHAZADA' | 'CANCELADA' | 'VENCIDA' | 'RETIRADA';

/** Fuente: TipoEventoReserva.java. */
export type TipoEventoReserva =
  | 'CREADA' | 'PRECIOS_RECOTIZADOS' | 'PRECIO_ACEPTADO' | 'CONFIRMADA' | 'RECHAZADA' | 'CANCELADA' | 'RETIRADA';

/** Fuente: AceptacionPrecioRequest.java. */
export type MedioAceptacion = 'TELEFONO' | 'WHATSAPP' | 'PRESENCIAL' | 'OTRO';

/**
 * Fuente: docs/CONTRATOS.md (Fase 4), ReservaResumenResponse.java. Una fila del listado
 * (GET /api/reservas). `total` es null mientras alguna línea tenga «Precio a confirmar».
 * `sinCobertura` lo calcula el servidor (solo reservas que aún comprometen unidades).
 */
export interface ReservaResumenResponse {
  id: string;
  codigo: string;
  estado: EstadoReserva;
  nombreCliente: string;
  telefono: string;
  fechaRetiro: string;
  creadoEn: string;
  expiraEn: string;
  unidades: number;
  total: number | null;
  precioAConfirmar: boolean;
  requiereAceptacion: boolean;
  precioAceptado: boolean;
  sinCobertura: boolean;
}

export interface LineaReservaResponse {
  presentacionId: string;
  producto: string;
  presentacion: string;
  unidadConteo: string;
  cantidad: number;
  /** null = «Precio a confirmar». */
  precioUnitario: number | null;
  subtotal: number | null;
}

/** Constancia de aceptación del importe por el cliente. Todos los campos son null si aún no se registró. */
export interface AceptacionReserva {
  totalAceptado: number | null;
  aceptadoEn: string | null;
  medio: MedioAceptacion | null;
  nota: string | null;
  registradoPor: string | null;
}

export interface EventoReserva {
  tipo: TipoEventoReserva;
  usuario: string | null;
  motivo: string | null;
  creadoEn: string;
}

/** Fuente: docs/CONTRATOS.md (Fase 4), ReservaResponse.java (GET /api/reservas/{id} y cada acción sobre la reserva). */
export interface ReservaResponse {
  id: string;
  codigo: string;
  estado: EstadoReserva;
  nombreCliente: string;
  telefono: string;
  correo: string | null;
  notaCliente: string | null;
  fechaRetiro: string;
  fechaMaximaRetiro: string;
  creadoEn: string;
  expiraEn: string;
  total: number | null;
  precioAConfirmar: boolean;
  requiereAceptacion: boolean;
  aceptacion: AceptacionReserva;
  sinCobertura: boolean;
  ventaId: string | null;
  lineas: LineaReservaResponse[];
  eventos: EventoReserva[];
}

export interface AceptacionPrecioRequest {
  medio: MedioAceptacion;
  nota?: string;
}

export interface FiltroReservas {
  estado?: EstadoReserva;
  fechaRetiro?: string;
  telefono?: string;
  codigo?: string;
  /** Cliente, teléfono o código (contiene, sin acentos ni mayúsculas), entre todas las reservas. */
  busqueda?: string;
  page: number;
  size: number;
}
