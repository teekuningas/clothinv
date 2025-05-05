import React, { useState, useRef, useEffect, useCallback } from "react";
import { useIntl } from "react-intl";

// Helper function to convert Base64 Data URL to File object
function dataURLtoFile(dataurl, filename) {
  try {
    const arr = dataurl.split(",");
    if (arr.length < 2) {
      console.error("Invalid Data URL format");
      return null; // Invalid format
    }

    const mimeMatch = arr[0].match(/:(.*?);/);
    if (!mimeMatch || mimeMatch.length < 2) {
      console.error("Cannot find MIME type in Data URL");
      return null; // Cannot find MIME type
    }
    const mime = mimeMatch[1];

    const bstr = atob(arr[arr.length - 1]); // Use the last part after comma
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    if (n === 0) {
      console.error("Empty image data after Base64 decoding");
      return null;
    }
    while (n--) {
      u8arr[n] = bstr.charCodeAt(n);
    }
    return new File([u8arr], filename, { type: mime });
  } catch (e) {
    console.error("Error converting Data URL to File:", e);
    return null; // Return null or throw error on failure
  }
}
const WebcamCapture = ({ show, onCapture, onClose }) => {
  const intl = useIntl();
  const videoRef = useRef(null);
  const canvasRef = useRef(null); // Hidden canvas for capturing
  const [stream, setStream] = useState(null);
  const [error, setError] = useState(null);
  const [isInitializing, setIsInitializing] = useState(false);

  // --- Camera Control Logic ---

  const stopCamera = useCallback(() => {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      setStream(null);
      // Also clear the video source
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
    }
  }, [stream]);
  const startCamera = useCallback(async () => {
    // Stop any existing stream first
    stopCamera();

    setIsInitializing(true);
    setError(null);
    // setStream(null); // Already handled by stopCamera

    // Check for browser support
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setError(
        intl.formatMessage({
          id: "webcam.error.notSupported",
          defaultMessage: "Webcam access is not supported by this browser.",
        }),
      );
      setIsInitializing(false);
      return;
    }

    try {
      // Request video stream
      const newStream = await navigator.mediaDevices.getUserMedia({
        video: true, // Basic video constraints
        audio: false,
      });
      setStream(newStream);
      if (videoRef.current) {
        videoRef.current.srcObject = newStream;
      } else {
        console.warn("Video ref not available when stream was ready.");
      }
    } catch (err) {
      console.error("Error accessing webcam:", err.name, err.message); // Log error name
      if (
        err.name === "NotAllowedError" ||
        err.name === "PermissionDeniedError"
      ) {
        setError(
          intl.formatMessage({
            id: "webcam.error.permissionDenied",
            defaultMessage:
              "Permission denied. Please allow camera access in browser settings and click Retry.",
          }),
        );
      } else if (
        err.name === "NotFoundError" ||
        err.name === "DevicesNotFoundError"
      ) {
        setError(
          intl.formatMessage({
            id: "webcam.error.noCamera",
            defaultMessage: "No camera found on this device.",
          }),
        );
      } else if (
        err.name === "NotReadableError" ||
        err.name === "TrackStartError"
      ) {
        setError(
          intl.formatMessage({
            id: "webcam.error.inUse",
            defaultMessage:
              "Camera is already in use or cannot be accessed. Please check other applications or browser tabs.",
          }),
        );
      } else {
        setError(
          intl.formatMessage(
            {
              id: "webcam.error.accessGeneric",
              defaultMessage:
                "Error accessing webcam: {errorName}. Please try again.",
            },
            { errorName: err.name },
          ),
        );
      }
      // Ensure stream is null if error occurred after getting it (less likely but possible)
      stopCamera();
    } finally {
      setIsInitializing(false);
    }
  }, [stopCamera]); // Include stopCamera as dependency

  // Effect to start/stop camera when the component shows/hides
  useEffect(() => {
    if (show) {
      startCamera();
    } else {
      // Cleanup: Stop camera when modal is hidden
      stopCamera();
    }

    // Cleanup function for when component unmounts while shown
    return () => {
      stopCamera();
    };
  }, [show, startCamera, stopCamera]); // Rerun when 'show' changes or functions change

  // --- Capture Logic ---

  const handleCaptureClick = useCallback(() => {
    if (!videoRef.current || !canvasRef.current || !stream) {
      console.error(
        "Capture cannot proceed: video or canvas ref not ready, or no stream.",
      );
      return;
    }

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const context = canvas.getContext("2d");

    // Set canvas dimensions to match video stream's actual dimensions
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    // Draw the current video frame onto the canvas
    context.drawImage(video, 0, 0, canvas.width, canvas.height);

    // Get the image data from canvas as JPEG (or PNG)
    const imageDataURL = canvas.toDataURL("image/jpeg", 0.9); // Adjust quality 0.0-1.0

    // Convert Data URL to a File object
    const filename = `capture-${Date.now()}.jpg`;
    const imageFile = dataURLtoFile(imageDataURL, filename);

    if (imageFile) {
      onCapture(imageFile); // Pass the File object back to parent
    } else {
      // Set an error state specific to capture failure
      setError(
        intl.formatMessage({
          id: "webcam.error.captureFailed",
          defaultMessage: "Failed to process captured image. Please try again.",
        }),
      );
    }

    // Important: Do not stop camera here. Let the parent component hide the modal
    // onClose(); // Parent will set show=false which triggers cleanup
  }, [stream, onCapture]); // Dependencies

  if (!show) {
    return null;
  }

  return (
    <div className="webcam-capture-backdrop" onClick={onClose}>
      <div
        className="webcam-capture-content"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="webcam-video-container">
          <video
            ref={videoRef}
            autoPlay
            playsInline // Important for iOS Safari
            muted // Often required for autoplay
            className="webcam-video-element"
            // Show video only if initializing is false AND there is no error AND stream exists
            style={{
              visibility:
                !isInitializing && !error && stream ? "visible" : "hidden",
            }}
          />
          {/* Hidden canvas for drawing */}
          <canvas ref={canvasRef} style={{ display: "none" }} />

          {/* Display Status Messages Inside Container */}
          {isInitializing && (
            <p className="webcam-status-message webcam-loading">
              {intl.formatMessage({
                id: "webcam.initializing",
                defaultMessage: "Initializing Camera...",
              })}
            </p>
          )}
          {error && (
            <div className="webcam-status-message webcam-error">
              <p>
                {intl.formatMessage({
                  id: "common.error",
                  defaultMessage: "Error",
                })}
                : {error}
              </p>
            </div>
          )}

          {/* Show capture button only when stream is active */}
          {stream && !isInitializing && !error && (
            <button
              className="webcam-capture-button"
              onClick={handleCaptureClick}
              aria-label={intl.formatMessage({
                id: "webcam.button.capture.ariaLabel",
                defaultMessage: "Capture photo",
              })}
            >
              {/* Simple capture icon (could use SVG or FontAwesome) */}
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="currentColor"
                width="24"
                height="24"
              >
                <path d="M12 1a11 11 0 1 0 0 22 11 11 0 0 0 0-22Zm0 20a9 9 0 1 1 0-18 9 9 0 0 1 0 18Z" />
                <path d="M12 6a6 6 0 1 0 0 12 6 6 0 0 0 0-12Z" />
              </svg>
            </button>
          )}
        </div>

        {/* Action Buttons Area */}
        <div className="webcam-actions">
          {/* Show Retry button only if there's an error - Use button-primary */}
          {error && (
            <button className="button-primary" onClick={startCamera}>
              {intl.formatMessage({
                id: "webcam.button.retry",
                defaultMessage: "Retry",
              })}
            </button>
          )}
          {/* Use button-secondary for cancel */}
          <button className="button-secondary" onClick={onClose}>
            {intl.formatMessage({
              id: "common.cancel",
              defaultMessage: "Cancel",
            })}
          </button>
        </div>
      </div>
    </div>
  );
};

export default WebcamCapture;
