const fs = require('fs');
const path = require('path');

// Define the files to update
const filesToUpdate = [
  'commands/adminfixstats.js',
  'commands/resetduel.js',
  'enhanced-logger.js',
  'utils/DiceManager.js',
  'utils/JackpotManager.js',
  'utils/PlayerStatsManager.js',
  'utils/UserPreferencesManager.js',
  'utils/enhanced-logger.js',
  'utils/logger.js'
];

// Function to update file paths in a file
function updateFilePaths(filePath) {
  console.log(`Processing file: ${filePath}`);
  
  try {
    // Read the file content
    let content = fs.readFileSync(filePath, 'utf8');
    
    // Original content for comparison
    const originalContent = content;
    
    // Pattern to match path.join or path.resolve with __dirname and relative paths
    const pathJoinRegex = /(path\.(?:join|resolve))\(\s*(__dirname)\s*,\s*(?:"([^"]+)"|'([^']+)')/g;
    
    // Replace the matched patterns with updated paths
    content = content.replace(pathJoinRegex, (match, pathFunc, dirName, doubleQuotePath, singleQuotePath) => {
      const relativePath = doubleQuotePath || singleQuotePath;
      
      // Only modify paths that start with "../"
      if (relativePath && relativePath.startsWith("../")) {
        // Replace "../" with "/container/"
        const updatedPath = relativePath.replace(/^\.\.\//, "/container/");
        
        // Use the same quote style as the original
        const quote = doubleQuotePath ? '"' : "'";
        
        return `${pathFunc}(${dirName}, ${quote}${updatedPath}${quote}`;
      }
      
      // Return the original match if it doesn't start with "../"
      return match;
    });
    
    // Check if any changes were made
    if (content !== originalContent) {
      // Write the updated content back to the file
      fs.writeFileSync(filePath, content);
      console.log(`Updated file: ${filePath}`);
      return true;
    } else {
      console.log(`No changes needed for: ${filePath}`);
      return false;
    }
  } catch (error) {
    console.error(`Error processing file ${filePath}:`, error);
    return false;
  }
}

// Main function
function main() {
  console.log('Starting path update process...');
  
  // Get the repository root path from command line argument or use current directory
  const repoRoot = process.argv[2] || '.';
  console.log(`Using repository root: ${repoRoot}`);
  
  let updatedFiles = [];
  
  // Process each file in the list
  for (const file of filesToUpdate) {
    const filePath = path.join(repoRoot, file);
    try {
      const updated = updateFilePaths(filePath);
      if (updated) {
        updatedFiles.push(file);
      }
    } catch (error) {
      console.error(`Error processing ${file}:`, error);
    }
  }
  
  console.log('\nSummary:');
  console.log(`Updated ${updatedFiles.length} files:`);
  updatedFiles.forEach(file => console.log(`- ${file}`));
}

main();