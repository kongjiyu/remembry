//! Gemini Files API — resumable upload and polling.

use crate::gemini::{GeminiClient, GEMINI_BASE_URL, GEMINI_API_VERSION, retry_with_backoff, is_retryable_error};
use serde::Deserialize;
use std::path::Path;

#[derive(Debug, Clone, Deserialize)]
pub struct UploadResponse {
    pub file: UploadedFileInfo,
}

#[derive(Debug, Clone, Deserialize)]
pub struct UploadedFileInfo {
    pub name: String,
    pub uri: Option<String>,
    pub state: String,
    #[serde(default)]
    pub mime_type: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct UploadResult {
    pub uri: String,
    pub name: String,
    #[allow(dead_code)]
    pub state: String,
}

#[derive(Debug, Clone, Deserialize)]
struct FileInfoWrapper {
    pub file: FileInfo,
}

#[derive(Debug, Clone, Deserialize)]
pub struct FileInfo {
    pub name: String,
    pub uri: Option<String>,
    pub state: String,
    #[allow(dead_code)]
    #[serde(default)]
    pub mime_type: Option<String>,
}

/// Initiate a resumable upload session and return the upload URL.
async fn initiate_upload(
    client: &GeminiClient,
    file_size: u64,
    mime_type: &str,
) -> Result<String, String> {
    let init_url = format!(
        "{}/upload/{}/files?uploadType=resumable&key={}",
        GEMINI_BASE_URL, GEMINI_API_VERSION, client.api_key()
    );

    let init_body = serde_json::json!({
        "file": {
            "display_name": format!("upload_{}", std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_millis())
        }
    });

    let response = client.http()
        .post(&init_url)
        .header("X-Goog-Upload-Protocol", "resumable")
        .header("X-Goog-Upload-Command", "start")
        .header("X-Goog-Upload-Header-Content-Length", &file_size.to_string())
        .header("X-Goog-Upload-Header-Content-Type", mime_type)
        .header("Content-Type", "application/json; charset=utf-8")
        .json(&init_body)
        .send()
        .await
        .map_err(|e| format!("upload init request failed: {}", e))?;

    let status = response.status();
    if !status.is_success() && !is_retryable_error(status) {
        let body = response.text().await.unwrap_or_default();
        return Err(format!("upload init failed ({}): {}", status, body));
    }

    // Primary: x-goog-upload-url. Fallback: location (lowercase).
    response.headers()
        .get("x-goog-upload-url")
        .or_else(|| response.headers().get("location"))
        .and_then(|v| v.to_str().ok())
        .map(|s| s.to_string())
        .ok_or_else(|| {
            let header_names: Vec<_> = response.headers()
                .keys()
                .map(|k| k.as_str())
                .collect();
            format!("No x-goog-upload-url or location header in upload init response. Headers present: {:?}", header_names)
        })
}

/// Upload the full file content and finalize the resumable session.
async fn upload_and_finalize(
    client: &GeminiClient,
    upload_url: &str,
    file_content: &[u8],
    file_size: u64,
) -> Result<UploadedFileInfo, String> {
    let content_range = format!("bytes 0-{}/{}", file_content.len() - 1, file_size);

    let response = client.http()
        .put(upload_url)
        .header("X-Goog-Upload-Offset", "0")
        .header("X-Goog-Upload-Command", "upload, finalize")
        .header("Content-Range", &content_range)
        .header("Content-Length", &file_content.len().to_string())
        .body(file_content.to_vec())
        .send()
        .await
        .map_err(|e| format!("upload request failed: {}", e))?;

    if !response.status().is_success() && !is_retryable_error(response.status()) {
        let status = response.status();
        let body = response.text().await.unwrap_or_default();
        return Err(format!("upload failed ({}): {}", status, body));
    }

    let upload_resp: UploadResponse = response.json().await
        .map_err(|e| format!("failed to parse upload response: {}", e))?;

    Ok(upload_resp.file)
}

pub async fn upload_file(
    client: &GeminiClient,
    file_path: &Path,
    mime_type: &str,
) -> Result<UploadResult, String> {
    let file_content = tokio::fs::read(file_path).await
        .map_err(|e| format!("failed to read file: {}", e))?;
    let file_size = file_content.len() as u64;

    // Step 1: Initiate resumable upload
    let upload_url = initiate_upload(client, file_size, mime_type).await?;

    // Step 2: Upload all bytes and finalize
    let file_info = upload_and_finalize(client, &upload_url, &file_content, file_size).await?;

    // Step 3: If file is already ACTIVE, return it; otherwise poll until ACTIVE
    let final_info = if file_info.state == "ACTIVE" {
        FileInfo {
            name: file_info.name.clone(),
            state: file_info.state.clone(),
            mime_type: file_info.mime_type.clone(),
            uri: file_info.uri.clone(),
        }
    } else {
        poll_file_status(client, &file_info.name).await?
    };

    // Use the actual URI from the upload response if available; fall back to name-based path
    let uri = file_info.uri.clone()
        .or_else(|| final_info.uri.clone())
        .unwrap_or_else(|| format!("files/{}", final_info.name));

    Ok(UploadResult {
        uri,
        name: final_info.name,
        state: final_info.state,
    })
}

pub async fn poll_file_status(client: &GeminiClient, name: &str) -> Result<FileInfo, String> {
    let max_attempts = 60;
    let poll_interval = std::time::Duration::from_secs(5);

    for attempt in 0..max_attempts {
        let response = retry_with_backoff(|| async {
            client.http()
                .get(&client.files_api_uri(&format!("files/{}", name)))
                .send()
                .await
                .map_err(|e| format!("poll request failed: {}", e))
        }).await
        .map_err(|e| format!("poll failed after retries: {:?}", e))?;

        if !response.status().is_success() {
            let status = response.status();
            let body = response.text().await.unwrap_or_default();
            return Err(format!("poll failed ({}): {}", status, body));
        }

        // Read body once and try direct FileInfo, then wrapped { file: FileInfo }
        let body = response.text().await
            .map_err(|e| format!("failed to read response body: {}", e))?;

        let file_info = match serde_json::from_str::<FileInfo>(&body) {
            Ok(info) => info,
            Err(_) => {
                let wrapper: FileInfoWrapper = serde_json::from_str(&body)
                    .map_err(|e| format!("failed to parse file info: {}", e))?;
                wrapper.file
            }
        };

        match file_info.state.as_str() {
            "ACTIVE" => return Ok(file_info),
            "FAILED" => return Err("File upload failed on server side".to_string()),
            _ => {
                if attempt < max_attempts - 1 {
                    tokio::time::sleep(poll_interval).await;
                }
            }
        }
    }

    Err("Polling timed out waiting for file to become ACTIVE".to_string())
}

pub async fn delete_file(client: &GeminiClient, name: &str) -> Result<(), String> {
    let response = client.http()
        .delete(&client.files_api_uri(&format!("files/{}", name)))
        .send()
        .await
        .map_err(|e| format!("delete request failed: {}", e))?;

    if !response.status().is_success() {
        let status = response.status();
        let body = response.text().await.unwrap_or_default();
        return Err(format!("delete failed ({}): {}", status, body));
    }

    Ok(())
}