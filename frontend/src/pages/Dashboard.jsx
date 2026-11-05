import { Package, Layers3, Clock3, TrendingUp, ShieldCheck, ArrowUpRight, Leaf } from 'lucide-react';
import { STATUS } from '../constants';
import { money, number, date } from '../api';
import { Badge, Empty } from '../components/ui';
export function Dashboard({ data, navigate, openEditor }) {
  const distribution = Object.entries(STATUS).map(([key, value]) => ({
    ...value,
    key,
    ...(data.distribution.find((x) => x.status === key) || { count: 0, units: 0 }),
  }));
  const total = distribution.reduce((sum, x) => sum + x.count, 0);
  let sum = 0;
  const gradient = distribution
    .filter((x) => x.count)
    .map((x) => {
      const start = sum;
      sum += (x.count / (total || 1)) * 100;
      return `${x.color} ${start}% ${sum}%`;
    })
    .join(',');
  const stats = [
    {
      label: 'Productos registrados',
      value: number(data.products),
      icon: Package,
      foot: `${data.categories.length} categorías en tu catálogo`,
      style: 'mint',
    },
    {
      label: 'Unidades disponibles',
      value: number(data.availableUnits),
      icon: Layers3,
      foot: 'Existencias vigentes para tu farmacia',
      style: 'blue',
    },
    {
      label: 'Lotes por atender',
      value: number(data.alerts),
      icon: Clock3,
      foot: 'Vencidos o por vencer en 90 días',
      style: 'peach',
    },
    {
      label: 'Valor del inventario',
      value: money(data.inventoryValue),
      icon: TrendingUp,
      foot: 'Valor a precio de compra · stock vigente',
      style: 'sand',
    },
  ];
  return (
    <>
      <div className="welcome-banner">
        <div>
          <span className="banner-kicker">
            <span /> TU INVENTARIO, BAJO CONTROL
          </span>
          <h2>
            Cuidar los detalles.
            <br />
            <span>También es cuidar la salud.</span>
          </h2>
          <p>Un espacio más organizado para una farmacia que cuida mejor.</p>
          <button onClick={() => openEditor('batch')} className="btn banner-btn">
            Registrar un lote <ArrowUpRight size={17} />
          </button>
        </div>
        <div className="banner-illustration" aria-hidden="true">
          <div className="illustration-orbit" />
          <div className="med-box">
            <span>farma.</span>
            <div>✚</div>
            <small>CUIDADO DIARIO</small>
            <i />
          </div>
          <div className="pill-oval" />
          <div className="leaf-shape" />
          <div className="banner-chip">
            <ShieldCheck size={18} /> Gestión que da tranquilidad
          </div>
          <span className="sparkle one">✦</span>
          <span className="sparkle two">✦</span>
        </div>
      </div>
      <div className="stats-grid">
        {stats.map((s) => (
          <article className="stat-card" key={s.label}>
            <div className="stat-top">
              <span>{s.label}</span>
              <span className={`stat-icon ${s.style}`}>
                <s.icon size={19} />
              </span>
            </div>
            <strong>{s.value}</strong>
            <div className="stat-foot">
              <span className={`small-dot ${s.style}`} />
              {s.foot}
            </div>
          </article>
        ))}
      </div>
      <div className="dashboard-grid">
        <section className="card urgent-card">
          <div className="card-heading">
            <div>
              <h3>
                Vencimientos que necesitan atención <span className="count-pill">{data.alerts}</span>
              </h3>
              <p>Prioriza los lotes con la fecha más cercana.</p>
            </div>
            <button className="text-btn" onClick={() => navigate('alerts')}>
              Ver todos <ArrowUpRight size={15} />
            </button>
          </div>
          {data.urgentBatches.length ? (
            <div className="table-scroll">
              <table className="compact-table">
                <thead>
                  <tr>
                    <th>PRODUCTO / LOTE</th>
                    <th>VENCIMIENTO</th>
                    <th>ESTADO</th>
                    <th className="numeric">UNIDADES</th>
                  </tr>
                </thead>
                <tbody>
                  {data.urgentBatches.map((b) => (
                    <tr key={b.id}>
                      <td>
                        <div className="product-cell">
                          <span className="product-icon">
                            <Package size={17} />
                          </span>
                          <div>
                            <strong>{b.productName}</strong>
                            <small>
                              {b.batchNumber} <span>· {b.shelfCode}</span>
                            </small>
                          </div>
                        </div>
                      </td>
                      <td className={b.status === 'expired' ? 'text-red' : ''}>
                        {date(b.expiryDate)}
                        <small>
                          {b.daysToExpiry < 0
                            ? `Hace ${Math.abs(b.daysToExpiry)} días`
                            : b.daysToExpiry === 0
                              ? 'Vence hoy'
                              : `En ${b.daysToExpiry} días`}
                        </small>
                      </td>
                      <td>
                        <Badge status={b.status} />
                      </td>
                      <td className="numeric">{number(b.quantity)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <Empty title="Todo al día" text="No hay lotes con vencimientos en los próximos 90 días." />
          )}
          <div className="card-note">
            <ShieldCheck size={14} /> Las alertas se actualizan automáticamente cada día.
          </div>
        </section>
        <section className="card health-card">
          <div className="card-heading">
            <div>
              <h3>Salud del inventario</h3>
              <p>Estado de tus lotes con existencias.</p>
            </div>
            <span className="muted-icon">
              <Layers3 size={19} />
            </span>
          </div>
          <div
            className="donut"
            style={{ background: total ? `conic-gradient(${gradient})` : '#e9eeea' }}
            role="img"
            aria-label={`${total} lotes con existencias, ${data.alerts} requieren atención`}
          >
            <div>
              <strong>{number(total)}</strong>
              <span>lotes activos</span>
            </div>
          </div>
          <div className="chart-legend">
            {distribution.map((s) => (
              <div key={s.key}>
                <span>
                  <i style={{ background: s.color }} />
                  {s.label}
                </span>
                <strong>
                  {s.count}
                  <small> lotes</small>
                </strong>
              </div>
            ))}
          </div>
        </section>
        <section className="card stock-card">
          <div className="card-heading">
            <div>
              <h3>
                Productos con stock bajo <span className="count-pill warning">{data.lowStockCount}</span>
              </h3>
              <p>Un recordatorio para tu próxima reposición.</p>
            </div>
            <button className="text-btn" onClick={() => navigate('products', 'low')}>
              Ver productos <ArrowUpRight size={15} />
            </button>
          </div>
          {data.lowStock.length ? (
            <div className="stock-list">
              {data.lowStock.map((p) => (
                <div key={p.id}>
                  <span className="product-icon">
                    <Package size={18} />
                  </span>
                  <div className="stock-product">
                    <strong>{p.name}</strong>
                    <small>Mínimo recomendado: {p.minStock} uds.</small>
                  </div>
                  <div className="stock-amount">
                    <strong>
                      {p.stock} <small>uds.</small>
                    </strong>
                    <div className="stock-track">
                      <i style={{ width: `${Math.min(100, (p.stock / p.minStock) * 100)}%` }} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <Empty title="Stock en equilibrio" text="Todos tus productos tienen las existencias mínimas." />
          )}
        </section>
        <section className="card categories-card">
          <div className="card-heading">
            <div>
              <h3>Inventario por categoría</h3>
              <p>Unidades disponibles en cada familia.</p>
            </div>
          </div>
          <div className="category-bars">
            {data.categories.length ? (
              data.categories.slice(0, 6).map((c, i) => (
                <div key={c.category}>
                  <div>
                    <span>{c.category}</span>
                    <strong>{number(c.units)}</strong>
                  </div>
                  <div className="category-track">
                    <i
                      style={{
                        width: `${(c.units / Math.max(1, ...data.categories.map((x) => x.units))) * 100}%`,
                        opacity: 1 - i * 0.09,
                      }}
                    />
                  </div>
                </div>
              ))
            ) : (
              <p className="muted">Registra productos para ver su distribución.</p>
            )}
          </div>
        </section>
      </div>
      <div className="bottom-note">
        <Leaf size={16} />
        <span>Un inventario en orden deja más tiempo para lo que importa: tus pacientes.</span>
        <span>Farma, contigo.</span>
      </div>
    </>
  );
}
