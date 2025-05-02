import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { IntlProvider } from 'react-intl';
import { availableLocales, defaultLocale, getLocaleCodes, LS_LOCALE_KEY, ENV_DEFAULT_LOCALE_KEY } from './i18n'; // Updated path

async function loadMessages(locale) {
    const validLocale = getLocaleCodes().includes(locale) ? locale : defaultLocale;
    if (locale !== validLocale) {
        console.warn(`Invalid locale "${locale}" requested. Falling back to "${validLocale}".`);
    }
    try {
        /* @vite-ignore */
        const { default: messages } = await import(`./locale/${validLocale}.json`);
        return messages;
    } catch (error) {
        console.error(`Failed to load messages for locale "${validLocale}":`, error);
        if (validLocale !== defaultLocale) {
            console.warn(`Falling back to loading default locale "${defaultLocale}" messages.`);
            return loadMessages(defaultLocale);
        } else {
            console.error(`FATAL: Failed to load default messages for locale "${defaultLocale}".`);
            return {};
        }
    }
}

function getInitialLocale() {
    // 1. Check Local Storage
    const savedLocale = localStorage.getItem(LS_LOCALE_KEY);
    if (savedLocale && getLocaleCodes().includes(savedLocale)) {
        return savedLocale;
    }
    // 2. Check Environment Variable
    const envLocale = import.meta.env[ENV_DEFAULT_LOCALE_KEY];
    if (envLocale && getLocaleCodes().includes(envLocale)) {
        return envLocale;
    }
    // 3. Fallback to Hardcoded Default
    return defaultLocale;
}

// Create the context
const TranslationContext = createContext(null);

// Custom hook to use the context
export const useTranslationContext = () => {
    const context = useContext(TranslationContext);
    if (!context) {
        throw new Error('useTranslationContext must be used within a TranslationProvider');
    }
    return context;
};

// Create the provider component
export const TranslationProvider = ({ children }) => {
    const [locale, setLocale] = useState(getInitialLocale);
    const [messages, setMessages] = useState({});
    const [loadingMessages, setLoadingMessages] = useState(true);
    const [loadError, setLoadError] = useState(null); // Track loading errors

    // Effect to load messages when locale changes
    useEffect(() => {
        setLoadingMessages(true);
        setLoadError(null); // Reset error on new load attempt
        loadMessages(locale)
            .then(loadedMessages => {
                setMessages(loadedMessages);
            })
            .catch(error => {
                // Error is already logged in loadMessages, but we can set state here if needed
                console.error("Error caught in TranslationProvider useEffect:", error);
                setLoadError("Failed to load language data."); // Set user-facing error message
                setMessages({});
            })
            .finally(() => {
                setLoadingMessages(false);
            });
    }, [locale]);

    // Function to change the language
    const changeLocale = useCallback((newLocale) => {
        if (getLocaleCodes().includes(newLocale) && newLocale !== locale) {
            setLocale(newLocale);
            localStorage.setItem(LS_LOCALE_KEY, newLocale);
        } else if (!getLocaleCodes().includes(newLocale)) {
            console.warn(`Attempted to change to invalid locale: ${newLocale}`);
        }
    }, [locale]);

    // The context value
    const value = {
        locale,
        changeLocale,
        availableLocales,
        loadingMessages,
        loadError,
    };

    // Display loading or error state, or render children within IntlProvider
    const renderContent = () => {
        if (loadingMessages) {
            return <div>Loading language...</div>; // Replace with a better loading indicator
        }
        if (loadError) {
            return <div>Error: {loadError} Please try refreshing.</div>; // Display error
        }
        // Only render IntlProvider if messages are loaded successfully
        return (
            <IntlProvider
                locale={locale}
                messages={messages}
                defaultLocale={defaultLocale}
                onError={(err) => {
                    // Only warn for missing translations in development
                    if (err.code === 'MISSING_TRANSLATION' && import.meta.env.DEV) {
                         console.warn(`Missing translation id: "${err.descriptor?.id}" in locale "${locale}"`);
                         return; // Don't log the full error object for missing translations
                    }
                    // Log other errors
                    if (err.code !== 'MISSING_TRANSLATION') {
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
