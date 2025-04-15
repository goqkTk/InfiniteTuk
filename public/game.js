let tpCount = 0;
let currentUser = null;
let jawCount = 0;

// Socket.IO 연결
const socket = io();

const authContainer = document.getElementById('auth-container');
const gameContainer = document.getElementById('game-container');
const tukTop = document.getElementById('tuk-top');
const tukBottom = document.getElementById('tuk-bottom');
const tukAddContainer = document.getElementById('tuk-add-container');
const tpCountElement = document.getElementById('tp-count');
const logoutBtn = document.getElementById('logout-btn');
const rankingsElement = document.getElementById('rankings');
const tabBtns = document.querySelectorAll('.tab-btn');
const authForms = document.querySelectorAll('.auth-form');

// 랭킹 관련 요소
const rankingsContainer = document.getElementById('rankings-container');
const showRankingsBtn = document.getElementById('show-rankings-btn');
const closeRankingsBtn = document.getElementById('close-rankings-btn');
const topRankings = document.getElementById('top-rankings');
const otherRankings = document.getElementById('other-rankings');

function escapeHtml(unsafe) {
    const div = document.createElement('div');
    div.textContent = unsafe;
    return div.innerHTML;
}

// Socket.IO 연결 이벤트
socket.on('connect', () => {
    // 저장된 사용자 정보가 있으면 로그인 상태 복원
    const savedUser = localStorage.getItem('currentUser');
    if (savedUser) {
        try {
            const user = JSON.parse(savedUser);
            // 서버에서 최신 사용자 정보 가져오기
            fetch(`/api/user/${user.id}`)
                .then(response => response.json())
                .then(data => {
                    if (data.success) {
                        currentUser = data.user;
                        tpCount = data.user.tuk_points;
                        tpCountElement.textContent = tpCount;
                        
                        // Socket.IO 연결 설정
                        socket.emit('user-login', currentUser.id);
                        
                        showGame();
                        updateRankings();
                        restoreJaw();
                    } else {
                        // 사용자 정보를 가져올 수 없는 경우 로그아웃
                        localStorage.removeItem('currentUser');
                        alert('세션이 만료되었습니다. 다시 로그인해주세요.');
                    }
                })
                .catch(error => {
                    localStorage.removeItem('currentUser');
                });
        } catch (error) {
            localStorage.removeItem('currentUser');
        }
    }
});

socket.on('disconnect', () => {});

// 탭 전환
tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        const tabName = btn.dataset.tab;
        
        // 탭 버튼 활성화
        tabBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        
        // 폼 표시
        authForms.forEach(form => {
            form.classList.remove('active');
            if (form.id === `${tabName}-form`) {
                form.classList.add('active');
            }
        });
    });
});

// 로그인 폼 제출
document.getElementById('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    
    try {
        const response = await fetch('/api/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                username: formData.get('username'),
                password: formData.get('password')
            })
        });
        
        const data = await response.json();
        
        if (data.success) {
            currentUser = data.user;
            tpCount = data.user.tuk_points;
            localStorage.setItem('currentUser', JSON.stringify(currentUser));
            
            // Socket.IO 연결 설정
            socket.emit('user-login', currentUser.id);
            
            showGame();
            updateRankings();
            restoreJaw();
        } else {
            alert(data.error);
        }
    } catch (error) {
        alert('로그인 중 오류가 발생했습니다.');
    }
});

// 회원가입 폼 제출
document.getElementById('register-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    
    try {
        const response = await fetch('/api/register', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                username: formData.get('username'),
                password: formData.get('password')
            })
        });
        
        const data = await response.json();
        
        if (data.success) {
            alert('회원가입이 완료되었습니다. 로그인해주세요.');
            // 로그인 탭으로 전환
            document.querySelector('[data-tab="login"]').click();
        } else {
            alert(data.error);
        }
    } catch (error) {
        alert('회원가입 중 오류가 발생했습니다.');
    }
});

// 로그아웃
logoutBtn.addEventListener('click', () => {
    currentUser = null;
    tpCount = 0;
    jawCount = 0;
    localStorage.removeItem('currentUser');
    resetJaw();
    showAuth();
});

// 게임 화면 표시
function showGame() {
    authContainer.style.display = 'none';
    gameContainer.style.display = 'flex';
    tpCountElement.textContent = tpCount;
}

// 로그인 화면 표시
function showAuth() {
    authContainer.style.display = 'block';
    gameContainer.style.display = 'none';
}

// 턱 초기화
function resetJaw() {
    tukAddContainer.innerHTML = '';
    jawCount = 0;
}

// 턱 복원
function restoreJaw() {
    resetJaw();
    for (let i = 0; i < tpCount; i++) {
        addJaw();
    }
}

// 턱 추가 함수
function addJaw() {
    const jawElement = document.createElement('div');
    jawElement.className = 'tuk-add';
    tukAddContainer.appendChild(jawElement);
    jawCount++;
}

