-- ============================================================
--  SIGMA-SCI · Migración
--  Fecha: 2026-08-25 08:55:32
--  Descripción: Convierte el tipo de unidad operativa de un ENUM
--  fijo a un catálogo editable (tabla tipos_unidad), para poder
--  agregar nuevas categorías desde la app sin volver a desplegar
--  el backend. Cada categoría define un prefijo (AMB, AUT, ...)
--  que el backend usa para autoincrementar el código de unidad
--  y evitar códigos duplicados dentro de una misma categoría.
--  Ejecutar en producción con:
--     mysql -u root -p sigma_sci < 20260825_085532_categorias_unidad_dinamicas.sql
-- ============================================================
USE sigma_sci;

CREATE TABLE tipos_unidad (
  clave     VARCHAR(30) PRIMARY KEY,
  etiqueta  VARCHAR(60) NOT NULL,
  prefijo   VARCHAR(10) NOT NULL UNIQUE,
  creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

INSERT INTO tipos_unidad (clave, etiqueta, prefijo) VALUES
  ('ambulancia',      'Ambulancia',       'AMB'),
  ('autobomba',        'Autobomba',        'AUT'),
  ('rescate',          'Rescate',          'RES'),
  ('cisterna',         'Cisterna',         'CIS'),
  ('vehiculo_ligero',  'Vehículo ligero',  'VLI'),
  ('embarcacion',      'Embarcación',      'EMB'),
  ('dron',             'Dron',             'DRN'),
  ('moto',             'Moto',             'MOT');

ALTER TABLE unidades_operativas
  MODIFY tipo VARCHAR(30) NOT NULL,
  ADD CONSTRAINT fk_unidad_tipo FOREIGN KEY (tipo) REFERENCES tipos_unidad(clave);
