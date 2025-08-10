// NetworkIQ History Page Script

let allProfiles = [];
let currentFilter = 'all';
let currentSort = 'recent';

document.addEventListener('DOMContentLoaded', async () => {
    await loadProfiles();
    setupFilters();
    updateStats();
});

async function loadProfiles() {
    // Load profiles from storage
    const result = await chrome.storage.local.get(['scoredProfiles']);
    allProfiles = result.scoredProfiles || [];
    
    // Mock data for testing if no profiles
    if (allProfiles.length === 0 && window.location.search.includes('demo')) {
        allProfiles = generateMockProfiles();
    }
    
    renderProfiles();
}

function generateMockProfiles() {
    return [
        {
            id: 1,
            name: "Sarah Johnson",
            title: "Senior Product Manager at Google",
            company: "Google",
            score: 85,
            tier: "platinum",
            connections: ["USAFA Alumni", "Former C3 AI"],
            timestamp: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
            url: "https://linkedin.com/in/sarahjohnson",
            messageGenerated: true
        },
        {
            id: 2,
            name: "Michael Chen",
            title: "Software Engineer at Meta",
            company: "Meta",
            score: 65,
            tier: "gold",
            connections: ["Big Tech AI", "Product Management"],
            timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(),
            url: "https://linkedin.com/in/michaelchen",
            messageGenerated: true
        },
        {
            id: 3,
            name: "Emily Davis",
            title: "Data Scientist at OpenAI",
            company: "OpenAI",
            score: 92,
            tier: "platinum",
            connections: ["Military Veteran", "Big Tech AI"],
            timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
            url: "https://linkedin.com/in/emilydavis",
            messageGenerated: false
        },
        {
            id: 4,
            name: "James Wilson",
            title: "VP Engineering at Startup",
            company: "TechStartup Inc",
            score: 45,
            tier: "silver",
            connections: ["Similar Background"],
            timestamp: new Date(Date.now() - 1000 * 60 * 60 * 48).toISOString(),
            url: "https://linkedin.com/in/jameswilson",
            messageGenerated: true
        },
        {
            id: 5,
            name: "Lisa Martinez",
            title: "Product Designer at Anthropic",
            company: "Anthropic",
            score: 78,
            tier: "platinum",
            connections: ["USAFA Alumni", "Product Management"],
            timestamp: new Date(Date.now() - 1000 * 60 * 60 * 72).toISOString(),
            url: "https://linkedin.com/in/lisamartinez",
            messageGenerated: false
        }
    ];
}

function renderProfiles() {
    const profilesList = document.getElementById('profiles-list');
    const emptyState = document.getElementById('empty-state');
    
    // Filter profiles
    let filteredProfiles = [...allProfiles];
    if (currentFilter !== 'all') {
        filteredProfiles = filteredProfiles.filter(p => p.tier === currentFilter);
    }
    
    // Sort profiles
    if (currentSort === 'score') {
        filteredProfiles.sort((a, b) => b.score - a.score);
    } else {
        filteredProfiles.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    }
    
    if (filteredProfiles.length === 0) {
        profilesList.style.display = 'none';
        emptyState.style.display = 'block';
        return;
    }
    
    profilesList.style.display = 'grid';
    emptyState.style.display = 'none';
    
    profilesList.innerHTML = filteredProfiles.map(profile => `
        <div class="profile-card">
            <div class="profile-info">
                <div class="profile-name">${profile.name}</div>
                <div class="profile-title">${profile.title}</div>
                <div class="profile-meta">
                    <span>${formatDate(profile.timestamp)}</span>
                    <span>•</span>
                    <span class="tier-badge tier-${profile.tier}">${profile.tier}</span>
                    ${profile.connections ? `
                        <span>•</span>
                        <span>${profile.connections.join(', ')}</span>
                    ` : ''}
                </div>
            </div>
            <div class="profile-score">
                <div class="score-value">${profile.score}</div>
                <div class="score-label">Score</div>
            </div>
            <div class="profile-actions">
                <button class="action-btn view-btn" onclick="viewProfile('${profile.url}')">
                    View Profile
                </button>
                <button class="action-btn export-btn" onclick="exportProfile(${profile.id})">
                    Export
                </button>
            </div>
        </div>
    `).join('');
}

function setupFilters() {
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const filter = e.target.dataset.filter;
            const sort = e.target.dataset.sort;
            
            if (filter) {
                currentFilter = filter;
                document.querySelectorAll('[data-filter]').forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
            }
            
            if (sort) {
                currentSort = sort;
                document.querySelectorAll('[data-sort]').forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
            }
            
            renderProfiles();
        });
    });
}

function updateStats() {
    const totalProfiles = allProfiles.length;
    const avgScore = totalProfiles > 0 
        ? Math.round(allProfiles.reduce((sum, p) => sum + p.score, 0) / totalProfiles)
        : 0;
    const messagesGenerated = allProfiles.filter(p => p.messageGenerated).length;
    
    // Count profiles from this week
    const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const thisWeek = allProfiles.filter(p => new Date(p.timestamp) > oneWeekAgo).length;
    
    // Update stats with null checks
    const totalProfilesEl = document.getElementById('total-profiles');
    const avgScoreEl = document.getElementById('avg-score');
    const messagesSentEl = document.getElementById('messages-sent');
    const connectionsMadeEl = document.getElementById('connections-made');
    
    if (totalProfilesEl) totalProfilesEl.textContent = totalProfiles;
    if (avgScoreEl) avgScoreEl.textContent = avgScore;
    if (messagesSentEl) messagesSentEl.textContent = messagesGenerated;
    if (connectionsMadeEl) connectionsMadeEl.textContent = thisWeek;
}

function formatDate(timestamp) {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now - date;
    
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    
    if (minutes < 60) {
        return `${minutes} minute${minutes !== 1 ? 's' : ''} ago`;
    } else if (hours < 24) {
        return `${hours} hour${hours !== 1 ? 's' : ''} ago`;
    } else if (days < 7) {
        return `${days} day${days !== 1 ? 's' : ''} ago`;
    } else {
        return date.toLocaleDateString();
    }
}

function viewProfile(url) {
    chrome.tabs.create({ url });
}

function exportProfile(profileId) {
    const profile = allProfiles.find(p => p.id === profileId);
    if (!profile) return;
    
    const csvContent = `Name,Title,Company,Score,Tier,Connections,Date\n` +
        `"${profile.name}","${profile.title}","${profile.company}",${profile.score},${profile.tier},"${profile.connections?.join('; ') || ''}","${new Date(profile.timestamp).toLocaleDateString()}"`;
    
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `networkiq-profile-${profile.name.replace(/\s+/g, '-').toLowerCase()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
}

// Export all profiles
window.exportAllProfiles = function() {
    if (allProfiles.length === 0) {
        alert('No profiles to export');
        return;
    }
    
    const csvContent = `Name,Title,Company,Score,Tier,Connections,Date\n` +
        allProfiles.map(profile => 
            `"${profile.name}","${profile.title}","${profile.company}",${profile.score},${profile.tier},"${profile.connections?.join('; ') || ''}","${new Date(profile.timestamp).toLocaleDateString()}"`
        ).join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `networkiq-all-profiles-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
};