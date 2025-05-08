
// Helper function to parse sort criteria string
const parseSortCriteria = (criteria) => {
  if (criteria.endsWith("_asc")) {
    return { sortBy: criteria.slice(0, -4), sortOrder: "asc" };
  }
  if (criteria.endsWith("_desc")) {
    return { sortBy: criteria.slice(0, -5), sortOrder: "desc" };
  }
  return { sortBy: "created_at", sortOrder: "desc" }; // Default
};

export const processItems = (
  allItemsMetadata,
  filterCriteria,
  sortCriteriaString,
  paginationCriteria
) => {
  let processedItems = [...allItemsMetadata]; // Start with a copy of all items

  const { filterName, filterLocationIds, filterCategoryIds, filterOwnerIds } = filterCriteria;
  const { currentPage, pageSize } = paginationCriteria;

  // 1. Filtering
  if (filterName && filterName.trim()) {
    const lowerFilterName = filterName.trim().toLowerCase();
    processedItems = processedItems.filter(item =>
      item.name.toLowerCase().includes(lowerFilterName) ||
      (item.description && item.description.toLowerCase().includes(lowerFilterName))
    );
  }
  if (filterLocationIds && filterLocationIds.length > 0) {
    processedItems = processedItems.filter(item => filterLocationIds.includes(item.location_id));
  }
  if (filterCategoryIds && filterCategoryIds.length > 0) {
    processedItems = processedItems.filter(item => filterCategoryIds.includes(item.category_id));
  }
  if (filterOwnerIds && filterOwnerIds.length > 0) {
    processedItems = processedItems.filter(item => filterOwnerIds.includes(item.owner_id));
  }

  // This is the count of items *after* filtering, but *before* pagination.
  const totalFilteredItemsCount = processedItems.length;

  // 2. Sorting
  const { sortBy, sortOrder } = parseSortCriteria(sortCriteriaString);
  processedItems.sort((a, b) => {
    let valA = a[sortBy];
    let valB = b[sortBy];

    // Handle date strings for created_at/updated_at
    if (sortBy.endsWith("_at") && typeof valA === 'string' && typeof valB === 'string') {
      valA = new Date(valA);
      valB = new Date(valB);
    } else if (typeof valA === 'string' && typeof valB === 'string') {
      // Case-insensitive sort for strings
      valA = valA.toLowerCase();
      valB = valB.toLowerCase();
    }

    if (valA < valB) return sortOrder === "asc" ? -1 : 1;
    if (valA > valB) return sortOrder === "asc" ? 1 : -1;
    return 0;
  });

  // 3. Pagination
  // Calculate the items for the current view (all loaded pages up to current)
  const endIndex = (currentPage + 1) * pageSize;
  const paginatedItems = processedItems.slice(0, endIndex);

  // Determine if there are more items beyond the current paginated view within the filtered set
  const hasMoreItems = endIndex < processedItems.length;

  return {
    displayedItems: paginatedItems,
    totalFilteredItemsCount,
    hasMoreItems,
  };
};
