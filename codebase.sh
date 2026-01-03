#!/bin/bash

# --- Configuration ---
TARGET_DIR="." 
OUTPUT_FILE="codebase_src_only.txt"
EXTENSIONS=("js" "ts" "jsx" "tsx" "py" "java" "cpp" "h" "css" "html" "md" "json" "yml" "yaml")
EXCLUDE_DIRS=(".git" "node_modules" "dist" "build" "__pycache__" ".next" "coverage")
# Added specific lock files to ignore
EXCLUDE_FILES=("package-lock.json" "pnpm-lock.yaml" "yarn.lock" "composer.lock")

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
    # Added -I for lock files in tree view as well
    tree "$TARGET_DIR" -I "$(echo "${EXCLUDE_DIRS[@]} ${EXCLUDE_FILES[@]}" | sed 's/ /|/g')" >> "$OUTPUT_FILE"
else
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

# Build directory exclude string
EXCLUDE_STR=""
for dir in "${EXCLUDE_DIRS[@]}"; do
    EXCLUDE_STR+="-not -path '*/$dir/*' "
done

# NEW: Build file exclude string
for file_to_ignore in "${EXCLUDE_FILES[@]}"; do
    EXCLUDE_STR+="-not -name '$file_to_ignore' "
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