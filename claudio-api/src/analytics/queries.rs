use anyhow::Result;
use chrono::{TimeZone, Utc};
use rusqlite::{Connection, params};

use super::query_builder::QueryBuilder;
use super::types::*;
use crate::storage::feedback_sql;

pub fn get_overview_stats(
    conn: &Connection,
    period: Period,
    project: Option<&str>,
    source: Option<&str>,
) -> Result<OverviewStats> {
    let now = Utc::now().timestamp();
    let (period_start, period_end) = calculate_period_bounds(now, period);
    let (prev_start, prev_end) = calculate_previous_period_bounds(period_start, period_end);

    let current = query_period_stats(conn, period_start, period_end, project, source)?;
    let previous = query_period_stats(conn, prev_start, prev_end, project, source)?;
    let percentiles = query_duration_percentiles(conn, period_start, period_end, project, source)?;
    let pending_feedback = query_pending_feedback(conn, period_start, period_end, project, source)?;

    let summary = SummaryStats {
        total_requests: current.total_requests,
        successful_requests: current.successful_requests,
        failed_requests: current.total_requests - current.successful_requests,
        success_rate: safe_percentage(current.successful_requests, current.total_requests),
        total_cost_usd: current.total_cost_usd,
        total_input_tokens: current.total_input_tokens,
        total_output_tokens: current.total_output_tokens,
        cache_read_tokens: current.cache_read_tokens,
        cache_hit_rate: safe_percentage(
            current.cache_read_tokens,
            current.cache_read_tokens + current.cache_creation_tokens,
        ),
        avg_duration_ms: current.avg_duration_ms,
        p50_duration_ms: percentiles.p50,
        p90_duration_ms: percentiles.p90,
        p95_duration_ms: percentiles.p95,
        p99_duration_ms: percentiles.p99,
    };

    let total_feedback = current.positive_feedback + current.negative_feedback;
    let feedback = FeedbackSummary {
        total_with_feedback: total_feedback,
        positive: current.positive_feedback,
        negative: current.negative_feedback,
        satisfaction_rate: if total_feedback > 0 {
            Some(current.positive_feedback as f64 / total_feedback as f64 * 100.0)
        } else {
            None
        },
        pending_feedback,
    };

    Ok(OverviewStats {
        period: period.to_string(),
        period_start: format_timestamp(period_start),
        period_end: format_timestamp(period_end),
        summary,
        feedback,
        comparison: calculate_comparison(&current, &previous),
    })
}

pub fn get_timeseries(
    conn: &Connection,
    granularity: Granularity,
    from: i64,
    to: i64,
    project: Option<&str>,
    source: Option<&str>,
    model: Option<&str>,
) -> Result<TimeSeriesResponse> {
    let actual_granularity = match granularity {
        Granularity::Auto => Granularity::from_range(to - from),
        g => g,
    };

    let bucket_seconds = match actual_granularity {
        Granularity::Hour | Granularity::Auto => 3600,
        Granularity::Day => 86400,
        Granularity::Week => 604800,
    };

    Ok(TimeSeriesResponse {
        granularity: actual_granularity.as_str().to_string(),
        from: format_timestamp(from),
        to: format_timestamp(to),
        data: query_timeseries_data(conn, from, to, bucket_seconds, project, source, model)?,
    })
}

pub fn get_model_stats(
    conn: &Connection,
    period: Period,
    project: Option<&str>,
    source: Option<&str>,
) -> Result<ModelsResponse> {
    let now = Utc::now().timestamp();
    let (period_start, _) = calculate_period_bounds(now, period);

    Ok(ModelsResponse {
        period: period.to_string(),
        models: query_model_breakdown(conn, period_start, project, source)?,
    })
}

pub fn get_error_stats(
    conn: &Connection,
    period: Period,
    project: Option<&str>,
    source: Option<&str>,
) -> Result<ErrorsResponse> {
    let now = Utc::now().timestamp();
    let (period_start, _) = calculate_period_bounds(now, period);
    let (total_requests, total_errors, errors) =
        query_error_breakdown(conn, period_start, project, source)?;

    Ok(ErrorsResponse {
        period: period.to_string(),
        total_errors,
        error_rate: safe_percentage(total_errors, total_requests),
        errors,
    })
}

