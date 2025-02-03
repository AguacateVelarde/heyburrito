import * as Joi from 'joi';

export const validationSchema = Joi.object({
  MONTHLY_BURRITO_LIMIT: Joi.number().min(0).default(0),
  ENABLE_LEADERBOARD: Joi.boolean().default(true),
  ENABLE_MONTHLY_RESET: Joi.boolean().default(false),
  SHOW_MONTHLY_LEADER: Joi.boolean().default(false),
  MONGODB_URI: Joi.string().required(),
  SLACK_BOT_TOKEN: Joi.string().required(),
  SLACK_SIGNING_SECRET: Joi.string().required(),
  APP_PORT: Joi.number().default(3000),
  GIPHY_API_KEY: Joi.string().required(),
});
