-- ============================================================
--  SIGMA-SCI · Datos iniciales (roles y catálogo)
--  Ejecutar DESPUÉS de schema.sql:
--     mysql -u root -p sigma_sci < seed.sql
--  Los usuarios demo se crean con:  npm run seed  (hashea contraseñas)
-- ============================================================
USE sigma_sci;

INSERT INTO roles (nombre, descripcion) VALUES
  ('administrador',  'Control total del sistema, usuarios, catálogos y auditoría.'),
  ('rescatista',     'Personal en campo. Envía ubicación, reporta estado y consulta su incidente.'),
  ('operaciones',    'Gestiona incidentes, despliegue de unidades y estructura SCI.'),
  ('logistica',      'Administra unidades operativas, personal y recursos.'),
  ('comunicaciones', 'Emite alertas, boletines de prensa y notificaciones por WhatsApp.');

INSERT INTO unidades_operativas (codigo, tipo, placa, descripcion, capacidad, base, estado, lat, lng) VALUES
  ('AMB-01', 'ambulancia',      'EMG-1201', 'Ambulancia de soporte vital avanzado', 3, 'Base Central',  'disponible',  -17.3895, -66.1568),
  ('AUT-02', 'autobomba',       'EMG-3302', 'Autobomba 3000 galones',               6, 'Base Central',  'disponible',  -17.3860, -66.1500),
  ('RES-03', 'rescate',         'EMG-4410', 'Unidad de rescate vehicular y alturas', 5, 'Base Norte',    'disponible',  -17.3650, -66.1600),
  ('DRN-04', 'dron',            NULL,       'Dron de reconocimiento con térmica',    0, 'Base Central',  'disponible',  -17.3895, -66.1568),
  ('VLI-05', 'vehiculo_ligero', 'EMG-5521', 'Vehículo de comando móvil',             4, 'Base Sur',      'disponible',  -17.4200, -66.1450);

INSERT INTO personal_emergencia
  (codigo, nombres, apellidos, documento, tipo_sangre, telefono, contacto_emergencia, telefono_emergencia, institucion, especialidad, nivel_certificacion, estado) VALUES
  ('P-0001','Marco',   'Salazar',  '40125896','O+',  '+51987654321','Ana Salazar',  '+51987000111','Cuerpo de Bomberos','Rescate vehicular',     'avanzado',   'activo'),
  ('P-0002','Lucía',   'Ferreyra', '40125897','A-',  '+51987654322','Jorge Ferreyra','+51987000112','Defensa Civil',    'Paramédico',            'intermedio', 'activo'),
  ('P-0003','Diego',   'Quispe',   '40125898','B+',  '+51987654323','Rosa Quispe',  '+51987000113','Cruz Roja',         'Búsqueda y rescate',    'avanzado',   'activo'),
  ('P-0004','Valeria', 'Ríos',     '40125899','AB+', '+51987654324','Luis Ríos',    '+51987000114','Defensa Civil',     'Materiales peligrosos', 'instructor', 'activo');
