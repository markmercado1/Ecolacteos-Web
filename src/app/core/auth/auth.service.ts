import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { Observable, Subject, catchError, finalize, shareReplay, switchMap, tap, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';
import { TokenStoreService } from './token-store.service';
import {
  CambiarPasswordRequest,
  LoginRequest,
  LoginResponse,
  RefreshTokenRequest,
  UsuarioMeResponse
} from './auth.models';

/** Rutas públicas del backend: nunca llevan Bearer ni disparan renovación. */
export const AUTH_RUTAS_PUBLICAS = ['/auth/login', '/auth/refresh-token'];

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly tokenStore = inject(TokenStoreService);
  private readonly router = inject(Router);
  private readonly baseUrl = environment.apiBaseUrl;

  private refrescoCompartido: Observable<LoginResponse> | null = null;
  private renovacionProgramada: ReturnType<typeof setTimeout> | null = null;

  /** Emite cuando la sesión termina, para que los interceptores cancelen peticiones en curso. */
  readonly sesionTerminada$ = new Subject<void>();

  readonly usuario = this.tokenStore.usuario;
  readonly estaAutenticado = this.tokenStore.estaAutenticado;

  login(credenciales: LoginRequest): Observable<UsuarioMeResponse> {
    return this.http.post<LoginResponse>(`${this.baseUrl}/auth/login`, credenciales).pipe(
      switchMap((respuesta) =>
        this.http.get<UsuarioMeResponse>(`${this.baseUrl}/auth/me`, {
          headers: { Authorization: `Bearer ${respuesta.token}` }
        }).pipe(
          tap((usuario) => {
            const expiraEn = Date.now() + respuesta.expiraEnSegundos * 1000;
            this.tokenStore.establecer({
              token: respuesta.token,
              refreshToken: respuesta.refreshToken,
              expiraEn,
              refreshExpiraEn: Date.now() + respuesta.refreshExpiraEnSegundos * 1000,
              usuario
            });
            this.programarRenovacion(expiraEn);
          })
        )
      )
    );
  }

  /**
   * Se llama una vez al arrancar la app (ver provideAppInitializer en
   * app.config.ts). TokenStoreService ya restauró la sesión desde
   * localStorage de forma síncrona en su constructor si había una vigente;
   * aquí solo reprogramamos el temporizador de renovación para el tiempo que
   * quede. Si el token de acceso ya venció mientras la pestaña estaba
   * cerrada, el margen calculado es 0 y la renovación se dispara de
   * inmediato; si el refreshToken también venció, renovarSesion() la
   * rechaza y cierra la sesión igual que ante cualquier renovación fallida.
   */
  reanudarSesion(): void {
    const sesion = this.tokenStore.sesion();
    if (sesion) {
      this.programarRenovacion(sesion.expiraEn);
    }
  }

  me(): Observable<UsuarioMeResponse> {
    return this.http.get<UsuarioMeResponse>(`${this.baseUrl}/auth/me`).pipe(
      tap((usuario) => this.tokenStore.actualizarUsuario(usuario))
    );
  }

  cambiarPassword(datos: CambiarPasswordRequest): Observable<void> {
    return this.http.patch<void>(`${this.baseUrl}/auth/password`, datos);
  }

  /**
   * Renovación compartida: si ya hay una en curso, todos los llamantes (guards,
   * interceptor, temporizador) reciben el mismo resultado en vez de disparar
   * varias peticiones de refresh en paralelo.
   */
  renovarSesion(): Observable<LoginResponse> {
    if (this.refrescoCompartido) {
      return this.refrescoCompartido;
    }
    const refreshToken = this.tokenStore.refreshToken();
    if (!refreshToken) {
      return throwError(() => new Error('No hay refreshToken disponible.'));
    }
    const cuerpo: RefreshTokenRequest = { refreshToken };
    this.refrescoCompartido = this.http.post<LoginResponse>(`${this.baseUrl}/auth/refresh-token`, cuerpo).pipe(
      tap((respuesta) => {
        const expiraEn = Date.now() + respuesta.expiraEnSegundos * 1000;
        this.tokenStore.actualizarTokens({
          token: respuesta.token,
          refreshToken: respuesta.refreshToken,
          expiraEn,
          refreshExpiraEn: Date.now() + respuesta.refreshExpiraEnSegundos * 1000
        });
        this.programarRenovacion(expiraEn);
      }),
      catchError((error) => {
        this.logout('expirada');
        return throwError(() => error);
      }),
      finalize(() => {
        this.refrescoCompartido = null;
      }),
      shareReplay(1)
    );
    return this.refrescoCompartido;
  }

  logout(motivo?: 'expirada'): void {
    this.cancelarRenovacion();
    this.tokenStore.limpiar();
    this.sesionTerminada$.next();
    this.router.navigate(['/login'], motivo ? { queryParams: { motivo } } : undefined);
  }

  /**
   * Renueva antes de que expire el token de acceso mientras la pestaña sigue
   * abierta: dispara al 80% del tiempo que quede hasta expiraEn (timestamp
   * absoluto), para dejar margen de red antes del vencimiento real. Si
   * expiraEn ya pasó (p. ej. la pestaña estuvo cerrada más de lo que duraba
   * el token), el margen calculado es 0 y renueva de inmediato.
   */
  private programarRenovacion(expiraEn: number): void {
    this.cancelarRenovacion();
    const restanteMs = expiraEn - Date.now();
    const margenMs = Math.max(restanteMs * 0.8, 0);
    this.renovacionProgramada = setTimeout(() => {
      this.renovarSesion().subscribe({ error: () => undefined });
    }, margenMs);
  }

  private cancelarRenovacion(): void {
    if (this.renovacionProgramada) {
      clearTimeout(this.renovacionProgramada);
      this.renovacionProgramada = null;
    }
  }
}
