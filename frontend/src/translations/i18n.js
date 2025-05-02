// Defines available languages, their display names, and the default fallback locale.
export const availableLocales = [
    { code: 'en', name: 'English' },
    { code: 'fi', name: 'Suomi' },
    // Future languages: { code: 'es', name: 'Español' }, etc.
];

// The ultimate fallback language if detection or loading fails.
export const defaultLocale = 'en';

// Helper function to get just the language codes (e.g., ['en', 'fi'])
export const getLocaleCodes = () => availableLocales.map(l => l.code);

// Define the specific localStorage key for language preference.
export const LS_LOCALE_KEY = 'userLocale';

// Define the environment variable key for the default locale override.
export const ENV_DEFAULT_LOCALE_KEY = 'VITE_DEFAULT_LOCALE';
