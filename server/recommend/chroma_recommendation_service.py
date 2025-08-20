#!/usr/bin/env python3.10
"""
Persistent ChromaDB recommendation service for painting similarity search.
Uses vector embeddings to find similar paintings based on user preferences.
"""

import json
import sys
import signal
import time
import logging
import os
from typing import List, Dict, Optional
from dotenv import load_dotenv

# Load environment variables from server/.env
env_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '.env')
load_dotenv(env_path)

# Add current directory to path for imports
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from chroma_service import ChromaService

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class ChromaRecommendationService:
    """
    ChromaDB recommendation service that communicates with Node.js via stdin/stdout.
    """
    
    def __init__(self, chroma_dir: str = "./chroma_db"):
        """
        Initialize the ChromaDB recommendation service.
        
        Args:
            chroma_dir: Directory containing ChromaDB data
        """
        self.chroma_dir = chroma_dir
        self.chroma_service = None
        self._initialize_service()
    
    def _initialize_service(self) -> bool:
        """
        Initialize ChromaDB service and verify it's ready.
        
        Returns:
            bool: True if initialization successful
        """
        try:
            start_time = time.time()
            
            # Initialize ChromaDB service
            self.chroma_service = ChromaService(persist_directory=self.chroma_dir)
            
            # Health check
            if not self.chroma_service.health_check():
                logger.error("ChromaDB health check failed")
                return False
            
            # Get collection stats
            stats = self.chroma_service.get_collection_stats()
            
            if 'error' in stats:
                logger.error(f"ChromaDB collection error: {stats['error']}")
                return False
            
            total_paintings = stats.get('total_paintings', 0)
            
            if total_paintings == 0:
                logger.warning("ChromaDB collection is empty - migration may be needed")
            else:
                logger.info(f"ChromaDB ready with {total_paintings} paintings")
            
            load_time = time.time() - start_time
            logger.info(f"ChromaDB service initialized in {load_time:.2f}s")
            
            return True
            
        except Exception as e:
            logger.error(f"Failed to initialize ChromaDB service: {e}")
            return False
    
    def get_recommendations(self, liked_painting_ids: List[str], 
                          exclude_ids: Optional[List[str]] = None,
                          count: int = 10) -> Dict:
        """
        Get recommendations based on liked paintings.
        
        Args:
            liked_painting_ids: List of painting IDs the user has liked
            exclude_ids: List of painting IDs to exclude (viewed paintings)
            count: Number of recommendations to return
            
        Returns:
            Dictionary with recommendations and metadata
        """
        try:
            start_time = time.time()
            
            if not self.chroma_service:
                return {
                    'error': 'ChromaDB service not initialized',
                    'recommendations': [],
                    'source': 'error'
                }
            
            if not liked_painting_ids:
                return {
                    'error': 'No liked paintings provided',
                    'recommendations': [],
                    'source': 'error'
                }
            
            # Get recommendations using ChromaDB
            recommendations = self.chroma_service.get_recommendations_for_user(
                liked_painting_ids=liked_painting_ids,
                exclude_ids=exclude_ids,
                k=count,
                aggregation_method="centroid"
            )
            
            # Format recommendations for Node.js compatibility
            formatted_recommendations = []
            for rec in recommendations:
                formatted_rec = {
                    '_id': rec['_id'],
                    'mongodb_id': rec.get('mongodb_id', rec['_id']),
                    'similarity_score': rec['similarity_score'],
                    'distance': rec.get('distance', 1.0 - rec['similarity_score'])
                }
                formatted_recommendations.append(formatted_rec)
            
            inference_time = time.time() - start_time
            
            result = {
                'recommendations': formatted_recommendations,
                'source': 'chromadb',
                'processing_time_ms': round(inference_time * 1000, 2),
                'user_liked_count': len(liked_painting_ids),
                'excluded_count': len(exclude_ids) if exclude_ids else 0,
                'aggregation_method': 'centroid'
            }
            
            logger.info(f"Generated {len(formatted_recommendations)} recommendations in {inference_time:.3f}s")
            return result
            
        except Exception as e:
            logger.error(f"Error generating recommendations: {e}")
            return {
                'error': str(e),
                'recommendations': [],
                'source': 'error'
            }
    
    def get_diverse_recommendations(self, liked_painting_ids: List[str],
                                  exclude_ids: Optional[List[str]] = None,
                                  count: int = 10) -> Dict:
        """
        Get diverse recommendations for users with varied tastes.
        
        Args:
            liked_painting_ids: List of painting IDs the user has liked
            exclude_ids: List of painting IDs to exclude
            count: Number of recommendations to return
            
        Returns:
            Dictionary with diverse recommendations and metadata
        """
        try:
            start_time = time.time()
            
            if not self.chroma_service:
                return {
                    'error': 'ChromaDB service not initialized',
                    'recommendations': [],
                    'source': 'error'
                }
            
            # Get diverse recommendations
            recommendations = self.chroma_service.get_diverse_recommendations(
                liked_painting_ids=liked_painting_ids,
                exclude_ids=exclude_ids,
                k=count
            )
            
            # Format recommendations
            formatted_recommendations = []
            for rec in recommendations:
                formatted_rec = {
                    '_id': rec['_id'],
                    'mongodb_id': rec.get('mongodb_id', rec['_id']),
                    'similarity_score': rec['similarity_score']
                }
                formatted_recommendations.append(formatted_rec)
            
            inference_time = time.time() - start_time
            
            result = {
                'recommendations': formatted_recommendations,
                'source': 'chromadb_diverse',
                'processing_time_ms': round(inference_time * 1000, 2),
                'user_liked_count': len(liked_painting_ids),
                'aggregation_method': 'diverse'
            }
            
            logger.info(f"Generated {len(formatted_recommendations)} diverse recommendations in {inference_time:.3f}s")
            return result
            
        except Exception as e:
            logger.error(f"Error generating diverse recommendations: {e}")
            return {
                'error': str(e),
                'recommendations': [],
                'source': 'error'
            }
    
    def get_service_stats(self) -> Dict:
        """
        Get service statistics and health information.
        
        Returns:
            Dictionary with service stats
        """
        try:
            if not self.chroma_service:
                return {'error': 'Service not initialized'}
            
            # Get ChromaDB stats
            chroma_stats = self.chroma_service.get_collection_stats()
            
            # Add service-level stats
            stats = {
                'service': 'chromadb_recommendation',
                'status': 'healthy' if self.chroma_service.health_check() else 'unhealthy',
                'chroma_stats': chroma_stats,
                'chroma_directory': self.chroma_dir
            }
            
            return stats
            
        except Exception as e:
            logger.error(f"Error getting service stats: {e}")
            return {'error': str(e)}
    
    def run(self):
        """
        Main service loop - listens for JSON requests on stdin and responds on stdout.
        """
        logger.info("ChromaDB recommendation service ready. Waiting for requests...")
        
        while True:
            try:
                # Read request from stdin
                line = sys.stdin.readline()
                if not line:  # EOF
                    break
                
                line = line.strip()
                if not line:
                    continue
                
                # Parse JSON request
                request = json.loads(line)
                
                # Extract request parameters
                action = request.get('action', 'recommend')
                liked_paintings = request.get('liked_paintings', [])
                exclude_paintings = request.get('exclude_paintings', [])
                count = request.get('count', 10)
                
                # Process request based on action
                if action == 'recommend':
                    response = self.get_recommendations(
                        liked_painting_ids=liked_paintings,
                        exclude_ids=exclude_paintings,
                        count=count
                    )
                elif action == 'diverse':
                    response = self.get_diverse_recommendations(
                        liked_painting_ids=liked_paintings,
                        exclude_ids=exclude_paintings,
                        count=count
                    )
                elif action == 'stats':
                    response = self.get_service_stats()
                else:
                    response = {
                        'error': f'Unknown action: {action}',
                        'recommendations': [],
                        'source': 'error'
                    }
                
                # Send JSON response to stdout
                print(json.dumps(response), flush=True)
                
            except json.JSONDecodeError as e:
                logger.error(f"Invalid JSON request: {e}")
                error_response = {
                    'error': 'Invalid JSON request',
                    'recommendations': [],
                    'source': 'error'
                }
                print(json.dumps(error_response), flush=True)
                
            except Exception as e:
                logger.error(f"Service error: {e}")
                error_response = {
                    'error': str(e),
                    'recommendations': [],
                    'source': 'error'
                }
                print(json.dumps(error_response), flush=True)


def main():
    """
    Main function to start the ChromaDB recommendation service.
    """
    import argparse
    
    parser = argparse.ArgumentParser(description="ChromaDB Recommendation Service")
    parser.add_argument('--chroma-dir', default='./chroma_db', 
                       help='ChromaDB data directory')
    
    args = parser.parse_args()
    
    # Initialize and run service
    service = ChromaRecommendationService(chroma_dir=args.chroma_dir)
    
    def signal_handler(signum, frame):
        logger.info("Shutting down ChromaDB recommendation service...")
        sys.exit(0)
    
    # Set up signal handlers
    signal.signal(signal.SIGINT, signal_handler)
    signal.signal(signal.SIGTERM, signal_handler)
    
    # Run the service
    service.run()


if __name__ == "__main__":
    main()