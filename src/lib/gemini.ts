import { GoogleGenAI } from "@google/genai";
import { createWriteStream, createReadStream } from "fs";
import * as path from "path";
import * as os from "os";
import { mkdtemp, rm, readFile } from "fs/promises";

function createGeminiClient(apiKey?: string): GoogleGenAI {
    const resolvedApiKey = apiKey || process.env.GEMINI_API_KEY || process.env.API_KEY;
    if (!resolvedApiKey) {
        throw new Error("Gemini API key is not set");
    }
    return new GoogleGenAI({ apiKey: resolvedApiKey });
}

// Model configuration:
// - Transcription: Use lighter/faster model for high-volume transcription
// - Analysis: Use powerful model for deep understanding

// Transcription model - gemini-3.1-flash-lite-preview for fast, efficient transcription
export const TRANSCRIPTION_MODEL = "gemini-3.1-flash-lite-preview";

// Analysis model - more powerful model for final synthesis
export const ANALYSIS_MODEL = "gemini-3-flash-preview";

export interface TranscriptionResult {
    text: string;
    segments: TranscriptionSegment[];
    speakers: string[];
    duration: number;
    language?: string;
    debug?: {
        prompt: string;
        response: string;
    };
}

export interface TranscriptionSegment {
    speaker: string;
    text: string;
    startTime?: number;
    endTime?: number;
}

/**
 * Sleep for a given number of milliseconds
 */
function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Retry a function with exponential backoff
 */
async function retryWithBackoff<T>(
    fn: () => Promise<T>,
    maxRetries: number = 5,
    initialDelay: number = 5000
): Promise<T> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            return await fn();
        } catch (error: unknown) {
            lastError = error instanceof Error ? error : new Error(String(error));

            // Check if it's a rate limit error (429)
            const errorMessage = lastError.message || "";
            const isRateLimited = errorMessage.includes("429") ||
                                  errorMessage.includes("RESOURCE_EXHAUSTED") ||
                                  errorMessage.includes("quota");

            // Check if it's a network error
            const isNetworkError = errorMessage.includes("fetch failed") ||
                                   errorMessage.includes("ECONNREFUSED") ||
                                   errorMessage.includes("ETIMEDOUT") ||
                                   errorMessage.includes("network");

            // Check if it's a server error (500, 502, 503, 504) or internal error
            const isServerError = errorMessage.includes("500") ||
                                  errorMessage.includes("502") ||
                                  errorMessage.includes("503") ||
                                  errorMessage.includes("504") ||
                                  errorMessage.includes("UNAVAILABLE") ||
                                  errorMessage.includes("INTERNAL") ||
                                  errorMessage.includes("Failed to convert server response to JSON");

            // Check if it's a high demand error
            const isHighDemand = errorMessage.includes("high demand") ||
                                 errorMessage.includes("overloaded");

            // Retry on network errors, rate limits, server errors, or high demand
            if ((isRateLimited || isNetworkError || isServerError || isHighDemand) && attempt < maxRetries) {
                // Extract retry delay from error if available
                const retryMatch = errorMessage.match(/retry in (\d+(?:\.\d+)?)/i);
                const suggestedDelay = retryMatch ? parseFloat(retryMatch[1]) * 1000 : null;

                const delay = suggestedDelay || (initialDelay * Math.pow(2, attempt));
                let reason = "Unknown retry reason";
                if (isRateLimited) reason = "Rate limited";
                else if (isNetworkError) reason = "Network error";
                else if (isServerError) reason = "Server error";
                else if (isHighDemand) reason = "High demand";

                console.log(`${reason}. Retrying in ${Math.round(delay / 1000)}s (attempt ${attempt + 1}/${maxRetries})...`);
                await sleep(delay);
            } else {
                throw lastError;
            }
        }
    }

    throw lastError || new Error("Max retries exceeded");
}

/**
 * Transcribe audio using the lighter model for speed
 * Uses gemini-2.0-flash for fast, reliable transcription
 */
