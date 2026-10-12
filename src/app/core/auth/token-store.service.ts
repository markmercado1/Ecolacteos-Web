import { Injectable, computed, signal } from '@angular/core';
import { Sesion } from './auth.models';

const CLAVE_ALMACENAMIENTO = 'ecolacteos.sesion.v1';

/**
 * Guarda la sesión en memoria (signal) y, en paralelo, en localStorage para
 * sobrevivir a un F5 o a cerrar y volver a abrir el navegador (decisión
 * explícita del usuario que reemplaza el default anterior de "solo memoria").
 *
 * Solo se guardan el token de acceso, el refreshToken y los datos de
 * /auth/me: nunca la contraseña. El riesgo asumido es XSS (localStorage es
 * legible por cualquier script que se ejecute en la página); no hay forma de
 * evitarlo sin que el backend emita cookies HttpOnly, algo que este contrato
 * no ofrece y que esta fase no puede tocar (no se modifica el backend).
 * Cerrar sesión borra la entrada; si el refreshToken ya venció, la propia
 * renovación fallida limpia el almacenamiento (ver AuthService.renovarSesion).
 */
@Injectable({ providedIn: 'root' })
export class TokenStoreService {
  private readonly sesionSignal = signal<Sesion | null>(this.leerAlmacenamiento());

  readonly sesion = this.sesionSignal.asReadonly();
  readonly usuario = computed(() => this.sesionSignal()?.usuario ?? null);
  readonly estaAutenticado = computed(() => this.sesionSignal() !== null);
  readonly token = computed(() => this.sesionSignal()?.token ?? null);
  readonly refreshToken = computed(() => this.sesionSignal()?.refreshToken ?? null);

  establecer(sesion: Sesion): void {
    this.sesionSignal.set(sesion);
    this.guardarAlmacenamiento(sesion);
  }

  actualizarTokens(datos: {
    token: string;
    refreshToken: string;
    expiraEn: number;
    refreshExpiraEn: number;
  }): void {
    const actual = this.sesionSignal();
    if (!actual) return;
    const nueva = { ...actual, ...datos };
    this.sesionSignal.set(nueva);
    this.guardarAlmacenamiento(nueva);
  }

  actualizarUsuario(usuario: Sesion['usuario']): void {
    const actual = this.sesionSignal();
    if (!actual) return;
    const nueva = { ...actual, usuario };
    this.sesionSignal.set(nueva);
    this.guardarAlmacenamiento(nueva);
  }

  limpiar(): void {
    this.sesionSignal.set(null);
    this.guardarAlmacenamiento(null);
  }

  /** Lectura síncrona al construirse el servicio: los guards ya ven la sesión restaurada de inmediato. */
  private leerAlmacenamiento(): Sesion | null {
    try {
      const crudo = localStorage.getItem(CLAVE_ALMACENAMIENTO);
      if (!crudo) return null;
      const sesion = JSON.parse(crudo) as Partial<Sesion> | null;
      if (
        !sesion ||
        typeof sesion.token !== 'string' ||
        typeof sesion.refreshToken !== 'string' ||
        typeof sesion.expiraEn !== 'number' ||
        typeof sesion.refreshExpiraEn !== 'number' ||
        !sesion.usuario?.id
      ) {
        localStorage.removeItem(CLAVE_ALMACENAMIENTO);
        return null;
      }
      if (sesion.refreshExpiraEn <= Date.now()) {
        localStorage.removeItem(CLAVE_ALMACENAMIENTO);
        return null;
      }
      return sesion as Sesion;
    } catch {
      return null;
    }
  }

  private guardarAlmacenamiento(sesion: Sesion | null): void {
    try {
      if (sesion) {
        localStorage.setItem(CLAVE_ALMACENAMIENTO, JSON.stringify(sesion));
      } else {
        localStorage.removeItem(CLAVE_ALMACENAMIENTO);
      }
    } catch {
      // localStorage no disponible (navegación privada, cuota, etc.): la sesión
      // sigue funcionando en memoria para esta pestaña, solo no sobrevive a un F5.
    }
  }
}
