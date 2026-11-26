/**
 * NEXUS RELAY — MathVector (Blueprint §2 Phase 2 telemetry axes).
 * Haversine great-circle distance + 8-wind compass bearing + era delta.
 */
import type { TelemetryRecord } from "@nexus-relay/shared-types";

const R_EARTH_KM = 6371;

export function haversineKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R_EARTH_KM * Math.asin(Math.sqrt(a));
}

/** Initial great-circle bearing from point 1 to point 2, degrees 0-360. */
export function bearingDeg(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const y = Math.sin(toRad(lon2 - lon1)) * Math.cos(toRad(lat2));
  const x =
    Math.cos(toRad(lat1)) * Math.sin(toRad(lat2)) -
    Math.sin(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.cos(toRad(lon2 - lon1));
  const deg = (Math.atan2(y, x) * 180) / Math.PI;
  return (deg + 360) % 360;
}

const WINDS = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"] as const;

export function compass8(bearing: number): string {
  return WINDS[Math.round(bearing / 45) % 8];
}

/** Signed era delta: guess year minus target year (Blueprint §2). */
export function eraDelta(guessYear: number, targetYear: number): number {
  return guessYear - targetYear;
}

export function formatYear(year: number): string {
  if (year < 0) return `${Math.abs(year).toLocaleString("en-US")} BCE`;
  return `${year}`;
}

/** Blueprint display format: "+42 yrs", "-118 yrs", "EXACT YEAR LOCK". */
export function formatDelta(delta: number): string {
  if (delta === 0) return "EXACT YEAR LOCK";
  const sign = delta > 0 ? "+" : "-";
  return `${sign}${Math.abs(delta).toLocaleString("en-US")} yrs`;
}

export interface SpatialResult {
  km: number;
  bearing: string | null;
  label: string;
}

/**
 * Spatial axis result between a guess record and the target record.
 * Returns null when either side is CONCEPTUAL / NON-SPATIAL.
 */
export function spatialVector(
  guess: TelemetryRecord,
  target: TelemetryRecord
): SpatialResult | null {
  if (guess.lat == null || guess.lon == null || target.lat == null || target.lon == null)
    return null;
  const km = haversineKm(guess.lat, guess.lon, target.lat, target.lon);
  if (km < 1) return { km: 0, bearing: null, label: "EXACT REGION LOCK" };
  const brg = bearingDeg(guess.lat, guess.lon, target.lat, target.lon);
  const rounded = Math.round(km);
  return {
    km: rounded,
    bearing: compass8(brg),
    label: `${rounded.toLocaleString("en-US")} km ${compass8(brg)}`,
  };
}
