const express = require('express');
const axios = require('axios');
const cors = require('cors');
const HttpsProxyAgent = require('https-proxy-agent');
const path = require('path');
const rateLimit = require('express-rate-limit');

const app = express();

// CORS 配置必須在所有路由之前
app.use(cors({
    origin: '*',  // 允許所有來源
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Accept', 'x-goog-api-key'],
    credentials: false  // 改為 false，因為我們使用 '*' 作為 origin
}));

// 處理 OPTIONS 請求
app.options('*', cors());

// 其他中間件
app.use(express.json());
app.use(express.static(path.join(__dirname)));

// API 密鑰和 URL
const GEMINI_API_KEY = 'AIzaSyDK8lg8j0usTfev5_Y1P2li2CDWm530QP0';
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent';

// API 配置
const API_CONFIG = {
    maxRetries: 2,
    baseDelay: 5000,
    timeout: 30000
};

// 代理配置
const proxyConfig = {
    host: 'brd.superproxy.io',
    port: '33335',
    auth: {
        username: 'brd-customer-hl_a131286d-zone-datacenter_proxy1-country-us',
        password: 't55krpy9mgbr'
    }
};

// 設置代理
const proxyUrl = `http://${proxyConfig.auth.username}:${proxyConfig.auth.password}@${proxyConfig.host}:${proxyConfig.port}`;
const httpsAgent = new HttpsProxyAgent(proxyUrl);

// 創建 axios 實例
const axiosInstance = axios.create({
    httpsAgent,
    proxy: false,
    timeout: 30000
});

// 速率限制
const limiter = rateLimit({
    windowMs: 30 * 1000,
    max: 3,
    handler: (req, res) => {
        res.status(429).json({
            success: false,
            error: "請求太頻繁，請等待 30 秒後重試",
            retryAfter: 30
        });
    }
});

// 請求日誌中間件
app.use((req, res, next) => {
    console.log('收到請求:', {
        method: req.method,
        url: req.url,
        headers: req.headers,
        body: req.body
    });
    next();
});

// 速率限制
app.use('/api/chat', limiter);

// Gemini API 端點
app.post('/api/chat', async (req, res) => {
    try {
        if (!req.body.message) {
            console.log('錯誤：空消息');
            return res.status(400).json({ success: false, error: "訊息不能為空" });
        }

        console.log('收到請求：', {
            messageLength: req.body.message.length,
            messagePreview: req.body.message.substring(0, 100) + '...',
            userAgent: req.headers['user-agent']
        });

        let retries = 0;
        while (retries < API_CONFIG.maxRetries) {
            try {
                console.log(`嘗試請求 Gemini API (嘗試 ${retries + 1}/${API_CONFIG.maxRetries})`);
                
                const response = await axiosInstance({
                    method: 'POST',
                    url: GEMINI_API_URL,
                    headers: {
                        'Content-Type': 'application/json',
                        'x-goog-api-key': GEMINI_API_KEY
                    },
                    data: {
                        contents: [{
                            parts: [{
                                text: req.body.message
                            }]
                        }],
                        generationConfig: {
                            temperature: 0.7,
                            maxOutputTokens: 2048,
                            topK: 40,
                            topP: 0.95
                        }
                    },
                    timeout: 60000
                });

                if (response.data?.candidates?.[0]?.content?.parts?.[0]?.text) {
                    return res.json({
                        success: true,
                        response: response.data.candidates[0].content.parts[0].text
                    });
                }

                throw new Error("無效的 API 響應格式");

            } catch (error) {
                console.error('請求錯誤:', {
                    status: error.response?.status,
                    message: error.message,
                    data: error.response?.data
                });

                if (error.response?.status === 429 && retries < API_CONFIG.maxRetries - 1) {
                    retries++;
                    const delay = API_CONFIG.baseDelay * Math.pow(2, retries);
                    await new Promise(resolve => setTimeout(resolve, delay));
                    continue;
                }
                throw error;
            }
        }

    } catch (error) {
        console.error('處理請求失敗:', error);
        res.status(error.response?.status || 500).json({
            success: false,
            error: String(error.message || "請求失敗"),
            details: String(error.response?.data?.error?.message || error.message)
        });
    }
});

