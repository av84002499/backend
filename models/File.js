// models/File.js
const mongoose = require('mongoose');

const FileSchema = new mongoose.Schema(
  {
    fileName:   { type: String, required: true },
    fileUrl:    { type: String, required: true },
    fileType:   { type: String, required: true },
    uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    relatedTo:  { type: String, enum: ['organization','report','vulnerability'], required: true },
    relatedId:  { type: mongoose.Schema.Types.ObjectId, required: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model('File', FileSchema);
