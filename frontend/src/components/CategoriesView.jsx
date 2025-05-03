import React, { useState, useEffect, useCallback } from 'react';
import { useApi } from '../api/ApiContext'; // Import useApi hook
import { useIntl } from 'react-intl'; // Import useIntl
import './CategoriesView.css'; // Import CSS
import Modal from './Modal'; // Import the Modal component

const CategoriesView = () => {
    const [categories, setCategories] = useState([]);
    const [newCategoryName, setNewCategoryName] = useState('');
    const [newCategoryDescription, setNewCategoryDescription] = useState('');
    const [loading, setLoading] = useState(false); // For initial list loading and adding
    const [error, setError] = useState(null); // For list loading and adding errors
    const [success, setSuccess] = useState(null); // For general success messages (add, update, delete)
    const [editingCategoryId, setEditingCategoryId] = useState(null); // ID of category being edited
    const [editName, setEditName] = useState(''); // Name in edit form
    const [editDescription, setEditDescription] = useState(''); // Description in edit form
    const [isUpdating, setIsUpdating] = useState(false); // Loading state for update operation
    const [updateError, setUpdateError] = useState(null); // Error specific to update operation
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false); // Show delete confirmation modal
    const [deleteCandidateId, setDeleteCandidateId] = useState(null); // ID of category to potentially delete
    const [isDeleting, setIsDeleting] = useState(false); // Loading state for delete operation
    const [deleteError, setDeleteError] = useState(null); // Error specific to delete operation

    const api = useApi(); // Get API methods from context
    const intl = useIntl(); // Get intl object

    // Function to fetch categories
    const fetchCategories = useCallback(async () => {
        // Only fetch if the provider is configured and listCategories exists
        if (!api.config.isConfigured || typeof api.listCategories !== 'function') {
            setCategories([]); // Clear categories if not configured or function missing
            setError(api.config.isConfigured
                ? intl.formatMessage({ id: 'categories.list.notSupported', defaultMessage: 'Listing categories is not supported by the current API Provider.' })
                : intl.formatMessage({ id: 'common.status.apiNotConfigured', defaultMessage: 'API Provider is not configured. Please configure it in Settings.' })
            );
            return;
        }

        setLoading(true);
        setError(null);
        setSuccess(null); // Clear previous success messages
        try {
            const data = await api.listCategories();
            setCategories(data || []); // Ensure data is an array
        } catch (err) {
            console.error("Failed to fetch categories:", err);
            setError(intl.formatMessage({ id: 'categories.error.fetch', defaultMessage: 'Failed to fetch categories: {error}' }, { error: err.message }));
            setCategories([]); // Clear categories on error
        } finally {
            setLoading(false);
        }
    }, [api, intl]); // Add intl to dependencies

    // Fetch categories on component mount and when fetchCategories changes
    useEffect(() => {
        fetchCategories();
    }, [fetchCategories]);

    // Function to handle adding a new category
    const handleAddCategory = async (e) => { // Make async
        e.preventDefault(); // Prevent default form submission

        if (!newCategoryName.trim()) {
            setError(intl.formatMessage({ id: 'categories.error.nameEmpty', defaultMessage: 'Category name cannot be empty.' }));
            return;
        }
        // Only add if the provider is configured and addCategory exists
        if (!api.config.isConfigured || typeof api.addCategory !== 'function') {
             setError(api.config.isConfigured
                ? intl.formatMessage({ id: 'categories.addForm.notSupported', defaultMessage: 'Adding categories is not supported by the current API Provider.' })
                : intl.formatMessage({ id: 'common.status.apiNotConfigured', defaultMessage: 'API Provider is not configured. Please configure it in Settings.' })
             );
            return;
        }

        setLoading(true);
        setError(null);
        setSuccess(null);

        try {
            const result = await api.addCategory({
                name: newCategoryName.trim(),
                description: newCategoryDescription.trim() || null // Send null if description is empty
            });

            if (result.success) {
                setSuccess(intl.formatMessage({ id: 'categories.success.add', defaultMessage: 'Category "{name}" added successfully!' }, { name: newCategoryName.trim() }));
                setNewCategoryName('');
                setNewCategoryDescription('');
                await new Promise(resolve => setTimeout(resolve, 250)); // Add delay before refetch
                fetchCategories(); // Refresh the list
            } else {
                // Should ideally not happen if addCategory throws errors, but handle just in case
                setError(intl.formatMessage({ id: 'categories.error.add', defaultMessage: 'Failed to add category: {error}' }, { error: result.message || intl.formatMessage({ id: 'common.error.unknown', defaultMessage: 'Unknown reason' }) }));
            }
        } catch (err) {
            console.error("Failed to add category:", err); // Keep console error in English
            // Use intl for consistency, even if the message might be technical
            setError(intl.formatMessage({ id: 'categories.error.add', defaultMessage: 'Failed to add category: {error}' }, { error: err.message }));
        } finally {
            setLoading(false);
        }
    };

    // --- Edit Handlers ---
    const handleEditClick = (category) => {
        setEditingCategoryId(category.category_id);
        setEditName(category.name);
        setEditDescription(category.description || ''); // Handle null description
        setUpdateError(null); // Clear previous edit errors
        setSuccess(null); // Clear success messages
        setError(null); // Clear general errors
    };

    const handleCancelEdit = () => {
        setEditingCategoryId(null);
        setEditName('');
        setEditDescription('');
        setUpdateError(null);
    };

    const handleUpdateCategory = async (e) => { // Make async
        e.preventDefault();
        if (!editingCategoryId || !editName.trim() || typeof api.updateCategory !== 'function') {
            setUpdateError(intl.formatMessage({ id: 'categories.error.updateInvalid', defaultMessage: 'Cannot update. Invalid data or update function unavailable.' }));
            return;
        }

        setIsUpdating(true);
        setUpdateError(null);
        setSuccess(null);

        try {
            const result = await api.updateCategory(editingCategoryId, {
                name: editName.trim(),
                description: editDescription.trim() || null
            });

            if (result.success) {
                setSuccess(intl.formatMessage({ id: 'categories.success.update', defaultMessage: 'Category "{name}" updated successfully!' }, { name: editName.trim() }));
                handleCancelEdit(); // Close modal
                fetchCategories(); // Refresh list
            } else {
                // Should ideally not happen if updateCategory throws errors
                setUpdateError(intl.formatMessage({ id: 'categories.error.update', defaultMessage: 'Failed to update category: {error}' }, { error: result.message || intl.formatMessage({ id: 'common.error.unknown', defaultMessage: 'Unknown reason' }) }));
            }
        } catch (err) {
            console.error("Failed to update category:", err); // Keep console error in English
            // Use intl for consistency
            setUpdateError(intl.formatMessage({ id: 'categories.error.update', defaultMessage: 'Failed to update category: {error}' }, { error: err.message }));
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
    const handleDeleteClick = (categoryId) => {
        // Open confirmation modal (can be called from within edit modal)
        setDeleteCandidateId(categoryId);
        setShowDeleteConfirm(true);
        setDeleteError(null); // Clear previous delete errors
    };

    const handleCancelDelete = () => {
        setShowDeleteConfirm(false);
        setDeleteCandidateId(null);
        setDeleteError(null);
    };

    const handleConfirmDelete = async () => { // Make async
        if (!deleteCandidateId || typeof api.deleteCategory !== 'function' || typeof api.listItems !== 'function') {
            setDeleteError(intl.formatMessage({ id: 'categories.error.deleteInvalid', defaultMessage: 'Cannot delete. Invalid data or required API functions unavailable.' }));
            return;
        }

        setIsDeleting(true);
        setDeleteError(null);
        setSuccess(null);

        try {
            // 1. Check if any items use this category
            const items = await api.listItems();
            const isCategoryInUse = items.some(item => item.category_id === deleteCandidateId);

            if (isCategoryInUse) {
                throw new Error(intl.formatMessage({ id: 'categories.error.deleteInUse', defaultMessage: 'Cannot delete category because it is currently assigned to one or more items.' }));
            }

            // 2. Proceed with deletion if not in use
            const result = await api.deleteCategory(deleteCandidateId);
            if (result.success) {
                setSuccess(intl.formatMessage({ id: 'categories.success.delete', defaultMessage: 'Category deleted successfully!' }));
                handleCancelDelete(); // Close confirmation modal
                handleCancelEdit(); // Close edit modal as well if open
                fetchCategories(); // Refresh list
            } else {
                // Should ideally not happen if deleteCategory throws errors
                setDeleteError(intl.formatMessage({ id: 'categories.error.delete', defaultMessage: 'Failed to delete category: {error}' }, { error: result.message || intl.formatMessage({ id: 'common.error.unknown', defaultMessage: 'Unknown reason' }) }));
            }
        } catch (err) { // err might already be translated if thrown above
            console.error("Failed to delete category:", err);
            // Use intl for consistency, check if message is already translated from the 'in use' check
            // Simple check for keywords - adjust if needed for more robust language detection
            const isAlreadyTranslated = ['assigned to one or more items', 'liitetty yhteen tai useampaan vaatteeseen'].some(phrase => err.message.includes(phrase));
            const errorMessage = isAlreadyTranslated
                ? err.message // Already translated
                : intl.formatMessage({ id: 'categories.error.delete', defaultMessage: 'Failed to delete category: {error}' }, { error: err.message });
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
        <div className="categories-view"> {/* Use categories-view class */}
            <h2>{intl.formatMessage({ id: 'categories.title', defaultMessage: 'Categories Management' })}</h2>

            {/* Status Messages */}
            {loading && <p className="status-loading">{intl.formatMessage({ id: 'categories.loading', defaultMessage: 'Loading categories...' })}</p>}
            {error && <p className="status-error">Error: {error}</p>}
            {success && <p className="status-success">{success}</p>}

            {/* Add Category Form */}
            {!api.config.isConfigured ? (
                 <p className="status-warning">{intl.formatMessage({ id: 'common.status.apiNotConfigured' })}</p>
            ) : typeof api.addCategory !== 'function' ? (
                 <p className="status-warning">{intl.formatMessage({ id: 'categories.addForm.notSupported', defaultMessage: 'Adding categories is not supported by the current API Provider.' })}</p>
            ) : (
                <form onSubmit={handleAddCategory} className="add-category-form"> {/* Use add-category-form class */}
                    <h3>{intl.formatMessage({ id: 'categories.addForm.title', defaultMessage: 'Add New Category' })}</h3>
                    <div className="form-group">
                        <label htmlFor="category-name">{intl.formatMessage({ id: 'categories.addForm.nameLabel', defaultMessage: 'Name:' })}</label>
                        <input
                            type="text"
                            id="category-name"
                            value={newCategoryName}
                            onChange={(e) => setNewCategoryName(e.target.value)}
                            required
                            disabled={loading}
                        />
                    </div>
                    <div className="form-group">
                        <label htmlFor="category-description">{intl.formatMessage({ id: 'categories.addForm.descriptionLabel', defaultMessage: 'Description:' })}</label>
                        <input
                            type="text"
                            id="category-description"
                            value={newCategoryDescription}
                            onChange={(e) => setNewCategoryDescription(e.target.value)}
                            disabled={loading}
                        />
                    </div>
                    <button type="submit" disabled={loading || !newCategoryName.trim()} className="button-primary">
                        {loading ? intl.formatMessage({ id: 'categories.addForm.button.adding', defaultMessage: 'Adding...' }) : intl.formatMessage({ id: 'categories.addForm.button.add', defaultMessage: 'Add Category' })}
                    </button>
                </form>
            )}


            {/* Categories List */}
            <h3>{intl.formatMessage({ id: 'categories.list.title', defaultMessage: 'Existing Categories' })}</h3>
            {typeof api.listCategories !== 'function' && api.config.isConfigured && (
                 <p className="status-warning">{intl.formatMessage({ id: 'categories.list.notSupported', defaultMessage: 'Listing categories is not supported by the current API Provider.' })}</p>
            )}
            {typeof api.listCategories === 'function' && !loading && categories.length === 0 && !error && api.config.isConfigured && (
                <p>{intl.formatMessage({ id: 'categories.list.empty', defaultMessage: 'No categories found. Add one above!' })}</p>
            )}
            {typeof api.listCategories === 'function' && categories.length > 0 && (
                <div className="categories-list"> {/* Use div for card container */}
                    {categories.map((cat) => (
                        <div key={cat.category_id} className="category-card">
                            <h4>{cat.name}</h4>
                            {cat.description && <p>{cat.description}</p>}
                            {/* Show Edit button only if provider configured and update method exists - Use button-light */}
                            {api.config.isConfigured && typeof api.updateCategory === 'function' && (
                                <button
                                    onClick={() => handleEditClick(cat)}
                                    className="edit-button button-light" /* Add button-light */
                                    aria-label={intl.formatMessage({ id: 'categories.editButton.label', defaultMessage: 'Edit {name}' }, { name: cat.name })}
                                    disabled={loading || isUpdating || isDeleting}
                                >
                                    {intl.formatMessage({ id: 'common.edit', defaultMessage: 'Edit' })}
                                </button>
                            )}
                        </div>
                    ))}
                </div>
            )}

            {/* Edit Category Modal */}
            {editingCategoryId && (
                <Modal show={!!editingCategoryId} onClose={handleCancelEdit} title={intl.formatMessage({ id: 'categories.editModal.title', defaultMessage: 'Edit Category' })}>
                    <form onSubmit={handleUpdateCategory} className="edit-category-form">
                        {updateError && <p className="status-error">Error: {updateError}</p>}
                        <div className="form-group">
                            <label htmlFor="edit-category-name">{intl.formatMessage({ id: 'categories.addForm.nameLabel', defaultMessage: 'Name:' })}</label>
                            <input
                                type="text"
                                id="edit-category-name"
                                value={editName}
                                onChange={(e) => setEditName(e.target.value)}
                                required
                                disabled={isUpdating || isDeleting} // Disable during update or delete
                            />
                        </div>
                        <div className="form-group">
                            <label htmlFor="edit-category-description">{intl.formatMessage({ id: 'categories.addForm.descriptionLabel', defaultMessage: 'Description:' })}</label>
                            <input
                                type="text"
                                id="edit-category-description"
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
                            {api.config.isConfigured && typeof api.deleteCategory === 'function' && typeof api.listItems === 'function' && (
                                <button
                                    type="button"
                                    className="button-danger"
                                    onClick={() => handleDeleteClick(editingCategoryId)}
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
                <Modal show={showDeleteConfirm} onClose={handleCancelDelete} title={intl.formatMessage({ id: 'categories.deleteModal.title', defaultMessage: 'Confirm Deletion' })}>
                    <div className="delete-confirm-content">
                        {deleteError && <p className="status-error">Error: {deleteError}</p>}
                        <p>
                            {intl.formatMessage({ id: 'categories.deleteModal.confirmMessage', defaultMessage: 'Are you sure you want to delete the category "{name}"? This action cannot be undone.' }, { name: categories.find(c => c.category_id === deleteCandidateId)?.name || '' })}
                        </p>
                        {/* Removed redundant "This action cannot be undone." as it's included above */}
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

export default CategoriesView;

// Add missing common key to en.json/fi.json if not already present:
/*
    "common.error.unknown": "Unknown reason" / "Tuntematon syy"
*/
