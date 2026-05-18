//! Database module for Remembry local SQLite storage.

pub mod projects;
pub mod meetings;
pub mod documents;
pub mod gemini_key_metadata;
pub mod upload_jobs;

use std::path::PathBuf;
use std::sync::{Arc, Mutex};
use rusqlite::Connection;
use anyhow::Result;

pub use projects::Project;
pub use meetings::Meeting;
pub use meetings::MeetingNotes;
pub use meetings::TranscriptionResult;
pub use documents::Document;
pub use upload_jobs::UploadJobRecord;

pub struct DbPool {
    conn: Arc<Mutex<Connection>>,
}

impl Clone for DbPool {
    fn clone(&self) -> Self {
        Self {
            conn: Arc::clone(&self.conn),
        }
    }
}

pub(crate) static DB_POOL: std::sync::OnceLock<Arc<Mutex<Option<DbPool>>>> = std::sync::OnceLock::new();

fn schema_sql() -> &'static str {
    r#"
    CREATE TABLE IF NOT EXISTS projects (
        id          TEXT PRIMARY KEY,
        display_name TEXT NOT NULL,
        color       TEXT DEFAULT 'bg-blue-500',
        description TEXT DEFAULT '',
        goals       TEXT DEFAULT '',
        created_at  TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS project_documents (
        id           TEXT PRIMARY KEY,
        project_id   TEXT NOT NULL,
        display_name TEXT NOT NULL,
        mime_type    TEXT,
        content      TEXT NOT NULL,
        metadata     TEXT,
        created_at   TEXT NOT NULL,
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS meetings (
        id                   TEXT PRIMARY KEY,
        project_id           TEXT NOT NULL,
        title                TEXT NOT NULL,
        context              TEXT,
        file_name            TEXT,
        file_size            INTEGER,
        mime_type            TEXT,
        file_type            TEXT NOT NULL,
        created_at           TEXT NOT NULL,
        transcription        TEXT,
        notes_by_language    TEXT,
        default_language     TEXT DEFAULT 'en',
        available_languages  TEXT,
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS gemini_key_metadata (
        user_id      TEXT PRIMARY KEY,
        created_at   TEXT,
        last_used    TEXT,
        usage_count  INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS upload_jobs (
        job_id          TEXT PRIMARY KEY,
        status          TEXT NOT NULL,
        progress        INTEGER NOT NULL,
        message         TEXT NOT NULL,
        error           TEXT,
        meeting_id      TEXT,
        project_id      TEXT NOT NULL,
        title           TEXT NOT NULL,
        created_at      TEXT NOT NULL,
        updated_at      TEXT NOT NULL,
        temp_path       TEXT,
        params_json     TEXT,
        gemini_file_name TEXT
    );
    "#
}

impl DbPool {
    pub fn new(db_path: &PathBuf) -> Result<Self> {
        if let Some(parent) = db_path.parent() {
            std::fs::create_dir_all(parent)?;
        }
        let conn = Connection::open(db_path)?;
        conn.execute_batch(schema_sql())?;
        log::info!("SQLite database initialized at {:?}", db_path);
        Ok(Self {
            conn: Arc::new(Mutex::new(conn)),
        })
    }

    pub fn conn(&self) -> Arc<Mutex<Connection>> {
        Arc::clone(&self.conn)
    }
}

pub fn init_db(app_data_dir: &PathBuf) -> Result<()> {
    let db_path = app_data_dir.join("remembry.sqlite3");
    let pool = DbPool::new(&db_path)?;
    DB_POOL.set(Arc::new(Mutex::new(Some(pool)))).ok();
    Ok(())
}

#[allow(dead_code)]
pub fn get_db() -> Option<Arc<Mutex<Option<DbPool>>>> {
    DB_POOL.get().cloned()
}

pub fn with_db<F, T>(f: F) -> Result<T, String>
where
    F: FnOnce(&rusqlite::Connection) -> Result<T, String>,
{
    with_db_impl(DB_POOL.get().cloned(), f)
}

pub fn with_db_impl<F, T>(pool_opt: Option<Arc<Mutex<Option<DbPool>>>>, f: F) -> Result<T, String>
where
    F: FnOnce(&rusqlite::Connection) -> Result<T, String>,
{
    let pool_guard = pool_opt.ok_or_else(|| "Database not initialized".to_string())?;
    let pool = pool_guard.lock().map_err(|_| "Database lock poisoned".to_string())?;
    let pool = pool.as_ref().ok_or_else(|| "Database not initialized".to_string())?;
    let conn_arc = pool.conn();
    let conn_guard = conn_arc.lock().map_err(|_| "Connection lock poisoned".to_string())?;
    f(&conn_guard)
}