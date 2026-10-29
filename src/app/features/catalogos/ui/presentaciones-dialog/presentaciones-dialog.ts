import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { AbstractControl, FormBuilder, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { Observable, catchError, map, of, switchMap } from 'rxjs';
import { mapHttpError } from '../../../../core/http/app-error';
import { PresentacionResponse, ProductoResponse, UnidadContenido } from '../../data-access/producto.models';
import { ProductosApi } from '../../data-access/productos.api';
import { urlFotoCatalogo } from '../../data-access/foto-catalogo';
import { FotoCambio, FotoCampo } from '../foto-campo/foto-campo';

export interface PresentacionesDialogData {
  producto: ProductoResponse;
  /** true solo cuando este diálogo se abre inmediatamente después de crear el producto (ver
   *  CatalogosPage.nuevoProducto()) -- muestra la confirmación de creación; false en el acceso normal
   *  desde la acción "Presentaciones" de un producto ya existente. */
  recienCreado?: boolean;
}

type Paso = 'lista' | 'formulario';

/** Contenido y unidad vienen juntos o ninguno (mismo criterio que PresentacionService en el backend). */
function contenidoCoherente(grupo: AbstractControl): ValidationErrors | null {
  const cantidad = grupo.get('contenidoCantidad')?.value as number | null;
  const unidad = grupo.get('contenidoUnidad')?.value as string | null;
  const hayCantidad = cantidad !== null && cantidad !== undefined;
  if (hayCantidad && !unidad) return { contenidoSinUnidad: true };
  if (!hayCantidad && unidad) return { contenidoSinCantidad: true };
  return null;
}

const ETIQUETAS_UNIDAD: Record<UnidadContenido, string> = {
  ML: 'Mililitro',
  L: 'Litro',
  G: 'Gramo',
  KG: 'Kilogramo'
};

/**
 * Fase 1 (Producto + Presentación) -- corrección de UX: gestión de presentaciones separada del formulario
 * de producto, en su propio diálogo. Un único diálogo con dos "pantallas" internas (lista/formulario) en
 * vez de dos modales apilados: agregar/editar cambia a la pantalla de formulario y "Cancelar"/guardar
 * regresa a la lista, sin abrir un segundo overlay encima de este.
 *
 * Crear/editar una presentación NO toca el producto -- reintentar tras un error nunca vuelve a crearlo.
 */
@Component({
  selector: 'app-presentaciones-dialog',
  imports: [ReactiveFormsModule, FotoCampo],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (paso() === 'lista') {
      <div class="dialog-head">
        <h2 id="presentaciones-titulo">Presentaciones de {{ producto().nombre }}</h2>
        <button type="button" class="close" (click)="finalizar()" aria-label="Cerrar">×</button>
      </div>
      <div class="dialog-body" aria-labelledby="presentaciones-titulo">
        @if (data.recienCreado) {
          <p class="confirmacion" role="status">✓ Producto "{{ producto().nombre }}" creado. Ahora puedes agregar sus presentaciones.</p>
        }
        <p class="hint">Cómo se cuenta, almacena y vende este producto. Agregar una presentación no genera stock ni precio.</p>

        @if (producto().presentaciones.length === 0) {
          <p class="hint">Sin presentaciones todavía.</p>
        } @else {
          <ul class="lista-presentaciones">
            @for (p of producto().presentaciones; track p.id) {
              <li [class.inactiva]="!p.activo">
                @if (urlFoto(p.fotoUrl); as foto) { <img class="miniatura" [src]="foto" alt="" /> }
                <div class="info">
                  <span class="nombre">{{ p.nombre }}</span>
                  <span class="detalle">
                    @if (p.contenidoCantidad !== null) { {{ p.contenidoCantidad }} {{ etiquetaUnidad(p.contenidoUnidad) }} · }
                    {{ p.unidadConteo }}
                    @if (!p.activo) { · inactiva }
                  </span>
                </div>
                <div class="acciones">
                  <button type="button" class="row-link" (click)="abrirEditar(p)">Editar</button>
                  <button type="button" class="row-link" (click)="alternarActivo(p)">{{ p.activo ? 'Desactivar' : 'Reactivar' }}</button>
                </div>
              </li>
            }
          </ul>
        }

        @if (errorAccion()) { <p class="server-error" role="alert">{{ errorAccion() }}</p> }

        <div class="dialog-foot">
          <button type="button" class="btn" (click)="abrirAgregar()">Agregar presentación</button>
          <button type="button" class="btn primary" (click)="finalizar()">Finalizar</button>
        </div>
      </div>
    }

    @if (paso() === 'formulario') {
      <div class="dialog-head">
        <h2 id="presentacion-form-titulo">{{ editando() ? 'Editar presentación' : 'Nueva presentación' }}</h2>
        <button type="button" class="close" (click)="volverALista()" aria-label="Cerrar">×</button>
      </div>
      <form [formGroup]="form" (ngSubmit)="guardarPresentacion()" class="dialog-body" aria-labelledby="presentacion-form-titulo">
        <p class="hint">Producto: {{ producto().nombre }}</p>

        <div class="field" [class.has-error]="invalido('nombre')">
          <label for="p-nombre">Nombre de la presentación</label>
          <input id="p-nombre" type="text" formControlName="nombre" maxlength="60" placeholder="Botella de 1 L" required>
          @if (invalido('nombre')) { <span class="error">Ingresa un nombre (máximo 60 caracteres).</span> }
        </div>

        <div class="field-row">
          <div class="field">
            <label for="p-cantidad">Contenido — opcional</label>
            <input id="p-cantidad" type="number" min="0.001" max="9999999.999" step="0.001" formControlName="contenidoCantidad" placeholder="1">
          </div>
          <div class="field">
            <label for="p-unidad">Unidad de contenido</label>
            <select id="p-unidad" formControlName="contenidoUnidad">
              <option value="">—</option>
              <option value="ML">Mililitro</option>
              <option value="L">Litro</option>
              <option value="G">Gramo</option>
              <option value="KG">Kilogramo</option>
            </select>
          </div>
        </div>

        @if (form.hasError('contenidoSinUnidad')) {
          <p class="error" role="alert">Elige la unidad del contenido o deja vacía la cantidad.</p>
        }
        @if (form.hasError('contenidoSinCantidad')) {
          <p class="error" role="alert">Indica la cantidad del contenido o quita la unidad.</p>
        }

        <div class="field" [class.has-error]="invalido('unidadConteo')">
          <label for="p-conteo">Unidad de conteo</label>
          <input id="p-conteo" type="text" formControlName="unidadConteo" maxlength="30" placeholder="Botella" required>
          @if (invalido('unidadConteo')) { <span class="error">Ingresa la unidad de conteo (botella, frasco, pieza…).</span> }
        </div>

        <app-foto-campo
          etiqueta="Foto de la presentación — opcional"
          [fotoUrl]="editando()?.fotoUrl"
          ayuda="Si no subes una, el catálogo usa la foto del producto."
          (cambio)="fotoCambio = $event"
        />

        @if (errorForm()) { <p class="server-error" role="alert">{{ errorForm() }}</p> }

        <div class="dialog-foot">
          <button type="button" class="btn" (click)="volverALista()" [disabled]="enviando()">Cancelar</button>
          <button type="submit" class="btn primary" [disabled]="enviando()">
            {{ enviando() ? 'Guardando…' : 'Guardar presentación' }}
          </button>
        </div>
      </form>
    }
  `,
  styles: `
    :host {
      display: block; width: min(28rem, 100%); background: var(--color-surface);
      border-radius: var(--radius-dialog); box-shadow: var(--shadow-overlay); max-height: 90vh; overflow: auto;
    }
    .dialog-head { display: flex; justify-content: space-between; align-items: flex-start; padding: var(--space-6) var(--space-6) 0; }
    .dialog-head h2 { font-size: var(--font-size-lg); margin: 0; }
    .close { border: 1px solid var(--color-border); background: var(--color-surface); border-radius: var(--radius-control); width: 2rem; height: 2rem; font-size: 1.1rem; line-height: 1; flex: none; }
    .dialog-body { padding: var(--space-6); }
    .confirmacion { color: var(--color-success); font-weight: 600; margin: 0 0 var(--space-3); }
    .hint { color: var(--color-text-muted); font-size: var(--font-size-sm); margin: 0 0 var(--space-3); }
    .error { color: var(--color-danger); font-size: var(--font-size-sm); }
    .server-error { background: var(--color-danger-bg); color: var(--color-danger); border-radius: var(--radius-control); padding: var(--space-3); font-size: var(--font-size-sm); margin: var(--space-3) 0; }
    .dialog-foot { display: flex; justify-content: flex-end; gap: var(--space-2); margin-top: var(--space-4); }
    .field { margin-bottom: var(--space-4); }
    .field-row { display: flex; gap: var(--space-3); }
    .field-row .field { flex: 1; }
    label { display: block; font-size: var(--font-size-sm); font-weight: 600; margin-bottom: var(--space-1); }
    input, select { width: 100%; padding: var(--space-2); border: 1px solid var(--color-border); border-radius: var(--radius-control); }
    .lista-presentaciones { list-style: none; margin: 0 0 var(--space-4); padding: 0; display: flex; flex-direction: column; gap: var(--space-2); }
    .lista-presentaciones li { display: flex; align-items: center; justify-content: space-between; gap: var(--space-3); padding: var(--space-3); border: 1px solid var(--color-border); border-radius: var(--radius-control); }
    .lista-presentaciones li.inactiva { opacity: 0.6; }
    .lista-presentaciones .info { display: flex; flex-direction: column; flex: 1; }
    .lista-presentaciones .miniatura { width: 2.5rem; height: 2.5rem; object-fit: cover; border-radius: var(--radius-control); border: 1px solid var(--color-border); flex: none; }
    .lista-presentaciones .nombre { font-weight: 600; }
    .lista-presentaciones .detalle { color: var(--color-text-muted); font-size: var(--font-size-sm); }
    .lista-presentaciones .acciones { display: flex; gap: var(--space-2); flex: none; }
  `
})
export class PresentacionesDialog {
  protected readonly dialogRef = inject(DialogRef<boolean>);
  protected readonly data = inject<PresentacionesDialogData>(DIALOG_DATA);
  private readonly fb = inject(FormBuilder);
  private readonly productosApi = inject(ProductosApi);

  protected readonly producto = signal<ProductoResponse>(this.data.producto);
  /** true si se agregó/editó/activó/desactivó al menos una presentación -- la página recarga solo si hubo cambios. */
  private readonly huboCambios = signal(false);

  protected readonly paso = signal<Paso>('lista');
  protected readonly editando = signal<PresentacionResponse | null>(null);

  protected readonly errorAccion = signal<string | null>(null);
  protected readonly enviando = signal(false);
  protected readonly errorForm = signal<string | null>(null);

  /** Foto elegida/quitada en el formulario; se aplica DESPUÉS de guardar la presentación. */
  protected fotoCambio: FotoCambio = { archivo: null, quitar: false };

  protected readonly form = this.fb.group(
    {
      nombre: this.fb.nonNullable.control('', [Validators.required, Validators.pattern(/\S/), Validators.maxLength(60)]),
      contenidoCantidad: this.fb.control<number | null>(null, [Validators.min(0.001), Validators.max(9999999.999)]),
      contenidoUnidad: this.fb.nonNullable.control(''),
      unidadConteo: this.fb.nonNullable.control('', [Validators.required, Validators.pattern(/\S/), Validators.maxLength(30)])
    },
    { validators: contenidoCoherente }
  );

  protected urlFoto(fotoUrl: string | null | undefined): string | null {
    return urlFotoCatalogo(fotoUrl);
  }

  protected etiquetaUnidad(unidad: UnidadContenido | null): string {
    return unidad ? ETIQUETAS_UNIDAD[unidad] : '';
  }

  protected invalido(campo: 'nombre' | 'unidadConteo'): boolean {
    const control = this.form.get(campo);
    return !!control && control.invalid && control.touched;
  }

  protected abrirAgregar(): void {
    this.editando.set(null);
    this.errorForm.set(null);
    this.fotoCambio = { archivo: null, quitar: false };
    this.form.reset({ nombre: '', contenidoCantidad: null, contenidoUnidad: '', unidadConteo: '' });
    this.paso.set('formulario');
  }

  protected abrirEditar(presentacion: PresentacionResponse): void {
    this.editando.set(presentacion);
    this.errorForm.set(null);
    this.fotoCambio = { archivo: null, quitar: false };
    this.form.reset({
      nombre: presentacion.nombre,
      contenidoCantidad: presentacion.contenidoCantidad,
      contenidoUnidad: presentacion.contenidoUnidad ?? '',
      unidadConteo: presentacion.unidadConteo
    });
    this.paso.set('formulario');
  }

  /** Regresa a la lista sin guardar -- nunca cierra el diálogo completo (evita perder de vista el producto ya creado). */
  protected volverALista(): void {
    if (this.enviando()) return;
    this.paso.set('lista');
    this.errorForm.set(null);
  }

  protected guardarPresentacion(): void {
    if (this.form.invalid || this.enviando()) {
      this.form.markAllAsTouched();
      return;
    }
    this.enviando.set(true);
    this.errorForm.set(null);
    const { nombre, contenidoCantidad, contenidoUnidad, unidadConteo } = this.form.getRawValue();
    const datos = {
      nombre: nombre.trim(),
      contenidoCantidad: contenidoCantidad ?? null,
      contenidoUnidad: contenidoUnidad ? (contenidoUnidad as UnidadContenido) : null,
      unidadConteo: unidadConteo.trim()
    };

    const productoId = this.producto().id;
    const editando = this.editando();
    // Editar/crear una presentación nunca vuelve a crear el producto -- reintentar tras un error de red
    // solo reenvía esta misma llamada, sin tocar ProductosApi.crear/actualizar.
    const peticion = editando
      ? this.productosApi.actualizarPresentacion(productoId, editando.id, datos)
      : this.productosApi.crearPresentacion(productoId, datos);

    peticion.pipe(switchMap((presentacion) => this.aplicarFoto(productoId, presentacion))).subscribe({
      next: ({ presentacion, errorFoto }) => {
        this.enviando.set(false);
        this.huboCambios.set(true);
        this.producto.update((p) => ({
          ...p,
          presentaciones: editando
            ? p.presentaciones.map((x) => (x.id === presentacion.id ? presentacion : x))
            : [...p.presentaciones, presentacion]
        }));
        // Si la foto falló, la presentación YA quedó guardada: se avisa en la lista (reintentar el alta
        // la duplicaría); la foto se corrige con "Editar".
        this.errorAccion.set(errorFoto ? `La presentación se guardó, pero la foto no: ${errorFoto}` : null);
        this.paso.set('lista');
      },
      error: (error) => {
        this.enviando.set(false);
        this.errorForm.set(mapHttpError(error).mensaje);
      }
    });
  }

  private aplicarFoto(
    productoId: string,
    presentacion: PresentacionResponse
  ): Observable<{ presentacion: PresentacionResponse; errorFoto?: string }> {
    const { archivo, quitar } = this.fotoCambio;
    let accion: Observable<PresentacionResponse> | null = null;
    if (archivo) accion = this.productosApi.subirFotoPresentacion(productoId, presentacion.id, archivo);
    else if (quitar && presentacion.fotoUrl) accion = this.productosApi.quitarFotoPresentacion(productoId, presentacion.id);
    if (!accion) return of({ presentacion });
    return accion.pipe(
      map((conFoto) => ({ presentacion: conFoto })),
      catchError((error) => of({ presentacion, errorFoto: mapHttpError(error).mensaje }))
    );
  }

  protected alternarActivo(presentacion: PresentacionResponse): void {
    this.errorAccion.set(null);
    const productoId = this.producto().id;

    const onExito = () => {
      this.huboCambios.set(true);
      const actualizada: PresentacionResponse = { ...presentacion, activo: !presentacion.activo };
      this.producto.update((p) => ({
        ...p,
        presentaciones: p.presentaciones.map((x) => (x.id === presentacion.id ? actualizada : x))
      }));
    };
    const onError = (error: unknown) => this.errorAccion.set(mapHttpError(error).mensaje);

    if (presentacion.activo) {
      this.productosApi.desactivarPresentacion(productoId, presentacion.id).subscribe({ next: onExito, error: onError });
    } else {
      this.productosApi.reactivarPresentacion(productoId, presentacion.id).subscribe({ next: onExito, error: onError });
    }
  }

  /** El producto creado permanece siempre, con o sin presentaciones -- cerrar aquí nunca lo revierte. */
  protected finalizar(): void {
    this.dialogRef.close(this.huboCambios());
  }
}