export async function transcribeAudio(
    filePath: string,
    mimeType: string,
    context?: string,
    apiKey?: string
): Promise<TranscriptionResult> {
    const genAI = createGeminiClient(apiKey);
    console.log(`Uploading file for transcription: ${filePath}`);

    // Upload the file to Gemini
    const uploadResult = await genAI.files.upload({
        file: filePath,
        config: {
            mimeType: mimeType,
        }
    });

    const fileUri = uploadResult.uri;
    const fileName = uploadResult.name;

    if (!fileName) {
        throw new Error("Failed to get file name from upload result");
    }

    console.log(`File uploaded: ${fileUri} (${fileName})`);

    // Wait for the file to be active
    let file = await genAI.files.get({ name: fileName });

    // Polling loop with robust error handling for 500s during processing
    while (file.state === "PROCESSING") {
        console.log("File is processing...");
        await sleep(5000); // Check every 5 seconds for larger files

        try {
            file = await genAI.files.get({ name: fileName });
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } catch (error: any) {
            // Ignore transient errors during polling
            if (error.message?.includes("500") || error.message?.includes("INTERNAL") || error.message?.includes("json")) {
                console.warn("Transient API error during polling, continuing...", error.message);
                continue;
            }
            throw error;
        }
    }

    if (file.state === "FAILED") {
        throw new Error("File processing failed");
    }

    console.log(`File is active. Starting transcription...`);

    const additionalContext = context
        ? `\nContext provided by user: "${context}". Use this to improve accuracy of technical terms and names.`
        : "";

    const prompt = `You are an expert transcription assistant. Your job is to produce ACCURATE, NON-REPETITIVE transcriptions.

CRITICAL: PREVENT REPETITION
- NEVER repeat the same content, sentence, or phrase more than once
- If content appears similar to what you already transcribed, STOP - do not re-transcribe it
- The transcript should progress FORWARD through the conversation, not loop back
- If you find yourself about to repeat content that already appeared, move to the next topic

SEGMENT REQUIREMENTS:
- Split into segments of 2-5 minutes each (120-300 seconds)
- Each segment must contain DIFFERENT content from other segments
- Use speaker labels with voice descriptions in format: "Person A (deep male voice, slow speaker)"
- If only one speaker, still create multiple segments covering different topics/time periods

VOICE DESCRIPTIONS (CRITICAL for consistency):
- Voice pitch: deep, medium, high
- Speaking pace: slow, moderate, fast
- Distinctive traits: slight accent, hesitant, enthusiastic, monotone, etc.
- Gender hints if clear: male, female (don't assume if unclear)
- SAME speaker must have SAME voice description in ALL segments

TRANSCRIPTION RULES:
1. CRITICAL - Transcribe in the ORIGINAL LANGUAGE. Do NOT translate. Preserve code-switching exactly.
2. Skip excessive filler words: 啊, 哦, 嗯, um, uh, like, you know (unless they add meaning)
3. Technical terms, product names, proper nouns must be accurate
4. Add proper punctuation for readability
5. Do NOT repeat any content that was already transcribed in a previous segment

SEGMENT TIMING:
- Each segment must have startTime and endTime (in seconds)
- Segments should be sequential and cover the full audio without gaps
- endTime of one segment should equal startTime of the next segment

OUTPUT FORMAT (MUST follow exactly):
{
    "text": "Full transcription in original language(s) - NO REPETITION",
    "segments": [
        {
            "speaker": "Person A (deep male voice, slow speaker)",
            "text": "First topic or point - unique content not repeated elsewhere",
            "startTime": 0.0,
            "endTime": 180.0
        },
        {
            "speaker": "Person B (high female voice, fast)",
            "text": "Response or new point - completely different from previous segments",
            "startTime": 180.5,
            "endTime": 360.0
        }
    ],
    "speakers": [
        "Person A (deep male voice, slow speaker)",
        "Person B (high female voice, fast)"
    ],
    "language": "Detected primary language code"
}

IMPORTANT: If this audio is part of a larger chunked file, match the speaker voice descriptions from previous chunks EXACTLY. Do not describe the same speaker differently.

Return ONLY the JSON object, no additional text.`;

    // Use lighter model for transcription (fast and reliable)
    const model = TRANSCRIPTION_MODEL;
    console.log(`Transcribing with model: ${model}`);

    try {
        const response = await retryWithBackoff(async () => {
            return await genAI.models.generateContent({
                model: model,
                contents: [
                    {
                        role: "user",
                        parts: [
                            {
                                fileData: {
                                    mimeType: file.mimeType,
                                    fileUri: file.uri
                                }
                            },
                            { text: prompt }
                        ],
                    },
                ],
                config: {
                    temperature: 1.0,
                },
            });
        });

        const responseText = response.text || "";

        // Parse the JSON response
        try {
            let jsonStr = responseText;
            const jsonMatch = responseText.match(/```(?:json)?\s*([\s\S]*?)```/);
            if (jsonMatch) {
                jsonStr = jsonMatch[1].trim();
            }

            const result = JSON.parse(jsonStr);

            return {
                text: result.text || "",
                segments: result.segments || [],
                speakers: result.speakers || [],
                duration: 0,
                language: result.language,
                debug: {
                    prompt,
                    response: responseText
                }
            };
        } catch {
            console.error("Failed to parse transcription JSON, returning raw text");
            return {
                text: responseText,
                segments: [{ speaker: "Unknown", text: responseText }],
                speakers: ["Unknown"],
                duration: 0,
                language: "en",
                debug: {
                    prompt,
                    response: responseText
                }
            };
        }
    } catch (error) {
        // Transcription failed with the lighter model
        const err = error instanceof Error ? error : new Error(String(error));
        console.error(`Transcription failed with model ${model}:`, err.message);
        throw err;
    }
}

