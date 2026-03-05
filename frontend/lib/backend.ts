const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

type HealthResponse = {
  status: string;
  service: string;
  timestamp: string;
};

export async function getBackendHealth(): Promise<HealthResponse> {
  const response = await fetch(`${API_BASE_URL}/health`, { cache: "no-store" });

  if (!response.ok) {
    throw new Error(`Health check failed with status ${response.status}`);
  }

  return response.json() as Promise<HealthResponse>;
}

