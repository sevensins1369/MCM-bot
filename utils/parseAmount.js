// utils/parseAmount.js
function parseAmount(input) {
  if (typeof input !== "string") {
    throw new Error("Input must be a string");
  }

  input = input.trim();
  const match = /^(\d+(\.\d+)?)([kmb])?$/i.exec(input);
  if (!match) {
    throw new Error("Invalid amount format");
  }

  const num = parseFloat(match[1]);
  const suffix = match[3]?.toLowerCase();

  let multiplier;
  switch (suffix) {
    case 'k': multiplier = 1000n; break;
    case 'm': multiplier = 1000000n; break;
    case 'b': multiplier = 1000000000n; break;
    default: multiplier = 1n;
  }

  // Use BigInt for calculations to avoid precision loss
  // We multiply by 100 to handle decimals, then divide back down.
  const baseValue = BigInt(Math.floor(num * 100));
  const finalValue = (baseValue * multiplier) / 100n;
  
  return finalValue;
}

module.exports = parseAmount;

