import { useState, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Circle, useMapEvents, LayersControl } from 'react-leaflet';
import L from 'leaflet';

/* ============================================================
   Capas base — todas gratuitas y sin clave de API.
   No se utiliza Google Maps en ningún punto del sistema.
   ============================================================ */
export const CAPAS = {
  satelite: {
    nombre: 'Satélite',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    atribucion: 'Imagery &copy; Esri, Maxar, Earthstar Geographics',
    maxZoom: 19
  },
  roadmap: {
    nombre: 'Roadmap',
    url: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
    atribucion: '&copy; OpenStreetMap &copy; CARTO',
    maxZoom: 20
  },
  calles: {
    nombre: 'Calles',
    url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    atribucion: '&copy; colaboradores de OpenStreetMap',
    maxZoom: 19
  }
};

/* Etiquetas superpuestas para que la vista satélite siga siendo legible */
const ETIQUETAS_SATELITE =
  'https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}';

const COLOR_ESTADO = {
  disponible:    '#17825A',
  en_movimiento: '#0E7C8C',
  en_escena:     '#A66A05',
  emergencia:    '#B32424',
  fuera_servicio:'#5C7284'
};

const COLOR_NIVEL = {
  verde: '#17825A', amarillo: '#A66A05', naranja: '#BF4D10', rojo: '#B32424'
};

const INICIAL = {
  siglas: { rescatista: 'R', operaciones: 'O', logistica: 'L', comunicaciones: 'C', administrador: 'A' }
};

function iconoPersonal(estado, rol) {
  const color = COLOR_ESTADO[estado] || '#0E7C8C';
  const pulso = estado === 'emergencia' ? ' marcador-pulso' : '';
  return L.divIcon({
    className: '',
    html: `<div class="marcador-campo${pulso}" style="background:${color}">
             <span>${INICIAL.siglas[rol] || '·'}</span>
           </div>`,
    iconSize: [26, 26],
    iconAnchor: [13, 26],
    popupAnchor: [0, -26]
  });
}

function iconoIncidente(nivel) {
  const color = COLOR_NIVEL[nivel] || '#17825A';
  return L.divIcon({
    className: '',
    html: `<div style="width:32px;height:32px;border-radius:3px;transform:rotate(45deg);
             background:${color};border:2.5px solid #fff;box-shadow:0 3px 10px rgba(0,0,0,.55);
             display:flex;align-items:center;justify-content:center">
             <span style="transform:rotate(-45deg);color:#fff;font-weight:700;font-size:15px">!</span>
           </div>`,
    iconSize: [32, 32], iconAnchor: [16, 32], popupAnchor: [0, -32]
  });
}

function iconoUnidad(estado) {
  const color = estado === 'disponible' ? '#17825A' : estado === 'fuera_servicio' ? '#5C7284' : '#BF4D10';
  return L.divIcon({
    className: '',
    html: `<div style="width:24px;height:18px;border-radius:3px;background:${color};
             border:2px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.5);
             display:flex;align-items:center;justify-content:center;color:#fff;font-size:11px;font-weight:700">U</div>`,
    iconSize: [24, 18], iconAnchor: [12, 18], popupAnchor: [0, -18]
  });
}

/** Captura clics para colocar un punto nuevo */
function CapturarClic({ alHacerClic }) {
  useMapEvents({ click(e) { alHacerClic?.({ lat: e.latlng.lat, lng: e.latlng.lng }); } });
  return null;
}

