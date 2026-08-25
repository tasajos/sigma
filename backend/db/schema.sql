-- ============================================================
--  SIGMA-SCI · Sistema de Monitoreo ante Eventos Adversos
--  Motor: MySQL 8.0+
--  Ejecutar:  mysql -u root -p < schema.sql
-- ============================================================

DROP DATABASE IF EXISTS sigma_sci;
CREATE DATABASE sigma_sci CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE sigma_sci;

-- ------------------------------------------------------------
-- 1. Roles y usuarios
-- ------------------------------------------------------------
CREATE TABLE roles (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  nombre      VARCHAR(30)  NOT NULL UNIQUE,
  descripcion VARCHAR(180) NOT NULL
) ENGINE=InnoDB;

CREATE TABLE usuarios (
  id             INT AUTO_INCREMENT PRIMARY KEY,
  nombres        VARCHAR(80)  NOT NULL,
  apellidos      VARCHAR(80)  NOT NULL,
  email          VARCHAR(120) NOT NULL UNIQUE,
  password_hash  VARCHAR(255) NOT NULL,
  telefono       VARCHAR(25),
  rol_id         INT NOT NULL,
  estado         ENUM('pendiente','activo','suspendido') NOT NULL DEFAULT 'pendiente',
  ultimo_acceso  DATETIME NULL,
  creado_en      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_usuario_rol FOREIGN KEY (rol_id) REFERENCES roles(id),
  INDEX idx_usuarios_estado (estado)
) ENGINE=InnoDB;

-- ------------------------------------------------------------
-- 2. Registro de personal de emergencias
-- ------------------------------------------------------------
CREATE TABLE personal_emergencia (
  id                  INT AUTO_INCREMENT PRIMARY KEY,
  usuario_id          INT NULL UNIQUE,
  codigo              VARCHAR(20) NOT NULL UNIQUE,
  nombres             VARCHAR(80) NOT NULL,
  apellidos           VARCHAR(80) NOT NULL,
  documento           VARCHAR(25) NOT NULL UNIQUE,
  fecha_nacimiento    DATE NULL,
  tipo_sangre         ENUM('O+','O-','A+','A-','B+','B-','AB+','AB-') NULL,
  telefono            VARCHAR(25),
  contacto_emergencia VARCHAR(120),
  telefono_emergencia VARCHAR(25),
  institucion         VARCHAR(120),
  especialidad        VARCHAR(120),
  nivel_certificacion ENUM('basico','intermedio','avanzado','instructor') DEFAULT 'basico',
  vence_certificacion DATE NULL,
  estado              ENUM('activo','descanso','baja') NOT NULL DEFAULT 'activo',
  creado_en           TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_personal_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE SET NULL,
  INDEX idx_personal_estado (estado)
) ENGINE=InnoDB;

-- ------------------------------------------------------------
-- 3. Registro de unidades operativas
-- ------------------------------------------------------------

