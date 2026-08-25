function noEncontrado(req, res) {
  res.status(404).json({ error: `Ruta no encontrada: ${req.method} ${req.originalUrl}` });
}

function manejadorErrores(err, req, res, next) { // eslint-disable-line
  console.error('[error]', err);
  if (err.code === 'ER_DUP_ENTRY') {
    return res.status(409).json({ error: 'Ya existe un registro con ese dato único.' });
  }
  if (err.name === 'ZodError') {
    return res.status(422).json({ error: 'Revisa los campos marcados.', detalle: err.errors });
  }
  res.status(err.status || 500).json({ error: err.message || 'Error interno del servidor.' });
}

module.exports = { noEncontrado, manejadorErrores };
