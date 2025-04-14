let tpCount = 0;
let currentUser = null;
let jawCount = 0;

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
    
    if (formData.get('password') !== formData.get('confirmPassword')) {
        alert('비밀번호가 일치하지 않습니다.');
        return;
    }
    
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

// 화면 클릭 이벤트
gameContainer.addEventListener('click', (e) => {
    if (!currentUser) return;
    
    // 로그아웃 버튼이나 랭킹 클릭 시 이벤트 전파 중단
    if (e.target.closest('.stats')) {
        return;
    }
    
    tpCount++;
    tpCountElement.textContent = tpCount;
    
    // 턱 추가
    addJaw();
    
    // 점수 업데이트
    updateScore();
});

// 턱 추가 함수
function addJaw() {
    const jawElement = document.createElement('div');
    jawElement.className = 'tuk-add';
    tukAddContainer.appendChild(jawElement);
    jawCount++;
}

// 점수 업데이트 함수
async function updateScore() {
    try {
        const response = await fetch('/api/update-score', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                userId: currentUser.id,
                points: 1
            })
        });
        
        if (response.ok) {
            // 실시간으로 랭킹 업데이트
            updateRankings();
            // 현재 사용자의 TP도 업데이트
            currentUser.tuk_points = tpCount;
        }
    } catch (error) {
        console.error('점수 업데이트 실패:', error);
    }
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
                                <div class="ranking-username">${rank.username}</div>
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
                            <div class="ranking-username">${rank.username}</div>
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

// 주기적으로 랭킹 업데이트
setInterval(updateRankings, 5000); 