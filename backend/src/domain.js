import { z } from 'zod';

const text = (min, max) => z.string().trim().min(min).max(max);
const money = z
  .number()
  .finite()
  .min(0)
  .max(99999999.99)
  .refine((v) => Math.abs(v * 100 - Math.round(v * 100)) < 0.000001, 'Usa como máximo dos decimales.');
const integer = z.number().int().min(0).max(10000000);
const date = z.iso.date();

export const productSchema = z
  .object({
    name: text(2, 150),
    description: text(0, 1000),
    category: text(2, 80),
    purchasePrice: money,
    salePrice: money,
    minStock: integer,
  })
  .strict();
export const shelfSchema = z
  .object({
    code: text(2, 30).regex(/^[A-Za-z0-9_-]+$/, 'Usa letras, números, guion o guion bajo.'),
    name: text(2, 100),
    location: text(2, 200),
    description: text(0, 1000),
  })
  .strict();
export const batchSchema = z
  .object({
    productId: z.number().int().positive(),
    shelfId: z.number().int().positive(),
    batchNumber: text(2, 60),
    entryDate: date,
    expiryDate: date,
    quantity: integer,
  })
  .strict()
  .refine((v) => v.expiryDate >= v.entryDate, {
    message: 'El vencimiento debe ser igual o posterior al ingreso.',
    path: ['expiryDate'],
  });
export const adjustmentSchema = z
  .object({
    delta: z
      .number()
      .int()
      .min(-10000000)
      .max(10000000)
      .refine((v) => v !== 0, 'La cantidad debe ser distinta de cero.'),
    reason: text(5, 300),
  })
  .strict();
export const loginSchema = z.object({ email: z.email().max(150), password: z.string().min(1).max(200) });
export class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}
export function parseId(value) {
  if (
    !/^\d+$/.test(String(value)) ||
    !Number.isSafeInteger(Number(value)) ||
    Number(value) < 1 ||
    Number(value) > 2147483647
  )
    throw new ApiError(400, 'El identificador no es válido.');
  return Number(value);
}
export function classifyExpiry(days) {
  if (days < 0) return 'expired';
  if (days <= 30) return '30';
  if (days <= 60) return '60';
  if (days <= 90) return '90';
  return 'healthy';
}
export const expiryCase = `CASE WHEN daysToExpiry < 0 THEN 'expired' WHEN daysToExpiry <= 30 THEN '30' WHEN daysToExpiry <= 60 THEN '60' WHEN daysToExpiry <= 90 THEN '90' ELSE 'healthy' END`;
