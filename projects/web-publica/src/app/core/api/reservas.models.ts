/** Fuente: ReservaPublicaResponse.java, CrearReservaRequest.java, ConsultaReservaRequest.java, ReglasReservaPublicaResponse.java. */
export type EstadoReserva = 'PENDIENTE' | 'CONFIRMADA' | 'RECHAZADA' | 'CANCELADA' | 'VENCIDA' | 'RETIRADA';

export interface LineaReservaRequest {
  presentacionId: string;
  cantidad: number;
}

export interface CrearReservaRequest {
  /** Clave de idempotencia: reenviar la misma solicitud nunca crea dos reservas. */
  uuidCliente: string;
  nombreCliente: string;
  telefono: string;
  correo?: string;
  /** yyyy-MM-dd */
  fechaRetiro: string;
  nota?: string;
  lineas: LineaReservaRequest[];
}

export interface ConsultaReservaRequest {
  codigo: string;
  telefono: string;
}

export interface LineaReservaPublica {
  presentacionId: string;
  producto: string;
  presentacion: string;
  unidadConteo: string;
  cantidad: number;
  precioUnitario: number | null;
  subtotal: number | null;
}

export interface ReservaPublica {
  codigo: string;
  estado: EstadoReserva;
  fechaRetiro: string;
  fechaMaximaRetiro: string;
  /** Hasta cuándo una solicitud pendiente retiene las unidades si nadie la atiende (hora de Lima, sin zona). */
  expiraEn: string;
  precioAConfirmar: boolean;
  /** null mientras alguna línea tenga «Precio a confirmar». */
  total: number | null;
  lineas: LineaReservaPublica[];
}

export interface ReglasReserva {
  /** Fechas de retiro (yyyy-MM-dd) que el servidor aceptaría ahora. */
  fechasDisponibles: string[];
  maxUnidades: number;
  horasPendiente: number;
}
