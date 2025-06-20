import React, { useState, useEffect, useCallback } from "react";
import { useApi } from "../api/ApiContext";
import { useIntl } from "react-intl";
import "./CategoriesView.css";
import Modal from "./Modal";

const CategoriesView = () => {
  const [categories, setCategories] = useState([]);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [newCategoryDescription, setNewCategoryDescription] = useState("");
  const [loading, setLoading] = useState(false); // For initial list loading and adding
  const [error, setError] = useState(null); // For list loading and adding errors
  const [success, setSuccess] = useState(null); // For general success messages (add, update, delete)
  const [editingCategoryId, setEditingCategoryId] = useState(null); // ID of category being edited
  const [editName, setEditName] = useState(""); // Name in edit form
  const [editDescription, setEditDescription] = useState(""); // Description in edit form
  const [isUpdating, setIsUpdating] = useState(false); // Loading state for update operation
  const [updateError, setUpdateError] = useState(null); // Error specific to update operation
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false); // Show delete confirmation modal
  const [deleteCandidateId, setDeleteCandidateId] = useState(null); // ID of category to potentially delete
  const [isDeleting, setIsDeleting] = useState(false); // Loading state for delete operation
  const [deleteError, setDeleteError] = useState(null); // Error specific to delete operation
  const [isAddCategoryModalOpen, setIsAddCategoryModalOpen] = useState(false);
  const [addCategoryError, setAddCategoryError] = useState(null);

  const api = useApi();
  const intl = useIntl();

  const fetchCategories = useCallback(async () => {
    if (!api.isConfigured || typeof api.listCategories !== "function") {
      setCategories([]); // Clear categories if not configured or function missing
      setError(
        api.isConfigured
          ? intl.formatMessage({
              id: "categories.list.notSupported",
              defaultMessage:
                "Listing categories is not supported by the current API Provider.",
            })
          : intl.formatMessage({
              id: "common.status.apiNotConfigured",
              defaultMessage:
                "API Provider is not configured. Please configure it in Settings.",
            }),
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
      setError(
        intl.formatMessage(
          {
            id: "categories.error.fetch",
            defaultMessage: "Failed to fetch categories: {error}",
          },
          { error: err.message },
        ),
      );
      setCategories([]); // Clear categories on error
    } finally {
      setLoading(false);
    }
  }, [api, intl]);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  const handleOpenAddCategoryModal = () => {
    setNewCategoryName("");
    setNewCategoryDescription("");
    setAddCategoryError(null); // Clear previous modal errors
    setError(null); // Clear general page errors
    setSuccess(null); // Clear success messages
    setIsAddCategoryModalOpen(true);
  };

  const handleCloseAddCategoryModal = () => {
    setIsAddCategoryModalOpen(false);
    setAddCategoryError(null); // Clear errors when closing
  };

  // Function to handle adding a new category
  const handleAddCategory = async (e) => {
    e.preventDefault();

    if (!newCategoryName.trim()) {
      setAddCategoryError(
        // Use modal-specific error state
        intl.formatMessage({
          id: "categories.error.nameEmpty",
          defaultMessage: "Category name cannot be empty.",
        }),
      );
      return;
    }
    // Only add if the provider is configured and addCategory exists
    if (!api.isConfigured || typeof api.addCategory !== "function") {
      setAddCategoryError(
        // Use modal-specific error state
        api.isConfigured
          ? intl.formatMessage({
              id: "categories.addForm.notSupported",
              defaultMessage:
                "Adding categories is not supported by the current API Provider.",
            })
          : intl.formatMessage({
              id: "common.status.apiNotConfigured",
              defaultMessage:
                "API Provider is not configured. Please configure it in Settings.",
            }),
      );
      return;
    }

    setLoading(true);
    setAddCategoryError(null); // Clear modal error

    try {
      const result = await api.addCategory({
        name: newCategoryName.trim(),
        description: newCategoryDescription.trim() || null, // Send null if description is empty
      });

      if (result.success) {
        // Fetch data, then close modal and show global success message
        fetchCategories().then(() => {
          handleCloseAddCategoryModal();
          setSuccess(
            intl.formatMessage(
              {
                id: "categories.success.add",
                defaultMessage: 'Category "{name}" added successfully!',
              },
              { name: newCategoryName.trim() },
            ),
          );
        });
      } else {
        // Should ideally not happen if addCategory throws errors, but handle just in case
        setAddCategoryError(
          // Use modal-specific error state
          intl.formatMessage(
            {
              id: "categories.error.add",
              defaultMessage: "Failed to add category: {error}",
            },
            {
              error:
                result.message ||
                intl.formatMessage({
                  id: "common.error.unknown",
                  defaultMessage: "Unknown reason",
                }),
            },
          ),
        );
      }
    } catch (err) {
      console.error("Failed to add category:", err);
      // Use intl for consistency, even if the message might be technical
      setAddCategoryError(
        // Use modal-specific error state
        intl.formatMessage(
          {
            id: "categories.error.add",
            defaultMessage: "Failed to add category: {error}",
          },
          { error: err.message },
        ),
      );
    } finally {
      setLoading(false);
    }
  };

  const handleEditClick = (category) => {
    setEditingCategoryId(category.category_id);
    setEditName(category.name);
    setEditDescription(category.description || ""); // Handle null description
    setUpdateError(null); // Clear previous edit errors
    setSuccess(null); // Clear success messages
    setError(null); // Clear general errors
  };

  const handleCancelEdit = () => {
    setEditingCategoryId(null);
    setEditName("");
    setEditDescription("");
    setUpdateError(null);
  };

  const handleUpdateCategory = async (e) => {
    // Make async
    e.preventDefault();
    if (
      !editingCategoryId ||
      !editName.trim() ||
      typeof api.updateCategory !== "function"
    ) {
      setUpdateError(
        intl.formatMessage({
          id: "categories.error.updateInvalid",
          defaultMessage:
            "Cannot update. Invalid data or update function unavailable.",
        }),
      );
      return;
    }

    setIsUpdating(true);
    setUpdateError(null);
    setSuccess(null);

    try {
      const result = await api.updateCategory({
        category_id: editingCategoryId,
        name: editName.trim(),
        description: editDescription.trim() || null,
      });

      if (result.success) {
        setSuccess(
          intl.formatMessage(
            {
              id: "categories.success.update",
              defaultMessage: 'Category "{name}" updated successfully!',
            },
            { name: editName.trim() },
          ),
        );
        handleCancelEdit(); // Close modal
        fetchCategories(); // Refresh list
      } else {
        // Should ideally not happen if updateCategory throws errors
        setUpdateError(
          intl.formatMessage(
            {
              id: "categories.error.update",
              defaultMessage: "Failed to update category: {error}",
            },
            {
              error:
                result.message ||
                intl.formatMessage({
                  id: "common.error.unknown",
                  defaultMessage: "Unknown reason",
                }),
            },
          ),
        );
      }
    } catch (err) {
      console.error("Failed to update category:", err);
      // Use intl for consistency
      setUpdateError(
        intl.formatMessage(
          {
            id: "categories.error.update",
            defaultMessage: "Failed to update category: {error}",
          },
          { error: err.message },
        ),
      );
    } finally {
      // Add a small delay before resetting loading state if successful
      const wasSuccessful = !!success; // Capture success state before potential async delay
      if (wasSuccessful) {
        await new Promise((resolve) => setTimeout(resolve, 100)); // 100ms delay
      }
      setIsUpdating(false);
    }
  };

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

  const handleConfirmDelete = async () => {
    // Make async
    if (
      !deleteCandidateId ||
      typeof api.deleteCategory !== "function" ||
      typeof api.listItems !== "function"
    ) {
      setDeleteError(
        intl.formatMessage({
          id: "categories.error.deleteInvalid",
          defaultMessage:
            "Cannot delete. Invalid data or required API functions unavailable.",
        }),
      );
      return;
    }

    setIsDeleting(true);
    setDeleteError(null);
    setSuccess(null);

    try {
      // Proceed with deletion - provider will check if in use
      const result = await api.deleteCategory({
        category_id: deleteCandidateId,
      });
      if (result.success) {
        setSuccess(
          intl.formatMessage({
            id: "categories.success.delete",
            defaultMessage: "Category deleted successfully!",
          }),
        );
        handleCancelDelete(); // Close confirmation modal
        handleCancelEdit(); // Close edit modal as well if open
        fetchCategories(); // Refresh list
      } else {
        if (result.errorCode === "ENTITY_IN_USE") {
          setDeleteError(
            intl.formatMessage({ id: "categories.error.deleteInUse" }),
          );
        } else {
          setDeleteError(
            intl.formatMessage(
              {
                id: "categories.error.delete",
                defaultMessage: "Failed to delete category: {error}",
              },
              {
                error:
                  result.message ||
                  intl.formatMessage({
                    id: "common.error.unknown",
                    defaultMessage: "Unknown reason",
                  }),
              },
            ),
          );
        }
      }
    } catch (err) {
      console.error("Failed to delete category:", err);
      setDeleteError(
        intl.formatMessage(
          {
            id: "categories.error.delete",
            defaultMessage: "Failed to delete category: {error}",
          },
          { error: err.message },
        ),
      );
    } finally {
      // Add a small delay before resetting loading state if successful
      const wasSuccessful = !!success; // Capture success state before potential async delay
      if (wasSuccessful) {
        await new Promise((resolve) => setTimeout(resolve, 100)); // 100ms delay
      }
      setIsDeleting(false);
    }
  };

  return (
    <div className="categories-view">
      {loading && (
        <p className="status-loading">
          {intl.formatMessage({
            id: "categories.loading",
            defaultMessage: "Loading categories...",
          })}
        </p>
      )}
      {error && <p className="status-error">Error: {error}</p>}
      {success && <p className="status-success">{success}</p>}
      {/* Add Category Form */}
      {!isAddCategoryModalOpen && !api.isConfigured ? (
        <p className="status-warning">
          {intl.formatMessage({ id: "common.status.apiNotConfigured" })}
        </p>
      ) : !isAddCategoryModalOpen &&
        api.isConfigured &&
        typeof api.addCategory !== "function" ? (
        <p className="status-warning">
          {intl.formatMessage({
            id: "categories.addForm.notSupported",
            defaultMessage:
              "Adding categories is not supported by the current API Provider.",
          })}
        </p>
      ) : null}
      {/* Categories List */}
      <h3>
        {intl.formatMessage({
          id: "categories.list.title",
          defaultMessage: "Existing Categories",
        })}
      </h3>
      {typeof api.listCategories !== "function" && api.isConfigured && (
        <p className="status-warning">
          {intl.formatMessage({
            id: "categories.list.notSupported",
            defaultMessage:
              "Listing categories is not supported by the current API Provider.",
          })}
        </p>
      )}
      {typeof api.listCategories === "function" &&
        !loading &&
        categories.length === 0 &&
        !error &&
        api.isConfigured && (
          <p>
            {intl.formatMessage({
              id: "categories.list.emptyFAB", // Updated key
              defaultMessage:
                "No categories found. Click the '+' button to add one.",
            })}
          </p>
        )}
      {typeof api.listCategories === "function" && categories.length > 0 && (
        <div className="categories-list">
          {categories.map((cat) => (
            <div key={cat.category_id} className="category-card">
              <h4>{cat.name}</h4>
              {cat.description && <p>{cat.description}</p>}
              {/* Show Edit button only if provider configured and update method exists - Use button-light */}
              {api.isConfigured && typeof api.updateCategory === "function" && (
                <button
                  onClick={() => handleEditClick(cat)}
                  className="edit-button button-light"
                  aria-label={intl.formatMessage(
                    {
                      id: "categories.editButton.label",
                      defaultMessage: "Edit {name}",
                    },
                    { name: cat.name },
                  )}
                  disabled={
                    !api.writeAllowed || loading || isUpdating || isDeleting
                  }
                >
                  ✏️
                </button>
              )}
            </div>
          ))}
        </div>
      )}
      {api.isConfigured && typeof api.addCategory === "function" && (
        <button
          type="button"
          className="add-category-fab button-primary"
          onClick={handleOpenAddCategoryModal}
          aria-label={intl.formatMessage({
            id: "categories.addCategoryFAB.label",
          })}
          disabled={!api.writeAllowed || loading || isUpdating || isDeleting}
        >
          +
        </button>
      )}
      {isAddCategoryModalOpen && (
        <Modal
          show={isAddCategoryModalOpen}
          onClose={handleCloseAddCategoryModal}
          title={intl.formatMessage({ id: "categories.addForm.title" })}
        >
          <form onSubmit={handleAddCategory} className="add-category-form">
            {addCategoryError && (
              <p className="status-error">Error: {addCategoryError}</p>
            )}
            <div className="form-group">
              <label htmlFor="category-name-modal">
                {intl.formatMessage({ id: "categories.addForm.nameLabel" })}
              </label>
              <input
                type="text"
                id="category-name-modal"
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
                required
                disabled={loading}
              />
            </div>
            <div className="form-group">
              <label htmlFor="category-description-modal">
                {intl.formatMessage({
                  id: "categories.addForm.descriptionLabel",
                })}
              </label>
              <input
                type="text"
                id="category-description-modal"
                value={newCategoryDescription}
                onChange={(e) => setNewCategoryDescription(e.target.value)}
                disabled={loading}
              />
            </div>
            <div className="modal-actions">
              <button
                type="submit"
                disabled={loading || !newCategoryName.trim()}
                className="button-primary"
              >
                {loading
                  ? intl.formatMessage({
                      id: "categories.addForm.button.adding",
                    })
                  : intl.formatMessage({ id: "categories.addForm.button.add" })}
              </button>
              <button
                type="button"
                onClick={handleCloseAddCategoryModal}
                disabled={loading}
                className="button-secondary"
              >
                {intl.formatMessage({ id: "common.cancel" })}
              </button>
            </div>
          </form>
        </Modal>
      )}
      {editingCategoryId && (
        <Modal
          show={!!editingCategoryId}
          onClose={handleCancelEdit}
          title={intl.formatMessage({
            id: "categories.editModal.title",
            defaultMessage: "Edit Category",
          })}
        >
          <form onSubmit={handleUpdateCategory} className="edit-category-form">
            {updateError && (
              <p className="status-error">Error: {updateError}</p>
            )}
            <div className="form-group">
              <label htmlFor="edit-category-name">
                {intl.formatMessage({
                  id: "categories.addForm.nameLabel",
                  defaultMessage: "Name:",
                })}
              </label>
              <input
                type="text"
                id="edit-category-name"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                required
                disabled={isUpdating || isDeleting}
              />
            </div>
            <div className="form-group">
              <label htmlFor="edit-category-description">
                {intl.formatMessage({
                  id: "categories.addForm.descriptionLabel",
                  defaultMessage: "Description:",
                })}
              </label>
              <input
                type="text"
                id="edit-category-description"
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                disabled={isUpdating || isDeleting}
              />
            </div>
            <div className="modal-actions">
              <button
                type="submit"
                disabled={
                  !api.writeAllowed ||
                  isUpdating ||
                  isDeleting ||
                  !editName.trim()
                }
                className="button-primary"
              >
                {isUpdating
                  ? intl.formatMessage({
                      id: "common.saving",
                      defaultMessage: "Saving...",
                    })
                  : intl.formatMessage({
                      id: "common.saveChanges",
                      defaultMessage: "Save Changes",
                    })}
              </button>
              {api.isConfigured &&
                typeof api.deleteCategory === "function" &&
                typeof api.listItems === "function" && (
                  <button
                    type="button"
                    className="button-danger"
                    onClick={() => handleDeleteClick(editingCategoryId)}
                    disabled={!api.writeAllowed || isUpdating || isDeleting}
                  >
                    {intl.formatMessage({
                      id: "common.delete",
                      defaultMessage: "Delete",
                    })}
                  </button>
                )}
              <button
                type="button"
                onClick={handleCancelEdit}
                disabled={isUpdating || isDeleting}
                className="button-secondary"
              >
                {intl.formatMessage({
                  id: "common.cancel",
                  defaultMessage: "Cancel",
                })}
              </button>
            </div>
          </form>
        </Modal>
      )}
      {showDeleteConfirm && (
        <Modal
          show={showDeleteConfirm}
          onClose={handleCancelDelete}
          title={intl.formatMessage({
            id: "categories.deleteModal.title",
            defaultMessage: "Confirm Deletion",
          })}
        >
          <div className="delete-confirm-content">
            {deleteError && (
              <p className="status-error">Error: {deleteError}</p>
            )}
            <p>
              {intl.formatMessage(
                {
                  id: "categories.deleteModal.confirmMessage",
                  defaultMessage:
                    'Are you sure you want to delete the category "{name}"? This action cannot be undone.',
                },
                {
                  name:
                    categories.find((c) => c.category_id === deleteCandidateId)
                      ?.name || "",
                },
              )}
            </p>
            <div className="modal-actions">
              <button
                onClick={handleConfirmDelete}
                disabled={!api.writeAllowed || isDeleting}
                className="button-danger"
              >
                {isDeleting
                  ? intl.formatMessage({
                      id: "common.deleting",
                      defaultMessage: "Deleting...",
                    })
                  : intl.formatMessage({
                      id: "common.confirmDelete",
                      defaultMessage: "Confirm Delete",
                    })}
              </button>
              <button
                onClick={handleCancelDelete}
                disabled={isDeleting}
                className="button-secondary"
              >
                {intl.formatMessage({
                  id: "common.cancel",
                  defaultMessage: "Cancel",
                })}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};

export default CategoriesView;
