import { test } from 'node:test';
import assert from 'node:assert/strict';
import { classifyExpiry, batchSchema, productSchema, parseId, adjustmentSchema } from '../src/domain.js';

test('Vencimientos: los límites 0,30,60,90 pertenecen a un único rango', () => {
  const cases = [
    [-1, 'expired'],
    [0, '30'],
    [30, '30'],
    [31, '60'],
    [60, '60'],
    [61, '90'],
    [90, '90'],
    [91, 'healthy'],
  ];
  for (const [days, expected] of cases) assert.equal(classifyExpiry(days), expected);
});
test('Rechaza fechas inexistentes y vencimiento anterior al ingreso', () => {
  const batch = {
    productId: 1,
    shelfId: 1,
    batchNumber: 'TEST-1',
    quantity: 3,
    entryDate: '2026-02-01',
    expiryDate: '2026-02-28',
  };
  assert.equal(batchSchema.safeParse(batch).success, true);
  assert.equal(batchSchema.safeParse({ ...batch, expiryDate: '2026-02-30' }).success, false);
  assert.equal(batchSchema.safeParse({ ...batch, expiryDate: '2026-01-31' }).success, false);
});
test('Precios y stock requieren números válidos con precisión monetaria', () => {
  const product = {
    name: 'Prueba',
    description: '',
    category: 'Pruebas',
    purchasePrice: 3.15,
    salePrice: 5.99,
    minStock: 5,
  };
  assert.equal(productSchema.safeParse(product).success, true);
  for (const change of [
    { purchasePrice: -1 },
    { salePrice: 1.005 },
    { minStock: 2.5 },
    { salePrice: Infinity },
    { minStock: -2 },
    { name: ' ' },
  ])
    assert.equal(productSchema.safeParse({ ...product, ...change }).success, false);
});
test('Los ajustes exigen unidades enteras distintas de cero y un motivo', () => {
  assert.equal(adjustmentSchema.safeParse({ delta: -3, reason: 'Retiro por daño' }).success, true);
  for (const delta of [0, 1.5, 10000001])
    assert.equal(adjustmentSchema.safeParse({ delta, reason: 'Ajuste de stock' }).success, false);
  assert.equal(adjustmentSchema.safeParse({ delta: 1, reason: '' }).success, false);
});
test('Identificadores malformados o fuera de SQL INT son rechazados', () => {
  assert.equal(parseId('12'), 12);
  for (const id of ['1 OR 1=1', -1, 0, '1.2', 'abc', '2147483648']) assert.throws(() => parseId(id));
});
