const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');
const path = require('path');
const bcrypt = require('bcrypt');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// MySQL 연결 설정
const db = mysql.createConnection({
    host: '0.0.0.0',
    user: 'root',
    password: '1234',
    database: 'infinitetuk'
});

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
                return res.json({ success: false, error: '로그인 중 오류가 발생했습니다.' });
            }
            
            if (results.length === 0) {
                return res.json({ success: false, error: '아이디 또는 비밀번호가 일치하지 않습니다.' });
            }
            
            try {
                const user = results[0];
                const passwordMatch = await bcrypt.compare(password, user.password);
                
                if (!passwordMatch) {
                    return res.json({ success: false, error: '아이디 또는 비밀번호가 일치하지 않습니다.' });
                }
                
                res.json({ 
                    success: true, 
                    user: {
                        id: user.id,
                        username: user.username,
                        tuk_points: user.tuk_points || 0
                    }
                });
            } catch (error) {
                console.error('비밀번호 검증 에러:', error);
                res.json({ success: false, error: '로그인 중 오류가 발생했습니다.' });
            }
        }
    );
});

// 점수 업데이트 API
app.post('/api/update-score', (req, res) => {
    const { userId, points } = req.body;
    
    db.query(
        'UPDATE users SET tuk_points = tuk_points + ? WHERE id = ?',
        [points, userId],
        (err, result) => {
            if (err) {
                console.error('점수 업데이트 에러:', err);
                return res.json({ success: false, error: '점수 업데이트 중 오류가 발생했습니다.' });
            }
            res.json({ success: true });
        }
    );
});

// 랭킹 조회 API
app.get('/api/rankings', (req, res) => {
    db.query(
        'SELECT username, tuk_points FROM users ORDER BY tuk_points DESC LIMIT 10',
        (err, results) => {
            if (err) {
                console.error('랭킹 조회 에러:', err);
                return res.json([]);
            }
            res.json(results || []);
        }
    );
});

// 서버 시작
app.listen(port, '0.0.0.0', () => {
    console.log(`서버가 http://0.0.0.0:${port} 에서 실행 중입니다.`);
}); 