const Joi = require('joi');

const batchArraySchema = Joi.array()
  .min(1)
  .required()
  .messages({
    'any.required': 'Request body is required',
    'array.base': 'Request body must be an array of API response records',
    'array.min': 'Request body must be a non-empty array'
  });

const itemSchema = Joi.object({
  api_name: Joi.string()
    .trim()
    .min(1)
    .max(100)
    .required()
    .messages({
      'string.base': '"api_name" must be a string',
      'string.empty': '"api_name" cannot be empty',
      'any.required': '"api_name" is required'
    }),

  response_time_ms: Joi.number()
    .min(0)
    .required()
    .messages({
      'number.base': '"response_time_ms" must be a number',
      'number.min': '"response_time_ms" cannot be negative',
      'any.required': '"response_time_ms" is required'
    }),

  status_code: Joi.number()
    .integer()
    .min(100)
    .max(599)
    .required()
    .messages({
      'number.base': '"status_code" must be a valid HTTP status code number',
      'number.min': '"status_code" must be between 100 and 599',
      'number.max': '"status_code" must be between 100 and 599',
      'any.required': '"status_code" is required'
    }),

  records_returned: Joi.number()
    .integer()
    .min(0)
    .allow(null)
    .optional()
    .messages({
      'number.base': '"records_returned" must be an integer, null, or omitted',
      'number.min': '"records_returned" cannot be negative'
    })
}).unknown(false);

/**
 * Validates the batch array and partitions individual elements.
 */
function validateMonitorBatch(req, res, next) {
  // 1. Root batch check: Reject non-array or empty array with 400 Bad Request
  const { error: batchError } = batchArraySchema.validate(req.body, { abortEarly: false });
  if (batchError) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: batchError.details.map((d) => d.message).join('; '),
        requestId: req.id
      }
    });
  }

  const validItems = [];
  const invalidItems = [];

  // 2. Validate items individually
  req.body.forEach((item, index) => {
    const { value, error } = itemSchema.validate(item, {
      abortEarly: false,
      stripUnknown: false
    });

    if (error) {
      invalidItems.push({
        index,
        item,
        errors: error.details.map((d) => d.message)
      });
    } else {
      validItems.push({
        api_name: value.api_name,
        response_time_ms: value.response_time_ms,
        status_code: value.status_code,
        ...(value.records_returned !== undefined && { records_returned: value.records_returned })
      });
    }
  });

  // If every item in the batch is malformed, reject upfront
  if (validItems.length === 0 && invalidItems.length > 0) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'All items in the submitted batch are malformed',
        invalidItems,
        requestId: req.id
      }
    });
  }

  req.validItems = validItems;
  req.invalidItems = invalidItems;
  next();
}

module.exports = {
  validateMonitorBatch,
  itemSchema,
  batchArraySchema
};
