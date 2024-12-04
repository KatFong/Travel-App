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
            messagePreview: req.body.message.substring(0, 100) + '...'
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
                            maxOutputTokens: 4096,
                            topK: 40,
                            topP: 0.95
                        }
                    },
                    timeout: API_CONFIG.timeout
                });

                console.log('Gemini API 響應：', {
                    status: response.status,
                    hasData: !!response.data,
                    hasCandidate: !!response.data?.candidates?.[0],
                    responseLength: response.data?.candidates?.[0]?.content?.parts?.[0]?.text?.length
                });

                if (response.data?.candidates?.[0]?.content?.parts?.[0]?.text) {
                    const responseText = response.data.candidates[0].content.parts[0].text;
                    console.log('成功生成回應，長度：', responseText.length);
                    return res.json({
                        success: true,
                        response: responseText
                    });
                }

                console.error('API 響應格式無效：', response.data);
                throw new Error("無效的 API 響應格式");

            } catch (error) {
                console.error('請求錯誤:', {
                    status: error.response?.status,
                    message: error.message,
                    data: error.response?.data,
                    stack: error.stack
                });

                if (error.response?.status === 429 && retries < API_CONFIG.maxRetries - 1) {
                    retries++;
                    const delay = API_CONFIG.baseDelay * Math.pow(2, retries);
                    console.log(`配額限制，等待 ${delay/1000} 秒後重試 (${retries}/${API_CONFIG.maxRetries})...`);
                    await new Promise(resolve => setTimeout(resolve, delay));
                    continue;
                }
                throw error;
            }
        }

    } catch (error) {
        console.error('處理請求失敗:', {
            error: error,
            message: error.message,
            stack: error.stack,
            response: error.response?.data
        });
        
        res.status(error.response?.status || 500).json({
            success: false,
            error: String(error.message || "請求失敗"),
            details: String(error.response?.data?.error?.message || error.message),
            timestamp: new Date().toISOString()
        });
    }
});

// 啟動服務器
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`服務器運行在: http://localhost:${PORT}`);
}); 