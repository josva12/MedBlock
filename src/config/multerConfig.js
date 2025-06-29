const multer = require('multer');
const path = require('path');
const fs = require('fs');
const logger = require('../utils/logger'); // Assuming you have a logger utility

// Define storage for uploaded files to a temporary folder
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        // Multer's destination is executed *before* req.body is parsed.
        // So, we use a single, temporary upload directory.
        const tempUploadPath = path.join(__dirname, '..', 'uploads', 'temp');

        // Create the directory if it doesn't exist
        fs.mkdirSync(tempUploadPath, { recursive: true });
        cb(null, tempUploadPath);
    },
    filename: (req, file, cb) => {
        // Use original filename with a timestamp to avoid conflicts
        cb(null, `${Date.now()}-${file.originalname}`);
    }
});

// File filter to allow only specific file types
const fileFilter = (req, file, cb) => {
    const allowedMimeTypes = {
        'medical_report': ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
        'prescription': ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
        'lab_result': ['application/pdf', 'image/jpeg', 'image/png'],
        'xray': ['image/jpeg', 'image/png'],
        'other': ['application/pdf', 'image/jpeg', 'image/png', 'application/zip', 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet']
    };

    // Access req.body.fileType here. Multer's filter can access some body fields.
    let fileType = req.body.fileType;

    // Ensure fileType is a string and lowercase for robust comparison
    if (typeof fileType === 'string') {
        fileType = fileType.toLowerCase();
    } else {
        fileType = 'other'; // Default if not a string or missing
    }

    const typeAllowed = allowedMimeTypes[fileType] || allowedMimeTypes['other'];

    if (typeAllowed.includes(file.mimetype)) {
        cb(null, true); // Accept file
    } else {
        logger.warn(`File upload rejected: Invalid MIME type ${file.mimetype} for fileType ${fileType}`);
        cb(new Error(`File type not supported for ${fileType}. Allowed types: ${typeAllowed.join(', ')}.`), false);
    }
};

// Configure Multer upload middleware
const upload = multer({
    storage: storage,
    fileFilter: fileFilter,
    limits: {
        fileSize: 5 * 1024 * 1024 // 5 MB file size limit
    }
});

module.exports = upload; 