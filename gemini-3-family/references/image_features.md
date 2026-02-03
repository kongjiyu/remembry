# Image Analysis & Generation

## Image Understanding with Media Resolution

Control the resolution of image input for detailed analysis. Note: This requires the `v1alpha` API version.

```python
from google import genai
from google.genai import types
import base64

client = genai.Client(http_options={'api_version': 'v1alpha'}) 

response = client.models.generate_content(
    model="gemini-3-pro-preview",
    contents=[
        types.Content(
            parts=[
                types.Part(text="What is in this image?"),
                types.Part(
                    inline_data=types.Blob(
                        mime_type="image/jpeg",
                        data=base64.b64decode("..."), # Replace with base64 encoded image
                    ),
                    media_resolution={"level": "media_resolution_high"}
                )
            ]
        )
    ]
)
print(response.text)
```

## Image Generation

Use `gemini-3-pro-image-preview` to generate images.

```python
from google import genai
from google.genai import types

client = genai.Client()

response = client.models.generate_content(
    model="gemini-3-pro-image-preview",
    contents="Generate an infographic of the current weather in Tokyo.",
    config=types.GenerateContentConfig(
        tools=[{"google_search": {}}],
        image_config=types.ImageConfig(
            aspect_ratio="16:9",
            image_size="4K"
        )
    )
)
# The response will contain the generated image data
```

## Code Execution with Images

`gemini-3-flash-preview` can use code execution to manipulate and analyze images (e.g., zoom, crop).

```python
from google import genai
from google.genai import types
import requests

image_path = "https://goo.gle/instrument-img"
image_bytes = requests.get(image_path).content
image = types.Part.from_bytes(data=image_bytes, mime_type="image/jpeg")

client = genai.Client()

response = client.models.generate_content(
    model="gemini-3-flash-preview",
    contents=[
        image,
        "Zoom into the expression pedals and tell me how many pedals are there?"
    ],
    config=types.GenerateContentConfig(
        tools=[types.Tool(code_execution=types.ToolCodeExecution)]
    ),
)
# The response will contain the result of the code execution and the final answer
```
