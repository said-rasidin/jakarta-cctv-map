"use client";

import { useState } from "react";

export type UserLocation = { lat: number; lng: number };

export function useGeolocation() {
  const [userLocation, setUserLocation] = useState<UserLocation | null>(null);
  const [locationError, setLocationError] = useState("");

  const locate = () => {
    setLocationError("");
    if (!navigator.geolocation) {
      setLocationError("Browser ini tidak mendukung geolokasi.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => setUserLocation({ lat: position.coords.latitude, lng: position.coords.longitude }),
      () => setLocationError("Lokasi tidak dapat diakses. Izinkan lokasi untuk memakai fitur ini."),
      { enableHighAccuracy: true, timeout: 10000 },
    );
  };

  return { userLocation, locationError, locate };
}
