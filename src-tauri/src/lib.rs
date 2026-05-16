//! Remembry desktop application library.

mod db;
mod secrets;
mod gemini;
mod uploads;
pub mod commands;

use tauri::Manager;

#[tauri::command]
fn get_app_temp_dir(app: tauri::AppHandle) -> Result<String, String> {
    let path = app.path().temp_dir().map_err(|e| e.to_string())?;
    Ok(path.to_string_lossy().to_string())
}

#[tauri::command]
fn get_app_data_dir(app: tauri::AppHandle) -> Result<String, String> {
    let path = app.path().app_data_dir().map_err(|e| e.to_string())?;
    Ok(path.to_string_lossy().to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    env_logger::Builder::from_env(env_logger::Env::default().default_filter_or("info")).init();
    log::info!("Starting Remembry desktop application");

    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            get_app_temp_dir,
            get_app_data_dir,
            commands::projects::list_projects,
            commands::projects::create_project,
            commands::projects::delete_project,
            commands::projects::get_project,
            commands::meetings::list_meetings,
            commands::meetings::get_meeting,
            commands::meetings::get_meeting_metadata,
            commands::meetings::upsert_meeting,
            commands::notes::get_meeting_notes,
            commands::notes::update_meeting_notes,
            commands::notes::extract_meeting_notes,
            commands::notes::regenerate_meeting_notes,
            commands::gemini_key::get_gemini_key_status,
            commands::gemini_key::save_gemini_key,
            commands::gemini_key::delete_gemini_key,
            commands::uploads::start_upload,
            commands::uploads::append_upload_chunk,
            commands::uploads::process_meeting_upload,
            commands::uploads::cancel_upload,
        ])
        .setup(|app| {
            // Initialize database
            let app_data_dir = app.path().app_data_dir().map_err(|e| {
                log::error!("Failed to get app data dir: {}", e);
                e
            })?;
            log::info!("App data directory: {:?}", app_data_dir);

            db::init_db(&app_data_dir).map_err(|e| {
                log::error!("Failed to initialize database: {}", e);
                anyhow::anyhow!("{}", e)
            })?;

            log::info!("Remembry setup complete");
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}