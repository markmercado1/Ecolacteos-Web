import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { apiUrl } from './api-url';
import { AvisoPrivacidad, ConsultaReservaRequest, CrearReservaRequest, ReglasReserva, ReservaPublica } from './reservas.models';

/** Endpoints públicos de reservas (sin token). El cliente solo puede crear y consultar la PROPIA reserva. */
@Injectable({ providedIn: 'root' })
export class ReservasPublicasApi {
  private readonly http = inject(HttpClient);

  reglas(): Observable<ReglasReserva> {
    return this.http.get<ReglasReserva>(apiUrl('/catalogo/reservas/reglas'));
  }

  /** Fase H: aviso de datos personales vigente para el formulario de reserva. */
  aviso(): Observable<AvisoPrivacidad> {
    return this.http.get<AvisoPrivacidad>(apiUrl('/catalogo/privacidad'));
  }

  crear(solicitud: CrearReservaRequest): Observable<ReservaPublica> {
    return this.http.post<ReservaPublica>(apiUrl('/catalogo/reservas'), solicitud);
  }

  /** POST (y no GET) para que el teléfono no viaje en la URL. */
  consultar(datos: ConsultaReservaRequest): Observable<ReservaPublica> {
    return this.http.post<ReservaPublica>(apiUrl('/catalogo/reservas/consulta'), datos);
  }
}
