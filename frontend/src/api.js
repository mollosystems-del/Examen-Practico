export async function api(path, options = {}) {
  let response;
  try {
    response = await fetch(`/api${path}`, {
      credentials: 'include',
      ...options,
      headers: { 'Content-Type': 'application/json', ...options.headers },
    });
  } catch {
    throw new Error('No se pudo conectar con el servidor. Comprueba que la API esté en ejecución.');
  }
  if (response.status === 204) return null;
  const payload = await response
    .json()
    .catch(() => ({ message: 'El servidor devolvió una respuesta inesperada.' }));
  if (!response.ok) {
    const error = new Error(payload.message || 'No se pudo completar la operación.');
    error.status = response.status;
    error.fields = payload.errors || [];
    if (response.status === 401 && path !== '/auth/login' && path !== '/auth/me')
      window.dispatchEvent(new Event('session-expired'));
    throw error;
  }
  return payload;
}
export async function allRecords(path) {
  let page = 1,
    records = [],
    result;
  do {
    result = await api(`${path}${path.includes('?') ? '&' : '?'}limit=1000&page=${page++}`);
    records.push(...result.data);
  } while (page <= result.pagination.pages);
  return records;
}
export const money = (value) =>
  new Intl.NumberFormat('es-BO', { style: 'currency', currency: 'BOB', maximumFractionDigits: 2 }).format(
    value || 0,
  );
export const number = (value) => new Intl.NumberFormat('es-BO').format(value || 0);
export const date = (value) =>
  value
    ? new Intl.DateTimeFormat('es-BO', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        timeZone: 'UTC',
      }).format(new Date(String(value).slice(0, 10) + 'T12:00:00Z'))
    : '—';
export const today = () =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/La_Paz',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
export function exportCsv(name, columns, rows) {
  const escape = (value) => {
    let text = String(value ?? '');
    if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
    return `"${text.replace(/"/g, '""')}"`;
  };
  const text =
    '\ufeff' +
    [
      columns.map((c) => c[0]),
      ...rows.map((row) => columns.map((c) => (typeof c[1] === 'function' ? c[1](row) : row[c[1]]))),
    ]
      .map((row) => row.map(escape).join(';'))
      .join('\r\n');
  const url = URL.createObjectURL(new Blob([text], { type: 'text/csv;charset=utf-8;' }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `farma-${name}-${today()}.csv`;
  anchor.click();
  URL.revokeObjectURL(url);
}
