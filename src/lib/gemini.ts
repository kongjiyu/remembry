import { GoogleGenAI, FileState } from "@google/genai";

const apiKey = process.env.GEMINI_API_KEY;

if (!apiKey) {
    throw new Error("GEMINI_API_KEY environment variable is not set");
}

export const genAI = new GoogleGenAI({ apiKey });

// Use Gemini 3 Flash for optimal performance and reasoning
export const TRANSCRIPTION_MODEL = "gemini-3-flash-preview";

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
    maxRetries: number = 3,
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
            
            if (!isRateLimited || attempt === maxRetries) {
                throw lastError;
            }
            
            // Extract retry delay from error if available
            const retryMatch = errorMessage.match(/retry in (\d+(?:\.\d+)?)/i);
            const suggestedDelay = retryMatch ? parseFloat(retryMatch[1]) * 1000 : null;
            
            const delay = suggestedDelay || (initialDelay * Math.pow(2, attempt));
            console.log(`Rate limited. Retrying in ${Math.round(delay / 1000)}s (attempt ${attempt + 1}/${maxRetries})...`);
            await sleep(delay);
        }
    }
    
    throw lastError || new Error("Max retries exceeded");
}

/**
 * Transcribe audio using Gemini 2.0 Flash and File API
 */
export async function transcribeAudio(
    filePath: string,
    mimeType: string,
    context?: string
): Promise<TranscriptionResult> {
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
    while (file.state === "PROCESSING") {
        console.log("File is processing...");
        await sleep(2000);
        file = await genAI.files.get({ name: fileName });
    }

    if (file.state === "FAILED") {
        throw new Error("File processing failed");
    }

    console.log(`File is active. Starting transcription...`);

    const additionalContext = context
        ? `\nContext provided by user: "${context}". Use this to improve accuracy of technical terms and names.`
        : "";

    const prompt = `You are an expert transcription assistant. Please transcribe this audio recording with the following requirements:

1. **Speaker Identification**: Do NOT attempt to identify specific speakers by name or label (like "Speaker 1"). Treat the entire audio as a single continuous transcription or simple segments if there are clear pauses.

2. **Context**: ${additionalContext}

3. **Format**: Return the transcription in the following JSON format:
{
    "text": "The full transcription text",
    "segments": [
        {
            "speaker": "Speaker",
            "text": "What was said",
            "startTime": 0.0,
            "endTime": 1.5
        }
    ],
    "speakers": [],
    "language": "Detected language code (e.g., 'en', 'es', 'zh')"
}

4. **Accuracy**: Transcribe as accurately as possible, including:
   - Filler words (um, uh) only if they seem intentional
   - Technical terms and proper nouns correctly
   - Punctuation for readability

5. **Timestamps**: If you can detect timing, include startTime and endTime in seconds for each segment.

Return ONLY the JSON object, no additional text.`;

    const response = await retryWithBackoff(async () => {
        return await genAI.models.generateContent({
            model: TRANSCRIPTION_MODEL,
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
                temperature: 1.0, // Gemini 3 defaults to 1.0 for optimal reasoning
            },
        });
    });

    const responseText = response.text || "";
    
    // Parse the JSON response
    try {
        // Extract JSON from the response (handle markdown code blocks)
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
            duration: 0, // Will be set by caller or could be inferred
            language: result.language,
            debug: {
                prompt,
                response: responseText
            }
        };
    } catch {
        // If JSON parsing fails, return the raw text as a single segment
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
}

export interface MeetingNotes {
    summary: string;
    keyTopics: string[];
    actionItems: string[];
    decisions: string[];
    assumptions: string[];
    qa: Array<{ question: string; answer: string }>;
}

/**
 * Extract meeting notes (summary, action items, decisions, Q&A) from transcription
 */
export async function extractMeetingNotes(transcriptionText: string, context?: string): Promise<MeetingNotes> {
    const additionalContext = context 
        ? `\nAdditional Context: "${context}"` 
        : "";

    const prompt = `You are an expert meeting secretary. Please analyze the following meeting transcription and extract key information.

Transcription:
"${transcriptionText}"
${additionalContext}

Please provide the following outputs in JSON format:
1. **summary**: A concise executive summary of the meeting (2-3 paragraphs).
2. **keyTopics**: A list of the main topics or themes discussed in the meeting.
3. **actionItems**: A list of actionable tasks assigned to specific people (include the assignee if known).
4. **decisions**: A list of key decisions made during the meeting.
5. **assumptions**: A list of explicit or implicit assumptions made during the discussion.
6. **qa**: A list of important questions asked and their answers.

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
            model: TRANSCRIPTION_MODEL,
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
        return JSON.parse(jsonStr);
    } catch (e) {
        console.error("Failed to parse meeting notes JSON", e);
        return {
            summary: "Failed to generate summary.",
            keyTopics: [],
            actionItems: [],
            decisions: [],
            assumptions: [],
            qa: []
        };
    }
}
