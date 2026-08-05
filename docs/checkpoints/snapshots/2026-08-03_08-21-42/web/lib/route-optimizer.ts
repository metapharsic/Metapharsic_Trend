import { haversineDistanceKm } from "./gps";

export interface RouteStop {
  id: string;
  name: string;
  type: "DOCTOR" | "CHEMIST";
  latitude: number;
  longitude: number;
}

export interface OptimizedStop extends RouteStop {
  sequence: number;
  legDistanceKm: number;
}

export interface OptimizedRoute {
  stops: OptimizedStop[];
  totalDistanceKm: number;
}

/**
 * Nearest-neighbour heuristic over the day's planned stops.
 *
 * Deliberately not an exact TSP solver: for the 8-15 stops a single MR covers in a day
 * the greedy tour is typically within ~10-25% of optimal, runs in microseconds, and adds
 * no dependency. Swap in OR-Tools here if route quality ever needs to be guaranteed.
 */
export function optimizeRoute(
  stops: RouteStop[],
  start: { latitude: number; longitude: number }
): OptimizedRoute {
  const remaining = [...stops];
  const ordered: OptimizedStop[] = [];
  let current = start;
  let totalDistanceKm = 0;

  while (remaining.length > 0) {
    let nearestIndex = 0;
    let nearestDistance = Infinity;

    for (let i = 0; i < remaining.length; i++) {
      const distance = haversineDistanceKm(
        current.latitude,
        current.longitude,
        remaining[i].latitude,
        remaining[i].longitude
      );
      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearestIndex = i;
      }
    }

    const [next] = remaining.splice(nearestIndex, 1);
    totalDistanceKm += nearestDistance;
    ordered.push({
      ...next,
      sequence: ordered.length + 1,
      legDistanceKm: Math.round(nearestDistance * 100) / 100,
    });
    current = next;
  }

  return { stops: ordered, totalDistanceKm: Math.round(totalDistanceKm * 100) / 100 };
}
