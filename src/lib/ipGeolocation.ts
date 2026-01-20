/**
 * IP Geolocation utility
 * Uses ip-api.com for free IP geolocation lookups
 * Rate limit: 45 requests/minute for non-commercial use
 */

export interface IpLocation {
  country: string;
  countryCode: string;
  region: string;
  regionName: string;
  city: string;
  zip: string;
  lat: number;
  lon: number;
  timezone: string;
  isp: string;
  org: string;
  as: string;
  query: string;
}

export interface IpLocationError {
  error: string;
  message: string;
}

/**
 * Fetch geolocation data for an IP address
 * @param ip - IP address to lookup
 * @returns Location data or null if lookup fails
 */
export async function getIpLocation(ip: string | null): Promise<IpLocation | null> {
  if (!ip) {
    return null;
  }

  // Skip private/local IPs
  if (isPrivateIp(ip)) {
    return null;
  }

  try {
    const response = await fetch(`https://ip-api.com/json/${ip}?fields=status,message,country,countryCode,region,regionName,city,zip,lat,lon,timezone,isp,org,as,query`, {
      headers: {
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      console.error(`IP geolocation API error: ${response.status}`);
      return null;
    }

    const data = await response.json();

    if (data.status === 'fail') {
      console.error(`IP geolocation failed: ${data.message}`);
      return null;
    }

    return data as IpLocation;
  } catch (error) {
    console.error('Error fetching IP geolocation:', error);
    return null;
  }
}

/**
 * Check if an IP address is private/local
 * @param ip - IP address to check
 * @returns true if IP is private/local
 */
function isPrivateIp(ip: string): boolean {
  // IPv4 private ranges
  const privateRanges = [
    /^10\./,                    // 10.0.0.0/8
    /^172\.(1[6-9]|2[0-9]|3[0-1])\./, // 172.16.0.0/12
    /^192\.168\./,              // 192.168.0.0/16
    /^127\./,                   // 127.0.0.0/8 (loopback)
    /^169\.254\./,              // 169.254.0.0/16 (link-local)
    /^::1$/,                    // IPv6 loopback
    /^fe80:/,                   // IPv6 link-local
    /^fc00:/,                   // IPv6 unique local
    /^fd00:/,                   // IPv6 unique local
  ];

  return privateRanges.some(range => range.test(ip));
}

/**
 * Format location data for display
 * @param location - Location data from API
 * @returns Formatted location string
 */
export function formatLocation(location: IpLocation | null): string {
  if (!location) {
    return '-';
  }

  const parts = [];
  
  if (location.city) {
    parts.push(location.city);
  }
  
  if (location.regionName && location.regionName !== location.city) {
    parts.push(location.regionName);
  }
  
  if (location.country) {
    parts.push(location.country);
  }

  return parts.join(', ') || '-';
}

/**
 * Get country flag emoji from country code
 * @param countryCode - ISO 3166-1 alpha-2 country code
 * @returns Flag emoji or empty string
 */
export function getCountryFlag(countryCode: string | null): string {
  if (!countryCode || countryCode.length !== 2) {
    return '';
  }

  // Convert country code to regional indicator symbols
  const codePoints = countryCode
    .toUpperCase()
    .split('')
    .map(char => 127397 + char.charCodeAt(0));
  
  return String.fromCodePoint(...codePoints);
}
