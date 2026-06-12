const VERSION = 5;
const SIZE = 17 + VERSION * 4;
const DATA_CODEWORDS = 108;
const ECC_CODEWORDS = 26;
const FORMAT_BITS_LEVEL_L_MASK_0 = Number.parseInt("111011111000100", 2);

const makeGfTables = () => {
  const exp = Array(512).fill(0);
  const log = Array(256).fill(0);
  let value = 1;

  for (let index = 0; index < 255; index += 1) {
    exp[index] = value;
    log[value] = index;
    value <<= 1;
    if (value & 0x100) value ^= 0x11d;
  }

  for (let index = 255; index < 512; index += 1) {
    exp[index] = exp[index - 255];
  }

  return { exp, log };
};

const { exp: GF_EXP, log: GF_LOG } = makeGfTables();

const gfMultiply = (left, right) => {
  if (!left || !right) return 0;
  return GF_EXP[GF_LOG[left] + GF_LOG[right]];
};

const appendBits = (bits, value, length) => {
  for (let index = length - 1; index >= 0; index -= 1) {
    bits.push((value >>> index) & 1);
  }
};

const makeGenerator = (degree) => {
  let result = [1];

  for (let index = 0; index < degree; index += 1) {
    const next = Array(result.length + 1).fill(0);
    result.forEach((coefficient, coefficientIndex) => {
      next[coefficientIndex] ^= coefficient;
      next[coefficientIndex + 1] ^= gfMultiply(coefficient, GF_EXP[index]);
    });
    result = next;
  }

  return result;
};

const computeEcc = (dataCodewords) => {
  const generator = makeGenerator(ECC_CODEWORDS);
  const remainder = Array(ECC_CODEWORDS).fill(0);

  dataCodewords.forEach((codeword) => {
    const factor = codeword ^ remainder.shift();
    remainder.push(0);
    generator.slice(1).forEach((coefficient, index) => {
      remainder[index] ^= gfMultiply(coefficient, factor);
    });
  });

  return remainder;
};

const encodeData = (value) => {
  const bytes = Array.from(new TextEncoder().encode(value));

  if (bytes.length > 106) {
    throw new Error("Adresa este prea lunga pentru QR-ul local.");
  }

  const bits = [];
  appendBits(bits, 0x4, 4);
  appendBits(bits, bytes.length, 8);
  bytes.forEach((byte) => appendBits(bits, byte, 8));

  const capacityBits = DATA_CODEWORDS * 8;
  appendBits(bits, 0, Math.min(4, capacityBits - bits.length));
  while (bits.length % 8 !== 0) bits.push(0);

  const dataCodewords = [];
  for (let index = 0; index < bits.length; index += 8) {
    dataCodewords.push(Number.parseInt(bits.slice(index, index + 8).join(""), 2));
  }

  const pads = [0xec, 0x11];
  let padIndex = 0;
  while (dataCodewords.length < DATA_CODEWORDS) {
    dataCodewords.push(pads[padIndex % pads.length]);
    padIndex += 1;
  }

  return [...dataCodewords, ...computeEcc(dataCodewords)];
};

const createGrid = () => ({
  modules: Array.from({ length: SIZE }, () => Array(SIZE).fill(false)),
  reserved: Array.from({ length: SIZE }, () => Array(SIZE).fill(false)),
});

const setModule = (grid, x, y, dark, reserve = true) => {
  if (x < 0 || y < 0 || x >= SIZE || y >= SIZE) return;
  grid.modules[y][x] = Boolean(dark);
  if (reserve) grid.reserved[y][x] = true;
};

const drawFinder = (grid, x, y) => {
  for (let dy = -1; dy <= 7; dy += 1) {
    for (let dx = -1; dx <= 7; dx += 1) {
      const xx = x + dx;
      const yy = y + dy;
      const inPattern = dx >= 0 && dx <= 6 && dy >= 0 && dy <= 6;
      const dark =
        inPattern &&
        (dx === 0 ||
          dx === 6 ||
          dy === 0 ||
          dy === 6 ||
          (dx >= 2 && dx <= 4 && dy >= 2 && dy <= 4));
      setModule(grid, xx, yy, dark);
    }
  }
};

