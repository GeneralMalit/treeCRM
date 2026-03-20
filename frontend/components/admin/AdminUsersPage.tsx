"use client";

import { FormEvent, useMemo, useState } from "react";
import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
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
import { ShellEmptyState } from "@/components/shell/ShellEmptyState";
import { ShellPageHeader } from "@/components/shell/ShellPageHeader";
import { ShellSection } from "@/components/shell/ShellSection";
import { ShellStatStrip } from "@/components/shell/ShellStatStrip";
import {
  createAdminUser,
  deleteAdminUser,
  updateAdminUser,
} from "@/lib/adminPanel";
import { useAdminPanel } from "@/components/admin/useAdminPanel";
import type { AdminUser } from "@/lib/adminPanel";
import { getStoredAccessToken } from "@/lib/auth";
import { ROLES, type Role } from "@/lib/roles";

type UserFormState = {
  name: string;
  email: string;
  password: string;
  role: Role;
  managerId: string;
};

const DEFAULT_USER_FORM: UserFormState = {
  name: "",
  email: "",
  password: "",
  role: "Manager",
  managerId: "",
};

const FILTER_OPTIONS: Array<"All" | Role> = ["All", ...ROLES];

function getUserDisplayName(user: AdminUser): string {
  return user.name?.trim() || user.email;
}

function buildUserFormState(user: AdminUser): UserFormState {
  return {
    name: user.name ?? "",
    email: user.email,
    password: "",
    role: user.role,
    managerId: user.managerId ?? "",
  };
}

