import express from 'express';
import { createProxyMiddleware } from 'http-proxy-middleware';
import { Request, Response } from 'express';

const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com';

export const setupProxy = (app: express.Application) => {
  // 配置 Proxy 中間件
  const proxyMiddleware = createProxyMiddleware({
    target: GEMINI_API_BASE,
    changeOrigin: true,
    pathRewrite: {
      '^/api/gemini': '', // 移除 /api/gemini 前綴
    },
    onProxyReq: (proxyReq, req, res) => {
      // 添加必要的請求頭
      proxyReq.setHeader('User-Agent', 'Mozilla/5.0');
      
      // 如果有 API key，從環境變量獲取並添加
      const apiKey = process.env.GEMINI_API_KEY;
      if (apiKey) {
        const url = new URL(proxyReq.path, GEMINI_API_BASE);
        url.searchParams.set('key', apiKey);
        proxyReq.path = url.pathname + url.search;
      }
    },
    onError: (err, req, res) => {
      console.error('Proxy Error:', err);
      res.status(500).json({ error: 'Proxy Error' });
    }
  });

  // 使用 Proxy 中間件處理所有 /api/gemini 開頭的請求
  app.use('/api/gemini', proxyMiddleware);
}; 