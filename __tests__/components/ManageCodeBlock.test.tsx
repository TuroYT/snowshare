import { render, screen, fireEvent, act, waitFor } from '@testing-library/react'
import ManageCodeBlock from '@/components/pasteShareComponents/ManageCodeBlock'

// Mock react-i18next
jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: string) => {
      const translations: Record<string, string> = {
        'pasteshare_ui.label_language': 'Language',
        'pasteshare_ui.language_placeholder': 'Select a language',
        'pasteshare_ui.label_expiration': 'Expiration',
        'pasteshare_ui.submit': 'Create Paste',
        'pasteshare_ui.advanced': 'Advanced Settings',
        'pasteshare_ui.custom_slug': 'Custom Slug',
        'pasteshare_ui.label_password': 'Password',
        'pasteshare_ui.placeholder_password': 'Optional password',
        'pasteshare_ui.slug_hint': 'Leave empty for auto-generated slug',
        'linkshare.days': 'days',
      }
      return translations[key] || fallback || key
    },
  }),
}))

// Mock useAuth hook
jest.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({
    isAuthenticated: false,
  }),
}))

// Mock QRCodeSVG
jest.mock('qrcode.react', () => ({
  QRCodeSVG: ({ value }: { value: string }) => <div data-testid="qr-code" data-value={value}></div>,
}))

// Mock fetch
global.fetch = jest.fn()

describe('ManageCodeBlock Component', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('renders all language options including markdown', () => {
    const mockOnLanguageChange = jest.fn()
    
    render(
      <ManageCodeBlock
        code="# Test markdown"
        language="markdown"
        onLanguageChange={mockOnLanguageChange}
      />
    )
    
    const select = screen.getByRole('combobox')
    expect(select).toBeDefined()
    
    // Check if markdown option exists
    const markdownOption = screen.getByRole('option', { name: 'Markdown' })
    expect(markdownOption).toBeDefined()
    
    // Check if other languages are present
    expect(screen.getByRole('option', { name: 'JavaScript' })).toBeDefined()
    expect(screen.getByRole('option', { name: 'Python' })).toBeDefined()
    expect(screen.getByRole('option', { name: 'HTML' })).toBeDefined()
  })

  it('calls onLanguageChange when language is selected', () => {
    const mockOnLanguageChange = jest.fn()
    
    render(
      <ManageCodeBlock
        code="Test content"
        language="plaintext"
        onLanguageChange={mockOnLanguageChange}
      />
    )
    
    const select = screen.getByRole('combobox')
    fireEvent.change(select, { target: { value: 'markdown' } })
    
    expect(mockOnLanguageChange).toHaveBeenCalledWith('markdown')
  })

  it('displays form elements for paste creation', () => {
    const mockOnLanguageChange = jest.fn()
    
    render(
      <ManageCodeBlock
        code="Test content"
        language="markdown"
        onLanguageChange={mockOnLanguageChange}
      />
    )
    
    // Check for form elements
    expect(screen.getByText('Language')).toBeDefined()
    expect(screen.getByText('Expiration')).toBeDefined()
    expect(screen.getByText('Advanced Settings')).toBeDefined()
    expect(screen.getByText('Custom Slug')).toBeDefined()
    expect(screen.getByText('Password')).toBeDefined()
    expect(screen.getByRole('button', { name: 'Create Paste' })).toBeDefined()
  })

  it('handles form submission with markdown content', async () => {
    const mockFetch = fetch as jest.MockedFunction<typeof fetch>
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        share: {
          pasteShare: {
            slug: 'test-slug'
          }
        }
      }),
    } as Response)

    const mockOnLanguageChange = jest.fn()
    
    render(
      <ManageCodeBlock
        code="# Markdown Content\n\nThis is a **test**."
        language="markdown"
        onLanguageChange={mockOnLanguageChange}
      />
    )
    
    const submitButton = screen.getByRole('button', { name: 'Create Paste' })
    
    await act(async () => {
      fireEvent.click(submitButton)
    })
    
    // Wait for async operations to complete
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith('/api/shares', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: expect.stringContaining('"type":"PASTE"')
      })
    })

    // Verify the call contains markdown content and language
    expect(mockFetch).toHaveBeenCalledWith('/api/shares', expect.objectContaining({
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: expect.stringContaining('"pastelanguage":"MARKDOWN"')
    }))
  })

  it('handles error response', async () => {
    const mockFetch = fetch as jest.MockedFunction<typeof fetch>
    mockFetch.mockResolvedValueOnce({
      ok: false,
      json: async () => ({
        error: 'Test error message'
      }),
    } as Response)

    const mockOnLanguageChange = jest.fn()
    
    render(
      <ManageCodeBlock
        code="Test content"
        language="markdown"
        onLanguageChange={mockOnLanguageChange}
      />
    )
    
    const submitButton = screen.getByRole('button', { name: 'Create Paste' })
    
    await act(async () => {
      fireEvent.click(submitButton)
    })
    
    // Wait for error to appear
    await waitFor(() => {
      expect(screen.getByText('Test error message')).toBeDefined()
    })
  })
})