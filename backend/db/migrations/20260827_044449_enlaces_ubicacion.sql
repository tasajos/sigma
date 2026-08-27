-- ============================================================
--  SIGMA-SCI · Migración
--  Fecha: 2026-08-27 04:44:49
--  Descripción: Enlaces públicos de ubicación compartida. Permiten
--  al centro de monitoreo solicitar la posición en tiempo real de
--  CUALQUIER dispositivo (esté o no registrado como personal), vía
--  un enlace enviado por WhatsApp. El destinatario abre el enlace,
--  autoriza desde su navegador (sin iniciar sesión) y su posición se
--  transmite y se ve en vivo en el mapa mientras la sesión esté activa.
--  Ejecutar en producción con:
--     mysql -u root -p sigma_sci < 20260827_044449_enlaces_ubicacion.sql
-- ============================================================
USE sigma_sci;

CREATE TABLE enlaces_ubicacion (
  id               INT AUTO_INCREMENT PRIMARY KEY,
  token            VARCHAR(48) NOT NULL UNIQUE,
  etiqueta         VARCHAR(120) NOT NULL,
  telefono         VARCHAR(25) NULL,
  incidente_id     INT NULL,
  creado_por       INT NOT NULL,
  estado           ENUM('pendiente','activo','rechazado','finalizado') NOT NULL DEFAULT 'pendiente',
  lat              DECIMAL(10,7) NULL,
  lng              DECIMAL(10,7) NULL,
  precision_m      DECIMAL(8,2) NULL,
  ultima_actividad TIMESTAMP NULL,
  expira_en        DATETIME NOT NULL,
  creado_en        TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_enlace_incidente FOREIGN KEY (incidente_id) REFERENCES incidentes(id) ON DELETE SET NULL,
  CONSTRAINT fk_enlace_usuario   FOREIGN KEY (creado_por)   REFERENCES usuarios(id) ON DELETE CASCADE,
  INDEX idx_enlace_estado (estado, expira_en)
) ENGINE=InnoDB;

-- Recorrido de cada enlace mientras transmite (para trazar su ruta en el mapa)
CREATE TABLE enlace_posiciones (
  id           BIGINT AUTO_INCREMENT PRIMARY KEY,
  enlace_id    INT NOT NULL,
  lat          DECIMAL(10,7) NOT NULL,
  lng          DECIMAL(10,7) NOT NULL,
  precision_m  DECIMAL(8,2) NULL,
  reportado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_enlacepos_enlace FOREIGN KEY (enlace_id) REFERENCES enlaces_ubicacion(id) ON DELETE CASCADE,
  INDEX idx_enlacepos_enlace_fecha (enlace_id, reportado_en)
) ENGINE=InnoDB;
