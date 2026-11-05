import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { getPool, closeDatabase, sql } from '../src/db.js';

after(closeDatabase);
const app = createApp();
const day = (offset) => new Date(Date.now() - 4 * 3600000 + offset * 86400000).toISOString().slice(0, 10);

test('API REST sobre SQL Server real: autenticación, CRUD, alertas y concurrencia', async (t) => {
  const agent = request.agent(app);
  const prefix = `QA-${Date.now()}`;
  let product, shelf;
  const batchIds = [];
  try {
    await t.test('Acceso protegido y validación de credenciales', async () => {
      await request(app).get('/api/products').expect(401);
      await agent
        .post('/api/auth/login')
        .send({ email: 'nadie@example.com', password: 'incorrecta' })
        .expect(401);
      await agent
        .post('/api/auth/login')
        .send({ email: process.env.ADMIN_EMAIL, password: process.env.ADMIN_PASSWORD })
        .expect(200);
      const me = await agent.get('/api/auth/me').expect(200);
      assert.equal(me.body.data.email, process.env.ADMIN_EMAIL);
      await agent.post('/api/products').set('Origin', 'https://untrusted.example').send({}).expect(403);
    });
    await t.test('Productos y estantes: registrar, buscar, listar, modificar y validar', async () => {
      product = (
        await agent
          .post('/api/products')
          .send({
            name: prefix,
            description: 'Producto de prueba',
            category: 'QA',
            purchasePrice: 4.5,
            salePrice: 8,
            minStock: 100,
          })
          .expect(201)
      ).body.data;
      shelf = (
        await agent
          .post('/api/shelves')
          .send({ code: prefix, name: 'Estante de prueba', location: 'QA', description: '' })
          .expect(201)
      ).body.data;
      await agent
        .post('/api/shelves')
        .send({ code: prefix, name: 'Duplicado', location: 'QA', description: '' })
        .expect(409);
      const found = await agent.get('/api/products').query({ q: prefix }).expect(200);
      assert.equal(found.body.data.length, 1);
      await agent
        .put(`/api/products/${product.id}`)
        .send({
          name: `${prefix}-editado`,
          description: '',
          category: 'QA',
          purchasePrice: 5,
          salePrice: 9,
          minStock: 100,
        })
        .expect(200);
      await agent
        .put(`/api/shelves/${shelf.id}`)
        .send({ code: prefix, name: 'Estante editado', location: 'QA Editado', description: '' })
        .expect(200);
      await agent.get(`/api/products/${product.id}`).expect(200);
      await agent.get(`/api/shelves/${shelf.id}`).expect(200);
      await agent
        .get('/api/products')
        .query({ q: "' OR 1=1--" })
        .expect(200)
        .then((r) => assert.equal(r.body.data.length, 0));
      await agent.get('/api/products?page=-1').expect(400);
      await agent.post('/api/products').send({ name: 'Inválido', purchasePrice: -1 }).expect(400);
    });
    await t.test('Cada límite de alertas se calcula desde SQL, sin superponer categorías', async () => {
      for (const [days, status] of [
        [-1, 'expired'],
        [0, '30'],
        [30, '30'],
        [31, '60'],
        [60, '60'],
        [61, '90'],
        [90, '90'],
        [91, 'healthy'],
      ]) {
        const batch = (
          await agent
            .post('/api/batches')
            .send({
              productId: product.id,
              shelfId: shelf.id,
              batchNumber: `${prefix}-${days}`,
              entryDate: day(-100),
              expiryDate: day(days),
              quantity: 10,
            })
            .expect(201)
        ).body.data;
        batchIds.push(batch.id);
        const read = await agent.get(`/api/batches/${batch.id}`).expect(200);
        assert.equal(read.body.data.status, status);
        assert.equal(read.body.data.daysToExpiry, days);
      }
      const alerts = (await agent.get('/api/alerts').query({ productId: product.id })).body.data;
      assert.equal(alerts.length, 7);
      const p = (await agent.get(`/api/products/${product.id}`)).body.data;
      assert.equal(p.stock, 70, 'El stock utilizable excluye 10 unidades vencidas.');
      assert.equal(p.totalStock, 80);
      await agent.get('/api/dashboard').expect(200);
      await agent.delete(`/api/products/${product.id}`).expect(409);
      await agent.delete(`/api/shelves/${shelf.id}`).expect(409);
      await agent.delete(`/api/batches/${batchIds[0]}`).expect(409);
      await agent
        .post('/api/batches')
        .send({
          productId: product.id,
          shelfId: shelf.id,
          batchNumber: `${prefix}-future`,
          entryDate: day(1),
          expiryDate: day(10),
          quantity: 1,
        })
        .expect(400);
    });
    await t.test('Edición de lote, duplicados y ajuste de stock sin perder trazabilidad', async () => {
      const id = batchIds[0];
      await agent
        .put(`/api/batches/${id}`)
        .send({
          productId: product.id,
          shelfId: shelf.id,
          batchNumber: `${prefix}-updated`,
          entryDate: day(-100),
          expiryDate: day(-1),
          quantity: 10,
        })
        .expect(200);
      await agent
        .post('/api/batches')
        .send({
          productId: product.id,
          shelfId: shelf.id,
          batchNumber: `${prefix}-updated`,
          entryDate: day(-100),
          expiryDate: day(-1),
          quantity: 10,
        })
        .expect(409);
      await agent
        .post(`/api/batches/${id}/adjust`)
        .send({ delta: -11, reason: 'Stock insuficiente' })
        .expect(409);
      await agent
        .post(`/api/batches/${id}/adjust`)
        .send({ delta: -10, reason: 'Retiro de unidades vencidas' })
        .expect(200);
      await agent.delete(`/api/batches/${id}`).expect(204);
      await agent.get(`/api/batches/${id}`).expect(404);
      const movements = (await agent.get('/api/movements').query({ q: prefix, limit: 100 })).body.data;
      assert(movements.some((m) => m.type === 'adjustment' && m.delta === -10));
      assert(
        movements.some((m) => m.type === 'deletion' && m.batchId === null),
        'El historial sobrevive a la eliminación del lote.',
      );
    });
    await t.test('Dos salidas concurrentes no pueden consumir las mismas unidades', async () => {
      const id = batchIds[1];
      const results = await Promise.all([
        agent.post(`/api/batches/${id}/adjust`).send({ delta: -8, reason: 'Salida simultánea A' }),
        agent.post(`/api/batches/${id}/adjust`).send({ delta: -8, reason: 'Salida simultánea B' }),
      ]);
      assert.deepEqual(results.map((r) => r.status).sort(), [200, 409]);
      assert.equal((await agent.get(`/api/batches/${id}`)).body.data.quantity, 2);
    });
    await t.test('La sesión termina al cerrar sesión', async () => {
      await agent.post('/api/auth/logout').expect(204);
      await agent.get('/api/auth/me').expect(401);
    });
  } finally {
    // Solo limpia los registros que creó esta ejecución; nunca toca el inventario del usuario.
    if (product) {
      const pool = await getPool();
      await pool
        .request()
        .input('prefix', sql.NVarChar(150), `${prefix}%`)
        .input('productId', sql.Int, product.id).query(`DELETE dbo.Movements WHERE productName LIKE @prefix;
          DELETE dbo.Batches WHERE productId=@productId; DELETE dbo.Products WHERE id=@productId;`);
    }
    if (shelf)
      await (
        await getPool()
      )
        .request()
        .input('id', sql.Int, shelf.id)
        .query('DELETE dbo.Shelves WHERE id=@id');
  }
});
