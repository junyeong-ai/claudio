#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
WORKFLOW_DIR="$PROJECT_ROOT/n8n-workflows"
CONFIG_FILE="$PROJECT_ROOT/.n8n-config.json"
N8N_URL="${N8N_URL:-http://localhost:5678}"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Workflow file names (source of truth)
WORKFLOW_FILES="slack-mention-handler.json slack-message-handler.json slack-reaction-handler.json slack-feedback-handler.json user-context-handler.json gitlab-mr-review.json"

# Load .env file
load_env() {
    if [ -f "$PROJECT_ROOT/.env" ]; then
        set -a
        source "$PROJECT_ROOT/.env"
        set +a
    fi
}

check_api_key() {
    load_env
    if [ -z "$N8N_API_KEY" ]; then
        echo -e "${RED}N8N_API_KEY not set. Export it or add to .env${NC}"
        exit 1
    fi
}

check_jq() {
    if ! command -v jq &>/dev/null; then
        echo -e "${RED}jq is required. Install with: brew install jq${NC}"
        exit 1
    fi
}

hash_content() {
    if command -v md5sum &>/dev/null; then
        md5sum | cut -d' ' -f1
    else
        md5
    fi
}

sed_inplace() {
    if [[ "$OSTYPE" == "darwin"* ]]; then
        sed -i '' "$@"
    else
        sed -i "$@"
    fi
}

# Get workflow ID from config by filename
get_workflow_id() {
    local file="$1"
    local name="${file%.json}"
    if [ -f "$CONFIG_FILE" ]; then
        jq -r ".workflows.\"$name\" // empty" "$CONFIG_FILE"
    fi
}

# Save workflow ID to config
save_workflow_id() {
    local file="$1"
    local id="$2"
    local name="${file%.json}"

    if [ ! -f "$CONFIG_FILE" ]; then
        echo '{"workflows":{},"credentials":{}}' > "$CONFIG_FILE"
    fi

    local tmp=$(mktemp)
    jq ".workflows.\"$name\" = \"$id\"" "$CONFIG_FILE" > "$tmp" && mv "$tmp" "$CONFIG_FILE"
}

# ============================================================================
# Credentials Management (config-file based)
# ============================================================================

# Show how to find credential IDs in n8n UI
show_credential_help() {
    echo -e "${GREEN}How to find credential IDs in n8n:${NC}"
    echo ""
    echo "  1. Open n8n UI: $N8N_URL"
    echo "  2. Go to Settings > Credentials"
    echo "  3. Click on a credential to edit it"
    echo "  4. Copy the ID from the URL: $N8N_URL/credentials/{ID}/edit"
    echo ""
    echo -e "${YELLOW}Required credentials:${NC}"
    echo "  - slackApi: Slack Bot OAuth token"
    echo "  - httpHeaderAuth: GitLab Private Token (optional)"
    echo "  - jiraSoftwareCloudApi: Jira API credentials (optional)"
}

# Show current credentials from config
list_credentials() {
    check_jq

    if [ -f "$CONFIG_FILE" ]; then
        echo -e "${GREEN}Credentials in .n8n-config.json:${NC}"
        local slack_id=$(jq -r '.credentials.slackApi.id // "not set"' "$CONFIG_FILE")
        local slack_name=$(jq -r '.credentials.slackApi.name // ""' "$CONFIG_FILE")
        local gitlab_id=$(jq -r '.credentials.httpHeaderAuth.id // "not set"' "$CONFIG_FILE")
        local gitlab_name=$(jq -r '.credentials.httpHeaderAuth.name // ""' "$CONFIG_FILE")
        local jira_id=$(jq -r '.credentials.jiraSoftwareCloudApi.id // "not set"' "$CONFIG_FILE")
        local jira_name=$(jq -r '.credentials.jiraSoftwareCloudApi.name // ""' "$CONFIG_FILE")

        echo "  slackApi: $slack_name ($slack_id)"
        echo "  httpHeaderAuth: $gitlab_name ($gitlab_id)"
        echo "  jiraSoftwareCloudApi: $jira_name ($jira_id)"
        echo ""
    else
        echo -e "${YELLOW}No .n8n-config.json found.${NC}"
        echo ""
    fi

    show_credential_help
}

