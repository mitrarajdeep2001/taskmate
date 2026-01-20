import multer from "multer";

export const avatarUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 200 * 1024 }, // 200 KB
});

export const taskUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
});
