import { ChangeDetectionStrategy, Component, DestroyRef, inject, model, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Subject, catchError, debounceTime, distinctUntilChanged, of, switchMap, tap } from 'rxjs';
import { mapHttpError } from '../../../../core/http/app-error';
import { ProveedoresCompraApi } from '../../data-access/proveedores-compra.api';
import { ProveedorCompraResponse } from '../../data-access/proveedor-compra.models';
import { rucDe } from '../proveedor-compra-form-dialog/proveedor-compra-form-dialog';

/**
 * Selector de proveedor de compra con búsqueda (nombre o RUC) y «+ Nuevo proveedor» en el mismo lugar: nombre y RUC, sin salir
 * del flujo. Sirve a PRODUCCION y ADMIN (el alta rápida los deja en «Otros insumos»; ADMIN completa el resto después).
 * Dos vías: `[(seleccionado)]`.
 */
@Component({
  selector: 'app-proveedor-compra-selector',
  imports: [ReactiveFormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (seleccionado(); as p) {
      <div class="elegido" role="group" aria-label="Proveedor elegido">
        <span><strong>{{ p.nombre }}</strong> <small>RUC {{ p.ruc }}</small></span>
        <button type="button" class="btn small" (click)="quitar()">Cambiar</button>
      </div>
    } @else {
      <input type="search" [id]="idCampo()" [value]="texto()" (input)="escribir($any($event.target).value)" (focus)="abrir()"
             placeholder="Buscar proveedor por nombre o RUC" autocomplete="off" role="combobox" [attr.aria-expanded]="abierto()"
             [attr.aria-controls]="idCampo() + '-lista'" aria-label="Buscar proveedor">
      @if (abierto()) {
        <ul class="lista" [id]="idCampo() + '-lista'" role="listbox">
          @if (cargando()) { <li class="estado" role="status">Buscando…</li> }
          @for (r of resultados(); track r.id) {
            <li role="option"><button type="button" (click)="elegir(r)">{{ r.nombre }} <small>RUC {{ r.ruc }}</small></button></li>
          }
          @if (!cargando() && resultados().length === 0) { <li class="estado">Sin coincidencias.</li> }
          <li class="nuevo"><button type="button" (click)="empezarAlta()">+ Nuevo proveedor</button></li>
        </ul>
      }
      @if (creando()) {
        <form class="alta" [formGroup]="alta" (ngSubmit)="crear()" aria-label="Nuevo proveedor">
          <div class="field">
            <label [for]="idCampo() + '-n'">Nombre o razón social</label>
            <input [id]="idCampo() + '-n'" type="text" maxlength="150" formControlName="nombre">
          </div>
          <div class="field">
            <label [for]="idCampo() + '-r'">RUC (11 dígitos)</label>
            <input [id]="idCampo() + '-r'" type="text" inputmode="numeric" maxlength="14" formControlName="ruc">
          </div>
          @if (errorAlta()) { <p class="error" role="alert">{{ errorAlta() }}</p> }
          <div class="acciones">
            <button type="button" class="btn small" (click)="creando.set(false)">Cancelar</button>
            <button type="submit" class="btn primary small" [disabled]="guardando()">{{ guardando() ? 'Creando…' : 'Crear y usar' }}</button>
          </div>
        </form>
      }
    }
  `,
  styles: `
    :host { display: block; position: relative; }
    .elegido { display: flex; justify-content: space-between; align-items: center; gap: var(--space-3); border: 1px solid var(--color-border); border-radius: var(--radius-control); padding: var(--space-2) var(--space-3); }
    small { color: var(--color-text-muted); font-size: 0.75rem; margin-left: 0.4rem; }
    .lista { list-style: none; margin: 2px 0 0; padding: 0; border: 1px solid var(--color-border); border-radius: var(--radius-control); background: var(--color-surface); max-height: 14rem; overflow: auto; }
    .lista li button { display: block; width: 100%; text-align: left; border: 0; background: transparent; padding: var(--space-2) var(--space-3); cursor: pointer; font: inherit; }
    .lista li button:hover, .lista li button:focus-visible { background: var(--color-surface-alt, rgba(0, 0, 0, 0.05)); }
    .estado { padding: var(--space-2) var(--space-3); color: var(--color-text-muted); font-size: var(--font-size-sm); }
    .nuevo { border-top: 1px solid var(--color-border); font-weight: 700; }
    .alta { border: 1px dashed var(--color-border); border-radius: var(--radius-control); padding: var(--space-3); margin-top: var(--space-2); }
    .acciones { display: flex; justify-content: flex-end; gap: var(--space-2); }
    .error { color: var(--color-danger); font-size: var(--font-size-sm); font-weight: 600; margin: 0 0 var(--space-2); }
  `
})
export class ProveedorCompraSelectorComponent {
  private readonly api = inject(ProveedoresCompraApi);
  private readonly fb = inject(FormBuilder);
  private readonly destroyRef = inject(DestroyRef);
  private static contador = 0;

  readonly seleccionado = model<ProveedorCompraResponse | null>(null);
  protected readonly idCampo = signal(`prov-sel-${++ProveedorCompraSelectorComponent.contador}`);
  protected readonly texto = signal('');
  protected readonly abierto = signal(false);
  protected readonly cargando = signal(false);
  protected readonly resultados = signal<ProveedorCompraResponse[]>([]);
  protected readonly creando = signal(false);
  protected readonly guardando = signal(false);
  protected readonly errorAlta = signal<string | null>(null);
  private readonly consulta$ = new Subject<string>();

  protected readonly alta = this.fb.nonNullable.group({
    nombre: ['', [Validators.required, Validators.maxLength(150), Validators.pattern(/\S/)]],
    ruc: ['', [Validators.required]]
  });

  constructor() {
    this.consulta$
      .pipe(
        debounceTime(200),
        distinctUntilChanged(),
        tap(() => this.cargando.set(true)),
        switchMap((t) => this.api.listar({ busqueda: t, soloActivos: true }).pipe(catchError(() => of([] as ProveedorCompraResponse[])))),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe((lista) => {
        this.resultados.set(lista.slice(0, 20));
        this.cargando.set(false);
      });
  }

  protected abrir(): void {
    this.abierto.set(true);
    this.consulta$.next(this.texto());
  }

  protected escribir(valor: string): void {
    this.texto.set(valor);
    this.abierto.set(true);
    this.consulta$.next(valor);
  }

  protected elegir(p: ProveedorCompraResponse): void {
    this.seleccionado.set(p);
    this.abierto.set(false);
    this.creando.set(false);
  }

  protected quitar(): void {
    this.seleccionado.set(null);
    this.texto.set('');
  }

  protected empezarAlta(): void {
    this.alta.reset({ nombre: this.texto().trim(), ruc: '' });
    this.errorAlta.set(null);
    this.abierto.set(false);
    this.creando.set(true);
  }

  protected crear(): void {
    if (this.guardando()) return;
    const v = this.alta.getRawValue();
    const ruc = rucDe(v.ruc);
    if (this.alta.invalid || !/^\d{11}$/.test(ruc)) {
      this.errorAlta.set('Indica el nombre y un RUC de 11 dígitos.');
      return;
    }
    this.guardando.set(true);
    this.errorAlta.set(null);
    this.api.crear({ nombre: v.nombre.trim(), ruc }).subscribe({
      next: (p) => {
        this.guardando.set(false);
        this.elegir(p);
      },
      error: (e) => {
        this.guardando.set(false);
        this.errorAlta.set(mapHttpError(e).mensaje);
      }
    });
  }
}
