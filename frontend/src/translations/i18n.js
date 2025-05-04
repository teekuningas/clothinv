// Defines available languages and their display names
export const availableLocales = [
    { code: 'en', name: 'English' },
    { code: 'fi', name: 'Suomi' },
];

// The ultimate fallback language if detection or loading fails.
export const defaultLocale = 'en';

// Helper function to get just the language codes (e.g., ['en', 'fi'])
export const getLocaleCodes = () => availableLocales.map(l => l.code);

// Define the specific localStorage key for language preference.
export const LS_LOCALE_KEY = 'userLocale';
