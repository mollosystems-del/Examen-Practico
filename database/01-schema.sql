/* Farma Inventario · SQL Server 2019+ · ejecutar sobre la base FarmaInventario.
   Script idempotente: no borra tablas ni datos existentes. */
SET XACT_ABORT ON;
GO
IF OBJECT_ID('dbo.Users', 'U') IS NULL
CREATE TABLE dbo.Users (
  id INT IDENTITY PRIMARY KEY,
  name NVARCHAR(100) NOT NULL,
  email NVARCHAR(150) NOT NULL CONSTRAINT UQ_Users_email UNIQUE,
  passwordHash NVARCHAR(255) NOT NULL,
  createdAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
);
GO
IF OBJECT_ID('dbo.Products', 'U') IS NULL
CREATE TABLE dbo.Products (
  id INT IDENTITY PRIMARY KEY,
  name NVARCHAR(150) NOT NULL,
  description NVARCHAR(1000) NOT NULL DEFAULT '',
  category NVARCHAR(80) NOT NULL,
  purchasePrice DECIMAL(10,2) NOT NULL CHECK (purchasePrice >= 0),
  salePrice DECIMAL(10,2) NOT NULL CHECK (salePrice >= 0),
  minStock INT NOT NULL CHECK (minStock >= 0),
  createdAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  updatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
);
GO
IF OBJECT_ID('dbo.Shelves', 'U') IS NULL
CREATE TABLE dbo.Shelves (
  id INT IDENTITY PRIMARY KEY,
  code NVARCHAR(30) NOT NULL CONSTRAINT UQ_Shelves_code UNIQUE,
  name NVARCHAR(100) NOT NULL,
  location NVARCHAR(200) NOT NULL,
  description NVARCHAR(1000) NOT NULL DEFAULT '',
  createdAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  updatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
);
GO
IF OBJECT_ID('dbo.Batches', 'U') IS NULL
CREATE TABLE dbo.Batches (
  id INT IDENTITY PRIMARY KEY,
  productId INT NOT NULL REFERENCES dbo.Products(id),
  shelfId INT NOT NULL REFERENCES dbo.Shelves(id),
  batchNumber NVARCHAR(60) NOT NULL,
  entryDate DATE NOT NULL,
  expiryDate DATE NOT NULL,
  quantity INT NOT NULL CHECK (quantity >= 0),
  createdAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  updatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  CONSTRAINT CK_Batches_dates CHECK (expiryDate >= entryDate),
  CONSTRAINT UQ_Batches_product_number UNIQUE (productId, batchNumber)
);
GO
IF OBJECT_ID('dbo.Movements', 'U') IS NULL
CREATE TABLE dbo.Movements (
  id INT IDENTITY PRIMARY KEY,
  batchId INT NULL REFERENCES dbo.Batches(id) ON DELETE SET NULL,
  productName NVARCHAR(150) NOT NULL,
  batchNumber NVARCHAR(60) NOT NULL,
  type NVARCHAR(20) NOT NULL CHECK (type IN ('entry','adjustment','update','deletion')),
  delta INT NOT NULL,
  reason NVARCHAR(300) NOT NULL,
  userId INT NULL REFERENCES dbo.Users(id),
  createdAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
);
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Batches_expiry')
  CREATE INDEX IX_Batches_expiry ON dbo.Batches(expiryDate) INCLUDE(quantity, productId, shelfId);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Batches_shelf')
  CREATE INDEX IX_Batches_shelf ON dbo.Batches(shelfId);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Movements_created')
  CREATE INDEX IX_Movements_created ON dbo.Movements(createdAt DESC);
GO
/* Fecha comercial: America/La_Paz (UTC-4). El día de vencimiento pertenece a 0–30. */
CREATE OR ALTER VIEW dbo.vBatches AS
SELECT b.*, p.name AS productName, p.category, p.purchasePrice, p.salePrice,
  s.code AS shelfCode, s.name AS shelfName, s.location,
  DATEDIFF(DAY, CONVERT(DATE, DATEADD(HOUR, -4, SYSUTCDATETIME())), b.expiryDate) AS daysToExpiry
FROM dbo.Batches b
JOIN dbo.Products p ON p.id = b.productId
JOIN dbo.Shelves s ON s.id = b.shelfId;
GO
CREATE OR ALTER VIEW dbo.vProducts AS
SELECT p.*, COALESCE(q.stock, 0) AS stock, COALESCE(q.totalStock, 0) AS totalStock,
  COALESCE(q.batchCount, 0) AS batchCount, q.nextExpiry
FROM dbo.Products p
OUTER APPLY (
  SELECT SUM(CASE WHEN v.daysToExpiry >= 0 THEN v.quantity ELSE 0 END) AS stock,
    SUM(v.quantity) AS totalStock, COUNT(*) AS batchCount,
    MIN(CASE WHEN v.daysToExpiry >= 0 AND v.quantity > 0 THEN v.expiryDate END) AS nextExpiry
  FROM dbo.vBatches v WHERE v.productId = p.id
) q;
GO
