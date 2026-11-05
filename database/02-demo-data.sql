/* Datos ilustrativos con fechas relativas al día de instalación.
   Se ejecuta únicamente cuando Products y Shelves están vacías. */
SET XACT_ABORT ON;
IF NOT EXISTS (SELECT 1 FROM dbo.Products) AND NOT EXISTS (SELECT 1 FROM dbo.Shelves)
BEGIN
  BEGIN TRANSACTION;
  INSERT dbo.Shelves(code, name, location, description) VALUES
    ('EST-A01', N'Medicamentos generales', N'Pasillo A · Nivel 1', N'Medicamentos de uso frecuente.'),
    ('EST-A02', N'Antibióticos', N'Pasillo A · Nivel 2', N'Medicamentos de venta bajo receta.'),
    ('EST-B01', N'Cuidado y bienestar', N'Pasillo B · Nivel 1', N'Vitaminas, suplementos y cuidado personal.'),
    ('EST-C01', N'Primeros auxilios', N'Pasillo C · Nivel 1', N'Antisépticos y material de curación.');
  INSERT dbo.Products(name, description, category, purchasePrice, salePrice, minStock) VALUES
    (N'Paracetamol 500 mg', N'Caja de 20 comprimidos. Analgésico y antipirético.', N'Analgésicos', 8.50, 15.00, 50),
    (N'Ibuprofeno 400 mg', N'Caja de 10 comprimidos. Antiinflamatorio.', N'Analgésicos', 10.00, 18.50, 40),
    (N'Amoxicilina 500 mg', N'Caja de 21 cápsulas. Venta bajo receta médica.', N'Antibióticos', 22.00, 35.00, 30),
    (N'Loratadina 10 mg', N'Caja de 10 comprimidos. Antihistamínico.', N'Antialérgicos', 7.00, 12.50, 25),
    (N'Omeprazol 20 mg', N'Caja de 14 cápsulas gastrorresistentes.', N'Gastrointestinales', 12.00, 22.00, 35),
    (N'Vitamina C 1000 mg', N'Tubo de 20 tabletas efervescentes.', N'Vitaminas', 28.00, 45.00, 20),
    (N'Alcohol medicinal 70%', N'Frasco de 250 ml. Uso externo.', N'Primeros auxilios', 6.50, 12.00, 30),
    (N'Complejo B', N'Caja de 30 comprimidos. Suplemento vitamínico.', N'Vitaminas', 18.00, 30.00, 20),
    (N'Diclofenaco 50 mg', N'Caja de 20 comprimidos. Antiinflamatorio.', N'Analgésicos', 9.00, 16.00, 30),
    (N'Azitromicina 500 mg', N'Caja de 3 comprimidos. Venta bajo receta médica.', N'Antibióticos', 20.00, 34.00, 15),
    (N'Suero fisiológico 0,9%', N'Frasco de 500 ml. Solución estéril.', N'Primeros auxilios', 8.00, 14.00, 25),
    (N'Cetirizina 10 mg', N'Caja de 10 comprimidos. Antihistamínico.', N'Antialérgicos', 9.00, 17.00, 25);
  DECLARE @today DATE = CONVERT(DATE, DATEADD(HOUR, -4, SYSUTCDATETIME()));
  INSERT dbo.Batches(productId, shelfId, batchNumber, entryDate, expiryDate, quantity)
  SELECT p.id, s.id, v.batchNumber, DATEADD(DAY,-120,@today), DATEADD(DAY,v.days,@today), v.qty
  FROM (VALUES
    (N'Paracetamol 500 mg','EST-A01','PAR-2601',18,85),
    (N'Paracetamol 500 mg','EST-A01','PAR-2602',240,160),
    (N'Ibuprofeno 400 mg','EST-A01','IBU-2601',45,28),
    (N'Amoxicilina 500 mg','EST-A02','AMX-2601',-12,18),
    (N'Amoxicilina 500 mg','EST-A02','AMX-2602',185,96),
    (N'Loratadina 10 mg','EST-A01','LOR-2601',72,64),
    (N'Omeprazol 20 mg','EST-A01','OMP-2601',25,22),
    (N'Vitamina C 1000 mg','EST-B01','VIT-2601',320,48),
    (N'Alcohol medicinal 70%','EST-C01','ALC-2601',450,75),
    (N'Complejo B','EST-B01','CPB-2601',55,14),
    (N'Diclofenaco 50 mg','EST-A01','DIC-2601',88,56),
    (N'Azitromicina 500 mg','EST-A02','AZI-2601',-5,8),
    (N'Azitromicina 500 mg','EST-A02','AZI-2602',150,12),
    (N'Suero fisiológico 0,9%','EST-C01','SUE-2601',365,90),
    (N'Cetirizina 10 mg','EST-A01','CET-2601',210,42)
  ) v(productName,shelfCode,batchNumber,days,qty)
  JOIN dbo.Products p ON p.name = v.productName
  JOIN dbo.Shelves s ON s.code = v.shelfCode;
  INSERT dbo.Movements(batchId,productName,batchNumber,type,delta,reason)
  SELECT id, productName, batchNumber, 'entry', quantity, N'Inventario inicial de demostración' FROM dbo.vBatches;
  COMMIT;
END;
GO
