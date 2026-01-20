/**
 * IP Address management utility
 * Handles finding or creating IP address records with geolocation data
 */

import { prisma } from "@/lib/prisma";
import { getIpLocation } from "@/lib/ipGeolocation";

/**
 * Find or create an IP address record with location data
 * @param ip - IP address string
 * @returns IP address record ID, or null if IP is invalid
 */
export async function findOrCreateIpAddress(ip: string | null): Promise<string | null> {
  if (!ip || ip === "unknown") {
    return null;
  }

  try {
    // Check if IP already exists
    let ipRecord = await prisma.ipAddress.findUnique({
      where: { ip },
    });

    if (ipRecord) {
      // Return existing record
      return ipRecord.id;
    }

    // Fetch location data for new IP
    let ipLocation = null;
    try {
      ipLocation = await getIpLocation(ip);
    } catch (error) {
      console.error('Failed to fetch IP location for IP:', ip, error);
      // Continue with null location - IP record creation should not fail
    }

    // Create new IP record
    ipRecord = await prisma.ipAddress.create({
      data: {
        ip,
        country: ipLocation?.country || null,
        countryCode: ipLocation?.countryCode || null,
        region: ipLocation?.regionName || null,
        city: ipLocation?.city || null,
      },
    });

    return ipRecord.id;
  } catch (error) {
    console.error('Error finding or creating IP address record for IP:', ip, error);
    return null;
  }
}
