const multer = require("multer");
const path = require("path");

// Konfiguration der Speicheroptionen
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "public/uploads/ticket_uploads"); // Zielverzeichnis für hochgeladene Dateien
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
  limits: { fileSize: 10 * 1024 * 1024 * 1024 },
}).array("attachments", 10);

module.exports = upload;
