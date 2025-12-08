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

PROJECT_ID="${1:-${CLAUDIO_DEFAULT_PROJECT:-default}}"

if ! command -v ssearch &>/dev/null; then
    echo -e "${RED}Error: ssearch not found${NC}"
    exit 1
fi

if [ ! -f "$DB_PATH" ]; then
    echo -e "${RED}Error: Database not found at $DB_PATH${NC}"
    exit 1
fi

echo -e "${YELLOW}Syncing agents for project: $PROJECT_ID${NC}"

echo -e "${GREEN}Deleting existing index...${NC}"
ssearch tags delete "project:$PROJECT_ID" -y 2>/dev/null || true

TEMP_FILE=$(mktemp)
trap "rm -f $TEMP_FILE" EXIT

echo -e "${GREEN}Extracting agent examples...${NC}"

sqlite3 -json "$DB_PATH" "
    SELECT id, name, examples
    FROM agents
    WHERE project_id = '$PROJECT_ID'
      AND priority >= 0
      AND json_array_length(examples) > 0
" | jq -c '.[]' | while read -r agent; do
    AGENT_ID=$(echo "$agent" | jq -r '.id')
    AGENT_NAME=$(echo "$agent" | jq -r '.name')

    echo "$agent" | jq -c '
        .id as $agent_id |
        (.examples | fromjson) as $examples |
        range(0; $examples | length) as $i |
        { content: $examples[$i], url: "agent://\($agent_id)/\($i)" }
    ' > "$TEMP_FILE"

    COUNT=$(wc -l < "$TEMP_FILE" | tr -d ' ')
    if [ "$COUNT" -gt 0 ]; then
        echo -e "  ${AGENT_NAME}: ${COUNT} examples"
        ssearch import "$TEMP_FILE" \
            --tags "type:agent-routing,agent:$AGENT_ID,project:$PROJECT_ID" \
            --source "claudio" 2>/dev/null
    fi
done

echo -e "${GREEN}Sync complete${NC}"

echo -e "\n${YELLOW}Verification:${NC}"
ssearch search "test" --tags "type:agent-routing,project:$PROJECT_ID" --format json --limit 3 2>/dev/null | \
    jq -r '.results[]? | "  \(.tags | map(select(.key=="agent")) | .[0].value): \(.content[:50])..."' || echo "  (no results)"
