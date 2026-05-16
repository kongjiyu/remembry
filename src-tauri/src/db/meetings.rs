//! Meeting database operations.

use crate::db::with_db;
use rusqlite::params;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Meeting {
    pub id: String,
    pub project_id: String,
    pub title: String,
    pub context: Option<String>,
    pub file_name: Option<String>,
    pub file_size: Option<i64>,
    pub mime_type: Option<String>,
    pub file_type: String,
    pub created_at: String,
    pub transcription: Option<TranscriptionResult>,
    pub notes_by_language: Option<serde_json::Value>,
    pub default_language: Option<String>,
    pub available_languages: Option<Vec<String>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TranscriptionResult {
    pub text: String,
    pub language: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MeetingNotes {
    pub summary: String,
    pub action_items: Vec<ActionItem>,
    pub decisions: Vec<String>,
    pub questions_and_answers: Vec<QAndA>,
    pub key_points: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ActionItem {
    pub task: String,
    pub assignee: Option<String>,
    pub due_date: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct QAndA {
    pub question: String,
    pub answer: String,
}

pub fn list_meetings(project_id: Option<&str>) -> Result<Vec<Meeting>, String> {
    with_db(|conn| {
        let sql = match project_id {
            Some(_) => "SELECT id, project_id, title, context, file_name, file_size, mime_type, file_type, created_at, transcription, notes_by_language, default_language, available_languages FROM meetings WHERE project_id = ?1 ORDER BY created_at DESC",
            None => "SELECT id, project_id, title, context, file_name, file_size, mime_type, file_type, created_at, transcription, notes_by_language, default_language, available_languages FROM meetings ORDER BY created_at DESC",
        };

        let mut stmt = conn.prepare(sql).map_err(|e| e.to_string())?;

        let rows = if let Some(pid) = project_id {
            stmt.query_map(params![pid], meeting_row_map)
        } else {
            stmt.query_map([], meeting_row_map)
        }.map_err(|e| e.to_string())?;

        rows.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())
    }).map_err(|e| e.to_string())
}

fn meeting_row_map(row: &rusqlite::Row) -> rusqlite::Result<Meeting> {
    let transcription_str: Option<String> = row.get(9)?;
    let notes_by_language_str: Option<String> = row.get(10)?;
    let available_languages_str: Option<String> = row.get(12)?;

    Ok(Meeting {
        id: row.get(0)?,
        project_id: row.get(1)?,
        title: row.get(2)?,
        context: row.get(3)?,
        file_name: row.get(4)?,
        file_size: row.get(5)?,
        mime_type: row.get(6)?,
        file_type: row.get(7)?,
        created_at: row.get(8)?,
        transcription: transcription_str.and_then(|s| serde_json::from_str(&s).ok()),
        notes_by_language: notes_by_language_str.and_then(|s| serde_json::from_str(&s).ok()),
        default_language: row.get(11)?,
        available_languages: available_languages_str.and_then(|s| serde_json::from_str(&s).ok()),
    })
}

pub fn get_meeting(meeting_id: &str) -> Result<Option<Meeting>, String> {
    with_db(|conn| {
        let mut stmt = conn.prepare(
            "SELECT id, project_id, title, context, file_name, file_size, mime_type, file_type, created_at, transcription, notes_by_language, default_language, available_languages FROM meetings WHERE id = ?1"
        ).map_err(|e| e.to_string())?;

        let mut rows = stmt.query_map(params![meeting_id], meeting_row_map)
            .map_err(|e| e.to_string())?;

        Ok(rows.next().transpose().map_err(|e| e.to_string())?)
    }).map_err(|e| e.to_string())
}

pub fn upsert_meeting(meeting: &Meeting) -> Result<(), String> {
    with_db(|conn| {
        let transcription_json = meeting.transcription.as_ref()
            .and_then(|t| serde_json::to_string(t).ok());
        let notes_json = meeting.notes_by_language.as_ref()
            .and_then(|n| serde_json::to_string(n).ok());
        let available_langs_json = meeting.available_languages.as_ref()
            .and_then(|a| serde_json::to_string(a).ok());

        conn.execute(
            "INSERT OR REPLACE INTO meetings (id, project_id, title, context, file_name, file_size, mime_type, file_type, created_at, transcription, notes_by_language, default_language, available_languages) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13)",
            params![
                meeting.id,
                meeting.project_id,
                meeting.title,
                meeting.context,
                meeting.file_name,
                meeting.file_size,
                meeting.mime_type,
                meeting.file_type,
                meeting.created_at,
                transcription_json,
                notes_json,
                meeting.default_language,
                available_langs_json,
            ],
        ).map_err(|e| e.to_string())?;

        Ok(())
    }).map_err(|e| e.to_string())
}

pub fn get_meeting_notes(meeting_id: &str, language: &str) -> Result<Option<MeetingNotes>, String> {
    with_db(|conn| {
        let mut stmt = conn.prepare("SELECT notes_by_language FROM meetings WHERE id = ?1")
            .map_err(|e| e.to_string())?;
        let notes_json: Option<String> = stmt.query_row(params![meeting_id], |row| row.get(0))
            .map_err(|e| e.to_string())
            .ok();

        let notes_value = match notes_json {
            Some(s) => serde_json::from_str::<serde_json::Value>(&s).map_err(|e| e.to_string())?,
            None => return Ok(None),
        };

        let lang_notes = if language == "en" {
            notes_value.get("en").or(notes_value.get("default"))
        } else {
            notes_value.get(language)
        };

        match lang_notes {
            Some(v) => {
                let notes: MeetingNotes = serde_json::from_value(v.clone())
                    .map_err(|e| e.to_string())?;
                Ok(Some(notes))
            }
            None => Ok(None),
        }
    }).map_err(|e| e.to_string())
}

pub fn update_meeting_notes(meeting_id: &str, language: &str, notes: &MeetingNotes) -> Result<(), String> {
    with_db(|conn| {
        let mut stmt = conn.prepare("SELECT notes_by_language FROM meetings WHERE id = ?1")
            .map_err(|e| e.to_string())?;
        let existing: Option<String> = stmt.query_row(params![meeting_id], |row| row.get(0))
            .map_err(|e| e.to_string())
            .ok();

        let mut notes_map = existing
            .and_then(|s| serde_json::from_str::<serde_json::Map<String, serde_json::Value>>(&s).ok())
            .unwrap_or_default();

        let notes_value = serde_json::to_value(notes).map_err(|e| e.to_string())?;
        notes_map.insert(language.to_string(), notes_value);

        let notes_json = serde_json::to_string(&notes_map).map_err(|e| e.to_string())?;

        let languages: Vec<String> = notes_map.keys().cloned().collect();
        let langs_json = serde_json::to_string(&languages).map_err(|e| e.to_string())?;

        conn.execute(
            "UPDATE meetings SET notes_by_language = ?1, available_languages = ?2, default_language = COALESCE(default_language, ?3) WHERE id = ?4",
            params![notes_json, langs_json, language, meeting_id],
        ).map_err(|e| e.to_string())?;

        Ok(())
    }).map_err(|e| e.to_string())
}

pub fn get_meeting_metadata(meeting_id: &str) -> Result<Option<MeetingMetadata>, String> {
    with_db(|conn| {
        let mut stmt = conn.prepare(
            "SELECT available_languages, default_language, created_at FROM meetings WHERE id = ?1"
        ).map_err(|e| e.to_string())?;

        let row = stmt.query_row(params![meeting_id], |row| {
            let langs_str: Option<String> = row.get(0)?;
            let available_languages = langs_str.and_then(|s| serde_json::from_str(&s).ok());
            Ok(MeetingMetadata {
                available_languages,
                default_language: row.get(1)?,
                created_at: row.get(2)?,
            })
        }).map_err(|e| e.to_string()).ok();

        Ok(row)
    }).map_err(|e| e.to_string())
}

#[derive(Debug, Clone, serde::Serialize)]
pub struct MeetingMetadata {
    pub available_languages: Option<Vec<String>>,
    pub default_language: Option<String>,
    pub created_at: Option<String>,
}