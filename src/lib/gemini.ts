import { LocationResult, OsmAmenity, RoastResult } from "../types";

export async function generateRoast(
  location: LocationResult,
  amenities: OsmAmenity[],
  onProgress?: (status: string) => void
): Promise<RoastResult> {
  // 1. Submit job to queue
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

  const { jobId } = await response.json();
  if (!jobId) {
    throw new Error("Failed to get jobId from server");
  }

  // 2. Poll for job completion
  while (true) {
    await new Promise((resolve) => setTimeout(resolve, 3000)); // Wait 3 seconds
    
    const statusRes = await fetch(`/api/roast/status?jobId=${jobId}`);
    if (!statusRes.ok) {
      const errorData = await statusRes.json().catch(() => ({}));
      throw new Error(errorData.error || "Failed to check job status");
    }

    const statusData = await statusRes.json();
    
    if (onProgress) {
      onProgress(statusData.status);
    }
    
    if (statusData.status === "completed") {
      return statusData.result as RoastResult;
    } else if (statusData.status === "error") {
      throw new Error(statusData.error || "Roasting failed during execution");
    }
    
    // If pending or processing, loop again
  }
}
