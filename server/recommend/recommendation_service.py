#!/usr/bin/env python3.10
"""
Persistent recommendation service that listens for requests and responds with recommendations.
This avoids the overhead of spawning new Python processes and reloading the model.
"""
import json
import sys
import signal
import time
import torch
from architecture import ArtistRecommender

class RecommendationService:
    def __init__(self, model_path):
        start_time = time.time()
        
        checkpoint = torch.load(model_path, map_location='cpu')
        self.model = ArtistRecommender(
            checkpoint['nationalities'], 
            checkpoint['movements'], 
            checkpoint.get('centuries', []), 
            checkpoint['model_state'], 
            checkpoint['artist_features'], 
            checkpoint['artist_data']
        )
        
        load_time = time.time() - start_time
        print(f"Model loaded in {load_time:.2f}s. Ready for requests.", file=sys.stderr)
    
    def get_recommendations(self, artists, weights):
        try:
            start_time = time.time()
            recommendations = self.model.recommend(artists, weights)
            inference_time = time.time() - start_time
            print(f"Inference completed in {inference_time:.3f}s", file=sys.stderr)
            return recommendations
        except Exception as e:
            print(f"Error during recommendation: {e}", file=sys.stderr)
            return []
    
    def run(self):
        print("Recommendation service ready. Waiting for requests...", file=sys.stderr)
        
        while True:
            try:
                line = sys.stdin.readline()
                if not line:  # EOF
                    break
                
                line = line.strip()
                if not line:
                    continue
                
                # Parse request
                request = json.loads(line)
                artists = request.get('artists', [])
                weights = request.get('weights', [])
                
                # Get recommendations
                recommendations = self.get_recommendations(artists, weights)
                
                # Send response to stdout
                response = {'recommendations': recommendations}
                print(json.dumps(response), flush=True)
                
            except json.JSONDecodeError as e:
                print(f"Invalid JSON request: {e}", file=sys.stderr)
                print(json.dumps({'error': 'Invalid JSON'}), flush=True)
            except Exception as e:
                print(f"Service error: {e}", file=sys.stderr)
                print(json.dumps({'error': str(e)}), flush=True)

def main():
    if len(sys.argv) != 2:
        print("Usage: python recommendation_service.py <model_path>", file=sys.stderr)
        sys.exit(1)
    
    model_path = sys.argv[1]
    service = RecommendationService(model_path)
    
    def signal_handler(signal, frame):
        print("Shutting down recommendation service...", file=sys.stderr)
        sys.exit(0)
    
    signal.signal(signal.SIGINT, signal_handler)
    signal.signal(signal.SIGTERM, signal_handler)
    
    service.run()

if __name__ == "__main__":
    main()
