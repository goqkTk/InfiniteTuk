const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');
const path = require('path');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const helmet = require('helmet');
const xss = require('xss-clean');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;

// 보안 미들웨어 설정
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
            imgSrc: ["'self'", "data:", "https:"],
            connectSrc: ["'self'", "ws:", "wss:"]
        }
    }
}));
app.use(xss());

// Socket.IO 설정
const http = require('http').createServer(app);
const io = require('socket.io')(http);

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

function escapeHtml(unsafe) {
    return unsafe
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

// MySQL 연결 설정
const db = mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME
});

// JWT 토큰 생성 함수
function generateToken(userId) {
    return jwt.sign(
        { userId },
        process.env.JWT_SECRET || 'superduperholymolylegendpublickey',
        { expiresIn: process.env.JWT_EXPIRES_IN || '1h' }
    );
}

// JWT 토큰 검증 미들웨어
function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ success: false, error: '인증이 필요합니다.' });
    }

    jwt.verify(token, process.env.JWT_SECRET || 'superduperholymolylegendpublickey', (err, user) => {
        if (err) {
            return res.status(403).json({ success: false, error: '유효하지 않은 토큰입니다.' });
        }
        req.user = user;
        next();
    });
}

// 데이터베이스 연결 및 초기화
function initializeDatabase() {
    // 데이터베이스 생성
    db.query('CREATE DATABASE IF NOT EXISTS infinitetuk', (err) => {
        if (err) {
            console.error('데이터베이스 생성 실패:', err);
            return;
        }

        // 데이터베이스 선택
        db.query('USE infinitetuk', (err) => {
            if (err) {
                console.error('데이터베이스 선택 실패:', err);
                return;
            }

            // users 테이블 생성
            const createUsersTable = `
                CREATE TABLE IF NOT EXISTS users (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    username VARCHAR(255) UNIQUE NOT NULL,
                    password VARCHAR(255) NOT NULL,
                    tuk_points INT DEFAULT 0
                )
            `;

            db.query(createUsersTable, (err) => {
                if (err) {
                    console.error('users 테이블 생성 실패:', err);
                    return;
                }

                // 기존 테이블에 tuk_points 컬럼이 없으면 추가
                db.query("SHOW COLUMNS FROM users LIKE 'tuk_points'", (err, results) => {
                    if (err) {
                        console.error('컬럼 확인 실패:', err);
                        return;
                    }

                    if (results.length === 0) {
                        db.query('ALTER TABLE users ADD COLUMN tuk_points INT DEFAULT 0', (err) => {
                            if (err) {
                                console.error('tuk_points 컬럼 추가 실패:', err);
                                return;
                            }
                            console.log('tuk_points 컬럼 추가 완료');
                        });
                    }
                });
            });
        });
    });
}

// 데이터베이스 연결
db.connect((err) => {
    if (err) {
        console.error('MySQL 연결 실패:', err);
        return;
    }
    console.log('MySQL 연결 성공');
    initializeDatabase();
});

// 연결 에러 처리
db.on('error', (err) => {
    console.error('MySQL 연결 에러:', err);
    if (err.code === 'PROTOCOL_CONNECTION_LOST') {
        console.log('MySQL 연결 재시도...');
        db.connect((err) => {
            if (err) {
                console.error('MySQL 재연결 실패:', err);
                return;
            }
            console.log('MySQL 재연결 성공');
        });
    }
});

// 회원가입 API
app.post('/api/register', async (req, res) => {
    const { username, password } = req.body;
    
    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        
        db.query(
            'INSERT INTO users (username, password) VALUES (?, ?)',
            [username, hashedPassword],
            (err, result) => {
                if (err) {
                    if (err.code === 'ER_DUP_ENTRY') {
                        return res.json({ success: false, error: '이미 존재하는 아이디입니다.' });
                    }
                    console.error('회원가입 에러:', err);
                    return res.json({ success: false, error: '회원가입 중 오류가 발생했습니다.' });
                }
                res.json({ success: true });
            }
        );
    } catch (error) {
        console.error('비밀번호 해시화 에러:', error);
        res.json({ success: false, error: '회원가입 중 오류가 발생했습니다.' });
    }
});

