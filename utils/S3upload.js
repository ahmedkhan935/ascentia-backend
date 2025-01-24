const AWS = require('aws-sdk');
const fs = require('fs');
const path = require('path');

// Configure AWS with your access and secret key.
const s3 = new AWS.S3({
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    region: process.env.AWS_REGION
});

/**
 * Uploads a file to S3 and returns the public URL.
 * @param {string} filePath - The path to the file to upload.
 * @param {string} bucketName - The name of the S3 bucket.
 * @returns {Promise<string>} - The public URL of the uploaded file.
 */
const uploadFile = async (filePath, bucketName) => {
    const fileContent = fs.readFileSync(filePath);
    const fileName = path.basename(filePath);

    const params = {
        Bucket: bucketName,
        Key: fileName,
        Body: fileContent,
        ACL: 'private' // Make the file private
    };

    try {
        const data = await s3.upload(params).promise();
        return data.Location; // The URL of the uploaded file (not publicly accessible)
    } catch (error) {
        throw new Error(`File upload failed: ${error.message}`);
    }
};

/**
 * Loads a file from S3.
 * @param {string} bucketName - The name of the S3 bucket.
 * @param {string} fileName - The name of the file in the S3 bucket.
 * @returns {Promise<Buffer>} - The file content as a Buffer.
 */
const loadFile = async (bucketName, fileName) => {
    const params = {
        Bucket: bucketName,
        Key: fileName
    };

    try {
        const data = await s3.getObject(params).promise();
        return data.Body; // The file content as a Buffer
    } catch (error) {
        throw new Error(`File load failed: ${error.message}`);
    }
};

module.exports = { uploadFile, loadFile };