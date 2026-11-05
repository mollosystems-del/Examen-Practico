import { useState } from 'react';
import { LoaderCircle, Check, Package, Trash2, AlertTriangle } from 'lucide-react';
import { api, today, number } from '../api';
import { Field, Modal } from './ui';
export function Editor({ modal, products, shelves, onClose, onSaved }) {
  const { type, record } = modal;
  const kind = type === 'product' ? 'products' : type === 'shelf' ? 'shelves' : 'batches';
  const [values, setValues] = useState(() =>
    type === 'product'
      ? { name: '', description: '', category: '', purchasePrice: '', salePrice: '', minStock: '', ...record }
      : type === 'shelf'
        ? { code: '', name: '', location: '', description: '', ...record }
        : type === 'adjust'
          ? { delta: '', reason: '', direction: 'out' }
          : {
              productId: '',
              shelfId: '',
              batchNumber: '',
              entryDate: today(),
              expiryDate: '',
              quantity: '',
              ...record,
            },
  );
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [fieldErrors, setFieldErrors] = useState([]);
  const set = (name, value) => setValues((old) => ({ ...old, [name]: value }));
  const input = (name, extra = {}) => (
    <input
      name={name}
      value={values[name] ?? ''}
      onChange={(e) => set(name, e.target.value)}
      required
      {...extra}
    />
  );
  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    setFieldErrors([]);
    let body;
    if (type === 'product')
      body = {
        name: values.name,
        description: values.description,
        category: values.category,
        purchasePrice: Number(values.purchasePrice),
        salePrice: Number(values.salePrice),
        minStock: Number(values.minStock),
      };
    else if (type === 'shelf')
      body = {
        code: values.code,
        name: values.name,
        location: values.location,
        description: values.description,
      };
    else if (type === 'adjust')
      body = { delta: Number(values.delta) * (values.direction === 'out' ? -1 : 1), reason: values.reason };
    else
      body = {
        productId: Number(values.productId),
        shelfId: Number(values.shelfId),
        batchNumber: values.batchNumber,
        entryDate: values.entryDate.slice(0, 10),
        expiryDate: values.expiryDate.slice(0, 10),
        quantity: Number(values.quantity),
      };
    try {
      await api(
        type === 'adjust' ? `/batches/${record.id}/adjust` : `/${kind}${record ? `/${record.id}` : ''}`,
        { method: type === 'adjust' || !record ? 'POST' : 'PUT', body: JSON.stringify(body) },
      );
      onSaved(
        type === 'adjust'
          ? 'Stock ajustado correctamente.'
          : record
            ? 'Cambios guardados correctamente.'
            : 'Registro creado correctamente.',
      );
    } catch (e) {
      setError(e.message);
      setFieldErrors(e.fields || []);
    } finally {
      setBusy(false);
    }
  }
  const title =
    type === 'adjust'
      ? 'Ajustar existencias'
      : `${record ? 'Editar' : 'Registrar'} ${type === 'product' ? 'producto' : type === 'shelf' ? 'estante' : 'lote'}`;
  return (
    <Modal
      title={title}
      subtitle={
        type === 'adjust'
          ? `${record.productName} · ${record.batchNumber}`
          : 'Completa la información para mantener tu inventario al día.'
      }
      onClose={() => !busy && onClose()}
    >
      <form onSubmit={submit}>
        {error && (
          <div className="form-error" role="alert">
            <AlertTriangle size={18} />
            <div>
              {error}
              {fieldErrors.length > 0 && (
                <ul>
                  {fieldErrors.map((f, i) => (
                    <li key={i}>
                      {f.field}: {f.message}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
        <div className="form-grid">
          {type === 'product' && (
            <>
              <Field label="Nombre del producto *" className="full">
                {input('name', {
                  minLength: 2,
                  maxLength: 150,
                  placeholder: 'Ej. Paracetamol 500 mg',
                  autoFocus: true,
                })}
              </Field>
              <Field label="Categoría *" className="full">
                {input('category', {
                  list: 'categories',
                  minLength: 2,
                  maxLength: 80,
                  placeholder: 'Selecciona o escribe una categoría',
                })}
                <datalist id="categories">
                  {[
                    ...new Set([
                      'Analgésicos',
                      'Antibióticos',
                      'Antialérgicos',
                      'Gastrointestinales',
                      'Vitaminas',
                      'Primeros auxilios',
                      ...products.map((p) => p.category),
                    ]),
                  ].map((c) => (
                    <option key={c} value={c} />
                  ))}
                </datalist>
              </Field>
              <Field label="Precio de compra (Bs) *">
                {input('purchasePrice', {
                  type: 'number',
                  min: 0,
                  max: 99999999.99,
                  step: '0.01',
                  placeholder: '0,00',
                })}
              </Field>
              <Field label="Precio de venta (Bs) *">
                {input('salePrice', {
                  type: 'number',
                  min: 0,
                  max: 99999999.99,
                  step: '0.01',
                  placeholder: '0,00',
                })}
              </Field>
              <Field
                label="Stock mínimo *"
                className="full"
                hint="Recibirás una alerta cuando las unidades utilizables estén por debajo de este valor."
              >
                {input('minStock', { type: 'number', min: 0, max: 10000000, step: 1, placeholder: 'Ej. 30' })}
              </Field>
              <Field label="Descripción" className="full">
                <textarea
                  value={values.description}
                  onChange={(e) => set('description', e.target.value)}
                  maxLength={1000}
                  rows={3}
                  placeholder="Presentación, concentración u otra información útil"
                />
              </Field>
            </>
          )}
          {type === 'shelf' && (
            <>
              <Field label="Código único *">
                {input('code', {
                  minLength: 2,
                  maxLength: 30,
                  pattern: '[A-Za-z0-9_-]+',
                  placeholder: 'EST-A01',
                  autoFocus: true,
                })}
              </Field>
              <Field label="Nombre *">
                {input('name', { minLength: 2, maxLength: 100, placeholder: 'Medicamentos generales' })}
              </Field>
              <Field label="Ubicación *" className="full">
                {input('location', { minLength: 2, maxLength: 200, placeholder: 'Pasillo A · Nivel 1' })}
              </Field>
              <Field label="Descripción" className="full">
                <textarea
                  value={values.description}
                  onChange={(e) => set('description', e.target.value)}
                  maxLength={1000}
                  rows={3}
                  placeholder="¿Qué se almacena aquí?"
                />
              </Field>
            </>
          )}
          {type === 'batch' && (
            <>
              <Field label="Producto *" className="full">
                <select
                  value={values.productId}
                  onChange={(e) => set('productId', e.target.value)}
                  required
                  disabled={!!record}
                  autoFocus
                >
                  <option value="">Selecciona un producto</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Número de lote *">
                {input('batchNumber', { minLength: 2, maxLength: 60, placeholder: 'Ej. PAR-2603' })}
              </Field>
              <Field label="Estante *">
                <select value={values.shelfId} onChange={(e) => set('shelfId', e.target.value)} required>
                  <option value="">Selecciona un estante</option>
                  {shelves.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.code} · {s.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Fecha de ingreso *">
                {input('entryDate', { type: 'date', value: values.entryDate.slice(0, 10), max: today() })}
              </Field>
              <Field label="Fecha de vencimiento *">
                {input('expiryDate', {
                  type: 'date',
                  value: values.expiryDate.slice(0, 10),
                  min: values.entryDate.slice(0, 10),
                })}
              </Field>
              <Field
                label="Cantidad disponible *"
                className="full"
                hint={
                  record
                    ? 'Para cambiar las unidades, usa la opción Ajustar stock del lote.'
                    : 'Unidades que ingresan al inventario.'
                }
              >
                {input('quantity', { type: 'number', min: 0, max: 10000000, step: 1, readOnly: !!record })}
              </Field>
            </>
          )}
          {type === 'adjust' && (
            <>
              <div className="stock-preview full">
                <Package size={23} />
                <div>
                  Existencias actuales<strong>{number(record.quantity)} unidades</strong>
                </div>
              </div>
              <Field label="Tipo de movimiento *">
                <select value={values.direction} onChange={(e) => set('direction', e.target.value)}>
                  <option value="out">Salida de unidades</option>
                  <option value="in">Entrada de unidades</option>
                </select>
              </Field>
              <Field label="Cantidad *">
                {input('delta', {
                  type: 'number',
                  min: 1,
                  max: values.direction === 'out' ? record.quantity : 10000000,
                  step: 1,
                  placeholder: '0',
                  autoFocus: true,
                })}
              </Field>
              <Field
                label="Motivo del ajuste *"
                className="full"
                hint="Este movimiento quedará registrado en el historial."
              >
                <textarea
                  value={values.reason}
                  onChange={(e) => set('reason', e.target.value)}
                  minLength={5}
                  maxLength={300}
                  rows={3}
                  placeholder="Ej. Retiro de unidades vencidas"
                  required
                />
              </Field>
              <div className="adjust-total full">
                Stock después del ajuste{' '}
                <strong>
                  {number(
                    record.quantity + (Number(values.delta) || 0) * (values.direction === 'out' ? -1 : 1),
                  )}{' '}
                  uds.
                </strong>
              </div>
            </>
          )}
        </div>
        <div className="modal-footer">
          <button className="btn secondary" type="button" disabled={busy} onClick={onClose}>
            Cancelar
          </button>
          <button className="btn primary" disabled={busy}>
            {busy ? <LoaderCircle className="spin" size={17} /> : <Check size={17} />}
            {type === 'adjust' ? 'Confirmar ajuste' : record ? 'Guardar cambios' : 'Guardar registro'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

export function DeleteDialog({ modal, onClose, onSaved }) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  async function remove() {
    setBusy(true);
    setError('');
    try {
      await api(`/${modal.kind}/${modal.record.id}`, { method: 'DELETE' });
      onSaved('Registro eliminado correctamente.');
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal
      title="Eliminar registro"
      subtitle="Esta acción elimina el registro seleccionado."
      onClose={() => !busy && onClose()}
    >
      <div className="delete-body">
        <span className="delete-icon">
          <Trash2 size={26} />
        </span>
        <h3>{modal.record.name || modal.record.batchNumber}</h3>
        <p>
          {modal.kind === 'batches'
            ? 'Solo se pueden eliminar lotes sin existencias. El historial de movimientos se conservará.'
            : 'Solo se puede eliminar si no tiene lotes asociados.'}
        </p>
        {error && (
          <div className="form-error" role="alert">
            {error}
          </div>
        )}
      </div>
      <div className="modal-footer">
        <button className="btn secondary" onClick={onClose} disabled={busy}>
          Cancelar
        </button>
        <button className="btn destructive" onClick={remove} disabled={busy}>
          {busy ? <LoaderCircle className="spin" size={17} /> : <Trash2 size={16} />}Eliminar registro
        </button>
      </div>
    </Modal>
  );
}
