import * as Joi from 'joi';

export const validationSchema = Joi.object({
  MONGODB_URI: Joi.string().required(),
  SLACK_BOT_TOKEN: Joi.string().required(),
  SLACK_SIGNING_SECRET: Joi.string().required(),
  APP_PORT: Joi.number().default(3000),
  GIPHY_API_KEY: Joi.string().required(),
});
