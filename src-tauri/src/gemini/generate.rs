//! Gemini generateContent — transcription and note extraction.

use crate::db::{TranscriptionResult, MeetingNotes};
use crate::gemini::{GeminiClient, retry_with_backoff, is_retryable_error};
use serde::Deserialize;

const TRANSCRIPTION_MODEL: &str = "gemini-3-flash-preview";
const EXTRACTION_MODEL: &str = "gemini-3-flash-preview";

#[derive(Debug, Deserialize)]
struct GeminiResponse {
    candidates: Option<Vec<Candidate>>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct Candidate {
    content: Option<Content>,
}

#[derive(Debug, Deserialize)]
struct Content {
    parts: Vec<Part>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct Part {
    text: Option<String>,
}

pub async fn transcribe_audio(
    client: &GeminiClient,
    file_uri: &str,
    mime_type: &str,
    context: &str,
) -> Result<TranscriptionResult, String> {
    let prompt = format!(
        "You are a professional transcriptionist. Transcribe the audio file exactly as spoken. \
        Include all words, filler words where relevant, and note significant pauses. \
        If there is contextual information, incorporate it: {}\n\nPlease provide ONLY the transcription text, no preamble.",
        context
    );

    let request_body = serde_json::json!({
        "contents": [{
            "parts": [
                { "file_data": { "mime_type": mime_type, "file_uri": file_uri } },
                { "text": prompt }
            ]
        }]
    });

    let response = send_generate_request(client, TRANSCRIPTION_MODEL, request_body).await?;
    let text = parse_gemini_text_response(response)?;

    // Try to detect language from first part or default to 'en'
    let language = None; // Gemini transcription doesn't reliably return language

    Ok(TranscriptionResult { text, language })
}

pub async fn extract_meeting_notes(
    client: &GeminiClient,
    transcription: &str,
    context: &str,
    language: &str,
) -> Result<MeetingNotes, String> {
    let lang_instruction = match language {
        "zh" | "chinese" => "Respond in Chinese (Simplified).",
        "ja" | "japanese" => "Respond in Japanese.",
        "ko" | "korean" => "Respond in Korean.",
        "es" | "spanish" => "Respond in Spanish.",
        "fr" | "french" => "Respond in French.",
        "de" | "german" => "Respond in German.",
        _ => "Respond in English.",
    };

    let prompt = format!(
        r#"You are an AI assistant that analyzes meeting transcripts and extracts structured notes.

Context about this meeting: {}

Please extract the following from the transcript and respond ONLY with valid JSON (no markdown, no explanation):

{{
  "summary": "A 2-3 sentence concise summary of the meeting",
  "action_items": [
    {{ "task": "Description of the task", "assignee": "Name of person responsible (or null)", "due_date": "Due date if mentioned (or null)" }}
  ],
  "decisions": ["Decision 1", "Decision 2"],
  "questions_and_answers": [
    {{ "question": "Question asked", "answer": "Answer given" }}
  ],
  "key_points": ["Key point 1", "Key point 2", "Key point 3"]
}}

Transcript:
{}

{}"#,
        context, transcription, lang_instruction
    );

    let request_body = serde_json::json!({
        "contents": [{
            "parts": [{ "text": prompt }]
        }],
        "generation_config": {
            "temperature": 0.3,
            "top_p": 0.8,
            "max_output_tokens": 2048
        }
    });

    let response = send_generate_request(client, EXTRACTION_MODEL, request_body).await?;
    let text = parse_gemini_text_response(response)?;

    // Try to extract JSON from response (might be wrapped in markdown code blocks)
    let json_str = text.trim()
        .trim_start_matches("```json")
        .trim_start_matches("```")
        .trim_end_matches("```")
        .trim();

    let notes: MeetingNotes = serde_json::from_str(json_str)
        .map_err(|e| format!("Failed to parse meeting notes JSON: {}. Response was: {}", e, text))?;

    Ok(notes)
}

async fn send_generate_request(
    client: &GeminiClient,
    model: &str,
    body: serde_json::Value,
) -> Result<String, String> {
    let url = client.generate_api_uri(model);

    let request = || async {
        let response = client.http()
            .post(&url)
            .header("Content-Type", "application/json")
            .json(&body)
            .send()
            .await
            .map_err(|e| format!("generateContent request failed: {}", e))?;

        let status = response.status();
        if status == reqwest::StatusCode::BAD_REQUEST {
            let body = response.text().await.unwrap_or_default();
            return Err(format!("Bad request: {}", body));
        }
        if is_retryable_error(status) {
            return Err(format!("Request failed with status {}: {:?}", status, response.text().await));
        }

        if !status.is_success() {
            let body = response.text().await.unwrap_or_default();
            return Err(format!("generateContent failed ({}): {}", status, body));
        }

        let gemini_resp: GeminiResponse = response.json().await
            .map_err(|e| format!("Failed to parse Gemini response: {}", e))?;

        let text = gemini_resp.candidates
            .and_then(|c| c.into_iter().next())
            .and_then(|c| c.content)
            .and_then(|mut content| content.parts.pop())
            .and_then(|p| p.text)
            .unwrap_or_default();

        Ok(text)
    };

    retry_with_backoff(request).await
}

fn parse_gemini_text_response(response: String) -> Result<String, String> {
    if response.trim().is_empty() {
        return Err("Empty response from Gemini".to_string());
    }
    Ok(response)
}