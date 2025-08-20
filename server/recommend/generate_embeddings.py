import json
import os
import time
from openai import OpenAI
from dotenv import load_dotenv

# It's a good practice to load environment variables from a .env file
load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), '..', '.env'))

# Make sure you have OPENAI_API_KEY in your .env file or environment
client = OpenAI()

def get_embedding(text, model="text-embedding-3-large"):
    """Gets an embedding from OpenAI for the given text."""
    text = text.replace("\n", " ")
    try:
        response = client.embeddings.create(input=[text], model=model, dimensions=1536)
        return response.data[0].embedding
    except Exception as e:
        return None

def create_description(painting_info, artist_name):
    """Creates a descriptive string from painting metadata."""
    title = painting_info.get("Artwork", "Untitled")
    movements = painting_info.get("ArtMovements", "Unknown Movement")
    genre = painting_info.get("Genre", "Unknown Genre")
    return f'"{title}" by {artist_name}. Style: {movements}. Genre: {genre}.'

def process_paintings(input_path, output_path):
    """
    Processes paintings from the input JSON file, generates embeddings,
    and saves them to the output file.
    """
    try:
        with open(input_path, 'r') as f:
            artist_data = json.load(f)
    except FileNotFoundError:
        return

    all_embeddings = []
    total_artists = len(artist_data)
    
    for i, (artist_name, paintings) in enumerate(artist_data.items()):
        for painting in paintings:
            description = create_description(painting, artist_name)
            
            # Generate a unique ID for each painting if it doesn't have one
            if 'id' not in painting:
                painting['id'] = f"{artist_name.replace(' ', '_')}_{painting.get('Artwork', 'Untitled').replace(' ', '_')}"

            embedding = get_embedding(description)
            
            if embedding:
                all_embeddings.append({
                    "id": painting['id'],
                    "title": painting.get("Artwork"),
                    "artist": artist_name,
                    "year": painting.get("Year"),
                    "style": painting.get("ArtMovements"),
                    "genre": painting.get("Genre"),
                    "url": painting.get("URL"),
                    "imageUrl": painting.get("image_url"),
                    "description": description,
                    "openai_embedding": embedding
                })
            
            # OpenAI API has rate limits, a small delay can help avoid them
            time.sleep(0.1) 

    with open(output_path, 'w') as f:
        json.dump(all_embeddings, f, indent=2)

if __name__ == "__main__":
    # Assuming the script is run from the 'server/recommend' directory
    # The input file is in 'external/' relative to the project root
    project_root = os.path.dirname(os.path.dirname(os.path.dirname(__file__)))
    input_json_path = os.path.join(project_root, 'external', 'output_modified.json')
    output_json_path = os.path.join(project_root, 'external', 'embeddings.json')
    
    process_paintings(input_json_path, output_json_path)
