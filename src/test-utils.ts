/**
 * Test utilities for component testing
 */
import React from 'react';
import { render } from '@testing-library/react';

// Mock for next-auth/react
export const mockSession = (session: { user?: { name?: string; email?: string; id?: string } } | null = null) => {
  const useSession = jest.fn(() => ({
    data: session,
    status: session ? 'authenticated' : 'unauthenticated',
  }));
  
  const signOut = jest.fn(() => Promise.resolve());
  const signIn = jest.fn(() => Promise.resolve());
  
  return { useSession, signOut, signIn };
};

// Mock for next/navigation
export const mockRouter = () => {
  const push = jest.fn();
  const replace = jest.fn();
  const back = jest.fn();
  const forward = jest.fn();
  const refresh = jest.fn();
  const prefetch = jest.fn(() => Promise.resolve());
  
  return {
    push,
    replace,
    back,
    forward,
    refresh,
    prefetch,
  };
};

// Mock for react-i18next
export const mockTranslation = () => {
  const t = (key: string, defaultValue?: string) => defaultValue || key;
  const i18n = {
    language: 'en',
    changeLanguage: jest.fn(),
  };
  
  return { t, i18n };
};

// Custom render function with common providers mocked
export const renderWithProviders = (
  ui: React.ReactElement,
  _options?: { session?: { user?: { name?: string; email?: string; id?: string } } | null }
) => {
  return render(ui);
};

// Helper to create mock files
export const createMockFile = (name: string, size: number, type: string): File => {
  const content = new Array(size).fill('a').join('');
  return new File([content], name, { type });
};

// Helper to wait for async updates
export const waitForNextUpdate = () => new Promise(resolve => setTimeout(resolve, 0));
