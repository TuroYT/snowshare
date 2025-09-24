import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import Navigation from '@/components/Navigation';
import { useSession, signOut } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useTranslation } from 'react-i18next';

// Mock dependencies
jest.mock('next-auth/react');
jest.mock('next/navigation', () => ({
  useRouter: jest.fn(),
}));
jest.mock('react-i18next', () => ({
  useTranslation: jest.fn(),
}));

const mockUseSession = useSession as jest.MockedFunction<typeof useSession>;
const mockSignOut = signOut as jest.MockedFunction<typeof signOut>;
const mockUseRouter = useRouter as jest.MockedFunction<typeof useRouter>;
const mockUseTranslation = useTranslation as jest.MockedFunction<typeof useTranslation>;

// Mock localStorage
const localStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
};
Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
});

// Mock router
const mockPush = jest.fn();

describe('Navigation Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorageMock.setItem.mockClear();
    
    mockUseRouter.mockReturnValue({
      push: mockPush,
      back: jest.fn(),
      forward: jest.fn(),
      refresh: jest.fn(),
      replace: jest.fn(),
      prefetch: jest.fn(),
    });

    mockUseTranslation.mockReturnValue({
      t: (key: string, defaultValue?: string) => {
        const translations: Record<string, string> = {
          'loading': 'Loading...',
          'nav.sign_in': 'Sign In',
          'nav.sign_up': 'Sign Up',
          'nav.sign_out': 'Sign Out',
          'nav.hello': 'Hello, {{email}}',
          'nav.open_menu': 'Open menu',
          'nav.close_menu': 'Close menu',
        };
        if (key === 'nav.hello' && defaultValue) {
          return defaultValue.replace('{{email}}', 'test@example.com');
        }
        return translations[key] || defaultValue || key;
      },
      i18n: {
        changeLanguage: jest.fn(),
        language: 'en',
      },
    });
  });

  describe('when loading', () => {
    it('shows loading state', () => {
      mockUseSession.mockReturnValue({
        data: null,
        status: 'loading',
        update: jest.fn(),
      });

      render(<Navigation />);
      expect(screen.getByText('Loading...')).toBeInTheDocument();
    });
  });

  describe('when user is not authenticated', () => {
    beforeEach(() => {
      mockUseSession.mockReturnValue({
        data: null,
        status: 'unauthenticated',
        update: jest.fn(),
      });
    });

    it('renders basic navigation elements', () => {
      render(<Navigation />);
      
      expect(screen.getByAltText('SnowShare Logo')).toBeInTheDocument();
      expect(screen.getByText('SnowShare')).toBeInTheDocument();
      expect(screen.getByText('Sign In')).toBeInTheDocument();
      expect(screen.getByText('Sign Up')).toBeInTheDocument();
    });

    it('renders language selector', () => {
      render(<Navigation />);
      
      const languageSelect = screen.getByDisplayValue('EN');
      expect(languageSelect).toBeInTheDocument();
      expect(languageSelect.tagName).toBe('SELECT');
    });

    it('toggles mobile menu', () => {
      render(<Navigation />);
      
      const mobileMenuButton = screen.getByLabelText('Open menu');
      expect(mobileMenuButton).toBeInTheDocument();
      
      fireEvent.click(mobileMenuButton);
      
      // Check that menu button label changes
      expect(screen.getByLabelText('Close menu')).toBeInTheDocument();
    });
  });

  describe('when user is authenticated', () => {
    beforeEach(() => {
      mockUseSession.mockReturnValue({
        data: {
          user: { id: '1', email: 'test@example.com' },
          expires: '2024-01-01',
        },
        status: 'authenticated',
        update: jest.fn(),
      });
    });

    it('renders user greeting and sign out button', () => {
      render(<Navigation />);
      
      expect(screen.getByText('Hello, test@example.com')).toBeInTheDocument();
      expect(screen.getByText('Sign Out')).toBeInTheDocument();
      expect(screen.queryByText('Sign In')).not.toBeInTheDocument();
      expect(screen.queryByText('Sign Up')).not.toBeInTheDocument();
    });

    it('handles sign out', async () => {
      mockSignOut.mockResolvedValue(undefined);
      
      render(<Navigation />);
      
      const signOutButton = screen.getByText('Sign Out');
      fireEvent.click(signOutButton);
      
      expect(mockSignOut).toHaveBeenCalledWith({ redirect: false });
      expect(mockPush).toHaveBeenCalledWith('/');
    });
  });

  describe('language switching', () => {
    beforeEach(() => {
      mockUseSession.mockReturnValue({
        data: null,
        status: 'unauthenticated',
        update: jest.fn(),
      });
    });

    it('changes language and saves to localStorage', () => {
      const mockChangeLanguage = jest.fn();
      mockUseTranslation.mockReturnValue({
        t: jest.fn((key) => key),
        i18n: {
          changeLanguage: mockChangeLanguage,
          language: 'en',
        },
      });

      render(<Navigation />);
      
      const languageSelect = screen.getByDisplayValue('EN');
      fireEvent.change(languageSelect, { target: { value: 'fr' } });
      
      expect(mockChangeLanguage).toHaveBeenCalledWith('fr');
      expect(localStorageMock.setItem).toHaveBeenCalledWith('i18nextLng', 'fr');
    });

    it('shows current language in selector', () => {
      mockUseTranslation.mockReturnValue({
        t: jest.fn((key) => key),
        i18n: {
          changeLanguage: jest.fn(),
          language: 'fr',
        },
      });

      render(<Navigation />);
      
      expect(screen.getByDisplayValue('FR')).toBeInTheDocument();
    });
  });
});