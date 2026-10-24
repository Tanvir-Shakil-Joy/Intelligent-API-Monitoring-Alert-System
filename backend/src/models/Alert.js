const mongoose = require('mongoose');

const alertSchema = new mongoose.Schema(
  {
    apiName: {
      type: String,
      required: [true, 'apiName is required'],
      trim: true,
      maxlength: 100
    },
    anomalyTypes: {
      type: [String],
      required: [true, 'At least one anomalyType is required'],
      enum: {
        values: ['HIGH_RESPONSE_TIME', 'SERVER_ERROR', 'CLIENT_ERROR', 'ZERO_RECORDS'],
        message: '{VALUE} is not a valid anomaly type'
      }
    },
    severity: {
      type: String,
      required: [true, 'severity is required'],
      enum: {
        values: ['critical', 'high', 'medium'],
        message: '{VALUE} is not a valid severity level'
      }
    },
    metrics: {
      responseTimeMs: {
        type: Number,
        required: true,
        min: 0
      },
      statusCode: {
        type: Number,
        required: true,
        min: 100,
        max: 599
      },
      recordsReturned: {
        type: Number,
        default: null
      }
    },
    message: {
      type: String,
      required: [true, 'message is required'],
      trim: true,
      maxlength: 500
    },
    messageSource: {
      type: String,
      required: [true, 'messageSource is required'],
      enum: {
        values: ['ai', 'fallback'],
        message: '{VALUE} must be either "ai" or "fallback"'
      }
    },
    status: {
      type: String,
      enum: ['active'],
      default: 'active'
    }
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: (doc, ret) => {
        ret.id = ret._id.toString();
        delete ret._id;
        delete ret.__v;
        return ret;
      }
    }
  }
);

// Compound and field indexes for fast active alert retrieval and filtering
alertSchema.index({ status: 1, createdAt: -1 });
alertSchema.index({ status: 1, severity: 1, createdAt: -1 });
alertSchema.index({ status: 1, apiName: 1, createdAt: -1 });

const Alert = mongoose.model('Alert', alertSchema);

module.exports = Alert;
