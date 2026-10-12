import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { mapHttpError } from '../../../../core/http/app-error';
import { RolResponse, UsuarioResponse } from '../../data-access/usuario.models';
import { UsuariosApi } from '../../data-access/usuarios.api';

export interface UsuarioFormDialogData {
  roles: RolResponse[];
  usuario?: UsuarioResponse;
  /** Fija el rol y lo oculta del formulario (usado por el alta guiada de Acopiadores). */
  rolFijo?: UsuarioResponse['rolNombre'];
}

@Component({
  selector: 'app-usuario-form-dialog',
  imports: [ReactiveFormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="dialog-head">
      <h2 id="usuario-form-titulo">{{ esEdicion ? 'Editar usuario' : 'Nuevo usuario' }}</h2>
      <button type="button" class="close" (click)="dialogRef.close()" aria-label="Cerrar">×</button>
    </div>
    <form [formGroup]="form" (ngSubmit)="enviar()" class="dialog-body" aria-labelledby="usuario-form-titulo">
      <div class="field" [class.has-error]="invalido('nombre')">
        <label for="nombre">Nombre completo</label>
        <input id="nombre" type="text" formControlName="nombre" required>
        @if (invalido('nombre')) { <span class="error">El nombre es obligatorio.</span> }
      </div>
      <div class="field" [class.has-error]="invalido('email')">
        <label for="email">Correo electrónico</label>
        <input id="email" type="email" formControlName="email" autocomplete="off" required>
        @if (form.get('email')?.hasError('required') && form.get('email')?.touched) {
          <span class="error">El correo es obligatorio.</span>
        }
        @if (form.get('email')?.hasError('email') && form.get('email')?.touched) {
          <span class="error">Ingresa un correo válido.</span>
        }
      </div>
      @if (!data.rolFijo) {
        <div class="field" [class.has-error]="invalido('rolNombre')">
          <label for="rolNombre">Rol</label>
          <select id="rolNombre" formControlName="rolNombre" required>
            <option value="" disabled>Selecciona un rol</option>
            @for (rol of data.roles; track rol.id) {
              <option [value]="rol.nombre">{{ rol.nombre }}</option>
            }
          </select>
        </div>
      }
      <div class="field" [class.has-error]="invalido('password')">
        <label for="password">{{ esEdicion ? 'Nueva contraseña (opcional)' : 'Contraseña' }}</label>
        <input id="password" type="password" formControlName="password" autocomplete="new-password">
        <span class="hint">Mínimo 8 caracteres{{ esEdicion ? '. Déjalo vacío para no cambiarla.' : '.' }}</span>
        @if (form.get('password')?.hasError('minlength') && form.get('password')?.touched) {
          <span class="error">Debe tener al menos 8 caracteres.</span>
        }
      </div>

      @if (errorServidor()) {
        <p class="server-error" role="alert">{{ errorServidor() }}</p>
      }

      <div class="dialog-foot">
        <button type="button" class="btn" (click)="dialogRef.close()">Cancelar</button>
        <button type="submit" class="btn primary" [disabled]="form.invalid || enviando()">
          {{ enviando() ? 'Guardando…' : (esEdicion ? 'Guardar cambios' : 'Crear usuario') }}
        </button>
      </div>
    </form>
  `,
  styles: `
    :host {
      display: block;
      width: min(26rem, 100%);
      background: var(--color-surface);
      border-radius: var(--radius-dialog);
      box-shadow: var(--shadow-overlay);
    }
    .dialog-head {
      display: flex; justify-content: space-between; align-items: flex-start;
      padding: var(--space-6) var(--space-6) 0;
    }
    .dialog-head h2 { font-size: var(--font-size-lg); margin: 0; }
    .close {
      border: 1px solid var(--color-border); background: var(--color-surface);
      border-radius: var(--radius-control); width: 2rem; height: 2rem; font-size: 1.1rem; line-height: 1;
    }
    .dialog-body { padding: var(--space-6); }
    .server-error {
      background: var(--color-danger-bg); color: var(--color-danger);
      border-radius: var(--radius-control); padding: var(--space-3);
      font-size: var(--font-size-sm); margin: 0 0 var(--space-4);
    }
    .dialog-foot { display: flex; justify-content: flex-end; gap: var(--space-2); margin-top: var(--space-4); }
  `
})
export class UsuarioFormDialog {
  protected readonly dialogRef = inject(DialogRef<UsuarioResponse | undefined>);
  protected readonly data = inject<UsuarioFormDialogData>(DIALOG_DATA);
  private readonly fb = inject(FormBuilder);
  private readonly usuariosApi = inject(UsuariosApi);

  protected readonly esEdicion = !!this.data.usuario;
  protected readonly enviando = signal(false);
  protected readonly errorServidor = signal<string | null>(null);

  protected readonly form = this.fb.group({
    nombre: this.fb.nonNullable.control(this.data.usuario?.nombre ?? '', Validators.required),
    email: this.fb.nonNullable.control(this.data.usuario?.email ?? '', [Validators.required, Validators.email]),
    rolNombre: this.fb.nonNullable.control(
      this.data.rolFijo ?? this.data.usuario?.rolNombre ?? '',
      Validators.required
    ),
    password: this.fb.nonNullable.control(
      '',
      this.esEdicion ? [Validators.minLength(8)] : [Validators.required, Validators.minLength(8)]
    )
  });

  protected invalido(campo: 'nombre' | 'email' | 'rolNombre' | 'password'): boolean {
    const control = this.form.get(campo);
    return !!control && control.invalid && control.touched;
  }

  enviar(): void {
    if (this.form.invalid || this.enviando()) {
      this.form.markAllAsTouched();
      return;
    }
    this.enviando.set(true);
    this.errorServidor.set(null);
    const { nombre, email, rolNombre, password } = this.form.getRawValue();

    const peticion = this.esEdicion
      ? this.usuariosApi.actualizar(this.data.usuario!.id, {
          nombre,
          email,
          rolNombre: (this.data.rolFijo ?? rolNombre) as UsuarioResponse['rolNombre'],
          ...(password ? { nuevaPassword: password } : {})
        })
      : this.usuariosApi.crear({
          nombre,
          email,
          password,
          rolNombre: (this.data.rolFijo ?? rolNombre) as UsuarioResponse['rolNombre']
        });

    peticion.subscribe({
      next: (usuario) => this.dialogRef.close(usuario),
      error: (error) => {
        this.enviando.set(false);
        this.errorServidor.set(mapHttpError(error).mensaje);
      }
    });
  }
}
