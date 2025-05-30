import React, {
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
} from "react";

// ── in-file “hook” for infinite loading via IntersectionObserver ──
function useInfiniteLoader({
  loaderRef,
  loading,
  hasMore,
  onLoadMore,
  root = null,
  rootMargin = "200px",
  threshold = 0,
}) {
  React.useEffect(() => {
    const node = loaderRef.current;
    if (!node) return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !loading && hasMore) {
          onLoadMore();
        }
      },
      { root, rootMargin, threshold }
    );
    obs.observe(node);
    return () => obs.disconnect();
  }, [loaderRef, loading, hasMore, onLoadMore, root, rootMargin, threshold]);
}

// Pull “magic 11” into a named constant
const DEFAULT_PAGE_SIZE = 11;
import { useApi } from "../api/ApiContext";
import { useSettings } from "../settings/SettingsContext";
import { useIntl } from "react-intl";
import imageCompression from "browser-image-compression";
import Modal from "./Modal";
import ImageViewModal from "./ImageViewModal";
import { compressImage, rotateImageFile } from "../helpers/images";
import { processItems } from "../helpers/filters";
import Gallery from "./Gallery"; // Import the new Gallery component
import "./ItemsView.css";
import RangeSlider from "./RangeSlider";

const ItemsView = () => {
  const [allItemsMetadata, setAllItemsMetadata] = useState([]);
  const [displayedItems, setDisplayedItems] = useState([]);
  const [locations, setLocations] = useState([]);
  const [categories, setCategories] = useState([]);
  const [owners, setOwners] = useState([]);

  // Pagination and loading state
  const [currentPage, setCurrentPage] = useState(0);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  // always reset to page 0 via this helper
  const resetPage = useCallback(() => setCurrentPage(0), []);
  const [hasMoreItems, setHasMoreItems] = useState(true);
  const [totalItemsCount, setTotalItemsCount] = useState(0); // Will be count after filtering, before pagination

  const [newItemName, setNewItemName] = useState("");
  const [newItemDescription, setNewItemDescription] = useState("");
  const [newItemPrice, setNewItemPrice] = useState("");
  const [newItemLocationId, setNewItemLocationId] = useState("");
  const [newItemCategoryId, setNewItemCategoryId] = useState("");
  const [newItemImageFile, setNewItemImageFile] = useState(null);
  const [newItemOwnerId, setNewItemOwnerId] = useState("");

  const [loading, setLoading] = useState(false); // For initial all-metadata load
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  const [editingItemId, setEditingItemId] = useState(null);
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editItemPrice, setEditItemPrice] = useState("");
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
  const [displayedItemImageUrls, setDisplayedItemImageUrls] = useState({});
  const [itemImageFiles, setItemImageFiles] = useState({}); // Stores File objects { [itemId]: File }
  const [loadingImages, setLoadingImages] = useState({}); // { [imageUuid]: boolean }
  const [addImageUrl, setAddImageUrl] = useState(null);
  const [editImageUrl, setEditImageUrl] = useState(null);

  const [isFilterVisible, setIsFilterVisible] = useState(false);
  const [filterName, setFilterName] = useState("");
  const [filterLocationIds, setFilterLocationIds] = useState([]);
  const [filterCategoryIds, setFilterCategoryIds] = useState([]);
  const [filterOwnerIds, setFilterOwnerIds] = useState([]);
  const [filterPriceMin, setFilterPriceMin] = useState();
  const [filterPriceMax, setFilterPriceMax] = useState();

  const [isAddItemModalOpen, setIsAddItemModalOpen] = useState(false);
  const [addItemError, setAddItemError] = useState(null);

  // Slider bounds derived from your data
  const sliderMin = 0;
  const sliderMax = useMemo(() => {
    // collect only valid numbers
    const prices = allItemsMetadata
      .map((i) => i.price)
      .filter((p) => typeof p === 'number' && !isNaN(p));
    if (prices.length === 0) {
      return 1;
    }
    const maxPrice = Math.ceil(Math.max(...prices));
    return maxPrice > 0 ? maxPrice : 1;
  }, [allItemsMetadata]);

  const [sortCriteria, setSortCriteria] = useState("created_at_desc"); // Default to newest first

  const [lastUpdatedItemDetails, setLastUpdatedItemDetails] = useState(null); // { itemId: number, imageUuid: string | null, name: string, description: string | null, locationId: number, categoryId: number, ownerId: number }

  const loaderRef = useRef(null);
  // Refs for modal image URLs to ensure cleanup on unmount
  const addImageUrlRef = useRef(addImageUrl);
  const editImageUrlRef = useRef(editImageUrl);
  // just under your other useRef() calls
  const prevImageUrlsRef = useRef({});

  const api = useApi();
  const { settings: appSettings } = useSettings();
  const intl = useIntl();

  // Effect to keep refs updated with latest modal image URLs
  useEffect(() => {
    addImageUrlRef.current = addImageUrl;
    editImageUrlRef.current = editImageUrl;
  }, [addImageUrl, editImageUrl]);

  // General cleanup for any outstanding modal blob URLs on component unmount
  useEffect(() => {
    return () => {
      // displayedItemImageUrls are handled by their own effect's cleanup logic
      if (addImageUrlRef.current) {
        URL.revokeObjectURL(addImageUrlRef.current);
      }
      if (editImageUrlRef.current) {
        URL.revokeObjectURL(editImageUrlRef.current);
      }
    };
  }, []); // Empty dependency array for unmount cleanup only

  const fetchAllItemsMetadata = useCallback(async () => {
    if (!api.isConfigured || typeof api.listItems !== "function") {
      setError(
        api.isConfigured
          ? intl.formatMessage({
              id: "items.list.notSupported",
              defaultMessage:
                "Listing items is not supported by the current API Provider.",
            })
          : intl.formatMessage({ id: "common.status.apiNotConfigured" }),
      );
      setAllItemsMetadata([]);
      setTotalItemsCount(0);
      setHasMoreItems(false);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    // Success messages are intentionally not cleared here to let them persist.

    try {
      const freshMetadataFromApi = await api.listItems(); // No options passed
      let newAllItemsMetadata = freshMetadataFromApi || [];

      // If there was a recent update, ensure its details are preserved over what listItems might return.
      // This handles the race condition where listItems (especially for IndexedDB) might be slightly
      // stale for the just-updated item's image_uuid or other fields.
      if (lastUpdatedItemDetails) {
        newAllItemsMetadata = newAllItemsMetadata.map((item) => {
          if (item.item_id === lastUpdatedItemDetails.itemId) {
            // Preserve fields from listItems (like updated_at) but override edited fields
            // and image_uuid with the definitive values from the update operation.
            return {
              ...item,
              name: lastUpdatedItemDetails.name,
              description: lastUpdatedItemDetails.description,
              location_id: lastUpdatedItemDetails.locationId,
              category_id: lastUpdatedItemDetails.categoryId,
              owner_id: lastUpdatedItemDetails.ownerId,
              image_uuid: lastUpdatedItemDetails.imageUuid,
            };
          }
          return item;
        });
        // Clear after applying, so it only affects this one refresh cycle post-update.
        setLastUpdatedItemDetails(null);
      }

      setAllItemsMetadata(newAllItemsMetadata);
      setCurrentPage(0); // Reset to first page for new full dataset
    } catch (err) {
      console.error("Failed to fetch items:", err);
      setError(
        intl.formatMessage(
          {
            id: "items.error.fetch",
            defaultMessage: "Failed to fetch items: {error}",
          },
          { error: err.message },
        ),
      );
      setAllItemsMetadata([]);
      setTotalItemsCount(0);
      setHasMoreItems(false);
      setCurrentPage(0);
    } finally {
      setLoading(false);
    }
  }, [api, intl, lastUpdatedItemDetails, setLastUpdatedItemDetails]);

  // Fetch locations, categories, owners (ancillary data)
  const fetchAncillaryData = useCallback(async () => {
    if (!api.isConfigured) {
      setLocations([]);
      setCategories([]);
      setOwners([]);
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
      console.error(
        "Failed to fetch ancillary data (locations, categories, owners):",
        err,
      );
      // Optionally set an error state specific to ancillary data or a general one
      setError(
        (prev) =>
          `${prev ? prev + "; " : ""}Failed to load L/C/O: ${err.message}`,
      );
      setLocations([]);
      setCategories([]);
      setOwners([]);
    }
  }, [api, intl]);

  // Effect for initial data load (items and ancillary) and when API provider changes
  useEffect(() => {
    if (api.isConfigured && api.listItems) {
      fetchAncillaryData(); // Fetch locations, categories, owners
      fetchAllItemsMetadata(); // Fetch all item metadata
    } else {
      // Clear data if API is not configured or listItems is not available
      setAllItemsMetadata([]);
      setDisplayedItems([]);
      setItemImageFiles({});
      setDisplayedItemImageUrls((prev) => {
        Object.values(prev).forEach(URL.revokeObjectURL);
        return {};
      });
      setTotalItemsCount(0);
      setHasMoreItems(false);
      setLocations([]);
      setCategories([]);
      setOwners([]);
      setCurrentPage(0);
    }
  }, [
    api.isConfigured,
    api.listItems,
    fetchAncillaryData,
    fetchAllItemsMetadata,
  ]);

  // Effect for client-side filtering, sorting, and pagination
  useEffect(() => {
    if (loading) return; // Don't process if initial metadata is still loading

    const filterCriteria = {
      filterName,
      filterLocationIds,
      filterCategoryIds,
      filterOwnerIds,
      filterPriceMin,
      filterPriceMax,
    };
    const paginationCriteria = {
      currentPage,
      pageSize,
    };

    const result = processItems(
      allItemsMetadata,
      filterCriteria,
      sortCriteria, // Pass the sortCriteria string directly
      paginationCriteria,
    );

    setDisplayedItems(result.displayedItems);
    // totalItemsCount now reflects the count *after* filtering, before pagination
    setTotalItemsCount(result.totalFilteredItemsCount);
    setHasMoreItems(result.hasMoreItems);
  }, [
    allItemsMetadata,
    filterName,
    filterLocationIds,
    filterCategoryIds,
    filterOwnerIds,
    filterPriceMin,
    filterPriceMax,
    sortCriteria,
    currentPage,
    pageSize,
    loading,
  ]);

  // ─── infinite load when spacer scrolls into view ───
  useInfiniteLoader({
    loaderRef,
    loading,
    hasMore: hasMoreItems,
    onLoadMore: () => setCurrentPage(p => p + 1),
    rootMargin: "200px",
  });

  // Effect to fetch images for displayed items
  useEffect(() => {
    if (!api.isConfigured || typeof api.getImage !== "function") {
      return;
    }

    displayedItems.forEach((item) => {
      // Fetch if UUID exists, entry for item_id is undefined in itemImageFiles (meaning not fetched or marked as null/failed), and not currently loading
      if (
        item.image_uuid &&
        itemImageFiles[item.item_id] === undefined &&
        !loadingImages[item.image_uuid]
      ) {
        setLoadingImages((prev) => ({ ...prev, [item.image_uuid]: true }));
        api
          .getImage({ image_uuid: item.image_uuid })
          .then((imageFile) => {
            if (imageFile instanceof File) {
              setItemImageFiles((prevFiles) => ({
                ...prevFiles,
                [item.item_id]: imageFile,
              }));
            } else if (imageFile === null) {
              console.log(
                `Image not found or null for UUID: ${item.image_uuid}`,
              );
              // Store null to indicate it was fetched and not found, preventing re-fetches
              setItemImageFiles((prevFiles) => ({
                ...prevFiles,
                [item.item_id]: null,
              }));
            }
          })
          .catch((err) => {
            console.error(
              `Failed to fetch image for UUID ${item.image_uuid}:`,
              err,
            );
            // Mark as null on error to prevent re-fetch loops
            setItemImageFiles((prevFiles) => ({
              ...prevFiles,
              [item.item_id]: null,
            }));
          })
          .finally(() => {
            setLoadingImages((prev) => ({ ...prev, [item.image_uuid]: false }));
          });
      }
    });
  }, [displayedItems, api, itemImageFiles, loadingImages]);

  // ─── create/reuse blob URLs & revoke stale ones ───
  useEffect(() => {
    const prev = prevImageUrlsRef.current;
    const next = {};

    displayedItems.forEach(item => {
      const file = itemImageFiles[item.item_id];
      if (file instanceof File) {
        // reuse existing URL or create new
        next[item.item_id] = prev[item.item_id] || URL.createObjectURL(file);
      }
    });

    // revoke any URL that dropped out
    Object.entries(prev).forEach(([id, url]) => {
      if (!next[id]) URL.revokeObjectURL(url);
    });

    prevImageUrlsRef.current = next;
    setDisplayedItemImageUrls(next);

    // cleanup on unmount
    return () => {
      Object.values(next).forEach(URL.revokeObjectURL);
    };
  }, [displayedItems, itemImageFiles]);

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
    setNewItemPrice("");
    setNewItemLocationId("");
    setNewItemCategoryId("");
    if (addImageUrl) URL.revokeObjectURL(addImageUrl);
    setNewItemImageFile(null);
    setAddImageUrl(null);
    setNewItemOwnerId("");
    // Set default if only one option exists
    if (locations.length === 1) {
      setNewItemLocationId(locations[0].location_id.toString());
    }
    if (categories.length === 1) {
      setNewItemCategoryId(categories[0].category_id.toString());
    }
    if (owners.length === 1) {
      setNewItemOwnerId(owners[0].owner_id.toString());
    }

    setIsAddItemModalOpen(true);
  };

  const handleCloseAddItemModal = () => {
    setIsAddItemModalOpen(false);
    setAddItemError(null); // Clear error when closing
    // Reset form fields
    setNewItemName("");
    setNewItemDescription("");
    setNewItemPrice("");
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

    // Validate price if entered
    if (newItemPrice !== "") {
      const p = parseFloat(newItemPrice);
      if (isNaN(p) || p < 0) {
        setAddItemError("Price must be ≥ 0");
        return;
      }
    }

    setLoading(true);
    setAddItemError(null); // Clear previous modal-specific error

    try {
      let fileToSend = null;
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

      const result = await api.addItem({
        name: newItemName.trim(),
        description: newItemDescription.trim() || null,
        price: newItemPrice !== "" ? parseFloat(newItemPrice) : null,
        location_id: parseInt(newItemLocationId, 10),
        category_id: parseInt(newItemCategoryId, 10),
        owner_id: parseInt(newItemOwnerId, 10),
        imageFile: fileToSend, // Pass the potentially compressed File object
      });

      if (result.success) {
        // Fetch data, then close modal and show global success message
        handleCloseAddItemModal(); // Close modal first
        fetchAllItemsMetadata().then(() => {
          // Refresh all metadata
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
        setAddItemError(
          // Set modal-specific error
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
    const idNum = parseInt(id, 10);
    const updater = (prevIds) => {
      if (prevIds.includes(idNum)) {
        return prevIds.filter((existingId) => existingId !== idNum);
      } else {
        return [...prevIds, idNum];
      }
    };

    if (filterType === "location") {
      setFilterLocationIds(updater);
    } else if (filterType === "category") {
      setFilterCategoryIds(updater);
    } else if (filterType === "owner") {
      setFilterOwnerIds(updater);
    }
    resetPage();
  };

  const handleResetFilters = () => {
    setFilterName("");
    setFilterLocationIds([]);
    setFilterCategoryIds([]);
    setFilterOwnerIds([]);
    setFilterPriceMin(undefined);
    setFilterPriceMax(undefined);
    resetPage();
  };

  // --- Edit Handlers ---
  const handleEditClick = (item) => {
    // Find the full item from allItemsMetadata to ensure we have the latest, including image_uuid
    const itemToEdit =
      allItemsMetadata.find((i) => i.item_id === item.item_id) || item;

    setEditingItemId(itemToEdit.item_id);
    setEditName(itemToEdit.name);
    setEditDescription(itemToEdit.description || "");
    setEditItemPrice(
      typeof itemToEdit.price === "number" && itemToEdit.price !== null
        ? itemToEdit.price.toString()
        : "",
    );
    setEditLocationId(itemToEdit.location_id || "");
    setEditCategoryId(itemToEdit.category_id || "");
    setEditOwnerId(itemToEdit.owner_id || "");

    // Handle image state for edit modal
    if (editImageUrl) URL.revokeObjectURL(editImageUrl); // Revoke previous edit preview URL

    // If the image for this item is already fetched and available in itemImageFiles, use it for pre-fill
    if (itemToEdit.image_uuid && itemImageFiles[itemToEdit.item_id]) {
      const preFetchedFile = itemImageFiles[itemToEdit.item_id];
      setEditItemImageFile(preFetchedFile);
      setEditImageUrl(URL.createObjectURL(preFetchedFile));
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
    setEditItemPrice("");
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
      !api.updateItem
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

    // Validate price if entered
    if (editItemPrice !== "") {
      const p = parseFloat(editItemPrice);
      if (isNaN(p) || p < 0) {
        setUpdateError("Price must be ≥ 0");
        setIsUpdating(false);
        return;
      }
    }

    try {
      let fileToSend = null;
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
      const result = await api.updateItem({
        item_id: editingItemId,
        name: editName.trim(),
        description: editDescription.trim() || null,
        price: editItemPrice !== "" ? parseFloat(editItemPrice) : null,
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

        const updatedItemId = editingItemId; // Capture for use in state updaters

        // If an image file was part of the update payload (sent or marked for removal),
        // or if the API result includes an image_uuid (which it should on success),
        // we need to update local state accordingly.
        if (
          fileToSend ||
          imageMarkedForRemoval ||
          typeof result.image_uuid !== "undefined"
        ) {
          // Clear client-side File object and Blob URL caches for this item.
          // This forces the image fetching useEffect to re-evaluate.
          setItemImageFiles((prevFiles) => {
            const newFiles = { ...prevFiles };
            delete newFiles[updatedItemId];
            return newFiles;
          });

          setDisplayedItemImageUrls((prevUrls) => {
            const newUrls = { ...prevUrls };
            if (newUrls[updatedItemId]) {
              URL.revokeObjectURL(newUrls[updatedItemId]);
              delete newUrls[updatedItemId];
            }
            return newUrls;
          });
        }

        // Store the definitive details from the successful update operation.
        // These will be used by fetchAllItemsMetadata to ensure consistency.
        setLastUpdatedItemDetails({
          itemId: updatedItemId,
          name: editName.trim(),
          description: editDescription.trim() || null,
          locationId: parseInt(editLocationId, 10),
          categoryId: parseInt(editCategoryId, 10),
          ownerId: parseInt(editOwnerId, 10),
          imageUuid: result.image_uuid,
        });

        handleCancelEdit(); // Close edit modal
        fetchAllItemsMetadata(); // Refresh all metadata. It will use lastUpdatedItemDetails.
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
      const result = await api.deleteItem({ item_id: deleteCandidateId });
      if (result.success) {
        setSuccess(
          intl.formatMessage({
            id: "items.success.delete",
            defaultMessage: "Item deleted successfully!",
          }),
        );
        handleCancelDelete(); // Close delete confirm modal
        handleCancelEdit(); // Close edit modal if open
        fetchAllItemsMetadata(); // Refresh all metadata
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
      {loading &&
        displayedItems.length === 0 && ( // Show main loading only if nothing is displayed yet
          <p className="status-loading">
            {intl.formatMessage({
              id: "items.loading",
              defaultMessage: "Loading data...",
            })}
          </p>
        )}
      {error && <p className="status-error">Error: {error}</p>}
      {success && <p className="status-success">{success}</p>}

      {!api.isConfigured && !loading && allItemsMetadata.length === 0 && (
        <p className="status-warning">
          {intl.formatMessage({ id: "common.status.apiNotConfigured" })}
        </p>
      )}
      {api.isConfigured &&
        typeof api.listItems !== "function" &&
        !loading &&
        allItemsMetadata.length === 0 && (
          <p className="status-warning">
            {intl.formatMessage({
              id: "items.list.notSupported",
              defaultMessage:
                "Listing items is not supported by the current API Provider.",
            })}
          </p>
        )}

      {/* Items List */}

      {api.isConfigured && typeof api.listItems === "function" && (
        <div className="list-controls-container">
          <button
            onClick={handleFilterToggle}
            className="button-light filter-toggle-button"
            aria-controls="filters-container"
            aria-expanded={isFilterVisible}
            disabled={loading}
          >
            {intl.formatMessage({
              id: "items.filter.toggleButton",
              defaultMessage: "Filters",
            })}{" "}
            ({totalItemsCount})
          </button>
        </div>
      )}

      {/* Collapsible Filter Container */}
      {isFilterVisible &&
        api.isConfigured &&
        typeof api.listItems === "function" && (
          <div id="filters-container" className="filters-container">
            <h4>
              {intl.formatMessage({
                id: "items.filter.title",
                defaultMessage: "Filter Items",
              })}
            </h4>
            <div className="filter-group">
              {" "}
              <label htmlFor="sort-criteria">
                {intl.formatMessage({
                  id: "items.sort.label",
                  defaultMessage: "Sort by:",
                })}
              </label>
              <select
                id="sort-criteria"
                value={sortCriteria}
                onChange={(e) => {
                  setSortCriteria(e.target.value);
                  resetPage();
                }}
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
                <option value="price_asc">
                  {intl.formatMessage({
                    id: "items.sort.priceLowHigh",
                    defaultMessage: "Price: Low → High",
                  })}
                </option>
                <option value="price_desc">
                  {intl.formatMessage({
                    id: "items.sort.priceHighLow",
                    defaultMessage: "Price: High → Low",
                  })}
                </option>
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
                onChange={(e) => {
                  setFilterName(e.target.value);
                  resetPage();
                }}
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
                  <label htmlFor={`owner-${owner.owner_id}`}>
                    {owner.name}
                  </label>
                </div>
              ))}
            </fieldset>

            {/* Price Range Filter */}
            <div className="filter-group">
              <label>
                {intl.formatMessage({
                  id: "items.filter.priceRangeLabel",
                  defaultMessage: "Price Range:",
                })}
              </label>
              <RangeSlider
                min={sliderMin}
                max={sliderMax}
                step={0.01}
                minDistancePercent={0.05}
                value={[
                  filterPriceMin ?? sliderMin,
                  filterPriceMax ?? sliderMax,
                ]}
                onChange={([minV, maxV]) => {
                  setFilterPriceMin(minV);
                  setFilterPriceMax(maxV);
                  resetPage();
                }}
              />
              <div className="range-values">
                <span>{(filterPriceMin ?? sliderMin).toFixed(2)}</span>
                <span>{(filterPriceMax ?? sliderMax).toFixed(2)}</span>
              </div>
            </div>

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
      {api.isConfigured &&
        typeof api.listItems === "function" &&
        !loading &&
        allItemsMetadata.length === 0 && // No items in the source at all
        !error && (
          <div>
            <p style={{ marginBottom: "20px" }}>
              {intl.formatMessage({
                id: "items.list.empty.main",
                defaultMessage: "Your collection awaits.",
              })}
            </p>
            {/* Check if all prerequisites (Locations, Categories, Owners) are populated */}
            {locations.length === 0 ||
            categories.length === 0 ||
            owners.length === 0 ? (
              <p>
                {intl.formatMessage({
                  id: "items.list.empty.newUserGuidance",
                  defaultMessage:
                    "To add your first item, please begin by creating a Location, Category, and Owner in their respective sections, accessible from the navigation menu.",
                })}
              </p>
            ) : (
              <p>
                {intl.formatMessage({
                  id: "items.list.empty.addViaFAB",
                  defaultMessage:
                    "No items found. Click the '+' button to add one.",
                })}
              </p>
            )}
          </div>
        )}
      {/* Message for no items matching filters, but there are items in total */}
      {api.isConfigured &&
        typeof api.listItems === "function" &&
        !loading &&
        allItemsMetadata.length > 0 && // Items exist in source
        displayedItems.length === 0 && // But none match filters/pagination
        !error && (
          <p>
            {intl.formatMessage({
              id: "items.list.emptyFiltered",
              defaultMessage: "No items match the current filters.",
            })}
          </p>
        )}

      {/* Render the Gallery component */}
      {displayedItems.length > 0 && (
        <Gallery
          items={displayedItems}
          onEditItem={handleEditClick}
          onImageClick={handleImageClick}
          displayedItemImageUrls={displayedItemImageUrls}
          itemImageFiles={itemImageFiles}
          loadingImages={loadingImages}
          isLoading={loading} // Pass the main loading state
          isUpdating={isUpdating}
          isDeleting={isDeleting}
          canUpdateItem={
            api.writeAllowed &&
            api.isConfigured &&
            typeof api.updateItem === "function"
          }
          intl={intl}
        />
      )}

      {loading &&
        displayedItems.length > 0 && ( // Show "loading more" style indicator if loading all but some are already shown
          <p className="status-loading">
            {intl.formatMessage({
              id: "items.loadingMore",
              defaultMessage: "Loading more items...",
            })}
          </p>
        )}
      <div ref={loaderRef} className="infinite-loader-spacer" />

      {api.isConfigured &&
        api.addItem &&
        api.listLocations &&
        api.listCategories &&
        api.listOwners && (
          <button
            type="button"
            className="add-item-fab button-primary"
            onClick={handleOpenAddItemModal}
            aria-label={intl.formatMessage({
              id: "items.addItemFAB.label",
              defaultMessage: "Add new item",
            })}
            disabled={!api.writeAllowed || loading || isUpdating || isDeleting}
          >
            +
          </button>
        )}

      {/* Add Item Modal */}
      {isAddItemModalOpen && (
        <Modal
          show={isAddItemModalOpen}
          onClose={handleCloseAddItemModal}
          title={intl.formatMessage({
            id: "items.addForm.title",
            defaultMessage: "Add New Item",
          })}
        >
          <form onSubmit={handleAddItem} className="add-item-form">
            {addItemError && (
              <p className="status-error">Error: {addItemError}</p>
            )}
            <div className="form-group">
              <label htmlFor="item-name-modal">
                {intl.formatMessage({
                  id: "items.addForm.nameLabel",
                  defaultMessage: "Name:",
                })}
              </label>
              <input
                type="text"
                id="item-name-modal"
                value={newItemName}
                onChange={(e) => setNewItemName(e.target.value)}
                required
                disabled={loading}
              />
            </div>
            <div className="form-group">
              <label htmlFor="item-description-modal">
                {intl.formatMessage({
                  id: "items.addForm.descriptionLabel",
                  defaultMessage: "Description:",
                })}
              </label>
              <input
                type="text"
                id="item-description-modal"
                value={newItemDescription}
                onChange={(e) => setNewItemDescription(e.target.value)}
                disabled={loading}
              />
            </div>
            <div className="form-group">
              <label htmlFor="item-price-modal">
                {intl.formatMessage({
                  id: "items.addForm.priceLabel",
                  defaultMessage: "Price:",
                })}
              </label>
              <input
                type="number"
                id="item-price-modal"
                step="0.5"
                min="0"
                value={newItemPrice}
                onChange={(e) => setNewItemPrice(e.target.value)}
                placeholder={intl.formatMessage({
                  id: "items.addForm.pricePlaceholder",
                  defaultMessage: "e.g. 3.50",
                })}
                disabled={loading}
              />
            </div>
            <div className="form-group form-group-image">
              <label htmlFor="item-image-modal">
                {intl.formatMessage({
                  id: "items.addForm.imageLabel",
                  defaultMessage: "Image:",
                })}
              </label>
              {addImageUrl && (
                <div className="image-preview">
                  <img
                    src={addImageUrl}
                    alt={intl.formatMessage({
                      id: "items.addForm.imagePreviewAlt",
                      defaultMessage: "New item preview",
                    })}
                    onClick={() =>
                      handleImageClick(
                        newItemImageFile,
                        intl.formatMessage({
                          id: "items.addForm.imagePreviewAlt",
                          defaultMessage: "New item preview",
                        }),
                      )
                    }
                    style={{ cursor: "pointer" }}
                  />
                </div>
              )}
              <div className="form-group-image-actions">
                <label
                  htmlFor="item-image-modal"
                  className={`button-light button-file-input ${loading ? "disabled" : ""}`}
                >
                  {intl.formatMessage({
                    id: "items.addForm.chooseFile",
                    defaultMessage: "Choose File",
                  })}
                </label>
                {addImageUrl && (
                  <button
                    type="button"
                    onClick={() => handleRotateImage("add")}
                    className="button-light rotate-image-button"
                    disabled={loading || isRotatingAdd}
                  >
                    {isRotatingAdd
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
                {addImageUrl && (
                  <button
                    type="button"
                    onClick={handleRemoveNewImage}
                    className="button-danger-light remove-image-button"
                    disabled={loading || isRotatingAdd}
                  >
                    {intl.formatMessage({
                      id: "items.editForm.removeImage",
                      defaultMessage: "Remove Image",
                    })}
                  </button>
                )}
              </div>
              <input
                type="file"
                id="item-image-modal"
                accept="image/*"
                onChange={(e) => handleFileChange(e, "add")}
                disabled={loading}
                className="hidden-file-input"
              />
            </div>
            <div className="form-group">
              <label htmlFor="item-location-modal">
                {intl.formatMessage({
                  id: "items.addForm.locationLabel",
                  defaultMessage: "Location:",
                })}
              </label>
              <select
                id="item-location-modal"
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
              <label htmlFor="item-category-modal">
                {intl.formatMessage({
                  id: "items.addForm.categoryLabel",
                  defaultMessage: "Category:",
                })}
              </label>
              <select
                id="item-category-modal"
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
              <label htmlFor="item-owner-modal">
                {intl.formatMessage({
                  id: "items.addForm.ownerLabel",
                  defaultMessage: "Owner:",
                })}
              </label>
              <select
                id="item-owner-modal"
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

            <div className="modal-actions">
              <button
                type="submit"
                disabled={
                  !api.writeAllowed ||
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
              <button
                type="button"
                onClick={handleCloseAddItemModal}
                disabled={loading}
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
                <div className="form-group">
                  <label htmlFor="edit-item-price">
                    {intl.formatMessage({
                      id: "items.editForm.priceLabel",
                      defaultMessage: "Price:",
                    })}
                  </label>
                  <input
                    type="number"
                    id="edit-item-price"
                    step="0.01"
                    min="0"
                    value={editItemPrice}
                    onChange={(e) => setEditItemPrice(e.target.value)}
                    placeholder={intl.formatMessage({
                      id: "items.addForm.pricePlaceholder",
                      defaultMessage: "e.g. 3.50",
                    })}
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
                        style={{ cursor: "pointer" }}
                      />
                    </div>
                  )}
                  <div className="form-group-image-actions">
                    <label
                      htmlFor="edit-item-image"
                      className={`button-light button-file-input ${isUpdating || isDeleting ? "disabled" : ""}`}
                    >
                      {intl.formatMessage({
                        id: "items.addForm.chooseFile",
                        defaultMessage: "Choose File",
                      })}
                    </label>
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
                    {displayImageUrl &&
                      typeof api.deleteItem === "function" && (
                        <button
                          type="button"
                          onClick={handleRemoveEditImage}
                          className="button-danger-light remove-image-button"
                          disabled={isUpdating || isDeleting || isRotatingEdit}
                        >
                          {intl.formatMessage({
                            id: "items.editForm.removeImage",
                            defaultMessage: "Remove Image",
                          })}
                        </button>
                      )}
                  </div>
                  <input
                    type="file"
                    id="edit-item-image"
                    accept="image/*"
                    onChange={(e) => handleFileChange(e, "edit")}
                    disabled={isUpdating || isDeleting}
                    className="hidden-file-input"
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
                      !api.writeAllowed ||
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
                  {api.isConfigured && typeof api.deleteItem === "function" && (
                    <button
                      type="button"
                      className="button-danger"
                      onClick={() => handleDeleteClick(editingItemId)}
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
            );
          })()}
        </Modal>
      )}

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
                    (
                      allItemsMetadata.find(
                        (i) => i.item_id === deleteCandidateId,
                      ) || { name: "" }
                    ).name || "",
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