pub fn get_source_stats(
    conn: &Connection,
    period: Period,
    project: Option<&str>,
) -> Result<SourcesResponse> {
    let now = Utc::now().timestamp();
    let (period_start, _) = calculate_period_bounds(now, period);

    Ok(SourcesResponse {
        period: period.to_string(),
        sources: query_source_breakdown(conn, period_start, project)?,
    })
}

pub fn get_requester_stats(
    conn: &Connection,
    period: Period,
    project: Option<&str>,
    source: Option<&str>,
    limit: i64,
) -> Result<RequestersResponse> {
    let now = Utc::now().timestamp();
    let (period_start, _) = calculate_period_bounds(now, period);

    Ok(RequestersResponse {
        period: period.to_string(),
        requesters: query_requester_breakdown(conn, period_start, project, source, limit)?,
    })
}

pub fn get_workflow_stats(conn: &Connection, period: Period) -> Result<WorkflowsResponse> {
    let now = Utc::now().timestamp();
    let (period_start, _) = calculate_period_bounds(now, period);

    Ok(WorkflowsResponse {
        period: period.to_string(),
        workflows: query_workflow_stats(conn, period_start)?,
    })
}

pub fn record_workflow_execution(
    conn: &Connection,
    req: &RecordWorkflowRequest,
) -> Result<RecordWorkflowResponse> {
    let now = Utc::now();
    conn.execute(
        "INSERT INTO workflow_executions (workflow_name, execution_id, status, duration_ms, metadata, created_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
        params![
            req.workflow,
            req.execution_id,
            req.status.as_str(),
            req.duration_ms,
            req.metadata.as_ref().map(|m| m.to_string()),
            now.timestamp(),
        ],
    )?;

    Ok(RecordWorkflowResponse {
        id: conn.last_insert_rowid(),
        recorded_at: now.to_rfc3339(),
    })
}

fn calculate_period_bounds(now: i64, period: Period) -> (i64, i64) {
    match period.seconds() {
        Some(secs) => (now - secs, now),
        None => (0, now),
    }
}

fn calculate_previous_period_bounds(start: i64, end: i64) -> (i64, i64) {
    let duration = end - start;
    (start - duration, start)
}

fn format_timestamp(ts: i64) -> String {
    Utc.timestamp_opt(ts, 0)
        .single()
        .map(|dt| dt.to_rfc3339())
        .unwrap_or_default()
}

fn safe_percentage(part: i64, total: i64) -> f64 {
    if total > 0 {
        part as f64 / total as f64 * 100.0
    } else {
        0.0
    }
}

#[derive(Debug, Default)]
struct PeriodStats {
    total_requests: i64,
    successful_requests: i64,
    total_cost_usd: f64,
    total_input_tokens: i64,
    total_output_tokens: i64,
    cache_read_tokens: i64,
    cache_creation_tokens: i64,
    avg_duration_ms: f64,
    positive_feedback: i64,
    negative_feedback: i64,
}

