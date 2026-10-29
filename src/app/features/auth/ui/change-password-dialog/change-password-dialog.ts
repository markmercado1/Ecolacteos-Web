import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { ReactiveFormsModule, FormBuilder, Validators, AbstractControl, ValidationErrors } from '@angular/forms';
import { DialogRef } from '@angular/cdk/dialog';
import { AuthService } from '../../../../core/auth/auth.service';
import { mapHttpError } from '../../../../core/http/app-error';
import { ToastService } from '../../../../shared/ui/toast/toast.service';

function coincidenValidator(control: AbstractControl): ValidationErrors | null {
  const nueva = control.get('passwordNueva')?.value;
  const confirmacion = control.get('confirmacion')?.value;
  return nueva && confirmacion && nueva !== confirmacion ? { noCoincide: true } : null;
}

@Component({
  selector: 'app-change-password-dialog',
  imports: [ReactiveFormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="dialog-head">
      <h2 id="cambiar-password-titulo">Cambiar contraseña</h2>
      <button type="button" class="close" (click)="dialogRef.close()" aria-label="Cerrar">×</button>
    </div>
    <form [formGroup]="form" (ngSubmit)="enviar()" class="dialog-body" aria-labelledby="cambiar-password-titulo">
      <div class="field" [class.has-error]="form.get('passwordActual')?.invalid && form.get('passwordActual')?.touched">
        <label for="passwordActual">Contraseña actual</label>
        <input id="passwordActual" type="password" formControlName="passwordActual" autocomplete="current-password" required>
      </div>
      <div class="field" [class.has-error]="form.get('passwordNueva')?.invalid && form.get('passwordNueva')?.touched">
        <label for="passwordNueva">Contraseña nueva</label>
        <input id="passwordNueva" type="password" formControlName="passwordNueva" autocomplete="new-password" required>
        <span class="hint">Mínimo 8 caracteres.</span>
        @if (form.get('passwordNueva')?.hasError('minlength') && form.get('passwordNueva')?.touched) {
          <span class="error">Debe tener al menos 8 caracteres.</span>
        }
      </div>
      <div class="field" [class.has-error]="form.hasError('noCoincide') && form.get('confirmacion')?.touched">
        <label for="confirmacion">Confirmar contraseña nueva</label>
        <input id="confirmacion" type="password" formControlName="confirmacion" autocomplete="new-password" required>
        @if (form.hasError('noCoincide') && form.get('confirmacion')?.touched) {
          <span class="error">Las contraseñas no coinciden.</span>
        }
      </div>
      @if (errorServidor()) {
        <p class="error" role="alert">{{ errorServidor() }}</p>
      }
      <div class="dialog-foot">
        <button type="button" class="btn" (click)="dialogRef.close()">Cancelar</button>
        <button type="submit" class="btn primary" [disabled]="enviando()">
          {{ enviando() ? 'Guardando…' : 'Guardar cambios' }}
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
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      padding: var(--space-6) var(--space-6) 0;
    }
    .dialog-head h2 { font-size: var(--font-size-lg); margin: 0; }
    .close {
      border: 1px solid var(--color-border);
      background: var(--color-surface);
      border-radius: var(--radius-control);
      width: 2rem;
      height: 2rem;
      font-size: 1.1rem;
      line-height: 1;
    }
    .dialog-body { padding: var(--space-6); }
    .dialog-foot {
      display: flex;
      justify-content: flex-end;
      gap: var(--space-2);
      margin-top: var(--space-4);
    }
  `
})
export class ChangePasswordDialog {
  protected readonly dialogRef = inject(DialogRef<void>);
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);

  protected readonly enviando = signal(false);
  protected readonly errorServidor = signal<string | null>(null);

  protected readonly form = this.fb.group(
    {
      passwordActual: this.fb.nonNullable.control('', Validators.required),
      passwordNueva: this.fb.nonNullable.control('', [Validators.required, Validators.minLength(8)]),
      confirmacion: this.fb.nonNullable.control('', Validators.required)
    },
    { validators: coincidenValidator }
  );

  enviar(): void {
    if (this.form.invalid || this.enviando()) {
      this.form.markAllAsTouched();
      return;
    }
    this.enviando.set(true);
    this.errorServidor.set(null);
    const { passwordActual, passwordNueva } = this.form.getRawValue();
    this.auth.cambiarPassword({ passwordActual, passwordNueva }).subscribe({
      next: () => {
        this.toast.exito('Contraseña actualizada.');
        this.dialogRef.close();
      },
      error: (error) => {
        this.enviando.set(false);
        this.errorServidor.set(mapHttpError(error).mensaje);
      }
    });
  }
}