-- Catálogo editable de categorías de unidad. El prefijo (AMB, AUT, ...)
-- es la base para autoincrementar el código de cada unidad nueva.
CREATE TABLE tipos_unidad (
  clave     VARCHAR(30) PRIMARY KEY,
  etiqueta  VARCHAR(60) NOT NULL,
  prefijo   VARCHAR(10) NOT NULL UNIQUE,
  creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE unidades_operativas (
  id             INT AUTO_INCREMENT PRIMARY KEY,
  codigo         VARCHAR(20) NOT NULL UNIQUE,
  tipo           VARCHAR(30) NOT NULL,
  placa          VARCHAR(15),
  descripcion    VARCHAR(180),
  capacidad      INT DEFAULT 0,
  base           VARCHAR(120),
  responsable_id INT NULL,
  estado         ENUM('disponible','en_ruta','en_escena','mantenimiento','fuera_servicio') NOT NULL DEFAULT 'disponible',
  lat            DECIMAL(10,7) NULL,
  lng            DECIMAL(10,7) NULL,
  creado_en      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_unidad_responsable FOREIGN KEY (responsable_id) REFERENCES personal_emergencia(id) ON DELETE SET NULL,
  CONSTRAINT fk_unidad_tipo FOREIGN KEY (tipo) REFERENCES tipos_unidad(clave),
  INDEX idx_unidades_estado (estado)
) ENGINE=InnoDB;

-- ------------------------------------------------------------
-- 4. Incidentes / eventos adversos
-- ------------------------------------------------------------
CREATE TABLE incidentes (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  codigo        VARCHAR(25) NOT NULL UNIQUE,
  titulo        VARCHAR(160) NOT NULL,
  descripcion   TEXT,
  tipo          ENUM('incendio','inundacion','sismo','deslizamiento','accidente_vehicular','materiales_peligrosos','busqueda_rescate','estructural','sanitario','otro') NOT NULL,
  nivel_alerta  ENUM('verde','amarillo','naranja','rojo') NOT NULL DEFAULT 'verde',
  estado        ENUM('activo','controlado','cerrado') NOT NULL DEFAULT 'activo',
  lat           DECIMAL(10,7) NOT NULL,
  lng           DECIMAL(10,7) NOT NULL,
  direccion     VARCHAR(200),
  afectados     INT DEFAULT 0,
  sci_activado  BOOLEAN NOT NULL DEFAULT FALSE,
  reportado_por INT NULL,
  fecha_inicio  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  fecha_cierre  DATETIME NULL,
  CONSTRAINT fk_incidente_usuario FOREIGN KEY (reportado_por) REFERENCES usuarios(id) ON DELETE SET NULL,
  INDEX idx_incidentes_estado (estado, nivel_alerta)
) ENGINE=InnoDB;

-- ------------------------------------------------------------
-- 5. Sistema de Comando de Incidentes (SCI)
-- ------------------------------------------------------------
CREATE TABLE sci_estructura (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  incidente_id INT NOT NULL,
  puesto       ENUM(
                 'comandante_incidente',
                 'oficial_seguridad',
                 'oficial_informacion_publica',
                 'oficial_enlace',
                 'jefe_operaciones',
                 'jefe_planificacion',
                 'jefe_logistica',
                 'jefe_administracion_finanzas'
               ) NOT NULL,
  personal_id  INT NULL,
  usuario_id   INT NULL,
  notas        VARCHAR(255),
  activo       BOOLEAN NOT NULL DEFAULT TRUE,
  asignado_en  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_sci_incidente FOREIGN KEY (incidente_id) REFERENCES incidentes(id) ON DELETE CASCADE,
  CONSTRAINT fk_sci_personal  FOREIGN KEY (personal_id)  REFERENCES personal_emergencia(id) ON DELETE SET NULL,
  CONSTRAINT fk_sci_usuario   FOREIGN KEY (usuario_id)   REFERENCES usuarios(id) ON DELETE SET NULL,
  UNIQUE KEY uq_sci_puesto (incidente_id, puesto)
) ENGINE=InnoDB;

-- Objetivos operacionales del periodo (formulario SCI-202 simplificado)
CREATE TABLE sci_objetivos (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  incidente_id INT NOT NULL,
  descripcion  VARCHAR(255) NOT NULL,
  prioridad    ENUM('alta','media','baja') NOT NULL DEFAULT 'media',
  cumplido     BOOLEAN NOT NULL DEFAULT FALSE,
  creado_en    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_obj_incidente FOREIGN KEY (incidente_id) REFERENCES incidentes(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- Recursos asignados al incidente (unidades)
CREATE TABLE asignaciones_unidad (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  incidente_id INT NOT NULL,
  unidad_id    INT NOT NULL,
  asignado_en  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  liberado_en  DATETIME NULL,
  CONSTRAINT fk_asig_incidente FOREIGN KEY (incidente_id) REFERENCES incidentes(id) ON DELETE CASCADE,
  CONSTRAINT fk_asig_unidad    FOREIGN KEY (unidad_id)    REFERENCES unidades_operativas(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ------------------------------------------------------------
-- 6. Ubicaciones enviadas desde campo
-- ------------------------------------------------------------
CREATE TABLE ubicaciones (
  id            BIGINT AUTO_INCREMENT PRIMARY KEY,
  usuario_id    INT NOT NULL,
  incidente_id  INT NULL,
  lat           DECIMAL(10,7) NOT NULL,
  lng           DECIMAL(10,7) NOT NULL,
  precision_m   DECIMAL(8,2) NULL,
  altitud_m     DECIMAL(8,2) NULL,
  bateria       TINYINT NULL,
  estado        ENUM('disponible','en_movimiento','en_escena','emergencia','fuera_servicio') NOT NULL DEFAULT 'disponible',
  nota          VARCHAR(200),
  reportado_en  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_ubic_usuario   FOREIGN KEY (usuario_id)   REFERENCES usuarios(id) ON DELETE CASCADE,
  CONSTRAINT fk_ubic_incidente FOREIGN KEY (incidente_id) REFERENCES incidentes(id) ON DELETE SET NULL,
  INDEX idx_ubic_usuario_fecha (usuario_id, reportado_en)
) ENGINE=InnoDB;

-- ------------------------------------------------------------
-- 7. Alertas y notificaciones
-- ------------------------------------------------------------
CREATE TABLE alertas (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  incidente_id INT NULL,
  nivel        ENUM('verde','amarillo','naranja','rojo') NOT NULL,
  titulo       VARCHAR(160) NOT NULL,
  mensaje      TEXT NOT NULL,
  canal        ENUM('interno','whatsapp','prensa','todos') NOT NULL DEFAULT 'interno',
  emitida_por  INT NULL,
  leida        BOOLEAN NOT NULL DEFAULT FALSE,
  emitida_en   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_alerta_incidente FOREIGN KEY (incidente_id) REFERENCES incidentes(id) ON DELETE CASCADE,
  CONSTRAINT fk_alerta_usuario   FOREIGN KEY (emitida_por)  REFERENCES usuarios(id) ON DELETE SET NULL,
  INDEX idx_alertas_nivel (nivel, emitida_en)
) ENGINE=InnoDB;

CREATE TABLE boletines_prensa (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  incidente_id INT NULL,
  nivel        ENUM('verde','amarillo','naranja','rojo') NOT NULL,
  titulo       VARCHAR(180) NOT NULL,
  cuerpo       TEXT NOT NULL,
  vocero       VARCHAR(120),
  estado       ENUM('borrador','aprobado','publicado') NOT NULL DEFAULT 'borrador',
  creado_por   INT NULL,
  creado_en    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  publicado_en DATETIME NULL,
  CONSTRAINT fk_boletin_incidente FOREIGN KEY (incidente_id) REFERENCES incidentes(id) ON DELETE SET NULL,
  CONSTRAINT fk_boletin_usuario   FOREIGN KEY (creado_por)   REFERENCES usuarios(id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE notificaciones_whatsapp (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  destino      VARCHAR(25) NOT NULL,
  mensaje      TEXT NOT NULL,
  lat          DECIMAL(10,7) NULL,
  lng          DECIMAL(10,7) NULL,
  incidente_id INT NULL,
  modo         ENUM('enlace','api') NOT NULL DEFAULT 'enlace',
  estado       ENUM('generado','enviado','fallido') NOT NULL DEFAULT 'generado',
  enviado_por  INT NULL,
  enviado_en   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_wa_incidente FOREIGN KEY (incidente_id) REFERENCES incidentes(id) ON DELETE SET NULL,
  CONSTRAINT fk_wa_usuario   FOREIGN KEY (enviado_por)  REFERENCES usuarios(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- ------------------------------------------------------------
-- 8. Bitácora de auditoría
-- ------------------------------------------------------------
CREATE TABLE bitacora (
  id         BIGINT AUTO_INCREMENT PRIMARY KEY,
  usuario_id INT NULL,
  accion     VARCHAR(60) NOT NULL,
  entidad    VARCHAR(60) NOT NULL,
  entidad_id INT NULL,
  detalle    VARCHAR(255),
  ip         VARCHAR(45),
  creado_en  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_bitacora_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE SET NULL,
  INDEX idx_bitacora_fecha (creado_en)
) ENGINE=InnoDB;

-- ------------------------------------------------------------
-- Vista: última posición conocida de cada actor en campo
-- ------------------------------------------------------------
CREATE OR REPLACE VIEW v_ultima_ubicacion AS
SELECT u.id, u.usuario_id, us.nombres, us.apellidos, r.nombre AS rol,
       u.lat, u.lng, u.precision_m, u.estado, u.nota, u.incidente_id, u.reportado_en
FROM ubicaciones u
JOIN usuarios us ON us.id = u.usuario_id
JOIN roles r     ON r.id = us.rol_id
WHERE u.id IN (SELECT MAX(id) FROM ubicaciones GROUP BY usuario_id);
