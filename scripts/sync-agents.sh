#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Load .env
if [ -f "$PROJECT_ROOT/.env" ]; then
    while IFS='=' read -r key value; do
        [[ "$key" =~ ^#.*$ ]] && continue
        [[ -z "$key" ]] && continue
        export "$key=$value"
    done < "$PROJECT_ROOT/.env"
fi

# Resolve DB path
DB_PATH="${CLAUDIO_DB_PATH:-data/claudio.db}"
[[ "$DB_PATH" != /* ]] && DB_PATH="$PROJECT_ROOT/$DB_PATH"

if ! command -v ssearch &>/dev/null; then
    echo -e "${RED}Error: ssearch not found${NC}"
    exit 1
fi

if [ ! -f "$DB_PATH" ]; then
    echo -e "${RED}Error: Database not found at $DB_PATH${NC}"
    exit 1
fi

echo -e "${YELLOW}Syncing all agents${NC}"

echo -e "${GREEN}Deleting existing agent index...${NC}"
ssearch tags delete "type:agent-routing" -y 2>/dev/null || true

TEMP_FILE=$(mktemp)
trap "rm -f $TEMP_FILE" EXIT

echo -e "${GREEN}Extracting agent examples...${NC}"

TOTAL_AGENTS=0
TOTAL_EXAMPLES=0

sqlite3 -json "$DB_PATH" "
    SELECT a.id, a.name, a.project_id, a.examples
    FROM agents a
    WHERE a.priority >= 0
      AND json_array_length(a.examples) > 0
" | jq -c '.[]' | while read -r agent; do
    AGENT_ID=$(echo "$agent" | jq -r '.id')
    AGENT_NAME=$(echo "$agent" | jq -r '.name')
    PROJECT_ID=$(echo "$agent" | jq -r '.project_id')

    echo "$agent" | jq -c '
        .id as $agent_id |
        (.examples | fromjson) as $examples |
        range(0; $examples | length) as $i |
        { content: $examples[$i], url: "agent://\($agent_id)/\($i)" }
    ' > "$TEMP_FILE"

    COUNT=$(wc -l < "$TEMP_FILE" | tr -d ' ')
    if [ "$COUNT" -gt 0 ]; then
        echo -e "  ${PROJECT_ID}/${AGENT_NAME}: ${COUNT} examples"
        ssearch import "$TEMP_FILE" \
            --tags "source:claudio,type:agent-routing,agent:$AGENT_ID,project:$PROJECT_ID" \
            --source "claudio" 2>/dev/null
    fi
done

echo -e "${GREEN}Sync complete${NC}"

echo -e "\n${YELLOW}Summary:${NC}"
ssearch tags list --format json 2>/dev/null | \
    jq -r '.[] | select(.tag | startswith("project:")) | "  \(.tag): \(.count) examples"' || echo "  (no data)"
