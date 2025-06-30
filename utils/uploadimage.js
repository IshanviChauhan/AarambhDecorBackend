const cloudinary = require("cloudinary").v2;

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const opts = {
  overwrite: true,
  invalidate: true,
  resource_type: "auto",
};

module.exports = (file) => {
  // file = base64 encoded image or video string
  return new Promise((resolve, reject) => {
    cloudinary.uploader.upload(file, opts, (error, result) => {
      if (result && result.secure_url) {
        return resolve(result.secure_url);
      }
      console.error("Cloudinary Upload Error:", error.message);
      return reject(new Error(error.message));
    });
  });
};