# Get credential from config file
get_credential_from_config() {
    local cred_key="$1"
    if [ -f "$CONFIG_FILE" ]; then
        local id=$(jq -r ".credentials.$cred_key.id // empty" "$CONFIG_FILE")
        local name=$(jq -r ".credentials.$cred_key.name // empty" "$CONFIG_FILE")
        if [ -n "$id" ] && [ "$id" != "null" ]; then
            echo "$id|$name"
        fi
    fi
}

# ============================================================================
# Config Management
# ============================================================================

generate_config() {
    check_jq
    load_env

    local example_file="$PROJECT_ROOT/.n8n-config.example.json"

    # If config already exists, just show it
    if [ -f "$CONFIG_FILE" ]; then
        echo -e "${YELLOW}.n8n-config.json already exists.${NC}"
        echo ""
        show_config
        echo ""
        echo -e "To regenerate, delete the file first: rm $CONFIG_FILE"
        return
    fi

    # Create example config if it doesn't exist
    if [ ! -f "$example_file" ]; then
        cat > "$example_file" << 'EOF'
{
  "credentials": {
    "slackApi": {
      "id": "YOUR_SLACK_CREDENTIAL_ID",
      "name": "Slack account"
    },
    "httpHeaderAuth": {
      "id": "YOUR_GITLAB_CREDENTIAL_ID",
      "name": "Header Auth account"
    },
    "jiraSoftwareCloudApi": {
      "id": "YOUR_JIRA_CREDENTIAL_ID",
      "name": "Jira SW Cloud account"
    }
  },
  "workflows": {},
  "project": "default",
  "incidentChannels": "",
  "servicePrefix": "",
  "gitlab": {
    "host": "gitlab.example.com",
    "project": "team/repo"
  },
  "jira": {
    "host": "your-domain.atlassian.net"
  }
}
EOF
        echo -e "${GREEN}Created example config: .n8n-config.example.json${NC}"
    fi

    # Copy example to config
    cp "$example_file" "$CONFIG_FILE"

    # Set project from env if available
    local project="${CLAUDIO_DEFAULT_PROJECT:-default}"
    local tmp=$(mktemp)
    jq --arg project "$project" '.project = $project' "$CONFIG_FILE" > "$tmp" && mv "$tmp" "$CONFIG_FILE"

    echo -e "${GREEN}Created .n8n-config.json from example.${NC}"
    echo ""
    echo -e "${YELLOW}Next steps:${NC}"
    echo "  1. Open $CONFIG_FILE"
    echo "  2. Update credential IDs from n8n UI (see: $0 credentials)"
    echo "  3. Configure project-specific values (gitlab, jira, etc.)"
    echo "  4. Run: $0 push"
}

show_config() {
    if [ -f "$CONFIG_FILE" ]; then
        echo -e "${GREEN}Current config:${NC}"
        jq '.' "$CONFIG_FILE"
    else
        echo -e "${YELLOW}No config file. Run: $0 init${NC}"
    fi
}

# ============================================================================
# Workflow Operations
# ============================================================================

list_workflows() {
    check_api_key
    echo -e "${GREEN}n8n Workflows:${NC}"
    curl -s -H "X-N8N-API-KEY: $N8N_API_KEY" "$N8N_URL/api/v1/workflows" | \
        jq -r '.data[] | "  \(if .active then "●" else "○" end) \(.name) (\(.id))"'
}

