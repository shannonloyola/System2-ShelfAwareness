const recentCounts = [];

export const addRecentCount = (count) => {
  recentCounts.unshift(count);
  if (recentCounts.length > 20) {
    recentCounts.length = 20;
  }
  return count;
};

export const listRecentCounts = (limit = 5) => recentCounts.slice(0, limit);
