import { EstadoReserva, MedioAceptacion, TipoEventoReserva } from './reserva.models';

/** Textos y colores de presentación (no son reglas de negocio: el estado siempre viene del servidor). */
export const ETIQUETAS_ESTADO: Record<EstadoReserva, string> = {
  PENDIENTE: 'Pendiente',
  CONFIRMADA: 'Confirmada',
  RECHAZADA: 'Rechazada',
  CANCELADA: 'Cancelada',
  VENCIDA: 'Vencida',
  RETIRADA: 'Retirada'
};

/** Clase `.badge` global: verde (por defecto), amber, red, blue o gray. */
export const COLOR_ESTADO: Record<EstadoReserva, string> = {
  PENDIENTE: 'amber',
  CONFIRMADA: 'blue',
  RECHAZADA: 'gray',
  CANCELADA: 'gray',
  VENCIDA: 'red',
  RETIRADA: ''
};

export const ETIQUETAS_EVENTO: Record<TipoEventoReserva, string> = {
  CREADA: 'Solicitud recibida',
  PRECIOS_RECOTIZADOS: 'Precios recotizados',
  PRECIO_ACEPTADO: 'Precio aceptado por el cliente',
  CONFIRMADA: 'Reserva confirmada',
  RECHAZADA: 'Reserva rechazada',
  CANCELADA: 'Reserva cancelada',
  RETIRADA: 'Retiro registrado',
  COMPRADOR_VINCULADO: 'Comprador confirmado',
  COMPRADOR_DESVINCULADO: 'Comprador quitado'
};

export const ETIQUETAS_MEDIO: Record<MedioAceptacion, string> = {
  TELEFONO: 'Teléfono',
  WHATSAPP: 'WhatsApp',
  PRESENCIAL: 'Presencial',
  OTRO: 'Otro'
};

export const ESTADOS_FILTRABLES: EstadoReserva[] = ['PENDIENTE', 'CONFIRMADA', 'VENCIDA', 'RETIRADA', 'RECHAZADA', 'CANCELADA'];
