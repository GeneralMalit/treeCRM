"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Chip,
  Container,
  Divider,
  FormControl,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { clearStoredAccessToken, getLandingRoute, getStoredAccessToken, logout, me } from "@/lib/auth";
import { disconnectRealtimeSocket } from "@/lib/realtime";
import {
  createAdminTag,
  createAdminUser,
  deleteAdminTag,
  deleteAdminUser,
  fetchAdminSettings,
  fetchAdminTags,
  fetchAdminUsers,
  updateAdminSettings,
  updateAdminTag,
  updateAdminUser,
  type AdminSettings,
  type AdminTag,
  type AdminUser,
} from "@/lib/adminPanel";
import type { Role } from "@/lib/roles";

type ViewState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | {
      status: "ready";
      data: {
        user: {
          id: string;
          email: string;
          role: "Admin";
          name?: string;
        };
        users: AdminUser[];
        tags: AdminTag[];
        settings: AdminSettings;
      };
    };

type UserDraft = {
  name: string;
  email: string;
  role: Role;
};

type TagDraft = {
  name: string;
  color: string;
  affectsNodeColor: boolean;
};

const USER_ROLES: Role[] = ["CSR", "Manager", "Executive", "Admin", "Customer"];
const CASE_PRIORITIES: Array<"High" | "Medium" | "Low"> = ["High", "Medium", "Low"];

function buildUserDrafts(users: AdminUser[]): Record<string, UserDraft> {
  const drafts: Record<string, UserDraft> = {};
  for (const user of users) {
    drafts[user.id] = {
      name: user.name ?? "",
      email: user.email,
      role: user.role,
    };
  }
  return drafts;
}

function buildTagDrafts(tags: AdminTag[]): Record<string, TagDraft> {
  const drafts: Record<string, TagDraft> = {};
  for (const tag of tags) {
    drafts[tag.id] = {
      name: tag.name,
      color: tag.color,
      affectsNodeColor: tag.affectsNodeColor,
    };
  }
  return drafts;
}

