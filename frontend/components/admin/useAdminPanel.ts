"use client";

import { useCallback, useEffect, useState } from "react";
import { clearStoredAccessToken, getStoredAccessToken, me } from "@/lib/auth";
import {
  fetchAdminSettings,
  fetchAdminTags,
  fetchAdminUsers,
  type AdminSettings,
  type AdminTag,
  type AdminUser,
} from "@/lib/adminPanel";

export type AdminPanelData = {
  users: AdminUser[];
  tags: AdminTag[];
  settings: AdminSettings;
};

type AdminPanelState = {
  data: AdminPanelData | null;
  error: string | null;
  loadingData: boolean;
};

const DEFAULT_SETTINGS: AdminSettings = {
  availabilityRefreshMinutes: 15,
  defaultCasePriority: "Medium",
  priorityStyleMap: {
    High: { label: "High", color: "#B91C1C", background: "#FEF2F2" },
    Medium: { label: "Medium", color: "#B45309", background: "#FFFBEB" },
    Low: { label: "Low", color: "#1D4ED8", background: "#EFF6FF" },
  },
};

async function loadAdminPanel(accessToken: string): Promise<AdminPanelData> {
  const [users, tags, settings, currentUser] = await Promise.all([
    fetchAdminUsers(accessToken),
    fetchAdminTags(accessToken),
    fetchAdminSettings(accessToken),
    me(accessToken),
  ]);

  if (currentUser.role !== "Admin") {
    throw new Error("Admin access is required to view this page.");
  }

  return { users, tags, settings };
}

export function useAdminPanel() {
  const [state, setState] = useState<AdminPanelState>({
    data: null,
    error: null,
    loadingData: true,
  });

  const refresh = useCallback(async () => {
    const accessToken = getStoredAccessToken();
    if (!accessToken) {
      clearStoredAccessToken();
      setState({
        data: null,
        error: "Missing access token. Please sign in again.",
        loadingData: false,
      });
      return;
    }

    setState((current) => ({ ...current, loadingData: true, error: null }));
    try {
      const data = await loadAdminPanel(accessToken);
      setState({
        data,
        error: null,
        loadingData: false,
      });
    } catch (error) {
      setState({
        data: null,
        error: error instanceof Error ? error.message : "Failed to load admin data.",
        loadingData: false,
      });
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return {
    data: state.data,
    error: state.error,
    loadingData: state.loadingData,
    refresh,
    defaultSettings: DEFAULT_SETTINGS,
  };
}
