const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

// CRC32 implementation
function makeCrcTable() {
  const cTable = [];
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    }
    cTable[n] = c;
  }
  return cTable;
}

const crcTable = makeCrcTable();

function crc32(buf) {
  let crc = 0 ^ (-1);
  for (let i = 0; i < buf.length; i++) {
    crc = (crc >>> 8) ^ crcTable[(crc ^ buf[i]) & 0xFF];
  }
  return (crc ^ (-1)) >>> 0;
}

function createPng(width, height, r, g, b, a = 255) {
  // PNG signature
  const signature = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);

  // IHDR chunk
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData.writeUInt8(8, 8); // bit depth 8
  ihdrData.writeUInt8(6, 9); // color type 6 (RGBA)
  ihdrData.writeUInt8(0, 10); // compression
  ihdrData.writeUInt8(0, 11); // filter
  ihdrData.writeUInt8(0, 12); // interlace

  const ihdrChunk = Buffer.concat([
    Buffer.from('IHDR'),
    ihdrData
  ]);
  const ihdrCrc = Buffer.alloc(4);
  ihdrCrc.writeUInt32BE(crc32(ihdrChunk), 0);
  const ihdrLen = Buffer.alloc(4);
  ihdrLen.writeUInt32BE(13, 0);
  const fullIhdr = Buffer.concat([ihdrLen, ihdrChunk, ihdrCrc]);

  // Raw image data with filter byte 0 at start of each scanline
  const rowSize = 1 + width * 4;
  const rawData = Buffer.alloc(rowSize * height);
  for (let y = 0; y < height; y++) {
    const rowOffset = y * rowSize;
    rawData[rowOffset] = 0; // Filter None
    for (let x = 0; x < width; x++) {
      const pxOffset = rowOffset + 1 + x * 4;
      rawData[pxOffset] = r;
      rawData[pxOffset + 1] = g;
      rawData[pxOffset + 2] = b;
      rawData[pxOffset + 3] = a;
    }
  }

  // Compress IDAT
  const compressed = zlib.deflateSync(rawData);
  const idatChunk = Buffer.concat([
    Buffer.from('IDAT'),
    compressed
  ]);
  const idatCrc = Buffer.alloc(4);
  idatCrc.writeUInt32BE(crc32(idatChunk), 0);
  const idatLen = Buffer.alloc(4);
  idatLen.writeUInt32BE(compressed.length, 0);
  const fullIdat = Buffer.concat([idatLen, idatChunk, idatCrc]);

  // IEND chunk
  const iendChunk = Buffer.from('IEND');
  const iendCrc = Buffer.alloc(4);
  iendCrc.writeUInt32BE(crc32(iendChunk), 0);
  const iendLen = Buffer.alloc(4);
  iendLen.writeUInt32BE(0, 0);
  const fullIend = Buffer.concat([iendLen, iendChunk, iendCrc]);

  return Buffer.concat([signature, fullIhdr, fullIdat, fullIend]);
}

// Brand color: Dark Slate #07090E for splash, Gold/Navy for icon
const splashBg = { r: 7, g: 9, b: 14 }; // #07090E
const iconBg = { r: 16, g: 185, b: 129 }; // Emerald #10B981

const filesToGenerate = [
  { path: 'android/app/src/main/res/drawable/splash.png', w: 480, h: 800, ...splashBg },
  { path: 'android/app/src/main/res/drawable-port-hdpi/splash.png', w: 480, h: 800, ...splashBg },
  { path: 'android/app/src/main/res/drawable-port-mdpi/splash.png', w: 320, h: 480, ...splashBg },
  { path: 'android/app/src/main/res/drawable-port-xhdpi/splash.png', w: 720, h: 1280, ...splashBg },
  { path: 'android/app/src/main/res/drawable-port-xxhdpi/splash.png', w: 960, h: 1600, ...splashBg },
  { path: 'android/app/src/main/res/drawable-port-xxxhdpi/splash.png', w: 1280, h: 1920, ...splashBg },
  { path: 'android/app/src/main/res/drawable-land-hdpi/splash.png', w: 800, h: 480, ...splashBg },
  { path: 'android/app/src/main/res/drawable-land-mdpi/splash.png', w: 480, h: 320, ...splashBg },
  { path: 'android/app/src/main/res/drawable-land-xhdpi/splash.png', w: 1280, h: 720, ...splashBg },
  { path: 'android/app/src/main/res/drawable-land-xxhdpi/splash.png', w: 1600, h: 960, ...splashBg },
  { path: 'android/app/src/main/res/drawable-land-xxxhdpi/splash.png', w: 1920, h: 1280, ...splashBg },

  // Mipmaps
  { path: 'android/app/src/main/res/mipmap-mdpi/ic_launcher.png', w: 48, h: 48, ...iconBg },
  { path: 'android/app/src/main/res/mipmap-mdpi/ic_launcher_round.png', w: 48, h: 48, ...iconBg },
  { path: 'android/app/src/main/res/mipmap-mdpi/ic_launcher_foreground.png', w: 48, h: 48, ...iconBg },

  { path: 'android/app/src/main/res/mipmap-hdpi/ic_launcher.png', w: 72, h: 72, ...iconBg },
  { path: 'android/app/src/main/res/mipmap-hdpi/ic_launcher_round.png', w: 72, h: 72, ...iconBg },
  { path: 'android/app/src/main/res/mipmap-hdpi/ic_launcher_foreground.png', w: 72, h: 72, ...iconBg },

  { path: 'android/app/src/main/res/mipmap-xhdpi/ic_launcher.png', w: 96, h: 96, ...iconBg },
  { path: 'android/app/src/main/res/mipmap-xhdpi/ic_launcher_round.png', w: 96, h: 96, ...iconBg },
  { path: 'android/app/src/main/res/mipmap-xhdpi/ic_launcher_foreground.png', w: 96, h: 96, ...iconBg },

  { path: 'android/app/src/main/res/mipmap-xxhdpi/ic_launcher.png', w: 144, h: 144, ...iconBg },
  { path: 'android/app/src/main/res/mipmap-xxhdpi/ic_launcher_round.png', w: 144, h: 144, ...iconBg },
  { path: 'android/app/src/main/res/mipmap-xxhdpi/ic_launcher_foreground.png', w: 144, h: 144, ...iconBg },

  { path: 'android/app/src/main/res/mipmap-xxxhdpi/ic_launcher.png', w: 192, h: 192, ...iconBg },
  { path: 'android/app/src/main/res/mipmap-xxxhdpi/ic_launcher_round.png', w: 192, h: 192, ...iconBg },
  { path: 'android/app/src/main/res/mipmap-xxxhdpi/ic_launcher_foreground.png', w: 192, h: 192, ...iconBg },
];

for (const item of filesToGenerate) {
  const fullPath = path.resolve(process.cwd(), item.path);
  const dir = path.dirname(fullPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  const buf = createPng(item.w, item.h, item.r, item.g, item.b);
  fs.writeFileSync(fullPath, buf);
  console.log(`Generated pure valid PNG: ${item.path} (${buf.length} bytes, ${item.w}x${item.h})`);
}
