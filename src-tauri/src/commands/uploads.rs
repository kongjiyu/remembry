use crate::db::{self, Document, Meeting, MeetingNotes, TranscriptionResult};
use crate::gemini::{self, GeminiClient};
use crate::secrets;
use crate::uploads::UploadManager;
use crate::commands::{gemini_key_metadata, LOCAL_USER};
use chrono::Utc;
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::sync::{Arc, Mutex};
use tauri::Manager;
use uuid::Uuid;

static UPLOAD_MANAGER: std::sync::OnceLock<Arc<Mutex<UploadManager>>> = std::sync::OnceLock::new();

fn get_upload_manager(app_temp_dir: &PathBuf) -> Arc<Mutex<UploadManager>> {
    UPLOAD_MANAGER.get_or_init(|| {
        Arc::new(Mutex::new(UploadManager::new(app_temp_dir.join("uploads"))))
    }).clone()
}

fn get_temp_dir(app_temp_dir: tauri::AppHandle) -> Result<PathBuf, String> {
    app_temp_dir.path().temp_dir().map_err(|e| e.to_string())
}

#[derive(Debug, Serialize)]
pub struct StartUploadResponse {
    pub success: bool,
    pub upload_id: String,
}

#[derive(Debug, Serialize)]
pub struct AppendChunkResponse {
    pub success: bool,
}

#[derive(Debug, Serialize)]
pub struct ProcessUploadResponse {
    pub success: bool,
    pub meeting_id: String,
    pub meeting: Meeting,
    pub message: String,
}

#[derive(Debug, Serialize)]
pub struct CancelUploadResponse {
    pub success: bool,
}

#[derive(Debug, Deserialize)]
pub struct ProcessUploadParams {
    pub project_id: String,
    pub title: String,
    pub context: Option<String>,
    pub file_type: String,
    pub notes_languages: Vec<String>,
}

