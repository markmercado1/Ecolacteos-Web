import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { throwError } from 'rxjs';
import { environment } from '../../../environments/environment';
import { PaginaResponse } from '../../shared/models/pagina-response';
import { FiltroPagina, paramsDePagina } from '../../shared/util/paginacion';

export interface Acopio {
  id: string;
  uuidCliente: string;
  proveedorId: string;
  proveedorNombre: string;
  unidadId: string;
  fechaHora: string;
  litros: number;
  gpsLat: number | null;
  gpsLng: number | null;
  motivoObservacion: string | null;
  litrosPorVoz: boolean | null;
  sincronizadoEn: string | null;
  fotoUrl: string | null;
  disponibleParaLote: boolean | null;
  /** Jornada (recorrido) a la que pertenece este acopio, o null si se capturó sin jornada activa. */
  jornadaId: string | null;
}

/** Fila liviana dentro de JornadaDetalle.acopios (GET /api/jornadas/{id}): sin GPS ni foto. */
export interface AcopioDeJornada {
  registroAcopioId: string;
  proveedorId: string;
  proveedorNombre: string;
  fechaHora: string;
  litros: number;
}

/** Respuesta de GET /api/jornadas/{id}, ya usada por RECEPCION: trae los acopios de la jornada en orden
 * cronológico (findByJornadaIdOrderByFechaHoraAsc del backend). */
export interface JornadaDetalle {
  id: string;
  uuidCliente: string;
  estado: string;
  unidadId: string;
  unidadPlaca: string;
  acopiadorId: string;
  acopiadorNombre: string;
  horaInicio: string;
  horaFin: string | null;
  litrosEsperados: number;
  proveedoresVisitados: string[];
  acopios: AcopioDeJornada[];
}

export interface FiltroAcopios {
  fecha: string;
  zonaId?: string;
  /** true = solo registros sin ningún análisis de calidad. Ausente/false NO filtra (no significa "solo analizados"). */
  sinAnalisis?: boolean;
}

/** Filtros del listado paginado de la web: los mismos de FiltroAcopios más búsqueda (proveedor o placa) en el servidor. */
export interface FiltroAcopiosPaginado extends FiltroAcopios, FiltroPagina {
  busqueda?: string;
}

/**
 * Fila de GET /api/registros-acopio/por-jornada: una por jornada (o por entrega sin jornada activa,
 * `esJornada === false` y `clave === primerAcopioId`), agrupada en el servidor sobre TODO el filtro antes
 * de paginar. `fecha` es el primer acopio cronológico; placa y acopiador salen de la jornada (histórico real).
 */
export interface AcopioPorJornada {
  clave: string;
  esJornada: boolean;
  acopiadorNombre: string | null;
  placa: string | null;
  fecha: string;
  cantidad: number;
  totalLitros: number;
  primerAcopioId: string;
}

/** GET /api/registros-acopio/resumen-por-proveedor: totales globales del filtro (no de la página visible). */
export interface TotalAcopioProveedor {
  proveedorId: string;
  proveedorNombre: string;
  totalLitros: number;
  cantidad: number;
}

/** Resumen de GET /api/registros-acopio/proveedor/{proveedorId} (RF-TRA-01): historial liviano por proveedor. */
export interface RegistroAcopioResumen {
  id: string;
  fechaHora: string;
  litros: number;
  tieneObservacion: boolean;
  disponibleParaLote: boolean;
}

/** GET /api/registros-acopio/{id}/correcciones: RegistroAcopio es inmutable, la corrección se anexa. */
export interface CorreccionRegistro {
  id: string;
  registroAcopioId: string;
  litrosAnterior: number;
  litrosCorregido: number;
  motivo: string;
  usuarioNombre: string;
  creadoEn: string;
}

@Injectable({ providedIn: 'root' })
export class AcopiosApi {
  private readonly http = inject(HttpClient);
  private readonly base = environment.apiBaseUrl;
  /**
   * Lista completa del filtro, sin paginar. Contrato compartido con la app móvil; en la web solo la usa la
   * bandeja de Calidad (pendientes de análisis de un día). La pantalla de Acopios usa las variantes paginadas.
   */
  listar(filtro: FiltroAcopios) {
    return this.http.get<Acopio[]>(`${this.base}/registros-acopio`, { params: this.paramsDeFiltro(filtro) });
  }
  listarPaginado(filtro: FiltroAcopiosPaginado) {
    return this.http.get<PaginaResponse<Acopio>>(`${this.base}/registros-acopio/paginado`, {
      params: this.paramsPaginados(filtro),
    });
  }
  porJornada(filtro: FiltroAcopiosPaginado) {
    return this.http.get<PaginaResponse<AcopioPorJornada>>(`${this.base}/registros-acopio/por-jornada`, {
      params: this.paramsPaginados(filtro),
    });
  }
  resumenPorProveedor(filtro: FiltroAcopios) {
    return this.http.get<TotalAcopioProveedor[]>(`${this.base}/registros-acopio/resumen-por-proveedor`, {
      params: this.paramsDeFiltro(filtro),
    });
  }
  obtener(id: string) {
    return this.http.get<Acopio>(`${this.base}/registros-acopio/${encodeURIComponent(id)}`);
  }
  jornada(id: string) {
    return this.http.get<JornadaDetalle>(`${this.base}/jornadas/${encodeURIComponent(id)}`);
  }
  /** Variante paginada; GET /registros-acopio/proveedor/{id} (lista completa) queda para la app móvil. */
  porProveedor(proveedorId: string, filtro: FiltroPagina) {
    return this.http.get<PaginaResponse<RegistroAcopioResumen>>(
      `${this.base}/registros-acopio/proveedor/${encodeURIComponent(proveedorId)}/paginado`,
      { params: paramsDePagina(filtro) },
    );
  }
  correcciones(id: string) {
    return this.http.get<CorreccionRegistro[]>(
      `${this.base}/registros-acopio/${encodeURIComponent(id)}/correcciones`,
    );
  }
  foto(ruta: string) {
    // Solo el endpoint de archivos propio puede recibir el Bearer de la sesión.
    const base = new URL(this.base, globalThis.location?.origin ?? 'http://localhost');
    const url = new URL(ruta, base.origin);
    if (url.origin !== base.origin || !url.pathname.startsWith(`${base.pathname}/archivos/`)) {
      return throwError(() => new Error('La foto no pertenece al servidor de archivos.'));
    }
    return this.http.get(url.href, { responseType: 'blob' });
  }
  private paramsDeFiltro(filtro: FiltroAcopios, base = new HttpParams()) {
    let params = base.set('fecha', filtro.fecha);
    if (filtro.zonaId) params = params.set('zonaId', filtro.zonaId);
    if (filtro.sinAnalisis) params = params.set('sinAnalisis', true);
    return params;
  }
  private paramsPaginados(filtro: FiltroAcopiosPaginado) {
    let params = this.paramsDeFiltro(filtro, paramsDePagina(filtro));
    const busqueda = filtro.busqueda?.trim();
    if (busqueda) params = params.set('busqueda', busqueda);
    return params;
  }
}
