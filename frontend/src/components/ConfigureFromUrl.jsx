import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useIntl } from 'react-intl';
// Import keys from their source files
import { LS_API_PROVIDER_CONFIG_KEY } from '../api/ApiContext';
import { LS_LOCALE_KEY, getLocaleCodes } from '../translations/i18n';
import { getProviderById } from '../api/providerRegistry'; // For validation

// Define keys directly if not exported from context/i18n
// const LS_API_PROVIDER_CONFIG_KEY = 'apiProviderConfig';
// const LS_LOCALE_KEY = 'userLocale';

const ConfigureFromUrl = () => {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const intl = useIntl();
    const [statusMessage, setStatusMessage] = useState(intl.formatMessage({ id: 'configure.status.processing', defaultMessage: 'Processing configuration...' }));
    const [isError, setIsError] = useState(false);

    useEffect(() => {
        const encodedValues = searchParams.get('values');

        if (!encodedValues) {
            setStatusMessage(intl.formatMessage({ id: 'configure.error.missingParam', defaultMessage: 'Error: Configuration data missing in URL.' }));
            setIsError(true);
            return;
        }

        try {
            const decodedJson = atob(encodedValues); // Decode Base64
            const parsedData = JSON.parse(decodedJson); // Parse JSON

            let configApplied = false;

            // Validate and apply API config
            if (parsedData.api && typeof parsedData.api === 'object') {
                const { providerType, settings } = parsedData.api;
                if (providerType && getProviderById(providerType) && typeof settings === 'object') {
                    // Basic validation passed, save only relevant parts
                    const apiConfigToSave = {
                        providerType: providerType,
                        settings: settings || {} // Ensure settings is an object
                    };
                    localStorage.setItem(LS_API_PROVIDER_CONFIG_KEY, JSON.stringify(apiConfigToSave));
                    console.log('Applied API configuration from URL:', apiConfigToSave);
                    configApplied = true;
                } else {
                    console.warn('Invalid API configuration structure in URL data:', parsedData.api);
                    // Optionally set an error message part here
                }
            }

            // Validate and apply Locale config
            if (parsedData.locale && typeof parsedData.locale === 'string') {
                const validLocales = getLocaleCodes();
                if (validLocales.includes(parsedData.locale)) {
                    localStorage.setItem(LS_LOCALE_KEY, parsedData.locale);
                    console.log('Applied Locale configuration from URL:', parsedData.locale);
                    configApplied = true;
                } else {
                    console.warn('Invalid Locale configuration in URL data:', parsedData.locale);
                    // Optionally set an error message part here
                }
            }

            if (configApplied) {
                // Redirect to the main app page after successful application
                // Use replace: true so the /configure URL isn't in the browser history
                navigate('/items', { replace: true });
                // Note: The component might unmount immediately after navigate.
                // Setting state here might not be visible, but the redirect happens.
                setStatusMessage(intl.formatMessage({ id: 'configure.status.success', defaultMessage: 'Configuration applied. Redirecting...' }));
            } else {
                 setStatusMessage(intl.formatMessage({ id: 'configure.error.noValidData', defaultMessage: 'Error: No valid configuration data found in the provided values.' }));
                 setIsError(true);
            }

        } catch (error) {
            console.error('Error processing configuration from URL:', error);
            let errorMessageId = 'configure.error.generic';
            let defaultMessage = 'Error processing configuration: {error}';
            if (error instanceof SyntaxError) {
                errorMessageId = 'configure.error.invalidJson';
                defaultMessage = 'Error: Could not parse configuration data (Invalid JSON).';
            } else if (error.message.includes('atob')) {
                 errorMessageId = 'configure.error.invalidBase64';
                 defaultMessage = 'Error: Could not decode configuration data (Invalid Base64).';
            }
            setStatusMessage(intl.formatMessage({ id: errorMessageId, defaultMessage: defaultMessage }, { error: error.message }));
            setIsError(true);
        }

    }, [searchParams, navigate, intl]); // Dependencies

    // Render status message
    return (
        // Use settings-view class for consistent padding/styling
        <div className="settings-view" style={{ textAlign: 'center' }}>
            <h2>{intl.formatMessage({ id: 'configure.title', defaultMessage: 'Applying Configuration' })}</h2>
            {/* Use status classes */}
            <p className={isError ? 'status-error' : 'status-loading'}>
                {statusMessage}
            </p>
            {!isError && <p>{intl.formatMessage({ id: 'configure.status.wait', defaultMessage: 'Please wait...' })}</p>}
            {/* Use text-link color (implicitly via 'a' tag) */}
            {isError && <p><a href="/">{intl.formatMessage({ id: 'configure.link.home', defaultMessage: 'Go to Home Page' })}</a></p>}
        </div>
    );
};

export default ConfigureFromUrl;
