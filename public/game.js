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
    
    // 소켓 연결 (인증 정보 포함)
    socket = io({
        auth: {
            userId: currentUser.id
        }
    });

    socket.on('connect_error', (error) => {
        if (error.message === '인증이 필요합니다.') {
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

    // 클릭 이벤트 리스너 추가
    document.getElementById('click-area').addEventListener('click', () => {
        if (socket && socket.connected) {
            socket.emit('click-event');
        }
    });
}

// 랭킹 업데이트 함수
function updateRankings(rankings) {
    const rankingsList = document.getElementById('rankings-list');
    if (!rankingsList) return;

    rankingsList.innerHTML = '';
    rankings.forEach((user, index) => {
        const li = document.createElement('li');
        li.textContent = `${index + 1}. ${user.username}: ${user.tuk_points} TP`;
        rankingsList.appendChild(li);
    });
}

// 로그아웃
document.getElementById('logout-btn').addEventListener('click', logout);

function logout() {
    if (socket) {
        socket.disconnect();
    }
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