import mongoose from 'mongoose';

const maintenanceNotificationSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true
  },
  notified: {
    type: Boolean,
    default: false
  }
}, { timestamps: true });

const MaintenanceNotification = mongoose.model('MaintenanceNotification', maintenanceNotificationSchema);

export default MaintenanceNotification;
