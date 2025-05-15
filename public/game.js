// 전역 변수
let currentUser = null;
let socket = null;

// 로그인 폼 처리
document.getElementById('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = e.target.username.value;
    const password = e.target.password.value;

    try {
        const response = await fetch('/api/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ username, password })
        });

        const data = await response.json();
        if (data.success) {
            currentUser = data.user;
            localStorage.setItem('token', data.token);
            initializeGame();
        } else {
            alert(data.error);
        }
    } catch (error) {
        alert('로그인 중 오류가 발생했습니다.');
    }
});

// 회원가입 폼 처리
document.getElementById('register-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = e.target.username.value;
    const password = e.target.password.value;

    try {
        const response = await fetch('/api/register', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ username, password })
        });

        const data = await response.json();
        if (data.success) {
            alert('회원가입이 완료되었습니다.');
            document.querySelector('[data-tab="login"]').click();
        } else {
            alert(data.error);
        }
    } catch (error) {
        alert('회원가입 중 오류가 발생했습니다.');
    }
});

// 게임 초기화
function initializeGame() {
    document.getElementById('auth-container').style.display = 'none';
    document.getElementById('game-container').style.display = 'flex';
    
    // 소켓 연결
    const token = localStorage.getItem('token');
    socket = io({
        auth: { token }
    });

    socket.on('connect_error', (error) => {
        if (error.message === '인증이 필요합니다.' || error.message === '유효하지 않은 토큰입니다.') {
            alert('세션이 만료되었습니다. 다시 로그인해주세요.');
            logout();
        }
    });

    // TP 업데이트
    socket.on('tp-update', (data) => {
        if (data.userId === currentUser.id) {
            document.getElementById('tp-count').textContent = data.tp;
        }
    });

    // 랭킹 업데이트
    socket.on('rankings-update', updateRankings);

    // 초기 TP 표시
    document.getElementById('tp-count').textContent = currentUser.tuk_points;
}

// 랭킹 업데이트
async function updateRankings(rankings) {
    const topRankings = document.getElementById('top-rankings');
    const otherRankings = document.getElementById('other-rankings');
    
    topRankings.innerHTML = '';
    otherRankings.innerHTML = '';

    rankings.forEach((user, index) => {
        const rankingItem = document.createElement('div');
        rankingItem.className = 'ranking-item';
        
        if (index < 3) {
            rankingItem.classList.add(['gold', 'silver', 'bronze'][index]);
        }

        const position = document.createElement('div');
        position.className = 'ranking-position';
        position.textContent = `#${index + 1}`;

        const info = document.createElement('div');
        info.className = 'ranking-info';
        
        const username = document.createElement('div');
        username.className = 'ranking-username';
        username.textContent = user.username;
        
        const points = document.createElement('div');
        points.className = 'ranking-points';
        points.textContent = `TP: ${user.tuk_points}`;

        info.appendChild(username);
        info.appendChild(points);
        
        rankingItem.appendChild(position);
        rankingItem.appendChild(info);

        if (index < 3) {
            topRankings.appendChild(rankingItem);
        } else {
            otherRankings.appendChild(rankingItem);
        }
    });
}

// 클릭 이벤트 처리
document.querySelector('.tuk-image-container').addEventListener('click', () => {
    if (!socket || !currentUser) return;
    
    socket.emit('click-event', {});
    
    // 클릭 애니메이션
    const container = document.querySelector('.tuk-image-container');
    container.classList.add('clicked');
    setTimeout(() => container.classList.remove('clicked'), 200);
});

// 랭킹 보기 버튼
document.getElementById('show-rankings-btn').addEventListener('click', () => {
    document.getElementById('rankings-container').style.display = 'block';
});

// 랭킹 닫기 버튼
document.getElementById('close-rankings-btn').addEventListener('click', () => {
    document.getElementById('rankings-container').style.display = 'none';
});

// 로그아웃
document.getElementById('logout-btn').addEventListener('click', logout);

function logout() {
    if (socket) {
        socket.disconnect();
    }
    localStorage.removeItem('token');
    currentUser = null;
    document.getElementById('game-container').style.display = 'none';
    document.getElementById('auth-container').style.display = 'block';
}

// 탭 전환
document.querySelectorAll('.tab-btn').forEach(button => {
    button.addEventListener('click', () => {
        document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
        document.querySelectorAll('.auth-form').forEach(form => form.classList.remove('active'));
        
        button.classList.add('active');
        document.getElementById(`${button.dataset.tab}-form`).classList.add('active');
    });
}); 