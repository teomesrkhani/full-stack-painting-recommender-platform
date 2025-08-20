#!/usr/bin/env python3
"""
ChromaDB Service for Painting Recommendations

This service manages ChromaDB operations for vector similarity search
of painting embeddings. Designed for memory-efficient operation on EC2 t3.micro.
"""

import os
import sys
import json
import time
import logging
from typing import List, Dict, Optional, Tuple
import chromadb
from chromadb.config import Settings
import numpy as np

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class ChromaService:
    """
    ChromaDB service for painting recommendation system.
    
    Handles vector similarity search, user preference aggregation,
    and graceful error handling for production deployment.
    """
    
    def __init__(self, collection_name: str = "paintings", persist_directory: str = "./chroma_db"):
        """
        Initialize ChromaDB service with memory-optimized settings.
        
        Args:
            collection_name: Name of the ChromaDB collection
            persist_directory: Directory to persist ChromaDB data
        """
        self.collection_name = collection_name
        self.persist_directory = persist_directory
        self.client = None
        self.collection = None
        self._initialize_client()
    
    def _initialize_client(self) -> bool:
        """
        Initialize ChromaDB client (local or cloud).
        
        Returns:
            bool: True if initialization successful, False otherwise
        """
        try:
            # Check if using Chroma Cloud
            chroma_api_key = os.getenv('CHROMA_API_KEY')
            
            if chroma_api_key:
                # Use Chroma Cloud with your tenant/database
                logger.info("Connecting to Chroma Cloud...")
                self.client = chromadb.CloudClient(
                    tenant='f8f50eb4-69db-4624-9710-98dab292e7ab',
                    database='painting-recommender',
                    api_key=chroma_api_key
                )
            else:
                # Use local ChromaDB (existing behavior)
                logger.info("Using local ChromaDB...")
                os.makedirs(self.persist_directory, exist_ok=True)
                
                self.client = chromadb.PersistentClient(
                    path=self.persist_directory,
                    settings=Settings(
                        anonymized_telemetry=False,
                        allow_reset=True
                    )
                )
            
            # Get or create collection
            try:
                self.collection = self.client.get_collection(name=self.collection_name)
                logger.info(f"Connected to existing collection '{self.collection_name}'")
            except Exception:
                # Collection doesn't exist, will be created during migration
                logger.info(f"Collection '{self.collection_name}' not found, will be created during migration")
                self.collection = None
            
            return True
            
        except Exception as e:
            logger.error(f"Failed to initialize ChromaDB client: {e}")
            return False
    
    def health_check(self) -> bool:
        """
        Check if ChromaDB service is healthy and responsive.
        
        Returns:
            bool: True if service is healthy, False otherwise
        """
        try:
            if not self.client:
                return False
            
            # Try to list collections as a health check
            collections = self.client.list_collections()
            logger.debug(f"Health check passed. Collections: {[c.name for c in collections]}")
            return True
            
        except Exception as e:
            logger.error(f"Health check failed: {e}")
            return False
    
    def create_collection(self) -> bool:
        """
        Create the paintings collection with appropriate metadata.
        
        Returns:
            bool: True if collection created successfully, False otherwise
        """
        try:
            if not self.client:
                logger.error("ChromaDB client not initialized")
                return False
            
            # Create collection with cosine similarity (default for text embeddings)
            self.collection = self.client.create_collection(
                name=self.collection_name,
                metadata={"hnsw:space": "cosine"}  # Optimized for text embeddings
            )
            
            logger.info(f"Created collection '{self.collection_name}' successfully")
            return True
            
        except Exception as e:
            logger.error(f"Failed to create collection: {e}")
            return False
    
    def add_paintings(self, paintings_data: List[Dict]) -> bool:
        """
        Add paintings with embeddings to ChromaDB collection.
        
        Args:
            paintings_data: List of painting dictionaries with embeddings and metadata
            
        Returns:
            bool: True if paintings added successfully, False otherwise
        """
        try:
            if not self.collection:
                logger.error("Collection not initialized")
                return False
            
            if not paintings_data:
                logger.warning("No paintings data provided")
                return True
            
            # Prepare data for ChromaDB
            ids = []
            embeddings = []
            metadatas = []
            
            for painting in paintings_data:
                # Use MongoDB ObjectId or custom ID as ChromaDB ID
                painting_id = str(painting.get('_id', painting.get('id')))
                
                # Extract embedding (should be 1536-dim for text-embedding-ada-002)
                embedding = painting.get('openai_embedding') or painting.get('embedding')
                if not embedding or len(embedding) != 1536:
                    logger.warning(f"Invalid embedding for painting {painting_id}")
                    continue
                
                ids.append(painting_id)
                embeddings.append(embedding)
                
                # Simplified metadata - only store MongoDB ID for reference
                # Full painting details will be fetched from MongoDB using this ID
                metadata = {
                    'mongodb_id': painting_id
                }
                
                metadatas.append(metadata)
            logger.info(f"Adding {len(ids)} paintings to collection")
            # Add to collection in batch
            if ids and embeddings and metadatas:
                self.collection.add(
                    ids=ids,
                    embeddings=embeddings,
                    metadatas=metadatas
                )
                
                logger.info(f"Added {len(ids)} paintings to collection")
                return True
            else:
                logger.warning("No valid paintings to add")
                return False
                
        except Exception as e:
            logger.error(f"Failed to add paintings: {e}")
            return False
    
    def get_similar_paintings(self, user_embedding: List[float], k: int = 5, 
                            exclude_ids: Optional[List[str]] = None,
                            min_similarity: float = 0.0) -> List[Dict]:
        """
        Find similar paintings based on user preference embedding.
        
        Args:
            user_embedding: Aggregated user preference vector
            k: Number of similar paintings to return (default: 5)
            exclude_ids: List of painting IDs to exclude from results
            min_similarity: Minimum similarity threshold (0.0 to 1.0)
            
        Returns:
            List of similar paintings with metadata and similarity scores
        """
        try:
            if not self.collection:
                logger.error("Collection not initialized")
                return []
            
            if not user_embedding or len(user_embedding) != 1536:
                logger.error("Invalid user embedding provided")
                return []
            
            # Query more results to account for exclusions and filtering
            query_size = min(k * 3, 100)  # Get up to 3x more results, max 100
            if exclude_ids:
                query_size += len(exclude_ids)
            
            # Query ChromaDB for similar vectors
            results = self.collection.query(
                query_embeddings=[user_embedding],
                n_results=query_size,
                include=['metadatas', 'distances']
            )
            
            similar_paintings = []
            
            if results and results['ids'] and results['ids'][0]:
                for i, painting_id in enumerate(results['ids'][0]):
                    # Skip excluded paintings
                    if exclude_ids and painting_id in exclude_ids:
                        continue
                    
                    # Convert distance to similarity score (cosine distance -> cosine similarity)
                    distance = results['distances'][0][i]
                    similarity_score = 1.0 - distance  # For cosine distance
                    
                    # Apply minimum similarity threshold
                    if similarity_score < min_similarity:
                        continue
                    
                    # Get metadata
                    metadata = results['metadatas'][0][i] if results['metadatas'] else {}
                    
                    painting = {
                        '_id': painting_id,
                        'similarity_score': round(similarity_score, 4),
                        'mongodb_id': metadata.get('mongodb_id', painting_id),
                        'distance': round(distance, 4)
                    }
                    
                    similar_paintings.append(painting)
                    
                    # Stop when we have enough results
                    if len(similar_paintings) >= k:
                        break
            
            # Sort by similarity score (highest first)
            similar_paintings.sort(key=lambda x: x['similarity_score'], reverse=True)
            
            # Fallback: If no valid results, perform a random query
            if not similar_paintings:
                logger.warning("No valid recommendations found. Performing a random query as fallback.")
                random_results = self.collection.query(
                    query_embeddings=[np.random.rand(1536).tolist()],  # Random embedding
                    n_results=k,
                    include=['metadatas', 'distances']
                )
                if random_results and random_results['ids'] and random_results['ids'][0]:
                    for i, painting_id in enumerate(random_results['ids'][0]):
                        metadata = random_results['metadatas'][0][i] if random_results['metadatas'] else {}
                        distance = random_results['distances'][0][i]
                        similar_paintings.append({
                            '_id': painting_id,
                            'similarity_score': round(1.0 - distance, 4),
                            'mongodb_id': metadata.get('mongodb_id', painting_id),
                            'distance': round(distance, 4)
                        })
            
            logger.info(f"Found {len(similar_paintings)} similar paintings (min_similarity: {min_similarity})")
            return similar_paintings[:k]
            
        except Exception as e:
            logger.error(f"Failed to get similar paintings: {e}")
            return []
    
    def get_similar_paintings_batch(self, user_embeddings: List[List[float]], k: int = 10,
                                  exclude_ids: Optional[List[str]] = None) -> List[List[Dict]]:
        """
        Batch similarity search for multiple user preference vectors.
        
        Args:
            user_embeddings: List of user preference vectors
            k: Number of similar paintings to return per query
            exclude_ids: List of painting IDs to exclude from all results
            
        Returns:
            List of recommendation lists, one per input embedding
        """
        try:
            if not self.collection:
                logger.error("Collection not initialized")
                return []
            
            if not user_embeddings:
                logger.error("No user embeddings provided")
                return []
            
            # Validate all embeddings
            for i, embedding in enumerate(user_embeddings):
                if not embedding or len(embedding) != 1536:
                    logger.error(f"Invalid embedding at index {i}")
                    return []
            
            # Query ChromaDB with batch of embeddings
            query_size = min(k * 2, 50)  # Conservative batch size
            if exclude_ids:
                query_size += len(exclude_ids)
            
            results = self.collection.query(
                query_embeddings=user_embeddings,
                n_results=query_size,
                include=['metadatas', 'distances']
            )
            
            all_recommendations = []
            
            if results and results['ids']:
                for query_idx in range(len(user_embeddings)):
                    similar_paintings = []
                    
                    if query_idx < len(results['ids']) and results['ids'][query_idx]:
                        for i, painting_id in enumerate(results['ids'][query_idx]):
                            # Skip excluded paintings
                            if exclude_ids and painting_id in exclude_ids:
                                continue
                            
                            if len(similar_paintings) >= k:
                                break
                            
                            # Convert distance to similarity score
                            distance = results['distances'][query_idx][i]
                            similarity_score = 1.0 - distance
                            
                            # Get metadata
                            metadata = results['metadatas'][query_idx][i] if results['metadatas'] else {}
                            
                            painting = {
                                '_id': painting_id,
                                'similarity_score': round(similarity_score, 4),
                                'mongodb_id': metadata.get('mongodb_id', painting_id)
                            }
                            
                            similar_paintings.append(painting)
                    
                    all_recommendations.append(similar_paintings)
            
            logger.info(f"Batch similarity search completed for {len(user_embeddings)} queries")
            return all_recommendations
            
        except Exception as e:
            logger.error(f"Failed to perform batch similarity search: {e}")
            return []
    
    def get_painting_embedding(self, painting_id: str) -> Optional[List[float]]:
        """
        Get embedding for a specific painting by searching for mongodb_id.
        
        Args:
            painting_id: MongoDB ID of the painting to find
            
        Returns:
            Embedding vector or None if not found
        """
        try:
            if not self.collection:
                logger.error("Collection not initialized")
                return None
            
            # Use get method to retrieve painting by ID directly
            # First try to get by direct ID (if the painting was stored with this ID)
            try:
                results = self.collection.get(
                    ids=[painting_id],
                    include=['embeddings']
                )
                
                if (results and 
                    results.get('embeddings') is not None and 
                    len(results['embeddings']) > 0 and
                    results['embeddings'][0] is not None):
                    # ChromaDB returns numpy arrays, convert to list
                    embedding = results['embeddings'][0]  # First embedding
                    if hasattr(embedding, 'tolist'):
                        return embedding.tolist()
                    else:
                        return list(embedding)
            except Exception:
                # If direct ID lookup fails, try metadata search
                pass
            
            # Fallback: use where clause without query_texts to avoid embedding generation
            results = self.collection.get(
                where={"mongodb_id": painting_id},
                include=['embeddings']
            )
            
            if (results and 
                results.get('embeddings') is not None and 
                len(results['embeddings']) > 0 and
                results['embeddings'][0] is not None):
                # ChromaDB returns numpy arrays, convert to list
                embedding = results['embeddings'][0]  # First embedding
                if hasattr(embedding, 'tolist'):
                    return embedding.tolist()
                else:
                    return list(embedding)
            
            logger.warning(f"Painting with mongodb_id {painting_id} not found in collection")
            return None
            
        except Exception as e:
            logger.error(f"Failed to get painting embedding for mongodb_id {painting_id}: {e}")
            return None
    
    def aggregate_user_preferences(self, liked_painting_ids: List[str], 
                                 method: str = "centroid") -> Optional[List[float]]:
        """
        Aggregate user preferences from liked paintings.
        
        Args:
            liked_painting_ids: List of painting IDs the user has liked
            method: Aggregation method ("centroid", "weighted_average", "recent_focus")
            
        Returns:
            Aggregated preference vector or None if failed
        """
        try:
            if not liked_painting_ids:
                logger.warning("No liked paintings provided for aggregation")
                return None
            
            # Get embeddings for liked paintings
            embeddings = []
            for painting_id in liked_painting_ids:
                embedding = self.get_painting_embedding(painting_id)
                if embedding:
                    embeddings.append(embedding)
            
            if not embeddings:
                logger.warning("No valid embeddings found for liked paintings")
                return None
            
            # Convert to numpy for easier computation
            embeddings_array = np.array(embeddings)
            
            if method == "centroid":
                # Simple average of all liked painting embeddings
                user_preference = np.mean(embeddings_array, axis=0)
                
            elif method == "weighted_average":
                # Weight recent likes more heavily (exponential decay)
                weights = np.array([0.9 ** i for i in range(len(embeddings))])
                weights = weights / np.sum(weights)  # Normalize
                user_preference = np.average(embeddings_array, axis=0, weights=weights)
                
            elif method == "recent_focus":
                # Focus heavily on the most recent 3 likes
                if len(embeddings) <= 3:
                    user_preference = np.mean(embeddings_array, axis=0)
                else:
                    # Give 70% weight to recent 3, 30% to the rest
                    recent_embeddings = embeddings_array[:3]
                    older_embeddings = embeddings_array[3:]
                    
                    recent_avg = np.mean(recent_embeddings, axis=0)
                    older_avg = np.mean(older_embeddings, axis=0)
                    
                    user_preference = 0.7 * recent_avg + 0.3 * older_avg
                    
            else:
                logger.error(f"Unknown aggregation method: {method}")
                return None
            
            # Normalize the preference vector
            norm = np.linalg.norm(user_preference)
            if norm > 0:
                user_preference = user_preference / norm
            
            logger.info(f"Aggregated user preferences from {len(embeddings)} paintings using {method}")
            return user_preference.tolist()
            
        except Exception as e:
            logger.error(f"Failed to aggregate user preferences: {e}")
            return None
    
    def get_recommendations_for_user(self, liked_painting_ids: List[str], 
                                   exclude_ids: Optional[List[str]] = None,
                                   k: int = 10, aggregation_method: str = "centroid") -> List[Dict]:
        """
        One-shot method to get recommendations for a user based on their liked paintings.
        
        Args:
            liked_painting_ids: List of painting IDs the user has liked
            exclude_ids: List of painting IDs to exclude (viewed paintings)
            k: Number of recommendations to return
            aggregation_method: Method to aggregate user preferences ("centroid" or "weighted_average")
            
        Returns:
            List of recommended paintings with similarity scores
        """
        try:
            if not liked_painting_ids:
                logger.warning("No liked paintings provided for recommendations")
                return []
            
            # Aggregate user preferences from liked paintings
            user_preference = self.aggregate_user_preferences(liked_painting_ids, aggregation_method)
            
            if not user_preference:
                logger.warning("Could not aggregate user preferences")
                return []
            
            # Combine liked paintings with exclude list to avoid recommending already liked paintings
            all_exclude_ids = set(liked_painting_ids)
            if exclude_ids:
                all_exclude_ids.update(exclude_ids)
            
            # Get similar paintings
            recommendations = self.get_similar_paintings(
                user_preference, 
                k=k, 
                exclude_ids=list(all_exclude_ids)
            )
            
            logger.info(f"Generated {len(recommendations)} recommendations for user with {len(liked_painting_ids)} liked paintings")
            return recommendations
            
        except Exception as e:
            logger.error(f"Failed to get recommendations for user: {e}")
            return []
    
    def get_diverse_recommendations(self, liked_painting_ids: List[str],
                                  exclude_ids: Optional[List[str]] = None,
                                  k: int = 10, diversity_factor: float = 0.3) -> List[Dict]:
        """
        Get diverse recommendations by clustering user preferences and sampling from different clusters.
        
        Args:
            liked_painting_ids: List of painting IDs the user has liked
            exclude_ids: List of painting IDs to exclude
            k: Number of recommendations to return
            diversity_factor: Factor controlling diversity (0.0 = most similar, 1.0 = most diverse)
            
        Returns:
            List of diverse recommended paintings
        """
        try:
            if not liked_painting_ids:
                return []
            
            if len(liked_painting_ids) < 3:
                # Not enough data for clustering, use regular recommendations
                return self.get_recommendations_for_user(liked_painting_ids, exclude_ids, k)
            
            # Get embeddings for liked paintings
            liked_embeddings = []
            for painting_id in liked_painting_ids:
                embedding = self.get_painting_embedding(painting_id)
                if embedding:
                    liked_embeddings.append(embedding)
            
            if len(liked_embeddings) < 2:
                return self.get_recommendations_for_user(liked_painting_ids, exclude_ids, k)
            
            # Simple diversity approach: get recommendations from different preference vectors
            recommendations = []
            
            # Method 1: Centroid of all likes
            centroid_recs = self.get_recommendations_for_user(
                liked_painting_ids, exclude_ids, k//2, "centroid"
            )
            recommendations.extend(centroid_recs)
            
            # Method 2: Weighted average (recent likes)
            weighted_recs = self.get_recommendations_for_user(
                liked_painting_ids, exclude_ids, k//2, "weighted_average"
            )
            
            # Add weighted recommendations that aren't already in the list
            existing_ids = {rec['_id'] for rec in recommendations}
            for rec in weighted_recs:
                if rec['_id'] not in existing_ids and len(recommendations) < k:
                    recommendations.append(rec)
                    existing_ids.add(rec['_id'])
            
            # Sort by similarity score and return top k
            recommendations.sort(key=lambda x: x['similarity_score'], reverse=True)
            
            logger.info(f"Generated {len(recommendations)} diverse recommendations")
            return recommendations[:k]
            
        except Exception as e:
            logger.error(f"Failed to get diverse recommendations: {e}")
            return self.get_recommendations_for_user(liked_painting_ids, exclude_ids, k)
    
    def get_collection_stats(self) -> Dict:
        """
        Get statistics about the ChromaDB collection.
        
        Returns:
            Dictionary with collection statistics
        """
        try:
            if not self.collection:
                return {"error": "Collection not initialized"}
            
            # Get collection count
            count = self.collection.count()
            
            return {
                "collection_name": self.collection_name,
                "total_paintings": count,
                "persist_directory": self.persist_directory,
                "status": "healthy" if count > 0 else "empty"
            }
            
        except Exception as e:
            logger.error(f"Failed to get collection stats: {e}")
            return {"error": str(e)}