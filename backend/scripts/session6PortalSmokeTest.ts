import { createServer } from "node:http";
import { app } from "../src/app";

type ApiSuccess<T> = {
  status: "ok";
  data?: T;
  token?: string;
  user?: {
    id: string;
    email: string;
    role: string;
  };
};

type ApiError = {
  status: "error";
  message?: string;
};

type ApiResponse<T> = ApiSuccess<T> | ApiError;

function ensureOk<T>(response: Response, body: ApiResponse<T>, fallbackMessage: string): asserts body is ApiSuccess<T> {
  if (!response.ok || body.status !== "ok") {
    const message = "message" in body && typeof body.message === "string" ? body.message : fallbackMessage;
    throw new Error(`${response.status} ${response.statusText} - ${message}`);
  }
}

async function parseJson<T>(response: Response): Promise<T> {
  try {
    return (await response.json()) as T;
  } catch {
    return {} as T;
  }
}

async function request<T>(
  baseUrl: string,
  path: string,
  options?: {
    method?: "GET" | "POST" | "PATCH";
    token?: string;
    body?: unknown;
  },
): Promise<{ response: Response; body: ApiResponse<T> }> {
  const response = await fetch(`${baseUrl}${path}`, {
    method: options?.method ?? "GET",
    headers: {
      ...(options?.token ? { Authorization: `Bearer ${options.token}` } : {}),
      ...(typeof options?.body !== "undefined" ? { "Content-Type": "application/json" } : {}),
    },
    ...(typeof options?.body !== "undefined" ? { body: JSON.stringify(options.body) } : {}),
  });

  const body = await parseJson<ApiResponse<T>>(response);
  return { response, body };
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value || !value.trim()) {
    throw new Error(`${name} is required for the Session 6 portal smoke test.`);
  }

  return value;
}

