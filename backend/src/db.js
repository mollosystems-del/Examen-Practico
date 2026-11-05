import './config.js';
import sql from 'mssql';

let pool;
let pending;
export async function connectDatabase(database = process.env.DB_NAME || 'FarmaInventario') {
  const windows = process.env.DB_AUTH !== 'sql';
  const driver = windows ? (await import('mssql/msnodesqlv8.js')).default : sql;
  const server = process.env.DB_SERVER || 'localhost';
  const instance = process.env.DB_INSTANCE;
  const options = {
    encrypt: process.env.DB_ENCRYPT === 'true',
    trustServerCertificate: process.env.DB_TRUST_CERTIFICATE !== 'false',
    abortTransactionOnError: true,
    ...(instance ? { instanceName: instance } : {}),
  };
  let settings = {
    server,
    database,
    options,
    pool: { max: 10, min: 0, idleTimeoutMillis: 30000 },
    connectionTimeout: 10000,
    requestTimeout: 15000,
  };
  if (windows) {
    // SQL Server Native Client is not required; use the installed ODBC driver.
    const target = instance
      ? `${server}\\${instance}`
      : process.env.DB_PORT
        ? `${server},${process.env.DB_PORT}`
        : server;
    settings.connectionString = `Driver={${process.env.DB_ODBC_DRIVER || 'ODBC Driver 18 for SQL Server'}};Server=${target};Database=${database};Trusted_Connection=Yes;Encrypt=${options.encrypt ? 'Yes' : 'No'};TrustServerCertificate=${options.trustServerCertificate ? 'Yes' : 'No'};`;
    settings.options.trustedConnection = true;
  } else {
    settings.user = process.env.DB_USER;
    settings.password = process.env.DB_PASSWORD;
    if (!instance) settings.port = Number(process.env.DB_PORT || 1433);
  }
  return new driver.ConnectionPool(settings).connect();
}

export async function getPool() {
  if (pool?.connected) return pool;
  if (!pending)
    pending = connectDatabase()
      .then((p) => {
        pool = p;
        return p;
      })
      .finally(() => {
        pending = null;
      });
  return pending;
}
export async function closeDatabase() {
  if (pool) await pool.close();
  pool = undefined;
}
export { sql };
