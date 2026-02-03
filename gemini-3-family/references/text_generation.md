# Text Generation & Thinking

## Basic Text Generation

Use `gemini-3-pro-preview` for general text generation tasks.

```python
from google import genai
client = genai.Client()

response = client.models.generate_content(
    model="gemini-3-pro-preview",
    contents="Find the race condition in this multi-threaded C++ snippet: [code here]",
)
print(response.text)
```

## Configuring Thinking Level

Control the depth of the model's reasoning process using `thinking_config`.

```python
from google import genai
from google.genai import types

client = genai.Client()

response = client.models.generate_content(
    model="gemini-3-pro-preview",
    contents="How does AI work?",
    config=types.GenerateContentConfig(
        thinking_config=types.ThinkingConfig(thinking_level="low")
    ),
)
print(response.text)
```
