/* SHA-256 of a file's bytes as lowercase hex; used to recognise the known sample documents */
export async function sha256Hex(buffer) {
  const digest = await crypto.subtle.digest('SHA-256', new Uint8Array(buffer));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}
