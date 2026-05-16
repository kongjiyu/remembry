//! Gemini API REST client.

mod files;
mod generate;

use reqwest::Client;
use std::time::Duration;

pub const GEMINI_BASE_URL: &str = "https://generativelanguage.googleapis.com";
pub const GEMINI_API_VERSION: &str = "v1beta";

#[derive(Debug, Clone)]
pub struct GeminiClient {
    http: Client,
    api_key: String,
}

impl GeminiClient {
    pub fn new(api_key: String) -> Self {
        let http = Client::builder()
            .timeout(Duration::from_secs(120))
            .build()
            .expect("HTTP client builder should not fail");
        Self { http, api_key }
    }

    pub fn files_api_uri(&self, path: &str) -> String {
        format!("{}/{}/{}?key={}", GEMINI_BASE_URL, GEMINI_API_VERSION, path, self.api_key)
    }

    pub fn generate_api_uri(&self, model: &str) -> String {
        format!("{}/{}/models/{}:generateContent?key={}", GEMINI_BASE_URL, GEMINI_API_VERSION, model, self.api_key)
    }

    pub fn http(&self) -> &Client {
        &self.http
    }

    pub fn api_key(&self) -> &str {
        &self.api_key
    }
}

pub async fn retry_with_backoff<F, T, E, Fut>(mut f: F) -> Result<T, E>
where
    F: FnMut() -> Fut,
    Fut: std::future::Future<Output = Result<T, E>>,
    E: std::fmt::Debug + Clone,
{
    let mut attempt = 0;
    let max_attempts = 5;
    let base_delay = std::time::Duration::from_secs(2);

    loop {
        match f().await {
            Ok(result) => return Ok(result),
            Err(ref e) if attempt >= max_attempts => return Err(e.clone()),
            Err(ref e) => {
                attempt += 1;
                let delay = base_delay * (1 << attempt.min(4));
                log::warn!("Retryable error, attempt {}/{}: {:?}. Waiting {:?}.", attempt, max_attempts, e, delay);
                tokio::time::sleep(delay).await;
            }
        }
    }
}

pub fn is_retryable_error(status: reqwest::StatusCode) -> bool {
    status == reqwest::StatusCode::TOO_MANY_REQUESTS
        || status.as_u16() >= 500
}

pub use files::{upload_file, poll_file_status, delete_file};
pub use generate::{transcribe_audio, extract_meeting_notes};