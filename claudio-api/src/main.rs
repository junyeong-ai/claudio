use anyhow::Result;
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

mod analytics;
mod api;
mod claude;
mod config;
mod plugins;
mod storage;
mod utils;

pub use config::Config;
pub use storage::Storage;

#[tokio::main]
async fn main() -> Result<()> {
    rustls::crypto::aws_lc_rs::default_provider()
        .install_default()
        .expect("Failed to install rustls crypto provider");

    let config = Config::load();

    tracing_subscriber::registry()
        .with(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| format!("claudio_api={}", config.logging.level).into()),
        )
        .with(tracing_subscriber::fmt::layer())
        .init();

    tracing::info!("Starting Claudio v{}", env!("CARGO_PKG_VERSION"));

    let storage = Storage::new(&config.storage.path)?;
    tracing::info!("Storage initialized at {}", config.storage.path);

    if config.semantic_search.enabled {
        sync_agents_on_startup(&storage);
    }

    let addr = config.socket_addr();
    let slack_config = config.slack.clone();

    let http_handle = tokio::spawn(async move {
        tracing::info!("HTTP API listening on http://{}", addr);

        let app = api::routes::create_router(storage);
        let listener = tokio::net::TcpListener::bind(&addr).await?;

        axum::serve(listener, api::routes::into_service(app))
            .with_graceful_shutdown(shutdown_signal())
            .await?;

        Ok::<_, anyhow::Error>(())
    });

    let slack_handle = slack_config.map(|cfg| {
        tracing::info!("Starting Slack Socket Mode bridge...");
        tokio::spawn(async move {
            let bridge = plugins::SlackBridge::new(cfg);
            if let Err(e) = bridge.run().await {
                tracing::error!("Slack bridge error: {}", e);
            }
        })
    });

    if let Err(e) = http_handle.await? {
        tracing::error!("HTTP server error: {}", e);
    }

    if let Some(handle) = slack_handle {
        handle.abort();
    }

    Ok(())
}

fn sync_agents_on_startup(storage: &Storage) {
    let projects = match storage.list_projects() {
        Ok(p) => p,
        Err(e) => {
            tracing::warn!("Failed to list projects for agent sync: {}", e);
            return;
        }
    };

    for project in projects {
        let agents = match storage.list_agents(&project.id) {
            Ok(a) => a,
            Err(e) => {
                tracing::warn!("Failed to list agents for {}: {}", project.id, e);
                continue;
            }
        };

        if let Err(e) = plugins::semantic::sync_agents(&project.id, &agents) {
            tracing::warn!("Failed to sync agents for {}: {}", project.id, e);
        }
    }
}

async fn shutdown_signal() {
    let ctrl_c = async {
        tokio::signal::ctrl_c()
            .await
            .expect("failed to install Ctrl+C handler");
    };

    #[cfg(unix)]
    let terminate = async {
        tokio::signal::unix::signal(tokio::signal::unix::SignalKind::terminate())
            .expect("failed to install signal handler")
            .recv()
            .await;
    };

    #[cfg(not(unix))]
    let terminate = std::future::pending::<()>();

    tokio::select! {
        _ = ctrl_c => {},
        _ = terminate => {},
    }

    tracing::info!("Shutdown signal received");
}
