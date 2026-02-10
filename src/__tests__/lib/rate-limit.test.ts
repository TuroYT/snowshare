/**
 * Tests for rate limiting module
 * Note: Tests the rate limiting logic directly without NextRequest
 */
import { checkRateLimit, clearAllRateLimits, resetRateLimit, getRateLimitHeaders } from '@/lib/rate-limit';

// Mock getClientIp
jest.mock('@/lib/getClientIp', () => ({
  getClientIp: jest.fn(() => '192.168.1.1'),
}));

import { getClientIp } from '@/lib/getClientIp';

// Mock request object
const mockRequest = () => ({
  headers: new Map([['x-forwarded-for', '192.168.1.1']]),
  nextUrl: { searchParams: new URLSearchParams() },
});

describe('Rate Limiting', () => {
  beforeEach(() => {
    clearAllRateLimits();
    getClientIp.mockReturnValue('192.168.1.1');
  });

  afterEach(() => {
    clearAllRateLimits();
    jest.clearAllMocks();
  });

  describe('checkRateLimit', () => {
    it('should allow requests within limit', () => {
      const request = mockRequest();
      const options = { maxRequests: 3, windowSeconds: 60 };

      const result1 = checkRateLimit(request, options);
      const result2 = checkRateLimit(request, options);
      const result3 = checkRateLimit(request, options);

      expect(result1.success).toBe(true);
      expect(result2.success).toBe(true);
      expect(result3.success).toBe(true);
      expect(result3.remaining).toBe(0);
    });

    it('should block requests exceeding limit', () => {
      const request = mockRequest();
      const options = { maxRequests: 3, windowSeconds: 60 };

      checkRateLimit(request, options);
      checkRateLimit(request, options);
      checkRateLimit(request, options);
      
      const result4 = checkRateLimit(request, options);

      expect(result4.success).toBe(false);
      expect(result4.remaining).toBe(0);
      expect(result4.error).toBeDefined();
    });

    it('should track different IPs separately', () => {
      const options = { maxRequests: 3, windowSeconds: 60 };

      getClientIp.mockReturnValue('192.168.1.1');
      const request1 = mockRequest();
      checkRateLimit(request1, options);
      checkRateLimit(request1, options);
      checkRateLimit(request1, options);
      
      const ip1Result = checkRateLimit(request1, options);

      getClientIp.mockReturnValue('192.168.1.2');
      const request2 = mockRequest();
      const ip2Result = checkRateLimit(request2, options);

      expect(ip1Result.success).toBe(false);
      expect(ip2Result.success).toBe(true);
    });

    it('should return correct remaining count', () => {
      const request = mockRequest();
      const options = { maxRequests: 3, windowSeconds: 60 };

      const result1 = checkRateLimit(request, options);
      const result2 = checkRateLimit(request, options);

      expect(result1.remaining).toBe(2);
      expect(result2.remaining).toBe(1);
    });

    it('should provide error message when blocked', () => {
      const request = mockRequest();
      const options = { maxRequests: 3, windowSeconds: 60 };

      checkRateLimit(request, options);
      checkRateLimit(request, options);
      checkRateLimit(request, options);
      
      const result = checkRateLimit(request, options);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Too many requests');
    });

    it('should use custom key prefix', () => {
      const request = mockRequest();
      const options1 = { maxRequests: 2, windowSeconds: 60, keyPrefix: 'api1' };
      const options2 = { maxRequests: 2, windowSeconds: 60, keyPrefix: 'api2' };

      checkRateLimit(request, options1);
      checkRateLimit(request, options1);
      
      const result1 = checkRateLimit(request, options1);
      const result2 = checkRateLimit(request, options2);

      expect(result1.success).toBe(false);
      expect(result2.success).toBe(true);
    });
  });

  describe('resetRateLimit', () => {
    it('should reset rate limit for specific IP and prefix', () => {
      const request = mockRequest();
      const options = { maxRequests: 2, windowSeconds: 60, keyPrefix: 'test' };

      checkRateLimit(request, options);
      checkRateLimit(request, options);
      
      let result = checkRateLimit(request, options);
      expect(result.success).toBe(false);

      resetRateLimit('192.168.1.1', 'test');

      result = checkRateLimit(request, options);
      expect(result.success).toBe(true);
    });
  });

  describe('getRateLimitHeaders', () => {
    it('should return rate limit headers', () => {
      const request = mockRequest();
      const options = { maxRequests: 3, windowSeconds: 60 };
      
      const result = checkRateLimit(request, options);
      const headers = getRateLimitHeaders(result);

      expect(headers['X-RateLimit-Limit']).toBe('3');
      expect(headers['X-RateLimit-Remaining']).toBe('2');
      expect(headers['X-RateLimit-Reset']).toBeDefined();
    });

    it('should show zero remaining when blocked', () => {
      const request = mockRequest();
      const options = { maxRequests: 3, windowSeconds: 60 };

      checkRateLimit(request, options);
      checkRateLimit(request, options);
      checkRateLimit(request, options);
      
      const result = checkRateLimit(request, options);
      const headers = getRateLimitHeaders(result);

      expect(headers['X-RateLimit-Remaining']).toBe('0');
    });
  });

  describe('edge cases', () => {
    it('should handle concurrent requests from same IP', () => {
      const request = mockRequest();
      const options = { maxRequests: 3, windowSeconds: 60 };

      const results = Array(5).fill(null).map(() => 
        checkRateLimit(request, options)
      );

      const allowedCount = results.filter(r => r.success).length;
      const blockedCount = results.filter(r => !r.success).length;

      expect(allowedCount).toBe(3);
      expect(blockedCount).toBe(2);
    });

    it('should handle IPv6 addresses', () => {
      getClientIp.mockReturnValue('2001:0db8:85a3:0000:0000:8a2e:0370:7334');
      const request = mockRequest();
      const options = { maxRequests: 3, windowSeconds: 60 };
      
      const result = checkRateLimit(request, options);
      expect(result.success).toBe(true);
    });

    it('should handle different window sizes', () => {
      const request = mockRequest();
      const shortWindow = { maxRequests: 2, windowSeconds: 1 };
      const longWindow = { maxRequests: 10, windowSeconds: 3600 };

      const result1 = checkRateLimit(request, { ...shortWindow, keyPrefix: 'short' });
      const result2 = checkRateLimit(request, { ...longWindow, keyPrefix: 'long' });

      expect(result1.success).toBe(true);
      expect(result2.success).toBe(true);
      expect(result1.limit).toBe(2);
      expect(result2.limit).toBe(10);
    });

    it('should include reset timestamp', () => {
      const request = mockRequest();
      const options = { maxRequests: 5, windowSeconds: 300 };

      const result = checkRateLimit(request, options);
      const now = Math.floor(Date.now() / 1000);

      expect(result.reset).toBeGreaterThan(now);
      expect(result.reset).toBeLessThanOrEqual(now + 300);
    });
  });

  describe('clearAllRateLimits', () => {
    it('should clear all rate limit entries', () => {
      const request = mockRequest();
      const options = { maxRequests: 2, windowSeconds: 60 };

      checkRateLimit(request, options);
      checkRateLimit(request, options);
      
      let result = checkRateLimit(request, options);
      expect(result.success).toBe(false);

      clearAllRateLimits();

      result = checkRateLimit(request, options);
      expect(result.success).toBe(true);
      expect(result.remaining).toBe(1);
    });
  });
});
