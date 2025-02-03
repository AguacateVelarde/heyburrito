// Utility functions for color mode
const getColorMode = () => {
  return window.matchMedia('(prefers-color-scheme: dark)').matches
    ? 'dark'
    : 'light';
};

const getColors = () => {
  const isDark = getColorMode() === 'dark';
  return {
    bgColor: isDark ? '#1A202C' : 'white',
    borderColor: isDark ? '#2D3748' : '#E2E8F0',
  };
};

// Fetch dashboard data
async function fetchDashboardData() {
  const response = await fetch('/api/admin/dashboard');
  if (!response.ok) throw new Error('Failed to fetch dashboard data');
  return response.json();
}

// Create stat card element
function createStatCard(label, value, colors) {
  const stat = document.createElement('div');
  stat.className = 'stat';
  stat.style.padding = '1rem';
  stat.style.backgroundColor = colors.bgColor;
  stat.style.borderRadius = '0.5rem';
  stat.style.border = `1px solid ${colors.borderColor}`;

  const statLabel = document.createElement('div');
  statLabel.className = 'stat-label';
  statLabel.textContent = label;
  statLabel.style.fontSize = '0.875rem';
  statLabel.style.color = '#718096';

  const statNumber = document.createElement('div');
  statNumber.className = 'stat-number';
  statNumber.textContent = value;
  statNumber.style.fontSize = '1.875rem';
  statNumber.style.fontWeight = 'bold';
  statNumber.style.marginTop = '0.25rem';

  stat.appendChild(statLabel);
  stat.appendChild(statNumber);
  return stat;
}

// Create leaderboard table
function createLeaderboardTable(leaderboard, colors) {
  const table = document.createElement('table');
  table.className = 'leaderboard-table';
  table.style.width = '100%';
  table.style.borderCollapse = 'collapse';

  const thead = document.createElement('thead');
  const headerRow = document.createElement('tr');
  ['Position', 'User', 'Burritos'].forEach((text) => {
    const th = document.createElement('th');
    th.textContent = text;
    th.style.padding = '0.75rem';
    th.style.textAlign = text === 'Burritos' ? 'right' : 'left';
    th.style.borderBottom = `1px solid ${colors.borderColor}`;
    headerRow.appendChild(th);
  });
  thead.appendChild(headerRow);

  const tbody = document.createElement('tbody');
  leaderboard.forEach((user, index) => {
    const row = document.createElement('tr');
    const position = document.createElement('td');
    position.textContent = index + 1;
    const userName = document.createElement('td');
    userName.textContent = user.slackId;
    const burritos = document.createElement('td');
    burritos.textContent = user.burritosReceived;
    burritos.style.textAlign = 'right';

    [position, userName, burritos].forEach((cell) => {
      cell.style.padding = '0.75rem';
      cell.style.borderBottom = `1px solid ${colors.borderColor}`;
    });

    row.appendChild(position);
    row.appendChild(userName);
    row.appendChild(burritos);
    tbody.appendChild(row);
  });

  table.appendChild(thead);
  table.appendChild(tbody);
  return table;
}

// Initialize dashboard
async function initDashboard() {
  const app = document.getElementById('root');
  app.style.fontFamily = 'Inter, system-ui, sans-serif';

  try {
    // Show loading state
    app.textContent = 'Loading...';

    const data = await fetchDashboardData();
    const colors = getColors();

    // Clear loading state
    app.textContent = '';

    // Create container
    const container = document.createElement('div');
    container.style.maxWidth = '1280px';
    container.style.margin = '0 auto';
    container.style.padding = '2rem 1rem';

    // Add heading
    const heading = document.createElement('h1');
    heading.textContent = 'HeyBurrito Admin Dashboard';
    heading.style.fontSize = '2rem';
    heading.style.fontWeight = 'bold';
    heading.style.marginBottom = '2rem';
    container.appendChild(heading);

    // Create stats grid
    const statsGrid = document.createElement('div');
    statsGrid.style.display = 'grid';
    statsGrid.style.gridTemplateColumns = 'repeat(3, 1fr)';
    statsGrid.style.gap = '1.5rem';
    statsGrid.style.marginBottom = '2rem';

    // Add stat cards
    statsGrid.appendChild(
      createStatCard('Total Burritos', data.burritoStats.total, colors),
    );
    statsGrid.appendChild(
      createStatCard('Active Users', data.userStats.active, colors),
    );
    statsGrid.appendChild(
      createStatCard('Daily Average', data.burritoStats.dailyAverage, colors),
    );
    container.appendChild(statsGrid);

    // Create leaderboard section
    const leaderboardSection = document.createElement('div');
    leaderboardSection.style.backgroundColor = colors.bgColor;
    leaderboardSection.style.borderRadius = '0.5rem';
    leaderboardSection.style.border = `1px solid ${colors.borderColor}`;
    leaderboardSection.style.padding = '1.5rem';
    leaderboardSection.style.marginBottom = '2rem';

    const leaderboardHeading = document.createElement('h2');
    leaderboardHeading.textContent = 'Leaderboard';
    leaderboardHeading.style.fontSize = '1.25rem';
    leaderboardHeading.style.fontWeight = 'bold';
    leaderboardHeading.style.marginBottom = '1rem';
    leaderboardSection.appendChild(leaderboardHeading);

    leaderboardSection.appendChild(
      createLeaderboardTable(data.leaderboard, colors),
    );
    container.appendChild(leaderboardSection);

    app.appendChild(container);
  } catch (error) {
    app.textContent = 'Error loading dashboard';
    console.error('Dashboard error:', error);
  }
}

// Initialize the dashboard when DOM is loaded
document.addEventListener('DOMContentLoaded', initDashboard);
