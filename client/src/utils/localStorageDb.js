// localStorage utilities for saved paintings
import { getUserId } from './userSession';

const LIKED_PAINTINGS_KEY = 'liked_paintings';

export function addLikedPaintingToLocalStorage(painting) {
  try {
    console.log('🎨 Adding painting to localStorage:', painting);
    console.log('🆔 Painting _id:', painting._id);
    
    const userId = getUserId();
    const existingPaintings = getAllLikedPaintingsFromLocalStorage();
    
    // Check if painting already exists
    const exists = existingPaintings.find(p => p.url === painting.url);
    if (exists) {
      console.log('Painting already liked');
      return exists.id;
    }
    
    // Add new painting with timestamp and user association
    const newPainting = {
      _id: painting._id, // Preserve original MongoDB _id for ChromaDB
      userId: userId,
      title: painting.title,
      artist: painting.artist,
      url: painting.url,
      imageUrl: painting.imageUrl,
      originalUrl: painting.originalUrl,
      likedTimestamp: Date.now()
    };
    
    console.log('💾 Saving painting with _id:', newPainting._id);
    
    const updatedPaintings = [...existingPaintings, newPainting];
    localStorage.setItem(LIKED_PAINTINGS_KEY, JSON.stringify(updatedPaintings));
    
    console.log('Added painting to localStorage:', newPainting.title);
    return newPainting.id;
  } catch (error) {
    console.error('Error adding painting to localStorage:', error);
    throw error;
  }
}

export function getAllLikedPaintingsFromLocalStorage() {
  try {
    const userId = getUserId();
    const stored = localStorage.getItem(LIKED_PAINTINGS_KEY);
    
    if (!stored) {
      return [];
    }
    
    const allPaintings = JSON.parse(stored);
    // Filter paintings for current user only
    return allPaintings.filter(painting => painting.userId === userId);
  } catch (error) {
    console.error('Error getting paintings from localStorage:', error);
    return [];
  }
}

export function removeLikedPaintingFromLocalStorage(paintingId) {
  try {
    const userId = getUserId();
    const allStored = localStorage.getItem(LIKED_PAINTINGS_KEY);
    
    if (!allStored) {
      return false;
    }
    
    const allPaintings = JSON.parse(allStored);
    const filteredPaintings = allPaintings.filter(painting => 
      !(painting.id === paintingId && painting.userId === userId)
    );
    
    if (filteredPaintings.length === allPaintings.length) {
      console.warn('Painting not found for removal:', paintingId);
      return false;
    }
    
    localStorage.setItem(LIKED_PAINTINGS_KEY, JSON.stringify(filteredPaintings));
    console.log('Removed painting from localStorage:', paintingId);
    return true;
  } catch (error) {
    console.error('Error removing painting from localStorage:', error);
    return false;
  }
}

export function getLikedPaintingByUrlFromLocalStorage(url) {
  try {
    const paintings = getAllLikedPaintingsFromLocalStorage();
    return paintings.find(painting => painting.url === url) || null;
  } catch (error) {
    console.error('Error checking painting in localStorage:', error);
    return null;
  }
}

export function hasLikedRecordsInLocalStorage() {
  try {
    const paintings = getAllLikedPaintingsFromLocalStorage();
    return paintings.length > 0;
  } catch (error) {
    console.error('Error checking for liked records in localStorage:', error);
    return false;
  }
}

export function getUniqueLikedArtistsWithCountsFromLocalStorage() {
  try {
    const paintings = getAllLikedPaintingsFromLocalStorage();
    
    if (paintings.length === 0) {
      return { artists: [], counts: [] };
    }
    
    // Count artists
    const artistCounts = {};
    paintings.forEach(painting => {
      artistCounts[painting.artist] = (artistCounts[painting.artist] || 0) + 1;
    });
    
    // Sort by count descending
    const sortedArtists = Object.entries(artistCounts)
      .sort(([,a], [,b]) => b - a);
    
    const artists = sortedArtists.map(([artist]) => artist);
    const counts = sortedArtists.map(([,count]) => count);
    
    return { artists, counts };
  } catch (error) {
    console.error('Error getting artist counts from localStorage:', error);
    return { artists: [], counts: [] };
  }
}

export function clearAllLikedPaintingsFromLocalStorage() {
  try {
    const userId = getUserId();
    const allStored = localStorage.getItem(LIKED_PAINTINGS_KEY);
    
    if (!allStored) {
      return;
    }
    
    const allPaintings = JSON.parse(allStored);
    // Keep paintings from other users, remove only current user's paintings
    const otherUsersPaintings = allPaintings.filter(painting => painting.userId !== userId);
    
    localStorage.setItem(LIKED_PAINTINGS_KEY, JSON.stringify(otherUsersPaintings));
    console.log('Cleared all liked paintings for user:', userId);
  } catch (error) {
    console.error('Error clearing liked paintings from localStorage:', error);
  }
}

// Additional alias functions to match import names
export const removeLikedPaintingByIdFromLocalStorage = removeLikedPaintingFromLocalStorage;

// Functions for viewed paintings (localStorage equivalent of the server-side functionality)
const VIEWED_PAINTINGS_KEY = 'viewed_paintings';

export function markPaintingAsViewedInLocalStorage(url) {
  try {
    const userId = getUserId();
    const stored = localStorage.getItem(VIEWED_PAINTINGS_KEY);
    const viewedPaintings = stored ? JSON.parse(stored) : [];
    
    // Check if already viewed by this user
    const alreadyViewed = viewedPaintings.find(p => p.url === url && p.userId === userId);
    if (alreadyViewed) {
      return;
    }
    
    // Add to viewed list
    viewedPaintings.push({
      url: url,
      userId: userId,
      viewedTimestamp: Date.now()
    });
    
    localStorage.setItem(VIEWED_PAINTINGS_KEY, JSON.stringify(viewedPaintings));
  } catch (error) {
    console.error('Error marking painting as viewed in localStorage:', error);
  }
}

export async function getRandomUnviewedPaintingFromLocalStorage() {
  try {
    // We still need to fetch random paintings from the server API
    // but we'll filter out viewed ones using localStorage
    const response = await fetch('http://localhost:5050/random-unviewed', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify({
        savedPaintings: getAllLikedPaintingsFromLocalStorage()
      })
    });

    if (!response.ok) {
      if (response.status === 404) {
        const errorData = await response.json();
        console.log('Server message:', errorData.message || 'No more paintings available');
        return null;
      }
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const painting = await response.json();
    
    if (painting && painting.title) {
      // Mark as viewed in localStorage
      markPaintingAsViewedInLocalStorage(painting.url || painting.imageUrl);
      return painting;
    } else {
      console.log('No painting received from server');
      return null;
    }
  } catch (error) {
    console.error('Error fetching random unviewed painting:', error);
    throw error;
  }
}
