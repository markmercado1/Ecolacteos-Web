/**
 * Fase H: padrón VOLUNTARIO de clientes y comprador de una venta o reserva. Fuente: ClienteDtos.java, AvisoPrivacidadResponse.java.
 * Para VENTAS teléfonos, DNI, RUC y correo llegan enmascarados (`datosCompletos` = false); ADMIN los ve completos.
 */
export type TipoComprador = 'CLIENTE' | 'PROVEEDOR';
export type FormaAutorizacion = 'VERBAL_PRESENCIAL' | 'ESCRITO' | 'TELEFONICA' | 'DIGITAL';
export type MedioComercial = 'WHATSAPP' | 'SMS' | 'LLAMADA' | 'CORREO';
/**
 * Canal que el panel PROPONE al vender a esta ficha (V34). No es el tipo de cliente: el tipo (regular o mayorista, este solo lo habilita
 * ADMIN) decide si puede comprar a precio MAYORISTA; el canal habitual solo preselecciona. PROVEEDOR nunca es de un cliente.
 */
export type CanalHabitual = string;   // código de un tipo de precio del catálogo
export const ETIQUETAS_CANAL_HABITUAL: Record<string, string> = { PUBLICO: 'Público', MAYORISTA: 'Mayorista' };

export const MEDIOS_COMERCIALES: MedioComercial[] = ['WHATSAPP', 'SMS', 'LLAMADA', 'CORREO'];
export const ETIQUETAS_MEDIO: Record<MedioComercial, string> = { WHATSAPP: 'WhatsApp', SMS: 'SMS', LLAMADA: 'Llamada', CORREO: 'Correo' };
export const ETIQUETAS_FORMA: Record<FormaAutorizacion, string> = {
  VERBAL_PRESENCIAL: 'De palabra, en persona',
  ESCRITO: 'Por escrito',
  TELEFONICA: 'Por teléfono',
  DIGITAL: 'Por un medio digital'
};

export interface EstadoAutorizacion {
  vigente: boolean;
  estado: 'OTORGADO' | 'REVOCADO' | null;
  medios: MedioComercial[];
  forma: FormaAutorizacion | null;
  desde: string | null;
  avisoVersion: string | null;
  avisoCompleto: boolean;
}

/** Reservas VINCULADAS a la ficha, por estado efectivo (una vencida no cuenta como activa). */
export interface ResumenReservas {
  pendientes: number;
  confirmadas: number;
  activas: number;
  total: number;
  proximoRetiro: string | null;
}

export interface ClienteResponse {
  id: string;
  tipoPersona: 'NATURAL' | 'EMPRESA';
  nombre: string;
  razonSocial: string | null;
  dni: string | null;
  ruc: string | null;
  correo: string | null;
  telefonos: string[];
  mayorista: boolean;
  activo: boolean;
  fusionadoEnId: string | null;
  creadoEn: string;
  datosCompletos: boolean;
  registro: EstadoAutorizacion;
  comunicaciones: EstadoAutorizacion;
  canalHabitual: CanalHabitual;
  reservas: ResumenReservas;
  /** Tipos de precio para los que la ficha está habilitada (la bandera `mayorista` es solo uno de ellos). */
  tiposHabilitados: string[];
}

export interface ClienteRequest {
  tipoPersona?: 'NATURAL' | 'EMPRESA';
  nombre: string;
  telefono: string;
  correo?: string | null;
  dni?: string | null;
  ruc?: string | null;
  razonSocial?: string | null;
  autorizacionRegistro: { otorgada: boolean; forma: FormaAutorizacion };
  comunicaciones: { otorgada: boolean; medios: MedioComercial[]; forma: FormaAutorizacion } | null;
  avisoVersion: string;
  confirmadoSinCoincidencia: boolean;
  /** Solo ADMIN puede registrar la ficha ya habilitada como mayorista, con motivo. */
  mayorista?: boolean;
  motivoMayorista?: string | null;
  canalHabitual?: CanalHabitual;
}

export interface ClienteUpdateRequest {
  tipoPersona?: 'NATURAL' | 'EMPRESA';
  nombre: string;
  correo?: string | null;
  dni?: string | null;
  ruc?: string | null;
  razonSocial?: string | null;
  canalHabitual?: CanalHabitual;
}

export interface ComercialRequest {
  otorgada: boolean;
  medios?: MedioComercial[];
  forma: FormaAutorizacion;
  avisoVersion?: string;
  nota?: string | null;
}

