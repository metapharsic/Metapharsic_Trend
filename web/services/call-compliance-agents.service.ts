/**
 * Multi-Agent Call Compliance, Mandatory Phone & Silent GPS Telemetry Engine
 * 
 * Agents:
 * 1. PhoneVerificationAgent: Enforces mandatory phone validation for doctors and chemists
 * 2. SilentGpsTelemetryAgent: Silently captures and validates background GPS telemetry for admins
 * 3. EntityContactSyncAgent: Synchronizes phone numbers across Doctor / Chemist CRM entities
 * 4. AdminComplianceAuditAgent: Structures compliance telemetry for admin oversight
 */

import { db } from "@/lib/db";

export interface PhoneValidationResult {
  isValid: boolean;
  cleanPhone: string;
  error?: string;
}

export interface GpsTelemetryResult {
  hasGps: boolean;
  latitude: number;
  longitude: number;
  locationUnavailable: boolean;
  accuracyMeters?: number;
  anomalyDetected: boolean;
  anomalyReason?: string;
}

export class CallComplianceAgentsService {
  /**
   * AGENT 1: PhoneVerificationAgent
   * Enforces mandatory phone number with strict validation (minimum 10 digits).
   */
  static verifyMandatoryPhone(phoneInput: unknown): PhoneValidationResult {
    if (!phoneInput || typeof phoneInput !== "string") {
      return {
        isValid: false,
        cleanPhone: "",
        error: "Doctor/Chemist contact phone number is mandatory for all calls.",
      };
    }

    const trimmed = phoneInput.trim();
    const digitsOnly = trimmed.replace(/\D/g, "");

    // Must have at least 10 digits (Standard mobile number)
    if (digitsOnly.length < 10) {
      return {
        isValid: false,
        cleanPhone: digitsOnly,
        error: "Phone number must contain at least 10 digits.",
      };
    }

    // Format clean standard (10 digits or with country code)
    const formatted = digitsOnly.length === 10 ? digitsOnly : digitsOnly.slice(-10);

    return {
      isValid: true,
      cleanPhone: formatted,
    };
  }

  /**
   * AGENT 2: SilentGpsTelemetryAgent
   * Silently validates and captures background GPS coordinates for admin records.
   * If GPS is unavailable or disabled, gracefully marks locationUnavailable without blocking MR.
   */
  static processSilentGpsTelemetry(params: {
    latitude?: number | string | null;
    longitude?: number | string | null;
    accuracy?: number | string | null;
  }): GpsTelemetryResult {
    const lat = params.latitude !== undefined && params.latitude !== null ? Number(params.latitude) : 0;
    const lon = params.longitude !== undefined && params.longitude !== null ? Number(params.longitude) : 0;
    const accuracy = params.accuracy !== undefined && params.accuracy !== null ? Number(params.accuracy) : undefined;

    // Check if coordinates are valid non-zero geo coordinates
    const isValidCoordinate = !Number.isNaN(lat) && !Number.isNaN(lon) && (lat !== 0 || lon !== 0);

    if (!isValidCoordinate) {
      return {
        hasGps: false,
        latitude: 0,
        longitude: 0,
        locationUnavailable: true,
        anomalyDetected: false,
      };
    }

    // Basic coordinate bounds check
    const inBounds = lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180;
    if (!inBounds) {
      return {
        hasGps: false,
        latitude: 0,
        longitude: 0,
        locationUnavailable: true,
        anomalyDetected: true,
        anomalyReason: "GPS coordinates out of valid geographic bounds",
      };
    }

    return {
      hasGps: true,
      latitude: lat,
      longitude: lon,
      locationUnavailable: false,
      accuracyMeters: accuracy,
      anomalyDetected: false,
    };
  }

  /**
   * AGENT 3: EntityContactSyncAgent
   * Synchronizes verified phone number to Doctor (mobile, whatsApp) or Chemist (mobile).
   * Runs in background without blocking call logging flow.
   */
  static async syncEntityContactNumber(params: {
    doctorId?: string | null;
    chemistId?: string | null;
    phone: string;
  }): Promise<{ updated: boolean; targetType: "DOCTOR" | "CHEMIST" | "NONE" }> {
    const { doctorId, chemistId, phone } = params;
    if (!phone) return { updated: false, targetType: "NONE" };

    try {
      if (doctorId) {
        await db.doctor.update({
          where: { id: doctorId },
          data: {
            mobile: phone,
            whatsApp: phone,
          },
        });
        return { updated: true, targetType: "DOCTOR" };
      }

      if (chemistId) {
        await db.chemist.update({
          where: { id: chemistId },
          data: {
            mobile: phone,
          },
        });
        return { updated: true, targetType: "CHEMIST" };
      }
    } catch (err) {
      console.error("[EntityContactSyncAgent] Error synchronizing contact phone:", err);
    }

    return { updated: false, targetType: "NONE" };
  }

  /**
   * AGENT 4: AdminComplianceAuditAgent
   * Assembles silent GPS metadata and verified contact info for admin inspection.
   */
  static formatAdminAuditLog(visit: {
    id: string;
    latitude: number;
    longitude: number;
    locationUnavailable: boolean;
    doctor?: { fullName: string; mobile?: string | null } | null;
    chemist?: { name: string; mobile?: string | null } | null;
  }) {
    const contactNumber = visit.doctor?.mobile || visit.chemist?.mobile || "Missing";
    const hasGps = !visit.locationUnavailable && (visit.latitude !== 0 || visit.longitude !== 0);

    return {
      visitId: visit.id,
      contactNumber,
      hasGps,
      coordinates: hasGps ? `${visit.latitude.toFixed(5)}, ${visit.longitude.toFixed(5)}` : "Not Captured / Off",
      googleMapsUrl: hasGps ? `https://www.google.com/maps?q=${visit.latitude},${visit.longitude}` : null,
      adminAuditStatus: hasGps ? "GPS_VERIFIED" : "MANUAL_CHECKOUT_NO_GPS",
    };
  }
}
