import { getUserId } from './userSession';

const VIEWED_PAINTINGS_KEY = 'viewed_paintings';

function getViewedPaintings() {
  const viewed = localStorage.getItem(VIEWED_PAINTINGS_KEY);
  return viewed ? JSON.parse(viewed) : [];
}

function saveViewedPaintings(viewed) {
  localStorage.setItem(VIEWED_PAINTINGS_KEY, JSON.stringify(viewed));
}

export function markPaintingAsViewed(paintingId) {
  const userId = getUserId();
  let viewed = getViewedPaintings();
  if (!viewed.find(p => p.paintingId === paintingId && p.userId === userId)) {
    viewed.push({ paintingId, userId, timestamp: Date.now() });
    saveViewedPaintings(viewed);
  }
}

export function getViewedPaintingIds() {
  const userId = getUserId();
  return getViewedPaintings()
    .filter(p => p.userId === userId)
    .map(p => p.paintingId);
}

export function clearViewedPaintings() {
  const userId = getUserId();
  let viewed = getViewedPaintings();
  viewed = viewed.filter(p => p.userId !== userId);
  saveViewedPaintings(viewed);
}

export async function getRandomUnviewedPainting(excludeIds = []) {
  try {
    const viewedIds = getViewedPaintingIds();
    const exclude = [...new Set([...excludeIds, ...viewedIds])];
    
    const response = await fetch('http://localhost:5050/random-unviewed', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': getUserId()
      },
      body: JSON.stringify({ exclude_ids: exclude })
    });

    if (!response.ok) {
      if (response.status === 404) return null;
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const painting = await response.json();
    if (painting) {
      markPaintingAsViewed(painting._id);
    }
    return painting;
  } catch (error) {
    console.error('Failed to fetch random unviewed painting:', error);
    return null;
  }
}