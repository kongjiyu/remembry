//! Notes Tauri commands.

use crate::db::{self, MeetingNotes};
use crate::gemini::{self, GeminiClient};
use crate::secrets;
use serde::Serialize;

const LOCAL_USER: &str = "local_user";

#[derive(Debug, Serialize)]
pub struct GetNotesResponse {
    pub notes: Option<MeetingNotes>,
    pub language: String,
    #[serde(rename = "needsRegeneration")]
    pub needs_regeneration: bool,
}

#[derive(Debug, Serialize)]
pub struct ExtractNotesResponse {
    pub success: bool,
    pub notes: MeetingNotes,
}

#[derive(Debug, Serialize)]
pub struct RegenerateNotesResponse {
    pub success: bool,
    pub notes: MeetingNotes,
    pub language: String,
}

#[tauri::command]
pub fn get_meeting_notes(meeting_id: String, language: String) -> Result<GetNotesResponse, String> {
    let notes = db::meetings::get_meeting_notes(&meeting_id, &language)
        .map_err(|e| e.to_string())?;

    Ok(GetNotesResponse {
        needs_regeneration: notes.is_none(),
        notes,
        language,
    })
}

#[tauri::command]
pub fn update_meeting_notes(meeting_id: String, language: String, notes: MeetingNotes) -> Result<(), String> {
    db::meetings::update_meeting_notes(&meeting_id, &language, &notes)
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn extract_meeting_notes(meeting_id: String, language: String) -> Result<ExtractNotesResponse, String> {
    // Get API key
    let api_key = secrets::get_gemini_key()
        .map_err(|e| format!("Gemini API key not found. Please add your API key in Settings. Error: {}", e))?;

    // Get meeting
    let meeting = db::meetings::get_meeting(&meeting_id)
        .map_err(|e| e.to_string())?
        .ok_or_else(|| "Meeting not found".to_string())?;

    // Get transcription text
    let transcription_text = meeting.transcription
        .as_ref()
        .ok_or_else(|| "No transcription text available".to_string())?
        .text.clone();

    // Generate notes using Gemini
    let rt = tokio::runtime::Runtime::new()
        .map_err(|e| format!("Failed to create runtime: {}", e))?;

    let client = GeminiClient::new(api_key.clone());
    let context_str = meeting.context.as_deref().unwrap_or("");

    let notes = rt.block_on(async {
        gemini::extract_meeting_notes(&client, &transcription_text, context_str, &language).await
    }).map_err(|e| format!("Failed to generate notes: {}", e))?;

    // Store notes in database
    db::meetings::update_meeting_notes(&meeting_id, &language, &notes)
        .map_err(|e| e.to_string())?;

    // Update usage metadata
    let _ = db::gemini_key_metadata::increment_usage(LOCAL_USER);

    Ok(ExtractNotesResponse { success: true, notes })
}

#[tauri::command]
pub fn regenerate_meeting_notes(meeting_id: String, language: String) -> Result<RegenerateNotesResponse, String> {
    // Get API key
    let api_key = secrets::get_gemini_key()
        .map_err(|e| format!("Gemini API key not found. Please add your API key in Settings. Error: {}", e))?;

    // Get meeting
    let meeting = db::meetings::get_meeting(&meeting_id)
        .map_err(|e| e.to_string())?
        .ok_or_else(|| "Meeting not found".to_string())?;

    // Get transcription text
    let transcription_text = meeting.transcription
        .as_ref()
        .ok_or_else(|| "No transcription text found".to_string())?
        .text.clone();

    // Generate notes using Gemini
    let rt = tokio::runtime::Runtime::new()
        .map_err(|e| format!("Failed to create runtime: {}", e))?;

    let client = GeminiClient::new(api_key.clone());
    let context_str = meeting.context.as_deref().unwrap_or("");

    let notes = rt.block_on(async {
        gemini::extract_meeting_notes(&client, &transcription_text, context_str, &language).await
    }).map_err(|e| format!("Failed to regenerate notes: {}", e))?;

    // Update notes in database
    db::meetings::update_meeting_notes(&meeting_id, &language, &notes)
        .map_err(|e| e.to_string())?;

    // Update usage metadata
    let _ = db::gemini_key_metadata::increment_usage(LOCAL_USER);

    Ok(RegenerateNotesResponse {
        success: true,
        notes,
        language,
    })
}