fn query_period_stats(
    conn: &Connection,
    start: i64,
    end: i64,
    project: Option<&str>,
    source: Option<&str>,
) -> Result<PeriodStats> {
    let qb = QueryBuilder::new()
        .time_range(start, end)
        .optional("project", project)
        .optional("source", source);

    let exec_sql = format!(
        "SELECT COUNT(*), COALESCE(SUM(CASE WHEN response != '' THEN 1 ELSE 0 END), 0),
                COALESCE(SUM(cost_usd), 0), COALESCE(SUM(input_tokens), 0),
                COALESCE(SUM(output_tokens), 0), COALESCE(SUM(cache_read_tokens), 0),
                COALESCE(SUM(cache_creation_tokens), 0), COALESCE(AVG(duration_ms), 0)
         FROM executions WHERE {}",
        qb.where_clause()
    );

    let mut stmt = conn.prepare(&exec_sql)?;
    let (total, successful, cost, input, output, cache_read, cache_creation, avg_dur): (
        i64,
        i64,
        f64,
        i64,
        i64,
        i64,
        i64,
        f64,
    ) = stmt.query_row(qb.params().as_slice(), |row| {
        Ok((
            row.get(0)?,
            row.get(1)?,
            row.get(2)?,
            row.get(3)?,
            row.get(4)?,
            row.get(5)?,
            row.get(6)?,
            row.get(7)?,
        ))
    })?;

    let fb_sql = format!(
        "SELECT {}, {}
         FROM reactions r {} WHERE r.category = 'feedback' AND r.user_id = e.requester AND {}",
        feedback_sql::POSITIVE_DISTINCT,
        feedback_sql::NEGATIVE_DISTINCT,
        feedback_sql::FEEDBACK_JOIN.replace(
            "LEFT JOIN reactions r ON e.id = r.execution_id",
            "JOIN executions e ON r.execution_id = e.id"
        ),
        qb.where_aliased("e")
    );

    let mut stmt = conn.prepare(&fb_sql)?;
    let (positive, negative): (i64, i64) = stmt
        .query_row(qb.params().as_slice(), |row| Ok((row.get(0)?, row.get(1)?)))
        .unwrap_or((0, 0));

    Ok(PeriodStats {
        total_requests: total,
        successful_requests: successful,
        total_cost_usd: cost,
        total_input_tokens: input,
        total_output_tokens: output,
        cache_read_tokens: cache_read,
        cache_creation_tokens: cache_creation,
        avg_duration_ms: avg_dur,
        positive_feedback: positive,
        negative_feedback: negative,
    })
}

#[derive(Debug, Default)]
struct DurationPercentiles {
    p50: Option<i64>,
    p90: Option<i64>,
    p95: Option<i64>,
    p99: Option<i64>,
}

fn query_duration_percentiles(
    conn: &Connection,
    start: i64,
    end: i64,
    project: Option<&str>,
    source: Option<&str>,
) -> Result<DurationPercentiles> {
    let qb = QueryBuilder::new()
        .time_range(start, end)
        .optional("project", project)
        .optional("source", source);

    let sql = format!(
        "SELECT duration_ms FROM executions WHERE {} AND duration_ms IS NOT NULL ORDER BY duration_ms",
        qb.where_clause()
    );

    let mut stmt = conn.prepare(&sql)?;
    let durations: Vec<i64> = stmt
        .query_map(qb.params().as_slice(), |row| row.get(0))?
        .filter_map(|r| r.ok())
        .collect();

    if durations.is_empty() {
        return Ok(DurationPercentiles::default());
    }

    let len = durations.len();
    Ok(DurationPercentiles {
        p50: Some(durations[len * 50 / 100]),
        p90: Some(durations[len * 90 / 100]),
        p95: Some(durations[len * 95 / 100]),
        p99: Some(durations[len.saturating_sub(1).min(len * 99 / 100)]),
    })
}

fn query_pending_feedback(
    conn: &Connection,
    start: i64,
    end: i64,
    project: Option<&str>,
    source: Option<&str>,
) -> Result<i64> {
    let qb = QueryBuilder::new()
        .time_range(start, end)
        .optional("project", project)
        .optional("source", source);

    let sql = format!(
        "SELECT COUNT(*) FROM executions e WHERE {} AND e.response != ''
         AND NOT EXISTS (SELECT 1 FROM reactions r WHERE r.execution_id = e.id AND r.category = 'feedback')",
        qb.where_aliased("e")
    );

    let mut stmt = conn.prepare(&sql)?;
    stmt.query_row(qb.params().as_slice(), |row| row.get(0))
        .map_err(Into::into)
}

