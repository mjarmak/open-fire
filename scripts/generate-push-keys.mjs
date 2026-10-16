import { generateKeyPairSync } from 'node:crypto';

// Run once on a trusted server/terminal; store the private value only in protected backend configuration.
const { privateKey } = generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
const jwk = privateKey.export({ format: 'jwk' });
const publicKey = Buffer.concat([Buffer.from([4]), Buffer.from(jwk.x, 'base64url'), Buffer.from(jwk.y, 'base64url')]);
console.log(`OPENFIRE_PUSH_PUBLIC_KEY=${publicKey.toString('base64url')}`);
console.log(`OPENFIRE_PUSH_PRIVATE_KEY=${jwk.d}`);
