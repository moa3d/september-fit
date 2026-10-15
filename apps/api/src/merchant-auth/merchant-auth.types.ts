import type { Request } from "express";

export type DashboardRole =
  | "OWNER"
  | "ADMIN"
  | "DEVELOPER"
  | "ANALYST"
  | "STAFF";

export interface DashboardPrincipal {
  sessionId: string;
  merchantId: string;
  merchantPublicId: string;
  merchantName: string;
  userId: string;
  email: string;
  role: DashboardRole;
}

export interface DashboardRequest extends Request {
  dashboardUser: DashboardPrincipal;
}