// 로그인 API
app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    
    db.query(
        'SELECT * FROM users WHERE username = ?',
        [username],
        async (err, results) => {
            if (err) {
                console.error('로그인 에러:', err);
                return res.status(500).json({ success: false, error: '서버 오류가 발생했습니다.' });
            }
            
            if (results.length === 0) {
                return res.status(401).json({ success: false, error: '아이디 또는 비밀번호가 일치하지 않습니다.' });
            }
            
            try {
                const user = results[0];
                const passwordMatch = await bcrypt.compare(password, user.password);
                
                if (!passwordMatch) {
                    return res.status(401).json({ success: false, error: '아이디 또는 비밀번호가 일치하지 않습니다.' });
                }
                
                const token = generateToken(user.id);
                
                res.json({ 
                    success: true, 
                    token,
                    user: {
                        id: user.id,
                        username: escapeHtml(user.username),
                        tuk_points: user.tuk_points || 0
                    }
                });                
            } catch (error) {
                console.error('비밀번호 검증 에러:', error);
                res.status(500).json({ success: false, error: '서버 오류가 발생했습니다.' });
            }
        }
    );
});

// Socket.IO 연결 처리
const userSockets = new Map(); // 사용자 ID별 소켓 연결 관리

io.on('connection', (socket) => {
    socket.on('user-login', (token) => {
        try {
            const decoded = jwt.verify(token, process.env.JWT_SECRET || 'superduperholymolylegendpublickey');
            const userId = decoded.userId;
            
            if (!userSockets.has(userId)) {
                userSockets.set(userId, new Set());
            }
            userSockets.get(userId).add(socket);
            
            // 초기 랭킹 데이터 전송
            db.query(
                'SELECT username, tuk_points FROM users ORDER BY tuk_points DESC',
                (err, rankings) => {
                    if (err) {
                        console.error('랭킹 조회 에러:', err);
                        return;
                    }
                    socket.emit('rankings-update', rankings || []);
                }
            );
        } catch (error) {
            console.error('토큰 검증 에러:', error);
            socket.disconnect();
        }
    });

    // 클릭 이벤트 처리
    socket.on('click-event', (data) => {
        const { userId } = data;
        
        // 데이터베이스에서 현재 점수 조회
        db.query(
            'SELECT tuk_points FROM users WHERE id = ?',
            [userId],
            (err, results) => {
                if (err || results.length === 0) return;
                
                const currentPoints = results[0].tuk_points;
                const newPoints = currentPoints + 1;
                
                // 점수 업데이트
                db.query(
                    'UPDATE users SET tuk_points = ? WHERE id = ?',
                    [newPoints, userId],
                    (err, result) => {
                        if (err) return;
                        
                        // 해당 사용자의 모든 세션에 TP 업데이트 알림
                        const userSocketsSet = userSockets.get(userId);
                        if (userSocketsSet) {
                            userSocketsSet.forEach(socket => {
                                socket.emit('tp-update', {
                                    userId: userId,
                                    tp: newPoints
                                });
                            });
                        }
                        
                        // 랭킹 업데이트
                        db.query(
                            'SELECT username, tuk_points FROM users ORDER BY tuk_points DESC',
                            (err, rankings) => {
                                if (err) return;
                                io.emit('rankings-update', rankings || []);
                            }
                        );
                    }
                );
            }
        );
    });

    // 연결 해제 시 소켓 제거
    socket.on('disconnect', () => {
        userSockets.forEach((sockets, userId) => {
            if (sockets.has(socket)) {
                sockets.delete(socket);
                if (sockets.size === 0) {
                    userSockets.delete(userId);
                }
            }
        });
    });
});

// 랭킹 조회 API
app.get('/api/rankings', (req, res) => {
    db.query(
        'SELECT username, tuk_points FROM users ORDER BY tuk_points DESC',
        (err, results) => {
            if (err) {
                console.error('랭킹 조회 에러:', err);
                return res.json([]);
            }
            res.json(results || []);
        }
    );
});

// 사용자 정보 조회 API
app.get('/api/user/:id', (req, res) => {
    const userId = req.params.id;
    
    db.query(
        'SELECT id, username, tuk_points FROM users WHERE id = ?',
        [userId],
        (err, results) => {
            if (err) {
                console.error('사용자 정보 조회 에러:', err);
                return res.json({ success: false, error: '사용자 정보 조회 중 오류가 발생했습니다.' });
            }
            
            if (results.length === 0) {
                return res.json({ success: false, error: '사용자를 찾을 수 없습니다.' });
            }
            
            res.json({ 
                success: true, 
                user: {
                    id: results[0].id,
                    username: results[0].username,
                    tuk_points: results[0].tuk_points || 0
                }
            });
        }
    );
});

// 서버 시작
http.listen(port, '0.0.0.0', () => {
    console.log(`서버가 http://0.0.0.0:${port} 에서 실행 중입니다.`);
}); 