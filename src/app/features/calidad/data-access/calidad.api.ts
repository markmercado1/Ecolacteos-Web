import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import {
  AlertaAnomalia,
  AnalisisBandeja,
  AnalisisCalidad,
  PanelEconomico,
  PrediccionProveedor,
  ScoreConfianza,
} from './calidad.models';

/**
 * Fuente: docs/ENDPOINTS.md, AnalisisCalidadController.java (roles CALIDAD/ADMIN)
 * e InnovacionController.java (score/predicción/alertas: roles ADMIN/CALIDAD).
 * Solo lectura: el análisis se captura en el móvil/laboratorio, no desde la web.
 */
@Injectable({ providedIn: 'root' })
export class CalidadApi {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = environment.apiBaseUrl;

  bandeja(fecha: string): Observable<AnalisisBandeja[]> {
    const params = new HttpParams().set('fecha', fecha);
    return this.http.get<AnalisisBandeja[]>(`${this.baseUrl}/analisis-calidad/bandeja`, { params });
  }

  porFolio(folio: string): Observable<AnalisisCalidad[]> {
    return this.http.get<AnalisisCalidad[]>(`${this.baseUrl}/analisis-calidad/folio/${encodeURIComponent(folio)}`);
  }

  porRegistro(registroAcopioId: string): Observable<AnalisisCalidad[]> {
    return this.http.get<AnalisisCalidad[]>(
      `${this.baseUrl}/analisis-calidad/registro/${encodeURIComponent(registroAcopioId)}`,
    );
  }

  /** RF-INN-03 (reactiva): alertas de los últimos 30 días de una zona, fijo por el backend (sin parámetro). */
  alertasPorZona(zonaId: string): Observable<AlertaAnomalia[]> {
    const params = new HttpParams().set('zonaId', zonaId);
    return this.http.get<AlertaAnomalia[]>(`${this.baseUrl}/innovacion/alertas`, { params });
  }

  /** 404 si el proveedor no tiene histórico suficiente: falta de cálculo, nunca un score inventado. */
  score(proveedorId: string): Observable<ScoreConfianza> {
    return this.http.get<ScoreConfianza>(`${this.baseUrl}/innovacion/score/${encodeURIComponent(proveedorId)}`);
  }

  /** 404 si no hay predicción calculada aún para el proveedor. */
  prediccion(proveedorId: string): Observable<PrediccionProveedor> {
    return this.http.get<PrediccionProveedor>(`${this.baseUrl}/innovacion/prediccion/${encodeURIComponent(proveedorId)}`);
  }

  /**
   * Solo ADMIN (`hasRole('ADMIN')`, distinto de score/predicción/alertas que también permiten CALIDAD).
   * 404 si la zona no existe, o si esa zona todavía no tiene una proyección semanal calculada
   * (PanelEconomicoService no captura el 404 de ForecastingService.obtenerUltima): en ese caso el panel
   * completo de esa zona no está disponible, no solo el forecast.
   */
  panelEconomico(zonaId: string): Observable<PanelEconomico> {
    const params = new HttpParams().set('zonaId', zonaId);
    return this.http.get<PanelEconomico>(`${this.baseUrl}/innovacion/panel-economico`, { params });
  }
}
