import json
import torch
import sys
import argparse
from architecture import ArtistRecommender, WeightedArtistEmbedder
import traceback
def load_recommender(model_path):
    checkpoint = torch.load(model_path, map_location='cpu')
    model = ArtistRecommender(checkpoint['nationalities'], checkpoint['movements'], 
                              checkpoint.get('centuries', []), checkpoint['model_state'], 
                              checkpoint['artist_features'], checkpoint['artist_data'])
    return model

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument('--artists', type=str)
    parser.add_argument('--weights', type=str)
    parser.add_argument('--model', type=str)
    args = parser.parse_args()

    model = load_recommender(args.model)
    
    liked_artists = args.artists.split(',')
    weights = [int(x) for x in args.weights.split(',')]
    
    recs = model.recommend(liked_artists, weights)
    print(json.dumps(recs))