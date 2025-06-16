import React from "react";
import { useIntl } from "react-intl";
import "./Modal.css";

const Modal = ({ show, onClose, title, children }) => {
  const intl = useIntl();

  if (!show) {
    return null;
  }

  const handleContentClick = (e) => {
    e.stopPropagation();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={handleContentClick}>
        <div className="modal-header">
          {title && <h3 className="modal-title">{title}</h3>}
          <button
            onClick={onClose}
            className="modal-close-button"
            aria-label={intl.formatMessage({
              id: "modal.closeButton.label",
              defaultMessage: "Close modal",
            })}
          >
            &times;
          </button>
        </div>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  );
};

export default Modal;