fn calculate_comparison(current: &PeriodStats, previous: &PeriodStats) -> ComparisonStats {
    let pct_change = |old: f64, new: f64| -> Option<f64> {
        if old > 0.0 {
            Some((new - old) / old * 100.0)
        } else if new > 0.0 {
            Some(100.0)
        } else {
            None
        }
    };

    ComparisonStats {
        requests_change_pct: pct_change(
            previous.total_requests as f64,
            current.total_requests as f64,
        ),
        cost_change_pct: pct_change(previous.total_cost_usd, current.total_cost_usd),
        duration_change_pct: pct_change(previous.avg_duration_ms, current.avg_duration_ms),
        satisfaction_change_pct: {
            let prev_total = previous.positive_feedback + previous.negative_feedback;
            let curr_total = current.positive_feedback + current.negative_feedback;
            if prev_total > 0 && curr_total > 0 {
                let prev_rate = previous.positive_feedback as f64 / prev_total as f64 * 100.0;
                let curr_rate = current.positive_feedback as f64 / curr_total as f64 * 100.0;
                Some(curr_rate - prev_rate)
            } else {
                None
            }
        },
    }
}

fn query_timeseries_data(
    conn: &Connection,
    from: i64,
    to: i64,
    bucket_seconds: i64,
    project: Option<&str>,
    source: Option<&str>,
    model: Option<&str>,
) -> Result<Vec<TimeSeriesPoint>> {
    let qb = QueryBuilder::new()
        .time_range(from, to)
        .optional("project", project)
        .optional("source", source)
        .optional("model", model);

    let sql = format!(
        "SELECT
            (e.created_at / {bucket}) * {bucket} as bucket_ts,
            COUNT(DISTINCT e.id) as requests,
            COUNT(DISTINCT CASE WHEN e.response != '' THEN e.id END) as successful,
            COALESCE(SUM(e.cost_usd), 0) / MAX(1, COUNT(*) / COUNT(DISTINCT e.id)) as cost,
            COALESCE(SUM(e.input_tokens), 0) / MAX(1, COUNT(*) / COUNT(DISTINCT e.id)) as input,
            COALESCE(SUM(e.output_tokens), 0) / MAX(1, COUNT(*) / COUNT(DISTINCT e.id)) as output,
            COALESCE(AVG(e.duration_ms), 0) as avg_duration,
            {positive}, {negative}
        FROM executions e
        {join}
        WHERE {where_clause}
        GROUP BY bucket_ts ORDER BY bucket_ts",
        bucket = bucket_seconds,
        positive = feedback_sql::POSITIVE_DISTINCT,
        negative = feedback_sql::NEGATIVE_DISTINCT,
        join = feedback_sql::FEEDBACK_JOIN_VERIFIED,
        where_clause = qb.where_aliased("e")
    );

    let mut stmt = conn.prepare(&sql)?;
    let data: Vec<TimeSeriesPoint> = stmt
        .query_map(qb.params().as_slice(), |row| {
            Ok(TimeSeriesPoint {
                timestamp: format_timestamp(row.get::<_, i64>(0)?),
                requests: row.get(1)?,
                successful: row.get(2)?,
                cost_usd: row.get(3)?,
                input_tokens: row.get(4)?,
                output_tokens: row.get(5)?,
                avg_duration_ms: row.get(6)?,
                p95_duration_ms: None,
                positive_feedback: row.get(7)?,
                negative_feedback: row.get(8)?,
            })
        })?
        .filter_map(|r| r.ok())
        .collect();

    Ok(data)
}

