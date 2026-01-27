"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.encrypt = encrypt;
exports.decrypt = decrypt;
const crypto_1 = __importDefault(require("crypto"));
const ALGORITHM = 'aes-256-gcm';
function getKey() {
    const raw = process.env.ENCRYPTION_KEY || '';
    if (!raw)
        throw new Error('ENCRYPTION_KEY not set');
    // Accept hex/base64 or raw string; normalize to 32 bytes
    let key;
    if (/^[0-9a-fA-F]{64}$/.test(raw)) {
        key = Buffer.from(raw, 'hex');
    }
    else if (/^[A-Za-z0-9+/=]+$/.test(raw) && Buffer.from(raw, 'base64').length === 32) {
        key = Buffer.from(raw, 'base64');
    }
    else {
        // Derive 32 bytes from passphrase
        key = crypto_1.default.createHash('sha256').update(raw).digest();
    }
    return key;
}
function encrypt(text) {
    const iv = crypto_1.default.randomBytes(12);
    const key = getKey();
    const cipher = crypto_1.default.createCipheriv(ALGORITHM, key, iv, { authTagLength: 16 });
    const encrypted = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return Buffer.concat([iv, tag, encrypted]).toString('base64');
}
function decrypt(data) {
    const buf = Buffer.from(data, 'base64');
    const iv = buf.slice(0, 12);
    const tag = buf.slice(12, 28);
    const encrypted = buf.slice(28);
    const key = getKey();
    const decipher = crypto_1.default.createDecipheriv(ALGORITHM, key, iv, { authTagLength: 16 });
    decipher.setAuthTag(tag);
    const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
    return decrypted.toString('utf8');
}
