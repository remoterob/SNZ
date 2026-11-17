// Interactive NZ club map for Grassroots Spearo. Leaflet + OSM tiles (no API
// key) with marker clustering; clubs with an episode get a blue "play" pin.
import { useEffect, useMemo } from 'react'
import { MapContainer, TileLayer, Marker, Tooltip, useMap } from 'react-leaflet'
import MarkerClusterGroup from 'react-leaflet-cluster'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { OSM_TILES, NZ_CENTER } from '../lib/grassroots'

const SNZ_BLUE = '#2B6CB0'

function pinIcon({ hasEpisode, selected }) {
  const fill = hasEpisode ? SNZ_BLUE : '#64748b'
  const size = selected ? 40 : 32
  const inner = hasEpisode
    ? '<path d="M13 10.5v9l7.5-4.5z" fill="#fff"/>'
    : '<circle cx="16" cy="15" r="4.5" fill="#fff"/>'
  return L.divIcon({
    className: '',
    iconSize: [size, size],
    iconAnchor: [size / 2, size],
    tooltipAnchor: [0, -size + 6],
    html: `<svg width="${size}" height="${size}" viewBox="0 0 32 32" style="filter:drop-shadow(0 2px 3px rgba(0,0,0,.35))">
      <path d="M16 31s11-10.2 11-17A11 11 0 0 0 5 14c0 6.8 11 17 11 17z" fill="${fill}" stroke="#fff" stroke-width="${selected ? 2.5 : 1.5}"/>
      ${inner}</svg>`,
  })
}

function FlyTo({ club }) {
  const map = useMap()
  useEffect(() => {
    if (club?.latitude != null && club?.longitude != null) {
      map.flyTo([club.latitude, club.longitude], Math.max(map.getZoom(), 10), { duration: 0.8 })
    }
  }, [club?.id]) // eslint-disable-line react-hooks/exhaustive-deps
  return null
}

export default function GrassrootsMap({ clubs, episodeClubIds, selectedId, onSelect, className = '' }) {
  const placed = useMemo(
    () => clubs.filter(c => c.latitude != null && c.longitude != null),
    [clubs]
  )
  const selected = placed.find(c => c.id === selectedId)

  return (
    <MapContainer
      center={NZ_CENTER}
      zoom={5}
      minZoom={4}
      scrollWheelZoom={false}
      className={className}
      style={{ zIndex: 0 }}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url={OSM_TILES} referrerPolicy="strict-origin-when-cross-origin"
      />
      <MarkerClusterGroup chunkedLoading showCoverageOnHover={false} maxClusterRadius={45}>
        {placed.map(c => (
          <Marker
            key={c.id}
            position={[c.latitude, c.longitude]}
            icon={pinIcon({ hasEpisode: episodeClubIds.has(c.id), selected: c.id === selectedId })}
            eventHandlers={{ click: () => onSelect(c.id) }}
          >
            <Tooltip direction="top">{c.name}</Tooltip>
          </Marker>
        ))}
      </MarkerClusterGroup>
      <FlyTo club={selected} />
    </MapContainer>
  )
}
