import { render, screen } from '@testing-library/react'
import Footer from '@/components/Footer'

// Mock react-i18next for this test file
jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: string) => {
      const translations: Record<string, string> = {
        'footer.made_with': 'Made with',
        'footer.by': 'by Romain',
        'footer.github': 'GitHub',
        'footer.license': 'License',
      }
      return translations[key] || fallback || key
    },
  }),
}))

describe('Footer Component', () => {
  it('renders footer content', () => {
    render(<Footer />)
    
    // Check if the main content is rendered
    expect(screen.getByText(/Made with/)).toBeDefined()
    expect(screen.getByText(/by Romain/)).toBeDefined()
    expect(screen.getByText('❤️')).toBeDefined()
  })

  it('renders GitHub link with correct attributes', () => {
    render(<Footer />)
    
    const githubLink = screen.getByRole('link', { name: 'GitHub' })
    expect(githubLink).toBeDefined()
    expect(githubLink.getAttribute('href')).toBe('https://github.com/TuroYT/snowshare')
    expect(githubLink.getAttribute('target')).toBe('_blank')
    expect(githubLink.getAttribute('rel')).toBe('noopener noreferrer')
  })

  it('renders License link with correct attributes', () => {
    render(<Footer />)
    
    const licenseLink = screen.getByRole('link', { name: 'License' })
    expect(licenseLink).toBeDefined()
    expect(licenseLink.getAttribute('href')).toBe('/LICENSE')
  })

  it('has proper semantic structure', () => {
    render(<Footer />)
    
    const footer = screen.getByRole('contentinfo')
    expect(footer).toBeDefined()
    
    // Check for links structure
    const links = screen.getAllByRole('link')
    expect(links).toHaveLength(2) // GitHub and License links
  })
})