import { useTranslation } from "react-i18next"

export default function Footer() {
  const { t } = useTranslation()
  return (
    <footer className="mt-16 border-t border-gray-700/50 bg-gray-800/30 backdrop-blur-sm">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-full bg-gradient-to-br from-blue-600/20 to-purple-600/20 border border-blue-800/50 flex items-center justify-center">
              <svg className="h-4 w-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.367 2.684 3 3 0 00-5.367-2.684z" />
              </svg>
            </div>
            <span className="text-gray-300">
              {t('footer.made_with', 'Made with')} <span className="text-red-400 animate-pulse">❤️</span> {t('footer.by','by Romain')}
            </span>
          </div>

          <div className="flex items-center gap-6">
            <a
              href="https://github.com/TuroYT/snowshare"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-gray-400 hover:text-gray-200 transition-colors px-3 py-2 rounded-lg hover:bg-gray-700/50"
            >
              <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
              </svg>
              {t('footer.github','GitHub')}
            </a>
            <a
              href="/LICENSE"
              className="inline-flex items-center gap-2 text-gray-400 hover:text-gray-200 transition-colors px-3 py-2 rounded-lg hover:bg-gray-700/50"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              {t('footer.license','License')}
            </a>
          </div>
        </div>
        
        <div className="mt-6 pt-6 border-t border-gray-700/30 text-center">
          <p className="text-sm text-gray-500">
            © 2025 SnowShare. {t('footer.rights', 'Tous droits réservés.')}
          </p>
        </div>
      </div>
    </footer>
  )
}
