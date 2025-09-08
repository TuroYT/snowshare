import { useTranslation } from "react-i18next"

export default function Footer() {
  const { t } = useTranslation()
  return (
    <footer className="mt-12 border-t border-gray-800 bg-gray-900">
      <div className="max-w-7xl mx-auto px-4 py-6 text-center text-gray-400">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
          <div>
            <span>
              {t('footer.made_with', 'Made with')} <span aria-hidden>❤️</span> {t('footer.by','by Romain')}
            </span>
          </div>

          <div className="space-x-4">
            <a
              href="https://github.com/TuroYT/snowshare"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-gray-200"
            >
              {t('footer.github','GitHub')}
            </a>
            <a
              href="/LICENSE"
              className="hover:text-gray-200"
            >
              {t('footer.license','License')}
            </a>
          </div>
        </div>
      </div>
    </footer>
  )
}
