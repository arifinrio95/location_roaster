import { LocationResult, OsmAmenity, RoastResult } from "../types";

export async function generateRoast(
  location: LocationResult,
  amenities: OsmAmenity[]
): Promise<RoastResult> {
  const response = await fetch("/api/roast", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ location, amenities })
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
  }

  return response.json() as Promise<RoastResult>;
}
