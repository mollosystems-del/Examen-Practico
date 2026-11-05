import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { rateLimit } from 'express-rate-limit';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { ZodError } from 'zod';
import { config } from './config.js';
import { getPool, sql } from './db.js';
import {
  ApiError,
  parseId,
  productSchema,
  shelfSchema,
  batchSchema,
  adjustmentSchema,
  loginSchema,
  expiryCase,
} from './domain.js';

const cookie = { httpOnly: true, sameSite: 'strict', secure: config.production, path: '/' };
const like = (value) =>
  `%${String(value || '')
    .trim()
    .slice(0, 150)
    .replace(/[\\%_\[]/g, '\\$&')}%`;
function pagination(req) {
  const page = Number(req.query.page || 1),
    limit = Number(req.query.limit || 20);
  if (
    !Number.isInteger(page) ||
    page < 1 ||
    page > 100000 ||
    !Number.isInteger(limit) ||
    limit < 1 ||
    limit > 1000
  )
    throw new ApiError(400, 'La paginación no es válida.');
  return { page, limit, offset: (page - 1) * limit };
}
async function list(req, res, table, where, order, bind = () => {}) {
  const p = pagination(req);
  const request = (await getPool())
    .request()
    .input('q', sql.NVarChar(310), like(req.query.q))
    .input('offset', sql.Int, p.offset)
    .input('limit', sql.Int, p.limit);
  bind(request);
  const result =
    await request.query(`SELECT * ${table} WHERE ${where} ORDER BY ${order} OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY;
    SELECT COUNT(*) AS total ${table} WHERE ${where};`);
  const total = result.recordsets[1][0].total;
  res.json({
    data: result.recordsets[0],
    pagination: { page: p.page, limit: p.limit, total, pages: Math.ceil(total / p.limit) },
  });
}
function productInputs(request, data) {
  return request
    .input('name', sql.NVarChar(150), data.name)
    .input('description', sql.NVarChar(1000), data.description)
    .input('category', sql.NVarChar(80), data.category)
    .input('purchasePrice', sql.Decimal(10, 2), data.purchasePrice)
    .input('salePrice', sql.Decimal(10, 2), data.salePrice)
    .input('minStock', sql.Int, data.minStock);
}
function shelfInputs(request, data) {
  return request
    .input('code', sql.NVarChar(30), data.code)
    .input('name', sql.NVarChar(100), data.name)
    .input('location', sql.NVarChar(200), data.location)
    .input('description', sql.NVarChar(1000), data.description);
}
function batchInputs(request, data) {
  return request
    .input('productId', sql.Int, data.productId)
    .input('shelfId', sql.Int, data.shelfId)
    .input('batchNumber', sql.NVarChar(60), data.batchNumber)
    .input('entryDate', sql.Date, data.entryDate)
    .input('expiryDate', sql.Date, data.expiryDate)
    .input('quantity', sql.Int, data.quantity);
}
async function transaction(work) {
  const tx = (await getPool()).transaction();
  let rolledBack = false;
  tx.on('rollback', () => {
    rolledBack = true;
  });
  await tx.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);
  try {
    const result = await work(tx);
    await tx.commit();
    return result;
  } catch (error) {
    if (!rolledBack) await tx.rollback().catch(() => {});
    throw error;
  }
}
async function recordMovement(tx, batch, type, delta, reason, userId) {
  await tx
    .request()
    .input('batchId', sql.Int, batch.id)
    .input('productName', sql.NVarChar(150), batch.productName)
    .input('batchNumber', sql.NVarChar(60), batch.batchNumber)
    .input('type', sql.NVarChar(20), type)
    .input('delta', sql.Int, delta)
    .input('reason', sql.NVarChar(300), reason)
    .input('userId', sql.Int, userId)
    .query(
      'INSERT dbo.Movements(batchId,productName,batchNumber,type,delta,reason,userId) VALUES(@batchId,@productName,@batchNumber,@type,@delta,@reason,@userId)',
    );
}
async function lockedBatch(tx, id) {
  const result = await tx.request().input('id', sql.Int, id).query(`SELECT b.*, p.name AS productName,
    DATEDIFF(DAY,CONVERT(DATE,DATEADD(HOUR,-4,SYSUTCDATETIME())),b.expiryDate) AS daysToExpiry
    FROM dbo.Batches b WITH (UPDLOCK,HOLDLOCK) JOIN dbo.Products p ON p.id=b.productId WHERE b.id=@id`);
  if (!result.recordset[0]) throw new ApiError(404, 'El lote no existe.');
  return result.recordset[0];
}