fn query_model_breakdown(
    conn: &Connection,
    start: i64,
    project: Option<&str>,
    source: Option<&str>,
) -> Result<Vec<ModelStats>> {
    let qb = QueryBuilder::new()
        .since(start)
        .optional("project", project)
        .optional("source", source)
        .not_empty("model");

    let sql = format!(
        "SELECT
            e.model,
            COUNT(DISTINCT e.id) as requests,
            COALESCE(SUM(e.cost_usd), 0) / MAX(1, COUNT(*) / COUNT(DISTINCT e.id)) as cost,
            COALESCE(AVG(e.input_tokens), 0) as avg_input,
            COALESCE(AVG(e.output_tokens), 0) as avg_output,
            COALESCE(AVG(e.duration_ms), 0) as avg_duration,
            COUNT(DISTINCT CASE WHEN e.response != '' THEN e.id END) as successful,
            {positive}, {negative}
        FROM executions e
        {join}
        WHERE {where_clause} GROUP BY e.model ORDER BY requests DESC",
        positive = feedback_sql::POSITIVE_DISTINCT,
        negative = feedback_sql::NEGATIVE_DISTINCT,
        join = feedback_sql::FEEDBACK_JOIN_VERIFIED,
        where_clause = qb.where_aliased("e")
    );

    let mut stmt = conn.prepare(&sql)?;
    let rows: Vec<_> = stmt
        .query_map(qb.params().as_slice(), |row| {
            Ok((
                row.get::<_, String>(0)?,
                row.get::<_, i64>(1)?,
                row.get::<_, f64>(2)?,
                row.get::<_, f64>(3)?,
                row.get::<_, f64>(4)?,
                row.get::<_, f64>(5)?,
                row.get::<_, i64>(6)?,
                row.get::<_, i64>(7)?,
                row.get::<_, i64>(8)?,
            ))
        })?
        .filter_map(|r| r.ok())
        .collect();

    let total_requests: i64 = rows.iter().map(|r| r.1).sum();

    Ok(rows
        .into_iter()
        .map(
            |(
                model,
                requests,
                cost,
                avg_input,
                avg_output,
                avg_duration,
                successful,
                positive,
                negative,
            )| {
                let total_feedback = positive + negative;
                ModelStats {
                    display_name: model_display_name(&model),
                    model,
                    requests,
                    percentage: safe_percentage(requests, total_requests),
                    cost_usd: cost,
                    cost_per_request: if requests > 0 {
                        cost / requests as f64
                    } else {
                        0.0
                    },
                    avg_input_tokens: avg_input,
                    avg_output_tokens: avg_output,
                    avg_duration_ms: avg_duration,
                    success_rate: safe_percentage(successful, requests),
                    satisfaction_rate: if total_feedback > 0 {
                        Some(positive as f64 / total_feedback as f64 * 100.0)
                    } else {
                        None
                    },
                }
            },
        )
        .collect())
}

fn model_display_name(model: &str) -> String {
    if model.contains("opus") {
        if model.contains("4-5") || model.contains("4.5") {
            "Opus 4.5"
        } else {
            "Opus 4"
        }
    } else if model.contains("sonnet") {
        if model.contains("4-5") || model.contains("4.5") {
            "Sonnet 4.5"
        } else {
            "Sonnet 4"
        }
    } else if model.contains("haiku") {
        "Haiku"
    } else {
        return model.to_string();
    }
    .to_string()
}

fn query_error_breakdown(
    conn: &Connection,
    start: i64,
    project: Option<&str>,
    source: Option<&str>,
) -> Result<(i64, i64, Vec<ErrorBreakdown>)> {
    let qb = QueryBuilder::new()
        .since(start)
        .optional("project", project)
        .optional("source", source);

    let base_where = qb.where_clause();
    let params = qb.params();

    let total_requests: i64 = conn.query_row(
        &format!("SELECT COUNT(*) FROM executions WHERE {}", base_where),
        params.as_slice(),
        |row| row.get(0),
    )?;

    let total_errors: i64 = conn.query_row(
        &format!(
            "SELECT COUNT(*) FROM executions WHERE {} AND response = ''",
            base_where
        ),
        params.as_slice(),
        |row| row.get(0),
    )?;

    let timeout_threshold = 300_000i64;
    let mut errors = Vec::new();

    let mut qb2 = QueryBuilder::new()
        .since(start)
        .optional("project", project)
        .optional("source", source);

    let next_idx = qb2.next_index();
    qb2.add_param(timeout_threshold);

    let sql = format!(
        "SELECT COUNT(*) FROM executions WHERE {} AND response = '' AND duration_ms >= ?{}",
        qb2.where_clause(),
        next_idx
    );

    let timeout_count: i64 = conn.query_row(&sql, qb2.params().as_slice(), |row| row.get(0))?;

    if timeout_count > 0 {
        errors.push(ErrorBreakdown {
            error_type: "timeout".to_string(),
            count: timeout_count,
            percentage: safe_percentage(timeout_count, total_errors),
            trend: None,
            affected_workflows: None,
        });
    }

    let other_count = total_errors - timeout_count;
    if other_count > 0 {
        errors.push(ErrorBreakdown {
            error_type: "execution_error".to_string(),
            count: other_count,
            percentage: safe_percentage(other_count, total_errors),
            trend: None,
            affected_workflows: None,
        });
    }

    Ok((total_requests, total_errors, errors))
}

