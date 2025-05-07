import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useApi } from "../api/ApiContext";
import { useSettings } from "../settings/SettingsContext";
import { useIntl } from "react-intl";
import imageCompression from "browser-image-compression";
import Modal from "./Modal";
import ImageViewModal from "./ImageViewModal";
import { compressImage, rotateImageFile } from "../helpers/images";
import "./ItemsView.css";
import "./ImageViewModal.css";

const ItemsView = () => {
  const [items, setItems] = useState([]);
  const [locations, setLocations] = useState([]);
  const [categories, setCategories] = useState([]);
  const [owners, setOwners] = useState([]);

  // Pagination and loading state
  const [currentPage, setCurrentPage] = useState(0); // Will be 1-indexed after first successful fetch
  const [pageSize, setPageSize] = useState(5); // Items per page
  const [hasMoreItems, setHasMoreItems] = useState(true);
  const [totalItemsCount, setTotalItemsCount] = useState(0);
  const [loadingMore, setLoadingMore] = useState(false); // For loading subsequent pages

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

  // State for rotation loading
  const [isRotatingAdd, setIsRotatingAdd] = useState(false);
  const [isRotatingEdit, setIsRotatingEdit] = useState(false);

  // State for managing temporary Blob URLs for display
  const [itemImageUrls, setItemImageUrls] = useState({}); // Map itemId -> blobUrl
  const [addImageUrl, setAddImageUrl] = useState(null);
  const [editImageUrl, setEditImageUrl] = useState(null);

  const [isFilterVisible, setIsFilterVisible] = useState(false);
  const [filterName, setFilterName] = useState("");
  const [filterLocationIds, setFilterLocationIds] = useState([]);
  const [filterCategoryIds, setFilterCategoryIds] = useState([]);
  const [filterOwnerIds, setFilterOwnerIds] = useState([]);

  const [isAddItemModalOpen, setIsAddItemModalOpen] = useState(false);
  const [addItemError, setAddItemError] = useState(null);

  const [sortCriteria, setSortCriteria] = useState("created_at_desc"); // Default to newest first

  const loaderRef = useRef(null); // For IntersectionObserver

  const api = useApi();
  const { settings: appSettings } = useSettings();
  const intl = useIntl();

  const parseSortCriteria = (criteria) => {
    if (criteria.endsWith("_asc")) {
      return { sortBy: criteria.slice(0, -4), sortOrder: "asc" };
    }
    if (criteria.endsWith("_desc")) {
      return { sortBy: criteria.slice(0, -5), sortOrder: "desc" };
    }
    return { sortBy: "created_at", sortOrder: "desc" }; // Default
  };

  const fetchPageOfItems = useCallback(async (pageToFetch, isNewQuery = false) => {
    if (!api.isConfigured || typeof api.listItems !== "function") {
      setError(
        api.isConfigured
          ? intl.formatMessage({ id: "items.list.notSupported", defaultMessage: "Listing items is not supported by the current API Provider." })
          : intl.formatMessage({ id: "common.status.apiNotConfigured" })
      );
      setItems([]);
      setTotalItemsCount(0);
      setHasMoreItems(false);
      if (isNewQuery) setLoading(false); else setLoadingMore(false);
      return;
    }

    if (isNewQuery) {
      setLoading(true);
      // setItems([]); // Clearing items here causes a flicker if the new data is similar. Better to clear on success/error of new query.
      // setCurrentPage(0); // Reset page for new query, will be incremented by success handler
    } else {
      setLoadingMore(true);
    }
    setError(null);
    // Do not clear success message here, let it persist until next action or explicit clear.
    // setSuccess(null); 

    const { sortBy, sortOrder } = parseSortCriteria(sortCriteria);
    const fetchOptions = {
      page: pageToFetch,
      pageSize: pageSize,
      sortBy: sortBy,
      sortOrder: sortOrder,
      filters: {
        name: filterName.trim() || undefined,
        locationIds: filterLocationIds.length > 0 ? filterLocationIds : undefined,
        categoryIds: filterCategoryIds.length > 0 ? filterCategoryIds : undefined,
        ownerIds: filterOwnerIds.length > 0 ? filterOwnerIds : undefined,
      },
    };

    try {
      const result = await api.listItems(fetchOptions);
      setItems(prevItems => isNewQuery ? result.items : [...prevItems, ...result.items]);
      setTotalItemsCount(result.totalCount);
      setCurrentPage(pageToFetch); // Update current page upon successful fetch
      // Calculate hasMoreItems based on potentially updated items list length
      const currentTotalFetched = isNewQuery ? result.items.length : items.length + result.items.length;
      setHasMoreItems(currentTotalFetched < result.totalCount);
    } catch (err) {
      console.error("Failed to fetch items:", err);
      setError(intl.formatMessage({ id: "items.error.fetch", defaultMessage: "Failed to fetch items: {error}" }, { error: err.message }));
      if (isNewQuery) {
        setItems([]); // Clear items on error for a new query
        setTotalItemsCount(0);
        setHasMoreItems(false);
      }
      // For loading more, we might want to keep existing items and just show an error.
      // Or, setHasMoreItems(false) to prevent further attempts if loading more fails.
    } finally {
      if (isNewQuery) setLoading(false);
      else setLoadingMore(false);
    }
  }, [api, sortCriteria, pageSize, filterName, filterLocationIds, filterCategoryIds, filterOwnerIds, items.length, intl]); // Added items.length for hasMoreItems calculation in append mode

  // Fetch locations, categories, owners (ancillary data)
  const fetchAncillaryData = useCallback(async () => {
    if (!api.isConfigured) {
        setLocations([]); setCategories([]); setOwners([]);
        return;
    }
    try {
        const canFetchLocations = typeof api.listLocations === "function";
        const canFetchCategories = typeof api.listCategories === "function";
        const canFetchOwners = typeof api.listOwners === "function";

        const [locationsData, categoriesData, ownersData] = await Promise.all([
            canFetchLocations ? api.listLocations() : Promise.resolve([]),
            canFetchCategories ? api.listCategories() : Promise.resolve([]),
            canFetchOwners ? api.listOwners() : Promise.resolve([]),
        ]);
        setLocations(locationsData || []);
        setCategories(categoriesData || []);
        setOwners(ownersData || []);
    } catch (err) {
        console.error("Failed to fetch ancillary data (locations, categories, owners):", err);
        // Optionally set an error state specific to ancillary data or a general one
        setError(prev => `${prev ? prev + '; ' : ''}Failed to load L/C/O: ${err.message}`);
        setLocations([]); setCategories([]); setOwners([]);
    }
  }, [api, intl]);


  // Effect for initial data load (items and ancillary) and when API provider changes
  useEffect(() => {
    if (api.isConfigured && api.listItems) {
        fetchAncillaryData(); // Fetch locations, categories, owners
        fetchPageOfItems(1, true); // Fetch first page of items
    } else {
        // Clear data if API is not configured or listItems is not available
        setItems([]);
        setTotalItemsCount(0);
        setHasMoreItems(false);
        setLocations([]);
        setCategories([]);
        setOwners([]);
        setCurrentPage(0);
    }
  }, [api.isConfigured, api.listItems]); // Removed fetchPageOfItems from deps to avoid loop, it's called internally. Added fetchAncillaryData

  // Effect for filter/sort changes
  useEffect(() => {
    // Only run if api.listItems is available, otherwise initial load handles it.
    // And only if currentPage is not 0 (meaning initial load has happened or tried)
    if (api.listItems && currentPage !== 0) {
        fetchPageOfItems(1, true);
    }
    // This effect should run when sortCriteria or any filter state changes.
    // The initial load is handled by the previous useEffect.
  }, [sortCriteria, filterName, filterLocationIds, filterCategoryIds, filterOwnerIds]); // Removed api.listItems, fetchPageOfItems from deps

  // Infinite Scroll Intersection Observer
  useEffect(() => {
    if (loading || loadingMore || !hasMoreItems || !loaderRef.current) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) { // No need to check !loadingMore and hasMoreItems again, already checked above
          fetchPageOfItems(currentPage + 1, false);
        }
      },
      { threshold: 1.0 } // Trigger when 100% of the loader is visible
    );

    const currentLoaderRef = loaderRef.current;
    if (currentLoaderRef) {
      observer.observe(currentLoaderRef);
    }

    return () => {
      if (currentLoaderRef) {
        observer.unobserve(currentLoaderRef);
      }
    };
  }, [loading, loadingMore, hasMoreItems, currentPage, fetchPageOfItems]); // loaderRef.current is not a stable dependency

  // Effect to create/revoke Blob URLs for item list display
  useEffect(() => {
    const newItemImageUrls = {};
    items.forEach((item) => { // Use items (current page's items)
      if (item.imageFile instanceof File) {
        newItemImageUrls[item.item_id] = URL.createObjectURL(item.imageFile);
      }
    });
    setItemImageUrls(prevUrls => { // Merge with previous URLs to avoid revoking URLs for items not in the current `items` batch but still displayed
        // Revoke URLs that are no longer needed
        Object.keys(prevUrls).forEach(itemId => {
            if (!newItemImageUrls[itemId] && !items.find(i => i.item_id === parseInt(itemId))) {
                URL.revokeObjectURL(prevUrls[itemId]);
            }
        });
        return {...prevUrls, ...newItemImageUrls};
    });


    // Cleanup function to revoke all managed URLs when component unmounts
    return () => {
      Object.values(itemImageUrls).forEach(url => URL.revokeObjectURL(url));
      setItemImageUrls({});
    };
  }, [items]); // Depend on items state

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

  // --- Rotate Image Handler ---
  const handleRotateImage = async (formType) => {
    const isAdd = formType === "add";
    const currentFile = isAdd ? newItemImageFile : editItemImageFile;
    const setRotating = isAdd ? setIsRotatingAdd : setIsRotatingEdit;
    const setFile = isAdd ? setNewItemImageFile : setEditItemImageFile;
    const currentPreviewUrl = isAdd ? addImageUrl : editImageUrl;
    const setPreviewUrl = isAdd ? setAddImageUrl : setEditImageUrl;

    if (!currentFile) return; // No file to rotate

    setRotating(true);
    setError(null); // Clear previous errors
    setUpdateError(null);

    try {
      console.log(`Rotating image for ${formType}...`);
      const rotatedFile = await rotateImageFile(currentFile);
      console.log(
        `Rotation successful for ${formType}. New file:`,
        rotatedFile,
      );

      // Update the file state
      setFile(rotatedFile);

      // Update the preview URL
      if (currentPreviewUrl) {
        URL.revokeObjectURL(currentPreviewUrl); // Revoke the old URL
        console.log(
          `Revoked old preview URL for ${formType}: ${currentPreviewUrl}`,
        );
      }
      const newPreviewUrl = URL.createObjectURL(rotatedFile);
      setPreviewUrl(newPreviewUrl); // Create and set the new URL
      console.log(`Created new preview URL for ${formType}: ${newPreviewUrl}`);
    } catch (rotationError) {
      console.error(`Image rotation failed for ${formType}:`, rotationError);
      const rotationErrorMessage = intl.formatMessage(
        {
          id: "items.error.rotate",
          defaultMessage: "Image rotation failed: {error}",
        },
        { error: rotationError.message },
      );
      if (isAdd) {
        setError(rotationErrorMessage);
      } else {
        setUpdateError(rotationErrorMessage); // Show error in the modal
      }
      // Keep the old file/preview
    } finally {
      setRotating(false);
    }
  };

  const handleOpenAddItemModal = () => {
    setError(null); // Clear any previous main page errors
    setSuccess(null);
    setAddItemError(null); // Clear add item specific error
    // Reset form fields when opening the modal
    setNewItemName("");
    setNewItemDescription("");
    setNewItemLocationId("");
    setNewItemCategoryId("");
    if (addImageUrl) URL.revokeObjectURL(addImageUrl);
    setNewItemImageFile(null);
    setAddImageUrl(null);
    setNewItemOwnerId("");
    setIsAddItemModalOpen(true);
  };

  const handleCloseAddItemModal = () => {
    setIsAddItemModalOpen(false);
    setAddItemError(null); // Clear error when closing
    // Reset form fields
    setNewItemName("");
    setNewItemDescription("");
    setNewItemLocationId("");
    setNewItemCategoryId("");
    if (addImageUrl) URL.revokeObjectURL(addImageUrl);
    setNewItemImageFile(null);
    setAddImageUrl(null);
    setNewItemOwnerId("");
  };

  // --- Add Item Handler ---
  const handleAddItem = async (e) => {
    e.preventDefault();
    if (!newItemName.trim()) {
      setAddItemError(
        intl.formatMessage({
          id: "items.error.nameEmpty",
          defaultMessage: "Item name cannot be empty.",
        }),
      );
      return;
    }
    if (!newItemLocationId) {
      setAddItemError(
        intl.formatMessage({
          id: "items.error.locationMissing",
          defaultMessage: "Please select a location.",
        }),
      );
      return;
    }
    if (!newItemCategoryId) {
      setAddItemError(
        intl.formatMessage({
          id: "items.error.categoryMissing",
          defaultMessage: "Please select a category.",
        }),
      );
      return;
    }
    if (!newItemOwnerId) {
      setAddItemError(
        intl.formatMessage({
          id: "items.error.ownerMissing",
          defaultMessage: "Please select an owner.",
        }),
      );
      return;
    }
    if (!api.isConfigured || !api.addItem) {
      setAddItemError(
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
    setAddItemError(null); // Clear previous modal-specific error
    // setSuccess(null); // Global success, cleared when modal opens or handled globally

    try {
      let fileToSend = null; // Initialize fileToSend
      // Process image before sending if a file exists AND compression is enabled
      if (
        newItemImageFile instanceof File &&
        appSettings.imageCompressionEnabled
      ) {
        console.log("Attempting image compression for new item...");
        const compressionOptions = {
          maxSizeMB: 0.2,
          maxWidthOrHeight: 1024,
          useWebWorker: true,
          fileType: "image/jpeg",
        };
        const baseErrorMessage = intl.formatMessage({
          id: "items.error.compressionFailed",
          defaultMessage: "Image compression failed",
        });
        try {
          fileToSend = await compressImage(
            newItemImageFile,
            compressionOptions,
            baseErrorMessage,
          );
        } catch (compressionError) {
          // Handle compression error specifically, maybe show it to the user
          console.error("Compression failed during add:", compressionError);
          // Throw it again to be caught by the outer catch block which sets the general error state
          throw compressionError;
        }
      } else if (newItemImageFile instanceof File) {
        // If compression is disabled but there's a file, use the original
        fileToSend = newItemImageFile;
        console.log(
          "Image compression disabled or not applicable, using original file.",
        );
      }
      // else fileToSend remains null if no file was selected

      const result = await api.addItem({
        name: newItemName.trim(),
        description: newItemDescription.trim() || null,
        location_id: parseInt(newItemLocationId, 10),
        category_id: parseInt(newItemCategoryId, 10),
        owner_id: parseInt(newItemOwnerId, 10),
        imageFile: fileToSend, // Pass the potentially compressed File object
      });

      if (result.success) {
        // Fetch data, then close modal and show global success message
        handleCloseAddItemModal(); // Close modal first
        fetchPageOfItems(1, true).then(() => { // Refresh list from page 1
          setSuccess(
            intl.formatMessage(
              {
                id: "items.success.add",
                defaultMessage: 'Item "{name}" added successfully!',
              },
              { name: newItemName.trim() },
            ),
          );
        });
      } else {
        setAddItemError( // Set modal-specific error
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
      // Prefer setting modal-specific error if the operation originated from the modal
      setAddItemError(
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
      let fileToSend = null; // Initialize fileToSend
      // Process image before sending if a new file was selected AND compression is enabled
      if (
        editItemImageFile instanceof File &&
        !imageMarkedForRemoval &&
        appSettings.imageCompressionEnabled
      ) {
        console.log("Attempting image compression for updated item...");
        const compressionOptions = {
          maxSizeMB: 0.2,
          maxWidthOrHeight: 1024,
          useWebWorker: true,
          fileType: "image/jpeg",
        };
        const baseErrorMessage = intl.formatMessage({
          id: "items.error.compressionFailed",
          defaultMessage: "Image compression failed",
        });
        try {
          fileToSend = await compressImage(
            editItemImageFile,
            compressionOptions,
            baseErrorMessage,
          );
        } catch (compressionError) {
          // Handle compression error specifically
          console.error("Compression failed during update:", compressionError);
          // Throw it again to be caught by the outer catch block which sets the updateError state
          throw compressionError;
        }
      } else if (editItemImageFile instanceof File && !imageMarkedForRemoval) {
        // If compression is disabled but there's a file, use the original
        fileToSend = editItemImageFile;
        console.log(
          "Image compression disabled or not applicable, using original file for update.",
        );
      }
      // else fileToSend remains null if no new file selected or image marked for removal

      // The rest of the update logic uses fileToSend and imageMarkedForRemoval
      const result = await api.updateItem(editingItemId, {
        name: editName.trim(),
        description: editDescription.trim() || null,
        location_id: parseInt(editLocationId, 10),
        category_id: parseInt(editCategoryId, 10),
        owner_id: parseInt(editOwnerId, 10),
        imageFile: fileToSend, // Pass the potentially compressed or original file (or null)
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
        handleCancelEdit(); // Close edit modal
        fetchPageOfItems(1, true); // Refresh list from page 1
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
        handleCancelDelete(); // Close delete confirm modal
        handleCancelEdit(); // Close edit modal if open
        fetchPageOfItems(1, true); // Refresh list from page 1
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
    }, 200); // Match CSS transition duration (assuming 200ms was intended)
  };

  // --- Render ---
  return (
    <div className="items-view">

      {/* Status Messages */}
      {/* Main loading indicator for new queries */}
      {loading && !loadingMore && (
        <p className="status-loading">
          {intl.formatMessage({
            id: "items.loading",
            defaultMessage: "Loading data...",
          })}
        </p>
      )}
      {error && <p className="status-error">Error: {error}</p>}
      {success && <p className="status-success">{success}</p>}
      
      {/* Placeholder for API not configured message if no items are shown and not loading */}
      {!api.isConfigured && !loading && items.length === 0 && (
         <p className="status-warning">
           {intl.formatMessage({ id: "common.status.apiNotConfigured" })}
         </p>
      )}
      {api.isConfigured && typeof api.listItems !== "function" && !loading && items.length === 0 && (
        <p className="status-warning">
          {intl.formatMessage({ id: "items.list.notSupported", defaultMessage: "Listing items is not supported by the current API Provider."})}
        </p>
      )}


      {/* Items List */}

      {/* Sort and Filter Controls Container - Show if API is configured and listItems exists, even if items array is initially empty */}
      {api.isConfigured && typeof api.listItems === "function" && (
          <div className="list-controls-container">
            {/* Filter Toggle Button - Use button-light */}
            <button
              onClick={handleFilterToggle}
              className="button-light filter-toggle-button"
              aria-controls="filters-container"
              aria-expanded={isFilterVisible}
              disabled={loading || loadingMore} // Disable while loading
            >
              {intl.formatMessage({
                id: "items.filter.toggleButton",
                defaultMessage: "Filters",
              })}{" "}
              {/* Show filtered/total count. Use items.length for current display, totalItemsCount for total available */}
              ({items.length}{totalItemsCount > 0 ? ` / ${totalItemsCount}` : ''})
            </button>
          </div>
        )}

      {/* Collapsible Filter Container */}
      {isFilterVisible && api.isConfigured && typeof api.listItems === "function" && (
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

      {/* Message for no items found after initial load/filter, and not currently loading */}
      {api.isConfigured && typeof api.listItems === "function" && !loading && !loadingMore && items.length === 0 && totalItemsCount === 0 && !error && (
        <p>
          {intl.formatMessage({
            id: "items.list.empty",
            defaultMessage: "No items found. Add one!",
          })}
        </p>
      )}
      {/* Message for no items matching filters, but there are items in total */}
      {api.isConfigured && typeof api.listItems === "function" && !loading && !loadingMore && items.length === 0 && totalItemsCount > 0 && !error && (
         <p>
           {intl.formatMessage({
             id: "items.list.emptyFiltered",
             defaultMessage: "No items match the current filters.",
           })}
         </p>
      )}

      {items.length > 0 && (
        <div className="items-list">
          {items.map((item) => (
            <div key={item.item_id} className="item-card">
              {/* Display image using Blob URL from state */}
              <div
                className={`item-image-container ${!itemImageUrls[item.item_id] ? "placeholder" : ""} ${itemImageUrls[item.item_id] ? "clickable" : ""}`}
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
                {itemImageUrls[item.item_id] ? (
                  <img
                    src={itemImageUrls[item.item_id]}
                    alt={item.name}
                    className="item-image"
                  />
                ) : null}
              </div>
              <div className="item-card-content">
                <h4 title={item.name}>{item.name}</h4>
                {api.isConfigured && typeof api.updateItem === "function" && (
                  <button
                    onClick={() => handleEditClick(item)}
                    className="edit-button button-light"
                    aria-label={intl.formatMessage(
                      {
                        id: "items.editButton.label",
                        defaultMessage: "Edit {name}",
                      },
                      { name: item.name },
                    )}
                    disabled={loading || loadingMore || isUpdating || isDeleting}
                  >
                    ✏️
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Loader for infinite scroll */}
      {loadingMore && (
        <p className="status-loading">
          {intl.formatMessage({ id: "items.loadingMore", defaultMessage: "Loading more items..."})}
        </p>
      )}
      <div ref={loaderRef} style={{ height: "1px", margin: "1px" }} /> {/* Invisible loader trigger */}


      {/* Add Item FAB - enable if API configured and core methods exist */}
      {api.isConfigured && api.addItem && api.listLocations && api.listCategories && api.listOwners && (
        <button
          type="button"
          className="add-item-fab button-primary"
          onClick={handleOpenAddItemModal}
          aria-label={intl.formatMessage({ id: "items.addItemFAB.label", defaultMessage: "Add new item" })}
          disabled={loading || loadingMore || isUpdating || isDeleting}
        >
          +
        </button>
      )}

      {/* Add Item Modal */}
      {isAddItemModalOpen && (
        <Modal
          show={isAddItemModalOpen}
          onClose={handleCloseAddItemModal}
          title={intl.formatMessage({ id: "items.addForm.title", defaultMessage: "Add New Item" })}
        >
          <form onSubmit={handleAddItem} className="add-item-form"> {/* Re-use class for internal structure */}
            {addItemError && <p className="status-error">Error: {addItemError}</p>}
            <div className="form-group">
              <label htmlFor="item-name-modal">
                {intl.formatMessage({ id: "items.addForm.nameLabel", defaultMessage: "Name:" })}
              </label>
              <input type="text" id="item-name-modal" value={newItemName} onChange={(e) => setNewItemName(e.target.value)} required disabled={loading} />
            </div>
            <div className="form-group">
              <label htmlFor="item-description-modal">
                {intl.formatMessage({ id: "items.addForm.descriptionLabel", defaultMessage: "Description:" })}
              </label>
              <input type="text" id="item-description-modal" value={newItemDescription} onChange={(e) => setNewItemDescription(e.target.value)} disabled={loading} />
            </div>
            <div className="form-group form-group-image">
              <label htmlFor="item-image-modal"> {/* Ensure unique ID for label */}
                {intl.formatMessage({ id: "items.addForm.imageLabel", defaultMessage: "Image:" })}
              </label>
              {addImageUrl && (
                <div className="image-preview">
                  <img src={addImageUrl} alt={intl.formatMessage({ id: "items.addForm.imagePreviewAlt", defaultMessage: "New item preview" })} onClick={() => handleImageClick(newItemImageFile, intl.formatMessage({ id: "items.addForm.imagePreviewAlt", defaultMessage: "New item preview" }))} style={{ cursor: "pointer" }} />
                </div>
              )}
              <div className="form-group-image-actions">
                <label htmlFor="item-image-modal" className={`button-light button-file-input ${loading ? "disabled" : ""}`}>
                  {intl.formatMessage({ id: "items.addForm.chooseFile", defaultMessage: "Choose File" })}
                </label>
                {addImageUrl && (
                  <button type="button" onClick={() => handleRotateImage("add")} className="button-light rotate-image-button" disabled={loading || isRotatingAdd}>
                    {isRotatingAdd ? intl.formatMessage({ id: "items.image.rotating", defaultMessage: "Rotating..." }) : intl.formatMessage({ id: "items.image.rotate", defaultMessage: "Rotate 90°" })}
                  </button>
                )}
                {addImageUrl && (
                  <button type="button" onClick={handleRemoveNewImage} className="button-danger-light remove-image-button" disabled={loading || isRotatingAdd}>
                    {intl.formatMessage({ id: "items.editForm.removeImage", defaultMessage: "Remove Image" })}
                  </button>
                )}
              </div>
              <input type="file" id="item-image-modal" accept="image/*" onChange={(e) => handleFileChange(e, "add")} disabled={loading} className="hidden-file-input" />
            </div>
            <div className="form-group">
              <label htmlFor="item-location-modal">
                {intl.formatMessage({ id: "items.addForm.locationLabel", defaultMessage: "Location:" })}
              </label>
              <select id="item-location-modal" value={newItemLocationId} onChange={(e) => setNewItemLocationId(e.target.value)} required disabled={loading || locations.length === 0}>
                <option value="">{intl.formatMessage({ id: "items.addForm.selectLocationDefault", defaultMessage: "-- Select Location --" })}</option>
                {locations.map((loc) => (<option key={loc.location_id} value={loc.location_id}>{loc.name}</option>))}
              </select>
            </div>
            <div className="form-group">
              <label htmlFor="item-category-modal">
                {intl.formatMessage({ id: "items.addForm.categoryLabel", defaultMessage: "Category:" })}
              </label>
              <select id="item-category-modal" value={newItemCategoryId} onChange={(e) => setNewItemCategoryId(e.target.value)} required disabled={loading || categories.length === 0}>
                <option value="">{intl.formatMessage({ id: "items.addForm.selectCategoryDefault", defaultMessage: "-- Select Category --" })}</option>
                {categories.map((cat) => (<option key={cat.category_id} value={cat.category_id}>{cat.name}</option>))}
              </select>
            </div>
            <div className="form-group">
              <label htmlFor="item-owner-modal">
                {intl.formatMessage({ id: "items.addForm.ownerLabel", defaultMessage: "Owner:" })}
              </label>
              <select id="item-owner-modal" value={newItemOwnerId} onChange={(e) => setNewItemOwnerId(e.target.value)} required disabled={loading || owners.length === 0}>
                <option value="">{intl.formatMessage({ id: "items.addForm.selectOwnerDefault", defaultMessage: "-- Select Owner --" })}</option>
                {owners.map((owner) => (<option key={owner.owner_id} value={owner.owner_id}>{owner.name}</option>))}
              </select>
            </div>

            <div className="modal-actions">
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
                  ? intl.formatMessage({ id: "items.addForm.button.adding", defaultMessage: "Adding..." })
                  : intl.formatMessage({ id: "items.addForm.button.add", defaultMessage: "Add Item" })}
              </button>
              <button
                type="button"
                onClick={handleCloseAddItemModal}
                disabled={loading}
                className="button-secondary"
              >
                {intl.formatMessage({ id: "common.cancel", defaultMessage: "Cancel" })}
              </button>
            </div>
          </form>
        </Modal>
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
                    {/* Rotate Button */}
                    {displayImageUrl && (
                      <button
                        type="button"
                        onClick={() => handleRotateImage("edit")}
                        className="button-light rotate-image-button"
                        disabled={isUpdating || isDeleting || isRotatingEdit}
                      >
                        {isRotatingEdit
                          ? intl.formatMessage({
                              id: "items.image.rotating",
                              defaultMessage: "Rotating...",
                            })
                          : intl.formatMessage({
                              id: "items.image.rotate",
                              defaultMessage: "Rotate 90°",
                            })}
                      </button>
                    )}
                    {/* Remove Button */}
                    {displayImageUrl &&
                      typeof api.deleteItem === "function" && (
                        <button
                          type="button"
                          onClick={handleRemoveEditImage}
                          className="button-danger-light remove-image-button"
                          disabled={isUpdating || isDeleting || isRotatingEdit} // Also disable during rotation
                        >
                          {intl.formatMessage({
                            id: "items.editForm.removeImage", // Re-use existing translation
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
    </div>
  );
};

export default ItemsView;