export interface MeetingNotes {
    summary: string;
    keyTopics: string[];
    actionItems: string[];
    decisions: string[];
    assumptions: string[];
    qa: Array<{ question: string; answer: string }>;
    language?: string; // Language code of the notes
}

// Supported languages for meeting notes
export const SUPPORTED_LANGUAGES = [
    { code: 'en', name: 'English' },
    { code: 'zh', name: '中文 (Chinese)' },
    { code: 'ms', name: 'Bahasa Melayu' },
    { code: 'ja', name: '日本語 (Japanese)' },
    { code: 'ko', name: '한국어 (Korean)' },
    { code: 'es', name: 'Español (Spanish)' },
    { code: 'fr', name: 'Français (French)' },
    { code: 'de', name: 'Deutsch (German)' },
    { code: 'pt', name: 'Português (Portuguese)' },
    { code: 'th', name: 'ไทย (Thai)' },
    { code: 'vi', name: 'Tiếng Việt (Vietnamese)' },
    { code: 'id', name: 'Bahasa Indonesia' },
] as const;

export type SupportedLanguageCode = typeof SUPPORTED_LANGUAGES[number]['code'];

/**
 * Direct audio analysis - skips transcription, directly extracts structured meeting notes
 * Uses gemini-3.1-flash-lite-preview for fast, efficient analysis
 */
export async function analyzeAudioDirect(
    filePath: string,
    mimeType: string,
    context?: string,
    targetLanguage: string = 'en',
    apiKey?: string
): Promise<MeetingNotes> {
    const genAI = createGeminiClient(apiKey);
    console.log(`Uploading audio for direct analysis: ${filePath}`);

    // Upload the file to Gemini
    const uploadResult = await genAI.files.upload({
        file: filePath,
        config: {
            mimeType: mimeType,
        }
    });

    const fileUri = uploadResult.uri;
    const fileName = uploadResult.name;

    if (!fileName) {
        throw new Error("Failed to get file name from upload result");
    }

    console.log(`File uploaded: ${fileUri} (${fileName})`);

    // Wait for the file to be active
    let file = await genAI.files.get({ name: fileName });

    while (file.state === "PROCESSING") {
        console.log("File is processing...");
        await sleep(5000);

        try {
            file = await genAI.files.get({ name: fileName });
        } catch (error: any) {
            if (error.message?.includes("500") || error.message?.includes("INTERNAL") || error.message?.includes("json")) {
                console.warn("Transient API error during polling, continuing...");
                continue;
            }
            throw error;
        }
    }

    if (file.state === "FAILED") {
        throw new Error("File processing failed");
    }

    console.log(`File is active. Starting direct analysis...`);

    const additionalContext = context
        ? `\nContext: "${context}"`
        : "";

    const languageName = SUPPORTED_LANGUAGES.find(l => l.code === targetLanguage)?.name || 'English';

    const prompt = `You are an expert meeting analyst. Analyze this audio recording and extract structured meeting information.

CRITICAL OUTPUT RULES:
- Output ALL content in ${languageName} (${targetLanguage})
- Keep technical terms, product names, code snippets in original language
- NEVER repeat any content - each section must be unique

STRUCTURE YOUR RESPONSE AS:
1. summary: 2-3 paragraphs summarizing the meeting
2. keyTopics: 5-8 main topics discussed
3. actionItems: Tasks with assignees if mentioned
4. decisions: Key decisions made
5. assumptions: Explicit or implicit assumptions
6. qa: Important Q&A pairs

OUTPUT FORMAT (MUST be valid JSON):
{
    "summary": "...",
    "keyTopics": ["..."],
    "actionItems": ["..."],
    "decisions": ["..."],
    "assumptions": ["..."],
    "qa": [{"question": "...", "answer": "..."}]
}

Return ONLY the JSON object, no additional text.`;

    try {
        const response = await retryWithBackoff(async () => {
            return await genAI.models.generateContent({
                model: TRANSCRIPTION_MODEL,  // Use fast model for analysis
                contents: [
                    {
                        role: "user",
                        parts: [
                            {
                                fileData: {
                                    mimeType: file.mimeType,
                                    fileUri: file.uri
                                }
                            },
                            { text: prompt }
                        ],
                    },
                ],
                config: {
                    temperature: 1.0,
                },
            });
        });

        const responseText = response.text || "";

        try {
            let jsonStr = responseText;
            const jsonMatch = responseText.match(/```(?:json)?\s*([\s\S]*?)```/);
            if (jsonMatch) {
                jsonStr = jsonMatch[1].trim();
            }
            const parsed = JSON.parse(jsonStr);
            return {
                ...parsed,
                language: targetLanguage
            };
        } catch {
            console.error("Failed to parse analysis JSON");
            return {
                summary: "Failed to generate summary from audio.",
                keyTopics: [],
                actionItems: [],
                decisions: [],
                assumptions: [],
                qa: [],
                language: targetLanguage
            };
        }
    } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error));
        console.error(`Direct audio analysis failed:`, err.message);
        throw err;
    }
}

