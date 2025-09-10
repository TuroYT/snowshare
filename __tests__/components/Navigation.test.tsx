import { render, screen, fireEvent } from '@testing-library/react'
import { useSession } from 'next-auth/react'
import Navigation from '@/components/Navigation'

// Mock Next.js Image component
jest.mock('next/image', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return function MockImage({ src, alt, width, height }: any) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src} alt={alt} width={width} height={height} />
  }
})

// Mock Next.js Link component
jest.mock('next/link', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return function MockLink({ href, children, onClick, className }: any) {
    return (
      <a href={href} onClick={onClick} className={className}>
        {children}
      </a>
    )
  }
})

// Mock useSession hook
jest.mock('next-auth/react', () => ({
  useSession: jest.fn(),
  signOut: jest.fn(),
}))

// Mock useRouter
const mockPush = jest.fn()
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
  }),
}))

// Mock localStorage
const localStorageMock = {
  setItem: jest.fn(),
}
Object.defineProperty(window, 'localStorage', {
  value: localStorageMock
})

// Mock react-i18next
jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    t: (key: string, options?: any) => {
      const translations: Record<string, string> = {
        'loading': 'Loading...',
        'nav.language': 'Language',
        'nav.hello': `Hello, ${options?.email || 'user'}`,
        'nav.signout': 'Sign Out',
        'nav.signin': 'Sign In',
        'nav.signup': 'Sign Up',
      }
      return translations[key] || key
    },
    i18n: {
      language: 'en',
      changeLanguage: jest.fn(),
    },
  }),
}))

describe('Navigation Component', () => {
  const mockUseSession = useSession as jest.MockedFunction<typeof useSession>

  beforeEach(() => {
    jest.clearAllMocks()
    localStorageMock.setItem.mockClear()
  })

  describe('when loading', () => {
    it('shows loading state', () => {
      mockUseSession.mockReturnValue({
        data: null,
        status: 'loading',
        update: jest.fn(),
      })

      render(<Navigation />)
      expect(screen.getByText('Loading...')).toBeDefined()
    })
  })

  describe('when user is not authenticated', () => {
    beforeEach(() => {
      mockUseSession.mockReturnValue({
        data: null,
        status: 'unauthenticated',
        update: jest.fn(),
      })
    })

    it('renders basic navigation elements', () => {
      render(<Navigation />)
      
      expect(screen.getByAltText('SnowShare Logo')).toBeDefined()
      expect(screen.getByText('SnowShare')).toBeDefined()
      expect(screen.getByText('Sign In')).toBeDefined()
      expect(screen.getByText('Sign Up')).toBeDefined()
    })

    it('renders language selector', () => {
      render(<Navigation />)
      
      const languageSelect = screen.getByLabelText('Language')
      expect(languageSelect).toBeDefined()
      expect(languageSelect.tagName).toBe('SELECT')
    })

    it('toggles mobile menu', () => {
      render(<Navigation />)
      
      const mobileMenuButton = screen.getByLabelText('Open menu')
      expect(mobileMenuButton).toBeDefined()
      
      fireEvent.click(mobileMenuButton)
      
      // Check that menu button label changes
      expect(screen.getByLabelText('Close menu')).toBeDefined()
    })
  })

  describe('when user is authenticated', () => {
    beforeEach(() => {
      mockUseSession.mockReturnValue({
        data: {
          user: { id: '1', email: 'test@example.com' },
          expires: '2024-01-01',
        },
        status: 'authenticated',
        update: jest.fn(),
      })
    })

    it('renders user greeting and sign out button', () => {
      render(<Navigation />)
      
      expect(screen.getByText('Hello, test@example.com')).toBeDefined()
      expect(screen.getByText('Sign Out')).toBeDefined()
      expect(screen.queryByText('Sign In')).toBeNull()
      expect(screen.queryByText('Sign Up')).toBeNull()
    })
  })

  describe('language switching', () => {
    beforeEach(() => {
      mockUseSession.mockReturnValue({
        data: null,
        status: 'unauthenticated',
        update: jest.fn(),
      })
    })

    it('changes language and saves to localStorage', () => {
      render(<Navigation />)
      
      const languageSelect = screen.getByLabelText('Language')
      fireEvent.change(languageSelect, { target: { value: 'fr' } })
      
      expect(localStorageMock.setItem).toHaveBeenCalledWith('i18nextLng', 'fr')
    })
  })
})