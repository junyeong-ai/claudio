use dashmap::DashMap;
use governor::{
    Quota, RateLimiter,
    clock::DefaultClock,
    state::{InMemoryState, NotKeyed},
};
use std::num::NonZeroU32;
use std::sync::Arc;
use std::time::Instant;

type Limiter = RateLimiter<NotKeyed, InMemoryState, DefaultClock>;

const MAX_CACHE_SIZE: usize = 1000;

struct CachedLimiter {
    limiter: Arc<Limiter>,
    rpm: i32,
    last_used: Instant,
}

#[derive(Clone)]
pub struct RateLimitState {
    limiters: Arc<DashMap<String, CachedLimiter>>,
}

impl RateLimitState {
    pub fn new() -> Self {
        Self {
            limiters: Arc::new(DashMap::new()),
        }
    }

    pub fn check(&self, project_id: &str, rate_limit_rpm: i32) -> Result<(), RateLimitError> {
        if rate_limit_rpm <= 0 {
            return Ok(());
        }

        let limiter = self.get_or_create(project_id, rate_limit_rpm);
        limiter.check().map_err(|_| RateLimitError::TooManyRequests)
    }

    pub fn remove(&self, project_id: &str) {
        self.limiters.remove(project_id);
    }

    fn get_or_create(&self, project_id: &str, rate_limit_rpm: i32) -> Arc<Limiter> {
        let now = Instant::now();

        if let Some(mut cached) = self.limiters.get_mut(project_id)
            && cached.rpm == rate_limit_rpm
        {
            cached.last_used = now;
            return cached.limiter.clone();
        }

        self.enforce_cache_limit();

        let rpm = NonZeroU32::new(rate_limit_rpm as u32).unwrap_or(NonZeroU32::new(1).unwrap());
        let quota = Quota::per_minute(rpm);
        let limiter = Arc::new(RateLimiter::direct(quota));

        self.limiters.insert(
            project_id.to_string(),
            CachedLimiter {
                limiter: limiter.clone(),
                rpm: rate_limit_rpm,
                last_used: now,
            },
        );

        limiter
    }

    fn enforce_cache_limit(&self) {
        if self.limiters.len() <= MAX_CACHE_SIZE {
            return;
        }

        let oldest = self
            .limiters
            .iter()
            .min_by_key(|entry| entry.value().last_used)
            .map(|entry| entry.key().clone());

        if let Some(key) = oldest {
            self.limiters.remove(&key);
        }
    }
}

impl Default for RateLimitState {
    fn default() -> Self {
        Self::new()
    }
}

#[derive(Debug)]
pub enum RateLimitError {
    TooManyRequests,
}
