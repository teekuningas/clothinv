import React, { createContext, useContext, useState, useEffect } from "react";
import { IntlProvider } from "react-intl";
import { useSettings } from "../settings/SettingsContext";
import { availableLocales, defaultLocale, getLocaleCodes } from "./i18n";

async function loadMessages(locale) {
  const validLocale = getLocaleCodes().includes(locale)
    ? locale
    : defaultLocale;
  if (locale !== validLocale) {
    console.warn(
      `Invalid locale "${locale}" requested. Falling back to "${validLocale}".`,
    );
  }
  try {
    /* @vite-ignore */
    const { default: messages } = await import(`./locale/${validLocale}.json`);
    return messages;
  } catch (error) {
    console.error(
      `Failed to load messages for locale "${validLocale}":`,
      error,
    );
    if (validLocale !== defaultLocale) {
      console.warn(
        `Falling back to loading default locale "${defaultLocale}" messages.`,
      );
      return loadMessages(defaultLocale);
    } else {
      console.error(
        `FATAL: Failed to load default messages for locale "${defaultLocale}".`,
      );
      return {};
    }
  }
}

const TranslationContext = createContext(null);

export const useTranslationContext = () => {
  const context = useContext(TranslationContext);
  if (!context) {
    throw new Error(
      "useTranslationContext must be used within a TranslationProvider",
    );
  }
  return context;
};

export const TranslationProvider = ({ children }) => {
  const { settings } = useSettings();
  const locale = settings.locale || defaultLocale;
  const [messages, setMessages] = useState({});
  const [loadingMessages, setLoadingMessages] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [isInitialLoad, setIsInitialLoad] = useState(true);

  useEffect(() => {
    setLoadingMessages(true);
    setLoadError(null);
    loadMessages(locale)
      .then((loadedMessages) => {
        setMessages(loadedMessages);
        if (isInitialLoad) setIsInitialLoad(false);
      })
      .catch((error) => {
        console.error("Error caught in TranslationProvider useEffect:", error);
        setLoadError("Failed to load language data.");
        setMessages({});
        if (isInitialLoad) setIsInitialLoad(false);
      })
      .finally(() => {
        setLoadingMessages(false);
      });
  }, [locale, isInitialLoad]);

  const value = {
    locale,
    availableLocales,
    loadingMessages,
    loadError,
  };

  const renderContent = () => {
    if (isInitialLoad && loadingMessages) {
      return <div>Loading language...</div>;
    }
    if (isInitialLoad && loadError) {
      return <div>Error: {loadError} Please try refreshing.</div>;
    }
    return (
      <IntlProvider
        locale={locale}
        messages={messages}
        defaultLocale={defaultLocale}
        onError={(err) => {
          // Only warn for missing translations in development
          if (err.code === "MISSING_TRANSLATION" && import.meta.env.DEV) {
            console.warn(
              `Missing translation id: "${err.descriptor?.id}" in locale "${locale}"`,
            );
            return;
          }
          if (err.code !== "MISSING_TRANSLATION") {
            console.error("IntlProvider Error:", err);
          }
        }}
      >
        {children}
      </IntlProvider>
    );
  };

  return (
    <TranslationContext.Provider value={value}>
      {renderContent()}
    </TranslationContext.Provider>
  );
};
