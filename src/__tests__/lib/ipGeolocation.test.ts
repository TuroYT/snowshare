/**
 * Tests for the ipGeolocation module
 */
import { formatLocation, getCountryFlag } from '@/lib/ipGeolocation';
import type { IpLocation } from '@/lib/ipGeolocation';

describe('ipGeolocation', () => {
  describe('formatLocation', () => {
    it('should format complete location data', () => {
      const location: IpLocation = {
        country: 'United States',
        countryCode: 'US',
        region: 'CA',
        regionName: 'California',
        city: 'Mountain View',
        zip: '94043',
        lat: 37.386,
        lon: -122.0838,
        timezone: 'America/Los_Angeles',
        isp: 'Google LLC',
        org: 'Google Cloud',
        as: 'AS15169 Google LLC',
        query: '8.8.8.8',
      };

      expect(formatLocation(location)).toBe('Mountain View, California, United States');
    });

    it('should handle location without city', () => {
      const location: IpLocation = {
        country: 'France',
        countryCode: 'FR',
        region: 'IDF',
        regionName: 'Île-de-France',
        city: '',
        zip: '',
        lat: 48.8566,
        lon: 2.3522,
        timezone: 'Europe/Paris',
        isp: 'Orange',
        org: 'Orange',
        as: 'AS3215 Orange S.A.',
        query: '8.8.4.4',
      };

      expect(formatLocation(location)).toBe('Île-de-France, France');
    });

    it('should handle location with same city and region', () => {
      const location: IpLocation = {
        country: 'Singapore',
        countryCode: 'SG',
        region: '01',
        regionName: 'Singapore',
        city: 'Singapore',
        zip: '',
        lat: 1.2897,
        lon: 103.8501,
        timezone: 'Asia/Singapore',
        isp: 'Singtel',
        org: 'Singtel',
        as: 'AS3758 SingNet',
        query: '1.1.1.1',
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
        region: '',
        regionName: '',
        city: '',
        zip: '',
        lat: 0,
        lon: 0,
        timezone: '',
        isp: '',
        org: '',
        as: '',
        query: '192.0.2.1',
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
});
