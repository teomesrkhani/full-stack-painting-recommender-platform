import json
import base64
import os
from io import BytesIO
from google import genai
from google.genai import types
from PIL import Image

# Initialize the client outside the handler for reuse across invocations
api_key = os.getenv("GEMINI_API_KEY")
base_url = "https://generativelanguage.googleapis.com/"

client = genai.Client(
    api_key=api_key,
    http_options=types.HttpOptions(
        base_url=base_url,
    ),
)

def lambda_handler(event, context):
    """
    AWS Lambda handler for image generation using Google's Imagen API
    """
    try:
        # Parse the request body
        if 'body' in event:
            if event.get('isBase64Encoded', False):
                body = base64.b64decode(event['body']).decode('utf-8')
            else:
                body = event['body']
            
            if isinstance(body, str):
                data = json.loads(body)
            else:
                data = body
        else:
            data = event
        
        # Extract prompt from request
        prompt = data.get('prompt', '')
        
        if not prompt:
            return {
                'statusCode': 400,
                'headers': {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Headers': 'Content-Type',
                    'Access-Control-Allow-Methods': 'POST, OPTIONS'
                },
                'body': json.dumps({'error': 'No prompt provided'})
            }

        # Generate image using Imagen API
        response = client.models.generate_images(
            model="imagen-3.0-generate-002",
            prompt=prompt,
            config=types.GenerateImagesConfig(
                number_of_images=1,
            )
        )

        if not (response and hasattr(response, "generated_images")):
            return {
                'statusCode': 500,
                'headers': {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Headers': 'Content-Type',
                    'Access-Control-Allow-Methods': 'POST, OPTIONS'
                },
                'body': json.dumps({'error': 'Invalid response from the model'})
            }

        # Process the generated image
        generated_image = response.generated_images[0]
        image = Image.open(BytesIO(generated_image.image.image_bytes))
        
        # Convert image to base64 for HTTP response
        img_byte_arr = BytesIO()
        image.save(img_byte_arr, format='PNG')
        img_byte_arr.seek(0)
        
        # Encode image as base64 for API Gateway response
        image_base64 = base64.b64encode(img_byte_arr.getvalue()).decode('utf-8')
        
        return {
            'statusCode': 200,
            'headers': {
                'Content-Type': 'image/png',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Headers': 'Content-Type',
                'Access-Control-Allow-Methods': 'POST, OPTIONS'
            },
            'isBase64Encoded': True,
            'body': image_base64
        }
        
    except json.JSONDecodeError:
        return {
            'statusCode': 400,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Headers': 'Content-Type',
                'Access-Control-Allow-Methods': 'POST, OPTIONS'
            },
            'body': json.dumps({'error': 'Invalid JSON in request body'})
        }
        
    except Exception as e:
        print(f"Error generating image: {str(e)}")
        return {
            'statusCode': 500,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Headers': 'Content-Type',
                'Access-Control-Allow-Methods': 'POST, OPTIONS'
            },
            'body': json.dumps({'error': f'Internal server error: {str(e)}'})
        }
