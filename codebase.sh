#!/bin/bash

# --- Configuration ---
TARGET_DIR="src" # Now specifically targeting the src folder
OUTPUT_FILE="codebase_src_only.txt"
EXTENSIONS=("js" "ts" "jsx" "tsx" "py" "java" "cpp" "h" "css" "html" "md" "json" "yml" "yaml")
EXCLUDE_DIRS=(".git" "node_modules" "dist" "build" "__pycache__" ".next" "coverage")

# Check if src exists
if [ ! -d "$TARGET_DIR" ]; then
    echo "Error: Directory '$TARGET_DIR' not found."
    exit 1
fi

# --- Setup ---
echo "# Codebase Export: /$TARGET_DIR folder" > "$OUTPUT_FILE"
echo "Generated on: $(date)" >> "$OUTPUT_FILE"
echo "------------------------------------------------" >> "$OUTPUT_FILE"

# --- 1. Generate Tree Structure ---
echo "## Project Structure (/$TARGET_DIR)" >> "$OUTPUT_FILE"
echo '```' >> "$OUTPUT_FILE"

if command -v tree >/dev/null 2>&1; then
    # -I ignores the excluded dirs, targeting only TARGET_DIR
    tree "$TARGET_DIR" -I "$(echo "${EXCLUDE_DIRS[@]}" | sed 's/ /|/g')" >> "$OUTPUT_FILE"
else
    # Manual fallback for tree view
    find "$TARGET_DIR" -maxdepth 4 -not -path '*/.*' | sed -e "s/[^-][^\/]*\// |/g" -e "s/|\([^ ]\)/|-- \1/" >> "$OUTPUT_FILE"
fi

echo '```' >> "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"

# --- 2. Process Files ---
echo "## Project Files" >> "$OUTPUT_FILE"

# Construct extension filter
EXT_FILTER=""
for i in "${!EXTENSIONS[@]}"; do
    EXT_FILTER+="-name '*.${EXTENSIONS[$i]}'"
    if [ $i -lt $((${#EXTENSIONS[@]} - 1)) ]; then
        EXT_FILTER+=" -o "
    fi
done

# Build exclude string
EXCLUDE_STR=""
for dir in "${EXCLUDE_DIRS[@]}"; do
    EXCLUDE_STR+="-not -path '*/$dir/*' "
done

echo "Collecting files from $TARGET_DIR..."

# Search only inside the TARGET_DIR
eval "find $TARGET_DIR -type f \( $EXT_FILTER \) $EXCLUDE_STR" -print0 | while IFS= read -r -d '' file; do
    echo "Adding: $file"
    
    EXT="${file##*.}"
    
    echo "---" >> "$OUTPUT_FILE"
    echo "### File: $file" >> "$OUTPUT_FILE"
    echo "\`\`\`$EXT" >> "$OUTPUT_FILE"
    cat "$file" >> "$OUTPUT_FILE"
    echo "" >> "$OUTPUT_FILE"
    echo "\`\`\`" >> "$OUTPUT_FILE"
    echo "" >> "$OUTPUT_FILE"
done

# --- Final Stats ---
echo "------------------------------------------------"
echo "DONE!"
echo "Exported /$TARGET_DIR to: $OUTPUT_FILE"
echo "File Size: $(du -h "$OUTPUT_FILE" | cut -f1)"