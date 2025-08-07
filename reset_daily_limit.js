// Reset daily limit for testing
chrome.storage.sync.set({ dailyUsage: 0 }, () => {
  console.log('Daily usage reset to 0');
});

chrome.storage.local.get(['stats'], (result) => {
  if (result.stats) {
    result.stats.todayScores = 0;
    chrome.storage.local.set({ stats: result.stats }, () => {
      console.log('Stats reset:', result.stats);
    });
  }
});
