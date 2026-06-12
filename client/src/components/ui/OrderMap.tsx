'use client';

import { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Leaflet default marker icon ni to'g'rilash (Next.js da broken)
const fixLeafletIcon = () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  delete (L.Icon.Default.prototype as any)._getIconUrl;
  L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
    iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
  });
};

// Custom colored marker yaratish
const createIcon = (color: string, emoji: string) =>
  L.divIcon({
    html: `<div style="
      background-color: ${color};
      width: 36px; height: 36px;
      border-radius: 50%;
      display: flex; align-items: center; justify-content: center;
      font-size: 18px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.3);
      border: 2px solid white;
    ">${emoji}</div>`,
    className: '',
    iconSize: [36, 36],
    iconAnchor: [18, 18],
    popupAnchor: [0, -20],
  });

// Map ni courier location ga pan qilish
function MapPanner({ lat, lng }: { lat: number; lng: number }) {
  const map = useMap();
  useEffect(() => {
    map.panTo([lat, lng], { animate: true, duration: 0.5 });
  }, [lat, lng, map]);
  return null;
}

interface OrderMapProps {
  restaurant: { lat: number; lng: number; name: string };
  delivery: { lat: number; lng: number; address: string };
  courier?: { lat: number; lng: number } | null;
}

export default function OrderMap({ restaurant, delivery, courier }: OrderMapProps) {
  useEffect(() => {
    fixLeafletIcon();
  }, []);

  // Center on courier if available, otherwise delivery point
  const center: [number, number] = courier
    ? [courier.lat, courier.lng]
    : [delivery.lat, delivery.lng];

  const restaurantIcon = createIcon('#f97316', '🍽️');
  const deliveryIcon = createIcon('#10b981', '📍');
  const courierIcon = createIcon('#8b5cf6', '🛵');

  return (
    <MapContainer
      center={center}
      zoom={15}
      style={{ height: '256px', width: '100%' }}
      className="z-0"
    >
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
      />

      {/* Restaurant marker */}
      <Marker position={[restaurant.lat, restaurant.lng]} icon={restaurantIcon}>
        <Popup>
          <p className="font-medium text-sm">🍽️ {restaurant.name}</p>
        </Popup>
      </Marker>

      {/* Delivery marker */}
      <Marker position={[delivery.lat, delivery.lng]} icon={deliveryIcon}>
        <Popup>
          <p className="font-medium text-sm">📍 Yetkazish manzili</p>
          <p className="text-xs text-gray-500">{delivery.address}</p>
        </Popup>
      </Marker>

      {/* Courier marker (real-time) */}
      {courier && (
        <>
          <Marker position={[courier.lat, courier.lng]} icon={courierIcon}>
            <Popup>
              <p className="font-medium text-sm">🛵 Kuryer yo&apos;lda</p>
            </Popup>
          </Marker>
          <MapPanner lat={courier.lat} lng={courier.lng} />
        </>
      )}
    </MapContainer>
  );
}
