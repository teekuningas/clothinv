import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useApi } from "../api/ApiContext";
import { useIntl } from "react-intl";
import Modal from "./Modal";
import ImageViewModal from "./ImageViewModal";
import WebcamCapture from "./WebcamCapture"; // Import the webcam component
import "./ItemsView.css"; // Import the CSS file
import "./ImageViewModal.css"; // Import the CSS for the image modal
import "./WebcamCapture.css"; // Import the CSS for the webcam modal

const ItemsView = () => {
  // --- State ---
  const [items, setItems] = useState([]);
  const [locations, setLocations] = useState([]);
  const [categories, setCategories] = useState([]);
  const [owners, setOwners] = useState([]);

  // Add form state
  const [newItemName, setNewItemName] = useState("");
  const [newItemDescription, setNewItemDescription] = useState("");
  const [newItemLocationId, setNewItemLocationId] = useState(""); // Store ID
  const [newItemCategoryId, setNewItemCategoryId] = useState(""); // Store ID
  const [newItemImageFile, setNewItemImageFile] = useState(null); // Store File object
  // REMOVED: const [newItemImagePreview, setNewItemImagePreview] = useState(null);
  const [newItemOwnerId, setNewItemOwnerId] = useState(""); // Store ID

  // General status state
  const [loading, setLoading] = useState(false); // For initial list loading and adding
  const [error, setError] = useState(null); // For list loading and adding errors
  const [success, setSuccess] = useState(null); // For general success messages

  // Edit state
  const [editingItemId, setEditingItemId] = useState(null);
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editLocationId, setEditLocationId] = useState(""); // Add state for edit location
  const [editCategoryId, setEditCategoryId] = useState(""); // Add state for edit category
  const [editItemImageFile, setEditItemImageFile] = useState(null); // Store File object for edit
  // REMOVED: const [editItemImagePreview, setEditItemImagePreview] = useState(null);
  const [editOwnerId, setEditOwnerId] = useState(""); // Add state for edit owner
  const [isUpdating, setIsUpdating] = useState(false);
  const [updateError, setUpdateError] = useState(null);
  const [imageMarkedForRemoval, setImageMarkedForRemoval] = useState(false); // Track if user wants to remove existing image

  // Delete state
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteCandidateId, setDeleteCandidateId] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState(null);

  // Image View Modal State
  const [isImageViewModalOpen, setIsImageViewModalOpen] = useState(false);
  const [imageViewModalUrl, setImageViewModalUrl] = useState(null);
  const [imageViewModalAlt, setImageViewModalAlt] = useState("");

  // Webcam Modal State
  const [isWebcamOpen, setIsWebcamOpen] = useState(false);
  const [webcamTarget, setWebcamTarget] = useState("add"); // 'add' or 'edit'

  // State for managing temporary Blob URLs for display
  const [itemImageUrls, setItemImageUrls] = useState({}); // Map itemId -> blobUrl
  const [addImageUrl, setAddImageUrl] = useState(null); // Blob URL for add form preview
  const [editImageUrl, setEditImageUrl] = useState(null); // Blob URL for edit form preview

  // Filter state
  const [isFilterVisible, setIsFilterVisible] = useState(false);
  const [filterName, setFilterName] = useState("");
  const [filterLocationIds, setFilterLocationIds] = useState([]); // Array of selected location_id
  const [filterCategoryIds, setFilterCategoryIds] = useState([]); // Array of selected category_id
  const [filterOwnerIds, setFilterOwnerIds] = useState([]); // Array of selected owner_id

  // --- Hooks ---
  const api = useApi();
  const intl = useIntl();

  // --- Data Fetching ---
  const fetchData = useCallback(async () => {
    // Check if API is configured and required methods exist
    const canFetchItems =
      api.config.isConfigured && typeof api.listItems === "function";
    const canFetchLocations =
      api.config.isConfigured && typeof api.listLocations === "function";
    const canFetchCategories =
      api.config.isConfigured && typeof api.listCategories === "function";
    const canFetchOwners =
      api.config.isConfigured && typeof api.listOwners === "function";

    if (
      !canFetchItems ||
      !canFetchLocations ||
      !canFetchCategories ||
      !canFetchOwners
    ) {
      setItems([]);
      setLocations([]);
      setCategories([]);
      setOwners([]);
      setError(
        api.config.isConfigured
          ? intl.formatMessage({
              id: "items.error.fetchPrereqs",
              defaultMessage:
                "Cannot fetch items. Listing items, locations, or categories is not supported by the current API Provider.",
            })
          : intl.formatMessage({ id: "common.status.apiNotConfigured" }),
      );
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      // Fetch all data concurrently
      const [itemsData, locationsData, categoriesData, ownersData] =
        await Promise.all([
          api.listItems(),
          api.listLocations(),
          api.listCategories(),
          api.listOwners(), // Add this
        ]);
      setItems(itemsData || []);
      setLocations(locationsData || []);
      setCategories(categoriesData || []);
      setOwners(ownersData || []);
    } catch (err) {
      console.error("Failed to fetch data:", err);
      setError(
        intl.formatMessage(
          {
            id: "items.error.fetch",
            defaultMessage: "Failed to fetch data: {error}",
          },
          { error: err.message },
        ),
      );
      setItems([]);
      setLocations([]);
      setCategories([]);
      setOwners([]);
    } finally {
      setLoading(false);
    }
  }, [api, intl]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Calculate filtered items based on current filters
  const filteredItems = useMemo(() => {
    const lowerFilterName = filterName.toLowerCase();

    return items.filter((item) => {
      // Combined Text filter (case-insensitive includes for name OR description)
      if (
        lowerFilterName &&
        !item.name.toLowerCase().includes(lowerFilterName) &&
        !(item.description || "").toLowerCase().includes(lowerFilterName)
      ) {
        return false;
      }
      // Location filter (must match one of the selected IDs if any are selected)
      if (
        filterLocationIds.length > 0 &&
        !filterLocationIds.includes(item.location_id)
      ) {
        return false;
      }
      // Category filter (must match one of the selected IDs if any are selected)
      if (
        filterCategoryIds.length > 0 &&
        !filterCategoryIds.includes(item.category_id)
      ) {
        return false;
      }
      // Owner filter (must match one of the selected IDs if any are selected)
      if (
        filterOwnerIds.length > 0 &&
        !filterOwnerIds.includes(item.owner_id)
      ) {
        return false;
      }
      return true; // Item passes all active filters
    });
  }, [items, filterName, filterLocationIds, filterCategoryIds, filterOwnerIds]);

  // Effect to create/revoke Blob URLs for item list display
  useEffect(() => {
    const newItemImageUrls = {};
    filteredItems.forEach((item) => {
      if (item.imageFile instanceof File) {
        newItemImageUrls[item.item_id] = URL.createObjectURL(item.imageFile);
      }
    });
    setItemImageUrls(newItemImageUrls);

    // Cleanup function to revoke URLs when component unmounts or items change
    return () => {
      Object.values(newItemImageUrls).forEach((url) =>
        URL.revokeObjectURL(url),
      );
      setItemImageUrls({}); // Clear the state on cleanup
    };
  }, [filteredItems]); // Re-run when filteredItems changes

  // --- Helper Functions ---
  const getLocationNameById = (id) =>
    locations.find((loc) => loc.location_id === id)?.name ||
    intl.formatMessage({ id: "items.card.noLocation", defaultMessage: "N/A" });
  const getCategoryNameById = (id) =>
    categories.find((cat) => cat.category_id === id)?.name ||
    intl.formatMessage({ id: "items.card.noCategory", defaultMessage: "N/A" });
  const getOwnerNameById = (id) =>
    owners.find((owner) => owner.owner_id === id)?.name ||
    intl.formatMessage({ id: "items.card.noOwner", defaultMessage: "N/A" });

  // --- Image File Handling & Blob URL Management ---
  const handleFileChange = (event, type) => {
    const file = event.target.files[0];
    if (file instanceof File) {
      if (type === "add") {
        // Revoke previous add form blob URL if exists
        if (addImageUrl) URL.revokeObjectURL(addImageUrl);
        setNewItemImageFile(file);
        setAddImageUrl(URL.createObjectURL(file)); // Create new blob URL for preview
      } else if (type === "edit") {
        // Revoke previous edit form blob URL if exists
        if (editImageUrl) URL.revokeObjectURL(editImageUrl);
        setEditItemImageFile(file);
        setEditImageUrl(URL.createObjectURL(file)); // Create new blob URL for preview
        setImageMarkedForRemoval(false); // New file selected, so don't mark for removal
      }
    }
    // Clear the input value to allow selecting the same file again
    event.target.value = null;
  };

  // Handler for removing image in Add form
  const handleRemoveNewImage = () => {
    if (addImageUrl) URL.revokeObjectURL(addImageUrl); // Revoke URL
    setNewItemImageFile(null);
    setAddImageUrl(null);
  };

  // --- Add Item Handler ---
  const handleAddItem = async (e) => {
    e.preventDefault();
    if (!newItemName.trim()) {
      setError(
        intl.formatMessage({
          id: "items.error.nameEmpty",
          defaultMessage: "Item name cannot be empty.",
        }),
      );
      return;
    }
    if (!newItemLocationId) {
      setError(
        intl.formatMessage({
          id: "items.error.locationMissing",
          defaultMessage: "Please select a location.",
        }),
      );
      return;
    }
    if (!newItemCategoryId) {
      setError(
        intl.formatMessage({
          id: "items.error.categoryMissing",
          defaultMessage: "Please select a category.",
        }),
      );
      return;
    }
    if (!newItemOwnerId) {
      setError(
        intl.formatMessage({
          id: "items.error.ownerMissing",
          defaultMessage: "Please select an owner.",
        }),
      );
      return;
    }
    if (!api.config.isConfigured || typeof api.addItem !== "function") {
      setError(
        api.config.isConfigured
          ? intl.formatMessage({
              id: "items.addForm.notSupported",
              defaultMessage:
                "Adding items is not supported by the current API Provider.",
            })
          : intl.formatMessage({ id: "common.status.apiNotConfigured" }),
      );
      return;
    }

    setLoading(true); // Use general loading for add form
    setError(null);
    setSuccess(null);

    try {
      const result = await api.addItem({
        name: newItemName.trim(),
        description: newItemDescription.trim() || null,
        location_id: parseInt(newItemLocationId, 10), // Ensure ID is integer
        category_id: parseInt(newItemCategoryId, 10), // Ensure ID is integer
        owner_id: parseInt(newItemOwnerId, 10), // Ensure ID is integer
        imageFile: newItemImageFile, // Pass the File object
      });

      if (result.success) {
        setSuccess(
          intl.formatMessage(
            {
              id: "items.success.add",
              defaultMessage: 'Item "{name}" added successfully!',
            },
            { name: newItemName.trim() },
          ),
        );
        setNewItemName("");
        setNewItemDescription("");
        setNewItemLocationId("");
        setNewItemCategoryId("");
        if (addImageUrl) URL.revokeObjectURL(addImageUrl); // Revoke URL on success
        setNewItemImageFile(null);
        setAddImageUrl(null);
        setNewItemOwnerId("");
        await new Promise((resolve) => setTimeout(resolve, 250)); // Add delay before refetch
        fetchData(); // Refresh the list
      } else {
        setError(
          intl.formatMessage(
            {
              id: "items.error.add",
              defaultMessage: "Failed to add item: {error}",
            },
            {
              error:
                result.message ||
                intl.formatMessage({ id: "common.error.unknown" }),
            },
          ),
        );
      }
    } catch (err) {
      console.error("Failed to add item:", err);
      setError(
        intl.formatMessage(
          {
            id: "items.error.add",
            defaultMessage: "Failed to add item: {error}",
          },
          { error: err.message },
        ),
      );
    } finally {
      setLoading(false);
    }
  };

  // --- Filter Handlers ---
  const handleFilterToggle = () => {
    setIsFilterVisible(!isFilterVisible);
  };

  const handleCheckboxFilterChange = (filterType, id) => {
    const idNum = parseInt(id, 10); // Ensure it's a number
    const updater = (prevIds) => {
      if (prevIds.includes(idNum)) {
        return prevIds.filter((existingId) => existingId !== idNum); // Remove ID
      } else {
        return [...prevIds, idNum]; // Add ID
      }
    };

    if (filterType === "location") {
      setFilterLocationIds(updater);
    } else if (filterType === "category") {
      setFilterCategoryIds(updater);
    } else if (filterType === "owner") {
      setFilterOwnerIds(updater);
    }
  };

  const handleResetFilters = () => {
    setFilterName("");
    setFilterLocationIds([]);
    setFilterCategoryIds([]);
    setFilterOwnerIds([]);
  };

  // --- Edit Handlers ---
  const handleEditClick = (item) => {
    setEditingItemId(item.item_id);
    setEditName(item.name);
    setEditDescription(item.description || "");
    setEditLocationId(item.location_id || ""); // Set initial location ID
    setEditCategoryId(item.category_id || ""); // Set initial category ID
    setEditOwnerId(item.owner_id || ""); // Set initial owner ID

    // Handle image state for edit modal
    if (editImageUrl) URL.revokeObjectURL(editImageUrl); // Revoke previous edit preview URL
    if (item.imageFile instanceof File) {
      setEditItemImageFile(item.imageFile); // Set the actual File object
      setEditImageUrl(URL.createObjectURL(item.imageFile)); // Create blob URL for preview
    } else {
      setEditItemImageFile(null);
      setEditImageUrl(null);
    }

    setImageMarkedForRemoval(false); // Reset removal flag
    setUpdateError(null);
    setSuccess(null);
    setError(null);
  };

  const handleCancelEdit = () => {
    setEditingItemId(null);
    setEditName("");
    setEditDescription("");
    setEditLocationId(""); // Reset edit location ID
    setEditCategoryId(""); // Reset edit category ID
    setEditOwnerId(""); // Reset edit owner ID

    // Clear image state and revoke URL on cancel
    if (editImageUrl) URL.revokeObjectURL(editImageUrl);
    setEditItemImageFile(null);
    setEditImageUrl(null);

    setImageMarkedForRemoval(false); // Reset removal flag
    setUpdateError(null);
  };

  // Handler for the "Remove Image" button in the edit modal
  const handleRemoveEditImage = () => {
    if (editImageUrl) URL.revokeObjectURL(editImageUrl); // Revoke URL
    setEditItemImageFile(null);
    setEditImageUrl(null);
    setImageMarkedForRemoval(true); // Mark the image for removal on save
  };

  const handleUpdateItem = async (e) => {
    e.preventDefault();
    if (
      !editingItemId ||
      !editName.trim() ||
      !editLocationId ||
      !editCategoryId ||
      !editOwnerId ||
      typeof api.updateItem !== "function"
    ) {
      setUpdateError(
        intl.formatMessage({
          id: "items.error.updateInvalid",
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
      const result = await api.updateItem(editingItemId, {
        name: editName.trim(),
        description: editDescription.trim() || null,
        location_id: parseInt(editLocationId, 10), // Include location_id
        category_id: parseInt(editCategoryId, 10), // Include category_id
        owner_id: parseInt(editOwnerId, 10), // Include owner_id
        imageFile: editItemImageFile, // Pass the new file (if any)
        removeImage: imageMarkedForRemoval, // Pass the explicit removal flag
      });

      if (result.success) {
        setSuccess(
          intl.formatMessage(
            {
              id: "items.success.update",
              defaultMessage: 'Item "{name}" updated successfully!',
            },
            { name: editName.trim() },
          ),
        );
        handleCancelEdit();
        fetchData();
      } else {
        setUpdateError(
          intl.formatMessage(
            {
              id: "items.error.update",
              defaultMessage: "Failed to update item: {error}",
            },
            {
              error:
                result.message ||
                intl.formatMessage({ id: "common.error.unknown" }),
            },
          ),
        );
      }
    } catch (err) {
      console.error("Failed to update item:", err);
      setUpdateError(
        intl.formatMessage(
          {
            id: "items.error.update",
            defaultMessage: "Failed to update item: {error}",
          },
          { error: err.message },
        ),
      );
    } finally {
      setIsUpdating(false);
    }
  };

  // --- Delete Handlers ---
  const handleDeleteClick = (itemId) => {
    setDeleteCandidateId(itemId);
    setShowDeleteConfirm(true);
    setDeleteError(null);
  };

  const handleCancelDelete = () => {
    setShowDeleteConfirm(false);
    setDeleteCandidateId(null);
    setDeleteError(null);
  };

  const handleConfirmDelete = async () => {
    if (!deleteCandidateId || typeof api.deleteItem !== "function") {
      setDeleteError(
        intl.formatMessage({
          id: "items.error.deleteInvalid",
          defaultMessage:
            "Cannot delete. Invalid data or delete function unavailable.",
        }),
      );
      return;
    }

    setIsDeleting(true);
    setDeleteError(null);
    setSuccess(null);

    try {
      // No need to check usage for items currently
      const result = await api.deleteItem(deleteCandidateId);
      if (result.success) {
        setSuccess(
          intl.formatMessage({
            id: "items.success.delete",
            defaultMessage: "Item deleted successfully!",
          }),
        );
        handleCancelDelete();
        handleCancelEdit(); // Close edit modal if open
        fetchData();
      } else {
        setDeleteError(
          intl.formatMessage(
            {
              id: "items.error.delete",
              defaultMessage: "Failed to delete item: {error}",
            },
            {
              error:
                result.message ||
                intl.formatMessage({ id: "common.error.unknown" }),
            },
          ),
        );
      }
    } catch (err) {
      console.error("Failed to delete item:", err);
      setDeleteError(
        intl.formatMessage(
          {
            id: "items.error.delete",
            defaultMessage: "Failed to delete item: {error}",
          },
          { error: err.message },
        ),
      );
    } finally {
      setIsDeleting(false);
    }
  };

  // --- Image View Modal Handlers ---
  const handleImageClick = (imageFile, imageAlt) => {
    if (!(imageFile instanceof File)) return; // Only handle File objects
    const blobUrl = URL.createObjectURL(imageFile);
    setImageViewModalUrl(blobUrl); // Use the temporary blob URL
    setImageViewModalAlt(imageAlt || "Image view");
    setIsImageViewModalOpen(true);
  };

  const handleCloseImageViewModal = () => {
    setIsImageViewModalOpen(false);
    // Revoke the blob URL when the modal closes to free memory
    if (imageViewModalUrl && imageViewModalUrl.startsWith("blob:")) {
      URL.revokeObjectURL(imageViewModalUrl);
    }
    // Optional: Delay clearing state slightly for fade-out transition
    setTimeout(() => {
      setImageViewModalUrl(null);
      setImageViewModalAlt("");
    }, 200); // Match CSS transition duration
  };

  // --- Webcam Handlers ---
  const handleOpenWebcam = (target) => {
    // target is 'add' or 'edit'
    setWebcamTarget(target);
    setIsWebcamOpen(true);
  };

  const handleWebcamCapture = useCallback(
    async (imageFile) => {
      if (!imageFile) return;

      if (webcamTarget === "add") {
        if (addImageUrl) URL.revokeObjectURL(addImageUrl); // Revoke previous
        setNewItemImageFile(imageFile);
        setAddImageUrl(URL.createObjectURL(imageFile)); // Set new blob URL
      } else if (webcamTarget === "edit") {
        if (editImageUrl) URL.revokeObjectURL(editImageUrl); // Revoke previous
        setEditItemImageFile(imageFile);
        setEditImageUrl(URL.createObjectURL(imageFile)); // Set new blob URL
        setImageMarkedForRemoval(false); // Captured new image
      }

      setIsWebcamOpen(false); // Close the modal
    },
    [webcamTarget],
  ); // Dependency: webcamTarget

  // --- Render ---
  return (
    <div className="items-view">
      <h2>
        {intl.formatMessage({
          id: "items.title",
          defaultMessage: "Clothes Management",
        })}
      </h2>

      {/* Status Messages */}
      {loading && (
        <p className="status-loading">
          {intl.formatMessage({
            id: "items.loading",
            defaultMessage: "Loading data...",
          })}
        </p>
      )}
      {error && <p className="status-error">Error: {error}</p>}
      {success && <p className="status-success">{success}</p>}

      {/* Add Item Form */}
      {!api.config.isConfigured ? (
        <p className="status-warning">
          {intl.formatMessage({ id: "common.status.apiNotConfigured" })}
        </p>
      ) : typeof api.addItem !== "function" ||
        typeof api.listLocations !== "function" ||
        typeof api.listCategories !== "function" ? (
        <p className="status-warning">
          {intl.formatMessage({
            id: "items.addForm.notSupported",
            defaultMessage:
              "Adding or listing required data is not supported by the current API Provider.",
          })}
        </p>
      ) : (
        <form onSubmit={handleAddItem} className="add-item-form">
          <h3>
            {intl.formatMessage({
              id: "items.addForm.title",
              defaultMessage: "Add New Item",
            })}
          </h3>
          <div className="form-group">
            <label htmlFor="item-name">
              {intl.formatMessage({
                id: "items.addForm.nameLabel",
                defaultMessage: "Name:",
              })}
            </label>
            <input
              type="text"
              id="item-name"
              value={newItemName}
              onChange={(e) => setNewItemName(e.target.value)}
              required
              disabled={loading}
            />
          </div>
          <div className="form-group">
            <label htmlFor="item-description">
              {intl.formatMessage({
                id: "items.addForm.descriptionLabel",
                defaultMessage: "Description:",
              })}
            </label>
            <input
              type="text"
              id="item-description"
              value={newItemDescription}
              onChange={(e) => setNewItemDescription(e.target.value)}
              disabled={loading}
            />
          </div>
          {/* Image Upload */}
          <div className="form-group form-group-image">
            <label htmlFor="item-image">
              {intl.formatMessage({
                id: "items.addForm.imageLabel",
                defaultMessage: "Image:",
              })}
            </label>
            {/* Use addImageUrl for preview */}
            {addImageUrl && (
              <div className="image-preview">
                <img
                  src={addImageUrl}
                  alt={intl.formatMessage({
                    id: "items.addForm.imagePreviewAlt",
                    defaultMessage: "New item preview",
                  })}
                  // Pass the File object to handleImageClick
                  onClick={() =>
                    handleImageClick(
                      newItemImageFile,
                      intl.formatMessage({
                        id: "items.addForm.imagePreviewAlt",
                        defaultMessage: "New item preview",
                      }),
                    )
                  }
                  style={{ cursor: "pointer" }} // Indicate it's clickable
                />
              </div>
            )}
            {/* Action buttons for image */}
            <div className="form-group-image-actions">
              {/* Use button-light for file input label */}
              <label
                htmlFor="item-image"
                className={`button-light button-file-input ${loading ? "disabled" : ""}`}
              >
                {intl.formatMessage({
                  id: "items.addForm.chooseFile",
                  defaultMessage: "Choose File",
                })}
              </label>
              {/* Use button-secondary for webcam */}
              <button
                type="button"
                onClick={() => handleOpenWebcam("add")}
                disabled={loading}
                className="button-secondary"
              >
                {intl.formatMessage({
                  id: "items.addForm.takePicture",
                  defaultMessage: "Take Picture",
                })}
              </button>
              {/* Show remove button only if there's a preview URL */}
              {addImageUrl && (
                <button
                  type="button"
                  onClick={handleRemoveNewImage}
                  className="button-danger remove-image-button" // Keep danger class
                >
                  {intl.formatMessage({
                    id: "items.editForm.removeImage",
                    defaultMessage: "Remove Image",
                  })}
                </button>
              )}
            </div>
            {/* Hidden actual file input */}
            <input
              type="file"
              id="item-image"
              accept="image/*"
              onChange={(e) => handleFileChange(e, "add")}
              disabled={loading}
              className="hidden-file-input" // Class to hide it
            />
          </div>
          <div className="form-group">
            <label htmlFor="item-location">
              {intl.formatMessage({
                id: "items.addForm.locationLabel",
                defaultMessage: "Location:",
              })}
            </label>
            <select
              id="item-location"
              value={newItemLocationId}
              onChange={(e) => setNewItemLocationId(e.target.value)}
              required
              disabled={loading || locations.length === 0}
            >
              <option value="">
                {intl.formatMessage({
                  id: "items.addForm.selectLocationDefault",
                  defaultMessage: "-- Select Location --",
                })}
              </option>
              {locations.map((loc) => (
                <option key={loc.location_id} value={loc.location_id}>
                  {loc.name}
                </option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label htmlFor="item-category">
              {intl.formatMessage({
                id: "items.addForm.categoryLabel",
                defaultMessage: "Category:",
              })}
            </label>
            <select
              id="item-category"
              value={newItemCategoryId}
              onChange={(e) => setNewItemCategoryId(e.target.value)}
              required
              disabled={loading || categories.length === 0}
            >
              <option value="">
                {intl.formatMessage({
                  id: "items.addForm.selectCategoryDefault",
                  defaultMessage: "-- Select Category --",
                })}
              </option>
              {categories.map((cat) => (
                <option key={cat.category_id} value={cat.category_id}>
                  {cat.name}
                </option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label htmlFor="item-owner">
              {intl.formatMessage({
                id: "items.addForm.ownerLabel",
                defaultMessage: "Owner:",
              })}
            </label>
            <select
              id="item-owner"
              value={newItemOwnerId}
              onChange={(e) => setNewItemOwnerId(e.target.value)}
              required
              disabled={loading || owners.length === 0}
            >
              <option value="">
                {intl.formatMessage({
                  id: "items.addForm.selectOwnerDefault",
                  defaultMessage: "-- Select Owner --",
                })}
              </option>
              {owners.map((owner) => (
                <option key={owner.owner_id} value={owner.owner_id}>
                  {owner.name}
                </option>
              ))}
            </select>
          </div>
          <button
            type="submit"
            disabled={
              loading ||
              !newItemName.trim() ||
              !newItemLocationId ||
              !newItemCategoryId ||
              !newItemOwnerId
            }
            className="button-primary"
          >
            {loading
              ? intl.formatMessage({
                  id: "items.addForm.button.adding",
                  defaultMessage: "Adding...",
                })
              : intl.formatMessage({
                  id: "items.addForm.button.add",
                  defaultMessage: "Add Item",
                })}
          </button>
        </form>
      )}

      {/* Items List */}
      <h3>
        {intl.formatMessage({
          id: "items.list.title",
          defaultMessage: "Existing Items",
        })}
      </h3>

      {/* Filter Toggle Button - Use button-light */}
      {api.config.isConfigured &&
        typeof api.listItems === "function" &&
        items.length > 0 && (
          <button
            onClick={handleFilterToggle}
            className="button-light filter-toggle-button"
            aria-controls="filters-container"
            aria-expanded={isFilterVisible}
          >
            {intl.formatMessage({
              id: "items.filter.toggleButton",
              defaultMessage: "Filters",
            })}{" "}
            ({filteredItems.length}/{items.length}){" "}
            {/* Show filtered/total count */}
          </button>
        )}

      {/* Collapsible Filter Container */}
      {isFilterVisible && (
        <div id="filters-container" className="filters-container">
          <h4>
            {intl.formatMessage({
              id: "items.filter.title",
              defaultMessage: "Filter Items",
            })}
          </h4>
          <div className="filter-group">
            <label htmlFor="filter-text">
              {intl.formatMessage({
                id: "items.filter.textLabel",
                defaultMessage: "Text contains:",
              })}
            </label>
            <input
              type="text"
              id="filter-text"
              value={filterName}
              onChange={(e) => setFilterName(e.target.value)}
              placeholder={intl.formatMessage({
                id: "items.filter.textPlaceholder",
                defaultMessage: "e.g., Blue Shirt",
              })}
            />
          </div>

          {/* Location Filter */}
          <fieldset className="filter-group checkbox-group">
            <legend>
              {intl.formatMessage({
                id: "items.filter.locationLabel",
                defaultMessage: "Location:",
              })}
            </legend>
            {locations.map((loc) => (
              <div key={loc.location_id} className="checkbox-item">
                <input
                  type="checkbox"
                  id={`loc-${loc.location_id}`}
                  value={loc.location_id}
                  checked={filterLocationIds.includes(loc.location_id)}
                  onChange={(e) =>
                    handleCheckboxFilterChange("location", e.target.value)
                  }
                />
                <label htmlFor={`loc-${loc.location_id}`}>{loc.name}</label>
              </div>
            ))}
          </fieldset>

          {/* Category Filter */}
          <fieldset className="filter-group checkbox-group">
            <legend>
              {intl.formatMessage({
                id: "items.filter.categoryLabel",
                defaultMessage: "Category:",
              })}
            </legend>
            {categories.map((cat) => (
              <div key={cat.category_id} className="checkbox-item">
                <input
                  type="checkbox"
                  id={`cat-${cat.category_id}`}
                  value={cat.category_id}
                  checked={filterCategoryIds.includes(cat.category_id)}
                  onChange={(e) =>
                    handleCheckboxFilterChange("category", e.target.value)
                  }
                />
                <label htmlFor={`cat-${cat.category_id}`}>{cat.name}</label>
              </div>
            ))}
          </fieldset>

          {/* Owner Filter */}
          <fieldset className="filter-group checkbox-group">
            <legend>
              {intl.formatMessage({
                id: "items.filter.ownerLabel",
                defaultMessage: "Owner:",
              })}
            </legend>
            {owners.map((owner) => (
              <div key={owner.owner_id} className="checkbox-item">
                <input
                  type="checkbox"
                  id={`owner-${owner.owner_id}`}
                  value={owner.owner_id}
                  checked={filterOwnerIds.includes(owner.owner_id)}
                  onChange={(e) =>
                    handleCheckboxFilterChange("owner", e.target.value)
                  }
                />
                <label htmlFor={`owner-${owner.owner_id}`}>{owner.name}</label>
              </div>
            ))}
          </fieldset>

          {/* Use button-light for reset */}
          <button
            onClick={handleResetFilters}
            className="button-light reset-filters-button"
          >
            {intl.formatMessage({
              id: "items.filter.resetButton",
              defaultMessage: "Reset Filters",
            })}
          </button>
        </div>
      )}

      {typeof api.listItems !== "function" && api.config.isConfigured && (
        <p className="status-warning">
          {intl.formatMessage({
            id: "items.list.notSupported",
            defaultMessage:
              "Listing items is not supported by the current API Provider.",
          })}
        </p>
      )}
      {typeof api.listItems === "function" &&
        !loading &&
        filteredItems.length === 0 &&
        items.length > 0 &&
        !error &&
        api.config.isConfigured && (
          <p>
            {intl.formatMessage({
              id: "items.list.emptyFiltered",
              defaultMessage: "No items match the current filters.",
            })}
          </p>
        )}
      {typeof api.listItems === "function" &&
        !loading &&
        items.length === 0 &&
        !error &&
        api.config.isConfigured && (
          <p>
            {intl.formatMessage({
              id: "items.list.empty",
              defaultMessage: "No items found. Add one above!",
            })}
          </p>
        )}
      {typeof api.listItems === "function" && filteredItems.length > 0 && (
        <div className="items-list">
          {filteredItems.map((item) => (
            <div key={item.item_id} className="item-card">
              {/* Display image using Blob URL from state */}
              <div
                className={`item-image-container ${!itemImageUrls[item.item_id] ? "placeholder" : ""} ${itemImageUrls[item.item_id] ? "clickable" : ""}`}
                // Pass the File object to handleImageClick
                onClick={() =>
                  item.imageFile && handleImageClick(item.imageFile, item.name)
                }
                title={
                  itemImageUrls[item.item_id]
                    ? intl.formatMessage({
                        id: "items.card.viewImageTooltip",
                        defaultMessage: "Click to view full image",
                      })
                    : ""
                }
              >
                {
                  itemImageUrls[item.item_id] ? (
                    <img
                      src={itemImageUrls[item.item_id]} // Use Blob URL from state
                      alt={item.name}
                      className="item-image"
                    />
                  ) : null /* Background handles placeholder */
                }
              </div>
              <div className="item-card-content">
                <h4>{item.name}</h4>
                {item.description && (
                  <p className="item-description">{item.description}</p>
                )}
                <p className="item-meta">
                  {intl.formatMessage({
                    id: "locations.titleSingular",
                    defaultMessage: "Location",
                  })}
                  : {getLocationNameById(item.location_id)}
                </p>
                <p className="item-meta">
                  {intl.formatMessage({
                    id: "categories.titleSingular",
                    defaultMessage: "Category",
                  })}
                  : {getCategoryNameById(item.category_id)}
                </p>
                <p className="item-meta">
                  {intl.formatMessage({
                    id: "owners.titleSingular",
                    defaultMessage: "Owner",
                  })}
                  : {getOwnerNameById(item.owner_id)}
                </p>
              </div>
              {/* Show Edit button only if provider configured and update method exists - Use button-light */}
              {api.config.isConfigured &&
                typeof api.updateItem === "function" && (
                  <button
                    onClick={() => handleEditClick(item)}
                    className="edit-button button-light" /* Add button-light */
                    aria-label={intl.formatMessage(
                      {
                        id: "items.editButton.label",
                        defaultMessage: "Edit {name}",
                      },
                      { name: item.name },
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

      {/* Edit Item Modal */}
      {editingItemId && (
        <Modal
          show={!!editingItemId}
          onClose={handleCancelEdit}
          title={intl.formatMessage({
            id: "items.editModal.title",
            defaultMessage: "Edit Item",
          })}
        >
          {(() => {
            // IIFE to manage displayImageUrl logic cleanly
            // Use editImageUrl (derived from editItemImageFile or original item.imageFile)
            // If marked for removal, show nothing.
            const displayImageUrl = imageMarkedForRemoval ? null : editImageUrl;
            return (
              <form onSubmit={handleUpdateItem} className="edit-item-form">
                {updateError && (
                  <p className="status-error">Error: {updateError}</p>
                )}
                <div className="form-group">
                  <label htmlFor="edit-item-name">
                    {intl.formatMessage({
                      id: "items.addForm.nameLabel",
                      defaultMessage: "Name:",
                    })}
                  </label>
                  <input
                    type="text"
                    id="edit-item-name"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    required
                    disabled={isUpdating || isDeleting}
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="edit-item-description">
                    {intl.formatMessage({
                      id: "items.addForm.descriptionLabel",
                      defaultMessage: "Description:",
                    })}
                  </label>
                  <input
                    type="text"
                    id="edit-item-description"
                    value={editDescription}
                    onChange={(e) => setEditDescription(e.target.value)}
                    disabled={isUpdating || isDeleting}
                  />
                </div>
                {/* Image Upload/Preview/Remove */}
                <div className="form-group form-group-image">
                  <label htmlFor="edit-item-image">
                    {intl.formatMessage({
                      id: "items.editForm.imageLabel",
                      defaultMessage: "Image:",
                    })}
                  </label>
                  {/* Use displayImageUrl derived from editImageUrl */}
                  {displayImageUrl && (
                    <div className="image-preview">
                      <img
                        src={displayImageUrl}
                        alt={intl.formatMessage({
                          id: "items.editForm.imagePreviewAlt",
                          defaultMessage: "Item image preview",
                        })}
                        // Pass the File object to handleImageClick
                        onClick={() =>
                          handleImageClick(
                            editItemImageFile,
                            editName ||
                              intl.formatMessage({
                                id: "items.editForm.imagePreviewAlt",
                                defaultMessage: "Item image preview",
                              }),
                          )
                        }
                        style={{ cursor: "pointer" }} // Indicate it's clickable
                      />
                    </div>
                  )}
                  {/* Action buttons for image */}
                  <div className="form-group-image-actions">
                    {/* Use button-light for file input label */}
                    <label
                      htmlFor="edit-item-image"
                      className={`button-light button-file-input ${isUpdating || isDeleting ? "disabled" : ""}`}
                    >
                      {intl.formatMessage({
                        id: "items.addForm.chooseFile",
                        defaultMessage: "Choose File",
                      })}
                    </label>
                    {/* Use button-secondary for webcam */}
                    <button
                      type="button"
                      onClick={() => handleOpenWebcam("edit")}
                      disabled={isUpdating || isDeleting}
                      className="button-secondary"
                    >
                      {intl.formatMessage({
                        id: "items.addForm.takePicture",
                        defaultMessage: "Take Picture",
                      })}
                    </button>
                    {/* Show remove button only if there's an image currently displayed */}
                    {displayImageUrl &&
                      typeof api.deleteItem === "function" && (
                        <button
                          type="button"
                          onClick={handleRemoveEditImage}
                          className="button-danger remove-image-button" // Keep danger class
                          disabled={isUpdating || isDeleting}
                        >
                          {intl.formatMessage({
                            id: "items.editForm.removeImage",
                            defaultMessage: "Remove Image",
                          })}
                        </button>
                      )}
                  </div>
                  {/* Hidden actual file input */}
                  <input
                    type="file"
                    id="edit-item-image"
                    accept="image/*"
                    onChange={(e) => handleFileChange(e, "edit")}
                    disabled={isUpdating || isDeleting}
                    className="hidden-file-input" // Class to hide it
                  />
                </div>
                {/* Location Dropdown */}
                <div className="form-group">
                  <label htmlFor="edit-item-location">
                    {intl.formatMessage({
                      id: "items.addForm.locationLabel",
                      defaultMessage: "Location:",
                    })}
                  </label>
                  <select
                    id="edit-item-location"
                    value={editLocationId}
                    onChange={(e) => setEditLocationId(e.target.value)}
                    required
                    disabled={
                      isUpdating || isDeleting || locations.length === 0
                    }
                  >
                    <option value="">
                      {intl.formatMessage({
                        id: "items.addForm.selectLocationDefault",
                        defaultMessage: "-- Select Location --",
                      })}
                    </option>
                    {locations.map((loc) => (
                      <option key={loc.location_id} value={loc.location_id}>
                        {loc.name}
                      </option>
                    ))}
                  </select>
                </div>
                {/* Category Dropdown */}
                <div className="form-group">
                  <label htmlFor="edit-item-category">
                    {intl.formatMessage({
                      id: "items.addForm.categoryLabel",
                      defaultMessage: "Category:",
                    })}
                  </label>
                  <select
                    id="edit-item-category"
                    value={editCategoryId}
                    onChange={(e) => setEditCategoryId(e.target.value)}
                    required
                    disabled={
                      isUpdating || isDeleting || categories.length === 0
                    }
                  >
                    <option value="">
                      {intl.formatMessage({
                        id: "items.addForm.selectCategoryDefault",
                        defaultMessage: "-- Select Category --",
                      })}
                    </option>
                    {categories.map((cat) => (
                      <option key={cat.category_id} value={cat.category_id}>
                        {cat.name}
                      </option>
                    ))}
                  </select>
                </div>
                {/* Owner Dropdown */}
                <div className="form-group">
                  <label htmlFor="edit-item-owner">
                    {intl.formatMessage({
                      id: "items.addForm.ownerLabel",
                      defaultMessage: "Owner:",
                    })}
                  </label>
                  <select
                    id="edit-item-owner"
                    value={editOwnerId}
                    onChange={(e) => setEditOwnerId(e.target.value)}
                    required
                    disabled={isUpdating || isDeleting || owners.length === 0}
                  >
                    <option value="">
                      {intl.formatMessage({
                        id: "items.addForm.selectOwnerDefault",
                        defaultMessage: "-- Select Owner --",
                      })}
                    </option>
                    {owners.map((owner) => (
                      <option key={owner.owner_id} value={owner.owner_id}>
                        {owner.name}
                      </option>
                    ))}
                  </select>
                </div>
                {/* Location/Category dropdowns are NOT included in edit for now - REMOVED */}
                <div className="modal-actions">
                  <button
                    type="submit"
                    disabled={
                      isUpdating ||
                      isDeleting ||
                      !editName.trim() ||
                      !editLocationId ||
                      !editCategoryId ||
                      !editOwnerId
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
                  {/* Use button-danger for delete */}
                  {api.config.isConfigured &&
                    typeof api.deleteItem === "function" && (
                      <button
                        type="button"
                        className="button-danger"
                        onClick={() => handleDeleteClick(editingItemId)}
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
            );
          })()}
        </Modal>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <Modal
          show={showDeleteConfirm}
          onClose={handleCancelDelete}
          title={intl.formatMessage({
            id: "items.deleteModal.title",
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
                  id: "items.deleteModal.confirmMessage",
                  defaultMessage:
                    'Are you sure you want to delete the item "{name}"? This action cannot be undone.',
                },
                {
                  name:
                    items.find((i) => i.item_id === deleteCandidateId)?.name ||
                    "",
                },
              )}
            </p>
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

      {/* Full Size Image View Modal */}
      <ImageViewModal
        show={isImageViewModalOpen}
        onClose={handleCloseImageViewModal}
        imageUrl={imageViewModalUrl}
        imageAlt={imageViewModalAlt}
      />

      {/* Webcam Capture Modal */}
      <WebcamCapture
        show={isWebcamOpen}
        onCapture={handleWebcamCapture}
        onClose={() => setIsWebcamOpen(false)}
      />
    </div>
  );
};

export default ItemsView;
