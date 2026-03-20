"use client";

import { FormEvent, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  Paper,
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
import { ShellEmptyState } from "@/components/shell/ShellEmptyState";
import { ShellPageHeader } from "@/components/shell/ShellPageHeader";
import { ShellSection } from "@/components/shell/ShellSection";
import { ShellStatStrip } from "@/components/shell/ShellStatStrip";
import {
  createAdminTag,
  deleteAdminTag,
  updateAdminTag,
} from "@/lib/adminPanel";
import { useAdminPanel } from "@/components/admin/useAdminPanel";
import type { AdminTag } from "@/lib/adminPanel";
import { getStoredAccessToken } from "@/lib/auth";
import { TAG_COLOR_PRESETS } from "@/lib/tagColors";

type TagFormState = {
  name: string;
  color: string;
  affectsNodeColor: boolean;
};

const DEFAULT_TAG_FORM: TagFormState = {
  name: "",
  color: TAG_COLOR_PRESETS[0],
  affectsNodeColor: true,
};

function buildTagFormState(tag: AdminTag | null): TagFormState {
  if (!tag) {
    return DEFAULT_TAG_FORM;
  }

  return {
    name: tag.name,
    color: tag.color,
    affectsNodeColor: tag.affectsNodeColor,
  };
}

function TagColorPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (nextValue: string) => void;
}) {
  return (
    <Stack spacing={1}>
      <Typography variant="body2" fontWeight={600}>
        Color
      </Typography>
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: "repeat(8, minmax(0, 1fr))",
          gap: 0.75,
        }}
      >
        {TAG_COLOR_PRESETS.map((color) => {
          const selected = value === color;
          return (
            <Button
              key={color}
              type="button"
              onClick={() => onChange(color)}
              sx={{
                minWidth: 0,
                height: 34,
                borderRadius: 1,
                p: 0,
                border: selected ? "2px solid #0f172a" : "1px solid rgba(148,163,184,0.4)",
                backgroundColor: color,
                "&:hover": {
                  backgroundColor: color,
                },
              }}
              aria-label={color}
            />
          );
        })}
      </Box>
      <Typography variant="caption" color="text.secondary">
        Selected: {value}
      </Typography>
    </Stack>
  );
}

