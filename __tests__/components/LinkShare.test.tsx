import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import LinkShare from '@/components/LinkShare';
import { useAuth } from '@/hooks/useAuth';
import { useTranslation } from 'react-i18next';

// Mock dependencies
jest.mock('@/hooks/useAuth');
jest.mock('react-i18next', () => ({
  useTranslation: jest.fn(),
}));
jest.mock('qrcode.react', () => ({
  QRCodeSVG: ({ value }: { value: string }) => <div data-testid="qr-code">{value}</div>
}));

const mockUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;
const mockUseTranslation = useTranslation as jest.MockedFunction<typeof useTranslation>;

// Mock fetch
global.fetch = jest.fn();

// Mock clipboard API
Object.assign(navigator, {
  clipboard: {
    writeText: jest.fn(),
  },
});

// Helper functions for mocks
const createMockAuthResponse = (isAuthenticated: boolean) => ({
  session: isAuthenticated ? { 
    user: { id: '1', name: 'Test User', email: 'test@example.com' },
    expires: '2025-12-31T23:59:59.999Z'
  } : null,
  status: isAuthenticated ? 'authenticated' as const : 'unauthenticated' as const,
  isLoading: false,
  isAuthenticated,
  user: isAuthenticated ? { id: '1', name: 'Test User', email: 'test@example.com' } : undefined,
});

const createMockTranslation = () => ({
  t: (key: string, defaultValue?: string, options?: Record<string, unknown>) => {
    const translations: Record<string, string> = {
      'linkshare.url_label': 'URL to share',
      'linkshare.url_placeholder': 'https://example.com',
      'linkshare.url_error': 'Invalid URL format',
      'linkshare.expiration_label': 'Expiration',
      'linkshare.advanced': 'Advanced Settings',
      'linkshare.custom_slug': 'Custom Slug',
      'linkshare.password_label': 'Password',
      'linkshare.password_placeholder': 'Optional password',
      'linkshare.slug_hint': 'Leave empty for auto-generated slug',
      'linkshare.submit': 'Create Link',
      'linkshare.creating': 'Creating link...',
      'linkshare.error_title': 'Error',
      'linkshare.success_title': 'Success!',
      'linkshare.success_message': 'Your link has been created successfully!',
      'linkshare.days': 'days',
      'linkshare.copy_link': 'Copy Link',
      'linkshare.link_copied': 'Link copied!',
      'linkshare.never_expires': 'Never expires',
      'linkshare.duration_never': 'This link will never expire',
      'linkshare.duration_in_1_day': 'This link will expire in 1 day',
      'linkshare.duration_in_x_days': 'This link will expire in {{count}} days',
      'linkshare.duration_in_1_week': 'This link will expire in 1 week',
      'linkshare.duration_in_x_weeks': 'This link will expire in {{count}} weeks',
      'linkshare.duration_in_1_month': 'This link will expire in 1 month',
      'linkshare.duration_in_x_months': 'This link will expire in {{count}} months',
    };
    
    // Handle interpolation with named parameters
    if (options && typeof options === 'object') {
      let result = translations[key] || defaultValue || key;
      for (const [param, value] of Object.entries(options)) {
        if (typeof value === 'number' || typeof value === 'string') {
          result = result.replace(`{{${param}}}`, String(value));
        }
      }
      return result;
    }
    
    return translations[key] || defaultValue || key;
  },
  i18n: {
    changeLanguage: jest.fn(),
    language: 'en',
  },
});

