import React, { useState, useEffect, useCallback } from 'react';
import { useApi } from '../api/ApiContext'; // Import useApi hook
import './LocationsView.css'; // Add basic styling (create this file later if needed)

const LocationsView = () => {
    const [locations, setLocations] = useState([]);
    const [newLocationName, setNewLocationName] = useState('');
    const [newLocationDescription, setNewLocationDescription] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [success, setSuccess] = useState(null);
    const api = useApi(); // Get API methods from context

    // Function to fetch locations
    const fetchLocations = useCallback(async () => {
        // Only fetch if the provider is configured and listLocations exists
        if (!api.config.isConfigured || typeof api.listLocations !== 'function') {
            setLocations([]); // Clear locations if not configured
            setError(api.config.isConfigured ? "listLocations method not available for this provider." : "API Provider not configured.");
            return;
        }

        setLoading(true);
        setError(null);
        setSuccess(null); // Clear previous success messages
        try {
            const data = await api.listLocations();
            setLocations(data || []); // Ensure data is an array
        } catch (err) {
            console.error("Failed to fetch locations:", err);
            setError(`Failed to fetch locations: ${err.message}`);
            setLocations([]); // Clear locations on error
        } finally {
            setLoading(false);
        }
    }, [api]); // Dependency: re-run if api object (methods/config) changes

    // Fetch locations on component mount and when fetchLocations changes
    useEffect(() => {
        fetchLocations();
    }, [fetchLocations]);

    // Function to handle adding a new location
    const handleAddLocation = async (e) => {
        e.preventDefault(); // Prevent default form submission

        if (!newLocationName.trim()) {
            setError("Location name cannot be empty.");
            return;
        }
        // Only add if the provider is configured and addLocation exists
        if (!api.config.isConfigured || typeof api.addLocation !== 'function') {
             setError(api.config.isConfigured ? "addLocation method not available for this provider." : "API Provider not configured.");
            return;
        }


        setLoading(true);
        setError(null);
        setSuccess(null);

        try {
            const result = await api.addLocation({
                name: newLocationName.trim(),
                description: newLocationDescription.trim() || null // Send null if description is empty
            });

            if (result.success) {
                setSuccess(`Location "${newLocationName}" added successfully!`);
                setNewLocationName('');
                setNewLocationDescription('');
                fetchLocations(); // Refresh the list
            } else {
                // Should ideally not happen if addLocation throws errors, but handle just in case
                setError("Failed to add location for an unknown reason.");
            }
        } catch (err) {
            console.error("Failed to add location:", err);
            setError(`Failed to add location: ${err.message}`);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="locations-view">
            <h2>Locations Management</h2>

            {/* Status Messages */}
            {loading && <p className="status-loading">Loading...</p>}
            {error && <p className="status-error">Error: {error}</p>}
            {success && <p className="status-success">{success}</p>}

            {/* Add Location Form */}
            {!api.config.isConfigured ? (
                 <p className="status-warning">API Provider is not configured. Please configure it in Settings.</p>
            ) : typeof api.addLocation !== 'function' ? (
                 <p className="status-warning">Adding locations is not supported by the current API Provider.</p>
            ) : (
                <form onSubmit={handleAddLocation} className="add-location-form">
                    <h3>Add New Location</h3>
                    <div className="form-group">
                        <label htmlFor="location-name">Name:</label>
                        <input
                            type="text"
                            id="location-name"
                            value={newLocationName}
                            onChange={(e) => setNewLocationName(e.target.value)}
                            required
                            disabled={loading}
                        />
                    </div>
                    <div className="form-group">
                        <label htmlFor="location-description">Description:</label>
                        <input
                            type="text"
                            id="location-description"
                            value={newLocationDescription}
                            onChange={(e) => setNewLocationDescription(e.target.value)}
                            disabled={loading}
                        />
                    </div>
                    <button type="submit" disabled={loading || !newLocationName.trim()}>
                        {loading ? 'Adding...' : 'Add Location'}
                    </button>
                </form>
            )}


            {/* Locations List */}
            <h3>Existing Locations</h3>
             {typeof api.listLocations === 'function' && !loading && locations.length === 0 && !error && (
                 <p>No locations found.</p>
             )}
             {typeof api.listLocations === 'function' && locations.length > 0 && (
                <ul className="locations-list">
                    {locations.map((loc) => (
                        <li key={loc.location_id}>
                            <strong>{loc.name}</strong>
                            {loc.description && <span> - {loc.description}</span>}
                            {/* Add Edit/Delete buttons here later */}
                        </li>
                    ))}
                </ul>
             )}
             {typeof api.listLocations !== 'function' && api.config.isConfigured && (
                 <p className="status-warning">Listing locations is not supported by the current API Provider.</p>
             )}

        </div>
    );
};

export default LocationsView;
