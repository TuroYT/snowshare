/**
 * Tests for useAuth hook
 */
import { renderHook } from '@testing-library/react';
import { useAuth, useRequireAuth } from '@/hooks/useAuth';

// Mock next-auth/react
const mockPush = jest.fn();

jest.mock('next-auth/react', () => ({
  useSession: jest.fn(),
}));

jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
  }),
}));

import { useSession } from 'next-auth/react';

const mockUseSession = useSession as jest.Mock;

describe('useAuth', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('when not authenticated', () => {
    beforeEach(() => {
      mockUseSession.mockReturnValue({
        data: null,
        status: 'unauthenticated',
      });
    });

    it('should return unauthenticated state', () => {
      const { result } = renderHook(() => useAuth());

      expect(result.current.isAuthenticated).toBe(false);
      expect(result.current.isLoading).toBe(false);
      expect(result.current.session).toBeNull();
      expect(result.current.user).toBeUndefined();
      expect(result.current.status).toBe('unauthenticated');
    });

    it('should not redirect when requireAuth is false', () => {
      renderHook(() => useAuth(false));

      expect(mockPush).not.toHaveBeenCalled();
    });

    it('should redirect to signin when requireAuth is true', () => {
      renderHook(() => useAuth(true));

      expect(mockPush).toHaveBeenCalledWith('/auth/signin');
    });
  });

  describe('when authenticated', () => {
    const mockSession = {
      user: {
        id: 'user-123',
        name: 'Test User',
        email: 'test@example.com',
      },
    };

    beforeEach(() => {
      mockUseSession.mockReturnValue({
        data: mockSession,
        status: 'authenticated',
      });
    });

    it('should return authenticated state', () => {
      const { result } = renderHook(() => useAuth());

      expect(result.current.isAuthenticated).toBe(true);
      expect(result.current.isLoading).toBe(false);
      expect(result.current.session).toEqual(mockSession);
      expect(result.current.user).toEqual(mockSession.user);
      expect(result.current.status).toBe('authenticated');
    });

    it('should not redirect when authenticated', () => {
      renderHook(() => useAuth(true));

      expect(mockPush).not.toHaveBeenCalled();
    });
  });

  describe('when loading', () => {
    beforeEach(() => {
      mockUseSession.mockReturnValue({
        data: null,
        status: 'loading',
      });
    });

    it('should return loading state', () => {
      const { result } = renderHook(() => useAuth());

      expect(result.current.isAuthenticated).toBe(false);
      expect(result.current.isLoading).toBe(true);
      expect(result.current.session).toBeNull();
      expect(result.current.status).toBe('loading');
    });

    it('should not redirect while loading', () => {
      renderHook(() => useAuth(true));

      expect(mockPush).not.toHaveBeenCalled();
    });
  });
});

describe('useRequireAuth', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should redirect when unauthenticated', () => {
    mockUseSession.mockReturnValue({
      data: null,
      status: 'unauthenticated',
    });

    renderHook(() => useRequireAuth());

    expect(mockPush).toHaveBeenCalledWith('/auth/signin');
  });

  it('should not redirect when authenticated', () => {
    mockUseSession.mockReturnValue({
      data: { user: { id: '123' } },
      status: 'authenticated',
    });

    renderHook(() => useRequireAuth());

    expect(mockPush).not.toHaveBeenCalled();
  });

  it('should return same values as useAuth with requireAuth=true', () => {
    const mockSession = {
      user: { id: 'user-456', name: 'Another User' },
    };
    
    mockUseSession.mockReturnValue({
      data: mockSession,
      status: 'authenticated',
    });

    const { result } = renderHook(() => useRequireAuth());

    expect(result.current.isAuthenticated).toBe(true);
    expect(result.current.session).toEqual(mockSession);
    expect(result.current.user).toEqual(mockSession.user);
  });
});
