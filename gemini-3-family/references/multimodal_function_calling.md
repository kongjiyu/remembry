# Multimodal Function Calling

This example demonstrates a workflow where the model requests an image via a function call, and the function returns the image data, which the model then processes.

```python
from google import genai
from google.genai import types
import requests

client = genai.Client()

# 1. Define the function
get_image_declaration = types.FunctionDeclaration(
    name="get_image",
    description="Retrieves the image file reference for a specific order item.",
    parameters={
        "type": "object",
        "properties": {
            "item_name": {
                "type": "string",
                "description": "The name or description of the item ordered (e.g., 'instrument')."
            }
        },
        "required": ["item_name"],
    },
)
tool_config = types.Tool(function_declarations=[get_image_declaration])

# 2. Initial Request
prompt = "Show me the instrument I ordered last month."
response_1 = client.models.generate_content(
    model="gemini-3-flash-preview",
    contents=[prompt],
    config=types.GenerateContentConfig(
        tools=[tool_config],
    )
)

# 3. Handle Function Call
function_call = response_1.function_calls[0]
requested_item = function_call.args["item_name"]
print(f"Model wants to call: {function_call.name} for {requested_item}")

# 4. Execute Tool & Prepare Multimodal Response
image_path = "https://goo.gle/instrument-img"
image_bytes = requests.get(image_path).content

function_response_data = {
    "image_ref": {"$ref": "instrument.jpg"},
}

# Create the multimodal function response part
function_response_multimodal_data = types.FunctionResponsePart(
    inline_data=types.FunctionResponseBlob(
        mime_type="image/jpeg",
        display_name="instrument.jpg",
        data=image_bytes,
    )
)

# 5. Send Tool Response back to Model
history = [
    types.Content(role="user", parts=[types.Part(text=prompt)]),
    response_1.candidates[0].content,
    types.Content(
        role="tool",
        parts=[
            types.Part.from_function_response(
                name=function_call.name,
                response=function_response_data,
                parts=[function_response_multimodal_data]
            )
        ],
    )
]

response_2 = client.models.generate_content(
    model="gemini-3-flash-preview",
    contents=history,
    config=types.GenerateContentConfig(
        tools=[tool_config],
        thinking_config=types.ThinkingConfig(include_thoughts=True)
    ),
)
print(f"\nFinal model response: {response_2.text}")
```

