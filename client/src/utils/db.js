// MongoDB-based API client for liked paintings
const API_BASE_URL = 'http://localhost:5050';

export async function addLikedPainting(painting) {
  try {
    const response = await fetch(`${API_BASE_URL}/record`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
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
    const response = await fetch(`${API_BASE_URL}/record`);
    
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
    const response = await fetch(`${API_BASE_URL}/record/check/${encodedUrl}`);
    
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
    const response = await fetch(`${API_BASE_URL}/record/artists`);
    
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
    const response = await fetch(`${API_BASE_URL}/record/hasRecords`);
    
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
      headers: {
        'Content-Type': 'application/json',
      },
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