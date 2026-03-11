import { getRouteForRole, isRole, type Role } from "./roles";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
const ACCESS_TOKEN_KEY = "treecrm_access_token";

type AuthUser = {
  id: string;
  email: string;
  role: Role;
  name?: string;
};

type AuthResponse = {
  status: string;
  message: string;
  token?: string;
  user: AuthUser;
  emailConfirmationRequired?: boolean;
};

type AuthenticatedAuthResponse = AuthResponse & {
  token: string;
};

type MeResponse = {
  status: string;
  user: {
    sub: string;
    email: string;
    role: Role;
    name?: string;
  };
};

function isAuthResponse(value: unknown): value is AuthResponse {
  if (!value || typeof value !== "object") {
    return false;
  }

  const parsed = value as Partial<AuthResponse>;
  return (
    !!parsed.user &&
    typeof parsed.user.id === "string" &&
    typeof parsed.user.email === "string" &&
    isRole(parsed.user.role)
  );
}

async function parseJsonResponse(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

function getErrorMessage(responseBody: unknown, fallback: string): string {
  if (
    responseBody &&
    typeof responseBody === "object" &&
    "message" in responseBody &&
    typeof responseBody.message === "string"
  ) {
    return responseBody.message;
  }

  return fallback;
}

export async function login(email: string, password: string): Promise<AuthenticatedAuthResponse> {
  const response = await fetch(`${API_BASE_URL}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });

  const responseBody = await parseJsonResponse(response);

  if (!response.ok) {
    throw new Error(getErrorMessage(responseBody, "Login failed."));
  }

  if (!isAuthResponse(responseBody) || typeof responseBody.token !== "string") {
    throw new Error("Unexpected login response format.");
  }

  return responseBody as AuthenticatedAuthResponse;
}

export async function register(email: string, password: string, name?: string): Promise<AuthResponse> {
  const response = await fetch(`${API_BASE_URL}/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email,
      password,
      ...(name ? { name } : {}),
    }),
  });

  const responseBody = await parseJsonResponse(response);

  if (!response.ok) {
    throw new Error(getErrorMessage(responseBody, "Registration failed."));
  }

  if (!isAuthResponse(responseBody)) {
    throw new Error("Unexpected registration response format.");
  }

  return responseBody;
}

export async function me(accessToken: string): Promise<MeResponse["user"]> {
  const response = await fetch(`${API_BASE_URL}/auth/me`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    cache: "no-store",
  });

  const responseBody = await parseJsonResponse(response);

  if (!response.ok) {
    throw new Error(getErrorMessage(responseBody, "Could not fetch authenticated user."));
  }

  const parsed = responseBody as Partial<MeResponse>;
  if (
    !parsed.user ||
    typeof parsed.user.sub !== "string" ||
    typeof parsed.user.email !== "string" ||
    !isRole(parsed.user.role)
  ) {
    throw new Error("Unexpected /auth/me response format.");
  }

  return parsed.user;
}

export async function logout(accessToken: string): Promise<void> {
  await fetch(`${API_BASE_URL}/auth/logout`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });
}

export function setStoredAccessToken(accessToken: string): void {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
}

export function getStoredAccessToken(): string | null {
  if (typeof window === "undefined") {
    return null;
  }

  return window.localStorage.getItem(ACCESS_TOKEN_KEY);
}

export function clearStoredAccessToken(): void {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.removeItem(ACCESS_TOKEN_KEY);
}

export function getLandingRoute(role: Role): string {
  return getRouteForRole(role);
}