async function run() {
  const server = createServer(app);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Failed to start local test server.");
  }

  const baseUrl = `http://127.0.0.1:${address.port}`;
  const seed = `${Date.now()}-${Math.floor(Math.random() * 10000)}`;
  const adminEmail = requireEnv("TREECRM_ADMIN_EMAIL");
  const adminPassword = requireEnv("TREECRM_ADMIN_PASSWORD");
  const password = process.env.TREECRM_PORTAL_SMOKE_PASSWORD?.trim() || `Session6Portal-${seed}!`;
  const csrEmail = `s6csr${seed}@treecrm.dev`;
  const customerEmail = `s6customer${seed}@treecrm.dev`;

  console.log("Session 6 smoke test started.");
  console.log(`Base URL: ${baseUrl}`);
  console.log(`Admin login: ${adminEmail}`);
  console.log(`CSR: ${csrEmail}`);
  console.log(`Customer: ${customerEmail}`);

  try {
    const adminLogin = await request(baseUrl, "/auth/login", {
      method: "POST",
      body: { email: adminEmail, password: adminPassword },
    });
    ensureOk(adminLogin.response, adminLogin.body, "Failed to login admin test user.");
    if (!adminLogin.body.token || !adminLogin.body.user?.id) {
      throw new Error("Admin login did not return token/user.");
    }
    const adminToken = adminLogin.body.token;

    const csrCreate = await request<{ id: string }>(baseUrl, "/data/users", {
      method: "POST",
      token: adminToken,
      body: { email: csrEmail, password, role: "CSR", name: "Session6 CSR" },
    });
    ensureOk(csrCreate.response, csrCreate.body, "Failed to create CSR test user.");
    if (!csrCreate.body.data?.id) {
      throw new Error("CSR creation did not return a user ID.");
    }
    const csrUserId = csrCreate.body.data.id;

    const customerCreate = await request<{ id: string }>(baseUrl, "/data/users", {
      method: "POST",
      token: adminToken,
      body: { email: customerEmail, password, role: "Customer", name: "Session6 Customer" },
    });
    ensureOk(customerCreate.response, customerCreate.body, "Failed to create customer test user.");
    if (!customerCreate.body.data?.id) {
      throw new Error("Customer creation did not return a user ID.");
    }

    const csrLogin = await request(baseUrl, "/auth/login", {
      method: "POST",
      body: { email: csrEmail, password },
    });
    ensureOk(csrLogin.response, csrLogin.body, "Failed to login CSR test user.");
    if (!csrLogin.body.token) {
      throw new Error("CSR login did not return a token.");
    }
    const csrToken = csrLogin.body.token;

    const customerLogin = await request(baseUrl, "/auth/login", {
      method: "POST",
      body: { email: customerEmail, password },
    });
    ensureOk(customerLogin.response, customerLogin.body, "Failed to login customer test user.");
    if (!customerLogin.body.token) {
      throw new Error("Customer login did not return a token.");
    }
    const customerToken = customerLogin.body.token;

    const createTicket = await request<{ ticket: { id: string } }>(baseUrl, "/portal/tickets", {
      method: "POST",
      token: customerToken,
      body: {
        subject: "Session 6 Smoke Ticket",
        description: "Created by automated smoke test.",
        category: "Technical Issue",
        attachments: ["screenshot.png", "https://example.com/logs/issue-1.txt"],
      },
    });
    ensureOk(createTicket.response, createTicket.body, "Failed to create customer ticket.");
    const ticketId = createTicket.body.data?.ticket?.id;
    if (!ticketId) {
      throw new Error("Ticket creation response is missing ticket ID.");
    }

    const forceAssign = await request(baseUrl, `/data/cases/${ticketId}`, {
      method: "PATCH",
      token: adminToken,
      body: { assignedTo: csrUserId },
    });
    ensureOk(forceAssign.response, forceAssign.body, "Failed to reassign ticket to test CSR.");

    const csrTree = await request<{ data: Array<{ customers: Array<{ cases: Array<{ id: string }> }> }> }>(
      baseUrl,
      "/employee/tree",
      { token: csrToken },
    );
    ensureOk(csrTree.response, csrTree.body, "Failed to fetch CSR tree.");
    const treeHasTicket =
      csrTree.body.data?.data.some((employee) =>
        employee.customers.some((customer) => customer.cases.some((caseItem) => caseItem.id === ticketId)),
      ) ?? false;
    if (!treeHasTicket) {
      throw new Error("Created ticket is missing from CSR tree.");
    }

    const csrStatusUpdate = await request(baseUrl, `/employee/cases/${ticketId}`, {
      method: "PATCH",
      token: csrToken,
      body: { status: "In Progress" },
    });
    ensureOk(csrStatusUpdate.response, csrStatusUpdate.body, "Failed to update ticket status from CSR.");

    const customerMessage = await request(baseUrl, `/portal/tickets/${ticketId}/messages`, {
      method: "POST",
      token: customerToken,
      body: { messageText: "Customer follow-up from smoke test." },
    });
    ensureOk(customerMessage.response, customerMessage.body, "Failed to send customer message.");

    const ticketDetail = await request<{
      ticket: { status: string };
      timeline: Array<{ label: string }>;
      messages: Array<{ messageText: string }>;
    }>(baseUrl, `/portal/tickets/${ticketId}`, {
      token: customerToken,
    });
    ensureOk(ticketDetail.response, ticketDetail.body, "Failed to fetch customer ticket detail.");

    const detailData = ticketDetail.body.data;
    if (!detailData) {
      throw new Error("Ticket detail response is missing data.");
    }

    if (detailData.ticket.status !== "In Progress") {
      throw new Error(`Unexpected ticket status: ${detailData.ticket.status}`);
    }

    const hasStatusTimelineEvent = detailData.timeline.some((entry) =>
      entry.label.toLowerCase().includes("status updated to in progress"),
    );
    if (!hasStatusTimelineEvent) {
      throw new Error("Ticket timeline is missing the CSR status update event.");
    }

    const hasCustomerMessage = detailData.messages.some((entry) =>
      entry.messageText.includes("Customer follow-up from smoke test."),
    );
    if (!hasCustomerMessage) {
      throw new Error("Ticket detail is missing the customer chat message.");
    }

    console.log("Session 6 smoke test passed.");
    console.log(`Verified ticket ID: ${ticketId}`);
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve();
      });
    });
  }
}

run().catch((error) => {
  console.error("Session 6 smoke test failed.");
  console.error(error);
  process.exitCode = 1;
});
