import * as Joi from 'joi';

export const envConfigSchema = Joi.object({
  NODE_ENV: Joi.string()
    .valid('development', 'production', 'test', 'staging')
    .required(),

  PORT: Joi.number().port().required(),

  DATABASE_URL: Joi.string().uri().required(),

  JWT_SECRET: Joi.string().min(16).required(),
  JWT_EXPIRES_IN: Joi.string().required(),

  SALT_ROUNDS: Joi.number().integer().min(8).max(15).required(),

  SEED_ADMIN: Joi.boolean().truthy('true').falsy('false').default(false),

  ADMIN_EMAIL: Joi.string().email().when('SEED_ADMIN', {
    is: true,
    then: Joi.required(),
    otherwise: Joi.optional(),
  }),

  ADMIN_PASSWORD: Joi.string().min(8).when('SEED_ADMIN', {
    is: true,
    then: Joi.required(),
    otherwise: Joi.optional(),
  }),
}).unknown(true);