// 화면 클릭 이벤트
gameContainer.addEventListener('click', (e) => {
    if (!currentUser) return;
    
    // 로그아웃 버튼이나 랭킹 클릭 시 이벤트 전파 중단
    if (e.target.closest('.stats')) {
        return;
    }
    
    // 서버에 클릭 이벤트 전송
    socket.emit('click-event', {
        userId: currentUser.id
    });
    
    // 턱 추가
    addJaw();
    
    // 클릭 효과 추가
    addClickEffect();
});

// 점수 업데이트 함수
function updateScore() {
    // 서버에 TP 업데이트 알림
    socket.emit('update-tp', {
        userId: currentUser.id,
        tp: tpCount
    });
}

// 랭킹 보기 버튼 클릭
showRankingsBtn.addEventListener('click', () => {
    rankingsContainer.style.display = 'block';
    updateRankings();
});

// 랭킹 닫기 버튼 클릭
closeRankingsBtn.addEventListener('click', () => {
    rankingsContainer.style.display = 'none';
});

// 랭킹 업데이트 함수
async function updateRankings() {
    try {
        const response = await fetch('/api/rankings');
        const rankings = await response.json();
        
        if (Array.isArray(rankings)) {
            // 상위 3명 랭킹
            const topThree = rankings.slice(0, 3);
            topRankings.innerHTML = topThree
                .map((rank, index) => {
                    const medals = ['gold', 'silver', 'bronze'];
                    const medalIcons = ['🥇', '🥈', '🥉'];
                    return `
                        <div class="ranking-item ${medals[index]}">
                            <div class="ranking-position">${index + 1}</div>
                            <div class="ranking-medal">${medalIcons[index]}</div>
                            <div class="ranking-info">
                                <div class="ranking-username">${escapeHtml(rank.username)}</div>
                                <div class="ranking-points">${rank.tuk_points || 0} TP</div>
                            </div>
                        </div>
                    `;
                })
                .join('');

            // 나머지 랭킹
            const others = rankings.slice(3);
            otherRankings.innerHTML = others
                .map((rank, index) => `
                    <div class="ranking-item">
                        <div class="ranking-position">${index + 4}</div>
                        <div class="ranking-info">
                            <div class="ranking-username">${escapeHtml(rank.username)}</div>
                            <div class="ranking-points">${rank.tuk_points || 0} TP</div>
                        </div>
                    </div>
                `)
                .join('');
        } else {
            topRankings.innerHTML = '<div class="ranking-error">랭킹 정보를 불러올 수 없습니다.</div>';
            otherRankings.innerHTML = '';
        }
    } catch (error) {
        console.error('랭킹 업데이트 실패:', error);
        topRankings.innerHTML = '<div class="ranking-error">랭킹 정보를 불러올 수 없습니다.</div>';
        otherRankings.innerHTML = '';
    }
}

// Socket.IO 이벤트 처리
socket.on('tp-update', (data) => {
    if (currentUser && data.userId === currentUser.id) {
        tpCount = data.tp;
        tpCountElement.textContent = tpCount;
        restoreJaw();
    }
});

socket.on('rankings-update', (rankings) => {
    if (Array.isArray(rankings)) {
        // 상위 3명 랭킹
        const topThree = rankings.slice(0, 3);
        topRankings.innerHTML = topThree
            .map((rank, index) => {
                const medals = ['gold', 'silver', 'bronze'];
                const medalIcons = ['🥇', '🥈', '🥉'];
                return `
                    <div class="ranking-item ${medals[index]}">
                        <div class="ranking-position">${index + 1}</div>
                        <div class="ranking-medal">${medalIcons[index]}</div>
                        <div class="ranking-info">
                            <div class="ranking-username">${escapeHtml(rank.username)}</div>
                            <div class="ranking-points">${rank.tuk_points || 0} TP</div>
                        </div>
                    </div>
                `;
            })
            .join('');

        // 나머지 랭킹
        const others = rankings.slice(3);
        otherRankings.innerHTML = others
            .map((rank, index) => `
                <div class="ranking-item">
                    <div class="ranking-position">${index + 4}</div>
                    <div class="ranking-info">
                        <div class="ranking-username">${escapeHtml(rank.username)}</div>
                        <div class="ranking-points">${rank.tuk_points || 0} TP</div>
                    </div>
                </div>
            `)
            .join('');
    }
});

// 주기적으로 랭킹 업데이트
setInterval(updateRankings, 5000);

// 클릭 효과 추가 함수
function addClickEffect() {
    // 턱 이미지 컨테이너에 클릭 효과 추가
    const tukImageContainer = document.querySelector('.tuk-image-container');
    
    // 이미 애니메이션이 진행 중이면 중복 실행 방지
    if (tukImageContainer.classList.contains('clicked')) {
        return;
    }
    
    tukImageContainer.classList.add('clicked');
    
    // 마지막으로 추가된 턱에 반짝이는 효과 추가
    const lastJaw = document.querySelector('.tuk-add:last-child');
    if (lastJaw) {
        lastJaw.classList.add('sparkle');
    }
    
    // 애니메이션 종료 후 클래스 제거
    setTimeout(() => {
        tukImageContainer.classList.remove('clicked');
        if (lastJaw) {
            lastJaw.classList.remove('sparkle');
        }
    }, 200); // 애니메이션 시간을 0.2초로 맞춤
} 