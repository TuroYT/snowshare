import React from 'react';
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import ManageCodeBlock from '@/components/pasteShareComponents/ManageCodeBlock';
import { useAuth } from '@/hooks/useAuth';
import { useTranslation } from 'react-i18next';

// Mock dependencies
jest.mock('@/hooks/useAuth');
jest.mock('react-i18next', () => ({
  useTranslation: jest.fn(),
}));
jest.mock('qrcode.react', () => ({
  QRCodeSVG: ({ value }: { value: string }) => <div data-testid="qr-code" data-value={value}></div>,
}));

const mockUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;
const mockUseTranslation = useTranslation as jest.MockedFunction<typeof useTranslation>;

// Mock fetch
global.fetch = jest.fn();

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
    // Always return the English default if provided, otherwise use the key
    if (defaultValue) {
      // Handle interpolation with named parameters
      if (options && typeof options === 'object') {
        let result = defaultValue;
        for (const [param, value] of Object.entries(options)) {
          if (typeof value === 'number' || typeof value === 'string') {
            result = result.replace(`{{${param}}}`, String(value));
          }
        }
        return result;
      }
      return defaultValue;
    }
    return key;
  },
  i18n: {
    changeLanguage: jest.fn(),
    language: 'en',
  },
});

describe('ManageCodeBlock Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseTranslation.mockReturnValue(createMockTranslation());
  });

  describe('Basic rendering', () => {
    it('renders all form elements for unauthenticated user', () => {
      mockUseAuth.mockReturnValue(createMockAuthResponse(false));
      
      const mockOnLanguageChange = jest.fn();
      
      render(
        <ManageCodeBlock
          code="# Test markdown"
          language="markdown"
          onLanguageChange={mockOnLanguageChange}
        />
      );
      
      // Check for form elements
      expect(screen.getByText('Language')).toBeInTheDocument();
      expect(screen.getByText('Expiration')).toBeInTheDocument();
      expect(screen.getByText('Advanced Settings')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Create Paste' })).toBeInTheDocument();
    });

    it('renders all language options including markdown', () => {
      mockUseAuth.mockReturnValue(createMockAuthResponse(false));
      
      const mockOnLanguageChange = jest.fn();
      
      render(
        <ManageCodeBlock
          code="# Test markdown"
          language="markdown"
          onLanguageChange={mockOnLanguageChange}
        />
      );
      
      const select = screen.getByRole('combobox');
      expect(select).toBeInTheDocument();
      
      // Check if markdown option exists and is selected
      const markdownOption = screen.getByRole('option', { name: 'Markdown' }) as HTMLOptionElement;
      expect(markdownOption).toBeInTheDocument();
      expect(markdownOption.selected).toBe(true);
    });

    it('shows different expiration defaults for authenticated vs unauthenticated users', () => {
      // Test unauthenticated user
      mockUseAuth.mockReturnValue(createMockAuthResponse(false));
      
      const { rerender } = render(
        <ManageCodeBlock
          code="test"
          language="javascript"
          onLanguageChange={jest.fn()}
        />
      );
      
      expect(screen.getByDisplayValue('7')).toBeInTheDocument(); // MAX_DAYS_ANON = 7
      
      // Test authenticated user
      mockUseAuth.mockReturnValue(createMockAuthResponse(true));
      
      rerender(
        <ManageCodeBlock
          code="test"
          language="javascript"
          onLanguageChange={jest.fn()}
        />
      );
      
      expect(screen.getByDisplayValue('30')).toBeInTheDocument(); // Default 30 days for auth users
    });
  });

  describe('Language selection', () => {
    it('calls onLanguageChange when language is changed', () => {
      mockUseAuth.mockReturnValue(createMockAuthResponse(false));
      
      const mockOnLanguageChange = jest.fn();
      
      render(
        <ManageCodeBlock
          code="test code"
          language="javascript"
          onLanguageChange={mockOnLanguageChange}
        />
      );
      
      const select = screen.getByRole('combobox');
      fireEvent.change(select, { target: { value: 'python' } });
      
      expect(mockOnLanguageChange).toHaveBeenCalledWith('python');
    });

    it('displays all supported languages', () => {
      mockUseAuth.mockReturnValue(createMockAuthResponse(false));
      
      render(
        <ManageCodeBlock
          code="test"
          language="javascript"
          onLanguageChange={jest.fn()}
        />
      );
      
      const expectedLanguages = [
        'Plain', 'JavaScript', 'TypeScript', 'Python', 'Java',
        'PHP', 'Go', 'HTML', 'CSS', 'SQL', 'JSON', 'Markdown'
      ];
      
      expectedLanguages.forEach(language => {
        expect(screen.getByRole('option', { name: language })).toBeInTheDocument();
      });
    });
  });

  describe('Advanced settings', () => {
    it('shows advanced settings when expanded', () => {
      mockUseAuth.mockReturnValue(createMockAuthResponse(false));
      
      render(
        <ManageCodeBlock
          code="test"
          language="javascript"
          onLanguageChange={jest.fn()}
        />
      );
      
      const advancedButton = screen.getByText('Advanced Settings');
      fireEvent.click(advancedButton);
      
      expect(screen.getByText('Custom Slug')).toBeInTheDocument();
      expect(screen.getByText('Password')).toBeInTheDocument();
    });

    it('handles custom slug input', () => {
      mockUseAuth.mockReturnValue(createMockAuthResponse(false));
      
      render(
        <ManageCodeBlock
          code="test"
          language="javascript"
          onLanguageChange={jest.fn()}
        />
      );
      
      const advancedButton = screen.getByText('Advanced Settings');
      fireEvent.click(advancedButton);
      
      const slugInput = screen.getByPlaceholderText(/Leave empty for auto-generated slug/);
      fireEvent.change(slugInput, { target: { value: 'my-custom-slug' } });
      
      expect(slugInput).toHaveValue('my-custom-slug');
    });

    it('handles password input', () => {
      mockUseAuth.mockReturnValue(createMockAuthResponse(false));
      
      render(
        <ManageCodeBlock
          code="test"
          language="javascript"
          onLanguageChange={jest.fn()}
        />
      );
      
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
      
      render(
        <ManageCodeBlock
          code="test"
          language="javascript"
          onLanguageChange={jest.fn()}
        />
      );
      
      expect(screen.getByText(/Never expires/)).toBeInTheDocument();
    });

    it('does not show never expires option for unauthenticated users', () => {
      mockUseAuth.mockReturnValue(createMockAuthResponse(false));
      
      render(
        <ManageCodeBlock
          code="test"
          language="javascript"
          onLanguageChange={jest.fn()}
        />
      );
      
      expect(screen.queryByText(/Never expires/)).not.toBeInTheDocument();
    });
  });

  describe('Form submission', () => {
    it('handles form submission with markdown content', async () => {
      const mockFetch = fetch as jest.MockedFunction<typeof fetch>;
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          share: {
            pasteShare: {
              slug: 'test-slug'
            }
          }
        }),
      } as Response);

      mockUseAuth.mockReturnValue(createMockAuthResponse(false));
      
      const mockOnLanguageChange = jest.fn();
      
      render(
        <ManageCodeBlock
          code="# Markdown Content\n\nThis is a **test**."
          language="markdown"
          onLanguageChange={mockOnLanguageChange}
        />
      );
      
      const submitButton = screen.getByRole('button', { name: 'Create Paste' });

      await act(async () => {
        fireEvent.click(submitButton);
      });
      
      // Wait for async operations to complete
      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith('/api/shares', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: expect.stringContaining('"type":"PASTE"')
        });
      });

      // Verify the call contains markdown content and language
      expect(mockFetch).toHaveBeenCalledWith('/api/shares', expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: expect.stringContaining('"pastelanguage":"MARKDOWN"')
      }));
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
      
      const mockOnLanguageChange = jest.fn();
      
      render(
        <ManageCodeBlock
          code="test content"
          language="javascript"
          onLanguageChange={mockOnLanguageChange}
        />
      );
      
      const submitButton = screen.getByRole('button', { name: 'Create Paste' });

      await act(async () => {
        fireEvent.click(submitButton);
      });

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
          json: async () => ({ share: { pasteShare: { slug: 'test' } } })
        } as Response), 100))
      );

      mockUseAuth.mockReturnValue(createMockAuthResponse(false));
      
      render(
        <ManageCodeBlock
          code="test"
          language="javascript"
          onLanguageChange={jest.fn()}
        />
      );
      
      const submitButton = screen.getByRole('button', { name: 'Create Paste' });
      fireEvent.click(submitButton);

      // Should show loading state
      expect(screen.getByText('Creating paste...')).toBeInTheDocument();
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
            pasteShare: {
              slug: 'test-slug'
            }
          }
        }),
      } as Response);

      mockUseAuth.mockReturnValue(createMockAuthResponse(false));
      
      render(
        <ManageCodeBlock
          code="test"
          language="javascript"
          onLanguageChange={jest.fn()}
        />
      );
      
      const submitButton = screen.getByRole('button', { name: 'Create Paste' });

      await act(async () => {
        fireEvent.click(submitButton);
      });

      await waitFor(() => {
        expect(screen.getByText('Success!')).toBeInTheDocument();
        expect(screen.getByText('Your paste has been created successfully!')).toBeInTheDocument();
        expect(screen.getByTestId('qr-code')).toBeInTheDocument();
      });
    });
  });
});