export default function MapaOperativo({
  centro,
  zoom = 12,
  posiciones = [],
  incidentes = [],
  unidades = [],
  puntoSeleccionado = null,
  alHacerClic = null,
  alCompartirWhatsapp = null,
  mostrarLeyenda = true,
  alturaCompleta = true
}) {
  const [capa, setCapa] = useState('roadmap');
  const centroFinal = useMemo(() => centro || [
    Number(import.meta.env.VITE_MAPA_LAT || -17.3895),
    Number(import.meta.env.VITE_MAPA_LNG || -66.1568)
  ], [centro]);

  return (
    <div className="mapa-marco" style={alturaCompleta ? undefined : { height: 380 }}>
      <div className="selector-capas" role="group" aria-label="Capas del mapa">
        {Object.entries(CAPAS).map(([clave, c]) => (
          <button
            key={clave}
            className={capa === clave ? 'activo' : ''}
            onClick={() => setCapa(clave)}
            aria-pressed={capa === clave}
          >{c.nombre}</button>
        ))}
      </div>

      <MapContainer center={centroFinal} zoom={zoom} scrollWheelZoom zoomControl>
        <TileLayer
          key={capa}
          url={CAPAS[capa].url}
          attribution={CAPAS[capa].atribucion}
          maxZoom={CAPAS[capa].maxZoom}
        />
        {capa === 'satelite' && <TileLayer url={ETIQUETAS_SATELITE} />}

        {alHacerClic && <CapturarClic alHacerClic={alHacerClic} />}

        {/* Incidentes */}
        {incidentes.filter(i => i.lat && i.lng).map(i => (
          <div key={`inc-${i.id}`}>
            <Circle
              center={[Number(i.lat), Number(i.lng)]}
              radius={i.nivel_alerta === 'rojo' ? 800 : i.nivel_alerta === 'naranja' ? 500 : 250}
              pathOptions={{ color: COLOR_NIVEL[i.nivel_alerta], fillColor: COLOR_NIVEL[i.nivel_alerta], fillOpacity: .12, weight: 1.5 }}
            />
            <Marker position={[Number(i.lat), Number(i.lng)]} icon={iconoIncidente(i.nivel_alerta)}>
              <Popup>
                <strong style={{ fontSize: 14 }}>{i.titulo}</strong>
                <div className="dato" style={{ marginTop: 4 }}>{i.codigo}</div>
                <div style={{ fontSize: 12, marginTop: 6 }}>
                  Tipo: {String(i.tipo || '').replace(/_/g, ' ')}<br />
                  Nivel: <b style={{ color: COLOR_NIVEL[i.nivel_alerta] }}>{String(i.nivel_alerta).toUpperCase()}</b><br />
                  {i.direccion || 'Sin referencia registrada'}
                </div>
                <div className="coord" style={{ marginTop: 6 }}>
                  {Number(i.lat).toFixed(6)}, {Number(i.lng).toFixed(6)}
                </div>
                {alCompartirWhatsapp && (
                  <button
                    className="btn btn-whatsapp btn-menudo"
                    style={{ marginTop: 9 }}
                    onClick={() => alCompartirWhatsapp({
                      lat: i.lat, lng: i.lng, titulo: i.titulo,
                      referencia: i.direccion, nivel: i.nivel_alerta, incidente_id: i.id
                    })}
                  >Compartir por WhatsApp</button>
                )}
              </Popup>
            </Marker>
          </div>
        ))}

        {/* Personal en campo */}
        {posiciones.filter(p => p.lat && p.lng).map(p => (
          <Marker
            key={`pos-${p.usuario_id}`}
            position={[Number(p.lat), Number(p.lng)]}
            icon={iconoPersonal(p.estado, p.rol)}
          >
            <Popup>
              <strong style={{ fontSize: 14 }}>{p.nombres} {p.apellidos}</strong>
              <div style={{ fontSize: 12, marginTop: 3, textTransform: 'uppercase', letterSpacing: '.08em' }}>{p.rol}</div>
              <div style={{ fontSize: 12, marginTop: 6 }}>
                Estado: <b style={{ color: COLOR_ESTADO[p.estado] }}>{String(p.estado).replace(/_/g, ' ')}</b>
                {p.nota && <><br />Nota: {p.nota}</>}
              </div>
              <div className="coord" style={{ marginTop: 6 }}>
                {Number(p.lat).toFixed(6)}, {Number(p.lng).toFixed(6)}
              </div>
              <div style={{ fontSize: 11, color: '#44586A', marginTop: 3 }}>
                Último reporte: {new Date(p.reportado_en).toLocaleString('es-PE')}
              </div>
              {alCompartirWhatsapp && (
                <button
                  className="btn btn-whatsapp btn-menudo"
                  style={{ marginTop: 9 }}
                  onClick={() => alCompartirWhatsapp({
                    lat: p.lat, lng: p.lng,
                    titulo: `Posición de ${p.nombres} ${p.apellidos}`,
                    referencia: p.nota, incidente_id: p.incidente_id
                  })}
                >Compartir por WhatsApp</button>
              )}
            </Popup>
          </Marker>
        ))}

        {/* Unidades con posición conocida */}
        {unidades.filter(u => u.lat && u.lng).map(u => (
          <Marker key={`uni-${u.id}`} position={[Number(u.lat), Number(u.lng)]} icon={iconoUnidad(u.estado)}>
            <Popup>
              <strong>{u.codigo}</strong>
              <div style={{ fontSize: 12, marginTop: 4 }}>
                {String(u.tipo || '').replace(/_/g, ' ')}<br />
                Estado: {String(u.estado).replace(/_/g, ' ')}
              </div>
            </Popup>
          </Marker>
        ))}

        {/* Punto que el operador acaba de marcar */}
        {puntoSeleccionado && (
          <Marker position={[puntoSeleccionado.lat, puntoSeleccionado.lng]} icon={iconoIncidente('naranja')}>
            <Popup>
              <strong>Punto seleccionado</strong>
              <div className="coord" style={{ marginTop: 5 }}>
                {Number(puntoSeleccionado.lat).toFixed(6)}, {Number(puntoSeleccionado.lng).toFixed(6)}
              </div>
            </Popup>
          </Marker>
        )}
      </MapContainer>

      {mostrarLeyenda && (
        <div className="leyenda-mapa">
          <div className="rotulo">Leyenda</div>
          {[
            ['#17825A', 'Disponible'],
            ['#A66A05', 'En escena'],
            ['#0E7C8C', 'En movimiento'],
            ['#B32424', 'Emergencia']
          ].map(([color, texto]) => (
            <div className="leyenda-fila" key={texto}>
              <span className="leyenda-punto" style={{ background: color }} />{texto}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
