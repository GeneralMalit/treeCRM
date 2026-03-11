type JsonRecord = Record<string, unknown>;

const apiBaseUrl = process.env.API_BASE_URL ?? "http://127.0.0.1:4000";
const runId = Date.now();

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value || !value.trim()) {
    throw new Error(`${name} is required for the Session 3 CRUD smoke test.`);
  }

  return value;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });

  const data = (await response.json()) as JsonRecord;

  if (!response.ok) {
    throw new Error(`${init?.method ?? "GET"} ${path} failed: ${JSON.stringify(data)}`);
  }

  return data as T;
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

async function main() {
  const adminEmail = requireEnv("TREECRM_ADMIN_EMAIL");
  const adminPassword = requireEnv("TREECRM_ADMIN_PASSWORD");
  const createdUserPassword = process.env.TREECRM_CREATED_USER_PASSWORD?.trim() || `Session3User-${runId}!`;

  const login = await request<{ token: string; user: { id: string } }>("/auth/login", {
    method: "POST",
    body: JSON.stringify({
      email: adminEmail,
      password: adminPassword,
    }),
  });

  const authHeaders = {
    Authorization: `Bearer ${login.token}`,
  };

  const createdIds: Record<string, string> = {};
  const createdUserEmail = `session3.${runId}@gmail.com`;

  const createdUser = await request<{ data: { id: string } }>("/data/users", {
    method: "POST",
    headers: authHeaders,
    body: JSON.stringify({
      email: createdUserEmail,
      password: createdUserPassword,
      name: "Session 3 Test User",
      role: "Customer",
    }),
  });
  createdIds.user = createdUser.data.id;

  const users = await request<{ data: Array<{ id: string }> }>("/data/users", {
    headers: authHeaders,
  });
  assert(users.data.some((user) => user.id === createdIds.user), "Created user was not listed.");

  await request(`/data/users/${createdIds.user}`, {
    method: "PATCH",
    headers: authHeaders,
    body: JSON.stringify({
      name: "Session 3 Updated User",
    }),
  });

  const customer = await request<{ data: { id: string } }>("/data/customers", {
    method: "POST",
    headers: authHeaders,
    body: JSON.stringify({
      userId: createdIds.user,
      company: "TreeCRM Session 3 Co",
      contactInfo: {
        email: createdUserEmail,
        phone: "+1-555-0100",
      },
    }),
  });
  createdIds.customer = customer.data.id;

  await request(`/data/customers/${createdIds.customer}`, { headers: authHeaders });
  await request(`/data/customers/${createdIds.customer}`, {
    method: "PATCH",
    headers: authHeaders,
    body: JSON.stringify({
      company: "TreeCRM Session 3 Co Updated",
      contactInfo: {
        email: createdUserEmail,
        phone: "+1-555-0101",
      },
    }),
  });

  const createdCase = await request<{ data: { id: string } }>("/data/cases", {
    method: "POST",
    headers: authHeaders,
    body: JSON.stringify({
      customerId: createdIds.customer,
      assignedTo: login.user.id,
      title: "Session 3 smoke test case",
      description: "Create case through backend CRUD route.",
      status: "Open",
      priority: "High",
    }),
  });
  createdIds.case = createdCase.data.id;

  await request(`/data/cases/${createdIds.case}`, { headers: authHeaders });
  await request(`/data/cases/${createdIds.case}`, {
    method: "PATCH",
    headers: authHeaders,
    body: JSON.stringify({
      status: "In Progress",
      priority: "Medium",
    }),
  });

  const tag = await request<{ data: { id: string } }>("/data/tags", {
    method: "POST",
    headers: authHeaders,
    body: JSON.stringify({
      name: `session3-tag-${runId}`,
      color: "#F59E0B",
      affectsNodeColor: true,
    }),
  });
  createdIds.tag = tag.data.id;

  await request(`/data/tags/${createdIds.tag}`, { headers: authHeaders });
  await request(`/data/tags/${createdIds.tag}`, {
    method: "PATCH",
    headers: authHeaders,
    body: JSON.stringify({
      color: "#D97706",
    }),
  });

  const caseTag = await request<{ data: { id: string } }>("/data/case-tags", {
    method: "POST",
    headers: authHeaders,
    body: JSON.stringify({
      caseId: createdIds.case,
      tagId: createdIds.tag,
    }),
  });
  createdIds.caseTag = caseTag.data.id;

  await request(`/data/case-tags/${createdIds.caseTag}`, { headers: authHeaders });
  await request(`/data/case-tags/${createdIds.caseTag}`, {
    method: "PATCH",
    headers: authHeaders,
    body: JSON.stringify({
      caseId: createdIds.case,
      tagId: createdIds.tag,
    }),
  });

  const message = await request<{ data: { id: string } }>("/data/messages", {
    method: "POST",
    headers: authHeaders,
    body: JSON.stringify({
      caseId: createdIds.case,
      senderId: login.user.id,
      senderRole: "Admin",
      messageType: "text",
      messageText: "Session 3 smoke test message.",
    }),
  });
  createdIds.message = message.data.id;

  await request(`/data/messages/${createdIds.message}`, { headers: authHeaders });
  await request(`/data/messages/${createdIds.message}`, {
    method: "PATCH",
    headers: authHeaders,
    body: JSON.stringify({
      messageText: "Session 3 smoke test message updated.",
    }),
  });

  const endorsement = await request<{ data: { id: string } }>("/data/endorsements", {
    method: "POST",
    headers: authHeaders,
    body: JSON.stringify({
      caseId: createdIds.case,
      endorsedBy: login.user.id,
      endorsedTo: login.user.id,
      status: "Pending",
    }),
  });
  createdIds.endorsement = endorsement.data.id;

  await request(`/data/endorsements/${createdIds.endorsement}`, { headers: authHeaders });
  await request(`/data/endorsements/${createdIds.endorsement}`, {
    method: "PATCH",
    headers: authHeaders,
    body: JSON.stringify({
      status: "Accepted",
    }),
  });

  const notification = await request<{ data: { id: string } }>("/data/notifications", {
    method: "POST",
    headers: authHeaders,
    body: JSON.stringify({
      userId: login.user.id,
      type: "session3_smoke_test",
      message: "Session 3 notification smoke test.",
      read: false,
    }),
  });
  createdIds.notification = notification.data.id;

  await request(`/data/notifications/${createdIds.notification}`, { headers: authHeaders });
  await request(`/data/notifications/${createdIds.notification}`, {
    method: "PATCH",
    headers: authHeaders,
    body: JSON.stringify({
      read: true,
    }),
  });

  await request(`/data/notifications/${createdIds.notification}`, {
    method: "DELETE",
    headers: authHeaders,
  });
  await request(`/data/endorsements/${createdIds.endorsement}`, {
    method: "DELETE",
    headers: authHeaders,
  });
  await request(`/data/messages/${createdIds.message}`, {
    method: "DELETE",
    headers: authHeaders,
  });
  await request(`/data/case-tags/${createdIds.caseTag}`, {
    method: "DELETE",
    headers: authHeaders,
  });
  await request(`/data/tags/${createdIds.tag}`, {
    method: "DELETE",
    headers: authHeaders,
  });
  await request(`/data/cases/${createdIds.case}`, {
    method: "DELETE",
    headers: authHeaders,
  });
  await request(`/data/customers/${createdIds.customer}`, {
    method: "DELETE",
    headers: authHeaders,
  });
  const userDelete = await request<{ authUserDeleted: boolean }>(`/data/users/${createdIds.user}`, {
    method: "DELETE",
    headers: authHeaders,
  });

  console.log(
    JSON.stringify({
      status: "ok",
      runId,
      createdUserEmail,
      authUserDeleted: userDelete.authUserDeleted,
    }),
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
