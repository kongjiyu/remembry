---
name: gemini-3-family
description: Comprehensive guide for using the Gemini 3 family of models (Pro, Flash, Nano/Image). Use this skill when the user asks about Gemini 3 features, model selection, thinking capabilities, media resolution, or requests code examples for text, image, and multimodal tasks with Gemini 3.
---

# Gemini 3 Family

## Overview

The Gemini 3 family represents Google's most intelligent models to date, optimized for agentic workflows, autonomous coding, and complex multimodal tasks.

## Models

| Model Name | ID | Best For | Context Window |
| :--- | :--- | :--- | :--- |
| **Gemini 3 Pro** | `gemini-3-pro-preview` | Complex tasks, advanced reasoning, world knowledge. | 1M input / 64k output |
| **Gemini 3 Flash** | `gemini-3-flash-preview` | Speed and cost-efficiency with Pro-level intelligence. | 1M input / 64k output |
| **Gemini 3 Pro Image** | `gemini-3-pro-image-preview` | High-quality image generation and editing. | 65k input / 32k output |

**Knowledge Cutoff:** January 2025 for all models.
**Default Temperature:** 1.0 (Recommended for optimal reasoning).

## Key Features

### 1. Thinking Level
Controls the depth of internal reasoning.
- **Options:** `low` (fastest), `high` (default, deepest), `minimal`/`medium` (Flash only).
- **Usage:** Set via `types.ThinkingConfig` in `GenerateContentConfig`.

### 2. Media Resolution
Granular control over vision processing detail.
- **Options:** `media_resolution_low`, `media_resolution_medium`, `media_resolution_high`, `media_resolution_ultra_high`.
- **Usage:** Set in `types.Part` when passing image data (requires `v1alpha` API version).

### 3. Thought Signatures
Encrypted tokens representing the model's reasoning chain. Essential for maintaining context in multi-turn agentic workflows, especially with function calling.

### 4. Structured Outputs & Tools
Native support for:
- Google Search
- Code Execution
- Function Calling (now supports multimodal responses)

## Usage & Examples

Detailed code examples (Python) are available in the reference files:

- **Text Generation & Thinking:** [See text_generation.md](references/text_generation.md)
  - Basic text generation
  - Configuring `thinking_level`

- **Image Analysis & Generation:** [See image_features.md](references/image_features.md)
  - Image understanding with `media_resolution`
  - Image generation with `gemini-3-pro-image-preview`
  - Visual code execution (zooming, cropping, annotating)

- **Multimodal Function Calling:** [See multimodal_function_calling.md](references/multimodal_function_calling.md)
  - Two-turn function calling with image retrieval
  - Returning multimodal objects from functions

## Quick Start (Python)

```python
from google import genai
client = genai.Client()

# Basic Text Generation
response = client.models.generate_content(
    model="gemini-3-pro-preview",
    contents="Explain quantum entanglement."
)
print(response.text)
```