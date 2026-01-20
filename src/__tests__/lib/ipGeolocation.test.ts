/**
 * Tests for the ipGeolocation module
 */
import { formatLocation, getCountryFlag, isPrivateIp } from '@/lib/ipGeolocation';
import type { IpLocation } from '@/lib/ipGeolocation';

describe('ipGeolocation', () => {
  describe('formatLocation', () => {
    it('should format complete location data', () => {
      const location: IpLocation = {
        country: 'United States',
        countryCode: 'US',
        regionName: 'California',
        city: 'Mountain View',
      };

      expect(formatLocation(location)).toBe('Mountain View, California, United States');
    });

    it('should handle location without city', () => {
      const location: IpLocation = {
        country: 'France',
        countryCode: 'FR',
        regionName: 'Île-de-France',
        city: '',
      };

      expect(formatLocation(location)).toBe('Île-de-France, France');
    });

    it('should handle location with same city and region', () => {
      const location: IpLocation = {
        country: 'Singapore',
        countryCode: 'SG',
        regionName: 'Singapore',
        city: 'Singapore',
      };

      expect(formatLocation(location)).toBe('Singapore, Singapore');
    });

    it('should handle null location', () => {
      expect(formatLocation(null)).toBe('-');
    });

    it('should handle location with only country', () => {
      const location: IpLocation = {
        country: 'Unknown',
        countryCode: 'XX',
        regionName: '',
        city: '',
      };

      expect(formatLocation(location)).toBe('Unknown');
    });
  });

  describe('getCountryFlag', () => {
    it('should return flag emoji for valid country codes', () => {
      expect(getCountryFlag('US')).toBe('🇺🇸');
      expect(getCountryFlag('FR')).toBe('🇫🇷');
      expect(getCountryFlag('GB')).toBe('🇬🇧');
      expect(getCountryFlag('JP')).toBe('🇯🇵');
      expect(getCountryFlag('DE')).toBe('🇩🇪');
    });

    it('should handle lowercase country codes', () => {
      expect(getCountryFlag('us')).toBe('🇺🇸');
      expect(getCountryFlag('fr')).toBe('🇫🇷');
    });

    it('should return empty string for null', () => {
      expect(getCountryFlag(null)).toBe('');
    });

    it('should return empty string for invalid codes', () => {
      expect(getCountryFlag('')).toBe('');
      expect(getCountryFlag('X')).toBe('');
      expect(getCountryFlag('USA')).toBe('');
      expect(getCountryFlag('123')).toBe('');
    });
  });

  describe('isPrivateIp', () => {
    it('should identify private IPv4 addresses', () => {
      expect(isPrivateIp('10.0.0.1')).toBe(true);
      expect(isPrivateIp('10.255.255.255')).toBe(true);
      expect(isPrivateIp('172.16.0.1')).toBe(true);
      expect(isPrivateIp('172.31.255.255')).toBe(true);
      expect(isPrivateIp('192.168.0.1')).toBe(true);
      expect(isPrivateIp('192.168.255.255')).toBe(true);
    });

    it('should identify loopback addresses', () => {
      expect(isPrivateIp('127.0.0.1')).toBe(true);
      expect(isPrivateIp('127.255.255.255')).toBe(true);
    });

    it('should identify link-local addresses', () => {
      expect(isPrivateIp('169.254.0.1')).toBe(true);
      expect(isPrivateIp('169.254.255.255')).toBe(true);
    });

    it('should identify IPv6 private addresses', () => {
      expect(isPrivateIp('::1')).toBe(true);
      expect(isPrivateIp('fe80::1')).toBe(true);
      expect(isPrivateIp('fc00::1')).toBe(true);
      expect(isPrivateIp('fd00::1')).toBe(true);
    });

    it('should identify public IP addresses', () => {
      expect(isPrivateIp('8.8.8.8')).toBe(false);
      expect(isPrivateIp('1.1.1.1')).toBe(false);
      expect(isPrivateIp('93.184.216.34')).toBe(false);
      expect(isPrivateIp('151.101.1.140')).toBe(false);
    });

    it('should handle edge cases', () => {
      expect(isPrivateIp('172.15.255.255')).toBe(false); // Just before 172.16
      expect(isPrivateIp('172.32.0.0')).toBe(false); // Just after 172.31
      expect(isPrivateIp('192.167.255.255')).toBe(false); // Just before 192.168
      expect(isPrivateIp('192.169.0.0')).toBe(false); // Just after 192.168
    });
  });
});
