import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { AbstractControl, FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { DialogRef } from '@angular/cdk/dialog';
import { mapHttpError } from '../../../../core/http/app-error';
import { UnidadResponse } from '../../../unidades/data-access/unidad.models';
import { UnidadesApi } from '../../../unidades/data-access/unidades.api';
import { UsuarioResponse } from '../../../usuarios/data-access/usuario.models';
import { UsuariosApi } from '../../../usuarios/data-access/usuarios.api';

export interface NuevoAcopiadorResultado {
  usuario: UsuarioResponse;
  unidad?: UnidadResponse;
}

/**
 * Alta guiada de acopiador (docs/FASES.md, Fase 2): paso 1 crea el Usuario
 * con rol ACOPIADOR; paso 2 asigna opcionalmente una Unidad con
 * responsableId = ese usuario. Si el paso 2 falla, el usuario del paso 1 NO
 * se pierde: se puede reintentar la unidad u omitirla y asignarla más tarde
 * desde el módulo Unidades (docs/DECISIONES.md, alta de usuario ACOPIADOR
 * existente; no se implementó ficha sin cuenta, ver REGISTRO).
 */
@Component({
  selector: 'app-nuevo-acopiador-dialog',
  imports: [ReactiveFormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="dialog-head">
      <h2 id="nuevo-acopiador-titulo">
        {{
          paso() === 'usuario'
            ? 'Nuevo acopiador — datos de acceso'
            : 'Nuevo acopiador — asignar unidad'
        }}
      </h2>
      <button type="button" class="close" (click)="cerrar()" aria-label="Cerrar">×</button>
    </div>

    @if (paso() === 'usuario') {
      <form
        [formGroup]="formUsuario"
        (ngSubmit)="crearUsuario()"
        class="dialog-body"
        aria-labelledby="nuevo-acopiador-titulo"
      >
        <p class="paso-info">Paso 1 de 2 · Crea la cuenta con rol ACOPIADOR.</p>
        <div class="field" [class.has-error]="tocadoInvalido(formUsuario.controls.nombre)">
          <label for="ac-nombre">Nombre completo</label>
          <input id="ac-nombre" type="text" formControlName="nombre" required />
        </div>
        <div class="field" [class.has-error]="tocadoInvalido(formUsuario.controls.email)">
          <label for="ac-email">Correo electrónico</label>
          <input id="ac-email" type="email" formControlName="email" required />
        </div>
        <div class="field" [class.has-error]="tocadoInvalido(formUsuario.controls.password)">
          <label for="ac-password">Contraseña</label>
          <input
            id="ac-password"
            type="password"
            formControlName="password"
            autocomplete="new-password"
            required
          />
          <span class="hint">Mínimo 8 caracteres.</span>
        </div>
        @if (errorUsuario()) {
          <p class="server-error" role="alert">{{ errorUsuario() }}</p>
        }
        <div class="dialog-foot">
          <button type="button" class="btn" (click)="cerrar()">Cancelar</button>
          <button
            type="submit"
            class="btn primary"
            [disabled]="formUsuario.invalid || enviandoUsuario()"
          >
            {{ enviandoUsuario() ? 'Creando…' : 'Crear y continuar' }}
          </button>
        </div>
      </form>
    } @else {
      <form
        [formGroup]="formUnidad"
        (ngSubmit)="asignarUnidad()"
        class="dialog-body"
        aria-labelledby="nuevo-acopiador-titulo"
      >
        <p class="paso-info">
          Paso 2 de 2 · Cuenta creada para <strong>{{ usuarioCreado()?.nombre }}</strong
          >. Asignar una unidad es opcional aquí.
        </p>
        <div class="field">
          <label for="ac-unidad">Placa de la unidad existente</label>
          <select id="ac-unidad" formControlName="unidadId" required>
            <option value="" disabled>Selecciona una placa</option>
            @for (unidad of unidades(); track unidad.id) {
              <option [value]="unidad.id">{{ unidad.placa }}</option>
            }
          </select>
          @if (unidadSeleccionada(); as unidad) {
            <p>
              Responsable actual: {{ unidad.responsableNombre }}. Al asignar, pasará al nuevo
              acopiador.
            </p>
          }
          @if (cargandoUnidades()) {
            <p>Cargando flota…</p>
          }
          @if (errorFlota()) {
            <p role="alert">{{ errorFlota() }}</p>
            <button type="button" class="btn" (click)="cargarUnidades()">Reintentar</button>
          }
          @if (!cargandoUnidades() && !errorFlota() && unidades().length === 0) {
            <p>No hay unidades registradas. Puedes omitir este paso.</p>
          }
        </div>
        @if (errorUnidad()) {
          <p class="server-error" role="alert">{{ errorUnidad() }}</p>
        }
        <div class="dialog-foot">
          <button type="button" class="btn" (click)="omitirUnidad()">Omitir por ahora</button>
          <button
            type="submit"
            class="btn primary"
            [disabled]="formUnidad.invalid || enviandoUnidad()"
          >
            {{ enviandoUnidad() ? 'Asignando…' : 'Asignar unidad' }}
          </button>
        </div>
      </form>
    }
  `,
  styles: `
    :host {
      display: block;
      width: min(28rem, 100%);
      background: var(--color-surface);
      border-radius: var(--radius-dialog);
      box-shadow: var(--shadow-overlay);
    }
    .dialog-head {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      padding: var(--space-6) var(--space-6) 0;
    }
    .dialog-head h2 {
      font-size: var(--font-size-lg);
      margin: 0;
    }
    .close {
      border: 1px solid var(--color-border);
      background: var(--color-surface);
      border-radius: var(--radius-control);
      width: 2rem;
      height: 2rem;
      font-size: 1.1rem;
      line-height: 1;
    }
    .dialog-body {
      padding: var(--space-6);
    }
    .paso-info {
      margin: 0 0 var(--space-4);
      font-size: var(--font-size-sm);
      color: var(--color-text-muted);
    }
    .server-error {
      background: var(--color-danger-bg);
      color: var(--color-danger);
      border-radius: var(--radius-control);
      padding: var(--space-3);
      font-size: var(--font-size-sm);
      margin: 0 0 var(--space-4);
    }
    .dialog-foot {
      display: flex;
      justify-content: flex-end;
      gap: var(--space-2);
      margin-top: var(--space-4);
    }
  `,
})
export class NuevoAcopiadorDialog {
  protected readonly dialogRef = inject(DialogRef<NuevoAcopiadorResultado | undefined>);
  private readonly fb = inject(FormBuilder);
  private readonly usuariosApi = inject(UsuariosApi);
  private readonly unidadesApi = inject(UnidadesApi);

  protected readonly paso = signal<'usuario' | 'unidad'>('usuario');
  protected readonly usuarioCreado = signal<UsuarioResponse | null>(null);
  protected readonly enviandoUsuario = signal(false);
  protected readonly enviandoUnidad = signal(false);
  protected readonly errorUsuario = signal<string | null>(null);
  protected readonly errorUnidad = signal<string | null>(null);
  protected readonly unidades = signal<UnidadResponse[]>([]);
  protected readonly cargandoUnidades = signal(false);
  protected readonly errorFlota = signal<string | null>(null);
  protected cargarUnidades() {
    this.cargandoUnidades.set(true);
    this.errorFlota.set(null);
    this.unidadesApi.listar().subscribe({
      next: (u) => {
        this.unidades.set(u);
        this.cargandoUnidades.set(false);
      },
      error: (e) => {
        this.errorFlota.set(mapHttpError(e).mensaje);
        this.cargandoUnidades.set(false);
      },
    });
  }
  protected unidadSeleccionada() {
    return this.unidades().find((u) => u.id === this.formUnidad.controls.unidadId.value);
  }

  protected readonly formUsuario = this.fb.group({
    nombre: this.fb.nonNullable.control('', Validators.required),
    email: this.fb.nonNullable.control('', [Validators.required, Validators.email]),
    password: this.fb.nonNullable.control('', [Validators.required, Validators.minLength(8)]),
  });

  protected readonly formUnidad = this.fb.group({
    unidadId: this.fb.nonNullable.control('', Validators.required),
  });

  protected tocadoInvalido(control: AbstractControl | null): boolean {
    return !!control && control.invalid && control.touched;
  }

  crearUsuario(): void {
    if (this.formUsuario.invalid || this.enviandoUsuario()) {
      this.formUsuario.markAllAsTouched();
      return;
    }
    this.enviandoUsuario.set(true);
    this.errorUsuario.set(null);
    const { nombre, email, password } = this.formUsuario.getRawValue();
    this.usuariosApi.crear({ nombre, email, password, rolNombre: 'ACOPIADOR' }).subscribe({
      next: (usuario) => {
        this.usuarioCreado.set(usuario);
        this.paso.set('unidad');
        this.cargarUnidades();
      },
      error: (error) => {
        this.enviandoUsuario.set(false);
        this.errorUsuario.set(mapHttpError(error).mensaje);
      },
    });
  }

  asignarUnidad(): void {
    const usuario = this.usuarioCreado();
    if (!usuario || this.formUnidad.invalid || this.enviandoUnidad()) {
      this.formUnidad.markAllAsTouched();
      return;
    }
    const unidad = this.unidadSeleccionada();
    if (!unidad) return;
    this.enviandoUnidad.set(true);
    this.errorUnidad.set(null);
    this.unidadesApi
      .actualizar(unidad.id, {
        placa: unidad.placa,
        capacidadTon: unidad.capacidadTon,
        zonaId: unidad.zonaId,
        responsableId: usuario.id,
      })
      .subscribe({
        next: (unidad) => this.dialogRef.close({ usuario, unidad }),
        error: (error) => {
          this.enviandoUnidad.set(false);
          this.errorUnidad.set(mapHttpError(error).mensaje);
        },
      });
  }

  omitirUnidad(): void {
    const usuario = this.usuarioCreado();
    this.dialogRef.close(usuario ? { usuario } : undefined);
  }

  cerrar(): void {
    const usuario = this.usuarioCreado();
    this.dialogRef.close(usuario ? { usuario } : undefined);
  }
}