fn query_source_breakdown(
    conn: &Connection,
    start: i64,
    project: Option<&str>,
) -> Result<Vec<SourceStats>> {
    let qb = QueryBuilder::new()
        .since(start)
        .optional("project", project);

    let sql = format!(
        "SELECT
            COALESCE(e.source, 'unknown') as src,
            COUNT(DISTINCT e.id) as requests,
            COALESCE(SUM(e.cost_usd), 0) / MAX(1, COUNT(*) / COUNT(DISTINCT e.id)) as cost,
            COALESCE(AVG(e.duration_ms), 0) as avg_duration,
            COUNT(DISTINCT CASE WHEN e.response != '' THEN e.id END) as successful,
            {positive}, {negative},
            COUNT(DISTINCT e.requester) as unique_requesters
        FROM executions e
        {join}
        WHERE {where_clause} GROUP BY src ORDER BY requests DESC",
        positive = feedback_sql::POSITIVE_DISTINCT,
        negative = feedback_sql::NEGATIVE_DISTINCT,
        join = feedback_sql::FEEDBACK_JOIN_VERIFIED,
        where_clause = qb.where_aliased("e")
    );

    let mut stmt = conn.prepare(&sql)?;
    let rows: Vec<_> = stmt
        .query_map(qb.params().as_slice(), |row| {
            Ok((
                row.get::<_, String>(0)?,
                row.get::<_, i64>(1)?,
                row.get::<_, f64>(2)?,
                row.get::<_, f64>(3)?,
                row.get::<_, i64>(4)?,
                row.get::<_, i64>(5)?,
                row.get::<_, i64>(6)?,
                row.get::<_, i64>(7)?,
            ))
        })?
        .filter_map(|r| r.ok())
        .collect();

    let total_requests: i64 = rows.iter().map(|r| r.1).sum();

    Ok(rows
        .into_iter()
        .map(
            |(
                source,
                requests,
                cost,
                avg_duration,
                successful,
                positive,
                negative,
                unique_requesters,
            )| {
                let total_feedback = positive + negative;
                SourceStats {
                    source,
                    requests,
                    percentage: safe_percentage(requests, total_requests),
                    cost_usd: cost,
                    avg_duration_ms: avg_duration,
                    success_rate: safe_percentage(successful, requests),
                    satisfaction_rate: if total_feedback > 0 {
                        Some(positive as f64 / total_feedback as f64 * 100.0)
                    } else {
                        None
                    },
                    unique_requesters,
                }
            },
        )
        .collect())
}

fn query_requester_breakdown(
    conn: &Connection,
    start: i64,
    project: Option<&str>,
    source: Option<&str>,
    limit: i64,
) -> Result<Vec<RequesterStats>> {
    let qb = QueryBuilder::new()
        .since(start)
        .optional("project", project)
        .optional("source", source)
        .not_empty("requester");

    let sql = format!(
        "SELECT
            e.requester,
            e.source,
            COUNT(DISTINCT e.id) as requests,
            COALESCE(SUM(e.cost_usd), 0) / MAX(1, COUNT(*) / COUNT(DISTINCT e.id)) as cost,
            COALESCE(AVG(e.duration_ms), 0) as avg_duration,
            COUNT(DISTINCT CASE WHEN e.response != '' THEN e.id END) as successful,
            {positive}, {negative},
            MAX(e.created_at) as last_active
        FROM executions e
        {join}
        WHERE {where_clause} GROUP BY e.requester ORDER BY requests DESC LIMIT {limit}",
        positive = feedback_sql::POSITIVE_DISTINCT,
        negative = feedback_sql::NEGATIVE_DISTINCT,
        join = feedback_sql::FEEDBACK_JOIN_VERIFIED,
        where_clause = qb.where_aliased("e"),
        limit = limit
    );

    let mut stmt = conn.prepare(&sql)?;
    let requesters: Vec<RequesterStats> = stmt
        .query_map(qb.params().as_slice(), |row| {
            let requester: String = row.get(0)?;
            let source: Option<String> = row.get(1)?;
            let requests: i64 = row.get(2)?;
            let cost: f64 = row.get(3)?;
            let avg_duration: f64 = row.get(4)?;
            let successful: i64 = row.get(5)?;
            let positive: i64 = row.get(6)?;
            let negative: i64 = row.get(7)?;
            let last_active: i64 = row.get(8)?;
            let total_feedback = positive + negative;

            Ok(RequesterStats {
                requester,
                source,
                requests,
                cost_usd: cost,
                avg_duration_ms: avg_duration,
                success_rate: safe_percentage(successful, requests),
                satisfaction_rate: if total_feedback > 0 {
                    Some(positive as f64 / total_feedback as f64 * 100.0)
                } else {
                    None
                },
                last_active: format_timestamp(last_active),
            })
        })?
        .filter_map(|r| r.ok())
        .collect();

    Ok(requesters)
}

