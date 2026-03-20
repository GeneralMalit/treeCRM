"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  FormControl,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from "@mui/material";
import { useRouter } from "next/navigation";
import { ShellPageHeader } from "@/components/shell/ShellPageHeader";
import { ShellSection } from "@/components/shell/ShellSection";
import { ShellStatStrip } from "@/components/shell/ShellStatStrip";
import { type AdminSettings, type PriorityStyleValue, updateAdminSettings } from "@/lib/adminPanel";
import { useAdminPanel } from "@/components/admin/useAdminPanel";
import { getStoredAccessToken } from "@/lib/auth";
import type { CasePriority } from "@/lib/customerPortal";

type PriorityKey = CasePriority;

const PRIORITIES: PriorityKey[] = ["High", "Medium", "Low"];

function cloneSettings(settings: AdminSettings): AdminSettings {
  return {
    availabilityRefreshMinutes: settings.availabilityRefreshMinutes,
    defaultCasePriority: settings.defaultCasePriority,
    priorityStyleMap: {
      High: { ...settings.priorityStyleMap.High },
      Medium: { ...settings.priorityStyleMap.Medium },
      Low: { ...settings.priorityStyleMap.Low },
    },
  };
}

export function AdminSettingsPage() {
  const router = useRouter();
  const { data, error, loadingData, refresh, defaultSettings } = useAdminPanel();
  const [settingsForm, setSettingsForm] = useState<AdminSettings>(defaultSettings);
  const [saving, setSaving] = useState(false);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  const accessToken = getStoredAccessToken();

  useEffect(() => {
    if (data?.settings) {
      setSettingsForm(cloneSettings(data.settings));
    }
  }, [data?.settings]);

  const stats = useMemo(
    () => [
      {
        label: "Availability refresh",
        value: `${settingsForm.availabilityRefreshMinutes} min`,
        detail: "Presence checks",
      },
      {
        label: "Default priority",
        value: settingsForm.defaultCasePriority,
        detail: "New case default",
      },
      {
        label: "Priority styles",
        value: String(PRIORITIES.length),
        detail: "High, medium, and low",
      },
      {
        label: "Live settings",
        value: data ? "Loaded" : "Pending",
        detail: "Current backend values",
      },
    ],
    [data, settingsForm.availabilityRefreshMinutes, settingsForm.defaultCasePriority],
  );

  const updatePriorityStyle = (priority: PriorityKey, field: keyof PriorityStyleValue, value: string) => {
    setSettingsForm((current) => ({
      ...current,
      priorityStyleMap: {
        ...current.priorityStyleMap,
        [priority]: {
          ...current.priorityStyleMap[priority],
          [field]: value,
        },
      },
    }));
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!accessToken) {
      setActionMessage("Missing access token. Please sign in again.");
      router.replace("/login");
      return;
    }

    setSaving(true);
    setActionMessage(null);
    try {
      const nextSettings = await updateAdminSettings(accessToken, settingsForm);
      setSettingsForm(cloneSettings(nextSettings));
      await refresh();
    } catch (error) {
      setActionMessage(error instanceof Error ? error.message : "Failed to save settings.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Stack spacing={3} component="form" onSubmit={handleSubmit}>
      <ShellPageHeader
        title="Settings"
        description="Keep availability timing and case priority styles in one compact place."
        actions={
          <>
            <Button variant="outlined" onClick={() => void refresh()} disabled={loadingData || saving}>
              {loadingData ? "Refreshing" : "Refresh"}
            </Button>
            <Button type="submit" variant="contained" disabled={loadingData || saving}>
              {saving ? "Saving..." : "Save settings"}
            </Button>
          </>
        }
      />

      {error ? <Alert severity="error">{error}</Alert> : null}
      {actionMessage ? <Alert severity="error">{actionMessage}</Alert> : null}

      {data ? <ShellStatStrip items={stats} /> : null}

      <ShellSection>
        <Stack spacing={3}>
          <Stack direction={{ xs: "column", md: "row" }} spacing={1.5}>
            <TextField
              label="Availability refresh (minutes)"
              type="number"
              value={settingsForm.availabilityRefreshMinutes}
              onChange={(event) =>
                setSettingsForm((current) => ({
                  ...current,
                  availabilityRefreshMinutes: Number(event.target.value) || 0,
                }))
              }
              inputProps={{ min: 1 }}
            />
            <FormControl sx={{ minWidth: 220 }}>
              <InputLabel id="default-priority-label">Default case priority</InputLabel>
              <Select
                labelId="default-priority-label"
                label="Default case priority"
                value={settingsForm.defaultCasePriority}
                onChange={(event) =>
                  setSettingsForm((current) => ({
                    ...current,
                    defaultCasePriority: event.target.value as CasePriority,
                  }))
                }
              >
                {PRIORITIES.map((priority) => (
                  <MenuItem key={priority} value={priority}>
                    {priority}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Stack>

          <Box sx={{ display: "grid", gap: 2 }}>
            <TableContainer component={Paper} variant="outlined" sx={{ boxShadow: "none" }}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Priority</TableCell>
                    <TableCell>Label</TableCell>
                    <TableCell>Text color</TableCell>
                    <TableCell>Background</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {PRIORITIES.map((priority) => {
                    const style = settingsForm.priorityStyleMap[priority];
                    return (
                      <TableRow key={priority} hover>
                        <TableCell>
                          <Stack spacing={0.25}>
                            <Typography variant="body2" fontWeight={600}>
                              {priority}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              Style block
                            </Typography>
                          </Stack>
                        </TableCell>
                        <TableCell>
                          <TextField
                            size="small"
                            value={style.label}
                            onChange={(event) => updatePriorityStyle(priority, "label", event.target.value)}
                          />
                        </TableCell>
                        <TableCell>
                          <TextField
                            size="small"
                            value={style.color}
                            onChange={(event) => updatePriorityStyle(priority, "color", event.target.value)}
                            helperText="Hex color"
                          />
                        </TableCell>
                        <TableCell>
                          <TextField
                            size="small"
                            value={style.background}
                            onChange={(event) => updatePriorityStyle(priority, "background", event.target.value)}
                            helperText="Hex color"
                          />
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>
          </Box>
        </Stack>
      </ShellSection>
    </Stack>
  );
}
