import { getFieldsToSign, jwtSign, type Payload, type PayloadRequest, type TypedUser } from 'payload';
import { addSessionToUser, generatePayloadCookie } from 'payload/shared';

/**
 * Sign a `users` account in without a password: the same JWT, session entry
 * and `payload-token` cookie that Payload's own login gives
 * (payload/dist/auth/operations/login.js in 3.79.1), so the admin panel, the
 * REST API, logout and session revocation treat it like any other login.
 *
 * Only for a caller that has already proven who this is (the Google callback,
 * endpoints/googleAuth.ts). Skips what belongs to the password path on
 * purpose: the password check, login attempts and the beforeLogin hook (which
 * keeps password sign-in to admins, collections/Users.ts).
 *
 * Returns the Set-Cookie value.
 */
export async function issuePayloadSession(payload: Payload, req: PayloadRequest, userId: number | string): Promise<string> {
  const collectionConfig = payload.collections.users.config;
  // The raw row, as login reads it: addSessionToUser writes it back whole
  // with the new session in `sessions`.
  const user = (await payload.db.findOne({
    collection: 'users',
    req,
    where: { id: { equals: userId } },
  })) as (TypedUser & { email: string; collection: 'users'; _strategy?: string }) | null;
  if (!user) throw new Error(`[session] no user ${userId}`);
  user.collection = 'users';
  user._strategy = 'local-jwt';

  const { sid } = await addSessionToUser({ collectionConfig, payload, req, user });
  const fieldsToSign = getFieldsToSign({ collectionConfig, email: user.email, sid, user });
  const { token } = await jwtSign({
    fieldsToSign,
    secret: payload.secret,
    tokenExpiration: collectionConfig.auth.tokenExpiration,
  });
  return generatePayloadCookie({
    collectionAuthConfig: collectionConfig.auth,
    cookiePrefix: payload.config.cookiePrefix,
    token,
  }) as string;
}
