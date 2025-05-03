import React, { useEffect } from "react";
import "./ImageViewModal.css"; // We'll create this next

const ImageViewModal = ({ show, onClose, imageUrl, imageAlt }) => {
  // Effect to handle Escape key press
  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    if (show) {
      window.addEventListener("keydown", handleKeyDown);
    } else {
      window.removeEventListener("keydown", handleKeyDown);
    }

    // Cleanup listener on component unmount or when modal closes
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [show, onClose]); // Re-run effect if show or onClose changes

  if (!show || !imageUrl) {
    return null;
  }

  // Prevent clicks inside the image container from closing the modal
  const handleContentClick = (e) => {
    e.stopPropagation();
  };

  // Add the 'show' class dynamically based on the show prop
  const backdropClass = `image-view-modal-backdrop ${show ? "show" : ""}`;

  return (
    <div className={backdropClass} onClick={onClose}>
      <div className="image-view-modal-content" onClick={handleContentClick}>
        <button
          className="image-view-modal-close"
          onClick={onClose}
          aria-label="Close image view"
        >
          &times;
        </button>
        <img src={imageUrl} alt={imageAlt || "Full size view"} />
      </div>
    </div>
  );
};

export default ImageViewModal;
