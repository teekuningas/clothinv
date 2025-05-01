import React, { useState, useEffect, useCallback } from 'react';
import { useApi } from '../api/ApiContext'; // Import useApi hook
import './CategoriesView.css'; // Import CSS (create this file next)

const CategoriesView = () => {
    const [categories, setCategories] = useState([]);
    const [newCategoryName, setNewCategoryName] = useState('');
    const [newCategoryDescription, setNewCategoryDescription] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [success, setSuccess] = useState(null);
    const api = useApi(); // Get API methods from context

    // Function to fetch categories
    const fetchCategories = useCallback(async () => {
        // Only fetch if the provider is configured and listCategories exists
        if (!api.config.isConfigured || typeof api.listCategories !== 'function') {
            setCategories([]); // Clear categories if not configured
            setError(api.config.isConfigured ? "listCategories method not available for this provider." : "API Provider not configured.");
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
            setError(`Failed to fetch categories: ${err.message}`);
            setCategories([]); // Clear categories on error
        } finally {
            setLoading(false);
        }
    }, [api]); // Dependency: re-run if api object (methods/config) changes

    // Fetch categories on component mount and when fetchCategories changes
    useEffect(() => {
        fetchCategories();
    }, [fetchCategories]);

    // Function to handle adding a new category
    const handleAddCategory = async (e) => {
        e.preventDefault(); // Prevent default form submission

        if (!newCategoryName.trim()) {
            setError("Category name cannot be empty.");
            return;
        }
        // Only add if the provider is configured and addCategory exists
        if (!api.config.isConfigured || typeof api.addCategory !== 'function') {
             setError(api.config.isConfigured ? "addCategory method not available for this provider." : "API Provider not configured.");
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
                setSuccess(`Category "${newCategoryName}" added successfully!`);
                setNewCategoryName('');
                setNewCategoryDescription('');
                fetchCategories(); // Refresh the list
            } else {
                // Should ideally not happen if addCategory throws errors, but handle just in case
                setError("Failed to add category for an unknown reason.");
            }
        } catch (err) {
            console.error("Failed to add category:", err);
            setError(`Failed to add category: ${err.message}`);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="categories-view"> {/* Use categories-view class */}
            <h2>Categories Management</h2>

            {/* Status Messages */}
            {loading && <p className="status-loading">Loading...</p>}
            {error && <p className="status-error">Error: {error}</p>}
            {success && <p className="status-success">{success}</p>}

            {/* Add Category Form */}
            {!api.config.isConfigured ? (
                 <p className="status-warning">API Provider is not configured. Please configure it in Settings.</p>
            ) : typeof api.addCategory !== 'function' ? (
                 <p className="status-warning">Adding categories is not supported by the current API Provider.</p>
            ) : (
                <form onSubmit={handleAddCategory} className="add-category-form"> {/* Use add-category-form class */}
                    <h3>Add New Category</h3>
                    <div className="form-group">
                        <label htmlFor="category-name">Name:</label>
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
                        <label htmlFor="category-description">Description:</label>
                        <input
                            type="text"
                            id="category-description"
                            value={newCategoryDescription}
                            onChange={(e) => setNewCategoryDescription(e.target.value)}
                            disabled={loading}
                        />
                    </div>
                    <button type="submit" disabled={loading || !newCategoryName.trim()}>
                        {loading ? 'Adding...' : 'Add Category'}
                    </button>
                </form>
            )}


            {/* Categories List */}
            <h3>Existing Categories</h3>
             {typeof api.listCategories === 'function' && !loading && categories.length === 0 && !error && (
                 <p>No categories found.</p>
             )}
             {typeof api.listCategories === 'function' && categories.length > 0 && (
                <ul className="categories-list"> {/* Use categories-list class */}
                    {categories.map((cat) => (
                        <li key={cat.category_id}>
                            <strong>{cat.name}</strong>
                            {cat.description && <span> - {cat.description}</span>}
                            {/* Add Edit/Delete buttons here later */}
                        </li>
                    ))}
                </ul>
             )}
             {typeof api.listCategories !== 'function' && api.config.isConfigured && (
                 <p className="status-warning">Listing categories is not supported by the current API Provider.</p>
             )}

        </div>
    );
};

export default CategoriesView;