export function AdminWorkspace() {
  const router = useRouter();
  const [state, setState] = useState<ViewState>({ status: "loading" });
  const [loadingData, setLoadingData] = useState(false);

  const [createUserEmail, setCreateUserEmail] = useState("");
  const [createUserPassword, setCreateUserPassword] = useState("");
  const [createUserName, setCreateUserName] = useState("");
  const [createUserRole, setCreateUserRole] = useState<Role>("CSR");
  const [creatingUser, setCreatingUser] = useState(false);

  const [createTagName, setCreateTagName] = useState("");
  const [createTagColor, setCreateTagColor] = useState("#6B7280");
  const [createTagAffectsNodeColor, setCreateTagAffectsNodeColor] = useState(false);
  const [creatingTag, setCreatingTag] = useState(false);

  const [userDrafts, setUserDrafts] = useState<Record<string, UserDraft>>({});
  const [tagDrafts, setTagDrafts] = useState<Record<string, TagDraft>>({});
  const [settingsDraft, setSettingsDraft] = useState<AdminSettings | null>(null);

  const [actionMessage, setActionMessage] = useState<{ type: "success" | "error"; text: string } | null>(
    null,
  );

  const readyData = state.status === "ready" ? state.data : null;

  const loadAdminData = async (accessToken: string) => {
    setLoadingData(true);
    try {
      const [users, tags, settings] = await Promise.all([
        fetchAdminUsers(accessToken),
        fetchAdminTags(accessToken),
        fetchAdminSettings(accessToken),
      ]);

      setState((previous) => {
        if (previous.status !== "ready") {
          return previous;
        }

        return {
          status: "ready",
          data: {
            ...previous.data,
            users,
            tags,
            settings,
          },
        };
      });

      setUserDrafts(buildUserDrafts(users));
      setTagDrafts(buildTagDrafts(tags));
      setSettingsDraft(settings);
    } finally {
      setLoadingData(false);
    }
  };

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      const accessToken = getStoredAccessToken();
      if (!accessToken) {
        router.replace("/login");
        return;
      }

      try {
        const currentUser = await me(accessToken);
        if (cancelled) {
          return;
        }

        if (currentUser.role !== "Admin") {
          router.replace(getLandingRoute(currentUser.role));
          return;
        }

        const [users, tags, settings] = await Promise.all([
          fetchAdminUsers(accessToken),
          fetchAdminTags(accessToken),
          fetchAdminSettings(accessToken),
        ]);

        if (cancelled) {
          return;
        }

        setState({
          status: "ready",
          data: {
            user: {
              id: currentUser.sub,
              email: currentUser.email,
              role: "Admin",
              ...(currentUser.name ? { name: currentUser.name } : {}),
            },
            users,
            tags,
            settings,
          },
        });
        setUserDrafts(buildUserDrafts(users));
        setTagDrafts(buildTagDrafts(tags));
        setSettingsDraft(settings);
      } catch (error) {
        if (cancelled) {
          return;
        }

        setState({
          status: "error",
          message: error instanceof Error ? error.message : "Failed to load admin workspace.",
        });
      }
    };

    run();

    return () => {
      cancelled = true;
    };
  }, [router]);

  const handleLogout = async () => {
    const accessToken = getStoredAccessToken();
    if (accessToken) {
      await logout(accessToken).catch(() => undefined);
    }

    disconnectRealtimeSocket();
    clearStoredAccessToken();
    router.replace("/login");
  };

  const handleRefresh = async () => {
    if (state.status !== "ready") {
      return;
    }

    const accessToken = getStoredAccessToken();
    if (!accessToken) {
      router.replace("/login");
      return;
    }

    setActionMessage(null);
    try {
      await loadAdminData(accessToken);
      setActionMessage({ type: "success", text: "Admin data refreshed." });
    } catch (error) {
      setActionMessage({
        type: "error",
        text: error instanceof Error ? error.message : "Failed to refresh admin data.",
      });
    }
  };

  const handleCreateUser = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (state.status !== "ready") {
      return;
    }

    const accessToken = getStoredAccessToken();
    if (!accessToken) {
      router.replace("/login");
      return;
    }

    setCreatingUser(true);
    setActionMessage(null);
    try {
      await createAdminUser(accessToken, {
        email: createUserEmail,
        password: createUserPassword,
        role: createUserRole,
        ...(createUserName.trim() ? { name: createUserName.trim() } : {}),
      });

      await loadAdminData(accessToken);
      setCreateUserEmail("");
      setCreateUserPassword("");
      setCreateUserName("");
      setCreateUserRole("CSR");
      setActionMessage({ type: "success", text: "User created." });
    } catch (error) {
      setActionMessage({
        type: "error",
        text: error instanceof Error ? error.message : "Failed to create user.",
      });
    } finally {
      setCreatingUser(false);
    }
  };

  const handleSaveUser = async (userId: string) => {
    if (state.status !== "ready") {
      return;
    }

    const accessToken = getStoredAccessToken();
    if (!accessToken) {
      router.replace("/login");
      return;
    }

    const draft = userDrafts[userId];
    if (!draft) {
      return;
    }

    setActionMessage(null);
    try {
      await updateAdminUser(accessToken, userId, {
        email: draft.email,
        name: draft.name.trim() ? draft.name.trim() : null,
        role: draft.role,
      });
      await loadAdminData(accessToken);
      setActionMessage({ type: "success", text: "User updated." });
    } catch (error) {
      setActionMessage({
        type: "error",
        text: error instanceof Error ? error.message : "Failed to update user.",
      });
    }
  };

  const handleDeleteUser = async (userId: string) => {
    if (state.status !== "ready") {
      return;
    }

    const accessToken = getStoredAccessToken();
    if (!accessToken) {
      router.replace("/login");
      return;
    }

    setActionMessage(null);
    try {
      await deleteAdminUser(accessToken, userId);
      await loadAdminData(accessToken);
      setActionMessage({ type: "success", text: "User deleted." });
    } catch (error) {
      setActionMessage({
        type: "error",
        text: error instanceof Error ? error.message : "Failed to delete user.",
      });
    }
  };

  const handleCreateTag = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (state.status !== "ready") {
      return;
    }

    const accessToken = getStoredAccessToken();
    if (!accessToken) {
      router.replace("/login");
      return;
    }

    setCreatingTag(true);
    setActionMessage(null);
    try {
      await createAdminTag(accessToken, {
        name: createTagName,
        color: createTagColor,
        affectsNodeColor: createTagAffectsNodeColor,
      });
      await loadAdminData(accessToken);
      setCreateTagName("");
      setCreateTagColor("#6B7280");
      setCreateTagAffectsNodeColor(false);
      setActionMessage({ type: "success", text: "Tag created." });
    } catch (error) {
      setActionMessage({
        type: "error",
        text: error instanceof Error ? error.message : "Failed to create tag.",
      });
    } finally {
      setCreatingTag(false);
    }
  };

  const handleSaveTag = async (tagId: string) => {
    if (state.status !== "ready") {
      return;
    }

    const accessToken = getStoredAccessToken();
    if (!accessToken) {
      router.replace("/login");
      return;
    }

    const draft = tagDrafts[tagId];
    if (!draft) {
      return;
    }

    setActionMessage(null);
    try {
      await updateAdminTag(accessToken, tagId, {
        name: draft.name,
        color: draft.color,
        affectsNodeColor: draft.affectsNodeColor,
      });
      await loadAdminData(accessToken);
      setActionMessage({ type: "success", text: "Tag updated." });
    } catch (error) {
      setActionMessage({
        type: "error",
        text: error instanceof Error ? error.message : "Failed to update tag.",
      });
    }
  };

  const handleDeleteTag = async (tagId: string) => {
    if (state.status !== "ready") {
      return;
    }

    const accessToken = getStoredAccessToken();
    if (!accessToken) {
      router.replace("/login");
      return;
    }

    setActionMessage(null);
    try {
      await deleteAdminTag(accessToken, tagId);
      await loadAdminData(accessToken);
      setActionMessage({ type: "success", text: "Tag deleted." });
    } catch (error) {
      setActionMessage({
        type: "error",
        text: error instanceof Error ? error.message : "Failed to delete tag.",
      });
    }
  };

  const handleSaveSettings = async () => {
    if (!settingsDraft) {
      return;
    }

    const accessToken = getStoredAccessToken();
    if (!accessToken) {
      router.replace("/login");
      return;
    }

    setActionMessage(null);
    try {
      const updatedSettings = await updateAdminSettings(accessToken, settingsDraft);

      setState((previous) => {
        if (previous.status !== "ready") {
          return previous;
        }

        return {
          status: "ready",
          data: {
            ...previous.data,
            settings: updatedSettings,
          },
        };
      });
      setSettingsDraft(updatedSettings);
      setActionMessage({ type: "success", text: "System settings saved." });
    } catch (error) {
      setActionMessage({
        type: "error",
        text: error instanceof Error ? error.message : "Failed to save settings.",
      });
    }
  };

  const stats = useMemo(() => {
    if (state.status !== "ready") {
      return null;
    }

    return {
      userCount: state.data.users.length,
      tagCount: state.data.tags.length,
    };
  }, [state]);

  return (
    <Container maxWidth="xl" sx={{ py: 4 }}>
      <Stack spacing={2.5}>
        <Paper elevation={1} sx={{ p: 3 }}>
          <Stack spacing={1.25}>
            <Typography variant="h5">Admin Workspace</Typography>
            <Typography color="text.secondary">
              Manage users, roles, tags, priorities, and global system settings.
            </Typography>

            {state.status === "loading" && <Alert severity="info">Validating admin session...</Alert>}
            {state.status === "error" && <Alert severity="error">{state.message}</Alert>}
            {state.status === "ready" && (
              <Alert severity="success">
                Signed in as {state.data.user.name ? `${state.data.user.name} (${state.data.user.email})` : state.data.user.email}
                {stats ? ` | Users ${stats.userCount} | Tags ${stats.tagCount}` : ""}
              </Alert>
            )}

            {actionMessage && <Alert severity={actionMessage.type}>{actionMessage.text}</Alert>}

            <Stack direction="row" spacing={1.25}>
              <Button variant="contained" onClick={handleLogout}>
                Logout
              </Button>
              <Button variant="outlined" onClick={handleRefresh} disabled={state.status !== "ready" || loadingData}>
                {loadingData ? "Refreshing..." : "Refresh"}
              </Button>
              <Button component={Link} href="/" variant="outlined">
                Home
              </Button>
            </Stack>
          </Stack>
        </Paper>

        {readyData && (
          <Stack direction={{ xs: "column", lg: "row" }} spacing={2}>
            <Paper elevation={1} sx={{ p: 2.5, flex: 1.4 }}>
              <Typography variant="h6">Users & Roles</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
                Create accounts and manage role assignments.
              </Typography>
              <Divider sx={{ mb: 1.5 }} />

              <Stack component="form" spacing={1} onSubmit={handleCreateUser} sx={{ mb: 2 }}>
                <TextField
                  label="Email"
                  value={createUserEmail}
                  onChange={(event) => setCreateUserEmail(event.target.value)}
                  required
                />
                <TextField
                  label="Password"
                  type="password"
                  value={createUserPassword}
                  onChange={(event) => setCreateUserPassword(event.target.value)}
                  required
                />
                <TextField
                  label="Name (optional)"
                  value={createUserName}
                  onChange={(event) => setCreateUserName(event.target.value)}
                />
                <FormControl>
                  <InputLabel id="create-user-role-label">Role</InputLabel>
                  <Select
                    labelId="create-user-role-label"
                    label="Role"
                    value={createUserRole}
                    onChange={(event) => setCreateUserRole(event.target.value as Role)}
                  >
                    {USER_ROLES.map((role) => (
                      <MenuItem key={role} value={role}>
                        {role}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
                <Button type="submit" variant="contained" disabled={creatingUser}>
                  {creatingUser ? "Creating..." : "Create User"}
                </Button>
              </Stack>

              <Stack spacing={1}>
                {readyData.users.map((user) => {
                  const draft = userDrafts[user.id] ?? {
                    name: user.name ?? "",
                    email: user.email,
                    role: user.role,
                  };
                  const isCurrentUser = user.id === readyData.user.id;

                  return (
                    <Paper key={user.id} variant="outlined" sx={{ p: 1.25, borderColor: "#E5E7EB" }}>
                      <Stack spacing={1}>
                        <Stack direction={{ xs: "column", sm: "row" }} spacing={1} alignItems={{ sm: "center" }}>
                          <Chip size="small" label={user.role} />
                          <Typography variant="caption" color="text.secondary">
                            {user.id}
                          </Typography>
                        </Stack>
                        <TextField
                          size="small"
                          label="Name"
                          value={draft.name}
                          onChange={(event) =>
                            setUserDrafts((current) => ({
                              ...current,
                              [user.id]: { ...draft, name: event.target.value },
                            }))
                          }
                        />
                        <TextField
                          size="small"
                          label="Email"
                          value={draft.email}
                          onChange={(event) =>
                            setUserDrafts((current) => ({
                              ...current,
                              [user.id]: { ...draft, email: event.target.value },
                            }))
                          }
                        />
                        <FormControl size="small">
                          <InputLabel id={`user-role-${user.id}`}>Role</InputLabel>
                          <Select
                            labelId={`user-role-${user.id}`}
                            label="Role"
                            value={draft.role}
                            onChange={(event) =>
                              setUserDrafts((current) => ({
                                ...current,
                                [user.id]: { ...draft, role: event.target.value as Role },
                              }))
                            }
                          >
                            {USER_ROLES.map((role) => (
                              <MenuItem key={role} value={role}>
                                {role}
                              </MenuItem>
                            ))}
                          </Select>
                        </FormControl>
                        <Stack direction="row" spacing={1}>
                          <Button size="small" variant="contained" onClick={() => void handleSaveUser(user.id)}>
                            Save
                          </Button>
                          <Button
                            size="small"
                            color="error"
                            variant="outlined"
                            disabled={isCurrentUser}
                            onClick={() => void handleDeleteUser(user.id)}
                          >
                            Delete
                          </Button>
                        </Stack>
                      </Stack>
                    </Paper>
                  );
                })}
              </Stack>
            </Paper>

            <Stack spacing={2} sx={{ flex: 1 }}>
              <Paper elevation={1} sx={{ p: 2.5 }}>
                <Typography variant="h6">Tags & Priority Labels</Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
                  Configure reusable tags and node-color behavior.
                </Typography>
                <Divider sx={{ mb: 1.5 }} />

                <Stack component="form" spacing={1} onSubmit={handleCreateTag} sx={{ mb: 2 }}>
                  <TextField
                    label="Tag Name"
                    value={createTagName}
                    onChange={(event) => setCreateTagName(event.target.value)}
                    required
                  />
                  <TextField
                    label="Tag Color"
                    value={createTagColor}
                    onChange={(event) => setCreateTagColor(event.target.value)}
                    required
                  />
                  <Stack direction="row" spacing={1} alignItems="center">
                    <Checkbox
                      checked={createTagAffectsNodeColor}
                      onChange={(event) => setCreateTagAffectsNodeColor(event.target.checked)}
                    />
                    <Typography variant="body2">Affects node color</Typography>
                  </Stack>
                  <Button type="submit" variant="contained" disabled={creatingTag}>
                    {creatingTag ? "Creating..." : "Create Tag"}
                  </Button>
                </Stack>

                <Stack spacing={1}>
                  {readyData.tags.map((tag) => {
                    const draft = tagDrafts[tag.id] ?? {
                      name: tag.name,
                      color: tag.color,
                      affectsNodeColor: tag.affectsNodeColor,
                    };

                    return (
                      <Paper key={tag.id} variant="outlined" sx={{ p: 1.25, borderColor: "#E5E7EB" }}>
                        <Stack spacing={1}>
                          <TextField
                            size="small"
                            label="Name"
                            value={draft.name}
                            onChange={(event) =>
                              setTagDrafts((current) => ({
                                ...current,
                                [tag.id]: { ...draft, name: event.target.value },
                              }))
                            }
                          />
                          <TextField
                            size="small"
                            label="Color"
                            value={draft.color}
                            onChange={(event) =>
                              setTagDrafts((current) => ({
                                ...current,
                                [tag.id]: { ...draft, color: event.target.value },
                              }))
                            }
                          />
                          <Stack direction="row" spacing={1} alignItems="center">
                            <Checkbox
                              checked={draft.affectsNodeColor}
                              onChange={(event) =>
                                setTagDrafts((current) => ({
                                  ...current,
                                  [tag.id]: { ...draft, affectsNodeColor: event.target.checked },
                                }))
                              }
                            />
                            <Typography variant="body2">Affects node color</Typography>
                          </Stack>
                          <Stack direction="row" spacing={1}>
                            <Button size="small" variant="contained" onClick={() => void handleSaveTag(tag.id)}>
                              Save
                            </Button>
                            <Button
                              size="small"
                              color="error"
                              variant="outlined"
                              onClick={() => void handleDeleteTag(tag.id)}
                            >
                              Delete
                            </Button>
                          </Stack>
                        </Stack>
                      </Paper>
                    );
                  })}
                </Stack>
              </Paper>

              <Paper elevation={1} sx={{ p: 2.5 }}>
                <Typography variant="h6">System Settings</Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
                  Manage default priority, availability refresh interval, and priority styles.
                </Typography>
                <Divider sx={{ mb: 1.5 }} />

                {settingsDraft && (
                  <Stack spacing={1.25}>
                    <TextField
                      type="number"
                      label="Availability Refresh (minutes)"
                      value={settingsDraft.availabilityRefreshMinutes}
                      onChange={(event) =>
                        setSettingsDraft((current) =>
                          current
                            ? {
                                ...current,
                                availabilityRefreshMinutes: Math.max(
                                  1,
                                  Math.min(240, Number(event.target.value || "1")),
                                ),
                              }
                            : current,
                        )
                      }
                      inputProps={{ min: 1, max: 240 }}
                    />

                    <FormControl>
                      <InputLabel id="default-case-priority-label">Default Case Priority</InputLabel>
                      <Select
                        labelId="default-case-priority-label"
                        label="Default Case Priority"
                        value={settingsDraft.defaultCasePriority}
                        onChange={(event) =>
                          setSettingsDraft((current) =>
                            current
                              ? { ...current, defaultCasePriority: event.target.value as AdminSettings["defaultCasePriority"] }
                              : current,
                          )
                        }
                      >
                        {CASE_PRIORITIES.map((priority) => (
                          <MenuItem key={priority} value={priority}>
                            {priority}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>

                    {CASE_PRIORITIES.map((priority) => (
                      <Box key={priority} sx={{ border: "1px solid #E5E7EB", borderRadius: 1, p: 1 }}>
                        <Typography variant="subtitle2" sx={{ mb: 1 }}>
                          {priority} Style
                        </Typography>
                        <Stack spacing={1}>
                          <TextField
                            size="small"
                            label="Label"
                            value={settingsDraft.priorityStyleMap[priority].label}
                            onChange={(event) =>
                              setSettingsDraft((current) =>
                                current
                                  ? {
                                      ...current,
                                      priorityStyleMap: {
                                        ...current.priorityStyleMap,
                                        [priority]: {
                                          ...current.priorityStyleMap[priority],
                                          label: event.target.value,
                                        },
                                      },
                                    }
                                  : current,
                              )
                            }
                          />
                          <TextField
                            size="small"
                            label="Color"
                            value={settingsDraft.priorityStyleMap[priority].color}
                            onChange={(event) =>
                              setSettingsDraft((current) =>
                                current
                                  ? {
                                      ...current,
                                      priorityStyleMap: {
                                        ...current.priorityStyleMap,
                                        [priority]: {
                                          ...current.priorityStyleMap[priority],
                                          color: event.target.value,
                                        },
                                      },
                                    }
                                  : current,
                              )
                            }
                          />
                          <TextField
                            size="small"
                            label="Background"
                            value={settingsDraft.priorityStyleMap[priority].background}
                            onChange={(event) =>
                              setSettingsDraft((current) =>
                                current
                                  ? {
                                      ...current,
                                      priorityStyleMap: {
                                        ...current.priorityStyleMap,
                                        [priority]: {
                                          ...current.priorityStyleMap[priority],
                                          background: event.target.value,
                                        },
                                      },
                                    }
                                  : current,
                              )
                            }
                          />
                        </Stack>
                      </Box>
                    ))}

                    <Button variant="contained" onClick={handleSaveSettings}>
                      Save Settings
                    </Button>
                  </Stack>
                )}
              </Paper>
            </Stack>
          </Stack>
        )}
      </Stack>
    </Container>
  );
}
