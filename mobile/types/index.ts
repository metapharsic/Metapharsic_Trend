export type UserRole = "MR" | "MANAGER";
export type UserStatus = "ACTIVE" | "INACTIVE";
export type EntityType = "DOCTOR" | "CLINIC" | "PHARMACY";
export type EntityStatus = "ACTIVE" | "INACTIVE";
export type ReceptivenessRating =
  | "VERY_INTERESTED"
  | "INTERESTED"
  | "NEUTRAL"
  | "NOT_INTERESTED"
  | "DECLINED";

export interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface User {
  id: string;
  phone?: string | null;
  email?: string | null;
  name: string;
  role: UserRole;
  status: UserStatus;
  territory?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Entity {
  id: string;
  name: string;
  type: EntityType;
  address?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  territory?: string | null;
  contactInfo?: string | null;
  status: EntityStatus;
  createdAt: string;
  updatedAt: string;
}

export interface Visit {
  id: string;
  mrId?: string;
  employeeId?: string;
  doctorId?: string | null;
  chemistId?: string | null;
  doctor?: { id: string; fullName: string; clinicAddress: string } | null;
  chemist?: { id: string; name: string; address: string } | null;
  timestamp?: string;
  latitude?: number | null;
  longitude?: number | null;
  locationUnavailable?: boolean;
  photoPath?: string | null;
  photoUrl?: string | null;
  activityNotes?: string;
  materialsLeft?: string | null;
  receptiveness?: ReceptivenessRating | null;
  notes?: string | null;
  followUpDate?: string | null;
  anomalyFlag?: boolean;
  createdAt: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface AuthUser {
  id: string;
  name: string;
  role: UserRole;
  territory?: string | null;
  phone?: string | null;
}