export interface ConsentimientoResponse {
  finalidad: 'REGISTRO_CLIENTE' | 'COMUNICACIONES_COMERCIALES';
  estado: 'OTORGADO' | 'REVOCADO';
  medios: MedioComercial[];
  forma: FormaAutorizacion;
  avisoVersion: string;
  avisoCompleto: boolean;
  registradoPor: string | null;
  registradoEn: string;
  nota: string | null;
}

export interface FusionResponse {
  origenId: string;
  destinoId: string;
  motivo: string;
  usuario: string | null;
  ventasMovidas: number;
  reservasMovidas: number;
  telefonosAgregados: number;
  creadoEn: string;
}

export interface CompradorRef {
  tipo: TipoComprador;
  id: string;
}

/** Comprador tal como quedó en una venta (copia histórica) o en una reserva. tipo null + nombre = nombre dado en la reserva, sin ficha. */
export interface CompradorResumen {
  tipo: TipoComprador | null;
  id: string | null;
  nombre: string | null;
  ruc: string | null;
}

/** DOCUMENTO = misma persona; TELEFONO o NOMBRE = solo una pista: confirmar con el comprador. */
export type TipoCoincidencia = 'DOCUMENTO' | 'TELEFONO' | 'NOMBRE';

export interface CompradorSugerencia {
  tipo: TipoComprador;
  id: string;
  nombre: string;
  telefono: string | null;
  documento: string | null;
  mayorista: boolean;
  /** Tipos de precio (regla CLIENTE_HABILITADO) para los que la ficha está habilitada. Vacío para un proveedor. */
  tiposHabilitados: string[];
  activo: boolean;
  coincidencia: TipoCoincidencia;
  /** null para un proveedor. */
  canalHabitual: CanalHabitual | null;
}

export interface CoincidenciasRequest {
  telefono?: string | null;
  dni?: string | null;
  ruc?: string | null;
  nombre?: string | null;
}

export interface LineaCompra {
  producto: string;
  presentacion: string;
  cantidad: number;
  subtotal: number;
}

export interface CompraResponse {
  ventaId: string;
  fecha: string;
  canal: 'MAYORISTA' | 'PROVEEDOR' | 'PUBLICO';
  total: number;
  reservaId: string | null;
  reservaCodigo: string | null;
  lineas: LineaCompra[];
}

export interface ComprasResumen {
  anio: number;
  totalCompras: number;
  montoTotal: number;
  comprasAnio: number;
  montoAnio: number;
  ultimaCompra: string | null;
  desdeReserva: number;
}

export interface ReservaDeComprador {
  id: string;
  codigo: string;
  estado: string;
  fechaRetiro: string;
  total: number | null;
  ventaId: string | null;
}

export interface HistorialClienteResponse {
  compras: ComprasResumen;
  reservas: ReservaDeComprador[];
}

export interface AvisoPrivacidadResponse {
  version: string;
  completo: boolean;
  faltantes: string[];
  responsable: string | null;
  ruc: string | null;
  domicilio: string | null;
  contacto: string | null;
  avisoReserva: string[];
  avisoRegistro: string[];
  textoComunicaciones: string;
}

const ETIQUETAS_COINCIDENCIA: Record<TipoCoincidencia, string> = {
  DOCUMENTO: 'Mismo DNI/RUC',
  TELEFONO: 'Mismo teléfono: confirma con el comprador',
  NOMBRE: 'Nombre parecido: confirma con el comprador'
};

export function etiquetaCoincidencia(c: TipoCoincidencia): string {
  return ETIQUETAS_COINCIDENCIA[c];
}

/** Lo que se escribe en el buscador decide qué se busca: 9 dígitos = teléfono, 8 = DNI, 11 = RUC; si no, nombre. */
export function criterioDeBusqueda(texto: string): CoincidenciasRequest {
  const limpio = texto.trim();
  const digitos = limpio.replace(/[\s\-+.]/g, '');
  if (/^\d+$/.test(digitos)) {
    if (digitos.length === 8) return { dni: digitos };
    if (digitos.length === 11 && (digitos.startsWith('10') || digitos.startsWith('20'))) return { ruc: digitos };
    if (digitos.length >= 9) return { telefono: digitos.slice(-9) };
  }
  return { nombre: limpio };
}
