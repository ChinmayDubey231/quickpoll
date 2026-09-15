import type { Request } from 'express';

// Express 5 types req.params[key] as `string | string[]` to accommodate
// repeated wildcard segments; none of this app's routes use those, so every
// param is always a single string in practice.
export const paramId = (value: string | string[]): string =>
  Array.isArray(value) ? value[0] : value;

// req.headers['x-forwarded-for'] can be a string or string[] depending on
// how many proxies appended it; take the first (client-nearest) value.
export const getClientIp = (req: Request): string => {
  const forwarded = req.headers['x-forwarded-for'];
  const forwardedIp = Array.isArray(forwarded) ? forwarded[0] : forwarded;
  return req.ip || forwardedIp || 'unknown';
};