# Inject credentials and project into workflow JSON (returns temp file path)
inject_config() {
    local file="$1"
    local filepath="$WORKFLOW_DIR/$file"

    if [ ! -f "$CONFIG_FILE" ]; then
        echo ""
        return 1
    fi

    # Read credentials from config (use placeholder if not set)
    local slack_id=$(jq -r '.credentials.slackApi.id // "__SLACK_CREDENTIAL_ID__"' "$CONFIG_FILE")
    local slack_name=$(jq -r '.credentials.slackApi.name // "__SLACK_CREDENTIAL_NAME__"' "$CONFIG_FILE")
    local gitlab_id=$(jq -r '.credentials.httpHeaderAuth.id // "__GITLAB_CREDENTIAL_ID__"' "$CONFIG_FILE")
    local gitlab_name=$(jq -r '.credentials.httpHeaderAuth.name // "__GITLAB_CREDENTIAL_NAME__"' "$CONFIG_FILE")
    local jira_id=$(jq -r '.credentials.jiraSoftwareCloudApi.id // "__JIRA_CREDENTIAL_ID__"' "$CONFIG_FILE")
    local jira_name=$(jq -r '.credentials.jiraSoftwareCloudApi.name // "__JIRA_CREDENTIAL_NAME__"' "$CONFIG_FILE")
    local project=$(jq -r '.project // "default"' "$CONFIG_FILE")

    # Read additional config values
    local incident_channels=$(jq -r '.incidentChannels // ""' "$CONFIG_FILE")
    local service_prefix=$(jq -r '.servicePrefix // ""' "$CONFIG_FILE")
    local gitlab_host=$(jq -r '.gitlab.host // "__GITLAB_HOST__"' "$CONFIG_FILE")
    local gitlab_project=$(jq -r '.gitlab.project // "__GITLAB_PROJECT__"' "$CONFIG_FILE")
    local jira_host=$(jq -r '.jira.host // "__JIRA_HOST__"' "$CONFIG_FILE")
    local mr_review_channel=$(jq -r '.mrReviewChannel // ""' "$CONFIG_FILE")
    local system_project=$(jq -r '.systemProject // "system"' "$CONFIG_FILE")

    # Create temp file with injected values (don't modify original)
    local tmp=$(mktemp)

    # First pass: inject credentials using jq
    jq --arg slack_id "$slack_id" --arg slack_name "$slack_name" \
       --arg gitlab_id "$gitlab_id" --arg gitlab_name "$gitlab_name" \
       --arg jira_id "$jira_id" --arg jira_name "$jira_name" \
       --arg project "$project" '
        # Inject Slack credentials
        (.nodes[] | select(.credentials.slackApi) | .credentials.slackApi) |= {id: $slack_id, name: $slack_name} |
        # Inject GitLab (Header Auth) credentials
        (.nodes[] | select(.credentials.httpHeaderAuth) | .credentials.httpHeaderAuth) |= {id: $gitlab_id, name: $gitlab_name} |
        # Inject Jira credentials
        (.nodes[] | select(.credentials.jiraSoftwareCloudApi) | .credentials.jiraSoftwareCloudApi) |= {id: $jira_id, name: $jira_name} |
        # Inject project in Parse node jsCode
        (.nodes[] | select(.name == "Parse") | .parameters.jsCode) |= gsub("project: '"'"'[^'"'"']+'"'"'"; "project: '"'"'" + $project + "'"'"'")
    ' "$filepath" > "$tmp"

    # Second pass: replace remaining placeholders with sed
    sed_inplace "s|__INCIDENT_CHANNELS__|$incident_channels|g" "$tmp"
    sed_inplace "s|__SERVICE_PREFIX__|$service_prefix|g" "$tmp"
    sed_inplace "s|__GITLAB_HOST__|$gitlab_host|g" "$tmp"
    sed_inplace "s|__GITLAB_PROJECT__|$gitlab_project|g" "$tmp"
    sed_inplace "s|__JIRA_HOST__|$jira_host|g" "$tmp"
    sed_inplace "s|__CLAUDIO_PROJECT__|$project|g" "$tmp"
    sed_inplace "s|__SYSTEM_PROJECT__|$system_project|g" "$tmp"
    sed_inplace "s|__MR_REVIEW_CHANNEL__|$mr_review_channel|g" "$tmp"

    if [ -s "$tmp" ]; then
        echo "$tmp"
        return 0
    else
        rm -f "$tmp"
        echo ""
        return 1
    fi
}

pull_workflows() {
    check_api_key
    check_jq
    echo -e "${GREEN}Pulling workflows from n8n...${NC}"

    # Get all workflows and match by name
    local all_workflows=$(curl -s -H "X-N8N-API-KEY: $N8N_API_KEY" "$N8N_URL/api/v1/workflows")

    for file in $WORKFLOW_FILES; do
        local name="${file%.json}"
        local display_name=$(echo "$name" | sed 's/-/ /g' | sed 's/\b\(.\)/\u\1/g')  # kebab-case to Title Case

        # Try to find workflow by similar name
        local id=$(echo "$all_workflows" | jq -r ".data[] | select(.name | ascii_downcase | gsub(\" \"; \"-\") == \"$name\") | .id" | head -1)

        # Also try stored ID from config
        if [ -z "$id" ]; then
            id=$(get_workflow_id "$file")
        fi

        if [ -n "$id" ]; then
            echo -n "  $file ($id)... "
            curl -s -H "X-N8N-API-KEY: $N8N_API_KEY" "$N8N_URL/api/v1/workflows/$id" | \
                jq '{name, nodes, connections, settings}' > "$WORKFLOW_DIR/$file"
            save_workflow_id "$file" "$id"
            echo "done"
        else
            echo -e "  $file... ${YELLOW}not found${NC}"
        fi
    done
    echo -e "${GREEN}Pull complete${NC}"
}

push_workflows() {
    check_api_key
    check_jq

    local create_new="${1:-false}"

    echo -e "${GREEN}Pushing workflows to n8n...${NC}"
    for file in $WORKFLOW_FILES; do
        if [ -f "$WORKFLOW_DIR/$file" ]; then
            local id=$(get_workflow_id "$file")
            echo -n "  $file"

            # Inject config into temp file (original stays unchanged)
            local upload_file="$WORKFLOW_DIR/$file"
            if [ -f "$CONFIG_FILE" ]; then
                local tmp=$(inject_config "$file")
                if [ -n "$tmp" ]; then
                    upload_file="$tmp"
                fi
            fi

            if [ -n "$id" ]; then
                # Update existing workflow
                echo -n " ($id)... "
                local result=$(curl -s -X PUT \
                    -H "X-N8N-API-KEY: $N8N_API_KEY" \
                    -H "Content-Type: application/json" \
                    -d @"$upload_file" \
                    "$N8N_URL/api/v1/workflows/$id")
                echo "$(echo "$result" | jq -r '.updatedAt // "failed"')"
            elif [ "$create_new" = "true" ]; then
                # Create new workflow (only with --create flag)
                echo -n " (new)... "
                local result=$(curl -s -X POST \
                    -H "X-N8N-API-KEY: $N8N_API_KEY" \
                    -H "Content-Type: application/json" \
                    -d @"$upload_file" \
                    "$N8N_URL/api/v1/workflows")
                local new_id=$(echo "$result" | jq -r '.id // empty')
                if [ -n "$new_id" ]; then
                    save_workflow_id "$file" "$new_id"
                    echo "created ($new_id)"
                else
                    echo "failed: $(echo "$result" | jq -r '.message // "Unknown error"')"
                fi
            else
                echo -e "... ${YELLOW}skipped (no ID in config, use 'init' or 'push --create')${NC}"
            fi

            # Cleanup temp file
            if [ "$upload_file" != "$WORKFLOW_DIR/$file" ] && [ -f "$upload_file" ]; then
                rm -f "$upload_file"
            fi
        fi
    done
    echo -e "${GREEN}Push complete${NC}"
}

compare_workflows() {
    check_api_key
    check_jq
    echo -e "${GREEN}Comparing workflows...${NC}"
    local has_diff=0

    for file in $WORKFLOW_FILES; do
        local id=$(get_workflow_id "$file")
        echo -n "  $file: "

        if [ -z "$id" ]; then
            echo -e "${YELLOW}no ID in config${NC}"
            has_diff=1
            continue
        fi

        if [ ! -f "$WORKFLOW_DIR/$file" ]; then
            echo -e "${YELLOW}local file missing${NC}"
            has_diff=1
            continue
        fi

        local local_hash=$(jq -cS '{nodes: [.nodes[] | {name, type}], connections}' "$WORKFLOW_DIR/$file" 2>/dev/null | hash_content)
        local server_hash=$(curl -s -H "X-N8N-API-KEY: $N8N_API_KEY" "$N8N_URL/api/v1/workflows/$id" | \
            jq -cS '{nodes: [.nodes[] | {name, type}], connections}' | hash_content)

        if [ "$local_hash" = "$server_hash" ]; then
            echo -e "${GREEN}match${NC}"
        else
            echo -e "${RED}differs${NC}"
            has_diff=1
        fi
    done
    return $has_diff
}

replace_urls() {
    echo -e "${GREEN}Replacing hardcoded URLs with env vars...${NC}"
    for f in "$WORKFLOW_DIR"/*.json; do
        sed_inplace 's|http://host.docker.internal:17280|{{ $env.N8N_API_URL }}|g' "$f"
        sed_inplace 's|http://host.docker.internal:5678|{{ $env.N8N_WEBHOOK_URL }}|g' "$f"
    done
    echo -e "${GREEN}Done${NC}"
}

# ============================================================================
# Init Command - Full Setup
# ============================================================================

init_setup() {
    check_api_key
    check_jq
    load_env

    echo -e "${BLUE}=== Claudio n8n Workflow Setup ===${NC}"
    echo ""

    # Step 1: Check/create config
    echo -e "${BLUE}[1/3] Checking configuration...${NC}"
    if [ ! -f "$CONFIG_FILE" ]; then
        generate_config
        echo ""
        echo -e "${YELLOW}Please edit .n8n-config.json with your credential IDs, then run 'init' again.${NC}"
        return 1
    fi

    # Validate config has credential IDs
    local slack_id=$(jq -r '.credentials.slackApi.id // ""' "$CONFIG_FILE")
    if [ -z "$slack_id" ] || [ "$slack_id" = "YOUR_SLACK_CREDENTIAL_ID" ]; then
        echo -e "${RED}Error: Please update credential IDs in .n8n-config.json${NC}"
        echo ""
        show_credential_help
        return 1
    fi
    echo -e "${GREEN}✓ Config file found${NC}"
    echo ""

    # Step 2: Envify URLs
    echo -e "${BLUE}[2/3] Converting URLs to environment variables...${NC}"
    replace_urls
    echo ""

    # Step 3: Push workflows (injection happens automatically)
    echo -e "${BLUE}[3/3] Pushing workflows to n8n...${NC}"
    push_workflows "true"
    echo ""

    echo -e "${GREEN}=== Setup Complete ===${NC}"
    echo ""
    echo "Next steps:"
    echo "  1. Activate workflows in n8n UI: $N8N_URL"
    echo "  2. Set environment variables in n8n (Settings > Variables):"
    echo "     - N8N_API_URL: ${CLAUDIO_API_URL:-http://host.docker.internal:17280}"
    echo "     - N8N_WEBHOOK_URL: ${N8N_WEBHOOK_URL:-http://host.docker.internal:5678}"
    echo "     - N8N_DASHBOARD_URL: (Dashboard URL for Slack user lookups)"
}

# ============================================================================
# Help
# ============================================================================

show_help() {
    echo "Usage: $0 <command>"
    echo ""
    echo "Commands:"
    echo "  ${GREEN}init${NC}              Full setup: validate config, push workflows"
    echo "  ${GREEN}config${NC}            Show .n8n-config.json"
    echo "  ${GREEN}config generate${NC}   Create .n8n-config.json from example"
    echo "  ${GREEN}credentials${NC}       Show credentials and how to find IDs in n8n UI"
    echo ""
    echo "  ${GREEN}list${NC}              List workflows in n8n"
    echo "  ${GREEN}pull${NC}              Pull workflows from n8n to local files"
    echo "  ${GREEN}push${NC}              Push local workflows to n8n (update only)"
    echo "  ${GREEN}push --create${NC}     Push and create new workflows if ID not in config"
    echo "  ${GREEN}compare${NC}           Compare local vs n8n workflows"
    echo ""
    echo "  ${GREEN}envify${NC}            Replace hardcoded URLs with \$env variables"
    echo ""
    echo "Environment:"
    echo "  N8N_URL          n8n server URL (default: http://localhost:5678)"
    echo "  N8N_API_KEY      n8n API key (required for push/pull)"
    echo "  CLAUDIO_DEFAULT_PROJECT  Default project name (default: 'default')"
    echo ""
    echo "Setup Flow:"
    echo "  1. Create credentials in n8n UI"
    echo "  2. Run '$0 config generate' to create .n8n-config.json"
    echo "  3. Edit .n8n-config.json with credential IDs (see '$0 credentials')"
    echo "  4. Run '$0 init' to push workflows"
}

# ============================================================================
# Main
# ============================================================================

case "${1:-help}" in
    init)        init_setup ;;
    config)
        if [ "$2" = "generate" ]; then
            generate_config
        else
            show_config
        fi
        ;;
    credentials) list_credentials ;;
    list)        list_workflows ;;
    pull)        pull_workflows ;;
    push)
        if [ "$2" = "--create" ]; then
            push_workflows "true"
        else
            push_workflows "false"
        fi
        ;;
    compare)     compare_workflows ;;
    envify)      replace_urls ;;
    help|--help|-h) show_help ;;
    *)           echo "Unknown command: $1"; show_help; exit 1 ;;
esac
