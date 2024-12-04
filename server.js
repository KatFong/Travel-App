const express = require('express');
const axios = require('axios');
const cors = require('cors');
const HttpsProxyAgent = require('https-proxy-agent');
const path = require('path');
const rateLimit = require('express-rate-limit');

const app = express();

// 基本配置
app.use(cors());
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

// 應用速率限制到 API 路由
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
            userAgent: req.headers['user-agent']  // 記錄用戶代理
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
                        'x-goog-api-key': GEMINI_API_KEY,
                        'User-Agent': req.headers['user-agent'] || 'Unknown Client'
                    },
                    params: {
                        key: GEMINI_API_KEY
                    },
                    data: {
                        contents: [{
                            parts: [{
                                text: req.body.message
                            }]
                        }],
                        generationConfig: {
                            temperature: 0.7,
                            maxOutputTokens: 2048,  // 減少 token 數以提高響應速度
                            topK: 40,
                            topP: 0.95
                        }
                    },
                    timeout: 60000,  // 增加超時時間
                    maxContentLength: 10 * 1024 * 1024,  // 10MB
                    maxBodyLength: 10 * 1024 * 1024  // 10MB
                });

                if (response.data?.candidates?.[0]?.content?.parts?.[0]?.text) {
                    const responseText = response.data.candidates[0].content.parts[0].text;
                    return res.json({
                        success: true,
                        response: responseText
                    });
                }

                throw new Error("無效的 API 響應格式");

            } catch (error) {
                console.error('請求錯誤:', {
                    status: error.response?.status,
                    message: error.message,
                    data: error.response?.data,
                    stack: error.stack,
                    userAgent: req.headers['user-agent']
                });

                if (error.response?.status === 429 && retries < API_CONFIG.maxRetries - 1) {
                    retries++;
                    const delay = API_CONFIG.baseDelay * Math.pow(2, retries);
                    await new Promise(resolve => setTimeout(resolve, delay));
                    continue;
                }

                // 特殊處理移動端錯誤
                if (req.headers['user-agent']?.toLowerCase().includes('mobile')) {
                    throw new Error("移動端請求失敗，請檢查網絡連接並重試");
                }
                throw error;
            }
        }

    } catch (error) {
        console.error('處理請求失敗:', {
            error: error,
            message: error.message,
            userAgent: req.headers['user-agent']
        });
        
        res.status(error.response?.status || 500).json({
            success: false,
            error: String(error.message || "請求失敗"),
            details: String(error.response?.data?.error?.message || error.message),
            timestamp: new Date().toISOString(),
            retry: true  // 添加重試標誌
        });
    }
});

// 添加 Google CSE 配置
const GOOGLE_CSE_API_KEY = 'AIzaSyAPY3eylTKfkUAJWXmJOMQ7V8-1RiwYTLg';
const GOOGLE_CSE_ID = 'a69a81004dcce430b';

// 修改圖片搜索 API
app.post('/api/image', async (req, res) => {
    try {
        if (!req.body.query) {
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

        console.log('搜索圖片:', query);

        try {
            const response = await axios({
                method: 'GET',
                url: 'https://www.googleapis.com/customsearch/v1',  // 修改 API URL
                params: {
                    key: GOOGLE_CSE_API_KEY,
                    cx: GOOGLE_CSE_ID,
                    q: encodeURIComponent(`${query} landmark photo`),
                    searchType: 'image',
                    num: 1,
                    imgSize: 'large',
                    safe: 'active',
                    fields: 'items(link)',  // 只返回需要的字段
                    alt: 'json'
                },
                headers: {
                    'Accept': 'application/json'
                },
                timeout: 10000,
                validateStatus: function (status) {
                    return status >= 200 && status < 500; // 接受所有非 500 錯誤的響應
                }
            });

            console.log('搜索響應:', {
                status: response.status,
                hasItems: !!response.data?.items,
                query: query,
                url: response.config.url,
                params: response.config.params
            });

            if (response.data?.items?.[0]?.link) {
                return res.json({
                    success: true,
                    imageUrl: response.data.items[0].link
                });
            }

            return res.json({
                success: false,
                error: "找不到相關圖片"
            });

        } catch (error) {
            console.error('Google API 錯誤:', {
                message: error.message,
                response: error.response?.data,
                query: query,
                status: error.response?.status,
                query: query
            });
            
            // 返回更詳細的錯誤信息
            return res.status(500).json({
                success: false,
                error: '圖片搜索失敗',
                details: error.response?.data?.error?.message || error.message
            });
        }

    } catch (error) {
        console.error('圖片搜索處理錯誤:', error);
        res.status(500).json({
            success: false,
            error: error.message || '圖片搜索失敗'
        });
    }
});

// 啟動服務器
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`服務器運行在: http://localhost:${PORT}`);
}); 