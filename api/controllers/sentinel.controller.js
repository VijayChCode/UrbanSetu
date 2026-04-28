import SentinelAlert from "../models/sentinelAlert.model.js";
import { errorHandler } from "../utils/error.js";

export const getAlerts = async (req, res, next) => {
  try {
    const { status = 'pending', limit = 50 } = req.query;
    
    const alerts = await SentinelAlert.find({ status })
      .populate('userId', 'username email avatar')
      .populate('listingId', 'name type regularPrice')
      .sort({ createdAt: -1 })
      .limit(parseInt(limit));

    const total = await SentinelAlert.countDocuments();
    const pending = await SentinelAlert.countDocuments({ status: 'pending' });
    const critical = await SentinelAlert.countDocuments({ status: 'pending', severity: 'critical' });
    const high = await SentinelAlert.countDocuments({ status: 'pending', severity: 'high' });
    const medium = await SentinelAlert.countDocuments({ status: 'pending', severity: 'medium' });
    const low = await SentinelAlert.countDocuments({ status: 'pending', severity: 'low' });

    res.status(200).json({
      success: true,
      alerts,
      stats: {
        total,
        pending,
        critical,
        high,
        medium,
        low
      }
    });
  } catch (error) {
    next(error);
  }
};

export const updateAlertStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const alert = await SentinelAlert.findByIdAndUpdate(
      id,
      { 
        status,
        resolvedBy: req.user.id,
        resolvedAt: new Date()
      },
      { new: true }
    );

    if (!alert) return next(errorHandler(404, "Alert not found"));

    res.status(200).json({
      success: true,
      alert
    });
  } catch (error) {
    next(error);
  }
};
