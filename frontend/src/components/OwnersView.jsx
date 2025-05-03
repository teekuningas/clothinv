import React, { useState, useEffect, useCallback } from "react";
import { useApi } from "../api/ApiContext"; // Import useApi hook
import { useIntl } from "react-intl"; // Import useIntl
import "./OwnersView.css"; // Import CSS
import Modal from "./Modal"; // Import the Modal component

const OwnersView = () => {
  const [owners, setOwners] = useState([]);
  const [newOwnerName, setNewOwnerName] = useState("");
  const [newOwnerDescription, setNewOwnerDescription] = useState("");
  const [loading, setLoading] = useState(false); // For initial list loading and adding
  const [error, setError] = useState(null); // For list loading and adding errors
  const [success, setSuccess] = useState(null); // For general success messages (add, update, delete)
  const [editingOwnerId, setEditingOwnerId] = useState(null); // ID of owner being edited
  const [editName, setEditName] = useState(""); // Name in edit form
  const [editDescription, setEditDescription] = useState(""); // Description in edit form
  const [isUpdating, setIsUpdating] = useState(false); // Loading state for update operation
  const [updateError, setUpdateError] = useState(null); // Error specific to update operation
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false); // Show delete confirmation modal
  const [deleteCandidateId, setDeleteCandidateId] = useState(null); // ID of owner to potentially delete
  const [isDeleting, setIsDeleting] = useState(false); // Loading state for delete operation
  const [deleteError, setDeleteError] = useState(null); // Error specific to delete operation

  const api = useApi(); // Get API methods from context
  const intl = useIntl(); // Get intl object

  // Function to fetch owners
  const fetchOwners = useCallback(async () => {
    // Only fetch if the provider is configured and listOwners exists
    if (!api.config.isConfigured || typeof api.listOwners !== "function") {
      setOwners([]); // Clear owners if not configured or function missing
      setError(
        api.config.isConfigured
          ? intl.formatMessage({
              id: "owners.list.notSupported",
              defaultMessage:
                "Listing owners is not supported by the current API Provider.",
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
      const data = await api.listOwners();
      setOwners(data || []); // Ensure data is an array
    } catch (err) {
      console.error("Failed to fetch owners:", err);
      setError(
        intl.formatMessage(
          {
            id: "owners.error.fetch",
            defaultMessage: "Failed to fetch owners: {error}",
          },
          { error: err.message },
        ),
      );
      setOwners([]); // Clear owners on error
    } finally {
      setLoading(false);
    }
  }, [api, intl]); // Add intl to dependencies

  // Fetch owners on component mount and when fetchOwners changes
  useEffect(() => {
    fetchOwners();
  }, [fetchOwners]);

  // Function to handle adding a new owner
  const handleAddOwner = async (e) => {
    // Make async
    e.preventDefault(); // Prevent default form submission

    if (!newOwnerName.trim()) {
      setError(
        intl.formatMessage({
          id: "owners.error.nameEmpty",
          defaultMessage: "Owner name cannot be empty.",
        }),
      );
      return;
    }
    // Only add if the provider is configured and addOwner exists
    if (!api.config.isConfigured || typeof api.addOwner !== "function") {
      setError(
        api.config.isConfigured
          ? intl.formatMessage({
              id: "owners.addForm.notSupported",
              defaultMessage:
                "Adding owners is not supported by the current API Provider.",
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
    setSuccess(null);

    try {
      const result = await api.addOwner({
        name: newOwnerName.trim(),
        description: newOwnerDescription.trim() || null, // Send null if description is empty
      });

      if (result.success) {
        setSuccess(
          intl.formatMessage(
            {
              id: "owners.success.add",
              defaultMessage: 'Owner "{name}" added successfully!',
            },
            { name: newOwnerName.trim() },
          ),
        );
        setNewOwnerName("");
        setNewOwnerDescription("");
        await new Promise((resolve) => setTimeout(resolve, 250)); // Add delay before refetch
        fetchOwners(); // Refresh the list
      } else {
        // Should ideally not happen if addOwner throws errors, but handle just in case
        setError(
          intl.formatMessage(
            {
              id: "owners.error.add",
              defaultMessage: "Failed to add owner: {error}",
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
      console.error("Failed to add owner:", err); // Keep console error in English
      // Use intl for consistency, even if the message might be technical
      setError(
        intl.formatMessage(
          {
            id: "owners.error.add",
            defaultMessage: "Failed to add owner: {error}",
          },
          { error: err.message },
        ),
      );
    } finally {
      setLoading(false);
    }
  };

  // --- Edit Handlers ---
  const handleEditClick = (owner) => {
    setEditingOwnerId(owner.owner_id);
    setEditName(owner.name);
    setEditDescription(owner.description || ""); // Handle null description
    setUpdateError(null); // Clear previous edit errors
    setSuccess(null); // Clear success messages
    setError(null); // Clear general errors
  };

  const handleCancelEdit = () => {
    setEditingOwnerId(null);
    setEditName("");
    setEditDescription("");
    setUpdateError(null);
  };

  const handleUpdateOwner = async (e) => {
    // Make async
    e.preventDefault();
    if (
      !editingOwnerId ||
      !editName.trim() ||
      typeof api.updateOwner !== "function"
    ) {
      setUpdateError(
        intl.formatMessage({
          id: "owners.error.updateInvalid",
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
      const result = await api.updateOwner(editingOwnerId, {
        name: editName.trim(),
        description: editDescription.trim() || null,
      });

      if (result.success) {
        setSuccess(
          intl.formatMessage(
            {
              id: "owners.success.update",
              defaultMessage: 'Owner "{name}" updated successfully!',
            },
            { name: editName.trim() },
          ),
        );
        handleCancelEdit(); // Close modal
        fetchOwners(); // Refresh list
      } else {
        // Should ideally not happen if updateOwner throws errors
        setUpdateError(
          intl.formatMessage(
            {
              id: "owners.error.update",
              defaultMessage: "Failed to update owner: {error}",
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
      console.error("Failed to update owner:", err); // Keep console error in English
      // Use intl for consistency
      setUpdateError(
        intl.formatMessage(
          {
            id: "owners.error.update",
            defaultMessage: "Failed to update owner: {error}",
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

  // --- Delete Handlers ---
  const handleDeleteClick = (ownerId) => {
    // Open confirmation modal (can be called from within edit modal)
    setDeleteCandidateId(ownerId);
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
      typeof api.deleteOwner !== "function" ||
      typeof api.listItems !== "function"
    ) {
      setDeleteError(
        intl.formatMessage({
          id: "owners.error.deleteInvalid",
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
      // 1. Check if any items use this owner
      const items = await api.listItems();
      const isOwnerInUse = items.some(
        (item) => item.owner_id === deleteCandidateId,
      );

      if (isOwnerInUse) {
        throw new Error(
          intl.formatMessage({
            id: "owners.error.deleteInUse",
            defaultMessage:
              "Cannot delete owner because it is currently assigned to one or more items.",
          }),
        );
      }

      // 2. Proceed with deletion if not in use
      const result = await api.deleteOwner(deleteCandidateId);
      if (result.success) {
        setSuccess(
          intl.formatMessage({
            id: "owners.success.delete",
            defaultMessage: "Owner deleted successfully!",
          }),
        );
        handleCancelDelete(); // Close confirmation modal
        handleCancelEdit(); // Close edit modal as well if open
        fetchOwners(); // Refresh list
      } else {
        // Should ideally not happen if deleteOwner throws errors
        setDeleteError(
          intl.formatMessage(
            {
              id: "owners.error.delete",
              defaultMessage: "Failed to delete owner: {error}",
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
      // err might already be translated if thrown above
      console.error("Failed to delete owner:", err);
      // Use intl for consistency, check if message is already translated from the 'in use' check
      // Simple check for keywords - adjust if needed for more robust language detection
      const isAlreadyTranslated = [
        "assigned to one or more items",
        "liitetty yhteen tai useampaan vaatteeseen",
      ].some((phrase) => err.message.includes(phrase));
      const errorMessage = isAlreadyTranslated
        ? err.message // Already translated
        : intl.formatMessage(
            {
              id: "owners.error.delete",
              defaultMessage: "Failed to delete owner: {error}",
            },
            { error: err.message },
          );
      setDeleteError(errorMessage);
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
    <div className="owners-view">
      {" "}
      {/* Use owners-view class */}
      <h2>
        {intl.formatMessage({
          id: "owners.title",
          defaultMessage: "Owners Management",
        })}
      </h2>
      {/* Status Messages */}
      {loading && (
        <p className="status-loading">
          {intl.formatMessage({
            id: "owners.loading",
            defaultMessage: "Loading owners...",
          })}
        </p>
      )}
      {error && <p className="status-error">Error: {error}</p>}
      {success && <p className="status-success">{success}</p>}
      {/* Add Owner Form */}
      {!api.config.isConfigured ? (
        <p className="status-warning">
          {intl.formatMessage({ id: "common.status.apiNotConfigured" })}
        </p>
      ) : typeof api.addOwner !== "function" ? (
        <p className="status-warning">
          {intl.formatMessage({
            id: "owners.addForm.notSupported",
            defaultMessage:
              "Adding owners is not supported by the current API Provider.",
          })}
        </p>
      ) : (
        <form onSubmit={handleAddOwner} className="add-owner-form">
          {" "}
          {/* Use add-owner-form class */}
          <h3>
            {intl.formatMessage({
              id: "owners.addForm.title",
              defaultMessage: "Add New Owner",
            })}
          </h3>
          <div className="form-group">
            <label htmlFor="owner-name">
              {intl.formatMessage({
                id: "owners.addForm.nameLabel",
                defaultMessage: "Name:",
              })}
            </label>
            <input
              type="text"
              id="owner-name"
              value={newOwnerName}
              onChange={(e) => setNewOwnerName(e.target.value)}
              required
              disabled={loading}
            />
          </div>
          <div className="form-group">
            <label htmlFor="owner-description">
              {intl.formatMessage({
                id: "owners.addForm.descriptionLabel",
                defaultMessage: "Description:",
              })}
            </label>
            <input
              type="text"
              id="owner-description"
              value={newOwnerDescription}
              onChange={(e) => setNewOwnerDescription(e.target.value)}
              disabled={loading}
            />
          </div>
          <button
            type="submit"
            disabled={loading || !newOwnerName.trim()}
            className="button-primary"
          >
            {loading
              ? intl.formatMessage({
                  id: "owners.addForm.button.adding",
                  defaultMessage: "Adding...",
                })
              : intl.formatMessage({
                  id: "owners.addForm.button.add",
                  defaultMessage: "Add Owner",
                })}
          </button>
        </form>
      )}
      {/* Owners List */}
      <h3>
        {intl.formatMessage({
          id: "owners.list.title",
          defaultMessage: "Existing Owners",
        })}
      </h3>
      {typeof api.listOwners !== "function" && api.config.isConfigured && (
        <p className="status-warning">
          {intl.formatMessage({
            id: "owners.list.notSupported",
            defaultMessage:
              "Listing owners is not supported by the current API Provider.",
          })}
        </p>
      )}
      {typeof api.listOwners === "function" &&
        !loading &&
        owners.length === 0 &&
        !error &&
        api.config.isConfigured && (
          <p>
            {intl.formatMessage({
              id: "owners.list.empty",
              defaultMessage: "No owners found. Add one above!",
            })}
          </p>
        )}
      {typeof api.listOwners === "function" && owners.length > 0 && (
        <div className="owners-list">
          {" "}
          {/* Use div for card container */}
          {owners.map((owner) => (
            <div key={owner.owner_id} className="owner-card">
              <h4>{owner.name}</h4>
              {owner.description && <p>{owner.description}</p>}
              {/* Show Edit button only if provider configured and update method exists - Use button-light */}
              {api.config.isConfigured &&
                typeof api.updateOwner === "function" && (
                  <button
                    onClick={() => handleEditClick(owner)}
                    className="edit-button button-light" /* Add button-light */
                    aria-label={intl.formatMessage(
                      {
                        id: "owners.editButton.label",
                        defaultMessage: "Edit {name}",
                      },
                      { name: owner.name },
                    )}
                    disabled={loading || isUpdating || isDeleting}
                  >
                    {intl.formatMessage({
                      id: "common.edit",
                      defaultMessage: "Edit",
                    })}
                  </button>
                )}
            </div>
          ))}
        </div>
      )}
      {/* Edit Owner Modal */}
      {editingOwnerId && (
        <Modal
          show={!!editingOwnerId}
          onClose={handleCancelEdit}
          title={intl.formatMessage({
            id: "owners.editModal.title",
            defaultMessage: "Edit Owner",
          })}
        >
          <form onSubmit={handleUpdateOwner} className="edit-owner-form">
            {updateError && (
              <p className="status-error">Error: {updateError}</p>
            )}
            <div className="form-group">
              <label htmlFor="edit-owner-name">
                {intl.formatMessage({
                  id: "owners.addForm.nameLabel",
                  defaultMessage: "Name:",
                })}
              </label>
              <input
                type="text"
                id="edit-owner-name"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                required
                disabled={isUpdating || isDeleting} // Disable during update or delete
              />
            </div>
            <div className="form-group">
              <label htmlFor="edit-owner-description">
                {intl.formatMessage({
                  id: "owners.addForm.descriptionLabel",
                  defaultMessage: "Description:",
                })}
              </label>
              <input
                type="text"
                id="edit-owner-description"
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                disabled={isUpdating || isDeleting} // Disable during update or delete
              />
            </div>
            <div className="modal-actions">
              <button
                type="submit"
                disabled={isUpdating || isDeleting || !editName.trim()}
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
              {/* Use button-danger for delete */}
              {api.config.isConfigured &&
                typeof api.deleteOwner === "function" &&
                typeof api.listItems === "function" && (
                  <button
                    type="button"
                    className="button-danger"
                    onClick={() => handleDeleteClick(editingOwnerId)}
                    disabled={isUpdating || isDeleting}
                  >
                    {intl.formatMessage({
                      id: "common.delete",
                      defaultMessage: "Delete",
                    })}
                  </button>
                )}
              {/* Use button-secondary for cancel */}
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
      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <Modal
          show={showDeleteConfirm}
          onClose={handleCancelDelete}
          title={intl.formatMessage({
            id: "owners.deleteModal.title",
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
                  id: "owners.deleteModal.confirmMessage",
                  defaultMessage:
                    'Are you sure you want to delete the owner "{name}"? This action cannot be undone.',
                },
                {
                  name:
                    owners.find((o) => o.owner_id === deleteCandidateId)
                      ?.name || "",
                },
              )}
            </p>
            {/* Removed redundant "This action cannot be undone." as it's included above */}
            <div className="modal-actions">
              {/* Use button-danger for confirm delete */}
              <button
                onClick={handleConfirmDelete}
                disabled={isDeleting}
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
              {/* Use button-secondary for cancel */}
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

export default OwnersView;

// Add missing common key to en.json/fi.json if not already present:
/*
    "common.error.unknown": "Unknown reason" / "Tuntematon syy"
*/
