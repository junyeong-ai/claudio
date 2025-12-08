use once_cell::sync::Lazy;
use regex::Regex;

static PATTERNS: Lazy<Patterns> = Lazy::new(Patterns::new);

struct Patterns {
    headers: Regex,
    bold: Regex,
    strikethrough: Regex,
    links: Regex,
    newlines: Regex,
}

impl Patterns {
    fn new() -> Self {
        Self {
            headers: Regex::new(r"(?m)^#{1,6}\s+(.+)$").unwrap(),
            bold: Regex::new(r"\*\*(.+?)\*\*").unwrap(),
            strikethrough: Regex::new(r"~~(.+?)~~").unwrap(),
            links: Regex::new(r"\[([^\]]+)\]\(([^)]+)\)").unwrap(),
            newlines: Regex::new(r"\n{3,}").unwrap(),
        }
    }
}

pub fn to_mrkdwn(text: &str) -> String {
    let p = &*PATTERNS;

    let result = p.headers.replace_all(text, "*$1*");
    let result = p.links.replace_all(&result, "<$2|$1>");
    let result = p.bold.replace_all(&result, "*$1*");
    let result = p.strikethrough.replace_all(&result, "~$1~");
    let result = p.newlines.replace_all(&result, "\n\n");

    result.into_owned()
}
