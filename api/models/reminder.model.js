import mongoose from 'mongoose';

const reminderSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    taskText: {
      type: String,
      required: true,
    },
    scheduledTime: {
      type: Date,
      required: true,
    },
    status: {
      type: String,
      enum: ['scheduled', 'triggered', 'cancelled', 'dismissed'],
      default: 'scheduled',
    },
    emailSent: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

// Index for efficient polling and user lookups
reminderSchema.index({ status: 1, scheduledTime: 1 });
reminderSchema.index({ userId: 1, status: 1 });

const Reminder = mongoose.model('Reminder', reminderSchema);

export default Reminder;