describe('LinkShare Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseTranslation.mockReturnValue(createMockTranslation());
  });

  describe('Basic rendering', () => {
    it('renders all form elements for unauthenticated user', () => {
      mockUseAuth.mockReturnValue(createMockAuthResponse(false));
      
      render(<LinkShare />);
      
      expect(screen.getByText('URL to share')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('https://example.com')).toBeInTheDocument();
      expect(screen.getByText('Expiration')).toBeInTheDocument();
      expect(screen.getByText('Advanced Settings')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Create Link' })).toBeInTheDocument();
    });

    it('shows different expiration defaults for authenticated vs unauthenticated users', () => {
      // Test unauthenticated user
      mockUseAuth.mockReturnValue(createMockAuthResponse(false));
      
      const { rerender } = render(<LinkShare />);
      
      expect(screen.getByDisplayValue('7')).toBeInTheDocument(); // MAX_DAYS_ANON = 7
      
      // Test authenticated user
      mockUseAuth.mockReturnValue(createMockAuthResponse(true));
      
      rerender(<LinkShare />);
      
      expect(screen.getByDisplayValue('30')).toBeInTheDocument(); // Default 30 days for auth users
    });
  });

  describe('URL validation', () => {
    it('validates URL format', () => {
      mockUseAuth.mockReturnValue(createMockAuthResponse(false));
      
      render(<LinkShare />);
      
      const urlInput = screen.getByPlaceholderText('https://example.com');
      
      // Enter invalid URL
      fireEvent.change(urlInput, { target: { value: 'not-a-url' } });
      
      expect(screen.getByText('Invalid URL format')).toBeInTheDocument();
    });

    it('accepts valid URLs', () => {
      mockUseAuth.mockReturnValue(createMockAuthResponse(false));
      
      render(<LinkShare />);
      
      const urlInput = screen.getByPlaceholderText('https://example.com');
      
      // Enter valid URL
      fireEvent.change(urlInput, { target: { value: 'https://google.com' } });
      
      expect(screen.queryByText('Invalid URL format')).not.toBeInTheDocument();
      expect(urlInput).toHaveValue('https://google.com');
    });

    it('clears error when URL becomes valid', () => {
      mockUseAuth.mockReturnValue(createMockAuthResponse(false));
      
      render(<LinkShare />);
      
      const urlInput = screen.getByPlaceholderText('https://example.com');
      
      // Enter invalid URL first
      fireEvent.change(urlInput, { target: { value: 'invalid' } });
      expect(screen.getByText('Invalid URL format')).toBeInTheDocument();
      
      // Fix the URL
      fireEvent.change(urlInput, { target: { value: 'https://example.com' } });
      expect(screen.queryByText('Invalid URL format')).not.toBeInTheDocument();
    });
  });

  describe('Advanced settings', () => {
    it('shows advanced settings when expanded', () => {
      mockUseAuth.mockReturnValue(createMockAuthResponse(false));
      
      render(<LinkShare />);
      
      const advancedButton = screen.getByText('Advanced Settings');
      fireEvent.click(advancedButton);
      
      expect(screen.getByText('Custom Slug')).toBeInTheDocument();
      expect(screen.getByText('Password')).toBeInTheDocument();
    });

    it('handles custom slug input', () => {
      mockUseAuth.mockReturnValue(createMockAuthResponse(false));
      
      render(<LinkShare />);
      
      const advancedButton = screen.getByText('Advanced Settings');
      fireEvent.click(advancedButton);
      
      const slugInput = screen.getByPlaceholderText(/Leave empty for auto-generated slug/);
      fireEvent.change(slugInput, { target: { value: 'my-custom-link' } });
      
      expect(slugInput).toHaveValue('my-custom-link');
    });

    it('handles password input', () => {
      mockUseAuth.mockReturnValue(createMockAuthResponse(false));
      
      render(<LinkShare />);
      
      const advancedButton = screen.getByText('Advanced Settings');
      fireEvent.click(advancedButton);
      
      const passwordInput = screen.getByPlaceholderText(/Optional password/);
      fireEvent.change(passwordInput, { target: { value: 'secret123' } });
      
      expect(passwordInput).toHaveValue('secret123');
    });
  });

  describe('Never expires option', () => {
    it('shows never expires option for authenticated users', () => {
      mockUseAuth.mockReturnValue(createMockAuthResponse(true));
      
      render(<LinkShare />);
      
      expect(screen.getByText(/Never expires/)).toBeInTheDocument();
    });

    it('does not show never expires option for unauthenticated users', () => {
      mockUseAuth.mockReturnValue(createMockAuthResponse(false));
      
      render(<LinkShare />);
      
      expect(screen.queryByText(/Never expires/)).not.toBeInTheDocument();
    });

    it('toggles never expires checkbox', () => {
      mockUseAuth.mockReturnValue(createMockAuthResponse(true));
      
      render(<LinkShare />);
      
      const neverExpiresCheckbox = screen.getByRole('checkbox');
      fireEvent.click(neverExpiresCheckbox);
      
      expect(neverExpiresCheckbox).toBeChecked();
    });
  });

  describe('Form submission', () => {
    it('prevents submission with empty URL', () => {
      mockUseAuth.mockReturnValue(createMockAuthResponse(false));
      
      render(<LinkShare />);
      
      const submitButton = screen.getByRole('button', { name: 'Create Link' });
      fireEvent.click(submitButton);
      
      // Should not make any fetch calls
      expect(fetch).not.toHaveBeenCalled();
    });

    it('prevents submission with invalid URL', () => {
      mockUseAuth.mockReturnValue(createMockAuthResponse(false));
      
      render(<LinkShare />);
      
      const urlInput = screen.getByPlaceholderText('https://example.com');
      fireEvent.change(urlInput, { target: { value: 'invalid-url' } });
      
      const submitButton = screen.getByRole('button', { name: 'Create Link' });
      fireEvent.click(submitButton);
      
      // Should not make any fetch calls
      expect(fetch).not.toHaveBeenCalled();
    });

    it('handles successful link creation', async () => {
      const mockFetch = fetch as jest.MockedFunction<typeof fetch>;
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          share: {
            linkShare: {
              slug: 'test-slug'
            }
          }
        }),
      } as Response);

      mockUseAuth.mockReturnValue(createMockAuthResponse(false));
      
      render(<LinkShare />);
      
      const urlInput = screen.getByPlaceholderText('https://example.com');
      fireEvent.change(urlInput, { target: { value: 'https://google.com' } });
      
      const submitButton = screen.getByRole('button', { name: 'Create Link' });
      fireEvent.click(submitButton);
      
      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith('/api/shares', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: expect.stringContaining('"type":"LINK"')
        });
      });
    });

    it('handles error response', async () => {
      const mockFetch = fetch as jest.MockedFunction<typeof fetch>;
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: async () => ({
          error: 'Test error message'
        }),
      } as Response);

      mockUseAuth.mockReturnValue(createMockAuthResponse(false));
      
      render(<LinkShare />);
      
      const urlInput = screen.getByPlaceholderText('https://example.com');
      fireEvent.change(urlInput, { target: { value: 'https://google.com' } });
      
      const submitButton = screen.getByRole('button', { name: 'Create Link' });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText('Test error message')).toBeInTheDocument();
      });
    });

    it('shows loading state during submission', async () => {
      const mockFetch = fetch as jest.MockedFunction<typeof fetch>;
      // Simulate a delayed response
      mockFetch.mockImplementation(() => 
        new Promise(resolve => setTimeout(() => resolve({
          ok: true,
          json: async () => ({ share: { linkShare: { slug: 'test' } } })
        } as Response), 100))
      );

      mockUseAuth.mockReturnValue(createMockAuthResponse(false));
      
      render(<LinkShare />);
      
      const urlInput = screen.getByPlaceholderText('https://example.com');
      fireEvent.change(urlInput, { target: { value: 'https://google.com' } });
      
      const submitButton = screen.getByRole('button', { name: 'Create Link' });
      fireEvent.click(submitButton);

      // Should show loading state
      expect(screen.getByText('Creating link...')).toBeInTheDocument();
      expect(submitButton).toBeDisabled();
    });
  });

  describe('Success state', () => {
    it('shows success message and QR code after successful submission', async () => {
      const mockFetch = fetch as jest.MockedFunction<typeof fetch>;
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          share: {
            linkShare: {
              slug: 'test-slug'
            }
          }
        }),
      } as Response);

      mockUseAuth.mockReturnValue(createMockAuthResponse(false));
      
      render(<LinkShare />);
      
      const urlInput = screen.getByPlaceholderText('https://example.com');
      fireEvent.change(urlInput, { target: { value: 'https://google.com' } });
      
      const submitButton = screen.getByRole('button', { name: 'Create Link' });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText('Success!')).toBeInTheDocument();
        expect(screen.getByText('Your link has been created successfully!')).toBeInTheDocument();
        expect(screen.getByTestId('qr-code')).toBeInTheDocument();
      });
    });

    it('handles copy to clipboard functionality', async () => {
      const mockWriteText = navigator.clipboard.writeText as jest.MockedFunction<typeof navigator.clipboard.writeText>;
      
      const mockFetch = fetch as jest.MockedFunction<typeof fetch>;
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          share: {
            linkShare: {
              slug: 'test-slug'
            }
          }
        }),
      } as Response);

      mockUseAuth.mockReturnValue(createMockAuthResponse(false));
      
      render(<LinkShare />);
      
      const urlInput = screen.getByPlaceholderText('https://example.com');
      fireEvent.change(urlInput, { target: { value: 'https://google.com' } });
      
      const submitButton = screen.getByRole('button', { name: 'Create Link' });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText('Copy Link')).toBeInTheDocument();
      });

      const copyButton = screen.getByText('Copy Link');
      fireEvent.click(copyButton);

      expect(mockWriteText).toHaveBeenCalled();
    });
  });
});