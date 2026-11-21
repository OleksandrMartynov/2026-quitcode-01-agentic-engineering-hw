/** Chess-style cell name: column letter + row number, e.g. index 5 on 3x3 → "C2". */
export const cellName = (index: number, size: number): string =>
  `${String.fromCharCode(65 + (index % size))}${Math.floor(index / size) + 1}`;
