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

function ensureOk<T>(
  response: Response,
  body: ApiResponse<T>,
  fallbackMessage: string,
): asserts body is ApiSuccess<T> {
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
    method?: "GET" | "POST" | "PATCH" | "DELETE";
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

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

async function run() {
  const server = createServer(app);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Failed to start local test server.");
  }

  const baseUrl = `http://127.0.0.1:${address.port}`;
  const seed = `${Date.now()}${Math.floor(Math.random() * 10000)}`;

  const sharedPassword = process.env.TREECRM_TEST_PASSWORD ?? "TreeCRM123!";
  const adminEmail = process.env.TREECRM_ADMIN_EMAIL ?? "session2.admin@example.com";
  const managerEmail = process.env.TREECRM_MANAGER_EMAIL ?? "session2.manager@example.com";
  const csrAEmail = process.env.TREECRM_CSR_EMAIL ?? "session2.csr@example.com";
  const customerEmail = process.env.TREECRM_CUSTOMER_EMAIL ?? "session2.customer@example.com";

  const csrBEmail = `s10csrb${seed}@gmail.com`;
  const csrBPassword = "Session10CsrB123!";

  console.log("Session 10 smoke test started.");
  console.log(`Base URL: ${baseUrl}`);

  try {
    const adminLogin = await request(baseUrl, "/auth/login", {
      method: "POST",
      body: { email: adminEmail, password: sharedPassword },
    });
    ensureOk(adminLogin.response, adminLogin.body, "Failed to login admin.");
    assert(adminLogin.body.token && adminLogin.body.user?.id, "Admin login missing token/user.");
    const adminToken = adminLogin.body.token;

    const managerLogin = await request(baseUrl, "/auth/login", {
      method: "POST",
      body: { email: managerEmail, password: sharedPassword },
    });
    ensureOk(managerLogin.response, managerLogin.body, "Failed to login manager.");
    assert(
      managerLogin.body.token && managerLogin.body.user?.id,
      "Manager login missing token/user.",
    );
    const managerToken = managerLogin.body.token;
    const managerUserId = managerLogin.body.user.id;

    const csrALogin = await request(baseUrl, "/auth/login", {
      method: "POST",
      body: { email: csrAEmail, password: sharedPassword },
    });
    ensureOk(csrALogin.response, csrALogin.body, "Failed to login CSR A.");
    assert(csrALogin.body.token && csrALogin.body.user?.id, "CSR A login missing token/user.");
    const csrAToken = csrALogin.body.token;
    const csrAUserId = csrALogin.body.user.id;

    const createCsrB = await request<{ id: string }>(baseUrl, "/data/users", {
      method: "POST",
      token: adminToken,
      body: {
        email: csrBEmail,
        password: csrBPassword,
        role: "CSR",
        name: "Session10 CSR B",
      },
    });
    ensureOk(createCsrB.response, createCsrB.body, "Failed to create CSR B.");
    const csrBUserId = createCsrB.body.data?.id;
    assert(csrBUserId, "CSR B creation did not return a user ID.");

    const csrBLogin = await request(baseUrl, "/auth/login", {
      method: "POST",
      body: { email: csrBEmail, password: csrBPassword },
    });
    ensureOk(csrBLogin.response, csrBLogin.body, "Failed to login CSR B.");
    assert(csrBLogin.body.token && csrBLogin.body.user?.id, "CSR B login missing token/user.");
    const csrBToken = csrBLogin.body.token;

    const customerLogin = await request(baseUrl, "/auth/login", {
      method: "POST",
      body: { email: customerEmail, password: sharedPassword },
    });
    ensureOk(customerLogin.response, customerLogin.body, "Failed to login customer.");
    assert(customerLogin.body.token && customerLogin.body.user?.id, "Customer login missing token/user.");
    const customerToken = customerLogin.body.token;

    const createTicket = await request<{
      ticket: {
        id: string;
      };
    }>(baseUrl, "/portal/tickets", {
      method: "POST",
      token: customerToken,
      body: {
        subject: "Session 10 Workflow Ticket",
        description: "End-to-end workflow validation for Session 10.",
        category: "Technical Issue",
        attachments: ["https://example.com/session10/log.txt"],
      },
    });
    ensureOk(createTicket.response, createTicket.body, "Failed to create ticket.");
    const ticketId = createTicket.body.data?.ticket?.id;
    assert(ticketId, "Ticket creation did not return a ticket ID.");

    const forceAssignToCsrA = await request(baseUrl, `/data/cases/${ticketId}`, {
      method: "PATCH",
      token: adminToken,
      body: { assignedTo: csrAUserId },
    });
    ensureOk(forceAssignToCsrA.response, forceAssignToCsrA.body, "Failed to assign ticket to CSR A.");

    const customerMessage = await request(baseUrl, `/portal/tickets/${ticketId}/messages`, {
      method: "POST",
      token: customerToken,
      body: { messageText: "Customer initial message from Session 10 smoke test." },
    });
    ensureOk(customerMessage.response, customerMessage.body, "Failed to create customer message.");

    const csrMessages = await request<{
      messages: Array<{ messageText: string; senderRole: string }>;
    }>(baseUrl, `/employee/cases/${ticketId}/messages`, {
      token: csrAToken,
    });
    ensureOk(csrMessages.response, csrMessages.body, "Failed to load CSR case messages.");
    assert(
      csrMessages.body.data?.messages.some((message) =>
        message.messageText.includes("Customer initial message from Session 10 smoke test."),
      ),
      "CSR case messages did not include the customer message.",
    );

    const csrReply = await request(baseUrl, `/employee/cases/${ticketId}/messages`, {
      method: "POST",
      token: csrAToken,
      body: { messageText: "CSR reply from Session 10 smoke test." },
    });
    ensureOk(csrReply.response, csrReply.body, "Failed to create CSR reply.");

    const customerDetailBeforeWorkflow = await request<{
      messages: Array<{ messageText: string }>;
    }>(baseUrl, `/portal/tickets/${ticketId}`, {
      token: customerToken,
    });
    ensureOk(
      customerDetailBeforeWorkflow.response,
      customerDetailBeforeWorkflow.body,
      "Failed to load customer ticket detail.",
    );
    assert(
      customerDetailBeforeWorkflow.body.data?.messages.some((message) =>
        message.messageText.includes("CSR reply from Session 10 smoke test."),
      ),
      "Customer detail did not include the CSR reply.",
    );

    const csrStatusInProgress = await request(baseUrl, `/employee/cases/${ticketId}`, {
      method: "PATCH",
      token: csrAToken,
      body: { status: "In Progress" },
    });
    ensureOk(csrStatusInProgress.response, csrStatusInProgress.body, "Failed to move case to In Progress.");

    const endorsementCreate = await request<{
      endorsement: {
        id: string;
      };
    }>(baseUrl, `/employee/cases/${ticketId}/endorsements`, {
      method: "POST",
      token: csrAToken,
      body: { endorsedToId: managerUserId },
    });
    ensureOk(endorsementCreate.response, endorsementCreate.body, "Failed to create endorsement.");
    const endorsementId = endorsementCreate.body.data?.endorsement?.id;
    assert(endorsementId, "Endorsement creation did not return endorsement ID.");

    const managerWorkflow = await request<{
      endorsements: Array<{ id: string; status: string }>;
    }>(baseUrl, `/employee/cases/${ticketId}/workflow`, {
      token: managerToken,
    });
    ensureOk(managerWorkflow.response, managerWorkflow.body, "Failed to fetch manager workflow.");
    assert(
      managerWorkflow.body.data?.endorsements.some(
        (endorsement) => endorsement.id === endorsementId && endorsement.status === "Pending",
      ),
      "Manager workflow did not show the pending endorsement.",
    );

    const endorsementDecision = await request(baseUrl, `/employee/endorsements/${endorsementId}`, {
      method: "PATCH",
      token: managerToken,
      body: { status: "Accepted" },
    });
    ensureOk(endorsementDecision.response, endorsementDecision.body, "Failed to accept endorsement.");

    const reassignToCsrB = await request(baseUrl, `/employee/cases/${ticketId}/reassign`, {
      method: "PATCH",
      token: managerToken,
      body: { assigneeId: csrBUserId, reason: "Load balancing for Session 10 test." },
    });
    ensureOk(reassignToCsrB.response, reassignToCsrB.body, "Failed to reassign case to CSR B.");

    const csrBInProgress = await request(baseUrl, `/employee/cases/${ticketId}`, {
      method: "PATCH",
      token: csrBToken,
      body: { status: "In Progress" },
    });
    ensureOk(csrBInProgress.response, csrBInProgress.body, "CSR B failed to set status In Progress.");

    const csrBResolved = await request(baseUrl, `/employee/cases/${ticketId}`, {
      method: "PATCH",
      token: csrBToken,
      body: { status: "Resolved" },
    });
    ensureOk(csrBResolved.response, csrBResolved.body, "CSR B failed to resolve case.");

    const submitCsat = await request<{ rating: number }>(
      baseUrl,
      `/portal/tickets/${ticketId}/customer-satisfaction`,
      {
        method: "POST",
        token: customerToken,
        body: { rating: 5 },
      },
    );
    ensureOk(submitCsat.response, submitCsat.body, "Customer CSAT submission failed.");
    assert(submitCsat.body.data?.rating === 5, "CSAT response did not return rating 5.");

    const csrBTree = await request<
      Array<{ id: string; metrics: { customerSatisfaction: number | null; ratedCaseCount: number } }>
    >(baseUrl, "/employee/tree", {
      token: csrBToken,
    });
    ensureOk(csrBTree.response, csrBTree.body, "Failed to load CSR B tree.");
    const csrBNode = csrBTree.body.data?.find((node) => node.id === csrBUserId);
    assert(csrBNode, "CSR B node not found in tree response.");
    assert(csrBNode.metrics.ratedCaseCount >= 1, "CSR B metrics did not register a rated case.");
    assert(csrBNode.metrics.customerSatisfaction === 100, "CSR B CSAT metric did not resolve to 100%.");

    const notificationsResult = await request<Array<{ user_id: string; type: string; message: string }>>(
      baseUrl,
      "/data/notifications",
      {
        token: adminToken,
      },
    );
    ensureOk(notificationsResult.response, notificationsResult.body, "Failed to fetch notifications.");
    const notifications = notificationsResult.body.data ?? [];

    const managerGotEndorsementNotification = notifications.some(
      (entry) =>
        entry.user_id === managerUserId &&
        entry.type === "case_endorsement" &&
        entry.message.includes("Session 10 Workflow Ticket"),
    );
    assert(managerGotEndorsementNotification, "Manager did not receive case endorsement notification.");

    const csrAGotReassignmentNotification = notifications.some(
      (entry) =>
        entry.user_id === csrAUserId &&
        entry.type === "case_reassignment" &&
        entry.message.includes("Session 10 Workflow Ticket"),
    );
    assert(csrAGotReassignmentNotification, "CSR A did not receive reassignment notification.");

    const csrBGotReassignmentNotification = notifications.some(
      (entry) =>
        entry.user_id === csrBUserId &&
        entry.type === "case_reassignment" &&
        entry.message.includes("Session 10 Workflow Ticket"),
    );
    assert(csrBGotReassignmentNotification, "CSR B did not receive reassignment notification.");

    const csrBGotCsatNotification = notifications.some(
      (entry) =>
        entry.user_id === csrBUserId &&
        entry.type === "case_customer_satisfaction" &&
        entry.message.includes("Session 10 Workflow Ticket"),
    );
    assert(csrBGotCsatNotification, "CSR B did not receive customer satisfaction notification.");

    const customerDetailAfterCsat = await request<{
      timeline: Array<{ label: string }>;
      ticket: { customerSatisfactionRating: number | null };
    }>(baseUrl, `/portal/tickets/${ticketId}`, {
      token: customerToken,
    });
    ensureOk(
      customerDetailAfterCsat.response,
      customerDetailAfterCsat.body,
      "Failed to reload customer detail after CSAT.",
    );
    assert(
      customerDetailAfterCsat.body.data?.timeline.some((entry) =>
        entry.label.includes("Customer satisfaction submitted: 5/5."),
      ),
      "Timeline did not include the customer satisfaction event.",
    );
    assert(
      customerDetailAfterCsat.body.data?.ticket.customerSatisfactionRating === 5,
      "Ticket detail did not include CSAT rating value.",
    );

    console.log("Session 10 smoke test passed.");
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
  console.error("Session 10 smoke test failed.");
  console.error(error);
  process.exitCode = 1;
});
