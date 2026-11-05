import React, { useState, useEffect } from 'react';
import {
  Package,
  Archive,
  Clock3,
  Bell,
  Plus,
  ArrowUpRight,
  ArrowDownToLine,
  ChevronDown,
  ChevronRight,
  X,
  Pencil,
  Trash2,
  MapPin,
  ShieldCheck,
  LogOut,
  Menu,
  Check,
  AlertTriangle,
  LoaderCircle,
  RefreshCw,
  SlidersHorizontal,
  CircleHelp,
  CheckCircle2,
  CalendarDays,
} from 'lucide-react';
import { api, allRecords, money, number, date, exportCsv } from './api';
import { NAV, STATUS, PRODUCT_COLUMNS, BATCH_COLUMNS } from './constants';
import { Brand, Badge, Empty, Loading, Modal, Toolbar, Pagination } from './components/ui';
import { Editor, DeleteDialog } from './components/Editor';
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
function App() {
  const [user, setUser] = useState(null),
    [checking, setChecking] = useState(true);
  const [view, setView] = useState(() =>
    NAV.some((n) => n.key === location.hash.slice(1)) ? location.hash.slice(1) : 'dashboard',
  );
  const [data, setData] = useState(null),
    [loading, setLoading] = useState(false),
    [error, setError] = useState('');
  const [q, setQ] = useState(''),
    [filter, setFilter] = useState('all'),
    [page, setPage] = useState(1),
    [modal, setModal] = useState(null),
    [toast, setToast] = useState(''),
    [sidebar, setSidebar] = useState(false),
    [userMenu, setUserMenu] = useState(false),
    [help, setHelp] = useState(false);
  useEffect(() => {
    api('/auth/me')
      .then((r) => setUser(r.data))
      .catch((e) => {
        if (e.status !== 401) setError(e.message);
      })
      .finally(() => setChecking(false));
    const expired = () => {
      setUser(null);
      setData(null);
    };
    window.addEventListener('session-expired', expired);
    return () => window.removeEventListener('session-expired', expired);
  }, []);
  useEffect(() => {
    const changed = () => {
      const key = location.hash.slice(1);
      if (NAV.some((n) => n.key === key)) {
        setView(key);
        setQ('');
        setFilter('all');
        setPage(1);
      }
    };
    window.addEventListener('hashchange', changed);
    return () => window.removeEventListener('hashchange', changed);
  }, []);
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(''), 4500);
      return () => clearTimeout(timer);
    }
  }, [toast]);
  async function load() {
    setLoading(true);
    setError('');
    try {
      const [dashboard, products, shelves, batches, movements] = await Promise.all([
        api('/dashboard'),
        allRecords('/products'),
        allRecords('/shelves'),
        allRecords('/batches'),
        allRecords('/movements'),
      ]);
      setData({ dashboard: dashboard.data, products, shelves, batches, movements });
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    if (!user) return;
    load();
    const timer = setInterval(load, 60000);
    return () => clearInterval(timer);
  }, [user]);
  function navigate(key, nextFilter = 'all') {
    if (view !== key) history.pushState(null, '', `#${key}`);
    setView(key);
    setFilter(nextFilter);
    setQ('');
    setPage(1);
    setSidebar(false);
  }
  function openEditor(type, record) {
    if (type === 'batch' && (!data?.products.length || !data?.shelves.length)) {
      setToast('Primero registra al menos un producto y un estante.');
      return;
    }
    setModal({ type, record });
  }
  function saved(message) {
    setModal(null);
    setToast(message);
    load();
  }
  async function logout() {
    try {
      await api('/auth/logout', { method: 'POST' });
      setUser(null);
      setData(null);
      setUserMenu(false);
    } catch (e) {
      setToast(e.message);
    }
  }
  if (checking)
    return (
      <div className="initial-loader">
        <Brand dark />
        <Loading />
      </div>
    );
  if (!user)
    return (
      <Login
        onLogin={(u) => {
          setError('');
          setUser(u);
        }}
      />
    );
  const title = NAV.find((n) => n.key === view)?.label;
  const source = data
    ? view === 'alerts'
      ? data.batches.filter((b) => b.quantity > 0 && b.daysToExpiry <= 90)
      : Array.isArray(data[view])
        ? data[view]
        : []
    : [];
  const rows = source.filter(
    (r) =>
      Object.values(r).some((v) =>
        String(v ?? '')
          .toLocaleLowerCase('es')
          .includes(q.toLocaleLowerCase('es')),
      ) &&
      (filter === 'all' ||
        (view === 'products'
          ? filter === 'low'
            ? r.stock < r.minStock
            : r.category === filter
          : view === 'alerts' || view === 'batches'
            ? r.status === filter
            : true)),
  );
  const pages = Math.max(1, Math.ceil(rows.length / 8)),
    safePage = Math.min(page, pages),
    paged = rows.slice((safePage - 1) * 8, safePage * 8);
  const subtitles = {
    dashboard: 'Una vista clara para tomar mejores decisiones.',
    products: 'Cada producto, su información y sus existencias en un solo lugar.',
    batches: 'Trazabilidad de cada ingreso, desde el estante hasta su vencimiento.',
    shelves: 'Un lugar para cada producto. Todo más fácil de encontrar.',
    alerts: 'Anticípate a los vencimientos y cuida tu inventario.',
    movements: 'El historial de entradas, salidas y ajustes de tu farmacia.',
  };
  function exportCurrent() {
    if (view === 'dashboard')
      exportCsv(
        'resumen',
        [
          ['Indicador', 'label'],
          ['Valor', 'value'],
        ],
        [
          { label: 'Productos', value: data.dashboard.products },
          { label: 'Unidades vigentes', value: data.dashboard.availableUnits },
          { label: 'Lotes en alerta', value: data.dashboard.alerts },
          { label: 'Valor de compra Bs', value: data.dashboard.inventoryValue },
        ],
      );
    else
      exportCsv(
        view,
        view === 'products'
          ? PRODUCT_COLUMNS
          : view === 'shelves'
            ? [
                ['Código', 'code'],
                ['Nombre', 'name'],
                ['Ubicación', 'location'],
                ['Descripción', 'description'],
                ['Lotes', 'batchCount'],
                ['Unidades', 'units'],
              ]
            : view === 'movements'
              ? [
                  ['Fecha UTC', 'createdAt'],
                  ['Producto', 'productName'],
                  ['Lote', 'batchNumber'],
                  ['Tipo', 'type'],
                  ['Variación', 'delta'],
                  ['Motivo', 'reason'],
                  ['Responsable', 'userName'],
                ]
              : BATCH_COLUMNS,
        rows,
      );
    setToast('Archivo CSV exportado correctamente.');
  }
  return (
    <div className="app-shell">
      <aside className={`sidebar ${sidebar ? 'open' : ''}`}>
        <Brand />
        <div className="workspace-label">
          <span className="workspace-icon">F</span>
          <div>
            Mi farmacia<small>Gestión de inventario</small>
          </div>
          <ChevronDown size={14} />
        </div>
        <nav aria-label="Navegación principal">
          {NAV.map((n) => (
            <React.Fragment key={n.key}>
              {n.section && <div className="nav-section">{n.section}</div>}
              <button
                className={`nav-item ${view === n.key ? 'active' : ''}`}
                onClick={() => navigate(n.key)}
                aria-current={view === n.key ? 'page' : undefined}
              >
                <n.icon size={19} />
                <span>{n.label}</span>
                {n.key === 'alerts' && data?.dashboard.alerts > 0 && (
                  <span className="nav-count">{data.dashboard.alerts}</span>
                )}
                {view === n.key && <span className="nav-active-dot" />}
              </button>
            </React.Fragment>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="care-card">
            <span>
              <ShieldCheck size={21} />
            </span>
            <h4>
              Pequeños detalles.
              <br />
              Mejor cuidado.
            </h4>
            <p>
              Un buen inventario hace
              <br />
              una gran diferencia.
            </p>
            <div className="care-decoration">✚</div>
          </div>
          <button className="help-btn" onClick={() => setHelp(true)}>
            <CircleHelp size={18} /> Guía de uso <ArrowUpRight size={15} />
          </button>
          <div className="sidebar-version">
            <span className="status-light" /> Farma Inventario <span>v1.0</span>
          </div>
        </div>
      </aside>
      {sidebar && (
        <button className="sidebar-scrim" onClick={() => setSidebar(false)} aria-label="Cerrar navegación" />
      )}
      <div className="main-shell">
        <header className="topbar">
          <div className="breadcrumb">
            <button
              className="icon-btn mobile-menu"
              aria-label="Abrir navegación"
              onClick={() => setSidebar(true)}
            >
              <Menu size={21} />
            </button>
            <span>Mi farmacia</span>
            <ChevronRight size={13} />
            <strong>{title}</strong>
          </div>
          <div className="topbar-right">
            <span className="workspace-status">
              <i /> Espacio de trabajo
            </span>
            <button
              className="notification-btn icon-btn"
              aria-label="Ver alertas de vencimiento"
              onClick={() => navigate('alerts')}
            >
              <Bell size={19} />
              {data?.dashboard.alerts > 0 && <i />}
            </button>
            <span className="topbar-divider" />
            <div className="user-area">
              <button className="user-button" onClick={() => setUserMenu(!userMenu)} aria-expanded={userMenu}>
                <span className="avatar">AD</span>
                <div>
                  {user.name}
                  <small>Gestión de farmacia</small>
                </div>
                <ChevronDown size={13} />
              </button>
              {userMenu && (
                <div className="user-dropdown">
                  <span>{user.email}</span>
                  <button onClick={logout}>
                    <LogOut size={16} />
                    Cerrar sesión
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>
        <main>
          <div className="page-heading">
            <div>
              <div className="page-eyebrow">
                {view === 'dashboard' ? (
                  <>
                    <CalendarDays size={13} />
                    {new Intl.DateTimeFormat('es-BO', {
                      weekday: 'long',
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric',
                      timeZone: 'America/La_Paz',
                    }).format(new Date())}
                  </>
                ) : (
                  <>
                    MI FARMACIA <span>/</span>{' '}
                    {view === 'alerts' || view === 'movements' ? 'SEGUIMIENTO' : 'INVENTARIO'}
                  </>
                )}
              </div>
              <h1>
                {view === 'dashboard' ? 'Tu farmacia, de un vistazo.' : title}
                <span className="heading-dot">{view === 'dashboard' ? '' : '.'}</span>
              </h1>
              <p>{subtitles[view]}</p>
            </div>
            <div className="heading-actions">
              <button className="btn secondary" onClick={exportCurrent} disabled={!data || loading}>
                <ArrowDownToLine size={16} />
                <span>Exportar</span>
              </button>
              {!['dashboard', 'alerts', 'movements'].includes(view) && (
                <button
                  className="btn primary"
                  disabled={!data}
                  onClick={() =>
                    openEditor(view === 'products' ? 'product' : view === 'shelves' ? 'shelf' : 'batch')
                  }
                >
                  <Plus size={17} />
                  {view === 'products'
                    ? 'Nuevo producto'
                    : view === 'shelves'
                      ? 'Nuevo estante'
                      : 'Registrar lote'}
                </button>
              )}
            </div>
          </div>
          {error && (
            <div className="error-banner" role="alert">
              <AlertTriangle size={19} />
              <span>{error}</span>
              <button onClick={load}>
                <RefreshCw size={16} />
                Reintentar
              </button>
            </div>
          )}
          {!data ? (
            loading ? (
              <Loading />
            ) : (
              <Empty
                title="No se pudo cargar el inventario"
                text="Comprueba la conexión con el servidor y vuelve a intentarlo."
                action={
                  <button className="btn primary" onClick={load}>
                    Reintentar
                  </button>
                }
              />
            )
          ) : view === 'dashboard' ? (
            <Dashboard data={data.dashboard} navigate={navigate} openEditor={openEditor} />
          ) : (
            <>
              {view === 'alerts' && (
                <>
                  <div className="alert-summary">
                    {['expired', '30', '60', '90'].map((key) => {
                      const s = STATUS[key],
                        count = data.batches.filter((b) => b.status === key && b.quantity > 0).length;
                      return (
                        <button
                          key={key}
                          className={`alert-summary-card ${s.class} ${filter === key ? 'selected' : ''}`}
                          onClick={() => {
                            setFilter(filter === key ? 'all' : key);
                            setPage(1);
                          }}
                        >
                          <span className="alert-card-top">
                            <Clock3 size={18} />
                            {s.label}
                            <ArrowUpRight size={16} />
                          </span>
                          <strong>
                            {count}
                            <small> lotes</small>
                          </strong>
                          <span>
                            {key === 'expired'
                              ? 'Retirar de las existencias'
                              : key === '30'
                                ? 'Atención prioritaria'
                                : key === '60'
                                  ? 'Planificar su rotación'
                                  : 'Mantener en seguimiento'}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                  <div className="info-banner">
                    <ShieldCheck size={19} />
                    <p>
                      <strong>Primero en vencer, primero en salir.</strong> Los lotes se ordenan por su fecha
                      de vencimiento. Los vencidos quedan excluidos del stock disponible.
                    </p>
                  </div>
                </>
              )}
              {view === 'shelves' ? (
                <>
                  <Toolbar
                    q={q}
                    setQ={(v) => {
                      setQ(v);
                      setPage(1);
                    }}
                    placeholder="Buscar por código, nombre o ubicación…"
                    count={rows.length}
                  />
                  <div className="shelves-grid">
                    {paged.map((s) => (
                      <article className="shelf-card card" key={s.id}>
                        <div className="shelf-card-top">
                          <span className="shelf-icon">
                            <Archive size={24} />
                          </span>
                          <span className="code-label">{s.code}</span>
                          <div className="row-actions">
                            <button
                              aria-label={`Editar ${s.name}`}
                              className="icon-btn"
                              onClick={() => openEditor('shelf', s)}
                            >
                              <Pencil size={16} />
                            </button>
                            <button
                              aria-label={`Eliminar ${s.name}`}
                              className="icon-btn danger"
                              onClick={() => setModal({ type: 'delete', kind: 'shelves', record: s })}
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </div>
                        <h3>{s.name}</h3>
                        <p className="shelf-location">
                          <MapPin size={14} />
                          {s.location}
                        </p>
                        <p className="shelf-description">{s.description || 'Sin descripción adicional.'}</p>
                        <div className="shelf-stats">
                          <div>
                            <strong>{s.batchCount}</strong>
                            <span>Lotes almacenados</span>
                          </div>
                          <div>
                            <strong>{number(s.units)}</strong>
                            <span>Unidades totales</span>
                          </div>
                          <button
                            className="icon-btn"
                            aria-label={`Ver lotes de ${s.code}`}
                            onClick={() => {
                              navigate('batches');
                              setQ(s.code);
                            }}
                          >
                            <ArrowUpRight size={21} />
                          </button>
                        </div>
                      </article>
                    ))}
                  </div>
                  {!rows.length && (
                    <div className="card">
                      <Empty />
                    </div>
                  )}
                  <Pagination page={safePage} pages={pages} total={rows.length} setPage={setPage} />
                </>
              ) : (
                <section className="card records-card">
                  <div className="records-heading">
                    <div>
                      <h3>
                        {view === 'products'
                          ? 'Catálogo de productos'
                          : view === 'batches'
                            ? 'Todos los lotes'
                            : view === 'alerts'
                              ? 'Lotes en seguimiento'
                              : 'Historial de movimientos'}
                        <span className="count-pill">{rows.length}</span>
                      </h3>
                      <p>
                        {view === 'products'
                          ? 'El stock disponible excluye las unidades vencidas.'
                          : view === 'movements'
                            ? 'Registro de operaciones y responsable de cada cambio.'
                            : 'Información actualizada de tus existencias.'}
                      </p>
                    </div>
                    {loading && <LoaderCircle className="spin muted" size={17} />}
                  </div>
                  <Toolbar
                    q={q}
                    setQ={(v) => {
                      setQ(v);
                      setPage(1);
                    }}
                    placeholder={
                      view === 'products'
                        ? 'Buscar productos o categorías…'
                        : view === 'movements'
                          ? 'Buscar producto, lote o motivo…'
                          : 'Buscar producto, número de lote o estante…'
                    }
                  >
                    <div className="filter-select">
                      <SlidersHorizontal size={15} />
                      {view === 'products' ? (
                        <select
                          aria-label="Filtrar productos"
                          value={filter}
                          onChange={(e) => {
                            setFilter(e.target.value);
                            setPage(1);
                          }}
                        >
                          <option value="all">Todas las categorías</option>
                          <option value="low">Solo stock bajo</option>
                          {[...new Set(data.products.map((p) => p.category))].sort().map((c) => (
                            <option key={c} value={c}>
                              {c}
                            </option>
                          ))}
                        </select>
                      ) : view !== 'movements' ? (
                        <select
                          aria-label="Filtrar por vencimiento"
                          value={filter}
                          onChange={(e) => {
                            setFilter(e.target.value);
                            setPage(1);
                          }}
                        >
                          <option value="all">Todos los estados</option>
                          {Object.entries(STATUS)
                            .filter(([k]) => view !== 'alerts' || k !== 'healthy')
                            .map(([k, s]) => (
                              <option key={k} value={k}>
                                {s.label}
                              </option>
                            ))}
                        </select>
                      ) : (
                        <span>Últimos movimientos primero</span>
                      )}
                    </div>
                  </Toolbar>
                  <div className="table-scroll">
                    <table>
                      <thead>
                        <tr>
                          {view === 'products' ? (
                            <>
                              <th>PRODUCTO</th>
                              <th>CATEGORÍA</th>
                              <th className="numeric">COMPRA / VENTA</th>
                              <th className="numeric">STOCK</th>
                              <th>ESTADO</th>
                              <th className="numeric">ACCIONES</th>
                            </>
                          ) : view === 'movements' ? (
                            <>
                              <th>FECHA</th>
                              <th>PRODUCTO / LOTE</th>
                              <th>OPERACIÓN</th>
                              <th className="numeric">UNIDADES</th>
                              <th>MOTIVO</th>
                              <th>RESPONSABLE</th>
                            </>
                          ) : (
                            <>
                              <th>PRODUCTO / LOTE</th>
                              <th>ESTANTE</th>
                              <th>INGRESO</th>
                              <th>VENCIMIENTO</th>
                              <th className="numeric">UNIDADES</th>
                              <th>ESTADO</th>
                              <th className="numeric">ACCIONES</th>
                            </>
                          )}
                        </tr>
                      </thead>
                      <tbody>
                        {paged.map((r) =>
                          view === 'products' ? (
                            <tr key={r.id}>
                              <td>
                                <div className="product-cell">
                                  <span className="product-icon">
                                    <Package size={18} />
                                  </span>
                                  <div>
                                    <strong>{r.name}</strong>
                                    <small className="description-cell" title={r.description}>
                                      {r.description || `PRD-${String(r.id).padStart(4, '0')}`}
                                    </small>
                                  </div>
                                </div>
                              </td>
                              <td>
                                <span className="category-tag">{r.category}</span>
                              </td>
                              <td className="numeric">
                                <strong>{money(r.salePrice)}</strong>
                                <small>Compra: {money(r.purchasePrice)}</small>
                              </td>
                              <td className="numeric">
                                <strong className={r.stock < r.minStock ? 'text-orange' : ''}>
                                  {number(r.stock)}
                                </strong>
                                <small>Mín. {number(r.minStock)}</small>
                              </td>
                              <td>
                                <Badge
                                  className={
                                    r.stock === 0 ? 'red' : r.stock < r.minStock ? 'orange' : 'green'
                                  }
                                >
                                  {r.stock === 0
                                    ? 'Sin existencias'
                                    : r.stock < r.minStock
                                      ? 'Stock bajo'
                                      : 'Disponible'}
                                </Badge>
                              </td>
                              <td>
                                <div className="row-actions">
                                  <button
                                    className="icon-btn"
                                    aria-label={`Editar ${r.name}`}
                                    onClick={() => openEditor('product', r)}
                                  >
                                    <Pencil size={16} />
                                  </button>
                                  <button
                                    className="icon-btn danger"
                                    aria-label={`Eliminar ${r.name}`}
                                    onClick={() => setModal({ type: 'delete', kind: 'products', record: r })}
                                  >
                                    <Trash2 size={16} />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ) : view === 'movements' ? (
                            <tr key={r.id}>
                              <td>
                                {new Intl.DateTimeFormat('es-BO', {
                                  day: '2-digit',
                                  month: 'short',
                                  hour: '2-digit',
                                  minute: '2-digit',
                                  timeZone: 'America/La_Paz',
                                }).format(new Date(r.createdAt))}
                              </td>
                              <td>
                                <strong>{r.productName}</strong>
                                <small>{r.batchNumber}</small>
                              </td>
                              <td>
                                <Badge
                                  className={
                                    r.type === 'entry' ? 'green' : r.type === 'deletion' ? 'red' : 'blue'
                                  }
                                >
                                  {
                                    {
                                      entry: 'Ingreso',
                                      adjustment: 'Ajuste',
                                      update: 'Edición',
                                      deletion: 'Eliminación',
                                    }[r.type]
                                  }
                                </Badge>
                              </td>
                              <td
                                className={`numeric ${r.delta > 0 ? 'text-green' : r.delta < 0 ? 'text-orange' : ''}`}
                              >
                                <strong>
                                  {r.delta > 0 ? '+' : ''}
                                  {r.delta}
                                </strong>
                              </td>
                              <td className="reason-cell">{r.reason}</td>
                              <td>{r.userName}</td>
                            </tr>
                          ) : (
                            <tr key={r.id}>
                              <td>
                                <div className="product-cell">
                                  <span className="product-icon">
                                    <Package size={17} />
                                  </span>
                                  <div>
                                    <strong>{r.productName}</strong>
                                    <small>{r.batchNumber}</small>
                                  </div>
                                </div>
                              </td>
                              <td>
                                <span className="shelf-code">
                                  <Archive size={13} />
                                  {r.shelfCode}
                                </span>
                              </td>
                              <td className="nowrap">{date(r.entryDate)}</td>
                              <td className={`nowrap ${r.status === 'expired' ? 'text-red' : ''}`}>
                                {date(r.expiryDate)}
                                <small>
                                  {r.daysToExpiry < 0
                                    ? `Venció hace ${Math.abs(r.daysToExpiry)} días`
                                    : r.daysToExpiry === 0
                                      ? 'Vence hoy'
                                      : `En ${r.daysToExpiry} días`}
                                </small>
                              </td>
                              <td className="numeric">
                                <strong>{number(r.quantity)}</strong>
                              </td>
                              <td>
                                <Badge status={r.status} />
                              </td>
                              <td>
                                <div className="row-actions">
                                  <button
                                    className="icon-btn"
                                    title="Ajustar stock"
                                    aria-label={`Ajustar stock ${r.batchNumber}`}
                                    onClick={() => openEditor('adjust', r)}
                                  >
                                    <SlidersHorizontal size={16} />
                                  </button>
                                  <button
                                    className="icon-btn"
                                    aria-label={`Editar ${r.batchNumber}`}
                                    onClick={() => openEditor('batch', r)}
                                  >
                                    <Pencil size={16} />
                                  </button>
                                  <button
                                    className="icon-btn danger"
                                    aria-label={`Eliminar ${r.batchNumber}`}
                                    onClick={() => setModal({ type: 'delete', kind: 'batches', record: r })}
                                  >
                                    <Trash2 size={16} />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ),
                        )}
                      </tbody>
                    </table>
                  </div>
                  {!rows.length && <Empty />}
                  <Pagination page={safePage} pages={pages} total={rows.length} setPage={setPage} />
                </section>
              )}
            </>
          )}
          <footer className="app-footer">
            <span>© {new Date().getFullYear()} Farma · Gestión de inventario</span>
            <span>
              <ShieldCheck size={13} />
              {data && !error ? 'Conectado a SQL Server' : 'Conexión pendiente'}
            </span>
          </footer>
        </main>
      </div>
      {modal && modal.type !== 'delete' && (
        <Editor
          key={`${modal.type}-${modal.record?.id || 'new'}`}
          modal={modal}
          products={data.products}
          shelves={data.shelves}
          onClose={() => setModal(null)}
          onSaved={saved}
        />
      )}
      {modal?.type === 'delete' && (
        <DeleteDialog modal={modal} onClose={() => setModal(null)} onSaved={saved} />
      )}
      {help && (
        <Modal
          title="Tu farmacia, paso a paso"
          subtitle="Una guía rápida para trabajar con Farma."
          onClose={() => setHelp(false)}
        >
          <div className="help-content">
            <p>
              <strong>1. Organiza tus estantes.</strong> Registra su código y ubicación para encontrar cada
              lote fácilmente.
            </p>
            <p>
              <strong>2. Crea tu catálogo.</strong> Agrega los productos, sus precios y la cantidad mínima
              recomendada.
            </p>
            <p>
              <strong>3. Registra cada lote.</strong> Selecciona el producto y estante, ingresa sus fechas y
              cantidad.
            </p>
            <p>
              <strong>4. Controla tus existencias.</strong> Usa Ajustar stock para entradas, salidas o
              retiros. Indica siempre el motivo.
            </p>
            <p>
              <strong>5. Anticípate a los vencimientos.</strong> Consulta los rangos de 0–30, 31–60 y 61–90
              días. Los vencidos no cuentan como stock disponible.
            </p>
            <div className="info-banner">
              <ShieldCheck size={20} />
              <p>
                Las fechas usan el horario de Bolivia. Un lote vence al finalizar la fecha indicada. El
                historial se conserva incluso al eliminar un lote sin stock.
              </p>
            </div>
          </div>
          <div className="modal-footer">
            <button className="btn primary" onClick={() => setHelp(false)}>
              Entendido <Check size={16} />
            </button>
          </div>
        </Modal>
      )}
      {toast && (
        <div className="toast" role="status">
          <CheckCircle2 size={19} />
          <span>{toast}</span>
          <button aria-label="Cerrar notificación" onClick={() => setToast('')}>
            <X size={16} />
          </button>
        </div>
      )}
    </div>
  );
}

export default App;
