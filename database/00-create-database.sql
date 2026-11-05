/* Ejecutar primero con SSMS o sqlcmd. No sobrescribe bases existentes. */
USE master;
GO
IF DB_ID(N'FarmaInventario') IS NULL
  CREATE DATABASE FarmaInventario COLLATE Latin1_General_100_CI_AI;
GO
USE FarmaInventario;
GO
/* Luego ejecutar 01-schema.sql y, opcionalmente, 02-demo-data.sql aquí.
   npm run setup automatiza estos pasos y crea el administrador. */
