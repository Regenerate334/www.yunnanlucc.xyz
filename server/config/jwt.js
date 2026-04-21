const isProduction = process.env.NODE_ENV === 'production';
const rawSecret = process.env.JWT_SECRET?.trim();

if (!rawSecret) {
  if (isProduction) {
    throw new Error('FATAL: JWT_SECRET environment variable is not defined in production.');
  }
  console.warn('WARNING: JWT_SECRET is not defined, using insecure fallback for development only.');
}

export const JWT_SECRET = rawSecret || 'dev_insecure_secret_change_me';
export const USING_DEV_JWT_FALLBACK = !rawSecret;

