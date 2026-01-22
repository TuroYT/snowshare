/**
 * Tests for the ThemeContext module
 */
import '@testing-library/jest-dom';
import { renderHook, act } from '@testing-library/react';
import { ThemeProvider, useTheme } from '@/contexts/ThemeContext';
import React from 'react';

// Mock fetch for refreshSettings
beforeEach(() => {
  global.fetch = jest.fn(() =>
    Promise.resolve({
      ok: true,
      json: () => Promise.resolve({
        settings: {
          primaryColor: '#3B82F6',
          primaryHover: '#2563EB',
          primaryDark: '#1E40AF',
          secondaryColor: '#8B5CF6',
          secondaryHover: '#7C3AED',
          secondaryDark: '#6D28D9',
          backgroundColor: '#111827',
          surfaceColor: '#1F2937',
          textColor: '#F9FAFB',
          textMuted: '#D1D5DB',
          borderColor: '#374151',
        },
      }),
    })
  ) as jest.Mock;
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('ThemeContext', () => {
  beforeEach(() => {
    // Reset document styles
    document.documentElement.style.cssText = '';
  });

  describe('updateTheme with invalid hex colors', () => {
    it('should not crash when given an empty string', async () => {
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <ThemeProvider initialData={{ settings: {} }}>{children}</ThemeProvider>
      );

      const { result } = renderHook(() => useTheme(), { wrapper });

      // Wait for initial load
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 0));
      });

      // This should not crash
      expect(() => {
        act(() => {
          result.current.updateTheme({ primaryColor: '' });
        });
      }).not.toThrow();
    });

    it('should not crash when given undefined', async () => {
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <ThemeProvider initialData={{ settings: {} }}>{children}</ThemeProvider>
      );

      const { result } = renderHook(() => useTheme(), { wrapper });

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 0));
      });

      // This should not crash
      expect(() => {
        act(() => {
          result.current.updateTheme({ primaryColor: undefined as unknown as string });
        });
      }).not.toThrow();
    });

    it('should not crash when given null', async () => {
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <ThemeProvider initialData={{ settings: {} }}>{children}</ThemeProvider>
      );

      const { result } = renderHook(() => useTheme(), { wrapper });

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 0));
      });

      // This should not crash
      expect(() => {
        act(() => {
          result.current.updateTheme({ primaryColor: null as unknown as string });
        });
      }).not.toThrow();
    });

    it('should not crash when given incomplete hex (missing #)', async () => {
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <ThemeProvider initialData={{ settings: {} }}>{children}</ThemeProvider>
      );

      const { result } = renderHook(() => useTheme(), { wrapper });

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 0));
      });

      // This should not crash
      expect(() => {
        act(() => {
          result.current.updateTheme({ primaryColor: '#' });
        });
      }).not.toThrow();
    });

    it('should not crash when given incomplete hex (partial)', async () => {
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <ThemeProvider initialData={{ settings: {} }}>{children}</ThemeProvider>
      );

      const { result } = renderHook(() => useTheme(), { wrapper });

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 0));
      });

      // This should not crash
      expect(() => {
        act(() => {
          result.current.updateTheme({ primaryColor: '#3B8' });
        });
      }).not.toThrow();
    });

    it('should not crash when given invalid hex characters', async () => {
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <ThemeProvider initialData={{ settings: {} }}>{children}</ThemeProvider>
      );

      const { result } = renderHook(() => useTheme(), { wrapper });

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 0));
      });

      // This should not crash
      expect(() => {
        act(() => {
          result.current.updateTheme({ primaryColor: '#GGGGGG' });
        });
      }).not.toThrow();
    });

    it('should accept valid 6-digit hex colors', async () => {
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <ThemeProvider initialData={{ settings: {} }}>{children}</ThemeProvider>
      );

      const { result } = renderHook(() => useTheme(), { wrapper });

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 0));
      });

      act(() => {
        result.current.updateTheme({ primaryColor: '#FF0000' });
      });

      expect(result.current.colors.primaryColor).toBe('#FF0000');
    });

    it('should accept valid 3-digit hex colors', async () => {
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <ThemeProvider initialData={{ settings: {} }}>{children}</ThemeProvider>
      );

      const { result } = renderHook(() => useTheme(), { wrapper });

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 0));
      });

      act(() => {
        result.current.updateTheme({ primaryColor: '#F00' });
      });

      expect(result.current.colors.primaryColor).toBe('#F00');
    });

    it('should not update colors when given invalid hex', async () => {
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <ThemeProvider initialData={{ settings: {} }}>{children}</ThemeProvider>
      );

      const { result } = renderHook(() => useTheme(), { wrapper });

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 0));
      });
      
      const initialColor = result.current.colors.primaryColor;

      act(() => {
        result.current.updateTheme({ primaryColor: '' });
      });

      // Color should remain unchanged
      expect(result.current.colors.primaryColor).toBe(initialColor);
    });

    it('should handle multiple color updates with mixed valid and invalid values', async () => {
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <ThemeProvider initialData={{ settings: {} }}>{children}</ThemeProvider>
      );

      const { result } = renderHook(() => useTheme(), { wrapper });

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 0));
      });

      act(() => {
        result.current.updateTheme({
          primaryColor: '#FF0000',
          secondaryColor: '', // Invalid
          backgroundColor: '#000000',
        });
      });

      expect(result.current.colors.primaryColor).toBe('#FF0000');
      expect(result.current.colors.backgroundColor).toBe('#000000');
      // secondaryColor should remain at default
      expect(result.current.colors.secondaryColor).toBeTruthy();
    });
  });
});
