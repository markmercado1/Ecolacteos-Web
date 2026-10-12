import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  effect,
  ElementRef,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DatePipe, DecimalPipe, formatDate } from '@angular/common';
import { Dialog, DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { catchError, forkJoin, map, of, switchMap } from 'rxjs';
import * as L from 'leaflet';
import { Acopio, AcopiosApi, CorreccionRegistro } from './acopios.api';
import { HistorialProveedorDialog } from './historial-proveedor-dialog';
import { AppError, mapHttpError } from '../../core/http/app-error';
import { ErrorStateComponent } from '../../shared/ui/state/error-state';
import { LoadingStateComponent } from '../../shared/ui/state/loading-state';

/** Un acopio de la jornada ya resuelto con su GPS y foto (GET /api/registros-acopio/{id}), en el orden
 * cronológico que ya entrega GET /api/jornadas/{id} (findByJornadaIdOrderByFechaHoraAsc del backend). */
interface PuntoRecorrido {
  orden: number;
  registroAcopioId: string;
  proveedorNombre: string;
  fechaHora: string;
  litros: number;
  gpsLat: number | null;
  gpsLng: number | null;
  fotoUrl: string | null;
}

@Component({
  selector: 'app-acopio-detalle',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DatePipe, DecimalPipe, ErrorStateComponent, LoadingStateComponent],
  template: `
    <header>
      <div>
        <div class="eyebrow">{{ data.jornada ? 'JORNADA DE ACOPIO' : 'REGISTRO DE CAMPO' }}</div>
        <h2 id="acopio-titulo">{{ data.jornada ? 'Detalle de la jornada' : 'Detalle del acopio' }}</h2>
      </div>
      <button class="cerrar" (click)="ref.close()" aria-label="Cerrar detalle">
        <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M6 6L18 18M18 6L6 18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
      </button>
    </header>
    <div class="contenido">
      @if (cargando()) {
        <ui-loading-state />
      } @else if (error()) {
        <ui-error-state [error]="error()" (reintentar)="cargar()" />
      } @else if (registro(); as r) {
        @if (data.jornada; as j) {
        <div class="panel panel-resumen">
          <div class="proveedor-head">
            <h3>Acopio de {{ j.acopiadorNombre ?? data.placa }}</h3>
          </div>

          <div class="stat-chip">
            <p class="litros">{{ j.totalLitros | number: '1.0-3' }} L</p>
            <p class="litros-nota">Total de leche recolectada en la jornada ({{ j.cantidad }} acopio(s)).</p>
          </div>

          <dl>
            <div class="campo">
              <dt>Fecha</dt>
              <dd>{{ j.fecha | date: 'dd/MM/yyyy' }}</dd>
            </div>
            <div class="campo">
              <dt>Placa</dt>
              <dd>{{ data.placa }}</dd>
            </div>
            <div class="campo">
              <dt>Acopiador</dt>
              <dd>{{ j.acopiadorNombre ?? 'No informado' }}</dd>
            </div>
            <div class="campo">
              <dt>Cantidad de acopios</dt>
              <dd>{{ j.cantidad }}</dd>
            </div>
            @if (puntosJornada(); as puntos) {
              @if (puntos.length > 0) {
                <div class="campo">
                  <dt>Primer acopio</dt>
                  <dd>{{ puntos[0].fechaHora | date: 'HH:mm:ss' }}</dd>
                </div>
                <div class="campo">
                  <dt>Último acopio</dt>
                  <dd>{{ puntos[puntos.length - 1].fechaHora | date: 'HH:mm:ss' }}</dd>
                </div>
              }
            }
          </dl>
        </div>
        } @else {
        <div class="panel panel-resumen">
          <div class="proveedor-head">
            <h3>{{ r.proveedorNombre }}</h3>
            <button class="row-link" (click)="abrirHistorialProveedor(r)">Ver historial del proveedor</button>
          </div>

          <div class="stat-chip">
            <p class="litros">{{ r.litros | number: '1.0-3' }} L</p>
            <p class="litros-nota">Litros originales del registro (inmutable). Ver correcciones abajo.</p>
          </div>

          <dl>
            <div class="campo">
              <dt>Fecha y hora de captura</dt>
              <dd>{{ r.fechaHora | date: 'dd/MM/yyyy HH:mm:ss' }}</dd>
            </div>
            <div class="campo">
              <dt>Placa</dt>
              <dd>{{ data.placa }}</dd>
            </div>
            <div class="campo">
              <dt>Sincronizado en</dt>
              <dd>
                {{
                  r.sincronizadoEn ? (r.sincronizadoEn | date: 'dd/MM/yyyy HH:mm:ss') : 'No informado'
                }}
              </dd>
            </div>
            <div class="campo">
              <dt>Observación</dt>
              <dd>{{ r.motivoObservacion || 'Sin observación' }}</dd>
            </div>
            <div class="campo">
              <dt>Captura de litros por voz</dt>
              <dd>
                <span class="badge" [class.gray]="!r.litrosPorVoz">
                  {{ r.litrosPorVoz === null ? 'No informado' : r.litrosPorVoz ? 'Sí' : 'No' }}
                </span>
              </dd>
            </div>
            <div class="campo">
              <dt>Disponible para lote</dt>
              <dd>
                <span class="badge" [class.gray]="!r.disponibleParaLote">
                  {{ r.disponibleParaLote === null ? 'No informado' : r.disponibleParaLote ? 'Sí' : 'No' }}
                </span>
              </dd>
            </div>
            <div class="campo campo-ancho">
              <dt>GPS de la captura</dt>
              <dd>
                @if (mapa(r); as enlace) {
                  {{ r.gpsLat }}, {{ r.gpsLng }} ·
                  <a [href]="enlace" target="_blank" rel="noopener noreferrer">Ver ubicación</a>
                } @else {
                  <span class="badge amber">Sin coordenadas registradas</span>
                }
              </dd>
            </div>
          </dl>

          <details class="tecnico">
            <summary>Detalles técnicos</summary>
            <dl>
              <div class="campo">
                <dt>Identificador del registro</dt>
                <dd class="codigo">{{ r.id }}</dd>
              </div>
              <div class="campo">
                <dt>Identificador del dispositivo móvil</dt>
                <dd class="codigo">{{ r.uuidCliente }}</dd>
              </div>
            </dl>
          </details>
        </div>

        <section class="panel">
          <h3 class="panel-titulo">Correcciones</h3>
          @if (cargandoCorrecciones()) {
            <ui-loading-state mensaje="Cargando correcciones…" />
          } @else if (errorCorrecciones()) {
            <p role="alert">{{ errorCorrecciones() }}</p>
            <button class="btn" (click)="cargarCorrecciones()">Reintentar correcciones</button>
          } @else if (correcciones().length === 0) {
            <p class="vacio">Sin correcciones registradas. Se conserva el litraje original de captura.</p>
          } @else {
            <div class="tabla-wrap">
              <table class="tabla-correcciones">
                <thead>
                  <tr>
                    <th>Litros antes</th>
                    <th>Litros después</th>
                    <th>Motivo</th>
                    <th>Usuario</th>
                    <th>Fecha</th>
                  </tr>
                </thead>
                <tbody>
                  @for (c of correcciones(); track c.id) {
                    <tr>
                      <td>{{ c.litrosAnterior | number: '1.0-3' }} L</td>
                      <td>{{ c.litrosCorregido | number: '1.0-3' }} L</td>
                      <td>{{ c.motivo }}</td>
                      <td>{{ c.usuarioNombre }}</td>
                      <td>{{ c.creadoEn | date: 'dd/MM/yyyy HH:mm:ss' }}</td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          }
        </section>
        }

        @if (r.jornadaId) {
          <section class="panel">
            <h3 class="panel-titulo">Recorrido de la jornada</h3>
            @if (cargandoJornada()) {
              <ui-loading-state mensaje="Cargando recorrido…" />
            } @else if (errorJornada()) {
              <p role="alert">{{ errorJornada() }}</p>
              <button class="btn" (click)="cargarJornada(r.jornadaId!)">Reintentar recorrido</button>
            } @else if (puntosJornada(); as puntos) {
              @if (puntos.length === 0) {
                <p class="vacio">Esta jornada no tiene acopios registrados.</p>
              } @else {
                <div class="tabla-wrap">
                  <table class="tabla-orden">
                    <thead>
                      <tr>
                        <th>Orden</th>
                        <th>Acopio</th>
                        <th>Hora</th>
                        <th>Litros</th>
                        <th>GPS</th>
                      </tr>
                    </thead>
                    <tbody>
                      @for (p of puntos; track p.registroAcopioId) {
                        <tr [class.actual]="!data.jornada && p.registroAcopioId === r.id">
                          <td>{{ p.orden }}</td>
                          <td>{{ p.proveedorNombre }}</td>
                          <td>{{ p.fechaHora | date: 'HH:mm:ss' }}</td>
                          <td>{{ p.litros | number: '1.0-3' }} L</td>
                          <td>{{ gpsTexto(p) }}</td>
                        </tr>
                      }
                    </tbody>
                  </table>
                </div>
                @if (trazado()) {
                  <div
                    #mapaEl
                    class="mapa-recorrido"
                    role="img"
                    aria-label="Recorrido GPS de la jornada sobre un mapa, numerado en orden cronológico"
                  ></div>
                } @else {
                  <p class="vacio">Ningún acopio de esta jornada tiene coordenadas GPS válidas registradas.</p>
                }
              }
            }
          </section>
        }

        @if (r.jornadaId) {
          <section class="panel">
            <h3 class="panel-titulo">Fotografías de la jornada</h3>
            @if (cargandoJornada()) {
              <ui-loading-state mensaje="Cargando fotografías…" />
            } @else if (errorJornada()) {
              <p role="alert">{{ errorJornada() }}</p>
            } @else if (puntosJornada(); as puntos) {
              @if (puntos.length === 0) {
                <p class="vacio">Esta jornada no tiene acopios registrados.</p>
              } @else {
                @if (cargandoFotosJornada()) {
                  <ui-loading-state mensaje="Cargando fotografías…" />
                }
                <div class="fotos-jornada">
                  @for (p of puntos; track p.registroAcopioId) {
                    <div class="foto-item">
                      <p class="foto-item-titulo">
                        Acopio {{ p.orden }} · {{ p.proveedorNombre }} · {{ p.fechaHora | date: 'HH:mm:ss' }}
                      </p>
                      @if (!p.fotoUrl) {
                        <p class="vacio">Sin foto</p>
                      } @else if (fotosJornada()[p.registroAcopioId]) {
                        <img
                          [src]="fotosJornada()[p.registroAcopioId]"
                          [alt]="'Fotografía del acopio de ' + p.proveedorNombre"
                        />
                      } @else if (!cargandoFotosJornada()) {
                        <p role="alert">No se pudo cargar esta fotografía.</p>
                      }
                    </div>
                  }
                </div>
              }
            }
          </section>
        } @else {
          <section class="panel">
            <h3 class="panel-titulo">Fotografía</h3>
            @if (!r.fotoUrl) {
              <p class="vacio">No se adjuntó fotografía a este acopio.</p>
            } @else if (cargandoFoto()) {
              <ui-loading-state mensaje="Cargando fotografía…" />
            } @else if (errorFoto()) {
              <p role="alert">{{ errorFoto() }}</p>
              <button class="btn" (click)="cargarFoto(r.fotoUrl)">Reintentar foto</button>
            } @else if (foto()) {
              <img
                [src]="foto()"
                [alt]="'Fotografía del acopio de ' + r.proveedorNombre"
                (error)="errorFoto.set('El archivo no se puede mostrar como imagen.')"
              />
            }
          </section>
        }
      }
    </div>
  `,
  styles: `
    @keyframes acopio-detalle-entrada {
      from { opacity: 0; transform: translateY(6px) scale(0.98); }
      to { opacity: 1; transform: translateY(0) scale(1); }
    }
    :host {
      display: flex;
      flex-direction: column;
      width: min(44rem, calc(100vw - 2rem));
      max-height: 85vh;
      overflow: hidden;
      background: var(--color-surface);
      border-radius: var(--radius-dialog);
      box-shadow: var(--shadow-overlay);
      border-top: 3px solid var(--brand-500);
      animation: acopio-detalle-entrada var(--motion-normal) ease-out;
    }

    header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 1rem;
      padding: var(--space-6) var(--space-6) var(--space-4);
      border-bottom: 1px solid var(--color-border);
      background: var(--color-surface);
      flex: none;
    }
    .eyebrow {
      font-size: 0.6875rem;
      letter-spacing: 0.12em;
      font-weight: 800;
      color: var(--brand-500);
      margin-bottom: 0.25rem;
    }
    h2 {
      margin: 0;
      font-size: var(--font-size-lg);
      color: var(--color-text);
    }
    .cerrar {
      display: grid;
      place-items: center;
      width: 2.25rem;
      height: 2.25rem;
      flex: none;
      border: none;
      border-radius: 50%;
      background: transparent;
      color: var(--color-text-muted);
      cursor: pointer;
      transition: background var(--motion-fast) ease, color var(--motion-fast) ease;
    }
    .cerrar:hover { background: var(--color-surface-soft); color: var(--color-text); }
    .cerrar:focus-visible { outline: 2px solid var(--color-focus); outline-offset: 2px; }

    .contenido {
      overflow: auto;
      padding: var(--space-6);
      display: flex;
      flex-direction: column;
      gap: var(--space-5);
    }

    /* Cada bloque del detalle (resumen, correcciones, jornada, fotos) es un panel visualmente separado --
       antes era todo un único bloque de texto continuo sin jerarquía entre secciones. */
    .panel {
      background: var(--color-surface);
      border: 1px solid var(--color-border);
      border-radius: var(--radius-card);
      padding: var(--space-5);
      box-shadow: var(--shadow-card);
    }
    .panel-titulo {
      margin: 0 0 var(--space-4);
      font-size: var(--font-size-base);
      font-weight: 800;
      color: var(--color-text);
      padding-bottom: var(--space-3);
      border-bottom: 1px solid var(--color-border);
    }
    .vacio {
      color: var(--color-text-muted);
      font-size: var(--font-size-sm);
      margin: 0;
    }

    .proveedor-head {
      display: flex;
      justify-content: space-between;
      align-items: baseline;
      gap: var(--space-3);
      flex-wrap: wrap;
      margin-bottom: var(--space-4);
    }
    .proveedor-head h3 { margin: 0; font-size: var(--font-size-lg); }

    /* El dato principal de todo el diálogo: se destaca con un fondo propio en vez de flotar como texto
       grande suelto entre el nombre del proveedor y la grilla de campos. */
    .stat-chip {
      background: color-mix(in srgb, var(--brand-accent) 35%, var(--color-surface));
      border-radius: var(--radius-control);
      padding: var(--space-4) var(--space-5);
      margin-bottom: var(--space-5);
    }
    .litros {
      font-size: 2.25rem;
      font-weight: 800;
      color: var(--brand-800);
      margin: 0;
      line-height: 1.1;
    }
    .litros-nota {
      margin: 0.3rem 0 0;
      font-size: var(--font-size-sm);
      color: var(--color-text-muted);
    }

    dl {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 0;
      margin: 0;
      border-top: 1px solid var(--color-border);
    }
    .campo {
      padding: var(--space-3) var(--space-2) var(--space-3) 0;
      border-bottom: 1px solid var(--color-border);
    }
    .campo:nth-child(odd) { padding-right: var(--space-4); }
    .campo-ancho { grid-column: 1 / -1; }
    dt {
      color: var(--color-text-muted);
      font-size: 0.75rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.03em;
    }
    dd {
      margin: 0.35rem 0 0;
      overflow-wrap: anywhere;
      font-weight: 600;
      color: var(--color-text);
    }

    /* Identificadores técnicos (UUIDs): útiles para soporte, sin valor para un admin a simple vista --
       se ocultan detrás de un disclosure en vez de mostrarse junto a los campos legibles de arriba. */
    .tecnico {
      margin-top: var(--space-4);
    }
    .tecnico summary {
      cursor: pointer;
      font-size: var(--font-size-sm);
      color: var(--color-text-muted);
      user-select: none;
      font-weight: 600;
    }
    .tecnico summary:hover { color: var(--color-text); }
    .tecnico dl {
      margin-top: var(--space-3);
      border-top: 1px solid var(--color-border);
    }
    .codigo {
      font-family: monospace;
      font-weight: 400;
      font-size: 0.7rem;
      color: var(--color-text-muted);
    }

    img {
      width: 100%;
      max-height: 28rem;
      object-fit: contain;
      border-radius: var(--radius-control);
    }

    .tabla-wrap {
      border: 1px solid var(--color-border);
      border-radius: var(--radius-control);
      overflow: hidden;
    }
    .tabla-correcciones,
    .tabla-orden {
      width: 100%;
      border-collapse: collapse;
      font-size: var(--font-size-sm);
    }
    .tabla-correcciones th,
    .tabla-orden th {
      text-align: left;
      padding: 0.5rem 0.75rem;
      background: var(--color-surface-soft);
      color: var(--color-text-muted);
      font-size: 0.75rem;
      text-transform: uppercase;
      letter-spacing: 0.03em;
      font-weight: 700;
    }
    .tabla-correcciones td,
    .tabla-orden td {
      text-align: left;
      padding: 0.5rem 0.75rem;
      border-top: 1px solid var(--color-border);
    }
    .tabla-orden tbody tr:nth-child(even) { background: var(--color-surface-soft); }
    .tabla-orden tr.actual {
      background: color-mix(in srgb, var(--brand-500) 16%, transparent) !important;
      font-weight: 700;
    }
    .mapa-recorrido {
      width: 100%;
      height: 20rem;
      margin-top: var(--space-4);
      border: 1px solid var(--color-border);
      border-radius: var(--radius-control);
    }
    .fotos-jornada {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(14rem, 1fr));
      gap: var(--space-4);
    }
    .foto-item-titulo {
      font-size: var(--font-size-sm);
      color: var(--color-text-muted);
      margin: 0 0 0.4rem;
    }
    @media (max-width: 600px) {
      dl { grid-template-columns: 1fr; }
      .campo:nth-child(odd) { padding-right: 0; }
    }
  `,
})
export class AcopioDetalle {
  protected readonly ref = inject(DialogRef);
  /** `jornada` presente = se abrió desde "Ver jornada": el resumen es de todo el recorrido, no de `id`
   * (que solo sirve para llegar al jornadaId). */
  protected readonly data = inject<{
    id: string;
    placa: string;
    jornada?: { acopiadorNombre: string | null; fecha: string; cantidad: number; totalLitros: number };
  }>(DIALOG_DATA);
  private readonly api = inject(AcopiosApi);
  private readonly dialog = inject(Dialog);
  private readonly destroy = inject(DestroyRef);
  protected readonly registro = signal<Acopio | null>(null);
  protected readonly cargando = signal(false);
  protected readonly error = signal<AppError | null>(null);
  protected readonly foto = signal<string | null>(null);
  protected readonly errorFoto = signal<string | null>(null);
  protected readonly cargandoFoto = signal(false);
  protected readonly correcciones = signal<CorreccionRegistro[]>([]);
  protected readonly cargandoCorrecciones = signal(false);
  protected readonly errorCorrecciones = signal<string | null>(null);
  protected readonly puntosJornada = signal<PuntoRecorrido[] | null>(null);
  protected readonly cargandoJornada = signal(false);
  protected readonly errorJornada = signal<string | null>(null);
  protected readonly fotosJornada = signal<Record<string, string>>({});
  protected readonly cargandoFotosJornada = signal(false);
  // Misma lógica de filtrado/orden que antes (solo puntos con GPS válido, en el orden cronológico que ya
  // entrega puntosJornada()) -- lo único que cambió es cómo se dibuja, ver dibujarMapa().
  protected readonly trazado = computed<PuntoRecorrido[] | null>(() => {
    const puntos = (this.puntosJornada() ?? []).filter((p) => this.gpsValido(p.gpsLat, p.gpsLng));
    return puntos.length > 0 ? puntos : null;
  });
  private readonly mapaEl = viewChild<ElementRef<HTMLDivElement>>('mapaEl');
  private mapaLeaflet?: L.Map;
  private capaRecorrido?: L.LayerGroup;
  constructor() {
    this.cargar();
    // El contenedor del mapa solo existe en el DOM cuando trazado() tiene puntos (ver template); este
    // efecto dibuja/actualiza el mapa en cuanto ambos están disponibles.
    effect(() => {
      const el = this.mapaEl();
      const puntos = this.trazado();
      if (el && puntos) {
        this.dibujarMapa(el.nativeElement, puntos);
      }
    });
    this.destroy.onDestroy(() => {
      this.liberarFoto();
      this.liberarFotosJornada();
      this.mapaLeaflet?.remove();
    });
  }
  // Mapa real (OpenStreetMap vía Leaflet, sin API key) con un marcador numerado por acopio y una polilínea
  // que los une en el mismo orden cronológico de la tabla de arriba. El backend no provee ninguna
  // representación previa del recorrido para pintar -- solo lat/lng por acopio -- así que Leaflet resuelve
  // acá la proyección sobre el mapa real; no se inventa ninguna coordenada.
  private dibujarMapa(contenedor: HTMLDivElement, puntos: PuntoRecorrido[]) {
    const colorPrimario = getComputedStyle(contenedor).getPropertyValue('--color-primary').trim() || '#0f4d3a';
    if (!this.mapaLeaflet) {
      this.mapaLeaflet = L.map(contenedor);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 19,
      }).addTo(this.mapaLeaflet);
    }
    this.capaRecorrido?.remove();
    this.capaRecorrido = L.layerGroup().addTo(this.mapaLeaflet);
    const idActual = this.data.jornada ? undefined : this.registro()?.id;
    const puntosLatLng = puntos.map((p): L.LatLngTuple => [p.gpsLat as number, p.gpsLng as number]);

    L.polyline(puntosLatLng, { color: colorPrimario, weight: 3 }).addTo(this.capaRecorrido);
    puntos.forEach((p, i) => {
      const icono = L.divIcon({
        className: 'marcador-acopio' + (p.registroAcopioId === idActual ? ' actual' : ''),
        html: `<span>${p.orden}</span>`,
        iconSize: [26, 26],
        iconAnchor: [13, 13],
      });
      const marcador = L.marker(puntosLatLng[i], { icon: icono }).addTo(this.capaRecorrido!);
      marcador.bindTooltip(this.crearContenidoPunto(p, 'span'));
      marcador.bindPopup(this.crearContenidoPunto(p, 'div'));
    });

    if (puntosLatLng.length === 1) {
      this.mapaLeaflet.setView(puntosLatLng[0], 16);
    } else {
      this.mapaLeaflet.fitBounds(L.latLngBounds(puntosLatLng), { padding: [24, 24] });
    }
    // El contenedor recién se agrega al DOM (o cambia de tamaño al abrir el diálogo): sin esto Leaflet
    // puede calcular mal el tamaño del mapa y recortar los tiles.
    setTimeout(() => this.mapaLeaflet?.invalidateSize(), 0);
  }
  // Construye el contenido de forma segura con DOM/textContent (nunca innerHTML con datos del backend,
  // ej. proveedorNombre) para el tooltip (hover) y el popup (click) del marcador.
  private crearContenidoPunto(p: PuntoRecorrido, tag: 'span' | 'div'): HTMLElement {
    if (tag === 'span') {
      const el = document.createElement('span');
      el.textContent = `Acopio ${p.orden} · ${p.proveedorNombre}`;
      return el;
    }
    const el = document.createElement('div');
    el.className = 'popup-acopio';
    const titulo = document.createElement('strong');
    titulo.textContent = `Acopio ${p.orden} · ${p.proveedorNombre}`;
    const hora = document.createElement('div');
    // formatDate en vez de inyectar DatePipe: es una función pura, sin necesitar proveerlo en el
    // componente. El patrón 'HH:mm:ss' es numérico puro, no depende de nombres de mes/día por locale.
    hora.textContent = `Hora: ${formatDate(p.fechaHora, 'HH:mm:ss', 'en-US')}`;
    const coords = document.createElement('div');
    coords.textContent = `Latitud: ${p.gpsLat} · Longitud: ${p.gpsLng}`;
    el.append(titulo, hora, coords);
    return el;
  }
  private liberarFoto() {
    const url = this.foto();
    if (url) URL.revokeObjectURL(url);
    this.foto.set(null);
  }
  private liberarFotosJornada() {
    for (const url of Object.values(this.fotosJornada())) URL.revokeObjectURL(url);
    this.fotosJornada.set({});
  }
  protected cargar() {
    this.cargando.set(true);
    this.error.set(null);
    this.api
      .obtener(this.data.id)
      .pipe(takeUntilDestroyed(this.destroy))
      .subscribe({
        next: (r) => {
          this.registro.set(r);
          this.cargando.set(false);
          if (r.jornadaId) {
            this.cargarJornada(r.jornadaId);
          } else if (r.fotoUrl) {
            this.cargarFoto(r.fotoUrl);
          }
          this.cargarCorrecciones();
        },
        error: (e) => {
          this.error.set(mapHttpError(e));
          this.cargando.set(false);
        },
      });
  }
  // Independiente del resto del detalle: si CorreccionRegistro no está autorizado o falla, no debe
  // impedir ver GPS/foto/jornada ya cargados arriba.
  protected cargarCorrecciones() {
    this.cargandoCorrecciones.set(true);
    this.errorCorrecciones.set(null);
    this.api
      .correcciones(this.data.id)
      .pipe(takeUntilDestroyed(this.destroy))
      .subscribe({
        next: (c) => {
          this.correcciones.set(c);
          this.cargandoCorrecciones.set(false);
        },
        error: () => {
          this.errorCorrecciones.set('No se pudieron cargar las correcciones.');
          this.cargandoCorrecciones.set(false);
        },
      });
  }
  protected abrirHistorialProveedor(r: Acopio) {
    this.dialog.open(HistorialProveedorDialog, {
      ariaLabel: `Historial de ${r.proveedorNombre}`,
      data: { proveedorId: r.proveedorId, proveedorNombre: r.proveedorNombre },
    });
  }
  protected cargarFoto(url: string) {
    this.liberarFoto();
    this.cargandoFoto.set(true);
    this.errorFoto.set(null);
    this.api
      .foto(url)
      .pipe(takeUntilDestroyed(this.destroy))
      .subscribe({
        next: (blob) => {
          this.foto.set(URL.createObjectURL(blob));
          this.cargandoFoto.set(false);
        },
        error: () => {
          this.errorFoto.set('No se pudo cargar la fotografía.');
          this.cargandoFoto.set(false);
        },
      });
  }
  // Reutiliza GET /api/jornadas/{id} (ya expuesto para RECEPCION: trae los acopios de la jornada
  // ordenados por fechaHora ascendente) para obtener el orden real, y GET /api/registros-acopio/{id}
  // (ya usado arriba) por cada uno para completar GPS y foto -- ningún endpoint nuevo.
  protected cargarJornada(jornadaId: string) {
    this.cargandoJornada.set(true);
    this.errorJornada.set(null);
    this.puntosJornada.set(null);
    this.api
      .jornada(jornadaId)
      .pipe(
        switchMap((detalle) =>
          detalle.acopios.length === 0
            ? of([] as Acopio[])
            : forkJoin(detalle.acopios.map((a) => this.api.obtener(a.registroAcopioId))),
        ),
        takeUntilDestroyed(this.destroy),
      )
      .subscribe({
        next: (registros) => {
          const puntos: PuntoRecorrido[] = registros.map((r, i) => ({
            orden: i + 1,
            registroAcopioId: r.id,
            proveedorNombre: r.proveedorNombre,
            fechaHora: r.fechaHora,
            litros: r.litros,
            gpsLat: r.gpsLat,
            gpsLng: r.gpsLng,
            fotoUrl: r.fotoUrl,
          }));
          this.puntosJornada.set(puntos);
          this.cargandoJornada.set(false);
          this.cargarFotosJornada(puntos);
        },
        error: () => {
          this.errorJornada.set('No se pudo cargar el recorrido de la jornada.');
          this.cargandoJornada.set(false);
        },
      });
  }
  protected cargarFotosJornada(puntos: PuntoRecorrido[]) {
    this.liberarFotosJornada();
    const conFoto = puntos.filter((p) => p.fotoUrl);
    if (conFoto.length === 0) return;
    this.cargandoFotosJornada.set(true);
    forkJoin(
      conFoto.map((p) =>
        this.api.foto(p.fotoUrl!).pipe(
          map((blob) => ({ id: p.registroAcopioId, url: URL.createObjectURL(blob) as string | null })),
          catchError(() => of({ id: p.registroAcopioId, url: null as string | null })),
        ),
      ),
    )
      .pipe(takeUntilDestroyed(this.destroy))
      .subscribe((resultados) => {
        const mapa: Record<string, string> = {};
        for (const r of resultados) if (r.url) mapa[r.id] = r.url;
        this.fotosJornada.set(mapa);
        this.cargandoFotosJornada.set(false);
      });
  }
  protected gpsValido(lat: number | null, lng: number | null): boolean {
    return (
      lat !== null &&
      lng !== null &&
      Number.isFinite(lat) &&
      Number.isFinite(lng) &&
      Math.abs(lat) <= 90 &&
      Math.abs(lng) <= 180
    );
  }
  protected gpsTexto(p: PuntoRecorrido): string {
    return this.gpsValido(p.gpsLat, p.gpsLng) ? `${p.gpsLat}, ${p.gpsLng}` : 'Sin GPS';
  }
  protected mapa(r: Acopio): string | null {
    if (!this.gpsValido(r.gpsLat, r.gpsLng)) return null;
    return `https://www.google.com/maps?q=${r.gpsLat},${r.gpsLng}`;
  }
}
