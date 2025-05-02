import React from 'react';
import './Modal.css'; // Create corresponding CSS file

const Modal = ({ show, onClose, title, children }) => {
    if (!show) {
        return null;
    }

    // Prevent clicks inside the modal from closing it
    const handleContentClick = (e) => {
        e.stopPropagation();
    };

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content" onClick={handleContentClick}>
                <div className="modal-header">
                    {title && <h3 className="modal-title">{title}</h3>}
                    <button onClick={onClose} className="modal-close-button" aria-label="Close modal">&times;</button>
                </div>
                <div className="modal-body">
                    {children}
                </div>
            </div>
        </div>
    );
};

export default Modal;
