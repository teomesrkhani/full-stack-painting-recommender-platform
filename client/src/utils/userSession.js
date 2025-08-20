// User session management with UUID

// Updated to fetch user ID from the backend
export async function getUserId() {
  try {
    const response = await fetch('/user-session');
    if (!response.ok) {
      throw new Error('Failed to fetch user ID');
    }
    const data = await response.json();
    return data.userId;
  } catch (error) {
    throw error;
  }
}