// 圖片搜索 API 端點
app.post('/api/image', async (req, res) => {
    try {
        if (!req.body?.query) {
            return res.status(400).json({ 
                success: false, 
                error: "搜索關鍵詞不能為空" 
            });
        }

        const query = req.body.query.trim();
        if (query.length < 2) {
            return res.status(400).json({
                success: false,
                error: "搜索關鍵詞太短"
            });
        }

        console.log('搜索圖片:', {
            query: query,
            userAgent: req.headers['user-agent']
        });

        // 使用 Google 圖片搜索
        try {
            const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(query)}&tbm=isch`;
            const response = await axios({
                method: 'GET',
                url: searchUrl,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                    'Accept-Language': 'en-US,en;q=0.5',
                    'Referer': 'https://www.google.com/'
                },
                timeout: 5000
            });

            // 解析 HTML 找到圖片 URL
            const html = response.data;
            const imgUrls = html.match(/\["(https?:\/\/[^"]+\.(?:jpg|jpeg|png|gif))"/g);
            
            if (imgUrls && imgUrls.length > 0) {
                // 清理 URL 並過濾掉無效的
                const cleanUrls = imgUrls
                    .map(url => url.slice(2, -1))  // 移除 [" 和 "]
                    .filter(url => {
                        try {
                            new URL(url);
                            return true;
                        } catch {
                            return false;
                        }
                    });

                if (cleanUrls.length > 0) {
                    // 隨機選擇一個 URL
                    const randomIndex = Math.floor(Math.random() * Math.min(5, cleanUrls.length));
                    return res.json({
                        success: true,
                        imageUrl: cleanUrls[randomIndex],
                        source: 'google'
                    });
                }
            }

            // 如果沒有找到圖片，返回錯誤
            return res.json({
                success: false,
                error: "找不到相關圖片"
            });

        } catch (googleError) {
            console.error('Google 圖片搜索失敗:', googleError.message);
            
            // 如果 Google 搜索失敗，使用備用的 Unsplash
            try {
                const unsplashResponse = await axios({
                    method: 'GET',
                    url: 'https://source.unsplash.com/800x600',
                    params: {
                        query: `${query} travel`,
                    },
                    maxRedirects: 5,
                    timeout: 5000
                });

                if (unsplashResponse.request?.res?.responseUrl) {
                    return res.json({
                        success: true,
                        imageUrl: unsplashResponse.request.res.responseUrl,
                        source: 'unsplash'
                    });
                }
            } catch (unsplashError) {
                console.error('Unsplash 備用搜索失敗:', unsplashError.message);
            }
        }

        return res.json({
            success: false,
            error: "找不到相關圖片"
        });

    } catch (error) {
        console.error('圖片搜索錯誤:', {
            error: error.message,
            query: req.body?.query,
            stack: error.stack
        });

        res.status(error.response?.status || 500).json({
            success: false,
            error: '圖片搜索失敗',
            details: error.response?.data?.error?.message || error.message
        });
    }
});

// 修改代理狀態 API 路由
app.get('/api/proxy-status', (req, res) => {
    try {
        res.json({
            success: true,
            enabled: !!proxyConfig,
            host: proxyConfig ? `${proxyConfig.host}:${proxyConfig.port}` : null,
            connected: !!httpsAgent,
            lastCheck: new Date().toISOString()
        });
    } catch (error) {
        console.error('代理狀態檢查錯誤:', error);
        res.status(500).json({
            success: false,
            enabled: false,
            error: error.message
        });
    }
});

// 確保 OPTIONS 請求能正確響應
app.options('*', (req, res) => {
    res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Accept, X-Requested-With');
    res.header('Access-Control-Allow-Credentials', 'true');
    res.status(200).end();
});

// 添加錯誤處理中間件
app.use((err, req, res, next) => {
    console.error('服務器錯誤:', {
        error: err,
        url: req.url,
        method: req.method,
        userAgent: req.headers['user-agent']
    });
    
    res.status(500).json({
        success: false,
        error: '服務器錯誤',
        details: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
});

// 啟動服務器
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`服務器運行在: http://localhost:${PORT}`);
}); 