fn get_api_key() -> Result<String, String> {
    secrets::get_gemini_key().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn start_upload(
    file_name: String,
    total_chunks: u32,
    app_temp_dir: tauri::AppHandle,
) -> Result<StartUploadResponse, String> {
    let temp_dir = get_temp_dir(app_temp_dir)?;
    let manager = get_upload_manager(&temp_dir);
    let upload_id = {
        let mut mgr = manager.lock().map_err(|e| e.to_string())?;
        mgr.start_upload(&file_name, total_chunks)?
    };

    Ok(StartUploadResponse {
        success: true,
        upload_id,
    })
}

#[tauri::command]
pub fn append_upload_chunk(
    upload_id: String,
    chunk_index: u32,
    chunk_data: String,
    app_temp_dir: tauri::AppHandle,
) -> Result<AppendChunkResponse, String> {
    let temp_dir = get_temp_dir(app_temp_dir)?;
    let manager = get_upload_manager(&temp_dir);

    // Decode base64 chunk data
    let data = base64::Engine::decode(
        &base64::engine::general_purpose::STANDARD,
        &chunk_data,
    ).map_err(|e| format!("Failed to decode chunk data: {}", e))?;

    {
        let mut mgr = manager.lock().map_err(|e| e.to_string())?;
        mgr.append_chunk(&upload_id, chunk_index, &data)?;
    }

    Ok(AppendChunkResponse { success: true })
}

#[tauri::command]
pub fn process_meeting_upload(
    upload_id: String,
    params: ProcessUploadParams,
    app_temp_dir: tauri::AppHandle,
) -> Result<ProcessUploadResponse, String> {
    let temp_dir = get_temp_dir(app_temp_dir)?;
    let manager = get_upload_manager(&temp_dir);

    // Finalize and get temp file path
    let temp_path = {
        let mut mgr = manager.lock().map_err(|e| e.to_string())?;
        mgr.process_upload(&upload_id)?
    };

    let api_key = get_api_key()?;
    if api_key.trim().is_empty() {
        return Err("Gemini API key is not configured. Please add your API key in Settings.".to_string());
    }
    let client = GeminiClient::new(api_key.clone());

    // Determine file type and process accordingly
    let (transcription, mime_type) = if params.file_type == "text" {
        // Text transcript: read content and skip transcription
        let content = std::fs::read_to_string(&temp_path)
            .map_err(|e| format!("Failed to read transcript file: {}", e))?;
        (Some(TranscriptionResult {
            text: content,
            language: None,
        }), "text/plain")
    } else {
        // Audio/video: transcribe via Gemini
        let mime_type = if params.file_type == "audio" {
            "audio/mpeg"
        } else {
            "video/mp4"
        };

        let context_str = params.context.as_deref().unwrap_or("");

        let result = tokio::runtime::Runtime::new()
            .map_err(|e| e.to_string())?
            .block_on(async {
                gemini::upload_file(&client, &temp_path, mime_type).await
            }).map_err(|e| format!("Gemini upload failed: {}", e))?;

        let transcription = tokio::runtime::Runtime::new()
            .map_err(|e| e.to_string())?
            .block_on(async {
                gemini::transcribe_audio(&client, &result.uri, mime_type, context_str).await
            }).map_err(|e| format!("Transcription failed: {}", e))?;

        (Some(transcription), mime_type)
    };

    // Clean up temp file
    let _ = std::fs::remove_file(&temp_path);

    // Create meeting record
    let meeting_id = Uuid::new_v4().to_string();
    let now = Utc::now().to_rfc3339();
    let file_size = std::fs::metadata(&temp_path).ok().map(|m| m.len() as i64).unwrap_or(0);

    let meeting = Meeting {
        id: meeting_id.clone(),
        project_id: params.project_id.clone(),
        title: params.title.clone(),
        context: params.context.clone(),
        file_name: Some(temp_path.file_name().map(|n| n.to_string_lossy().to_string()).unwrap_or_default()),
        file_size: Some(file_size),
        mime_type: Some(mime_type.to_string()),
        file_type: params.file_type.clone(),
        created_at: now,
        transcription,
        notes_by_language: None,
        default_language: Some("en".to_string()),
        available_languages: None,
    };

    db::meetings::upsert_meeting(&meeting).map_err(|e| e.to_string())?;

    // If text transcript, also generate notes directly
    if params.file_type == "text" {
        if let Some(transcription) = &meeting.transcription {
            let language = params.notes_languages.first().cloned().unwrap_or_else(|| "en".to_string());
            let notes = tokio::runtime::Runtime::new()
                .map_err(|e| e.to_string())?
                .block_on(async {
                    gemini::extract_meeting_notes(&client, &transcription.text, params.context.as_deref().unwrap_or(""), &language).await
                }).map_err(|e| format!("Note extraction failed: {}", e))?;

            db::meetings::update_meeting_notes(&meeting_id, &language, &notes)
                .map_err(|e| e.to_string())?;
        }
    }

    // Store transcript as a document for the project
    if let Some(transcription) = &meeting.transcription {
        let doc_id = format!("documents/{}", Uuid::new_v4());
        let doc = Document {
            id: doc_id,
            project_id: params.project_id.clone(),
            display_name: format!("{}.txt", params.title),
            mime_type: Some("text/plain".to_string()),
            content: transcription.text.clone(),
            metadata: None,
            created_at: Utc::now().to_rfc3339(),
        };
        db::documents::upsert_document(&doc).map_err(|e| e.to_string())?;
    }

    // Update Gemini key usage
    let _ = gemini_key_metadata::increment_usage(LOCAL_USER);

    Ok(ProcessUploadResponse {
        success: true,
        meeting_id,
        meeting,
        message: "Meeting processed successfully.".to_string(),
    })
}

#[tauri::command]
pub fn cancel_upload(upload_id: String, app_temp_dir: tauri::AppHandle) -> Result<CancelUploadResponse, String> {
    let temp_dir = get_temp_dir(app_temp_dir)?;
    let manager = get_upload_manager(&temp_dir);
    {
        let mut mgr = manager.lock().map_err(|e| e.to_string())?;
        mgr.cancel_upload(&upload_id)?;
    }
    Ok(CancelUploadResponse { success: true })
}