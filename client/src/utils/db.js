// MongoDB-based API client for liked paintings
const API_BASE_URL = 'http://localhost:5050';

// Global cache to ensure single user ID per session
let cachedUserId = null;

// Helper function to get or create userId
function getUserId() {
  // Use cached userId if available
  if (cachedUserId) {
    console.log('🔒 Using cached userId:', cachedUserId);
    return cachedUserId;
  }
  
  console.log('⚠️ No cached userId, checking localStorage...');
  // Always use localStorage as the single source of truth
  let userId = localStorage.getItem('userId');
  if (!userId) {
    userId = crypto.randomUUID();
    localStorage.setItem('userId', userId);
    console.log('🆔 Created new userId in localStorage:', userId);
  } else {
    console.log('� Using existing userId from localStorage:', userId);
  }
  
  // Also try to sync with cookie if it exists and is different
  const cookieUserId = document.cookie
    .split('; ')
    .find(row => row.startsWith('userId='))
    ?.split('=')[1];
  
  if (cookieUserId && cookieUserId !== userId) {
    console.log('🔄 Cookie has different userId, prioritizing localStorage:', userId);
    // Set cookie to match localStorage to avoid conflicts
    document.cookie = `userId=${userId}; path=/; max-age=${365*24*60*60}`;
  }
  
  // Cache it for this session
  cachedUserId = userId;
  
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
    console.log('🔍 [addLikedPainting] Using localStorage for painting:', painting);
    
    // Generate a unique ID for localStorage
    const paintingId = painting._id;
    const paintingWithId = { ...painting, _id: paintingId };
    
    // Add to localStorage only (no MongoDB write operations)
    addLikedPaintingToLocalStorage(paintingWithId);
    
    console.log('✅ Added painting to localStorage with ID:', paintingId);
    return paintingId;
  } catch (error) {
    console.error('Failed to add painting to localStorage:', error);
    throw error;
  }
}

export async function getAllLikedPaintings() {
  try {
    // Get all liked paintings from localStorage only (no MongoDB read operations)
    const paintings = getAllLikedPaintingsFromLocalStorage();
    console.log('🔍 [getAllLikedPaintings] LocalStorage response:', paintings);
    return paintings;
  } catch (error) {
    console.error('Failed to fetch liked paintings from localStorage:', error);
    return [];
  }
}

export async function getLikedPaintingByUrl(url) {
  try {
    // Check localStorage only (no MongoDB read operations)
    const painting = isLikedPaintingInLocalStorage(url);
    return painting;
  } catch (error) {
    console.error('Failed to check if painting is liked in localStorage:', error);
    return null;
  }
}

export async function removeLikedPaintingById(id) {
  try {
    // Remove from localStorage only (no MongoDB delete operations)
    const success = removeLikedPaintingFromLocalStorage(id);
    return success;
  } catch (error) {
    console.error('Failed to remove painting from localStorage:', error);
    throw error;
  }
}

export async function getUniqueLikedArtistsWithCounts() {
  try {
    // Get artist counts from localStorage only (no MongoDB read operations)
    const result = getUniqueLikedArtistsFromLocalStorage();
    return { artists: result.artists, counts: result.counts };
  } catch (error) {
    console.error('Failed to fetch artist counts from localStorage:', error);
    return { artists: [], counts: [] };
  }
}

export async function hasLikedRecords() {
  try {
    // Check localStorage only (no MongoDB read operations)
    const paintings = getAllLikedPaintingsFromLocalStorage();
    return paintings.length > 0;
  } catch (error) {
    console.error('Failed to check for liked records in localStorage:', error);
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

    console.log(`liked, ${JSON.stringify(liked)},`);
    console.log(`toAdd (asdf), ${JSON.stringify(painting)},`);
    const newPainting = {
      _id: painting._id, // Use the _id from the database
      title: painting.title,
      artist: painting.artist,
      url: painting.originalUrl,
      imageUrl: painting.imageUrl,
      originalUrl: painting.originalArtworkId,
      // timestamp: new Date().toISOString(),
    };
    
    // Check if painting already exists using _id
    const exists = liked.some(p => p._id === painting._id);
    if (!exists) {
      liked.push(newPainting);
      localStorage.setItem('likedPaintings', JSON.stringify(liked));
    }
    
    return newPainting._id;
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

export function isLikedPaintingInLocalStorage(url) {
  try {
    const liked = JSON.parse(localStorage.getItem('likedPaintings') || '[]');
    return liked.find(painting => 
      painting.imageUrl === url || 
      painting.url === url ||
      painting.originalUrl === url
    );
  } catch (error) {
    console.error('Failed to check if painting is liked in LocalStorage:', error);
    return null;
  }
}

export function removeLikedPaintingFromLocalStorage(id) {
  try {
    const liked = JSON.parse(localStorage.getItem('likedPaintings') || '[]');
    // Use _id field instead of id field to match database structure
    const filtered = liked.filter(painting => painting._id !== id);
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
    console.log('🔍 [getRandomUnviewedPainting] Using userId:', getUserId());
    // Get saved paintings from database to send to server
    const savedPaintings = await getAllLikedPaintings();
    console.log('🔍 [getRandomUnviewedPainting] savedPaintings from getAllLikedPaintings():', savedPaintings);
    
    // Use POST method to send saved paintings data
    const response = await fetch(`${API_BASE_URL}/random-unviewed`, {
      method: 'POST',
      headers: getHeaders(),
      credentials: 'include', // Important for session-based tracking
      body: JSON.stringify({
        savedPaintings: savedPaintings || []
      })
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const painting = await response.json();
    console.log(`🎨 Received painting from: ${painting.source}`); // Debug log
    return painting;
  } catch (error) {
    console.error('Failed to fetch random unviewed painting:', error);
    throw error;
  }
}