export function AdminTagsPage() {
  const router = useRouter();
  const { data, error, loadingData, refresh } = useAdminPanel();
  const [tagForm, setTagForm] = useState<TagFormState>(DEFAULT_TAG_FORM);
  const [editingTag, setEditingTag] = useState<AdminTag | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  const tags = data?.tags ?? [];
  const accessToken = getStoredAccessToken();

  const stats = data
    ? [
        { label: "Tags", value: String(tags.length), detail: "All reusable labels" },
        {
          label: "Node colors",
          value: String(tags.filter((tag) => tag.affectsNodeColor).length),
          detail: "Tags that affect the tree",
        },
        {
          label: "Metadata only",
          value: String(tags.filter((tag) => !tag.affectsNodeColor).length),
          detail: "Tags used for filtering and notes",
        },
        {
          label: "Presets",
          value: String(TAG_COLOR_PRESETS.length),
          detail: "Available color swatches",
        },
      ]
    : [];

  const openCreateDialog = () => {
    setEditingTag(null);
    setTagForm(DEFAULT_TAG_FORM);
    setActionMessage(null);
    setDialogOpen(true);
  };

  const openEditDialog = (tag: AdminTag) => {
    setEditingTag(tag);
    setTagForm(buildTagFormState(tag));
    setActionMessage(null);
    setDialogOpen(true);
  };

  const closeDialog = () => {
    setDialogOpen(false);
    setEditingTag(null);
    setTagForm(DEFAULT_TAG_FORM);
    setActionMessage(null);
  };

  const handleSave = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!accessToken) {
      setActionMessage("Missing access token. Please sign in again.");
      router.replace("/login");
      return;
    }

    if (!tagForm.name.trim()) {
      setActionMessage("Tag name is required.");
      return;
    }

    setSaving(true);
    setActionMessage(null);
    try {
      const payload = {
        name: tagForm.name.trim(),
        color: tagForm.color,
        affectsNodeColor: tagForm.affectsNodeColor,
      };

      if (editingTag) {
        await updateAdminTag(accessToken, editingTag.id, payload);
      } else {
        await createAdminTag(accessToken, payload);
      }

      await refresh();
      closeDialog();
    } catch (error) {
      setActionMessage(error instanceof Error ? error.message : "Failed to save tag.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (tag: AdminTag) => {
    if (!accessToken) {
      setActionMessage("Missing access token. Please sign in again.");
      router.replace("/login");
      return;
    }

    if (!window.confirm(`Delete tag ${tag.name}?`)) {
      return;
    }

    setSaving(true);
    setActionMessage(null);
    try {
      await deleteAdminTag(accessToken, tag.id);
      await refresh();
    } catch (error) {
      setActionMessage(error instanceof Error ? error.message : "Failed to delete tag.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Stack spacing={3}>
      <ShellPageHeader
        title="Tags"
        description="Choose preset swatches and keep node-color behavior explicit."
        actions={
          <>
            <Button variant="outlined" onClick={() => void refresh()} disabled={loadingData || saving}>
              {loadingData ? "Refreshing" : "Refresh"}
            </Button>
            <Button variant="contained" onClick={openCreateDialog} disabled={loadingData || saving}>
              Create tag
            </Button>
          </>
        }
      />

      {error ? <Alert severity="error">{error}</Alert> : null}
      {actionMessage ? <Alert severity="error">{actionMessage}</Alert> : null}

      {data ? <ShellStatStrip items={stats} /> : null}

      <ShellSection>
        <Stack spacing={2}>
          {tags.length === 0 ? (
            <ShellEmptyState
              title="No tags yet"
              description="Create the first tag to start organizing cases."
              actionLabel="Create tag"
              onAction={openCreateDialog}
            />
          ) : (
            <TableContainer component={Paper} variant="outlined" sx={{ boxShadow: "none" }}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Name</TableCell>
                    <TableCell>Color</TableCell>
                    <TableCell>Applies to</TableCell>
                    <TableCell align="right">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {tags.map((tag) => (
                    <TableRow key={tag.id} hover>
                      <TableCell>
                        <Stack spacing={0.25}>
                          <Typography variant="body2" fontWeight={600}>
                            {tag.name}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {tag.id}
                          </Typography>
                        </Stack>
                      </TableCell>
                      <TableCell>
                        <Stack direction="row" spacing={1} alignItems="center">
                          <Box
                            sx={{
                              width: 18,
                              height: 18,
                              borderRadius: 0.75,
                              border: "1px solid rgba(15,23,42,0.16)",
                              backgroundColor: tag.color,
                            }}
                          />
                          <Typography variant="body2">{tag.color}</Typography>
                        </Stack>
                      </TableCell>
                      <TableCell>{tag.affectsNodeColor ? "Node color" : "Metadata only"}</TableCell>
                      <TableCell align="right">
                        <Stack direction="row" spacing={1} justifyContent="flex-end">
                          <Button size="small" variant="outlined" onClick={() => openEditDialog(tag)} disabled={saving}>
                            Edit
                          </Button>
                          <Button size="small" variant="outlined" color="error" onClick={() => void handleDelete(tag)} disabled={saving}>
                            Delete
                          </Button>
                        </Stack>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </Stack>
      </ShellSection>

      <Dialog open={dialogOpen} onClose={closeDialog} fullWidth maxWidth="sm">
        <DialogTitle>{editingTag ? "Edit tag" : "Create tag"}</DialogTitle>
        <DialogContent dividers>
          <Stack component="form" id="admin-tag-form" spacing={2} onSubmit={handleSave} sx={{ pt: 0.5 }}>
            <TextField
              label="Name"
              value={tagForm.name}
              onChange={(event) => setTagForm((current) => ({ ...current, name: event.target.value }))}
              required
            />
            <TagColorPicker
              value={tagForm.color}
              onChange={(nextValue) => setTagForm((current) => ({ ...current, color: nextValue }))}
            />
            <FormControlLabel
              control={
                <Checkbox
                  checked={tagForm.affectsNodeColor}
                  onChange={(event) =>
                    setTagForm((current) => ({ ...current, affectsNodeColor: event.target.checked }))
                  }
                />
              }
              label="Affects node color"
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={closeDialog}>Cancel</Button>
          <Button type="submit" form="admin-tag-form" variant="contained" disabled={saving || !tagForm.name.trim()}>
            {saving ? "Saving..." : editingTag ? "Save tag" : "Create tag"}
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}