export function AdminUsersPage() {
  const router = useRouter();
  const { data, error, loadingData, refresh } = useAdminPanel();
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<(typeof FILTER_OPTIONS)[number]>("All");
  const [createOpen, setCreateOpen] = useState(false);
  const [editUser, setEditUser] = useState<AdminUser | null>(null);
  const [formState, setFormState] = useState<UserFormState>(DEFAULT_USER_FORM);
  const [saving, setSaving] = useState(false);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  const users = useMemo(() => data?.users ?? [], [data?.users]);
  const managers = useMemo(() => users.filter((user) => user.role === "Manager"), [users]);
  const managerNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const manager of managers) {
      map.set(manager.id, getUserDisplayName(manager));
    }
    return map;
  }, [managers]);

  const filteredUsers = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    return users.filter((user) => {
      const matchesRole = roleFilter === "All" ? true : user.role === roleFilter;
      const matchesSearch =
        normalizedSearch.length === 0 ||
        getUserDisplayName(user).toLowerCase().includes(normalizedSearch) ||
        user.email.toLowerCase().includes(normalizedSearch);

      return matchesRole && matchesSearch;
    });
  }, [roleFilter, search, users]);

  const stats = data
    ? [
        { label: "Total users", value: String(users.length), detail: "All active accounts" },
        {
          label: "Employees",
          value: String(users.filter((user) => user.role === "CSR" || user.role === "Manager" || user.role === "Executive").length),
          detail: "CSR, manager, and executive roles",
        },
        { label: "Admins", value: String(users.filter((user) => user.role === "Admin").length), detail: "Privileged accounts" },
        { label: "Managers", value: String(managers.length), detail: "Available CSR managers" },
      ]
    : [];

  const accessToken = getStoredAccessToken();

  const openCreateDialog = () => {
    setEditUser(null);
    setFormState(DEFAULT_USER_FORM);
    setActionMessage(null);
    setCreateOpen(true);
  };

  const openEditDialog = (user: AdminUser) => {
    setEditUser(user);
    setFormState(buildUserFormState(user));
    setActionMessage(null);
    setCreateOpen(false);
  };

  const closeDialog = () => {
    setCreateOpen(false);
    setEditUser(null);
    setFormState(DEFAULT_USER_FORM);
    setActionMessage(null);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!accessToken) {
      setActionMessage("Missing access token. Please sign in again.");
      router.replace("/login");
      return;
    }

    if (!formState.email.trim()) {
      setActionMessage("Email is required.");
      return;
    }

    if (!editUser && formState.password.trim().length < 8) {
      setActionMessage("Temporary password must be at least 8 characters.");
      return;
    }

    if (formState.role === "CSR" && !formState.managerId) {
      setActionMessage("CSR users need an assigned manager.");
      return;
    }

    setSaving(true);
    setActionMessage(null);

    try {
      const payload = {
        email: formState.email.trim(),
        name: formState.name.trim() || undefined,
        role: formState.role,
        managerId: formState.role === "CSR" ? formState.managerId : null,
      };

      if (editUser) {
        await updateAdminUser(accessToken, editUser.id, payload);
      } else {
        await createAdminUser(accessToken, {
          ...payload,
          password: formState.password,
        });
      }

      await refresh();
      closeDialog();
    } catch (error) {
      setActionMessage(error instanceof Error ? error.message : "Failed to save user.");
    } finally {
      setSaving(false);
    }
  };

  const handlePromote = async (user: AdminUser) => {
    if (!accessToken) {
      setActionMessage("Missing access token. Please sign in again.");
      router.replace("/login");
      return;
    }

    setSaving(true);
    setActionMessage(null);
    try {
      await updateAdminUser(accessToken, user.id, {
        role: "Admin",
        managerId: null,
      });
      await refresh();
    } catch (error) {
      setActionMessage(error instanceof Error ? error.message : "Failed to promote user.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (user: AdminUser) => {
    if (!accessToken) {
      setActionMessage("Missing access token. Please sign in again.");
      router.replace("/login");
      return;
    }

    if (!window.confirm(`Delete ${getUserDisplayName(user)}?`)) {
      return;
    }

    setSaving(true);
    setActionMessage(null);
    try {
      await deleteAdminUser(accessToken, user.id);
      await refresh();
    } catch (error) {
      setActionMessage(error instanceof Error ? error.message : "Failed to delete user.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Stack spacing={3}>
      <ShellPageHeader
        title="Users"
        description="Manage employee and admin accounts from one compact table."
        actions={
          <>
            <Button variant="outlined" onClick={() => void refresh()} disabled={loadingData || saving}>
              {loadingData ? "Refreshing" : "Refresh"}
            </Button>
            <Button variant="contained" onClick={openCreateDialog} disabled={loadingData || saving}>
              Create user
            </Button>
          </>
        }
      />

      {error ? <Alert severity="error">{error}</Alert> : null}
      {actionMessage ? <Alert severity="error">{actionMessage}</Alert> : null}

      {data ? <ShellStatStrip items={stats} /> : null}

      <ShellSection>
        <Stack spacing={2}>
          <Stack direction={{ xs: "column", md: "row" }} spacing={1.5}>
            <TextField
              label="Search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Name or email"
            />
            <FormControl sx={{ minWidth: 180 }}>
              <InputLabel id="user-role-filter-label">Role</InputLabel>
              <Select
                labelId="user-role-filter-label"
                label="Role"
                value={roleFilter}
                onChange={(event) => setRoleFilter(event.target.value as (typeof FILTER_OPTIONS)[number])}
              >
                {FILTER_OPTIONS.map((role) => (
                  <MenuItem key={role} value={role}>
                    {role}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Stack>

          {filteredUsers.length === 0 ? (
            <ShellEmptyState
              title="No users found"
              description="Try a different search or role filter."
              actionLabel="Create user"
              onAction={openCreateDialog}
            />
          ) : (
            <TableContainer component={Paper} variant="outlined" sx={{ boxShadow: "none" }}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Name</TableCell>
                    <TableCell>Email</TableCell>
                    <TableCell>Role</TableCell>
                    <TableCell>Manager</TableCell>
                    <TableCell align="right">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {filteredUsers.map((user) => (
                    <TableRow key={user.id} hover>
                      <TableCell>
                        <Stack spacing={0.25}>
                          <Typography variant="body2" fontWeight={600}>
                            {getUserDisplayName(user)}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {user.id}
                          </Typography>
                        </Stack>
                      </TableCell>
                      <TableCell>{user.email}</TableCell>
                      <TableCell>{user.role}</TableCell>
                      <TableCell>{user.managerId ? managerNameById.get(user.managerId) ?? user.managerId : "None"}</TableCell>
                      <TableCell align="right">
                        <Stack direction="row" spacing={1} justifyContent="flex-end" flexWrap="wrap">
                          <Button size="small" variant="outlined" onClick={() => openEditDialog(user)} disabled={saving}>
                            Edit
                          </Button>
                          {user.role !== "Admin" ? (
                            <Button size="small" variant="outlined" onClick={() => void handlePromote(user)} disabled={saving}>
                              Promote
                            </Button>
                          ) : null}
                          <Button size="small" color="error" variant="outlined" onClick={() => void handleDelete(user)} disabled={saving}>
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

      <Dialog open={createOpen || editUser !== null} onClose={closeDialog} fullWidth maxWidth="sm">
        <DialogTitle>{editUser ? "Edit user" : "Create user"}</DialogTitle>
        <DialogContent dividers>
          <Stack component="form" spacing={2} id="admin-user-form" onSubmit={handleSubmit} sx={{ pt: 0.5 }}>
            <TextField
              label="Name"
              value={formState.name}
              onChange={(event) => setFormState((current) => ({ ...current, name: event.target.value }))}
            />
            <TextField
              label="Email"
              type="email"
              value={formState.email}
              onChange={(event) => setFormState((current) => ({ ...current, email: event.target.value }))}
              required
            />
            {!editUser ? (
              <TextField
                label="Temporary password"
                type="password"
                value={formState.password}
                onChange={(event) => setFormState((current) => ({ ...current, password: event.target.value }))}
                helperText="Use at least 8 characters."
                required
              />
            ) : null}
            <FormControl fullWidth>
              <InputLabel id="user-role-label">Role</InputLabel>
              <Select
                labelId="user-role-label"
                label="Role"
                value={formState.role}
                onChange={(event) =>
                  setFormState((current) => {
                    const nextRole = event.target.value as Role;
                    return {
                      ...current,
                      role: nextRole,
                      managerId: nextRole === "CSR" ? current.managerId : "",
                    };
                  })
                }
              >
                {ROLES.map((role) => (
                  <MenuItem key={role} value={role}>
                    {role}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            {formState.role === "CSR" ? (
              <FormControl fullWidth>
                <InputLabel id="user-manager-label">Manager</InputLabel>
                <Select
                  labelId="user-manager-label"
                  label="Manager"
                  value={formState.managerId}
                  onChange={(event) =>
                    setFormState((current) => ({ ...current, managerId: String(event.target.value) }))
                  }
                >
                  {managers.map((manager) => (
                    <MenuItem key={manager.id} value={manager.id}>
                      {getUserDisplayName(manager)}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            ) : null}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={closeDialog}>Cancel</Button>
          <Button
            type="submit"
            form="admin-user-form"
            variant="contained"
            disabled={
              saving ||
              !formState.email.trim() ||
              (!editUser && formState.password.trim().length < 8) ||
              (formState.role === "CSR" && !formState.managerId)
            }
          >
            {saving ? "Saving..." : editUser ? "Save user" : "Create user"}
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}