/**
 * Extract meeting notes (summary, action items, decisions, Q&A) from transcription
 * @param transcriptionText - The transcription text to analyze
 * @param context - Additional context about the meeting
 * @param targetLanguage - Target language code for the notes output (default: 'en')
 */
export async function extractMeetingNotes(
    transcriptionText: string,
    context?: string,
    targetLanguage: string = 'en',
    apiKey?: string
): Promise<MeetingNotes> {
    const genAI = createGeminiClient(apiKey);
    const additionalContext = context 
        ? `\nAdditional Context: "${context}"` 
        : "";

    const languageName = SUPPORTED_LANGUAGES.find(l => l.code === targetLanguage)?.name || 'English';

    const prompt = `You are an expert meeting secretary. Please analyze the following meeting transcription and extract key information.

**IMPORTANT OUTPUT LANGUAGE INSTRUCTION**: 
- Output ALL content in ${languageName} (${targetLanguage}).
- EXCEPTION: Keep technical terms, product names, code snippets, proper nouns, and domain-specific jargon in their ORIGINAL language.
- For example: "GitHub", "API", "database", "React", etc. should remain unchanged.

Transcription:
"${transcriptionText}"
${additionalContext}

Please provide the following outputs in JSON format (remember to write in ${languageName}):
1. **summary**: A concise executive summary of the meeting (2-3 paragraphs) in ${languageName}.
2. **keyTopics**: A list of the main topics or themes discussed in the meeting in ${languageName}.
3. **actionItems**: A list of actionable tasks assigned to specific people (include the assignee if known) in ${languageName}.
4. **decisions**: A list of key decisions made during the meeting in ${languageName}.
5. **assumptions**: A list of explicit or implicit assumptions made during the discussion in ${languageName}.
6. **qa**: A list of important questions asked and their answers in ${languageName}.

Format:
{
    "summary": "...",
    "keyTopics": ["Topic 1", "Topic 2"],
    "actionItems": ["Task 1 (Assignee)", "Task 2"],
    "decisions": ["Decision 1", "Decision 2"],
    "assumptions": ["Assumption 1", "Assumption 2"],
    "qa": [
        { "question": "...", "answer": "..." }
    ]
}

Return ONLY the JSON object.`;

    const response = await retryWithBackoff(async () => {
        return await genAI.models.generateContent({
            model: ANALYSIS_MODEL,
            contents: [{ role: "user", parts: [{ text: prompt }] }],
            config: {
                temperature: 1.0,
            },
        });
    });

    const responseText = response.text || "";

    try {
        let jsonStr = responseText;
        const jsonMatch = responseText.match(/```(?:json)?\s*([\s\S]*?)```/);
        if (jsonMatch) {
            jsonStr = jsonMatch[1].trim();
        }
        const parsed = JSON.parse(jsonStr);
        return {
            ...parsed,
            language: targetLanguage
        };
    } catch (e) {
        console.error("Failed to parse meeting notes JSON", e);
        return {
            summary: "Failed to generate summary.",
            keyTopics: [],
            actionItems: [],
            decisions: [],
            assumptions: [],
            qa: [],
            language: targetLanguage
        };
    }
}
