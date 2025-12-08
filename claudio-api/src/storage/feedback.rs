pub mod sql {
    pub const POSITIVE_DISTINCT: &str =
        "COUNT(DISTINCT CASE WHEN r.reaction IN ('thumbsup', '+1') THEN r.id END)";

    pub const NEGATIVE_DISTINCT: &str =
        "COUNT(DISTINCT CASE WHEN r.reaction IN ('thumbsdown', '-1') THEN r.id END)";

    pub const FEEDBACK_JOIN: &str =
        "LEFT JOIN reactions r ON e.id = r.execution_id AND r.category = 'feedback'";

    pub const FEEDBACK_JOIN_VERIFIED: &str = "LEFT JOIN reactions r ON e.id = r.execution_id AND r.category = 'feedback' AND r.user_id = e.requester";
}

pub fn calculate_score(positive: i64, negative: i64) -> Option<i32> {
    match (positive > 0, negative > 0) {
        (false, false) => None,
        (true, true) => Some(0),
        (true, false) => Some(1),
        (false, true) => Some(-1),
    }
}

pub fn is_feedback_reaction(reaction: &str) -> bool {
    matches!(reaction, "thumbsup" | "+1" | "thumbsdown" | "-1")
}
