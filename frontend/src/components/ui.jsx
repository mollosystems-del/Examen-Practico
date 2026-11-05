import { useEffect, useRef } from 'react';
import { Package, LoaderCircle, X, Search, ChevronLeft, ChevronRight } from 'lucide-react';
import { STATUS } from '../constants';
export function Brand({ dark = false }) {
  return (
    <div className={`brand ${dark ? 'dark' : ''}`}>
      <span className="brand-symbol">✚</span>
      <span>
        farma<span className="brand-dot">.</span>
      </span>
    </div>
  );
}
export function Badge({ status, children, className = '' }) {
  const s = STATUS[status];
  return (
    <span className={`badge ${s?.class || className}`}>
      <i />
      {children || s?.label}
    </span>
  );
}
export function Empty({
  title = 'No hay registros para mostrar',
  text = 'Prueba con otra búsqueda o registra un nuevo elemento.',
  action,
}) {
  return (
    <div className="empty">
      <span>
        <Package size={27} />
      </span>
      <h3>{title}</h3>
      <p>{text}</p>
      {action}
    </div>
  );
}
export function Loading() {
  return (
    <div className="loading">
      <LoaderCircle className="spin" size={24} />
      <span>Cargando tu inventario…</span>
    </div>
  );
}
export function Field({ label, children, hint, className = '' }) {
  return (
    <label className={`field ${className}`}>
      <span>{label}</span>
      {children}
      {hint && <small>{hint}</small>}
    </label>
  );
}
export function Modal({ title, subtitle, children, onClose, wide = false }) {
  const ref = useRef();
  useEffect(() => {
    const previous = document.activeElement;
    ref.current.showModal();
    ref.current.querySelector('input:not([disabled]),select:not([disabled]),textarea')?.focus();
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
      previous?.focus?.();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      aria-labelledby="modal-title"
      aria-describedby="modal-description"
      className={`modal ${wide ? 'wide' : ''}`}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
    >
      <div className="modal-heading">
        <div>
          <h2 id="modal-title">{title}</h2>
          <p id="modal-description">{subtitle}</p>
        </div>
        <button className="icon-btn" aria-label="Cerrar ventana" onClick={onClose}>
          <X size={20} />
        </button>
      </div>
      {children}
    </dialog>
  );
}
export function Toolbar({ q, setQ, placeholder, children, count }) {
  return (
    <div className="toolbar">
      <div className="search-input">
        <Search size={17} />
        <input
          aria-label="Buscar registros"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={placeholder}
        />
        {q && (
          <button aria-label="Limpiar búsqueda" onClick={() => setQ('')}>
            <X size={15} />
          </button>
        )}
      </div>
      {children}
      {count !== undefined && <span className="result-count">{count} estantes encontrados</span>}
    </div>
  );
}
export function Pagination({ page, pages, total, setPage }) {
  return (
    <div className="pagination">
      <span>
        {total
          ? `Mostrando ${(page - 1) * 8 + 1}–${Math.min(page * 8, total)} de ${total} registros`
          : '0 registros'}
      </span>
      <div>
        <button
          className="icon-btn"
          disabled={page <= 1}
          onClick={() => setPage(page - 1)}
          aria-label="Página anterior"
        >
          <ChevronLeft size={17} />
        </button>
        <span>
          Página <strong>{page}</strong> de {pages}
        </span>
        <button
          className="icon-btn"
          disabled={page >= pages}
          onClick={() => setPage(page + 1)}
          aria-label="Página siguiente"
        >
          <ChevronRight size={17} />
        </button>
      </div>
    </div>
  );
}
