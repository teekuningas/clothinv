import Papa from 'papaparse';

/**
 * Helper function to get MIME type from filename.
 * @param {string} filename - The name of the file.
 * @returns {string} The determined MIME type or a default.
 */
export const getMimeTypeFromFilename = (filename) => {
    if (!filename) return 'application/octet-stream'; // Default if no filename
    const lowerCaseFilename = filename.toLowerCase();
    if (lowerCaseFilename.endsWith('.jpg') || lowerCaseFilename.endsWith('.jpeg')) return 'image/jpeg';
    if (lowerCaseFilename.endsWith('.png')) return 'image/png';
    if (lowerCaseFilename.endsWith('.gif')) return 'image/gif';
    if (lowerCaseFilename.endsWith('.webp')) return 'image/webp';
    if (lowerCaseFilename.endsWith('.svg')) return 'image/svg+xml';
    // Add other common image types as needed
    return 'application/octet-stream'; // Fallback for unknown types
};

/**
 * Helper to read a File object as a Base64 encoded string.
 * @param {File} file - The File object to read.
 * @returns {Promise<string>} A promise that resolves with the Base64 string (without the data URI prefix).
 */
export const readFileAsBase64 = (file) => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result.split(',')[1]); // Get only the base64 part
        reader.onerror = (error) => reject(error);
        reader.readAsDataURL(file);
    });
};

/**
 * Helper function to convert a Base64 string to a Blob.
 * @param {string} base64 - The Base64 encoded string.
 * @param {string} mimeType - The MIME type of the data.
 * @returns {Blob | null} The resulting Blob or null if conversion fails.
 */
export const base64ToBlob = (base64, mimeType) => {
    try {
        const byteCharacters = atob(base64);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
            byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        return new Blob([byteArray], { type: mimeType });
    } catch (e) {
        console.error("Error converting base64 to Blob:", e);
        return null;
    }
};

/**
 * Creates a CSV string from an array of objects.
 * @param {string[]} headers - An array of header strings (keys of the objects).
 * @param {object[]} data - An array of data objects.
 * @returns {string} The generated CSV string.
 */
export const createCSV = (headers, data) => {
    const headerRow = headers.join(',');
    const dataRows = data.map(row =>
        headers.map(header => {
            let value = row[header];
            // Handle null/undefined
            if (value === null || typeof value === 'undefined') {
                return '';
            }
            // Quote strings containing commas, quotes, or newlines
            value = String(value);
            if (value.includes(',') || value.includes('"') || value.includes('\n')) {
                // Escape double quotes by doubling them
                value = value.replace(/"/g, '""');
                return `"${value}"`;
            }
            return value;
        }).join(',')
    );
    return [headerRow, ...dataRows].join('\n');
};

/**
 * Parses a CSV string into an array of objects using PapaParse.
 * @param {string} csvString - The CSV string to parse.
 * @returns {object[]} An array of objects representing the CSV rows.
 */
export const parseCSV = (csvString) => {
    if (!csvString || typeof csvString !== 'string') {
        console.warn("parseCSV received invalid input:", csvString);
        return [];
    }
    try {
        const result = Papa.parse(csvString.trim(), {
            header: true, // Assumes first row is header
            skipEmptyLines: true,
            dynamicTyping: (header) => {
                 const h = header.trim().toLowerCase();
                 // parse "price" as number as well as any _id
                 if (h === 'id' || h === 'price') return true;
                 if (h.endsWith('_id') || h.endsWith('Id')) return true;
                 return false;
            },
            transformHeader: header => header.trim(), // Trim header whitespace
            transform: (value, header) => { // eslint-disable-line no-unused-vars
                 // Handle empty strings for timestamp fields as null
                 if (header.endsWith('_at') && value === '') {
                     return null;
                 }
                 // Trim whitespace from values
                 return typeof value === 'string' ? value.trim() : value;
            }
        });

        if (result.errors.length > 0) {
            console.warn("CSV parsing errors encountered:", result.errors);
            // Decide if you want to throw or just return potentially partial data
        }

        // Ensure numeric IDs are actually numbers after dynamicTyping
        // PapaParse dynamicTyping might not catch all cases or might misinterpret
        return result.data.map(row => {
            Object.keys(row).forEach(key => {
                if (key.endsWith('_id') && typeof row[key] === 'string' && row[key] !== '') {
                    const num = parseInt(row[key], 10);
                    if (!isNaN(num)) {
                        row[key] = num;
                    }
                } else if (key.endsWith('_id') && row[key] === '') {
                     row[key] = null; // Treat empty ID strings as null if needed, or handle appropriately
                }
            });
            return row;
        });

    } catch (error) {
        console.error("Error parsing CSV string:", error);
        return []; // Return empty array on catastrophic error
    }
};