fn query_workflow_stats(conn: &Connection, start: i64) -> Result<Vec<WorkflowStats>> {
    let sql = "SELECT
        workflow_name,
        COUNT(*) as total,
        COALESCE(SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END), 0) as successful,
        COALESCE(SUM(CASE WHEN status != 'success' THEN 1 ELSE 0 END), 0) as failed,
        AVG(duration_ms) as avg_duration,
        MAX(created_at) as last_exec,
        (SELECT status FROM workflow_executions w2
         WHERE w2.workflow_name = workflow_executions.workflow_name
         ORDER BY created_at DESC LIMIT 1) as last_status
    FROM workflow_executions WHERE created_at >= ?1
    GROUP BY workflow_name ORDER BY total DESC";

    let mut stmt = conn.prepare(sql)?;
    let workflows: Vec<WorkflowStats> = stmt
        .query_map(params![start], |row| {
            let name: String = row.get(0)?;
            let total: i64 = row.get(1)?;
            let successful: i64 = row.get(2)?;
            let failed: i64 = row.get(3)?;
            let avg_duration: Option<f64> = row.get(4)?;
            let last_exec: Option<i64> = row.get(5)?;
            let last_status: Option<String> = row.get(6)?;
            let success_rate = safe_percentage(successful, total);

            Ok(WorkflowStats {
                display_name: workflow_display_name(&name),
                name,
                status: HealthStatus::from_success_rate(success_rate),
                executions: total,
                successful,
                failed,
                success_rate,
                avg_duration_ms: avg_duration,
                p95_duration_ms: None,
                last_execution: last_exec.map(format_timestamp),
                last_status,
                metadata: None,
            })
        })?
        .filter_map(|r| r.ok())
        .collect();

    Ok(workflows)
}

fn workflow_display_name(name: &str) -> String {
    match name {
        "slack-mention-handler" => "Slack Mention".to_string(),
        "slack-message-handler" => "Slack Message".to_string(),
        "incident-reaction-handler" => "Incident Reaction".to_string(),
        "gitlab-mr-review" => "MR Review".to_string(),
        "feedback-handler" => "Feedback".to_string(),
        _ => name
            .split('-')
            .map(|s| {
                let mut chars = s.chars();
                match chars.next() {
                    Some(c) => c.to_uppercase().chain(chars).collect(),
                    None => String::new(),
                }
            })
            .collect::<Vec<_>>()
            .join(" "),
    }
}

