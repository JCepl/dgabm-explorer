// A small UTF-8 ZIP writer using the standard "stored" (uncompressed) format.
// Source assets are compressed in transit; the archive is assembled after login.
(function (root) {
  const encode = text => new TextEncoder().encode(text);
  const crcTable = Uint32Array.from({length: 256}, (_, value) => {
    let crc = value;
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
    return crc >>> 0;
  });
  function crc32(bytes) {
    let crc = 0xffffffff;
    for (const byte of bytes) crc = crcTable[(crc ^ byte) & 255] ^ (crc >>> 8);
    return (crc ^ 0xffffffff) >>> 0;
  }
  function header(size) {
    const bytes = new Uint8Array(size);
    return {bytes, view: new DataView(bytes.buffer)};
  }
  function zipFiles(files) {
    const localParts = [], directoryParts = [];
    let offset = 0;
    const now = new Date();
    const time = (now.getHours() << 11) | (now.getMinutes() << 5) | (now.getSeconds() >> 1);
    const date = ((Math.max(1980, now.getFullYear()) - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate();
    for (const file of files) {
      if (file.name.startsWith('/') || file.name.split('/').includes('..')) throw new Error('Unsafe archive path');
      const name = encode(file.name);
      const data = typeof file.data === 'string' ? encode(file.data) : file.data;
      const checksum = crc32(data);
      // ZIP local file header: UTF-8 flag, timestamp, CRC, sizes, filename.
      const local = header(30);
      local.view.setUint32(0, 0x04034b50, true);
      local.view.setUint16(4, 20, true);
      local.view.setUint16(6, 0x800, true);
      local.view.setUint16(10, time, true);
      local.view.setUint16(12, date, true);
      local.view.setUint32(14, checksum, true);
      local.view.setUint32(18, data.length, true);
      local.view.setUint32(22, data.length, true);
      local.view.setUint16(26, name.length, true);
      localParts.push(local.bytes, name, data);
      // Matching central directory entry, including this file's byte offset.
      const entry = header(46);
      entry.view.setUint32(0, 0x02014b50, true);
      entry.view.setUint16(4, 20, true);
      entry.view.setUint16(6, 20, true);
      entry.view.setUint16(8, 0x800, true);
      entry.view.setUint16(12, time, true);
      entry.view.setUint16(14, date, true);
      entry.view.setUint32(16, checksum, true);
      entry.view.setUint32(20, data.length, true);
      entry.view.setUint32(24, data.length, true);
      entry.view.setUint16(28, name.length, true);
      entry.view.setUint32(42, offset, true);
      directoryParts.push(entry.bytes, name);
      offset += 30 + name.length + data.length;
    }
    const directorySize = directoryParts.reduce((sum, part) => sum + part.length, 0);
    const end = header(22);
    end.view.setUint32(0, 0x06054b50, true);
    end.view.setUint16(8, files.length, true);
    end.view.setUint16(10, files.length, true);
    end.view.setUint32(12, directorySize, true);
    end.view.setUint32(16, offset, true);
    return new Blob([...localParts, ...directoryParts, end.bytes], {type: 'application/zip'});
  }
  root.DGABMZip = {zipFiles};
  if (typeof module !== 'undefined') module.exports = root.DGABMZip;
})(typeof window !== 'undefined' ? window : globalThis);
