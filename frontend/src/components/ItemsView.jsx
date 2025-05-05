import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useApi } from "../api/ApiContext";
import { useSettings } from "../settings/SettingsContext";
import { useIntl } from "react-intl";
import imageCompression from "browser-image-compression";
import Modal from "./Modal";
import ImageViewModal from "./ImageViewModal";
import WebcamCapture from "./WebcamCapture";
import "./ItemsView.css";
import "./ImageViewModal.css";
import "./WebcamCapture.css";

const ItemsView = () => {
  const [items, setItems] = useState([]);
  const [locations, setLocations] = useState([]);
  const [categories, setCategories] = useState([]);
  const [owners, setOwners] = useState([]);

  const [newItemName, setNewItemName] = useState("");
  const [newItemDescription, setNewItemDescription] = useState("");
  const [newItemLocationId, setNewItemLocationId] = useState("");
  const [newItemCategoryId, setNewItemCategoryId] = useState("");
  const [newItemImageFile, setNewItemImageFile] = useState(null);
  const [newItemOwnerId, setNewItemOwnerId] = useState("");

  const [loading, setLoading] = useState(false); // For initial list loading and adding
  const [error, setError] = useState(null); // For list loading and adding errors
  const [success, setSuccess] = useState(null); // For general success messages

  const [editingItemId, setEditingItemId] = useState(null);
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editLocationId, setEditLocationId] = useState("");
  const [editCategoryId, setEditCategoryId] = useState("");
  const [editItemImageFile, setEditItemImageFile] = useState(null);
  const [editOwnerId, setEditOwnerId] = useState("");
  const [isUpdating, setIsUpdating] = useState(false);
  const [updateError, setUpdateError] = useState(null);
  const [imageMarkedForRemoval, setImageMarkedForRemoval] = useState(false);

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteCandidateId, setDeleteCandidateId] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState(null);

  const [isImageViewModalOpen, setIsImageViewModalOpen] = useState(false);
  const [imageViewModalUrl, setImageViewModalUrl] = useState(null);
  const [imageViewModalAlt, setImageViewModalAlt] = useState("");

  const [isWebcamOpen, setIsWebcamOpen] = useState(false);
  const [webcamTarget, setWebcamTarget] = useState("add"); // 'add' or 'edit'

  // State for managing temporary Blob URLs for display
  const [itemImageUrls, setItemImageUrls] = useState({}); // Map itemId -> blobUrl
  const [addImageUrl, setAddImageUrl] = useState(null);
  const [editImageUrl, setEditImageUrl] = useState(null);

  const [isFilterVisible, setIsFilterVisible] = useState(false);
  const [filterName, setFilterName] = useState("");
  const [filterLocationIds, setFilterLocationIds] = useState([]);
  const [filterCategoryIds, setFilterCategoryIds] = useState([]);
  const [filterOwnerIds, setFilterOwnerIds] = useState([]);

  const [sortCriteria, setSortCriteria] = useState("created_at_desc"); // Default to newest first

  const api = useApi();
  const { settings: appSettings } = useSettings();
  const intl = useIntl();

  const fetchData = useCallback(async () => {
    // Check if API is configured and required methods exist
    const canFetchItems =
      api.isConfigured && typeof api.listItems === "function";
    const canFetchLocations =
      api.isConfigured && typeof api.listLocations === "function";
    const canFetchCategories =
      api.isConfigured && typeof api.listCategories === "function";
    const canFetchOwners =
      api.isConfigured && typeof api.listOwners === "function";
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
        api.isConfigured
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
          api.listOwners(),
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
      return true;
    });
  }, [items, filterName, filterLocationIds, filterCategoryIds, filterOwnerIds]);

  // Apply sorting after filtering
  const sortedItems = useMemo(() => {
    const itemsToSort = [...filteredItems];
    itemsToSort.sort((a, b) => {
      switch (sortCriteria) {
        case "created_at_asc":
          // Handle potential null/undefined created_at defensively
          return new Date(a.created_at || 0) - new Date(b.created_at || 0);
        case "created_at_desc":
        default:
          return new Date(b.created_at || 0) - new Date(a.created_at || 0);
        // Add cases for other criteria like 'name_asc', 'name_desc' here if needed later
      }
    });
    return itemsToSort;
  }, [filteredItems, sortCriteria]);

  // Effect to create/revoke Blob URLs for item list display
  useEffect(() => {
    const newItemImageUrls = {};
    sortedItems.forEach((item) => {
      // Use sortedItems for URL generation
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
      setItemImageUrls({});
    };
  }, [sortedItems]);

  const getLocationNameById = (id) =>
    locations.find((loc) => loc.location_id === id)?.name ||
    intl.formatMessage({ id: "items.card.noLocation", defaultMessage: "N/A" });
  const getCategoryNameById = (id) =>
    categories.find((cat) => cat.category_id === id)?.name ||
    intl.formatMessage({ id: "items.card.noCategory", defaultMessage: "N/A" });
  const getOwnerNameById = (id) =>
    owners.find((owner) => owner.owner_id === id)?.name ||
    intl.formatMessage({ id: "items.card.noOwner", defaultMessage: "N/A" });

  const handleFileChange = (event, type) => {
    const file = event.target.files[0];
    if (file instanceof File) {
      if (type === "add") {
        // Revoke previous add form blob URL if exists
        if (addImageUrl) URL.revokeObjectURL(addImageUrl);
        setNewItemImageFile(file);
        setAddImageUrl(URL.createObjectURL(file));
      } else if (type === "edit") {
        // Revoke previous edit form blob URL if exists
        if (editImageUrl) URL.revokeObjectURL(editImageUrl);
        setEditItemImageFile(file);
        setEditImageUrl(URL.createObjectURL(file));
        setImageMarkedForRemoval(false); // New file selected, so don't mark for removal
      }
    }
    // Clear the input value to allow selecting the same file again
    event.target.value = null;
  };

  const handleRemoveNewImage = () => {
    if (addImageUrl) URL.revokeObjectURL(addImageUrl);
    setNewItemImageFile(null);
    setAddImageUrl(null);
  };

  // --- Image Compression Helper ---
  const processImageFile = useCallback(
    async (file) => {
      if (!appSettings.imageCompressionEnabled || !(file instanceof File)) {
        console.log("Image compression skipped (disabled or not a file).");
        return file;
      }

      console.log(
        `Original image size: ${(file.size / 1024 / 1024).toFixed(3)} MB`,
      );

      const options = {
        maxSizeMB: 0.2, // Max size in MB
        maxWidthOrHeight: 1024, // Max width or height
        useWebWorker: true, // Use web worker for performance
        fileType: "image/jpeg", // Force output type
      };

      try {
        const compressedBlob = await imageCompression(file, options);

        console.log(
          `Compressed image size: ${(compressedBlob.size / 1024 / 1024).toFixed(3)} MB`,
        );

        // Convert the compressed Blob back into a File object
        // Use the original filename and the Blob's type (or fallback to original type)
        const compressedFile = new File([compressedBlob], file.name, {
          type: compressedBlob.type || file.type, // Use blob's type, fallback to original
          lastModified: Date.now(), // Set last modified timestamp
        });
        return compressedFile;
      } catch (error) {
        console.error("Image compression failed:", error);
        // Instead of setting error here and returning original file,
        // throw the error so the calling function handles it.
        // Note: We need a translation string for this new error context.
        // Let's add one (assuming you'll add it to your translation files):
        // "items.error.compressionFailed": "Image compression failed"
        throw new Error(
          intl.formatMessage({
            id: "items.error.compressionFailed",
            defaultMessage: "Image compression failed",
          }) + `: ${error.message}`,
        );
      }
    },
    [appSettings.imageCompressionEnabled, intl],
  ); // Depend on the setting

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
    if (!api.isConfigured || !api.addItem) {
      setError(
        api.isConfigured
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
      let fileToSend = newItemImageFile;
      // Process image before sending if a file exists
      if (newItemImageFile instanceof File) {
        fileToSend = await processImageFile(newItemImageFile);
      }

      const result = await api.addItem({
        name: newItemName.trim(),
        description: newItemDescription.trim() || null,
        location_id: parseInt(newItemLocationId, 10),
        category_id: parseInt(newItemCategoryId, 10),
        owner_id: parseInt(newItemOwnerId, 10),
        imageFile: fileToSend, // Pass the potentially compressed File object
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
        fetchData();
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
    setEditLocationId(item.location_id || "");
    setEditCategoryId(item.category_id || "");
    setEditOwnerId(item.owner_id || "");

    // Handle image state for edit modal
    if (editImageUrl) URL.revokeObjectURL(editImageUrl); // Revoke previous edit preview URL
    if (item.imageFile instanceof File) {
      setEditItemImageFile(item.imageFile);
      setEditImageUrl(URL.createObjectURL(item.imageFile));
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
    setEditLocationId("");
    setEditCategoryId("");
    setEditOwnerId("");

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
      !api.updateItem // Check method existence
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
      let fileToSend = editItemImageFile;
      // Process image before sending if a new file was selected
      if (editItemImageFile instanceof File && !imageMarkedForRemoval) {
        // setIsUpdating(true);
        fileToSend = await processImageFile(editItemImageFile);
        // setIsUpdating(false);
      }

      const result = await api.updateItem(editingItemId, {
        name: editName.trim(),
        description: editDescription.trim() || null,
        location_id: parseInt(editLocationId, 10), // Include location_id
        category_id: parseInt(editCategoryId, 10), // Include category_id
        owner_id: parseInt(editOwnerId, 10), // Include owner_id
        imageFile: fileToSend, // Pass the potentially compressed file
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
    if (!deleteCandidateId || !api.deleteItem) {
      // Check method existence
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
      if (!(imageFile instanceof File)) return;

      // Process the captured image *before* setting state/URL
      const processedFile = await processImageFile(imageFile);

      if (webcamTarget === "add") {
        if (addImageUrl) URL.revokeObjectURL(addImageUrl); // Revoke previous
        setNewItemImageFile(processedFile); // Use processed file
        setAddImageUrl(URL.createObjectURL(processedFile)); // Set new blob URL from processed file
      } else if (webcamTarget === "edit") {
        if (editImageUrl) URL.revokeObjectURL(editImageUrl); // Revoke previous
        setEditItemImageFile(processedFile); // Use processed file
        setEditImageUrl(URL.createObjectURL(processedFile)); // Set new blob URL from processed file
        setImageMarkedForRemoval(false); // Captured new image, don't remove
      }

      setIsWebcamOpen(false); // Close the modal
    },
    [webcamTarget, processImageFile, addImageUrl, editImageUrl],
  );

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
      {!api.isConfigured ? (
        <p className="status-warning">
          {intl.formatMessage({ id: "common.status.apiNotConfigured" })}
        </p>
      ) : !api.addItem || // Check method existence
        !api.listLocations ||
        !api.listCategories ||
        !api.listOwners ? ( // Added owner check
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
              {/* Use button-secondary for webcam -> CHANGE TO button-light */}
              <button
                type="button"
                onClick={() => handleOpenWebcam("add")}
                disabled={loading}
                className="button-light"
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
                  className="button-danger-light remove-image-button"
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
              className="hidden-file-input"
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

      {/* Sort and Filter Controls Container */}
      {api.isConfigured &&
        typeof api.listItems === "function" &&
        items.length > 0 && (
          <div className="list-controls-container">
            {/* Filter Toggle Button - Use button-light */}
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
          </div>
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
          {/* Sort Widget - Moved here */}
          <div className="filter-group">
            {" "}
            {/* Changed class from sort-widget form-group */}
            <label htmlFor="sort-criteria">
              {intl.formatMessage({
                id: "items.sort.label",
                defaultMessage: "Sort by:",
              })}
            </label>
            <select
              id="sort-criteria"
              value={sortCriteria}
              onChange={(e) => setSortCriteria(e.target.value)}
              disabled={loading}
            >
              <option value="created_at_desc">
                {intl.formatMessage({
                  id: "items.sort.newestFirst",
                  defaultMessage: "Newest First",
                })}
              </option>
              <option value="created_at_asc">
                {intl.formatMessage({
                  id: "items.sort.oldestFirst",
                  defaultMessage: "Oldest First",
                })}
              </option>
              {/* Add other sort options here later if needed */}
            </select>
          </div>
          {/* Text Filter */}
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

      {typeof api.listItems !== "function" && api.isConfigured && (
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
        sortedItems.length === 0 && // Check sortedItems
        items.length > 0 &&
        !error &&
        api.isConfigured && (
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
        api.isConfigured && (
          <p>
            {intl.formatMessage({
              id: "items.list.empty",
              defaultMessage: "No items found. Add one above!",
            })}
          </p>
        )}
      {typeof api.listItems === "function" &&
        sortedItems.length > 0 && ( // Check sortedItems
          <div className="items-list">
            {sortedItems.map(
              (
                item, // Iterate over sortedItems
              ) => (
                <div key={item.item_id} className="item-card">
                  {/* Display image using Blob URL from state */}
                  <div
                    className={`item-image-container ${!itemImageUrls[item.item_id] ? "placeholder" : ""} ${itemImageUrls[item.item_id] ? "clickable" : ""}`}
                    // Pass the File object to handleImageClick
                    onClick={() =>
                      item.imageFile &&
                      handleImageClick(item.imageFile, item.name)
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
                    <p className="item-meta">
                      {intl.formatMessage({
                        id: "items.card.createdAt",
                        defaultMessage: "Created:",
                      })}{" "}
                      {item.created_at
                        ? intl.formatDate(new Date(item.created_at), {
                            year: "numeric",
                            month: "short",
                            day: "numeric",
                            // Optional: Add time if desired and available
                            // hour: 'numeric', minute: 'numeric'
                          })
                        : intl.formatMessage({
                            id: "items.card.unknownDate",
                            defaultMessage: "Unknown",
                          })}
                    </p>
                  </div>
                  {/* Show Edit button only if provider configured and update method exists - Use button-light */}
                  {api.isConfigured && // Use api.isConfigured
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
              ),
            )}
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
                    {/* Use button-secondary for webcam -> CHANGE TO button-light */}
                    <button
                      type="button"
                      onClick={() => handleOpenWebcam("edit")}
                      disabled={isUpdating || isDeleting}
                      className="button-light" // CHANGED from button-secondary
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
                          className="button-danger-light remove-image-button" // CHANGED from button-danger
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
                  {api.isConfigured && // Use api.isConfigured
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
      {isWebcamOpen && ( // Conditionally render the component
        <WebcamCapture
          show={isWebcamOpen} // Pass show={true} since it's only rendered when true
          onCapture={handleWebcamCapture}
          onClose={() => setIsWebcamOpen(false)}
        />
      )}
    </div>
  );
};

export default ItemsView;
