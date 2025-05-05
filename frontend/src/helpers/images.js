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

/**
 * Rotates an image file 90 degrees clockwise.
 *
 * @param {File} file - The image file to rotate.
 * @returns {Promise<File>} A promise that resolves with the rotated file,
 *                          or rejects with an error if rotation fails.
 */
export const rotateImageFile = (file) => {
    return new Promise((resolve, reject) => {
        // Ensure input is a File object
        if (!(file instanceof File)) {
            return reject(new Error("Input is not a File object."));
        }

        const reader = new FileReader();

        reader.onload = (e) => {
            const image = new Image();
            image.onload = () => {
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');

                // Swap width and height for 90-degree rotation
                canvas.width = image.height;
                canvas.height = image.width;

                // Translate to the center and rotate
                ctx.translate(canvas.width / 2, canvas.height / 2);
                ctx.rotate(Math.PI / 2); // 90 degrees clockwise

                // Draw the image centered on the rotated canvas
                ctx.drawImage(image, -image.width / 2, -image.height / 2);

                // Get the rotated image as a Blob
                canvas.toBlob(
                    (blob) => {
                        if (!blob) {
                            return reject(new Error("Canvas toBlob failed."));
                        }
                        // Create a new File object from the Blob
                        const rotatedFile = new File([blob], file.name, {
                            type: blob.type || file.type || 'image/jpeg', // Use blob's type, fallback
                            lastModified: Date.now(),
                        });
                        resolve(rotatedFile);
                    },
                    file.type || 'image/jpeg', // Specify MIME type
                    0.9 // Specify quality (for JPEG/WEBP)
                );
            };
            image.onerror = (error) => {
                console.error("Image loading failed:", error);
                reject(new Error("Failed to load image for rotation."));
            };
            image.src = e.target.result; // Set src after defining onload/onerror
        };
        reader.onerror = (error) => {
            console.error("FileReader failed:", error);
            reject(new Error("Failed to read file for rotation."));
        };

        reader.readAsDataURL(file); // Start reading the file
    });
};

// Add other image helper functions here later
