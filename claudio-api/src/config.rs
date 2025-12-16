use std::env;
use std::net::{IpAddr, SocketAddr};
use std::sync::OnceLock;

static CONFIG: OnceLock<Config> = OnceLock::new();

#[derive(Debug, Clone)]
pub struct Config {
    pub server: ServerConfig,
    pub logging: LoggingConfig,
    pub storage: StorageConfig,
    pub defaults: DefaultsConfig,
    pub slack: Option<SlackConfig>,
    pub semantic_search: SemanticSearchConfig,
}

#[derive(Debug, Clone)]
pub struct ServerConfig {
    pub host: String,
    pub port: u16,
    pub base_url: String,
}

#[derive(Debug, Clone)]
pub struct LoggingConfig {
    pub level: String,
}

#[derive(Debug, Clone)]
pub struct StorageConfig {
    pub path: String,
}

#[derive(Debug, Clone)]
pub struct DefaultsConfig {
    pub model: Option<String>,
    pub timeout: u32,
    pub disallowed_tools: Vec<String>,
    pub isolated_dir: String,
    pub timezone: String,
}

#[derive(Debug, Clone)]
pub struct SlackConfig {
    pub app_token: String,
    pub bot_token: String,
    pub bot_user_ids: Vec<String>,
    pub webhooks: SlackWebhooks,
}

#[derive(Debug, Clone)]
pub struct SlackWebhooks {
    pub mention: Option<String>,
    pub message: Option<String>,
    pub reaction: Option<String>,
    pub feedback: Option<String>,
}

#[derive(Debug, Clone)]
pub struct SemanticSearchConfig {
    pub enabled: bool,
    pub min_score: f64,
    pub top_k: u32,
}

impl Config {
    pub fn load() -> Self {
        let _ = dotenvy::dotenv();

        let server = ServerConfig {
            host: env::var("CLAUDIO_HOST").unwrap_or_else(|_| "0.0.0.0".into()),
            port: env::var("CLAUDIO_PORT")
                .ok()
                .and_then(|v| v.parse().ok())
                .unwrap_or(17280),
            base_url: env::var("CLAUDIO_API_URL")
                .unwrap_or_else(|_| "http://localhost:17280".into()),
        };

        let logging = LoggingConfig {
            level: env::var("CLAUDIO_LOG_LEVEL").unwrap_or_else(|_| "info".into()),
        };

        let storage = StorageConfig {
            path: env::var("CLAUDIO_DB_PATH").unwrap_or_else(|_| "data/claudio.db".into()),
        };

        let defaults = DefaultsConfig {
            model: env::var("CLAUDIO_DEFAULT_MODEL").ok(),
            timeout: env::var("CLAUDIO_DEFAULT_TIMEOUT")
                .ok()
                .and_then(|v| v.parse().ok())
                .unwrap_or(300),
            disallowed_tools: env::var("CLAUDIO_DISALLOWED_TOOLS")
                .map(|v| v.split(',').map(|s| s.trim().to_string()).collect())
                .unwrap_or_else(|_| {
                    vec![
                        "Write".into(),
                        "Edit".into(),
                        "MultiEdit".into(),
                        "NotebookEdit".into(),
                    ]
                }),
            isolated_dir: env::var("CLAUDIO_ISOLATED_DIR")
                .unwrap_or_else(|_| "/tmp/claudio-isolated".into()),
            timezone: env::var("TZ").unwrap_or_else(|_| "UTC".into()),
        };

        let slack = Self::load_slack_config();

        let semantic_search = SemanticSearchConfig {
            enabled: env::var("SEMANTIC_SEARCH_ENABLED")
                .map(|v| v == "true" || v == "1")
                .unwrap_or(false),
            min_score: env::var("SEMANTIC_SEARCH_MIN_SCORE")
                .ok()
                .and_then(|v| v.parse().ok())
                .unwrap_or(0.5),
            top_k: env::var("SEMANTIC_SEARCH_TOP_K")
                .ok()
                .and_then(|v| v.parse().ok())
                .unwrap_or(5),
        };

        Self {
            server,
            logging,
            storage,
            defaults,
            slack,
            semantic_search,
        }
    }

    fn load_slack_config() -> Option<SlackConfig> {
        let app_token = env::var("SLACK_APP_TOKEN").ok().filter(|s| !s.is_empty())?;
        let bot_token = env::var("SLACK_BOT_TOKEN").ok().filter(|s| !s.is_empty())?;

        let bot_user_ids = env::var("SLACK_BOT_USER_IDS")
            .map(|v| {
                v.split(',')
                    .map(|s| s.trim().to_string())
                    .filter(|s| !s.is_empty())
                    .collect()
            })
            .unwrap_or_default();

        Some(SlackConfig {
            app_token,
            bot_token,
            bot_user_ids,
            webhooks: SlackWebhooks {
                mention: env::var("SLACK_WEBHOOK_MENTION")
                    .ok()
                    .filter(|s| !s.is_empty()),
                message: env::var("SLACK_WEBHOOK_MESSAGE")
                    .ok()
                    .filter(|s| !s.is_empty()),
                reaction: env::var("SLACK_WEBHOOK_REACTION")
                    .ok()
                    .filter(|s| !s.is_empty()),
                feedback: env::var("SLACK_WEBHOOK_FEEDBACK")
                    .ok()
                    .filter(|s| !s.is_empty()),
            },
        })
    }

    pub fn global() -> &'static Config {
        CONFIG.get_or_init(Self::load)
    }

    pub fn socket_addr(&self) -> SocketAddr {
        let ip: IpAddr = self
            .server
            .host
            .parse()
            .unwrap_or_else(|e| panic!("Invalid CLAUDIO_HOST '{}': {}", self.server.host, e));
        SocketAddr::new(ip, self.server.port)
    }
}