const drawAlignment = (grid, centerX, centerY) => {
  for (let dy = -2; dy <= 2; dy += 1) {
    for (let dx = -2; dx <= 2; dx += 1) {
      const distance = Math.max(Math.abs(dx), Math.abs(dy));
      setModule(grid, centerX + dx, centerY + dy, distance !== 1);
    }
  }
};

const drawFunctionPatterns = (grid) => {
  drawFinder(grid, 0, 0);
  drawFinder(grid, SIZE - 7, 0);
  drawFinder(grid, 0, SIZE - 7);
  drawAlignment(grid, 30, 30);

  for (let index = 8; index < SIZE - 8; index += 1) {
    setModule(grid, index, 6, index % 2 === 0);
    setModule(grid, 6, index, index % 2 === 0);
  }
};

const getBit = (value, index) => ((value >>> index) & 1) !== 0;

const drawFormatBits = (grid) => {
  for (let index = 0; index <= 5; index += 1) {
    setModule(grid, 8, index, getBit(FORMAT_BITS_LEVEL_L_MASK_0, index));
  }
  setModule(grid, 8, 7, getBit(FORMAT_BITS_LEVEL_L_MASK_0, 6));
  setModule(grid, 8, 8, getBit(FORMAT_BITS_LEVEL_L_MASK_0, 7));
  setModule(grid, 7, 8, getBit(FORMAT_BITS_LEVEL_L_MASK_0, 8));
  for (let index = 9; index < 15; index += 1) {
    setModule(grid, 14 - index, 8, getBit(FORMAT_BITS_LEVEL_L_MASK_0, index));
  }

  for (let index = 0; index < 8; index += 1) {
    setModule(grid, SIZE - 1 - index, 8, getBit(FORMAT_BITS_LEVEL_L_MASK_0, index));
  }
  for (let index = 8; index < 15; index += 1) {
    setModule(grid, 8, SIZE - 15 + index, getBit(FORMAT_BITS_LEVEL_L_MASK_0, index));
  }
  setModule(grid, 8, SIZE - 8, true);
};

const drawCodewords = (grid, codewords) => {
  const bits = [];
  codewords.forEach((codeword) => appendBits(bits, codeword, 8));

  let bitIndex = 0;
  let upward = true;

  for (let right = SIZE - 1; right >= 1; right -= 2) {
    if (right === 6) right -= 1;

    for (let vertical = 0; vertical < SIZE; vertical += 1) {
      const y = upward ? SIZE - 1 - vertical : vertical;
      for (let column = 0; column < 2; column += 1) {
        const x = right - column;
        if (grid.reserved[y][x]) continue;

        let dark = bitIndex < bits.length ? bits[bitIndex] === 1 : false;
        if ((x + y) % 2 === 0) dark = !dark;
        setModule(grid, x, y, dark, false);
        bitIndex += 1;
      }
    }

    upward = !upward;
  }
};

export const createQrSvg = (value, options = {}) => {
  const border = options.border ?? 4;
  const scale = options.scale ?? 6;
  const grid = createGrid();

  drawFunctionPatterns(grid);
  drawFormatBits(grid);
  drawCodewords(grid, encodeData(value));

  const totalSize = (SIZE + border * 2) * scale;
  const rects = [];
  grid.modules.forEach((row, y) => {
    row.forEach((dark, x) => {
      if (!dark) return;
      rects.push(
        `<rect x="${(x + border) * scale}" y="${(y + border) * scale}" width="${scale}" height="${scale}" />`
      );
    });
  });

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${totalSize} ${totalSize}" width="${totalSize}" height="${totalSize}" role="img" aria-label="QR"><rect width="100%" height="100%" fill="#fff" /> <g fill="#10201a">${rects.join("")}</g></svg>`;
};
