const multer = require("multer");
const path = require("path");

// Konfiguration der Speicheroptionen
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "public/uploads/profile_uploads"); // Zielverzeichnis für hochgeladene Dateien
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    const basename = path.basename(file.originalname, ext);
    cb(null, basename + "-" + uniqueSuffix + ext); // Neuer Dateiname
  },
});

// Initialisiere Multer mit den Speicheroptionen
const upload = multer({
  storage: storage,
  limits: { fileSize: 50 * 1024 * 1024 * 1024 },
  fileFilter: function (req, file, cb) {
    checkFileType(file, cb);
  },
}).single("profile_picture", 10);

// Check file type
function checkFileType(file, cb) {
  const filetypes = /jpeg|jpg|png|gif/;
  const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = filetypes.test(file.mimetype);

  if (mimetype && extname) {
    return cb(null, true);
  } else {
    cb("Error: Images and PDFs Only!");
  }
}

module.exports = upload;