export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          'script-src': ["'self'"],
          'img-src': ["'self'", 'data:'],
          'style-src': ["'self'", "'unsafe-inline'"],
        },
      },
    }),
  );
  app.use(cors({ origin: config.origins, credentials: true }));
  app.use(express.json({ limit: '100kb' }));
  app.use(cookieParser());
  app.use('/api', (req, res, next) => {
    if (
      !['GET', 'HEAD', 'OPTIONS'].includes(req.method) &&
      req.headers.origin &&
      !config.origins.includes(req.headers.origin) &&
      req.headers.origin !== `${req.protocol}://${req.get('host')}`
    )
      return next(new ApiError(403, 'Origen de solicitud no permitido.'));
    next();
  });
  app.get('/api/health', async (req, res) => {
    await (await getPool()).request().query('SELECT 1 AS ok');
    res.json({ status: 'ok', database: 'SQL Server' });
  });
  app.post(
    '/api/auth/login',
    rateLimit({
      windowMs: 15 * 60 * 1000,
      limit: 20,
      standardHeaders: 'draft-8',
      legacyHeaders: false,
      message: { message: 'Demasiados intentos. Intenta de nuevo en 15 minutos.' },
    }),
    async (req, res) => {
      const input = loginSchema.parse(req.body);
      const { recordset } = await (
        await getPool()
      )
        .request()
        .input('email', sql.NVarChar(150), input.email)
        .query('SELECT id,name,email,passwordHash FROM dbo.Users WHERE email=@email');
      const user = recordset[0];
      if (!user || !(await bcrypt.compare(input.password, user.passwordHash)))
        throw new ApiError(401, 'Correo o contraseña incorrectos.');
      const token = jwt.sign({ id: user.id, name: user.name, email: user.email }, config.secret, {
        expiresIn: '8h',
        issuer: 'farma-api',
        audience: 'farma-web',
      });
      res.cookie('farma_session', token, { ...cookie, maxAge: 8 * 60 * 60 * 1000 });
      res.json({ data: { id: user.id, name: user.name, email: user.email } });
    },
  );
  app.post('/api/auth/logout', (req, res) => {
    res.clearCookie('farma_session', cookie);
    res.status(204).end();
  });
  app.use('/api', (req, res, next) => {
    try {
      req.user = jwt.verify(req.cookies.farma_session || '', config.secret, {
        algorithms: ['HS256'],
        issuer: 'farma-api',
        audience: 'farma-web',
      });
      next();
    } catch {
      next(new ApiError(401, 'Tu sesión ha terminado. Vuelve a iniciar sesión.'));
    }
  });
  app.get('/api/auth/me', (req, res) =>
    res.json({ data: { id: req.user.id, name: req.user.name, email: req.user.email } }),
  );

  app.get('/api/products', (req, res) =>
    list(
      req,
      res,
      'FROM dbo.vProducts',
      `(name LIKE @q ESCAPE '\\' OR category LIKE @q ESCAPE '\\' OR description LIKE @q ESCAPE '\\') AND (@category='' OR category=@category)`,
      'name,id',
      (r) => r.input('category', sql.NVarChar(80), String(req.query.category || '').slice(0, 80)),
    ),
  );
  app.get('/api/products/:id', async (req, res) => {
    const { recordset } = await (
      await getPool()
    )
      .request()
      .input('id', sql.Int, parseId(req.params.id))
      .query('SELECT * FROM dbo.vProducts WHERE id=@id');
    if (!recordset[0]) throw new ApiError(404, 'El producto no existe.');
    res.json({ data: recordset[0] });
  });
  app.post('/api/products', async (req, res) => {
    const { recordset } = await productInputs(
      (await getPool()).request(),
      productSchema.parse(req.body),
    ).query(
      'INSERT dbo.Products(name,description,category,purchasePrice,salePrice,minStock) OUTPUT INSERTED.* VALUES(@name,@description,@category,@purchasePrice,@salePrice,@minStock)',
    );
    res.status(201).json({ data: recordset[0] });
  });
  app.put('/api/products/:id', async (req, res) => {
    const { recordset } = await productInputs((await getPool()).request(), productSchema.parse(req.body))
      .input('id', sql.Int, parseId(req.params.id))
      .query(
        'UPDATE dbo.Products SET name=@name,description=@description,category=@category,purchasePrice=@purchasePrice,salePrice=@salePrice,minStock=@minStock,updatedAt=SYSUTCDATETIME() OUTPUT INSERTED.* WHERE id=@id',
      );
    if (!recordset[0]) throw new ApiError(404, 'El producto no existe.');
    res.json({ data: recordset[0] });
  });
  app.delete('/api/products/:id', async (req, res) => {
    const result = await (
      await getPool()
    )
      .request()
      .input('id', sql.Int, parseId(req.params.id))
      .query('DELETE FROM dbo.Products WHERE id=@id');
    if (!result.rowsAffected[0]) throw new ApiError(404, 'El producto no existe.');
    res.status(204).end();
  });
  app.get('/api/shelves', (req, res) =>
    list(
      req,
      res,
      `FROM (SELECT s.*, (SELECT COUNT(*) FROM dbo.Batches b WHERE b.shelfId=s.id) AS batchCount,
    COALESCE((SELECT SUM(quantity) FROM dbo.Batches b WHERE b.shelfId=s.id),0) AS units FROM dbo.Shelves s) shelves`,
      `(code LIKE @q ESCAPE '\\' OR name LIKE @q ESCAPE '\\' OR location LIKE @q ESCAPE '\\')`,
      'code,id',
    ),
  );
  app.get('/api/shelves/:id', async (req, res) => {
    const { recordset } = await (
      await getPool()
    )
      .request()
      .input('id', sql.Int, parseId(req.params.id))
      .query('SELECT * FROM dbo.Shelves WHERE id=@id');
    if (!recordset[0]) throw new ApiError(404, 'El estante no existe.');
    res.json({ data: recordset[0] });
  });
  app.post('/api/shelves', async (req, res) => {
    const { recordset } = await shelfInputs((await getPool()).request(), shelfSchema.parse(req.body)).query(
      'INSERT dbo.Shelves(code,name,location,description) OUTPUT INSERTED.* VALUES(@code,@name,@location,@description)',
    );
    res.status(201).json({ data: recordset[0] });
  });
  app.put('/api/shelves/:id', async (req, res) => {
    const { recordset } = await shelfInputs((await getPool()).request(), shelfSchema.parse(req.body))
      .input('id', sql.Int, parseId(req.params.id))
      .query(
        'UPDATE dbo.Shelves SET code=@code,name=@name,location=@location,description=@description,updatedAt=SYSUTCDATETIME() OUTPUT INSERTED.* WHERE id=@id',
      );
    if (!recordset[0]) throw new ApiError(404, 'El estante no existe.');
    res.json({ data: recordset[0] });
  });
  app.delete('/api/shelves/:id', async (req, res) => {
    const result = await (
      await getPool()
    )
      .request()
      .input('id', sql.Int, parseId(req.params.id))
      .query('DELETE FROM dbo.Shelves WHERE id=@id');
    if (!result.rowsAffected[0]) throw new ApiError(404, 'El estante no existe.');
    res.status(204).end();
  });
  function listBatches(req, res, alertsOnly = false) {
    const status = String(req.query.status || '');
    if (!['', 'expired', '30', '60', '90', 'healthy'].includes(status))
      throw new ApiError(400, 'El estado de vencimiento no es válido.');
    return list(
      req,
      res,
      `FROM (SELECT *, ${expiryCase} AS status FROM dbo.vBatches) batches`,
      `(productName LIKE @q ESCAPE '\\' OR batchNumber LIKE @q ESCAPE '\\' OR shelfCode LIKE @q ESCAPE '\\')
      AND (@status='' OR status=@status) AND (@productId IS NULL OR productId=@productId) AND (@shelfId IS NULL OR shelfId=@shelfId)
      ${alertsOnly ? 'AND quantity>0 AND daysToExpiry<=90' : ''}`,
      'expiryDate,id',
      (r) => {
        r.input('status', sql.VarChar(10), status)
          .input('productId', sql.Int, req.query.productId ? parseId(req.query.productId) : null)
          .input('shelfId', sql.Int, req.query.shelfId ? parseId(req.query.shelfId) : null);
      },
    );
  }
  app.get('/api/batches', (req, res) => listBatches(req, res));
  app.get('/api/alerts', (req, res) => listBatches(req, res, true));
  app.get('/api/batches/:id', async (req, res) => {
    const { recordset } = await (
      await getPool()
    )
      .request()
      .input('id', sql.Int, parseId(req.params.id))
      .query(`SELECT *,${expiryCase} AS status FROM dbo.vBatches WHERE id=@id`);
    if (!recordset[0]) throw new ApiError(404, 'El lote no existe.');
    res.json({ data: recordset[0] });
  });
  app.post('/api/batches', async (req, res) => {
    const data = batchSchema.parse(req.body);
    const result = await transaction(async (tx) => {
      const { recordset } = await batchInputs(tx.request(), data).query(`
        IF @entryDate>CONVERT(DATE,DATEADD(HOUR,-4,SYSUTCDATETIME())) THROW 50001,N'La fecha de ingreso no puede estar en el futuro.',1;
        INSERT dbo.Batches(productId,shelfId,batchNumber,entryDate,expiryDate,quantity) OUTPUT INSERTED.id
        VALUES(@productId,@shelfId,@batchNumber,@entryDate,@expiryDate,@quantity);`);
      const batch = await lockedBatch(tx, recordset[0].id);
      await recordMovement(tx, batch, 'entry', data.quantity, 'Registro de lote', req.user.id);
      return batch;
    });
    res.status(201).json({ data: result });
  });
  app.put('/api/batches/:id', async (req, res) => {
    const id = parseId(req.params.id),
      data = batchSchema.parse(req.body);
    const result = await transaction(async (tx) => {
      const old = await lockedBatch(tx, id);
      if (old.productId !== data.productId)
        throw new ApiError(409, 'El producto de un lote registrado no puede cambiarse.');
      if (old.quantity !== data.quantity)
        throw new ApiError(409, 'Usa Ajustar stock para cambiar la cantidad y registrar el motivo.');
      await batchInputs(tx.request(), data).input('id', sql.Int, id).query(`
        IF @entryDate>CONVERT(DATE,DATEADD(HOUR,-4,SYSUTCDATETIME())) THROW 50001,N'La fecha de ingreso no puede estar en el futuro.',1;
        UPDATE dbo.Batches SET shelfId=@shelfId,batchNumber=@batchNumber,entryDate=@entryDate,expiryDate=@expiryDate,updatedAt=SYSUTCDATETIME() WHERE id=@id;`);
      const batch = await lockedBatch(tx, id);
      await recordMovement(tx, batch, 'update', 0, 'Actualización de datos del lote', req.user.id);
      return batch;
    });
    res.json({ data: result });
  });
  app.post('/api/batches/:id/adjust', async (req, res) => {
    const id = parseId(req.params.id),
      { delta, reason } = adjustmentSchema.parse(req.body);
    const result = await transaction(async (tx) => {
      const old = await lockedBatch(tx, id);
      if (old.quantity + delta < 0) throw new ApiError(409, 'El ajuste dejaría el lote con stock negativo.');
      if (old.quantity + delta > 10000000) throw new ApiError(409, 'El stock supera el máximo permitido.');
      await tx
        .request()
        .input('id', sql.Int, id)
        .input('delta', sql.Int, delta)
        .query('UPDATE dbo.Batches SET quantity=quantity+@delta,updatedAt=SYSUTCDATETIME() WHERE id=@id');
      await recordMovement(tx, old, 'adjustment', delta, reason, req.user.id);
      return { ...old, quantity: old.quantity + delta };
    });
    res.json({ data: result });
  });
  app.delete('/api/batches/:id', async (req, res) => {
    await transaction(async (tx) => {
      const batch = await lockedBatch(tx, parseId(req.params.id));
      if (batch.quantity !== 0)
        throw new ApiError(409, 'El lote tiene existencias. Ajusta su stock a cero antes de eliminarlo.');
      await recordMovement(tx, batch, 'deletion', 0, 'Eliminación de lote sin existencias', req.user.id);
      await tx.request().input('id', sql.Int, batch.id).query('DELETE FROM dbo.Batches WHERE id=@id');
    });
    res.status(204).end();
  });
  app.get('/api/movements', (req, res) =>
    list(
      req,
      res,
      `FROM (SELECT m.*, COALESCE(u.name,N'Sistema') AS userName FROM dbo.Movements m LEFT JOIN dbo.Users u ON u.id=m.userId) movements`,
      `(productName LIKE @q ESCAPE '\\' OR batchNumber LIKE @q ESCAPE '\\' OR reason LIKE @q ESCAPE '\\')`,
      'createdAt DESC,id DESC',
    ),
  );
  app.get('/api/dashboard', async (req, res) => {
    const { recordsets: sets } = await (await getPool()).request().query(`
      SELECT (SELECT COUNT(*) FROM dbo.Products) AS products,
        (SELECT COUNT(*) FROM dbo.Shelves) AS shelves,
        (SELECT COUNT(*) FROM dbo.Batches) AS batches,
        COALESCE(SUM(CASE WHEN daysToExpiry>=0 THEN quantity ELSE 0 END),0) AS availableUnits,
        COALESCE(SUM(CASE WHEN daysToExpiry>=0 THEN quantity*purchasePrice ELSE 0 END),0) AS inventoryValue,
        COALESCE(SUM(CASE WHEN quantity>0 AND daysToExpiry<=90 THEN 1 ELSE 0 END),0) AS alerts
      FROM dbo.vBatches;
      SELECT ${expiryCase} AS status, COUNT(*) AS count, SUM(quantity) AS units
      FROM dbo.vBatches WHERE quantity>0 GROUP BY ${expiryCase};
      SELECT TOP 6 *,${expiryCase} AS status FROM dbo.vBatches WHERE quantity>0 AND daysToExpiry<=90 ORDER BY expiryDate,id;
      SELECT TOP 6 * FROM dbo.vProducts WHERE stock<minStock ORDER BY (minStock-stock) DESC,id;
      SELECT category, COUNT(*) AS products, SUM(stock) AS units FROM dbo.vProducts GROUP BY category ORDER BY units DESC;
      SELECT COUNT(*) AS lowStockCount FROM dbo.vProducts WHERE stock<minStock;
    `);
    res.json({
      data: {
        ...sets[0][0],
        lowStockCount: sets[5][0].lowStockCount,
        distribution: sets[1],
        urgentBatches: sets[2],
        lowStock: sets[3],
        categories: sets[4],
      },
    });
  });
  app.use('/api', (req, res, next) => next(new ApiError(404, 'El recurso solicitado no existe.')));
  const frontend = fileURLToPath(new URL('../../frontend/dist/', import.meta.url));
  if (existsSync(frontend)) {
    app.use(express.static(frontend));
    app.get('/{*path}', (req, res) => res.sendFile(`${frontend}/index.html`));
  }
  app.use((error, req, res, next) => {
    if (error instanceof ZodError)
      return res.status(400).json({
        message: 'Revisa los datos del formulario.',
        errors: error.issues.map((e) => ({ field: e.path.join('.'), message: e.message })),
      });
    const number = error.number || error.originalError?.info?.number;
    if ([2601, 2627].includes(number))
      return res
        .status(409)
        .json({ message: 'Ya existe un registro con ese código o número de lote para el producto.' });
    if (number === 547)
      return res.status(409).json({
        message:
          req.method === 'DELETE'
            ? 'No se puede eliminar: hay lotes asociados a este registro.'
            : 'El producto o estante seleccionado no existe, o los datos incumplen una restricción.',
      });
    if (number === 50001) return res.status(400).json({ message: error.message });
    if (error.type === 'entity.parse.failed')
      return res.status(400).json({ message: 'El cuerpo de la solicitud no es JSON válido.' });
    if (error.type === 'entity.too.large')
      return res.status(413).json({ message: 'La solicitud es demasiado grande.' });
    if (error.status) return res.status(error.status).json({ message: error.message });
    console.error(`[${new Date().toISOString()}] ${req.method} ${req.path}:`, error.message);
    res.status(503).json({
      message:
        'No se pudo completar la operación. Comprueba la conexión con SQL Server e inténtalo de nuevo.',
    });
  });
  return app;
}
