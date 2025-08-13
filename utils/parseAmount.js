// utils/parseAmount.js
function parseAmount(input) {
  if (typeof input !== "string") {
    throw new Error("Input must be a string");
  }

  // Trim and remove commas and spaces
  input = input.trim().replace(/[,\s]/g, "");

  // Handle shorthand notations (k, m, b, t)
  let multiplier = 1;
  let numericPart = input;

  // Check for suffix (k, m, b, t) at the end of the string
  const lastChar = input.charAt(input.length - 1).toLowerCase();
  if (lastChar === "k" && /^\d+(\.\d+)?k$/i.test(input)) {
    multiplier = 1000;
    numericPart = input.slice(0, -1);
  } else if (lastChar === "m" && /^\d+(\.\d+)?m$/i.test(input)) {
    multiplier = 1000000;
    numericPart = input.slice(0, -1);
  } else if (lastChar === "b" && /^\d+(\.\d+)?b$/i.test(input)) {
    multiplier = 1000000000;
    numericPart = input.slice(0, -1);
  } else if (lastChar === "t" && /^\d+(\.\d+)?t$/i.test(input)) {
    multiplier = 1000000000000;
    numericPart = input.slice(0, -1);
  }

  // Original regex match for backward compatibility
  const match = /^(\d+(\.\d+)?)$/i.exec(numericPart);
  if (!match) {
    throw new Error("Invalid amount format");
  }

  const num = parseFloat(match[1]);

  // Handle decimal values
  if (numericPart.includes(".")) {
    // For decimal values, we need to be careful with precision
    const decimalPlaces = numericPart.split(".")[1].length;
    const factor = Math.pow(10, decimalPlaces);

    // Convert to integer, apply multiplier, then convert back
    const intValue = Math.floor(num * factor);
    return (BigInt(intValue) * BigInt(multiplier)) / BigInt(factor);
  } else {
    // For integer values, simple multiplication works
    return BigInt(numericPart) * BigInt(multiplier);
  }
}

module.exports = parseAmount;
