import React, { useState, useEffect, useCallback } from "react";
import { useApi } from "../api/ApiContext";
import { useIntl } from "react-intl";
import "./OwnersView.css";
import Modal from "./Modal";

const OwnersView = () => {
  const [owners, setOwners] = useState([]);
  const [newOwnerName, setNewOwnerName] = useState("");
  const [newOwnerDescription, setNewOwnerDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [editingOwnerId, setEditingOwnerId] = useState(null);
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [isUpdating, setIsUpdating] = useState(false);
  const [updateError, setUpdateError] = useState(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteCandidateId, setDeleteCandidateId] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState(null);
  const [isAddOwnerModalOpen, setIsAddOwnerModalOpen] = useState(false);
  const [addOwnerError, setAddOwnerError] = useState(null);

  const api = useApi();
  const intl = useIntl();

  const fetchOwners = useCallback(async () => {
    // Only fetch if the provider is configured and listOwners exists
    if (!api.isConfigured || typeof api.listOwners !== "function") {
      setOwners([]); // Clear owners if not configured or function missing
      setError(
        api.isConfigured
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
  }, [api, intl]);

  useEffect(() => {
    fetchOwners();
  }, [fetchOwners]);

  const handleOpenAddOwnerModal = () => {
    setNewOwnerName("");
    setNewOwnerDescription("");
    setAddOwnerError(null);
    setError(null);
    setSuccess(null);
    setIsAddOwnerModalOpen(true);
  };

  const handleCloseAddOwnerModal = () => {
    setIsAddOwnerModalOpen(false);
    setAddOwnerError(null); // Clear errors when closing
  };

  // Function to handle adding a new owner
  const handleAddOwner = async (e) => {
    e.preventDefault();

    if (!newOwnerName.trim()) {
      setAddOwnerError(
        // Use modal-specific error state
        intl.formatMessage({
          id: "owners.error.nameEmpty",
          defaultMessage: "Owner name cannot be empty.",
        }),
      );
      return;
    }
    // Only add if the provider is configured and addOwner exists
    if (!api.isConfigured || typeof api.addOwner !== "function") {
      setAddOwnerError(
        // Use modal-specific error state
        api.isConfigured
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
    setAddOwnerError(null); // Clear modal error

    try {
      const result = await api.addOwner({
        name: newOwnerName.trim(),
        description: newOwnerDescription.trim() || null, // Send null if description is empty
      });

      if (result.success) {
        // Fetch data, then close modal and show global success message
        fetchOwners().then(() => {
          handleCloseAddOwnerModal();
          setSuccess(
            intl.formatMessage(
              {
                id: "owners.success.add",
                defaultMessage: 'Owner "{name}" added successfully!',
              },
              { name: newOwnerName.trim() },
            ),
          );
        });
      } else {
        // Should ideally not happen if addOwner throws errors, but handle just in case
        setAddOwnerError(
          // Use modal-specific error state
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
      console.error("Failed to add owner:", err);
      // Use intl for consistency, even if the message might be technical
      setAddOwnerError(
        // Use modal-specific error state
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
      const result = await api.updateOwner({
        owner_id: editingOwnerId,
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
      console.error("Failed to update owner:", err);
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
      // Proceed with deletion - provider will check if in use
      const result = await api.deleteOwner({ owner_id: deleteCandidateId });
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
        if (result.errorCode === "ENTITY_IN_USE") {
          setDeleteError(
            intl.formatMessage({ id: "owners.error.deleteInUse" }),
          );
        } else {
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
      }
    } catch (err) {
      console.error("Failed to delete owner:", err);
      setDeleteError(
        intl.formatMessage(
          {
            id: "owners.error.delete",
            defaultMessage: "Failed to delete owner: {error}",
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
    <div className="owners-view">
      {" "}
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
      {!isAddOwnerModalOpen && !api.isConfigured ? (
        <p className="status-warning">
          {intl.formatMessage({ id: "common.status.apiNotConfigured" })}
        </p>
      ) : !isAddOwnerModalOpen &&
        api.isConfigured &&
        typeof api.addOwner !== "function" ? (
        <p className="status-warning">
          {intl.formatMessage({
            id: "owners.addForm.notSupported",
            defaultMessage:
              "Adding owners is not supported by the current API Provider.",
          })}
        </p>
      ) : null}
      {/* Owners List */}
      <h3>
        {intl.formatMessage({
          id: "owners.list.title",
          defaultMessage: "Existing Owners",
        })}
      </h3>
      {typeof api.listOwners !== "function" && api.isConfigured && (
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
        api.isConfigured && (
          <p>
            {intl.formatMessage({
              id: "owners.list.emptyFAB", // Updated key
              defaultMessage:
                "No owners found. Click the '+' button to add one.",
            })}
          </p>
        )}
      {typeof api.listOwners === "function" && owners.length > 0 && (
        <div className="owners-list">
          {" "}
          {owners.map((owner) => (
            <div key={owner.owner_id} className="owner-card">
              <h4>{owner.name}</h4>
              {owner.description && <p>{owner.description}</p>}
              {api.isConfigured && typeof api.updateOwner === "function" && (
                <button
                  onClick={() => handleEditClick(owner)}
                  className="edit-button button-light"
                  aria-label={intl.formatMessage(
                    {
                      id: "owners.editButton.label",
                      defaultMessage: "Edit {name}",
                    },
                    { name: owner.name },
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
      {/* Add Owner FAB */}
      {api.isConfigured && typeof api.addOwner === "function" && (
        <button
          type="button"
          className="add-owner-fab button-primary"
          onClick={handleOpenAddOwnerModal}
          aria-label={intl.formatMessage({ id: "owners.addOwnerFAB.label" })}
          disabled={!api.writeAllowed || loading || isUpdating || isDeleting}
        >
          +
        </button>
      )}
      {/* Add Owner Modal */}
      {isAddOwnerModalOpen && (
        <Modal
          show={isAddOwnerModalOpen}
          onClose={handleCloseAddOwnerModal}
          title={intl.formatMessage({ id: "owners.addForm.title" })}
        >
          <form onSubmit={handleAddOwner} className="add-owner-form">
            {addOwnerError && (
              <p className="status-error">Error: {addOwnerError}</p>
            )}
            <div className="form-group">
              <label htmlFor="owner-name-modal">
                {intl.formatMessage({ id: "owners.addForm.nameLabel" })}
              </label>
              <input
                type="text"
                id="owner-name-modal"
                value={newOwnerName}
                onChange={(e) => setNewOwnerName(e.target.value)}
                required
                disabled={loading}
              />
            </div>
            <div className="form-group">
              <label htmlFor="owner-description-modal">
                {intl.formatMessage({ id: "owners.addForm.descriptionLabel" })}
              </label>
              <input
                type="text"
                id="owner-description-modal"
                value={newOwnerDescription}
                onChange={(e) => setNewOwnerDescription(e.target.value)}
                disabled={loading}
              />
            </div>
            <div className="modal-actions">
              <button
                type="submit"
                disabled={loading || !newOwnerName.trim()}
                className="button-primary"
              >
                {loading
                  ? intl.formatMessage({ id: "owners.addForm.button.adding" })
                  : intl.formatMessage({ id: "owners.addForm.button.add" })}
              </button>
              <button
                type="button"
                onClick={handleCloseAddOwnerModal}
                disabled={loading}
                className="button-secondary"
              >
                {intl.formatMessage({ id: "common.cancel" })}
              </button>
            </div>
          </form>
        </Modal>
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
                disabled={isUpdating || isDeleting}
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
                typeof api.deleteOwner === "function" &&
                typeof api.listItems === "function" && (
                  <button
                    type="button"
                    className="button-danger"
                    onClick={() => handleDeleteClick(editingOwnerId)}
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

export default OwnersView;
