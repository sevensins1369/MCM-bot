// utils/amountParser.js

/**
 * Parse an amount string like "100m", "1.5b", etc. into a BigInt value
 * @param {string} amountStr - The amount string to parse
 * @returns {Object} An object with either a value property (BigInt) or an error property (string)
 */
function parseAmount(amountStr) {
    if (!amountStr) {
        return { error: "No amount provided." };
    }
    
    // Remove commas and spaces
    amountStr = amountStr.replace(/,|\s/g, '');
    
    // Convert to lowercase for easier matching
    const lowerStr = amountStr.toLowerCase();
    
    // Check for valid format
    if (!/^[0-9]+(\.[0-9]+)?[kmb]?$/i.test(lowerStr)) {
        return { error: "Invalid amount format. Examples: 100, 1.5m, 2b" };
    }
    
    let multiplier = 1n;
    let valueStr = lowerStr;
    
    // Handle suffixes (k, m, b)
    if (lowerStr.endsWith('k')) {
        multiplier = 1000n;
        valueStr = lowerStr.slice(0, -1);
    } else if (lowerStr.endsWith('m')) {
        multiplier = 1000000n;
        valueStr = lowerStr.slice(0, -1);
    } else if (lowerStr.endsWith('b')) {
        multiplier = 1000000000n;
        valueStr = lowerStr.slice(0, -1);
    }
    
    try {
        // Handle decimal values
        if (valueStr.includes('.')) {
            const parts = valueStr.split('.');
            const whole = parts[0];
            let fraction = parts[1];
            
            // Limit fraction to 3 decimal places
            if (fraction.length > 3) {
                fraction = fraction.substring(0, 3);
            }
            
            // Pad with zeros if needed
            while (fraction.length < 3) {
                fraction += '0';
            }
            
            // Calculate value: whole * multiplier + fraction * multiplier / 1000
            const wholeValue = BigInt(whole) * multiplier;
            const fractionValue = (BigInt(fraction) * multiplier) / 1000n;
            
            return { value: wholeValue + fractionValue };
        } else {
            // Simple integer value
            return { value: BigInt(valueStr) * multiplier };
        }
    } catch (error) {
        return { error: "Failed to parse amount. Please use a valid number." };
    }
}

/**
 * Format a BigInt value to a human-readable string with k, m, b suffixes
 * @param {BigInt} value - The value to format
 * @returns {string} The formatted string
 */
function formatAmountString(value) {
    if (value === 0n) return "0";
    
    const billion = 1000000000n;
    const million = 1000000n;
    const thousand = 1000n;
    
    if (value >= billion) {
        const whole = value / billion;
        const remainder = value % billion;
        if (remainder === 0n) return `${whole}b`;
        
        const decimal = remainder * 1000n / billion;
        if (decimal % 10n === 0n) {
            return `${whole}.${decimal / 10n}b`;
        }
        return `${whole}.${decimal}b`;
    }
    
    if (value >= million) {
        const whole = value / million;
        const remainder = value % million;
        if (remainder === 0n) return `${whole}m`;
        
        const decimal = remainder * 1000n / million;
        if (decimal % 10n === 0n) {
            return `${whole}.${decimal / 10n}m`;
        }
        return `${whole}.${decimal}m`;
    }
    
    if (value >= thousand) {
        const whole = value / thousand;
        const remainder = value % thousand;
        if (remainder === 0n) return `${whole}k`;
        
        const decimal = remainder * 1000n / thousand;
        if (decimal % 10n === 0n) {
            return `${whole}.${decimal / 10n}k`;
        }
        return `${whole}.${decimal}k`;
    }
    
    return value.toString();
}

module.exports = {
    parseAmount,
    formatAmountString
};
