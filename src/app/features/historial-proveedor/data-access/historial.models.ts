import { ComprasResumen } from '../../clientes/data-access/cliente.models';
import { HistorialZonaResponse } from '../../proveedores/data-access/proveedor.models';

/**
 * Fuente: HistorialProveedorController.java (docs/ENDPOINTS.md, «Historial consolidado»). Solo lectura: el servidor decide qué secciones
 * recibe cada rol y calcula todos los totales; el panel solo los muestra.
 */
export type SeccionHistorial = 'ENTREGAS' | 'CALIDAD' | 'PAGOS' | 'ZONAS';

export interface EntregasResumen {
  total: number;
  litrosRecibidos: number;
  litrosEfectivos: number;
  primeraEntrega: string | null;
  ultimaEntrega: string | null;
  conCorreccion: number;
  sinZona: number;
}

export interface CalidadResumen {
  analizadas: number;
  sinAnalisis: number;
  aprobadas: number;
  observadas: number;
  rechazadas: number;
  alertas: number;
  conPrecioDeCalidad: number;
}

export interface PagosResumen {
  liquidaciones: number;
  litrosLiquidados: number;
  totalOriginal: number;
  totalReconocido: number;
  ajusteCalidad: number;
  ajustesLitros: number;
  totalConAjustes: number;
  pagado: number;
  saldoLiquidaciones: number;
  adelantosSinAplicar: number;
  /** Negativo = a favor del proveedor. */
  saldoNeto: number;
  entregasSinLiquidar: number;
  litrosSinLiquidar: number;
}

export interface HistorialResumenResponse {
  proveedorId: string;
  proveedorNombre: string;
  zonaActualNombre: string | null;
  /** Las secciones que el rol puede ver; una sección no autorizada llega nula. */
  secciones: SeccionHistorial[];
  entregas: EntregasResumen | null;
  calidad: CalidadResumen | null;
  pagos: PagosResumen | null;
  zonas: HistorialZonaResponse[] | null;
  /** Fase H (solo ADMIN): lo que el proveedor compró como comprador. No cambia sus liquidaciones de leche. */
  compras?: ComprasResumen | null;
}

export interface CalidadEntrega {
  resultado: string | null;
  folio: string | null;
  analizadoEn: string | null;
  analisis: number;
  alertas: number;
  precioPropio: boolean;
}

export interface LiquidacionEntrega {
  pagoId: string;
  semanaInicio: string;
  semanaFin: string;
  litrosLiquidados: number;
  precioAplicado: number;
  /** litros liquidados × precio aplicado SIN redondear; el total del pago se redondea una sola vez. */
  importe: number;
}

export interface HistorialEntregaResponse {
  id: string;
  fechaHora: string;
  litrosOriginales: number;
  litrosEfectivos: number;
  corregida: boolean;
  /** Zona del proveedor cuando entregó; nula si no se pudo determinar. */
  zonaNombre: string | null;
  calidad: CalidadEntrega | null;
  liquidacion: LiquidacionEntrega | null;
}

export function tieneSeccion(resumen: HistorialResumenResponse | null, seccion: SeccionHistorial): boolean {
  return !!resumen && resumen.secciones.includes(seccion);
}
