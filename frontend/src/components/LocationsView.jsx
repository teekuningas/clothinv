import React, { useState, useEffect, useCallback } from "react";
import { useApi } from "../api/ApiContext";
import { useIntl } from "react-intl";
import "./LocationsView.css";
import Modal from "./Modal";

const LocationsView = () => {
  const [locations, setLocations] = useState([]);
  const [newLocationName, setNewLocationName] = useState("");
  const [newLocationDescription, setNewLocationDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [editingLocationId, setEditingLocationId] = useState(null);
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [isUpdating, setIsUpdating] = useState(false);
  const [updateError, setUpdateError] = useState(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteCandidateId, setDeleteCandidateId] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState(null);
  const [isAddLocationModalOpen, setIsAddLocationModalOpen] = useState(false);
  const [addLocationError, setAddLocationError] = useState(null);

  const api = useApi();
  const intl = useIntl();

  const fetchLocations = useCallback(async () => {
    if (!api.isConfigured || typeof api.listLocations !== "function") {
      setLocations([]);
      setError(
        api.isConfigured
          ? intl.formatMessage({
              id: "locations.list.notSupported",
              defaultMessage:
                "Listing locations is not supported by the current API Provider.",
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
      const data = await api.listLocations();
      setLocations(data || []); // Ensure data is an array
    } catch (err) {
      console.error("Failed to fetch locations:", err);
      setError(
        intl.formatMessage(
          {
            id: "locations.error.fetch",
            defaultMessage: "Failed to fetch locations: {error}",
          },
          { error: err.message },
        ),
      );
      setLocations([]); // Clear locations on error
    } finally {
      setLoading(false);
    }
  }, [api, intl]);

  // Fetch locations on component mount and when fetchLocations changes
  useEffect(() => {
    fetchLocations();
  }, [fetchLocations]);

  const handleOpenAddLocationModal = () => {
    setNewLocationName("");
    setNewLocationDescription("");
    setAddLocationError(null); // Clear previous modal errors
    setError(null); // Clear general page errors
    setSuccess(null); // Clear success messages
    setIsAddLocationModalOpen(true);
  };

  const handleCloseAddLocationModal = () => {
    setIsAddLocationModalOpen(false);
    setAddLocationError(null); // Clear errors when closing
  };

  const handleAddLocation = async (e) => {
    e.preventDefault();

    if (!newLocationName.trim()) {
      setAddLocationError(
        intl.formatMessage({
          id: "locations.error.nameEmpty",
          defaultMessage: "Location name cannot be empty.",
        }),
      );
      return;
    }
    // Only add if the provider is configured and addLocation exists
    if (!api.isConfigured || typeof api.addLocation !== "function") {
      setAddLocationError(
        api.isConfigured
          ? intl.formatMessage({
              id: "locations.addForm.notSupported",
              defaultMessage:
                "Adding locations is not supported by the current API Provider.",
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
    setAddLocationError(null); // Clear modal error

    try {
      const result = await api.addLocation({
        name: newLocationName.trim(),
        description: newLocationDescription.trim() || null, // Send null if description is empty
      });

      if (result.success) {
        // Fetch data, then close modal and show global success message
        fetchLocations().then(() => {
          handleCloseAddLocationModal();
          setSuccess(
            intl.formatMessage(
              {
                id: "locations.success.add",
                defaultMessage: 'Location "{name}" added successfully!',
              },
              { name: newLocationName.trim() },
            ),
          );
        });
      } else {
        // Should ideally not happen if addLocation throws errors, but handle just in case
        setAddLocationError(
          // Use modal-specific error state
          intl.formatMessage(
            {
              id: "locations.error.add",
              defaultMessage: "Failed to add location: {error}",
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
      console.error("Failed to add location:", err);
      setAddLocationError(
        // Use modal-specific error state
        intl.formatMessage(
          {
            id: "locations.error.add",
            defaultMessage: "Failed to add location: {error}",
          },
          { error: err.message },
        ),
      );
    } finally {
      setLoading(false);
    }
  };

  const handleEditClick = (location) => {
    setEditingLocationId(location.location_id);
    setEditName(location.name);
    setEditDescription(location.description || "");
    setUpdateError(null);
    setSuccess(null);
    setError(null);
  };

  const handleCancelEdit = () => {
    setEditingLocationId(null);
    setEditName("");
    setEditDescription("");
    setUpdateError(null);
  };

  const handleUpdateLocation = async (e) => {
    e.preventDefault();
    if (
      !editingLocationId ||
      !editName.trim() ||
      typeof api.updateLocation !== "function"
    ) {
      setUpdateError(
        intl.formatMessage({
          id: "locations.error.updateInvalid",
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
      const result = await api.updateLocation({
        location_id: editingLocationId,
        name: editName.trim(),
        description: editDescription.trim() || null,
      });

      if (result.success) {
        setSuccess(
          intl.formatMessage(
            {
              id: "locations.success.update",
              defaultMessage: 'Location "{name}" updated successfully!',
            },
            { name: editName.trim() },
          ),
        );
        handleCancelEdit(); // Close modal
        fetchLocations(); // Refresh list
      } else {
        setUpdateError(
          intl.formatMessage(
            {
              id: "locations.error.update",
              defaultMessage: "Failed to update location: {error}",
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
      console.error("Failed to update location:", err);
      setUpdateError(
        intl.formatMessage(
          {
            id: "locations.error.update",
            defaultMessage: "Failed to update location: {error}",
          },
          { error: err.message },
        ),
      );
    } finally {
      const wasSuccessful = !!success;
      if (wasSuccessful) {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
      setIsUpdating(false);
    }
  };

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

  const handleConfirmDelete = async () => {
    if (
      !deleteCandidateId ||
      typeof api.deleteLocation !== "function" ||
      typeof api.listItems !== "function"
    ) {
      setDeleteError(
        intl.formatMessage({
          id: "locations.error.deleteInvalid",
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
      const result = await api.deleteLocation({
        location_id: deleteCandidateId,
      });
      if (result.success) {
        setSuccess(
          intl.formatMessage({
            id: "locations.success.delete",
            defaultMessage: "Location deleted successfully!",
          }),
        );
        handleCancelDelete(); // Close confirmation modal
        handleCancelEdit(); // Close edit modal as well if open
        fetchLocations(); // Refresh list
      } else {
        if (result.errorCode === "ENTITY_IN_USE") {
          setDeleteError(
            intl.formatMessage({ id: "locations.error.deleteInUse" }),
          );
        } else {
          setDeleteError(
            intl.formatMessage(
              {
                id: "locations.error.delete",
                defaultMessage: "Failed to delete location: {error}",
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
      console.error("Failed to delete location:", err);
      setDeleteError(
        intl.formatMessage(
          {
            id: "locations.error.delete",
            defaultMessage: "Failed to delete location: {error}",
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
    <div className="locations-view">
      {/* Status Messages */}
      {loading && (
        <p className="status-loading">
          {intl.formatMessage({
            id: "locations.loading",
            defaultMessage: "Loading locations...",
          })}
        </p>
      )}
      {error && <p className="status-error">Error: {error}</p>}
      {success && <p className="status-success">{success}</p>}

      {!isAddLocationModalOpen && !api.isConfigured ? (
        <p className="status-warning">
          {intl.formatMessage({ id: "common.status.apiNotConfigured" })}
        </p>
      ) : !isAddLocationModalOpen &&
        api.isConfigured &&
        typeof api.addLocation !== "function" ? (
        <p className="status-warning">
          {intl.formatMessage({
            id: "locations.addForm.notSupported",
            defaultMessage:
              "Adding locations is not supported by the current API Provider.",
          })}
        </p>
      ) : null}

      {/* Locations List */}
      <h3>
        {intl.formatMessage({
          id: "locations.list.title",
          defaultMessage: "Existing Locations",
        })}
      </h3>
      {typeof api.listLocations !== "function" && api.isConfigured && (
        <p className="status-warning">
          {intl.formatMessage({
            id: "locations.list.notSupported",
            defaultMessage:
              "Listing locations is not supported by the current API Provider.",
          })}
        </p>
      )}
      {typeof api.listLocations === "function" &&
        !loading &&
        locations.length === 0 &&
        !error &&
        api.isConfigured && (
          <p>
            {intl.formatMessage({
              id: "locations.list.emptyFAB", // Updated key
              defaultMessage:
                "No locations found. Click the '+' button to add one.",
            })}
          </p>
        )}
      {typeof api.listLocations === "function" && locations.length > 0 && (
        <div className="locations-list">
          {" "}
          {locations.map((loc) => (
            <div key={loc.location_id} className="location-card">
              <h4>{loc.name}</h4>
              {loc.description && <p>{loc.description}</p>}
              {/* Show Edit button only if provider configured and update method exists - Use button-light */}
              {api.isConfigured && typeof api.updateLocation === "function" && (
                <button
                  onClick={() => handleEditClick(loc)}
                  className="edit-button button-light"
                  aria-label={intl.formatMessage(
                    {
                      id: "locations.editButton.label",
                      defaultMessage: "Edit {name}",
                    },
                    { name: loc.name },
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

      {/* Add Location FAB */}
      {api.isConfigured && typeof api.addLocation === "function" && (
        <button
          type="button"
          className="add-location-fab button-primary"
          onClick={handleOpenAddLocationModal}
          aria-label={intl.formatMessage({
            id: "locations.addLocationFAB.label",
          })}
          disabled={!api.writeAllowed || loading || isUpdating || isDeleting}
        >
          +
        </button>
      )}

      {/* Add Location Modal */}
      {isAddLocationModalOpen && (
        <Modal
          show={isAddLocationModalOpen}
          onClose={handleCloseAddLocationModal}
          title={intl.formatMessage({ id: "locations.addForm.title" })}
        >
          <form onSubmit={handleAddLocation} className="add-location-form">
            {addLocationError && (
              <p className="status-error">Error: {addLocationError}</p>
            )}
            <div className="form-group">
              <label htmlFor="location-name-modal">
                {intl.formatMessage({ id: "locations.addForm.nameLabel" })}
              </label>
              <input
                type="text"
                id="location-name-modal"
                value={newLocationName}
                onChange={(e) => setNewLocationName(e.target.value)}
                required
                disabled={loading}
              />
            </div>
            <div className="form-group">
              <label htmlFor="location-description-modal">
                {intl.formatMessage({
                  id: "locations.addForm.descriptionLabel",
                })}
              </label>
              <input
                type="text"
                id="location-description-modal"
                value={newLocationDescription}
                onChange={(e) => setNewLocationDescription(e.target.value)}
                disabled={loading}
              />
            </div>
            <div className="modal-actions">
              <button
                type="submit"
                disabled={loading || !newLocationName.trim()}
                className="button-primary"
              >
                {loading
                  ? intl.formatMessage({
                      id: "locations.addForm.button.adding",
                    })
                  : intl.formatMessage({ id: "locations.addForm.button.add" })}
              </button>
              <button
                type="button"
                onClick={handleCloseAddLocationModal}
                disabled={loading}
                className="button-secondary"
              >
                {intl.formatMessage({ id: "common.cancel" })}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Edit Location Modal */}
      {editingLocationId && (
        <Modal
          show={!!editingLocationId}
          onClose={handleCancelEdit}
          title={intl.formatMessage({
            id: "locations.editModal.title",
            defaultMessage: "Edit Location",
          })}
        >
          <form onSubmit={handleUpdateLocation} className="edit-location-form">
            {updateError && (
              <p className="status-error">Error: {updateError}</p>
            )}
            <div className="form-group">
              <label htmlFor="edit-location-name">
                {intl.formatMessage({
                  id: "locations.addForm.nameLabel",
                  defaultMessage: "Name:",
                })}
              </label>
              <input
                type="text"
                id="edit-location-name"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                required
                disabled={isUpdating || isDeleting}
              />
            </div>
            <div className="form-group">
              <label htmlFor="edit-location-description">
                {intl.formatMessage({
                  id: "locations.addForm.descriptionLabel",
                  defaultMessage: "Description:",
                })}
              </label>
              <input
                type="text"
                id="edit-location-description"
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
                typeof api.deleteLocation === "function" &&
                typeof api.listItems === "function" && (
                  <button
                    type="button"
                    className="button-danger"
                    onClick={() => handleDeleteClick(editingLocationId)}
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
            id: "locations.deleteModal.title",
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
                  id: "locations.deleteModal.confirmMessage",
                  defaultMessage:
                    'Are you sure you want to delete the location "{name}"? This action cannot be undone.',
                },
                {
                  name:
                    locations.find((l) => l.location_id === deleteCandidateId)
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

export default LocationsView;
