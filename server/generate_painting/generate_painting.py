from google import genai
from google.genai import types
from PIL import Image
import os
from io import BytesIO
from flask import Flask, request, send_file
from flask_cors import CORS

app = Flask(__name__)
CORS(app)

api_key = os.getenv("GEMINI_API_KEY")
base_url = "https://generativelanguage.googleapis.com/"

client = genai.Client(
    api_key=api_key,
    http_options=types.HttpOptions(
        base_url=base_url,
    ),
)

@app.route('/generate-painting', methods=['POST'])
def generate_painting():
    data = request.get_json()
    prompt = data.get('prompt', '')
    
    if not prompt:
        return {'error': 'No prompt provided'}, 400

    response = client.models.generate_images(
        model="imagen-3.0-generate-002",
        prompt=prompt,
        config=types.GenerateImagesConfig(
            number_of_images=1,
        )
    )

    if not (response and hasattr(response, "generated_images")):
        return {'error': 'Invalid response from the model'}, 500

    generated_image = response.generated_images[0]
    image = Image.open(BytesIO(generated_image.image.image_bytes))
        
    # Convert the image to bytes
    img_byte_arr = BytesIO()
    image.save(img_byte_arr, format='PNG')
    img_byte_arr.seek(0)
    
    return send_file(
        img_byte_arr,
        mimetype='image/png',
        as_attachment=False
    )

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5051)
