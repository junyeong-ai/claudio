use rusqlite::ToSql;

pub struct QueryBuilder {
    conditions: Vec<String>,
    params: Vec<Box<dyn ToSql>>,
}

impl QueryBuilder {
    pub fn new() -> Self {
        Self {
            conditions: Vec::new(),
            params: Vec::new(),
        }
    }

    pub fn time_range(mut self, start: i64, end: i64) -> Self {
        self.add_time_range(start, end);
        self
    }

    pub fn since(mut self, start: i64) -> Self {
        self.add_start_time(start);
        self
    }

    pub fn optional(mut self, field: &str, value: Option<&str>) -> Self {
        self.add_optional(field, value);
        self
    }

    pub fn not_empty(mut self, field: &str) -> Self {
        self.add_not_null(field);
        self
    }

    pub fn add_time_range(&mut self, start: i64, end: i64) {
        self.conditions
            .push(format!("created_at >= ?{}", self.params.len() + 1));
        self.params.push(Box::new(start));
        self.conditions
            .push(format!("created_at < ?{}", self.params.len() + 1));
        self.params.push(Box::new(end));
    }

    pub fn add_start_time(&mut self, start: i64) {
        self.conditions
            .push(format!("created_at >= ?{}", self.params.len() + 1));
        self.params.push(Box::new(start));
    }

    pub fn add_optional(&mut self, field: &str, value: Option<&str>) {
        if let Some(v) = value {
            self.conditions
                .push(format!("{} = ?{}", field, self.params.len() + 1));
            self.params.push(Box::new(v.to_string()));
        }
    }

    pub fn add_not_null(&mut self, field: &str) {
        self.conditions
            .push(format!("{} IS NOT NULL AND {} != ''", field, field));
    }

    pub fn add_param(&mut self, value: impl ToSql + 'static) -> usize {
        self.params.push(Box::new(value));
        self.params.len()
    }

    pub fn where_clause(&self) -> String {
        if self.conditions.is_empty() {
            "1=1".to_string()
        } else {
            self.conditions.join(" AND ")
        }
    }

    pub fn where_aliased(&self, alias: &str) -> String {
        self.where_clause()
            .replace("created_at", &format!("{}.created_at", alias))
            .replace("project", &format!("{}.project", alias))
            .replace("source", &format!("{}.source", alias))
            .replace("model", &format!("{}.model", alias))
            .replace("requester", &format!("{}.requester", alias))
    }

    pub fn params(&self) -> Vec<&dyn ToSql> {
        self.params.iter().map(|p| p.as_ref()).collect()
    }

    #[inline]
    pub fn params_refs(&self) -> Vec<&dyn ToSql> {
        self.params()
    }

    pub fn next_index(&self) -> usize {
        self.params.len() + 1
    }

    pub fn params_len(&self) -> usize {
        self.params.len()
    }

    pub fn into_params(self) -> Vec<Box<dyn ToSql>> {
        self.params
    }
}

impl Default for QueryBuilder {
    fn default() -> Self {
        Self::new()
    }
}
