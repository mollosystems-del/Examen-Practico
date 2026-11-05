import { LayoutDashboard, Package, Layers3, Archive, Clock3, History } from 'lucide-react';
export const NAV = [
  { key: 'dashboard', label: 'Resumen', icon: LayoutDashboard, section: 'PRINCIPAL' },
  { key: 'products', label: 'Productos', icon: Package, section: 'INVENTARIO' },
  { key: 'batches', label: 'Lotes', icon: Layers3 },
  { key: 'shelves', label: 'Estantes', icon: Archive },
  { key: 'alerts', label: 'Vencimientos', icon: Clock3, section: 'SEGUIMIENTO' },
  { key: 'movements', label: 'Movimientos', icon: History },
];
export const STATUS = {
  expired: { label: 'Vencido', class: 'red', color: '#d5675d' },
  30: { label: 'En 0–30 días', class: 'orange', color: '#e3a46a' },
  60: { label: 'En 31–60 días', class: 'yellow', color: '#e6cd83' },
  90: { label: 'En 61–90 días', class: 'blue', color: '#8daea3' },
  healthy: { label: 'Vigente', class: 'green', color: '#4d846c' },
};
export const PRODUCT_COLUMNS = [
  ['Producto', 'name'],
  ['Descripción', 'description'],
  ['Categoría', 'category'],
  ['Compra (Bs)', 'purchasePrice'],
  ['Venta (Bs)', 'salePrice'],
  ['Stock disponible', 'stock'],
  ['Stock mínimo', 'minStock'],
];
export const BATCH_COLUMNS = [
  ['Producto', 'productName'],
  ['Lote', 'batchNumber'],
  ['Ingreso', (r) => r.entryDate.slice(0, 10)],
  ['Vencimiento', (r) => r.expiryDate.slice(0, 10)],
  ['Unidades', 'quantity'],
  ['Estante', 'shelfCode'],
  ['Estado', (r) => STATUS[r.status].label],
];
