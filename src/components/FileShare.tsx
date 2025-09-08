import React from "react";
import { useTranslation } from "react-i18next";

const FileShare = () => {
  const { t } = useTranslation();
  return (
    <div className="bg-gray-800 p-6 rounded-lg shadow-lg border border-gray-700 max-w-2xl">
      <h2 className="text-lg font-semibold mb-4 text-gray-100">{t('fileshare.title', 'FileShare')}</h2>
      <p className="text-gray-300">{t('fileshare.description', 'Partagez vos fichiers en toute sécurité et simplicité.')}</p>
    </div>
  );
};

export default FileShare;
