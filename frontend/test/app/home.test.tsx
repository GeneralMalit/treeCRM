import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import HomePage from "@/app/page";

vi.mock("@/lib/backend", () => ({
  getBackendHealth: vi.fn(),
}));

describe("HomePage", () => {
  it("renders health success and failure states", async () => {
    const { getBackendHealth } = await import("@/lib/backend");
    vi.mocked(getBackendHealth)
      .mockResolvedValueOnce({
        status: "ok",
        service: "treecrm-backend",
        timestamp: "2026-03-08T00:00:00.000Z",
      })
      .mockRejectedValueOnce(new Error("Backend down"));

    render(<HomePage />);
    await waitFor(() => {
      expect(screen.getByText(/Backend healthy at/)).toBeInTheDocument();
    });

    cleanup();
    render(<HomePage />);
    await waitFor(() => {
      expect(screen.getByText("Backend down")).toBeInTheDocument();
    });
  });
});
