// models/Tutor.js
const mongoose = require("mongoose");

const scheduleExceptionSchema = new mongoose.Schema({
  date: {
    type: Date,
    required: true,
  },
  type: {
    type: String,
    enum: ["unavailable", "modified"],
    required: true,
  },
  reason: String,
  modifiedSchedule: {
    startTime: String,
    endTime: String,
  },
});

const tutorProfileSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    personalDetails: {
      dateOfBirth: Date,
      photoUrl: String,
    },
    education: {
      university: String,
      degree: String,
      graduationDate: Date,
      major: String,
    },
    subjects: [String],
    grade: String,
    // Modified to accept category ObjectIds instead of enum strings
    classCategories: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Category"
      },
    ],
    atar: {
      type: Number,
      min: 0,
      max: 99.95,
    },
    yearCompleted: {
      type: Number,
      min: 1900,
      max: new Date().getFullYear(),
    },
    teachingExperience: {
      type: String,
      enum: ["0-1", "1-2", "2-5", "5+"],
    },
    specializations: [String],
    achievements: String,
    qualifications: [
      {
        degree: String,
        institution: String,
        startDate: Date,
        endDate: Date,
      },
    ],
    shifts: {
      type: [
        {
          // 0 is Sunday, 1 is Monday, 2 is Tuesday, etc.
          dayOfWeek: {
            type: Number,
            required: true,
            min: 0,
            max: 6,
          },
          startTime: {
            type: String,
            required: true,
            match: /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/,
          },
          endTime: {
            type: String,
            required: true,
            match: /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/,
          },
          // Add recurrence field
          recurrence: {
            type: String,
            enum: ["weekly", "fortnightly", "one-off"],
            default: "weekly",
          },
          // Add trial class marker
          isTrial: {
            type: Boolean,
            default: false,
          },
          // Add specific date for one-off shifts
          specificDate: {
            type: Date,
            // Required only if recurrence is one-off
            required: function() {
              return this.recurrence === 'one-off';
            },
          },
        },
      ],
      default: [],
    },
    location: {
      address: {
        type: String,
        trim: true
      },
      coordinates: {
        latitude: {
          type: Number,
          // Validate that latitude is a real number and in valid range
          validate: {
            validator: function(val) {
              // Accept null/undefined or valid number between -90 and 90
              return val === null || val === undefined || 
                     (!isNaN(val) && val >= -90 && val <= 90);
            },
            message: 'Latitude must be a valid number between -90 and 90'
          }
        },
        longitude: {
          type: Number,
          // Validate that longitude is a real number and in valid range
          validate: {
            validator: function(val) {
              // Accept null/undefined or valid number between -180 and 180
              return val === null || val === undefined || 
                     (!isNaN(val) && val >= -180 && val <= 180);
            },
            message: 'Longitude must be a valid number between -180 and 180'
          }
        }
      }
    },
    scheduleExceptions: [scheduleExceptionSchema],
    status: {
      type: String,
      enum: ["active", "inactive", "suspended"],
      default: "active",
    },
    reviews: [
      {
        student: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
        },
        rating: {
          type: Number,
          min: 1,
          max: 5,
        },
        comment: String,
        date: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    assignedBlogs: Number,
    publishedBlogs: Number,
    creditBalance: {
      type: Number,
      default: 0,
    },
    // If you need to store the category name for quick access, keep this
    category: {
      type: String,
    },
    stripeAccountId: {
      type: String,
    },
    stripeOnboardingLink: {
      type: String,
    },
    stripeOnboardingCompleted: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

const TutorProfile = mongoose.model("TutorProfile", tutorProfileSchema);
module.exports = TutorProfile;