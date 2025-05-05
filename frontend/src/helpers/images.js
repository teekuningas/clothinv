import imageCompression from 'browser-image-compression';

/**
 * Compresses an image file using browser-image-compression.
 *
 * @param {File} file - The image file to compress.
 * @param {object} options - Compression options.
 * @param {number} options.maxSizeMB - The maximum file size in megabytes.
 * @param {number} options.maxWidthOrHeight - The maximum width or height in pixels.
 * @param {boolean} options.useWebWorker - Whether to use a web worker for compression.
 * @param {string} options.fileType - The desired output file type (e.g., 'image/jpeg').
 * @param {string} baseErrorMessage - The base error message string (without specific error details)
 *                                    to use if compression fails (e.g., "Image compression failed").
 * @returns {Promise<File>} A promise that resolves with the compressed file,
 *                          or rejects with an error if compression fails.
 */
export const compressImage = async (file, options, baseErrorMessage) => {
    // Ensure input is a File object
    if (!(file instanceof File)) {
        console.warn("compressImage: Input is not a File object, skipping compression.");
        return file; // Return original if not a file
    }

    console.log(
        `Original image size: ${(file.size / 1024 / 1024).toFixed(3)} MB`,
    );

    try {
        const compressedBlob = await imageCompression(file, options);

        console.log(
            `Compressed image size: ${(compressedBlob.size / 1024 / 1024).toFixed(3)} MB`,
        );

        // Convert the compressed Blob back into a File object
        const compressedFile = new File([compressedBlob], file.name, {
            type: compressedBlob.type || file.type, // Use blob's type, fallback to original
            lastModified: Date.now(), // Set last modified timestamp
        });
        return compressedFile;
    } catch (error) {
        console.error("Image compression failed:", error);
        // Throw a new error using the provided base message and the specific error details
        throw new Error(`${baseErrorMessage}: ${error.message}`);
    }
};

// Add other image helper functions here later (like rotation)
