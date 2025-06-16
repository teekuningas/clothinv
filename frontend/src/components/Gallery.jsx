import React from "react";
import "./Gallery.css";

const Gallery = ({
  items,
  onEditItem,
  onImageClick,
  displayedItemImageUrls,
  itemImageFiles,
  loadingImages,
  isLoading, // Main loading state from ItemsView
  isUpdating, // Item-specific update in progress
  isDeleting, // Item-specific delete in progress
  canUpdateItem, // Whether the API supports updating items
  intl,
}) => {
  if (!items || items.length === 0) {
    return null;
  }

  return (
    <div className="items-list">
      {items.map((item) => (
        <div key={item.item_id} className="item-card">
          {item.price != null && (
            <div className="price-badge">{item.price.toFixed(2)}</div>
          )}
          <div
            className={`item-image-container ${!displayedItemImageUrls[item.item_id] ? "placeholder" : ""} ${displayedItemImageUrls[item.item_id] ? "clickable" : ""}`}
            onClick={() =>
              itemImageFiles[item.item_id] &&
              itemImageFiles[item.item_id] instanceof File &&
              onImageClick(itemImageFiles[item.item_id], item.name)
            }
            title={
              displayedItemImageUrls[item.item_id]
                ? intl.formatMessage({
                    id: "items.card.viewImageTooltip",
                    defaultMessage: "Click to view full image",
                  })
                : ""
            }
          >
            {loadingImages[item.image_uuid] &&
              !displayedItemImageUrls[item.item_id] && (
                <div className="item-image-loading">
                  {intl.formatMessage({
                    id: "items.card.imageLoading",
                    defaultMessage: "Loading image...",
                  })}
                </div>
              )}
            {displayedItemImageUrls[item.item_id] ? (
              <img
                src={displayedItemImageUrls[item.item_id]}
                alt={item.name}
                className="item-image"
              />
            ) : null}
          </div>
          <div className="item-card-content">
            <h4 title={item.name}>{item.name}</h4>
            {canUpdateItem && (
              <button
                onClick={() => onEditItem(item)}
                className="edit-button button-light"
                aria-label={intl.formatMessage(
                  {
                    id: "items.editButton.label",
                    defaultMessage: "Edit {name}",
                  },
                  { name: item.name },
                )}
                disabled={isLoading || isUpdating || isDeleting}
              >
                ✏️
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
};
export default Gallery;
