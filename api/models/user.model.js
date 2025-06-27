import mongoose from "mongoose";

const userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true
  },
  email: {
    type: String,
    required: true,
    unique: true
  },
  password: {
    type: String,
    required: true
  },
  mobileNumber: {
    type: String,
    required: true,
    unique: true,
    validate: {
      validator: function(v) {
        // Validate 10-digit mobile number (India format or generalized)
        return /^[0-9]{10}$/.test(v);
      },
      message: props => `${props.value} is not a valid 10-digit mobile number!`
    }
  },
  avatar: {
    type: String,
    default:
      "https://cdn.pixabay.com/photo/2015/10/05/22/37/blank-profile-picture-973460_1280.png"
  },
  role: {
    type: String,
    enum: ["user", "admin", "rootadmin"],
    default: "user"
  },
  isDefaultAdmin: {
    type: Boolean,
    default: false
  },
  adminApprovalStatus: {
    type: String,
    enum: ["pending", "approved", "rejected"],
    default: "pending"
  },
  adminApprovalDate: {
    type: Date
  },
  approvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User"
  },
  adminRequestDate: {
    type: Date,
    default: Date.now
  },
  resetToken: {
    type: String
  },
  resetTokenExpiry: {
    type: Date
  },
  status: {
    type: String,
    enum: ["active", "suspended"],
    default: "active"
  }
}, { timestamps: true });

const User = mongoose.model("User", userSchema);

export default User;
