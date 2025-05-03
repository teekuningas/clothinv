import React, { useState, useEffect, useCallback } from 'react';
import { useApi } from '../api/ApiContext'; // Import useApi hook
import { useIntl } from 'react-intl'; // Import useIntl
import './LocationsView.css'; // Add basic styling (create this file later if needed)
import Modal from './Modal'; // Import the Modal component

const LocationsView = () => {
    const [locations, setLocations] = useState([]);
    const [newLocationName, setNewLocationName] = useState('');
    const [newLocationDescription, setNewLocationDescription] = useState('');
    const [loading, setLoading] = useState(false); // For initial list loading and adding
    const [error, setError] = useState(null); // For list loading and adding errors
    const [success, setSuccess] = useState(null); // For general success messages (add, update, delete)
    const [editingLocationId, setEditingLocationId] = useState(null); // ID of location being edited
    const [editName, setEditName] = useState(''); // Name in edit form
    const [editDescription, setEditDescription] = useState(''); // Description in edit form
    const [isUpdating, setIsUpdating] = useState(false); // Loading state for update operation
    const [updateError, setUpdateError] = useState(null); // Error specific to update operation
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false); // Show delete confirmation modal
    const [deleteCandidateId, setDeleteCandidateId] = useState(null); // ID of location to potentially delete
    const [isDeleting, setIsDeleting] = useState(false); // Loading state for delete operation
    const [deleteError, setDeleteError] = useState(null); // Error specific to delete operation

    const api = useApi(); // Get API methods from context
    const intl = useIntl(); // Get intl object

    // Function to fetch locations
    const fetchLocations = useCallback(async () => {
        // Only fetch if the provider is configured and listLocations exists
        if (!api.config.isConfigured || typeof api.listLocations !== 'function') {
            setLocations([]); // Clear locations if not configured
            setError(api.config.isConfigured
                ? intl.formatMessage({ id: 'locations.list.notSupported', defaultMessage: 'Listing locations is not supported by the current API Provider.' })
                : intl.formatMessage({ id: 'common.status.apiNotConfigured', defaultMessage: 'API Provider is not configured. Please configure it in Settings.' })
            );
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
            setError(intl.formatMessage({ id: 'locations.error.fetch', defaultMessage: 'Failed to fetch locations: {error}' }, { error: err.message }));
            setLocations([]); // Clear locations on error
        } finally {
            setLoading(false);
        }
    }, [api, intl]); // Add intl to dependencies

    // Fetch locations on component mount and when fetchLocations changes
    useEffect(() => {
        fetchLocations();
    }, [fetchLocations]);

    // Function to handle adding a new location
    const handleAddLocation = async (e) => {
        e.preventDefault(); // Prevent default form submission

        if (!newLocationName.trim()) {
            setError(intl.formatMessage({ id: 'locations.error.nameEmpty', defaultMessage: 'Location name cannot be empty.' }));
            return;
        }
        // Only add if the provider is configured and addLocation exists
        if (!api.config.isConfigured || typeof api.addLocation !== 'function') {
             setError(api.config.isConfigured
                ? intl.formatMessage({ id: 'locations.addForm.notSupported', defaultMessage: 'Adding locations is not supported by the current API Provider.' })
                : intl.formatMessage({ id: 'common.status.apiNotConfigured', defaultMessage: 'API Provider is not configured. Please configure it in Settings.' })
             );
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
                setSuccess(intl.formatMessage({ id: 'locations.success.add', defaultMessage: 'Location "{name}" added successfully!' }, { name: newLocationName.trim() }));
                setNewLocationName('');
                setNewLocationDescription('');
                await new Promise(resolve => setTimeout(resolve, 250)); // Add delay before refetch
                fetchLocations(); // Refresh the list
            } else {
                // Should ideally not happen if addLocation throws errors, but handle just in case
                setError(intl.formatMessage({ id: 'locations.error.add', defaultMessage: 'Failed to add location: {error}' }, { error: result.message || intl.formatMessage({ id: 'common.error.unknown', defaultMessage: 'Unknown reason' }) }));
            }
        } catch (err) {
            console.error("Failed to add location:", err);
            setError(intl.formatMessage({ id: 'locations.error.add', defaultMessage: 'Failed to add location: {error}' }, { error: err.message }));
        } finally {
            setLoading(false);
        }
    };

    // --- Edit Handlers ---
    const handleEditClick = (location) => {
        setEditingLocationId(location.location_id);
        setEditName(location.name);
        setEditDescription(location.description || ''); // Handle null description
        setUpdateError(null); // Clear previous edit errors
        setSuccess(null); // Clear success messages
        setError(null); // Clear general errors
    };

    const handleCancelEdit = () => {
        setEditingLocationId(null);
        setEditName('');
        setEditDescription('');
        setUpdateError(null);
    };

    const handleUpdateLocation = async (e) => { // Make async
        e.preventDefault();
        if (!editingLocationId || !editName.trim() || typeof api.updateLocation !== 'function') {
            setUpdateError(intl.formatMessage({ id: 'locations.error.updateInvalid', defaultMessage: 'Cannot update. Invalid data or update function unavailable.' }));
            return;
        }

        setIsUpdating(true);
        setUpdateError(null);
        setSuccess(null);

        try {
            const result = await api.updateLocation(editingLocationId, {
                name: editName.trim(),
                description: editDescription.trim() || null
            });

            if (result.success) {
                setSuccess(intl.formatMessage({ id: 'locations.success.update', defaultMessage: 'Location "{name}" updated successfully!' }, { name: editName.trim() }));
                handleCancelEdit(); // Close modal
                fetchLocations(); // Refresh list
            } else {
                // Should ideally not happen if updateLocation throws errors
                setUpdateError(intl.formatMessage({ id: 'locations.error.update', defaultMessage: 'Failed to update location: {error}' }, { error: result.message || intl.formatMessage({ id: 'common.error.unknown', defaultMessage: 'Unknown reason' }) }));
            }
        } catch (err) {
            console.error("Failed to update location:", err); // Keep console error in English
            setUpdateError(intl.formatMessage({ id: 'locations.error.update', defaultMessage: 'Failed to update location: {error}' }, { error: err.message }));
        } finally {
            // Add a small delay before resetting loading state if successful
            const wasSuccessful = !!success; // Capture success state before potential async delay
            if (wasSuccessful) {
                await new Promise(resolve => setTimeout(resolve, 100)); // 100ms delay
            }
            setIsUpdating(false);
        }
    };

    // --- Delete Handlers ---
    const handleDeleteClick = (locationId) => {
        // Open confirmation modal (can be called from within edit modal)
        setDeleteCandidateId(locationId);
        setShowDeleteConfirm(true);
        setDeleteError(null); // Clear previous delete errors
    };

    const handleCancelDelete = () => {
        setShowDeleteConfirm(false);
        setDeleteCandidateId(null);
        setDeleteError(null);
    };

    const handleConfirmDelete = async () => { // Make async
        if (!deleteCandidateId || typeof api.deleteLocation !== 'function' || typeof api.listItems !== 'function') {
            setDeleteError(intl.formatMessage({ id: 'locations.error.deleteInvalid', defaultMessage: 'Cannot delete. Invalid data or required API functions unavailable.' }));
            return;
        }

        setIsDeleting(true);
        setDeleteError(null);
        setSuccess(null);

        try {
            // 1. Check if any items use this location
            const items = await api.listItems();
            const isLocationInUse = items.some(item => item.location_id === deleteCandidateId);

            if (isLocationInUse) {
                throw new Error(intl.formatMessage({ id: 'locations.error.deleteInUse', defaultMessage: 'Cannot delete location because it is currently assigned to one or more items.' }));
            }

            // 2. Proceed with deletion if not in use
            const result = await api.deleteLocation(deleteCandidateId);
            if (result.success) {
                setSuccess(intl.formatMessage({ id: 'locations.success.delete', defaultMessage: 'Location deleted successfully!' }));
                handleCancelDelete(); // Close confirmation modal
                handleCancelEdit(); // Close edit modal as well if open
                fetchLocations(); // Refresh list
            } else {
                // Should ideally not happen if deleteLocation throws errors
                setDeleteError(intl.formatMessage({ id: 'locations.error.delete', defaultMessage: 'Failed to delete location: {error}' }, { error: result.message || intl.formatMessage({ id: 'common.error.unknown', defaultMessage: 'Unknown reason' }) }));
            }
        } catch (err) { // err might already be translated if thrown above
            console.error("Failed to delete location:", err);
            // Use intl for consistency, check if message is already translated from the 'in use' check
            const isAlreadyTranslated = ['assigned to one or more items', 'liitetty yhteen tai useampaan vaatteeseen'].some(phrase => err.message.includes(phrase));
            const errorMessage = isAlreadyTranslated
                ? err.message // Already translated
                : intl.formatMessage({ id: 'locations.error.delete', defaultMessage: 'Failed to delete location: {error}' }, { error: err.message });
            setDeleteError(errorMessage);
        } finally {
            // Add a small delay before resetting loading state if successful
            const wasSuccessful = !!success; // Capture success state before potential async delay
            if (wasSuccessful) {
                await new Promise(resolve => setTimeout(resolve, 100)); // 100ms delay
            }
            setIsDeleting(false);
        }
    };


    return (
        <div className="locations-view">
            <h2>{intl.formatMessage({ id: 'locations.title', defaultMessage: 'Locations Management' })}</h2>

            {/* Status Messages */}
            {loading && <p className="status-loading">{intl.formatMessage({ id: 'locations.loading', defaultMessage: 'Loading locations...' })}</p>}
            {error && <p className="status-error">Error: {error}</p>}
            {success && <p className="status-success">{success}</p>}

            {/* Add Location Form */}
            {!api.config.isConfigured ? (
                 <p className="status-warning">{intl.formatMessage({ id: 'common.status.apiNotConfigured' })}</p>
            ) : typeof api.addLocation !== 'function' ? (
                 <p className="status-warning">{intl.formatMessage({ id: 'locations.addForm.notSupported', defaultMessage: 'Adding locations is not supported by the current API Provider.' })}</p>
            ) : (
                <form onSubmit={handleAddLocation} className="add-location-form">
                    <h3>{intl.formatMessage({ id: 'locations.addForm.title', defaultMessage: 'Add New Location' })}</h3>
                    <div className="form-group">
                        <label htmlFor="location-name">{intl.formatMessage({ id: 'locations.addForm.nameLabel', defaultMessage: 'Name:' })}</label>
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
                        <label htmlFor="location-description">{intl.formatMessage({ id: 'locations.addForm.descriptionLabel', defaultMessage: 'Description:' })}</label>
                        <input
                            type="text"
                            id="location-description"
                            value={newLocationDescription}
                            onChange={(e) => setNewLocationDescription(e.target.value)}
                            disabled={loading}
                        />
                    </div>
                    <button type="submit" disabled={loading || !newLocationName.trim()} className="button-primary">
                        {loading ? intl.formatMessage({ id: 'locations.addForm.button.adding', defaultMessage: 'Adding...' }) : intl.formatMessage({ id: 'locations.addForm.button.add', defaultMessage: 'Add Location' })}
                    </button>
                </form>
            )}


            {/* Locations List */}
            <h3>{intl.formatMessage({ id: 'locations.list.title', defaultMessage: 'Existing Locations' })}</h3>
             {typeof api.listLocations !== 'function' && api.config.isConfigured && (
                 <p className="status-warning">{intl.formatMessage({ id: 'locations.list.notSupported', defaultMessage: 'Listing locations is not supported by the current API Provider.' })}</p>
             )}
             {typeof api.listLocations === 'function' && !loading && locations.length === 0 && !error && api.config.isConfigured && (
                <p>{intl.formatMessage({ id: 'locations.list.empty', defaultMessage: 'No locations found. Add one above!' })}</p>
             )}
             {typeof api.listLocations === 'function' && locations.length > 0 && (
                <div className="locations-list"> {/* Use div for card container */}
                    {locations.map((loc) => (
                        <div key={loc.location_id} className="location-card">
                            <h4>{loc.name}</h4>
                            {loc.description && <p>{loc.description}</p>}
                            {/* Show Edit button only if provider configured and update method exists - Use button-light */}
                            {api.config.isConfigured && typeof api.updateLocation === 'function' && (
                                <button
                                    onClick={() => handleEditClick(loc)}
                                    className="edit-button button-light" /* Add button-light */
                                    aria-label={intl.formatMessage({ id: 'locations.editButton.label', defaultMessage: 'Edit {name}' }, { name: loc.name })}
                                    disabled={loading || isUpdating || isDeleting}
                                >
                                    {intl.formatMessage({ id: 'common.edit', defaultMessage: 'Edit' })}
                                </button>
                            )}
                        </div>
                    ))}
                </div>
             )}

            {/* Edit Location Modal */}
            {editingLocationId && (
                <Modal show={!!editingLocationId} onClose={handleCancelEdit} title={intl.formatMessage({ id: 'locations.editModal.title', defaultMessage: 'Edit Location' })}>
                    <form onSubmit={handleUpdateLocation} className="edit-location-form">
                        {updateError && <p className="status-error">Error: {updateError}</p>}
                        <div className="form-group">
                            <label htmlFor="edit-location-name">{intl.formatMessage({ id: 'locations.addForm.nameLabel', defaultMessage: 'Name:' })}</label>
                            <input
                                type="text"
                                id="edit-location-name"
                                value={editName}
                                onChange={(e) => setEditName(e.target.value)}
                                required
                                disabled={isUpdating || isDeleting} // Disable during update or delete
                            />
                        </div>
                        <div className="form-group">
                            <label htmlFor="edit-location-description">{intl.formatMessage({ id: 'locations.addForm.descriptionLabel', defaultMessage: 'Description:' })}</label>
                            <input
                                type="text"
                                id="edit-location-description"
                                value={editDescription}
                                onChange={(e) => setEditDescription(e.target.value)}
                                disabled={isUpdating || isDeleting} // Disable during update or delete
                            />
                        </div>
                        <div className="modal-actions">
                             <button type="submit" disabled={isUpdating || isDeleting || !editName.trim()} className="button-primary">
                                {isUpdating ? intl.formatMessage({ id: 'common.saving', defaultMessage: 'Saving...' }) : intl.formatMessage({ id: 'common.saveChanges', defaultMessage: 'Save Changes' })}
                            </button>
                            {/* Use button-danger for delete */}
                            {api.config.isConfigured && typeof api.deleteLocation === 'function' && typeof api.listItems === 'function' && (
                                <button
                                    type="button"
                                    className="button-danger"
                                    onClick={() => handleDeleteClick(editingLocationId)}
                                    disabled={isUpdating || isDeleting}
                                >
                                    {intl.formatMessage({ id: 'common.delete', defaultMessage: 'Delete' })}
                                </button>
                            )}
                            {/* Use button-secondary for cancel */}
                            <button type="button" onClick={handleCancelEdit} disabled={isUpdating || isDeleting} className="button-secondary">
                                {intl.formatMessage({ id: 'common.cancel', defaultMessage: 'Cancel' })}
                            </button>
                        </div>
                    </form>
                </Modal>
            )}

            {/* Delete Confirmation Modal */}
            {showDeleteConfirm && (
                <Modal show={showDeleteConfirm} onClose={handleCancelDelete} title={intl.formatMessage({ id: 'locations.deleteModal.title', defaultMessage: 'Confirm Deletion' })}>
                    <div className="delete-confirm-content">
                        {deleteError && <p className="status-error">Error: {deleteError}</p>}
                        <p>
                            {intl.formatMessage({ id: 'locations.deleteModal.confirmMessage', defaultMessage: 'Are you sure you want to delete the location "{name}"? This action cannot be undone.' }, { name: locations.find(l => l.location_id === deleteCandidateId)?.name || '' })}
                        </p>
                        <div className="modal-actions">
                            {/* Use button-danger for confirm delete */}
                            <button onClick={handleConfirmDelete} disabled={isDeleting} className="button-danger">
                                {isDeleting ? intl.formatMessage({ id: 'common.deleting', defaultMessage: 'Deleting...' }) : intl.formatMessage({ id: 'common.confirmDelete', defaultMessage: 'Confirm Delete' })}
                            </button>
                            {/* Use button-secondary for cancel */}
                            <button onClick={handleCancelDelete} disabled={isDeleting} className="button-secondary">
                                {intl.formatMessage({ id: 'common.cancel', defaultMessage: 'Cancel' })}
                            </button>
                        </div>
                    </div>
                </Modal>
             )}

        </div>
    );
};

export default LocationsView;
