// MongoDB-based API client for liked paintings
const API_BASE_URL = 'http://localhost:5050';

// Helper function to get or create userId
function getUserId() {
  let userId = localStorage.getItem('userId');
  if (!userId) {
    userId = crypto.randomUUID();
    localStorage.setItem('userId', userId);
  }
  return userId;
}

// Helper function to get headers with userId
function getHeaders() {
  return {
    'Content-Type': 'application/json',
    'x-user-id': getUserId()
  };
}

export async function addLikedPainting(painting) {
  try {
    const response = await fetch(`${API_BASE_URL}/record`, {
      method: 'POST',
      headers: getHeaders(),
      credentials: 'include',
      body: JSON.stringify({
        title: painting.title,
        artist: painting.artist,
        url: painting.url,
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result = await response.json();
    return result._id;
  } catch (error) {
    console.error('Failed to add painting to MongoDB:', error);
    throw error;
  }
}

export async function getAllLikedPaintings() {
  try {
    const response = await fetch(`${API_BASE_URL}/record`, {
      headers: getHeaders(),
      credentials: 'include'
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const paintings = await response.json();
    return paintings;
  } catch (error) {
    console.error('Failed to fetch liked paintings from MongoDB:', error);
    return [];
  }
}

export async function getLikedPaintingByUrl(url) {
  try {
    const encodedUrl = encodeURIComponent(url);
    const response = await fetch(`${API_BASE_URL}/record/check/${encodedUrl}`, {
      headers: getHeaders(),
      credentials: 'include'
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result = await response.json();
    return result.liked ? result.painting : null;
  } catch (error) {
    console.error('Failed to check if painting is liked in MongoDB:', error);
    return null;
  }
}

export async function removeLikedPaintingById(id) {
  try {
    const response = await fetch(`${API_BASE_URL}/record/${id}`, {
      method: 'DELETE',
      headers: getHeaders(),
      credentials: 'include'
    });

    if (!response.ok) {
      if (response.status === 404) {
        return false; // Painting not found
      }
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result = await response.json();
    return result.deletedCount > 0;
  } catch (error) {
    console.error('Failed to remove painting from MongoDB:', error);
    throw error;
  }
}

export async function getUniqueLikedArtistsWithCounts() {
  try {
    const response = await fetch(`${API_BASE_URL}/record/artists`, {
      headers: getHeaders(),
      credentials: 'include'
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result = await response.json();
    return { artists: result.artists, counts: result.counts };
  } catch (error) {
    console.error('Failed to fetch artist counts from MongoDB:', error);
    return { artists: [], counts: [] };
  }
}

export async function hasLikedRecords() {
  try {
    const response = await fetch(`${API_BASE_URL}/record/hasRecords`, {
      headers: getHeaders(),
      credentials: 'include'
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result = await response.json();
    return result.hasRecords;
  } catch (error) {
    console.error('Failed to check for liked records in MongoDB:', error);
    return false;
  }
}

export async function getRecommendedArtists(artists, counts) {
  try {
    const response = await fetch(`${API_BASE_URL}/recommend`, {
      method: 'POST',
      headers: getHeaders(),
      credentials: 'include',
      body: JSON.stringify({ artists, counts }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      console.error('Recommendation API error response:', errorBody);
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const recommendations = await response.json();
    return recommendations.recommendations || [];
  } catch (error) {
    console.error('Failed to fetch recommendations:', error);
    return [];
  }
}

// ============================================================================
// LocalStorage Functions for Client-Side Storage
// ============================================================================

export function addLikedPaintingToLocalStorage(painting) {
  try {
    const liked = JSON.parse(localStorage.getItem('likedPaintings') || '[]');
    const newPainting = {
      id: Date.now() + Math.random(), // Simple ID generation
      title: painting.title,
      artist: painting.artist,
      url: painting.url,
      imageUrl: painting.imageUrl,
      originalUrl: painting.originalUrl,
      timestamp: new Date().toISOString(),
    };
    
    // Check if painting already exists
    const exists = liked.some(p => p.imageUrl === painting.imageUrl);
    if (!exists) {
      liked.push(newPainting);
      localStorage.setItem('likedPaintings', JSON.stringify(liked));
    }
    
    return newPainting.id;
  } catch (error) {
    console.error('Failed to add painting to LocalStorage:', error);
    throw error;
  }
}

export function getAllLikedPaintingsFromLocalStorage() {
  try {
    return JSON.parse(localStorage.getItem('likedPaintings') || '[]');
  } catch (error) {
    console.error('Failed to fetch liked paintings from LocalStorage:', error);
    return [];
  }
}

export function isLikedPaintingInLocalStorage(imageUrl) {
  try {
    const liked = JSON.parse(localStorage.getItem('likedPaintings') || '[]');
    return liked.find(painting => painting.imageUrl === imageUrl);
  } catch (error) {
    console.error('Failed to check if painting is liked in LocalStorage:', error);
    return null;
  }
}

export function removeLikedPaintingFromLocalStorage(id) {
  try {
    const liked = JSON.parse(localStorage.getItem('likedPaintings') || '[]');
    const filtered = liked.filter(painting => painting.id !== id);
    localStorage.setItem('likedPaintings', JSON.stringify(filtered));
    return filtered.length < liked.length; // Return true if something was removed
  } catch (error) {
    console.error('Failed to remove painting from LocalStorage:', error);
    return false;
  }
}

export function getUniqueLikedArtistsFromLocalStorage() {
  try {
    const liked = JSON.parse(localStorage.getItem('likedPaintings') || '[]');
    const artistCounts = {};
    
    liked.forEach(painting => {
      if (painting.artist) {
        artistCounts[painting.artist] = (artistCounts[painting.artist] || 0) + 1;
      }
    });
    
    return {
      artists: Object.keys(artistCounts),
      counts: Object.values(artistCounts)
    };
  } catch (error) {
    console.error('Failed to get unique artists from LocalStorage:', error);
    return { artists: [], counts: [] };
  }
}

export function getAllTagsFromSavedPaintings() {
  try {
    const liked = JSON.parse(localStorage.getItem('likedPaintings') || '[]');
    const tags = new Set();
    
    liked.forEach(painting => {
      // Extract tags from painting titles and artists
      if (painting.title) {
        // Add title words as tags (simplified approach)
        const titleWords = painting.title.toLowerCase().split(/\s+/).filter(word => word.length > 2);
        titleWords.forEach(word => tags.add(word));
      }
      
      if (painting.artist) {
        // Add artist name as a tag
        tags.add(painting.artist.toLowerCase());
      }
    });
    
    return Array.from(tags);
  } catch (error) {
    console.error('Failed to get tags from saved paintings:', error);
    return [];
  }
}

// ============================================================================
// Session-based painting tracking
// ============================================================================

const VISITED_PAINTINGS_KEY = 'visitedPaintings';

export async function markPaintingAsViewed(paintingId) {
  try {
    await fetch(`${API_BASE_URL}/viewed`, {
      method: 'POST',
      headers: getHeaders(),
      credentials: 'include', // This needs to be outside headers
      body: JSON.stringify({ paintingId }),
    });
  } catch (error) {
    console.error('Failed to mark painting as viewed on server:', error);
  }
}

export function getVisitedPaintings() {
  try {
    return JSON.parse(sessionStorage.getItem(VISITED_PAINTINGS_KEY) || '[]');
  } catch (error) {
    console.error('Failed to get visited paintings:', error);
    return [];
  }
}

// ============================================================================
// API Function for Random Unviewed Paintings
// ============================================================================

export async function getRandomUnviewedPainting() {
  try {
    const response = await fetch(`${API_BASE_URL}/random-unviewed`, {
      headers: getHeaders(),
      credentials: 'include' // Important for session-based tracking
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const painting = await response.json();
    return painting;
  } catch (error) {
    console.error('Failed to fetch random unviewed painting:', error);
    throw error;
  }
}