// Category Schema
const mongoose = require('mongoose');

const SubjectSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Subject name is required'],
    trim: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

const CategorySchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Category name is required'],
    unique: true,
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
  subjects: [SubjectSchema],
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = {
  Category: mongoose.model('Category', CategorySchema),
};