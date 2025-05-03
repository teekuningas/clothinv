import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useIntl } from 'react-intl';
import { getProviderById } from '../api/providerRegistry';
import { getLocaleCodes } from '../translations/i18n';

const ExportConfigurationLink = () => {
    const [searchParams] = useSearchParams();
    const intl = useIntl();
    const [generatedUrl, setGeneratedUrl] = useState('');
    const [encodedString, setEncodedString] = useState('');
    const [error, setError] = useState('');
    const [configDetails, setConfigDetails] = useState({}); // Store details for display

    useEffect(() => {
        const configToEncode = {
            api: null,
            locale: null,
        };
        const details = { api: {}, locale: '' }; // For display

        const providerType = searchParams.get('providerType');
        const locale = searchParams.get('locale');
        const settings = {};

        // Extract settings prefixed with 'setting_'
        for (const [key, value] of searchParams.entries()) {
            if (key.startsWith('setting_')) {
                const settingKey = key.substring(8); // Remove 'setting_' prefix
                settings[settingKey] = value;
            }
        }

        // Validate API config
        if (providerType) {
            const provider = getProviderById(providerType);
            if (provider) {
                // Basic validation: provider exists and settings is an object
                configToEncode.api = { providerType, settings };
                details.api = { providerType, settings }; // Store for display
            } else {
                setError(intl.formatMessage({ id: 'exportConfig.error.invalidProvider', defaultMessage: 'Error: Invalid provider type specified: {providerType}' }, { providerType }));
                return;
            }
        }

        // Validate Locale
        if (locale) {
            const validLocales = getLocaleCodes();
            if (validLocales.includes(locale)) {
                configToEncode.locale = locale;
                details.locale = locale; // Store for display
            } else {
                setError(intl.formatMessage({ id: 'exportConfig.error.invalidLocale', defaultMessage: 'Error: Invalid locale specified: {locale}' }, { locale }));
                return;
            }
        }

        // Check if at least one config part was provided
        if (!configToEncode.api && !configToEncode.locale) {
            setError(intl.formatMessage({ id: 'exportConfig.error.noParams', defaultMessage: 'Error: No configuration parameters (providerType, setting_*, locale) provided in the URL.' }));
            return;
        }

        // Clean up the object: remove null parts before encoding
        if (!configToEncode.api) delete configToEncode.api;
        if (!configToEncode.locale) delete configToEncode.locale;

        try {
            const jsonString = JSON.stringify(configToEncode);
            const base64String = btoa(jsonString); // Encode to Base64
            const configureUrl = `${window.location.origin}/configure?values=${base64String}`;

            setEncodedString(base64String);
            setGeneratedUrl(configureUrl);
            setConfigDetails(details); // Set details for display
            setError(''); // Clear previous errors
        } catch (e) {
            console.error("Error generating configuration link:", e);
            setError(intl.formatMessage({ id: 'exportConfig.error.encodingFailed', defaultMessage: 'Error: Failed to generate configuration link.' }));
            setGeneratedUrl('');
            setEncodedString('');
            setConfigDetails({});
        }

    }, [searchParams, intl]);

    const handleCopyUrl = () => {
        navigator.clipboard.writeText(generatedUrl)
            .then(() => alert(intl.formatMessage({ id: 'exportConfig.alert.urlCopied', defaultMessage: 'Configuration URL copied to clipboard!' })))
            .catch(err => alert(intl.formatMessage({ id: 'exportConfig.alert.copyFailed', defaultMessage: 'Failed to copy URL: {error}' }, { error: err })));
    };

    const handleCopyEncoded = () => {
        navigator.clipboard.writeText(encodedString)
            .then(() => alert(intl.formatMessage({ id: 'exportConfig.alert.encodedCopied', defaultMessage: 'Encoded string copied to clipboard!' })))
            .catch(err => alert(intl.formatMessage({ id: 'exportConfig.alert.copyFailed', defaultMessage: 'Failed to copy string: {error}' }, { error: err })));
    };


    return (
        // Use settings-view class for consistent padding/styling
        <div className="settings-view">
            <h2>{intl.formatMessage({ id: 'exportConfig.title', defaultMessage: 'Export Configuration Link' })}</h2>

            {/* Use status-error class */}
            {error && <p className="status-error">{error}</p>}

            {!error && generatedUrl && (
                <div className="settings-fieldset"> {/* Wrap content in fieldset for styling */}
                    <h3>{intl.formatMessage({ id: 'exportConfig.section.details', defaultMessage: 'Configuration Details Included:' })}</h3>
                    {configDetails.api && (
                        <div>
                            <strong>{intl.formatMessage({ id: 'exportConfig.details.apiProvider', defaultMessage: 'API Provider:' })}</strong> {configDetails.api.providerType}
                            <ul>
                                {Object.entries(configDetails.api.settings).map(([key, value]) => (
                                    <li key={key}><code>{key}</code>: <code>{key.toLowerCase().includes('token') ? '********' : value}</code></li>
                                ))}
                            </ul>
                        </div>
                    )}
                    {configDetails.locale && (
                        <p><strong>{intl.formatMessage({ id: 'exportConfig.details.language', defaultMessage: 'Language:' })}</strong> {configDetails.locale}</p>
                    )}

                    <h3>{intl.formatMessage({ id: 'exportConfig.section.generatedUrl', defaultMessage: 'Generated Configuration URL:' })}</h3>
                    {/* Use subtle background for code blocks */}
                    <p style={{ wordBreak: 'break-all', backgroundColor: 'var(--color-bg-subtle)', padding: '10px', borderRadius: '4px' }}>
                        <code>{generatedUrl}</code>
                    </p>
                    {/* Use button classes */}
                    <button onClick={handleCopyUrl} className="button-primary" style={{ marginRight: '10px' }}>
                        {intl.formatMessage({ id: 'exportConfig.button.copyUrl', defaultMessage: 'Copy URL' })}
                    </button>

                    <h3>{intl.formatMessage({ id: 'exportConfig.section.encodedString', defaultMessage: 'Base64 Encoded String:' })}</h3>
                    <p style={{ wordBreak: 'break-all', backgroundColor: 'var(--color-bg-subtle)', padding: '10px', borderRadius: '4px' }}>
                        <code>{encodedString}</code>
                    </p>
                    <button onClick={handleCopyEncoded} className="button-primary">
                        {intl.formatMessage({ id: 'exportConfig.button.copyEncoded', defaultMessage: 'Copy Encoded String' })}
                    </button>

                    <p style={{ marginTop: '20px', fontStyle: 'italic' }}>
                        {intl.formatMessage({ id: 'exportConfig.instructions', defaultMessage: 'Share the generated URL with someone. When they open it, the specified configuration will be automatically applied to their browser.' })}
                    </p>
                    {/* Use status-warning class */}
                     <p className="status-warning" style={{ marginTop: '10px' }}>
                        {intl.formatMessage({ id: 'exportConfig.warning.secret', defaultMessage: 'Warning: This URL contains configuration details, potentially including API tokens. Share it only with trusted individuals.' })}
                    </p>
                </div>
            )}

            {!error && !generatedUrl && (
                 <p className="status-loading">{intl.formatMessage({ id: 'exportConfig.status.generating', defaultMessage: 'Generating link...' })}</p>
            )}

             {/* Use fieldset for usage section */}
             <div className="settings-fieldset" style={{ marginTop: '30px' }}>
                <h4>{intl.formatMessage({ id: 'exportConfig.section.usage', defaultMessage: 'How to Use This Page' })}</h4>
                <p>{intl.formatMessage({ id: 'exportConfig.usage.description', defaultMessage: 'Construct a URL pointing to this page with query parameters representing the desired configuration. Example:' })}</p>
                <code style={{ display: 'block', backgroundColor: 'var(--color-bg-subtle)', padding: '5px', whiteSpace: 'pre-wrap', border: '1px solid var(--color-border)', borderRadius: '4px' }}>
                    {window.location.origin}/export-configuration?providerType=datasette&amp;setting_datasetteBaseUrl=https://your-datasette.example.com/inventory&amp;setting_datasetteApiToken=YOUR_SECRET_TOKEN&amp;locale=en
                </code>
                <p style={{ marginTop: '10px' }}>{intl.formatMessage({ id: 'exportConfig.usage.parameters', defaultMessage: 'Parameters:' })}</p>
                <ul>
                    <li><code>providerType</code>: {intl.formatMessage({ id: 'exportConfig.param.providerType', defaultMessage: 'The ID of the API provider (e.g., datasette, localStorage).' })}</li>
                    <li><code>setting_KEY</code>: {intl.formatMessage({ id: 'exportConfig.param.setting', defaultMessage: 'Replace KEY with the specific setting name for the provider (e.g., setting_datasetteBaseUrl, setting_datasetteApiToken).' })}</li>
                    <li><code>locale</code>: {intl.formatMessage({ id: 'exportConfig.param.locale', defaultMessage: 'The desired language code (e.g., en, fi).' })}</li>
                </ul>
            </div>
        </div>
    );
};

export default ExportConfigurationLink;