pub fn get_classify_stats(
    conn: &Connection,
    period: Period,
    project: Option<&str>,
) -> Result<ClassifyStatsResponse> {
    let now = Utc::now().timestamp();
    let (period_start, _) = calculate_period_bounds(now, period);

    let qb = QueryBuilder::new()
        .since(period_start)
        .optional("project", project);

    let total_sql = format!(
        "SELECT COUNT(*), COALESCE(AVG(duration_ms), 0) FROM classification_logs WHERE {}",
        qb.where_clause()
    );
    let mut stmt = conn.prepare(&total_sql)?;
    let (total, avg_duration): (i64, f64) =
        stmt.query_row(qb.params().as_slice(), |row| Ok((row.get(0)?, row.get(1)?)))?;

    let agents_sql = format!(
        "SELECT agent, COUNT(*), AVG(confidence), AVG(duration_ms)
         FROM classification_logs WHERE {} GROUP BY agent ORDER BY COUNT(*) DESC",
        qb.where_clause()
    );
    let mut stmt = conn.prepare(&agents_sql)?;
    let agents: Vec<AgentClassifyStats> = stmt
        .query_map(qb.params().as_slice(), |row| {
            let agent: String = row.get(0)?;
            let count: i64 = row.get(1)?;
            let avg_confidence: f64 = row.get(2)?;
            let avg_dur: f64 = row.get(3)?;
            Ok(AgentClassifyStats {
                agent,
                count,
                percentage: safe_percentage(count, total),
                avg_confidence,
                avg_duration_ms: avg_dur,
            })
        })?
        .filter_map(|r| r.ok())
        .collect();

    let methods_sql = format!(
        "SELECT method, COUNT(*), AVG(duration_ms)
         FROM classification_logs WHERE {} GROUP BY method ORDER BY COUNT(*) DESC",
        qb.where_clause()
    );
    let mut stmt = conn.prepare(&methods_sql)?;
    let methods: Vec<MethodClassifyStats> = stmt
        .query_map(qb.params().as_slice(), |row| {
            let method: String = row.get(0)?;
            let count: i64 = row.get(1)?;
            let avg_dur: f64 = row.get(2)?;
            Ok(MethodClassifyStats {
                method,
                count,
                percentage: safe_percentage(count, total),
                avg_duration_ms: avg_dur,
            })
        })?
        .filter_map(|r| r.ok())
        .collect();

    Ok(ClassifyStatsResponse {
        period: period.to_string(),
        total_classifications: total,
        avg_duration_ms: avg_duration,
        agents,
        methods,
    })
}

pub fn get_classify_logs(
    conn: &Connection,
    period: Period,
    project: Option<&str>,
    agent: Option<&str>,
    method: Option<&str>,
    page: i64,
    limit: i64,
) -> Result<ClassifyLogsResponse> {
    let now = Utc::now().timestamp();
    let (period_start, _) = calculate_period_bounds(now, period);
    let offset = (page - 1) * limit;

    let qb = QueryBuilder::new()
        .since(period_start)
        .optional("project", project)
        .optional("agent", agent)
        .optional("method", method);

    let count_sql = format!(
        "SELECT COUNT(*) FROM classification_logs WHERE {}",
        qb.where_clause()
    );
    let total: i64 = conn.query_row(&count_sql, qb.params_refs().as_slice(), |row| row.get(0))?;

    let logs_sql = format!(
        "SELECT id, substr(text, 1, 100), agent, model, confidence, method,
                matched_keyword, reasoning, duration_ms, project, source, requester, created_at
         FROM classification_logs WHERE {} ORDER BY created_at DESC LIMIT ?{} OFFSET ?{}",
        qb.where_clause(),
        qb.params_len() + 1,
        qb.params_len() + 2
    );

    let mut params = qb.into_params();
    params.push(Box::new(limit));
    params.push(Box::new(offset));
    let params_refs: Vec<&dyn rusqlite::ToSql> = params.iter().map(|p| p.as_ref()).collect();

    let mut stmt = conn.prepare(&logs_sql)?;
    let logs: Vec<ClassifyLogEntry> = stmt
        .query_map(params_refs.as_slice(), |row| {
            Ok(ClassifyLogEntry {
                id: row.get(0)?,
                text_preview: row.get(1)?,
                agent: row.get(2)?,
                model: row.get(3)?,
                confidence: row.get(4)?,
                method: row.get(5)?,
                matched_keyword: row.get(6)?,
                reasoning: row.get(7)?,
                duration_ms: row.get(8)?,
                project: row.get(9)?,
                source: row.get(10)?,
                requester: row.get(11)?,
                created_at: format_timestamp(row.get::<_, i64>(12)?),
            })
        })?
        .filter_map(|r| r.ok())
        .collect();

    let total_pages = (total + limit - 1) / limit;

    Ok(ClassifyLogsResponse {
        logs,
        total,
        page,
        limit,
        total_pages,
    })
}
