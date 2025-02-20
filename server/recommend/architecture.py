import torch
import torch.nn as nn
import torch.nn.functional as F

class WeightedArtistEmbedder(nn.Module):
    def __init__(self, nationalities, movements, centuries):
        super().__init__()
        self.nationalities = nationalities
        self.movements = movements
        self.centuries = centuries
        
        self.nat_embed = nn.Embedding(len(self.nationalities), 64)
        self.mov_embed = nn.Embedding(len(self.movements), 64)
        self.cent_embed = nn.Embedding(len(self.centuries), 32)
        
    def _get_features(self, artist_data, artist):
        data = artist_data[artist]
        
        ### Embeddings
        # Nationality
        nat_idx = self.nationalities.index(data.get("Nationality", ""))
        nat_emb = self.nat_embed(torch.tensor(nat_idx))
        
        # Movement (average pooled)
        mov_indices = [self.movements.index(m) for m in data.get("ArtMovements", "").split(',') 
                      if m in self.movements]
        mov_emb = torch.mean(self.mov_embed(torch.tensor(mov_indices)), dim=0) if mov_indices else 0
        
        # Century
        century = int(data.get("CenturyStart", "1900")[:2]+"00")
        cent_idx = self.centuries.index(century)
        cent_emb = self.cent_embed(torch.tensor(cent_idx))
        
        return torch.cat([nat_emb, mov_emb, cent_emb])

    def forward(self, weighted_artists, artist_data):
        embs = []
        weights = []
        for artist, weight in weighted_artists:
            if artist not in artist_data:
                continue
            embs.append(self._get_features(artist_data, artist))
            weights.append(weight)
        
        if not embs:
            return torch.zeros(160)
        
        # Weighted average
        weights = torch.tensor(weights, dtype=torch.float32)
        return torch.einsum('i,ij->j', weights, torch.stack(embs)) / weights.sum()

class ArtistRecommender:
    def __init__(self, nationalities, movements, centuries, model_state, artist_features, artist_data=None):
        self.model = WeightedArtistEmbedder(nationalities, movements, centuries)
        self.model.load_state_dict(model_state)
        self.artist_embs = artist_features
        self.artist_data = artist_data
        
    def recommend(self, artist_names, weights, artist_data=None):
        if artist_data is None:
            artist_data = self.artist_data

        weighted_input = list(zip(artist_names, weights))
        
        input_emb = self.model(weighted_input, artist_data)
        
        scores = []
        for artist, emb in self.artist_embs.items():
            sim = F.cosine_similarity(input_emb.unsqueeze(0), emb.unsqueeze(0)).item()
            scores.append((artist, sim))
        
        scores.sort(key=lambda x: -x[1])
        artists_similarity = [artist for artist, _ in scores]
        for artist_name in artist_names:
            artists_similarity.remove(artist_name)
        
        return artists_similarity[:5]