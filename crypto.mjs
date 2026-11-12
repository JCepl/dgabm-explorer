// Web Crypto only: shared by the local publisher and the browser's unlock form.
const ITERATIONS = 600000;
const encoder = new TextEncoder();
const context = encoder.encode('DGABM encrypted export v1');

function toBase64(bytes) {
  let binary = '';
  for (let i = 0; i < bytes.length; i += 32768) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 32768));
  }
  return btoa(binary);
}

function fromBase64(text) {
  return Uint8Array.from(atob(text), char => char.charCodeAt(0));
}

async function deriveKey(password, salt) {
  const material = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', hash: 'SHA-256', salt, iterations: ITERATIONS },
    material, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']
  );
}

export async function encryptJson(value, password) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(password, salt);
  // Compress repetitive text before encryption to keep unlock downloads small.
  const compressed = await new Response(new Blob([JSON.stringify(value)]).stream()
    .pipeThrough(new CompressionStream('gzip'))).arrayBuffer();
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv, additionalData: context, tagLength: 128 },
    key, compressed
  );
  return { version: 1, compression: 'gzip', cipher: 'AES-256-GCM', kdf: 'PBKDF2-SHA256', iterations: ITERATIONS,
    salt: toBase64(salt), iv: toBase64(iv), ciphertext: toBase64(new Uint8Array(ciphertext)) };
}

export async function decryptJson(packet, password) {
  if (packet.version !== 1 || packet.cipher !== 'AES-256-GCM' ||
      packet.kdf !== 'PBKDF2-SHA256' || packet.iterations !== ITERATIONS) {
    throw new Error('Unsupported encrypted export.');
  }
  const key = await deriveKey(password, fromBase64(packet.salt));
  const plaintext = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: fromBase64(packet.iv), additionalData: context, tagLength: 128 },
    key, fromBase64(packet.ciphertext)
  );
  const content = packet.compression === 'gzip'
    ? await new Response(new Blob([plaintext]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer()
    : plaintext; // Existing encrypted releases without compression still open.
  return JSON.parse(new TextDecoder().decode(content));
}
