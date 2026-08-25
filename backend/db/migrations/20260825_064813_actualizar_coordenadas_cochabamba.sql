-- ============================================================
--  SIGMA-SCI · Migración
--  Fecha: 2026-08-25 06:48:13
--  Descripción: Reubica las unidades operativas demo de Lima,
--  Perú a Cochabamba, Bolivia (coordenadas de despliegue real).
--  Ejecutar en producción con:
--     mysql -u root -p sigma_sci < 20260825_064813_actualizar_coordenadas_cochabamba.sql
-- ============================================================
USE sigma_sci;

UPDATE unidades_operativas SET lat=-17.3895, lng=-66.1568 WHERE codigo='AMB-01';
UPDATE unidades_operativas SET lat=-17.3860, lng=-66.1500 WHERE codigo='AUT-02';
UPDATE unidades_operativas SET lat=-17.3650, lng=-66.1600 WHERE codigo='RES-03';
UPDATE unidades_operativas SET lat=-17.3895, lng=-66.1568 WHERE codigo='DRN-04';
UPDATE unidades_operativas SET lat=-17.4200, lng=-66.1450 WHERE codigo='VLI-05';
